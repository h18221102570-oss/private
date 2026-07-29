import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DB_FILE = path.join(DATA_DIR, 'database.json');
const DB_TMP = path.join(DATA_DIR, 'database.tmp');
const FILES_DIR = path.join(DATA_DIR, 'files');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = 10;

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

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// ========== JSON Database ==========

let db = { projects: [], documents: [], tasks: [], members: [], admins: [] };

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')) };
    }
  } catch (e) {
    console.error('Failed to load database, starting fresh:', e.message);
  }
  // 迁移旧数据
  if (db.credentials || !db.admins || !Array.isArray(db.admins) || db.admins.length === 0) {
    if (db.credentials) {
      db.admins = [{
        id: crypto.randomUUID(),
        username: db.credentials.username || '黄康杰',
        password: hashPassword(db.credentials.password || '123456789'),
        role: 'super_admin',
        createdAt: new Date().toISOString(),
      }];
    } else {
      db.admins = [{
        id: crypto.randomUUID(),
        username: '黄康杰',
        password: hashPassword('123456789'),
        role: 'super_admin',
        createdAt: new Date().toISOString(),
      }];
    }
    delete db.credentials;
    saveDB();
  }
  // 自动哈希化未加密的密码（SHA-256 哈希值为 64 字符）
  let needSave = false;
  for (const admin of db.admins) {
    if (admin.password && admin.password.length !== 64) {
      admin.password = hashPassword(admin.password);
      needSave = true;
    }
  }
  if (needSave) saveDB();
}

function saveDB() {
  try {
    // 原子写入：先写临时文件，再重命名
    fs.writeFileSync(DB_TMP, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(DB_TMP, DB_FILE);
    // 自动备份
    autoBackup();
  } catch (e) {
    console.error('Failed to save database:', e.message);
  }
}

function autoBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
    fs.copyFileSync(DB_FILE, backupFile);
    // 清理旧备份
    const backups = fs.readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('backup-'))
      .sort()
      .reverse();
    for (let i = MAX_BACKUPS; i < backups.length; i++) {
      fs.unlinkSync(path.join(BACKUP_DIR, backups[i]));
    }
  } catch (e) { /* ignore */ }
}

loadDB();

// ========== Auth Tokens ==========

const tokens = new Map(); // token -> { adminId, role, createdAt }

function generateToken(adminId) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens.set(token, { adminId, createdAt: Date.now() });
  // 24小时过期
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

// ========== 生产模式：托管前端静态文件 ==========
const DIST_DIR = path.join(__dirname, 'dist');
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  // SPA fallback：所有非 API 请求返回 index.html
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// 鉴权中间件
function requireAuth(req, res, next) {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: '请先登录' });
  req.auth = auth;
  next();
}

// 超级管理员鉴权
function requireSuperAdmin(req, res, next) {
  const auth = getAuth(req);
  if (!auth) return res.status(401).json({ message: '请先登录' });
  const admin = db.admins.find((a) => a.id === auth.adminId);
  if (!admin || admin.role !== 'super_admin') {
    return res.status(403).json({ message: '仅超级管理员可操作' });
  }
  req.auth = auth;
  next();
}

// AI 速率限制（每分钟最多20次）
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

// 安全错误处理
function safeError(res, e, fallback = '操作失败') {
  console.error(e.message);
  res.status(500).json({ message: fallback });
}

// 白名单字段过滤
function pick(obj, keys) {
  const result = {};
  for (const k of keys) {
    if (obj[k] !== undefined) result[k] = obj[k];
  }
  return result;
}

function mimeToExt(mimeType) {
  const map = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
    'application/x-7z-compressed': '.7z',
    'application/json': '.json',
    'video/mp4': '.mp4',
    'application/dwg': '.dwg',
    'application/x-autocad': '.dwg',
  };
  return map[mimeType] || '';
}

// ========== Auth API ==========

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const hashed = hashPassword(String(password || ''));
  const admin = db.admins.find((a) => a.username === username && a.password === hashed);
  if (admin) {
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
  const admin = db.admins.find((a) => a.id === req.auth.adminId);
  if (!admin) return res.status(404).json({ message: '账号不存在' });
  if (oldPassword && hashPassword(oldPassword) !== admin.password) {
    return res.status(400).json({ message: '原密码错误' });
  }
  admin.password = hashPassword(String(newPassword || ''));
  saveDB();
  res.json({ success: true });
});

app.post('/api/auth/reset-password', requireSuperAdmin, (req, res) => {
  const { adminId, newPassword } = req.body;
  const admin = db.admins.find((a) => a.id === adminId);
  if (!admin) return res.status(404).json({ message: '账号不存在' });
  admin.password = hashPassword(String(newPassword || ''));
  saveDB();
  res.json({ success: true });
});

// ========== Admin Management ==========

app.get('/api/admins', requireAuth, (_req, res) => {
  res.json(db.admins.map((a) => ({ id: a.id, username: a.username, role: a.role, createdAt: a.createdAt })));
});

app.post('/api/admins', requireSuperAdmin, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
  if (db.admins.find((a) => a.username === username)) {
    return res.status(400).json({ message: '用户名已存在' });
  }
  const admin = {
    id: crypto.randomUUID(),
    username: String(username),
    password: hashPassword(String(password)),
    role: 'admin',
    createdAt: new Date().toISOString(),
  };
  db.admins.push(admin);
  saveDB();
  res.status(201).json({ id: admin.id, username: admin.username, role: admin.role, createdAt: admin.createdAt });
});

app.delete('/api/admins/:id', requireSuperAdmin, (req, res) => {
  const admin = db.admins.find((a) => a.id === req.params.id);
  if (!admin) return res.status(404).json({ message: '账号不存在' });
  if (admin.role === 'super_admin') return res.status(403).json({ message: '不能删除超级管理员' });
  db.admins = db.admins.filter((a) => a.id !== req.params.id);
  saveDB();
  res.json({ success: true });
});

// ========== Projects API ==========

const PROJECT_FIELDS = ['name', 'description', 'status', 'currentPhase', 'location', 'manager', 'budget', 'startDate', 'endDate', 'developer', 'contractor', 'designUnit', 'supervisor', 'projectType', 'buildingArea', 'structureType', 'floorCount', 'memberIds'];

app.get('/api/projects', requireAuth, (_req, res) => {
  res.json(db.projects);
});

app.get('/api/projects/:id', requireAuth, (req, res) => {
  const p = db.projects.find((p) => p.id === req.params.id);
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
  db.projects.push(project);
  saveDB();
  res.status(201).json(project);
});

app.put('/api/projects/:id', requireAuth, (req, res) => {
  const idx = db.projects.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: '项目未找到' });
  db.projects[idx] = { ...db.projects[idx], ...pick(req.body, PROJECT_FIELDS), id: req.params.id, updatedAt: new Date().toISOString() };
  saveDB();
  res.json(db.projects[idx]);
});

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const idx = db.projects.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: '项目未找到' });
  db.projects.splice(idx, 1);
  const now = new Date().toISOString();
  for (const doc of db.documents) {
    if (doc.projectId === req.params.id) {
      doc.deleted = true;
      doc.deletedAt = now;
    }
  }
  saveDB();
  res.json({ success: true });
});

// ========== Documents API ==========

app.get('/api/documents', requireAuth, (req, res) => {
  const { projectId, phase } = req.query;
  let docs = db.documents.filter((d) => !d.deleted);
  if (projectId) docs = docs.filter((d) => d.projectId === projectId);
  if (phase) docs = docs.filter((d) => d.phase === phase);
  res.json(docs);
});

app.post('/api/documents', requireAuth, (req, res) => {
  const docId = crypto.randomUUID();
  let filePath = '';
  
  if (req.body.fileData) {
    const safeExt = mimeToExt(req.body.fileType) || '.bin';
    const fileName = `${docId}${safeExt}`;
    filePath = path.join(FILES_DIR, fileName);
    try {
      const buffer = Buffer.from(req.body.fileData, 'base64');
      fs.writeFileSync(filePath, buffer);
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
    fileData: '',
    fileType: String(req.body.fileType || 'application/octet-stream'),
    fileSize: Number(req.body.fileSize) || 0,
    filePath: filePath ? `files/${docId}${mimeToExt(req.body.fileType) || '.bin'}` : '',
    tags: Array.isArray(req.body.tags) ? req.body.tags : [],
    description: String(req.body.description || ''),
    deleted: false,
    uploadedAt: new Date().toISOString(),
  };
  db.documents.push(doc);
  saveDB();
  res.status(201).json({ ...doc, filePath: doc.filePath });
});

app.put('/api/documents/:id/soft-delete', requireAuth, (req, res) => {
  const doc = db.documents.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ message: '文档未找到' });
  doc.deleted = true;
  doc.deletedAt = new Date().toISOString();
  saveDB();
  res.json({ success: true });
});

app.put('/api/documents/:id/restore', requireAuth, (req, res) => {
  const doc = db.documents.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ message: '文档未找到' });
  doc.deleted = false;
  delete doc.deletedAt;
  saveDB();
  res.json({ success: true });
});

app.delete('/api/documents/:id', requireAuth, (req, res) => {
  const idx = db.documents.findIndex((d) => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: '文档未找到' });
  const doc = db.documents[idx];
  if (doc.filePath) {
    const fp = path.join(DATA_DIR, doc.filePath);
    try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) { /* ignore */ }
  }
  db.documents.splice(idx, 1);
  saveDB();
  res.json({ success: true });
});

app.get('/api/documents/deleted', requireAuth, (_req, res) => {
  res.json(db.documents.filter((d) => d.deleted));
});

app.post('/api/documents/empty-trash', requireAuth, (_req, res) => {
  const deletedDocs = db.documents.filter((d) => d.deleted);
  for (const doc of deletedDocs) {
    if (doc.filePath) {
      const fp = path.join(DATA_DIR, doc.filePath);
      try { if (fs.existsSync(fp)) fs.unlinkSync(fp); } catch (e) { /* ignore */ }
    }
  }
  db.documents = db.documents.filter((d) => !d.deleted);
  saveDB();
  res.json({ success: true });
});

// ========== File Download ==========

app.get('/api/files/download/:docId', requireAuth, (req, res) => {
  const doc = db.documents.find((d) => d.id === req.params.docId);
  if (!doc || !doc.filePath) return res.status(404).json({ message: '文件未找到' });
  const fp = path.join(DATA_DIR, doc.filePath);
  if (!fs.existsSync(fp)) return res.status(404).json({ message: '文件不存在' });
  res.download(fp, doc.name + path.extname(doc.filePath));
});

app.get('/api/files/view/:docId', requireAuth, (req, res) => {
  const doc = db.documents.find((d) => d.id === req.params.docId);
  if (!doc || !doc.filePath) return res.status(404).json({ message: '文件未找到' });
  const fp = path.join(DATA_DIR, doc.filePath);
  if (!fs.existsSync(fp)) return res.status(404).json({ message: '文件不存在' });
  res.contentType(doc.fileType || 'application/octet-stream');
  fs.createReadStream(fp).pipe(res);
});

app.get('/api/files/preview-docx/:docId', requireAuth, async (req, res) => {
  try {
    const doc = db.documents.find((d) => d.id === req.params.docId);
    if (!doc || !doc.filePath) return res.status(404).json({ message: '文件未找到' });
    const fp = path.join(DATA_DIR, doc.filePath);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: '文件不存在' });

    const mammoth = await import('mammoth');
    const result = await mammoth.default.convertToHtml({ path: fp });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif;font-size:14px;line-height:1.8;color:#1d1d1f;max-width:800px;margin:0 auto;padding:20px}h1,h2,h3{font-weight:700;margin-top:1.2em;margin-bottom:.5em}p{margin:.5em 0}table{border-collapse:collapse;width:100%;margin:12px 0}td,th{border:1px solid #ddd;padding:8px 12px;font-size:13px}img{max-width:100%}</style></head><body>${result.value}</body></html>`);
  } catch (e) {
    safeError(res, e, '文档转换失败');
  }
});

app.get('/api/documents/search', requireAuth, (req, res) => {
  const { keyword } = req.query;
  if (!keyword) return res.json([]);
  const lower = String(keyword).toLowerCase();
  res.json(db.documents.filter((d) =>
    !d.deleted &&
    (d.name.toLowerCase().includes(lower) ||
     d.description.toLowerCase().includes(lower) ||
     (d.tags || []).some((t) => t.toLowerCase().includes(lower)))
  ));
});

// ========== Tasks API ==========

const TASK_FIELDS = ['projectId', 'title', 'description', 'status', 'priority', 'assignee', 'dueDate'];

app.get('/api/tasks', requireAuth, (req, res) => {
  const { projectId } = req.query;
  let tasks = db.tasks;
  if (projectId) tasks = tasks.filter((t) => t.projectId === projectId || t.projectId === '');
  res.json(tasks);
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const task = {
    ...pick(req.body, TASK_FIELDS),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.tasks.push(task);
  saveDB();
  res.status(201).json(task);
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const idx = db.tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: '任务未找到' });
  db.tasks[idx] = { ...db.tasks[idx], ...pick(req.body, TASK_FIELDS), id: req.params.id, updatedAt: new Date().toISOString() };
  if (req.body.status === 'completed') {
    db.tasks[idx].completedAt = new Date().toISOString();
  }
  saveDB();
  res.json(db.tasks[idx]);
});

app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  const idx = db.tasks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: '任务未找到' });
  db.tasks.splice(idx, 1);
  saveDB();
  res.json({ success: true });
});

// ========== Stats ==========

app.get('/api/stats', requireAuth, (_req, res) => {
  const phaseDistribution = {};
  for (const p of db.projects) {
    phaseDistribution[p.currentPhase] = (phaseDistribution[p.currentPhase] || 0) + 1;
  }
  res.json({
    totalProjects: db.projects.length,
    activeProjects: db.projects.filter((p) => p.status === 'in_progress').length,
    totalDocuments: db.documents.filter((d) => !d.deleted).length,
    pendingTasks: db.tasks.filter((t) => t.status !== 'completed').length,
    phaseDistribution,
  });
});

// ========== Data Export ==========

app.get('/api/data/export', requireAuth, (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(db);
});

app.get('/api/data/summary', requireAuth, (_req, res) => {
  res.json({
    projects: db.projects.length,
    documents: db.documents.filter((d) => !d.deleted).length,
    deletedDocs: db.documents.filter((d) => d.deleted).length,
    tasks: db.tasks.length,
    pendingTasks: db.tasks.filter((t) => t.status !== 'completed').length,
    dbSize: JSON.stringify(db).length,
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
  res.json(db.members || []);
});

app.post('/api/members', requireAuth, (req, res) => {
  const member = {
    ...pick(req.body, MEMBER_FIELDS),
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  if (!db.members) db.members = [];
  db.members.push(member);
  saveDB();
  res.status(201).json(member);
});

app.put('/api/members/:id', requireAuth, (req, res) => {
  if (!db.members) db.members = [];
  const idx = db.members.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: '成员未找到' });
  db.members[idx] = { ...db.members[idx], ...pick(req.body, MEMBER_FIELDS), id: req.params.id };
  saveDB();
  res.json(db.members[idx]);
});

app.delete('/api/members/:id', requireAuth, (req, res) => {
  if (!db.members) db.members = [];
  const idx = db.members.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: '成员未找到' });
  db.members.splice(idx, 1);
  for (const p of db.projects) {
    if (p.memberIds) p.memberIds = p.memberIds.filter((mid) => mid !== req.params.id);
  }
  saveDB();
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
    const activeDocs = db.documents.filter((d) => !d.deleted);
    const docSummaries = activeDocs.map((d) => {
      const project = db.projects.find((p) => p.id === d.projectId);
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

// ========== OCR 文字识别 ==========

const SCRIPTS_DIR = path.join(__dirname, 'scripts');

function runPythonScript(scriptName, ...args) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const pyExe = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pyExe, [path.join(SCRIPTS_DIR, scriptName), ...args], {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(stderr || 'OCR 执行失败'));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error('OCR 结果解析失败'));
      }
    });
    proc.on('error', (err) => reject(err));
  });
}

// OCR 识别接口
app.post('/api/ocr/recognize', requireAuth, async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ message: '请提供文件路径' });

    const fullPath = path.join(FILES_DIR, path.basename(filePath));
    if (!fs.existsSync(fullPath)) return res.status(404).json({ message: '文件不存在' });

    const result = await runPythonScript('ocr.py', fullPath, '--lang', 'ch');
    res.json(result);
  } catch (e) {
    safeError(res, e, 'OCR 识别失败');
  }
});

// AI 信息提取接口
app.post('/api/ocr/extract', requireAuth, checkAIRate, async (req, res) => {
  try {
    const { text, prompt } = req.body;
    if (!text) return res.status(400).json({ message: '请提供待提取的文本' });

    const userPrompt = prompt || '请提取以下文本中的工程关键信息（项目名称、工程部位、材料规格、强度等级、施工日期等），以 JSON 格式返回，字段名用英文。';

    const messages = [
      { role: 'system', content: '你是一个专业的工程资料结构化提取助手。请严格按照用户要求的格式提取信息，只返回提取结果，不要添加额外说明。' },
      { role: 'user', content: `${userPrompt}\n\n待提取文本：\n${text.slice(0, 15000)}` },
    ];

    const aiRes = await callDeepSeek(messages);
    const data = await aiRes.json();
    const content = data.choices[0].message.content;

    // 尝试解析 JSON
    let extracted = null;
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        extracted = JSON.parse(jsonMatch[0]);
      } catch {
        extracted = { raw: content };
      }
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
      const f = files[i];
      filesInfo += `文件${i + 1}:\n名称:${f.name}\n类型:${f.fileType || '未知'}\n内容:${String(f.textContent || '').slice(0, 2000)}\n\n`;
    }
    const prompt = `你是工程文件归档专家。对以下文件分类并返回JSON数组:\n[{"index":1,"category":"contract","phase":"bidding","suggestedName":"标准化名","summary":"摘要"}]\n分类:drawing/contract/report/approval/plan/acceptance_doc/other\n阶段:initiation/design/bidding/construction/acceptance/operation\n\n${filesInfo}只返回JSON数组。`;
    const aiRes = await callDeepSeek([{ role: 'user', content: prompt }]);
    const data = await aiRes.json();
    const match = data.choices[0].message.content.match(/\[[\s\S]*\]/);
    const results = match ? JSON.parse(match[0]) : [];
    const classified = files.map((f, i) => {
      const r = results.find((r) => r.index === i + 1);
      return {
        name: f.name, size: f.size,
        category: r?.category || 'other', categoryLabel: categoriesCN[r?.category] || '其他',
        phase: r?.phase || 'construction', phaseLabel: phasesCN[r?.phase] || '施工阶段',
        suggestedName: r?.suggestedName || '', summary: r?.summary || '',
      };
    });
    res.json(classified);
  } catch (e) {
    console.error('AI classify error:', e.message);
    // Fallback: keyword matching
    const results = (req.body.files || []).map((f) => {
      const combined = (f.name + ' ' + (f.textContent || '')).toLowerCase();
      let cat = 'other', ph = 'construction';
      if (/图|设计图|施工图|cad|dwg/.test(combined)) { cat = 'drawing'; ph = 'design'; }
      else if (/合同|协议|招标|投标/.test(combined)) { cat = 'contract'; ph = 'bidding'; }
      else if (/报告|检测|评估|鉴定/.test(combined)) { cat = 'report'; ph = 'acceptance'; }
      else if (/审批|报审|申请/.test(combined)) { cat = 'approval'; ph = 'bidding'; }
      else if (/方案|施工组织|计划/.test(combined)) { cat = 'plan'; ph = 'construction'; }
      else if (/验收|竣工|交付/.test(combined)) { cat = 'acceptance_doc'; ph = 'acceptance'; }
      else if (/开工|规划|可研/.test(combined)) { cat = 'plan'; ph = 'initiation'; }
      return { name: f.name, size: f.size, category: cat, categoryLabel: '其他', phase: ph, phaseLabel: '施工阶段', suggestedName: '', summary: '' };
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
      if (file.fileData) {
        const safeExt = mimeToExt(file.fileType) || '.bin';
        filePath = path.join(FILES_DIR, `${docId}${safeExt}`);
        fs.writeFileSync(filePath, Buffer.from(file.fileData, 'base64'));
      }
      const doc = {
        id: docId, projectId: String(projectId),
        name: String(file.name || '未命名'),
        phase: file.phase || 'construction', category: file.category || 'other',
        fileData: '', fileType: String(file.fileType || 'application/octet-stream'),
        fileSize: Number(file.size) || 0,
        filePath: filePath ? `files/${docId}${mimeToExt(file.fileType) || '.bin'}` : '',
        tags: Array.isArray(file.tags) ? file.tags : [],
        description: String(file.description || ''),
        deleted: false, uploadedAt: new Date().toISOString(),
      };
      db.documents.push(doc);
      saved.push(doc);
    }
    saveDB();
    res.json({ success: true, count: saved.length, documents: saved.map((d) => ({ id: d.id, name: d.name, phase: d.phase, category: d.category })) });
  } catch (e) {
    safeError(res, e, '文件上传失败');
  }
});

// ========== Public ==========

app.get('/api/sync-time', (_req, res) => {
  try {
    const stat = fs.statSync(DB_FILE);
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
  console.log(`Data stored in: ${DB_FILE}`);
  console.log(`Backups: ${BACKUP_DIR}`);
});
