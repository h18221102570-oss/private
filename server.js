import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec, spawn } from 'child_process';
import {
  initDB, saveDB,
  getAdminByUsername, getAdminById, getAdmins, createAdmin, updateAdminPassword, deleteAdmin,
  getProjects, getProjectById, createProject, updateProject, deleteProject,
  getDocuments, getDocumentById, getDocumentWithFileData, createDocument, softDeleteDocument, restoreDocument, permanentDeleteDocument,
  getDeletedDocuments, emptyTrash, searchDocuments, getDocumentsByProject, getDocumentsByPhase,
  getTasks, getTaskById, createTask, updateTask, deleteTask,
  getMembers, getMemberById, createMember, updateMember, deleteMember,
  getDashboardStats,
} from './server-db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const FILES_DIR = path.join(DATA_DIR, 'files');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// ========== Helpers ==========

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getDeepSeekKey() {
  return process.env.DEEPSEEK_API_KEY || loadConfig().deepseekApiKey || '';
}

// ========== 初始化 ==========

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// 初始化 SQLite 数据库
await initDB();

// ========== Auth Tokens ==========

const tokens = new Map();

function generateToken(adminId) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { adminId, createdAt: Date.now() });
  setTimeout(() => tokens.delete(token), 24 * 60 * 60 * 1000);
  return token;
}

function getAuth(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return tokens.get(token) || null;
}

// ========== Middleware ==========

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 生产模式：托管前端静态文件
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

function requireAuth(req, res, next) {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: '请先登录' });
  req.auth = auth;
  next();
}

async function requireSuperAdmin(req, res, next) {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: '请先登录' });
  const admin = getAdminById(auth.adminId);
  if (!admin || admin.role !== 'super_admin') {
    return res.status(403).json({ message: '仅超级管理员可操作' });
  }
  req.auth = auth;
  next();
}

const aiRateLimit = new Map();
function checkAIRate(req, res, next) {
  const auth = getAuth(req);
  const key = auth?.adminId || req.ip;
  const now = Date.now();
  const window = aiRateLimit.get(key) || [];
  const recent = window.filter((t) => now - t < 60000);
  if (recent.length >= 20) {
    return res.status(429).json({ message: '请求过于频繁，请稍后再试' });
  }
  recent.push(now);
  aiRateLimit.set(key, recent);
  next();
}

function safeError(res, e, fallback = '操作失败') {
  console.error(e.message);
  res.status(500).json({ message: fallback });
}

function pick(obj, keys) {
  const result = {};
  for (const k of keys) {
    if (obj[k] !== undefined) result[k] = obj[k];
  }
  return result;
}

function mimeToExt(mimeType) {
  const map = {
    'application/pdf': '.pdf', 'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
    'image/svg+xml': '.svg', 'image/webp': '.webp',
    'text/plain': '.txt', 'text/csv': '.csv',
    'application/zip': '.zip', 'application/x-rar-compressed': '.rar',
    'application/x-7z-compressed': '.7z', 'application/json': '.json',
    'video/mp4': '.mp4', 'application/dwg': '.dwg', 'application/x-autocad': '.dwg',
  };
  return map[mimeType] || '';
}

// ========== Auth API ==========

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const hashed = hashPassword(String(password || ''));
  const admin = getAdminByUsername(username);
  if (admin && admin.password === hashed) {
    const token = generateToken(admin.id);
    res.json({ success: true, token, role: admin.role, username: admin.username, adminId: admin.id });
  } else {
    res.status(401).json({ success: false, message: '账号或密码错误' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  tokens.delete(token);
  res.json({ success: true });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const admin = getAdminById(req.auth.adminId);
  if (!admin) return res.status(404).json({ message: '账号不存在' });
  if (oldPassword && hashPassword(oldPassword) !== admin.password) {
    return res.status(400).json({ message: '原密码错误' });
  }
  updateAdminPassword(req.auth.adminId, hashPassword(String(newPassword || '')));
  res.json({ success: true });
});

app.post('/api/auth/reset-password', requireSuperAdmin, (req, res) => {
  const { adminId, newPassword } = req.body;
  const admin = getAdminById(adminId);
  if (!admin) return res.status(404).json({ message: '账号不存在' });
  updateAdminPassword(adminId, hashPassword(String(newPassword || '')));
  res.json({ success: true });
});

// ========== Admin Management ==========

app.get('/api/admins', requireAuth, (_req, res) => {
  res.json(getAdmins());
});

app.post('/api/admins', requireSuperAdmin, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
  if (getAdminByUsername(username)) {
    return res.status(400).json({ message: '用户名已存在' });
  }
  const id = crypto.randomUUID();
  createAdmin(id, String(username), hashPassword(String(password)), 'admin');
  res.status(201).json({ id, username: String(username), role: 'admin', createdAt: new Date().toISOString() });
});

app.delete('/api/admins/:id', requireSuperAdmin, (req, res) => {
  const admin = getAdminById(req.params.id);
  if (!admin) return res.status(404).json({ message: '账号不存在' });
  if (admin.role === 'super_admin') return res.status(403).json({ message: '不能删除超级管理员' });
  deleteAdmin(req.params.id);
  res.json({ success: true });
});

// ========== Projects API ==========

const PROJECT_FIELDS = ['name','description','status','currentPhase','location','manager','budget','startDate','endDate','developer','contractor','designUnit','supervisor','projectType','buildingArea','structureType','floorCount','memberIds'];

app.get('/api/projects', requireAuth, (_req, res) => {
  res.json(getProjects());
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const p = getProjectById(req.params.id);
  if (!p) return res.status(404).json({ message: '项目未找到' });
  res.json(p);
});

app.post('/api/projects', requireAuth, (req, res) => {
  const project = {
    ...pick(req.body, PROJECT_FIELDS),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  createProject(project);
  res.status(201).json(project);
});

app.put('/api/projects/:id', requireAuth, (req, res) => {
  const p = getProjectById(req.params.id);
  if (!p) return res.status(404).json({ message: '项目未找到' });
  updateProject(req.params.id, { ...pick(req.body, PROJECT_FIELDS), updatedAt: new Date().toISOString() });
  res.json({ ...p, ...pick(req.body, PROJECT_FIELDS) });
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const p = getProjectById(req.params.id);
  if (!p) return res.status(404).json({ message: '项目未找到' });
  deleteProject(req.params.id);
  res.json({ success: true });
});

// ========== Documents API ==========

app.get('/api/documents', requireAuth, (req, res) => {
  const { projectId, phase } = req.query;
  const filter = {};
  if (projectId) filter.projectId = projectId;
  if (phase) filter.phase = phase;
  res.json(getDocuments(filter));
});

app.post('/api/documents', requireAuth, (req, res) => {
  const docId = crypto.randomUUID();
  let filePath = '';
  let fileDataBuffer = null;

  if (req.body.fileData) {
    const safeExt = mimeToExt(req.body.fileType) || '.bin';
    const fileName = `${docId}${safeExt}`;
    filePath = `files/${fileName}`;
    const fullPath = path.join(FILES_DIR, fileName);
    try {
      fileDataBuffer = Buffer.from(req.body.fileData, 'base64');
      // 同时保存到文件系统（用于 mammoth 等需要文件路径的操作）
      fs.writeFileSync(fullPath, fileDataBuffer);
    } catch (e) {
      return safeError(res, e, '文件保存失败');
    }
  }

  const doc = {
    id: docId,
    projectId: String(req.body.projectId || ''),
    phase: req.body.phase || 'construction',
    name: String(req.body.name || '未命名'),
    category: req.body.category || 'other',
    fileType: String(req.body.fileType || 'application/octet-stream'),
    fileSize: Number(req.body.fileSize) || 0,
    filePath: filePath || '',
    fileData: fileDataBuffer || null,
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    description: String(req.body.description || ''),
    deleted: false,
    uploadedAt: new Date().toISOString(),
  };
  createDocument(doc);
  res.status(201).json({ ...doc, fileData: undefined, filePath: doc.filePath });
});

app.put('/api/documents/:id/soft-delete', requireAuth, (req, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) return res.status(404).json({ message: '文档未找到' });
  softDeleteDocument(req.params.id);
  res.json({ success: true });
});

app.put('/api/documents/:id/restore', requireAuth, (req, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) return res.status(404).json({ message: '文档未找到' });
  restoreDocument(req.params.id);
  res.json({ success: true });
});

app.delete('/api/documents/:id', requireAuth, (req, res) => {
  const doc = getDocumentById(req.params.id);
  if (!doc) return res.status(404).json({ message: '文档未找到' });
  if (doc.filePath) {
    const fp = path.join(DATA_DIR, doc.filePath);
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) { /* ignore */ }
  }
  permanentDeleteDocument(req.params.id);
  res.json({ success: true });
});

app.get('/api/documents/deleted', requireAuth, (_req, res) => {
  res.json(getDeletedDocuments());
});

app.post('/api/documents/empty-trash', requireAuth, (_req, res) => {
  const deletedDocs = getDeletedDocuments();
  for (const doc of deletedDocs) {
    if (doc.filePath) {
      const fp = path.join(DATA_DIR, doc.filePath);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) { /* ignore */ }
    }
  }
  emptyTrash();
  res.json({ success: true });
});

app.get('/api/documents/search', requireAuth, (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.json([]);
  res.json(searchDocuments(String(keyword)));
});

// ========== File Download / View ==========

app.get('/api/files/download/:docId', requireAuth, (req, res) => {
  const doc = getDocumentById(req.params.docId);
  if (!doc) return res.status(404).json({ message: '文件未找到' });
  // 优先从文件系统读取，回退到数据库 BLOB
  if (doc.filePath) {
    const fp = path.join(DATA_DIR, doc.filePath);
    if (fs.existsSync(fp)) {
      return res.download(fp, doc.name + path.extname(doc.filePath));
    }
  }
  const fullDoc = getDocumentWithFileData(req.params.docId);
  if (fullDoc && fullDoc.fileData) {
    const buf = fullDoc.fileData instanceof Uint8Array ? Buffer.from(fullDoc.fileData) : Buffer.from(fullDoc.fileData, 'base64');
    const ext = path.extname(doc.name) || mimeToExt(doc.fileType) || '.bin';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.name)}"`);
    res.setHeader('Content-Type', doc.fileType || 'application/octet-stream');
    return res.send(buf);
  }
  res.status(404).json({ message: '文件不存在' });
});

app.get('/api/files/view/:docId', requireAuth, (req, res) => {
  const doc = getDocumentById(req.params.docId);
  if (!doc) return res.status(404).json({ message: '文件未找到' });
  if (doc.filePath) {
    const fp = path.join(DATA_DIR, doc.filePath);
    if (fs.existsSync(fp)) {
      res.contentType(doc.fileType || 'application/octet-stream');
      return fs.createReadStream(fp).pipe(res);
    }
  }
  const fullDoc = getDocumentWithFileData(req.params.docId);
  if (fullDoc && fullDoc.fileData) {
    const buf = fullDoc.fileData instanceof Uint8Array ? Buffer.from(fullDoc.fileData) : Buffer.from(fullDoc.fileData, 'base64');
    res.contentType(doc.fileType || 'application/octet-stream');
    return res.send(buf);
  }
  res.status(404).json({ message: '文件不存在' });
});

app.get('/api/files/preview-docx/:docId', requireAuth, async (req, res) => {
  try {
    const doc = getDocumentById(req.params.docId);
    if (!doc) return res.status(404).json({ message: '文件未找到' });

    let fp = null;
    if (doc.filePath) {
      fp = path.join(DATA_DIR, doc.filePath);
      if (!fs.existsSync(fp)) fp = null;
    }
    // 如果文件系统没有，从数据库提取到临时文件
    if (!fp) {
      const fullDoc = getDocumentWithFileData(req.params.docId);
      if (fullDoc && fullDoc.fileData) {
        const buf = fullDoc.fileData instanceof Uint8Array ? Buffer.from(fullDoc.fileData) : Buffer.from(fullDoc.fileData, 'base64');
        const ext = mimeToExt(doc.fileType) || '.docx';
        fp = path.join(FILES_DIR, `_tmp_${req.params.docId}${ext}`);
        fs.writeFileSync(fp, buf);
      }
    }
    if (!fp || !fs.existsSync(fp)) return res.status(404).json({ message: '文件不存在' });

    const mammoth = await import('mammoth');
    const result = await mammoth.default.convertToHtml({ path: fp });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;font-size:14px;line-height:1.8;color:#1d1d1f;max-width:800px;margin:0 auto;padding:20px}h1,h2,h3{font-weight:700;margin-top:1.2em;margin-bottom:.5em}p{margin:.5em 0}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ddd;padding:8px 12px;font-size:13px}img{max-width:100%}</style></head><body>${result.value}</body></html>`);
  } catch (e) {
    safeError(res, e, '文档转换失败');
  }
});

// ========== Tasks API ==========

const TASK_FIELDS = ['projectId', 'title', 'description', 'status', 'priority', 'assignee', 'dueDate'];

app.get('/api/tasks', requireAuth, (req, res) => {
  res.json(getTasks(req.query.projectId || undefined));
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const task = {
    ...pick(req.body, TASK_FIELDS),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  createTask(task);
  res.status(201).json(task);
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const t = getTaskById(req.params.id);
  if (!t) return res.status(404).json({ message: '任务未找到' });
  const updates = { ...pick(req.body, TASK_FIELDS), updatedAt: new Date().toISOString() };
  if (req.body.status === 'completed') updates.completedAt = new Date().toISOString();
  updateTask(req.params.id, updates);
  res.json({ ...t, ...updates });
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const t = getTaskById(req.params.id);
  if (!t) return res.status(404).json({ message: '任务未找到' });
  deleteTask(req.params.id);
  res.json({ success: true });
});

// ========== Stats ==========

app.get('/api/stats', requireAuth, (_req, res) => {
  const projects = getProjects();
  const docs = getDocuments();
  const tasks = getTasks();
  const phaseDistribution = {};
  for (const p of projects) {
    phaseDistribution[p.currentPhase] = (phaseDistribution[p.currentPhase] || 0) + 1;
  }
  res.json({
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'in_progress').length,
    totalDocuments: docs.length,
    pendingTasks: tasks.filter((t) => t.status !== 'completed').length,
    phaseDistribution,
  });
});

app.get('/api/data/export', requireAuth, (_req, res) => {
  const data = {
    projects: getProjects(),
    documents: getDocuments(),
    tasks: getTasks(),
    members: getMembers(),
    admins: getAdmins(),
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
});

app.get('/api/data/summary', requireAuth, (_req, res) => {
  const stats = getDashboardStats();
  const deletedDocs = getDeletedDocuments();
  res.json({
    projects: stats.totalProjects,
    documents: stats.totalDocuments,
    deletedDocs: deletedDocs.length,
    tasks: stats.pendingTasks + stats.completedTasks,
    pendingTasks: stats.pendingTasks,
    dbSize: 0,
  });
});

app.post('/api/data/open-folder', requireAuth, (_req, res) => {
  const cmd = process.platform === 'win32'
    ? `explorer "${DATA_DIR}"`
    : process.platform === 'darwin'
      ? `open "${DATA_DIR}"`
      : `xdg-open "${DATA_DIR}"`;
  exec(cmd, (err) => {
    if (err) return res.status(500).json({ message: '打开文件夹失败' });
    res.json({ success: true });
  });
});

// ========== Members API ==========

const MEMBER_FIELDS = ['name', 'role', 'phone', 'email', 'department', 'notes'];

app.get('/api/members', requireAuth, (_req, res) => {
  res.json(getMembers());
});

app.post('/api/members', requireAuth, (req, res) => {
  const member = {
    ...pick(req.body, MEMBER_FIELDS),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  createMember(member);
  res.status(201).json(member);
});

app.put('/api/members/:id', requireAuth, (req, res) => {
  const m = getMemberById(req.params.id);
  if (!m) return res.status(404).json({ message: '成员未找到' });
  updateMember(req.params.id, pick(req.body, MEMBER_FIELDS));
  res.json({ ...m, ...pick(req.body, MEMBER_FIELDS) });
});

app.delete('/api/members/:id', requireAuth, (req, res) => {
  const m = getMemberById(req.params.id);
  if (!m) return res.status(404).json({ message: '成员未找到' });
  deleteMember(req.params.id);
  res.json({ success: true });
});

// ========== AI ==========

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

async function callDeepSeek(messages) {
  const apiKey = getDeepSeekKey();
  if (!apiKey) throw new Error('请先配置 DeepSeek API Key');
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.7 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'AI 请求失败');
  }
  return res;
}

app.get('/api/ai/config', requireAuth, (_req, res) => {
  const key = getDeepSeekKey();
  res.json({ hasKey: !!key, keyPreview: key ? key.slice(0, 3) + '****' + key.slice(-4) : '' });
});

app.post('/api/ai/config', requireAuth, (req, res) => {
  const { apiKey } = req.body;
  const config = loadConfig();
  config.deepseekApiKey = String(apiKey || '');
  saveConfig(config);
  res.json({ success: true });
});

app.post('/api/ai/chat', requireAuth, checkAIRate, async (req, res) => {
  try {
    const { messages, projectContext } = req.body;
    let systemMsg = '你是一个工程项目管理助手，帮助用户管理工程项目的全周期资料。请用中文回复，简洁专业。';
    if (projectContext) systemMsg += `\n当前上下文：${String(projectContext)}`;
    const aiRes = await callDeepSeek([{ role: 'system', content: systemMsg }, ...(Array.isArray(messages) ? messages : [])]);
    const data = await aiRes.json();
    res.json({ content: data.choices[0].message.content });
  } catch (e) {
    safeError(res, e, 'AI 对话失败');
  }
});

app.get('/api/ai/search', requireAuth, checkAIRate, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);
    const activeDocs = getDocuments();
    const projects = getProjects();
    const docSummaries = activeDocs.map((d) => {
      const project = projects.find((p) => p.id === d.projectId);
      return `[${d.id}] ${d.name} | 项目:${project?.name || '未知'} | 阶段:${d.phase} | 描述:${d.description}`;
    }).join('\n');
    const messages = [
      { role: 'system', content: `搜索助手。从文档列表中找出最相关的结果，只返回匹配的文档ID JSON数组。\n${docSummaries}` },
      { role: 'user', content: String(q) },
    ];
    const aiRes = await callDeepSeek(messages);
    const data = await aiRes.json();
    const content = data.choices[0].message.content;
    const match = content.match(/\[[\s\S]*?\]/);
    const ids = match ? JSON.parse(match[0]) : [];
    res.json(activeDocs.filter((d) => ids.includes(d.id)));
  } catch (e) {
    safeError(res, e, 'AI 搜索失败');
  }
});

app.post('/api/ai/analyze-doc', requireAuth, checkAIRate, async (req, res) => {
  try {
    const { docName, docContent, docType } = req.body;
    const prompt = `分析文档并返回JSON: { "summary": "摘要", "keywords": ["关键词"], "phase": "阶段", "type": "类型" }\n文档:${String(docName)}\n${String(docContent).slice(0, 4000)}`;
    const aiRes = await callDeepSeek([{ role: 'user', content: prompt }]);
    const data = await aiRes.json();
    const match = data.choices[0].message.content.match(/\{[\s\S]*?\}/);
    res.json(match ? JSON.parse(match[0]) : { summary: '分析失败', keywords: [] });
  } catch (e) {
    safeError(res, e, 'AI 分析失败');
  }
});

// ========== OCR ==========

const SCRIPTS_DIR = path.join(__dirname, 'scripts');

function runPythonScript(scriptName, ...args) {
  return new Promise((resolve, reject) => {
    const pyExe = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pyExe, [path.join(SCRIPTS_DIR, scriptName), ...args], {
      maxBuffer: 50 * 1024 * 1024,
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || 'OCR 执行失败'));
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error('OCR 结果解析失败')); }
    });
    proc.on('error', (err) => reject(err));
  });
}

app.post('/api/ocr/recognize', requireAuth, async (req, res) => {
  try {
    const { docId } = req.body;
    if (!docId) return res.status(400).json({ message: '请提供文件ID' });

    const doc = getDocumentById(docId);
    if (!doc) return res.status(404).json({ message: '文件未找到' });

    let fp = null;
    if (doc.filePath) {
      fp = path.join(DATA_DIR, doc.filePath);
      if (!fs.existsSync(fp)) fp = null;
    }
    if (!fp) {
      const fullDoc = getDocumentWithFileData(docId);
      if (fullDoc && fullDoc.fileData) {
        const buf = fullDoc.fileData instanceof Uint8Array ? Buffer.from(fullDoc.fileData) : Buffer.from(fullDoc.fileData, 'base64');
        const ext = path.extname(doc.name) || mimeToExt(doc.fileType) || '.png';
        fp = path.join(FILES_DIR, `_ocr_${docId}${ext}`);
        fs.writeFileSync(fp, buf);
      }
    }
    if (!fp || !fs.existsSync(fp)) return res.status(404).json({ message: '文件不存在' });

    const result = await runPythonScript('ocr.py', fp, '--lang', 'ch');
    res.json(result);
  } catch (e) {
    safeError(res, e, 'OCR 识别失败');
  }
});

app.post('/api/ocr/extract', requireAuth, checkAIRate, async (req, res) => {
  try {
    const { text, prompt } = req.body;
    if (!text) return res.status(400).json({ message: '请提供待提取的文本' });
    const userPrompt = prompt || '请提取以下文本中的工程关键信息，以 JSON 格式返回，字段名用英文。';
    const messages = [
      { role: 'system', content: '你是一个专业的工程资料结构化提取助手。请严格按照用户要求的格式提取信息，只返回提取结果，不要添加额外说明。' },
      { role: 'user', content: `${userPrompt}\n\n待提取文本：\n${text.slice(0, 15000)}` },
    ];
    const aiRes = await callDeepSeek(messages);
    const data = await aiRes.json();
    const content = data.choices[0].message.content;
    let extracted = null;
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try { extracted = JSON.parse(jsonMatch[0]); }
      catch { extracted = { raw: content }; }
    } else {
      extracted = { raw: content };
    }
    res.json({ success: true, extracted, rawContent: content });
  } catch (e) {
    safeError(res, e, 'AI 提取失败');
  }
});

// ========== 智能文件收纳 ==========

app.post('/api/files/classify', requireAuth, checkAIRate, async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !files.length) return res.status(400).json({ message: '请提供文件列表' });
    const categoriesCN = { drawing: '图纸', contract: '合同', report: '报告', approval: '审批文件', plan: '施工方案', acceptance_doc: '验收文件', other: '其他' };
    const phasesCN = { initiation: '立项阶段', design: '设计阶段', bidding: '招标阶段', construction: '施工阶段', acceptance: '验收阶段', operation: '运维阶段' };
    let filesInfo = '';
    for (let i = 0; i < files.length; i++) {
      filesInfo += `文件${i+1}:\n名称:${files[i].name}\n类型:${files[i].fileType||'未知'}\n内容:${String(files[i].textContent||'').slice(0,2000)}\n\n`;
    }
    const prompt = `你是工程文件归档专家。对以下文件分类并返回JSON数组:\n[{"index":1,"category":"contract","phase":"bidding","suggestedName":"标准化名","summary":"摘要"}]\n分类:drawing/contract/report/approval/plan/acceptance_doc/other\n阶段:initiation/design/bidding/construction/acceptance/operation\n\n${filesInfo}只返回JSON数组。`;
    const aiRes = await callDeepSeek([{ role: 'user', content: prompt }]);
    const data = await aiRes.json();
    const match = data.choices[0].message.content.match(/\[[\s\S]*\]/);
    const results = match ? JSON.parse(match[0]) : [];
    const classified = files.map((f, i) => {
      const r = results.find((r) => r.index === i+1);
      return {
        name: f.name, size: f.size,
        category: r?.category||'other', categoryLabel: categoriesCN[r?.category]||'其他',
        phase: r?.phase||'construction', phaseLabel: phasesCN[r?.phase]||'施工阶段',
        suggestedName: r?.suggestedName||'', summary: r?.summary||'',
      };
    });
    res.json(classified);
  } catch (e) {
    console.error('AI classify error:', e.message);
    const results = (req.body.files || []).map((f) => {
      const combined = (f.name + ' ' + (f.textContent || '')).toLowerCase();
      let cat = 'other', ph = 'construction';
      if (/图|设计图|施工图|cad|dwg/.test(combined)) { cat='drawing'; ph='design'; }
      else if (/合同|协议|招标|投标/.test(combined)) { cat='contract'; ph='bidding'; }
      else if (/报告|检测|评估|鉴定/.test(combined)) { cat='report'; ph='acceptance'; }
      else if (/审批|报审|申请/.test(combined)) { cat='approval'; ph='bidding'; }
      else if (/方案|施工组织|计划/.test(combined)) { cat='plan'; ph='construction'; }
      else if (/验收|竣工|交付/.test(combined)) { cat='acceptance_doc'; ph='acceptance'; }
      else if (/开工|规划|可研/.test(combined)) { cat='plan'; ph='initiation'; }
      return { name:f.name, size:f.size, category:cat, categoryLabel:'其他', phase:ph, phaseLabel:'施工阶段', suggestedName:'', summary:'' };
    });
    res.json(results);
  }
});

app.post('/api/files/batch-upload', requireAuth, (req, res) => {
  try {
    const { projectId, files } = req.body;
    if (!projectId) return res.status(400).json({ message: '请选择目标项目' });
    if (!files || !files.length) return res.status(400).json({ message: '请提供文件' });
    const saved = [];
    for (const file of files) {
      const docId = crypto.randomUUID();
      let filePath = '';
      let fileDataBuffer = null;
      if (file.fileData) {
        const safeExt = mimeToExt(file.fileType) || '.bin';
        filePath = `files/${docId}${safeExt}`;
        const fullPath = path.join(FILES_DIR, `${docId}${safeExt}`);
        fileDataBuffer = Buffer.from(file.fileData, 'base64');
        fs.writeFileSync(fullPath, fileDataBuffer);
      }
      const doc = {
        id: docId, projectId: String(projectId),
        name: String(file.name || '未命名'),
        phase: file.phase || 'construction', category: file.category || 'other',
        fileType: String(file.fileType || 'application/octet-stream'),
        fileSize: Number(file.size) || 0,
        filePath, fileData: fileDataBuffer,
        tags: Array.isArray(file.tags) ? file.tags : [],
        description: String(file.description || ''),
        deleted: false, uploadedAt: new Date().toISOString(),
      };
      createDocument(doc);
      saved.push({ id: doc.id, name: doc.name, phase: doc.phase, category: doc.category });
    }
    res.json({ success: true, count: saved.length, documents: saved });
  } catch (e) {
    safeError(res, e, '文件上传失败');
  }
});

// ========== Public ==========

app.get('/api/sync-time', (_req, res) => {
  const dbFile = path.join(DATA_DIR, 'app.db');
  try {
    const stat = fs.statSync(dbFile);
    res.json({ lastSaved: stat.mtime.toISOString() });
  } catch {
    res.json({ lastSaved: new Date().toISOString() });
  }
});

app.get('/api/system/memory', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    rss: (mem.rss / 1024 / 1024).toFixed(1) + ' MB',
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1) + ' MB',
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1) + ' MB',
    external: (mem.external / 1024 / 1024).toFixed(1) + ' MB',
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`SQLite database: ${path.join(DATA_DIR, 'app.db')}`);
  console.log(`Files: ${FILES_DIR}`);
  console.log(`Backups: ${BACKUP_DIR}`);
});
