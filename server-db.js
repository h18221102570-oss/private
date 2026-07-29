import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, copyFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, 'data');
const SQLITE_FILE = join(DATA_DIR, 'app.db');
const OLD_DB_FILE = join(DATA_DIR, 'database.json');
const BACKUP_DIR = join(DATA_DIR, 'backups');
const MAX_BACKUPS = 10;

let db = null;

// ========== 初始化 ==========

export async function initDB() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });

  const SQL = await initSqlJs();

  if (existsSync(SQLITE_FILE)) {
    const buffer = readFileSync(SQLITE_FILE);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, role TEXT DEFAULT 'admin', createdAt TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT DEFAULT '',
    status TEXT DEFAULT 'planning', currentPhase TEXT DEFAULT '',
    location TEXT DEFAULT '', manager TEXT DEFAULT '', budget REAL DEFAULT 0,
    startDate TEXT DEFAULT '', endDate TEXT DEFAULT '',
    developer TEXT DEFAULT '', contractor TEXT DEFAULT '',
    designUnit TEXT DEFAULT '', supervisor TEXT DEFAULT '',
    projectType TEXT DEFAULT '', buildingArea TEXT DEFAULT '',
    structureType TEXT DEFAULT '', floorCount TEXT DEFAULT '',
    memberIds TEXT DEFAULT '[]', createdAt TEXT, updatedAt TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, projectId TEXT DEFAULT '',
    phase TEXT DEFAULT 'construction', name TEXT NOT NULL,
    category TEXT DEFAULT 'other', fileType TEXT DEFAULT 'application/octet-stream',
    fileSize INTEGER DEFAULT 0, filePath TEXT DEFAULT '', fileData BLOB,
    tags TEXT DEFAULT '[]', description TEXT DEFAULT '',
    deleted INTEGER DEFAULT 0, uploadedAt TEXT, deletedAt TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, projectId TEXT DEFAULT '', title TEXT NOT NULL,
    description TEXT DEFAULT '', status TEXT DEFAULT 'pending',
    priority TEXT DEFAULT 'medium', assignee TEXT DEFAULT '',
    dueDate TEXT DEFAULT '', completedAt TEXT, createdAt TEXT, updatedAt TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT DEFAULT '',
    phone TEXT DEFAULT '', email TEXT DEFAULT '', department TEXT DEFAULT '',
    notes TEXT DEFAULT '', createdAt TEXT
  )`);

  db.run('CREATE INDEX IF NOT EXISTS idx_documents_projectId ON documents(projectId)');
  db.run('CREATE INDEX IF NOT EXISTS idx_documents_deleted ON documents(deleted)');
  db.run('CREATE INDEX IF NOT EXISTS idx_tasks_projectId ON tasks(projectId)');

  migrateFromJSON();

  const adminCount = db.exec('SELECT COUNT(*) as c FROM admins')[0].values[0][0];
  if (adminCount === 0) {
    const { randomUUID, createHash } = await import('crypto');
    const hash = createHash('sha256').update('123456789').digest('hex');
    db.run('INSERT INTO admins (id, username, password, role, createdAt) VALUES (?,?,?,?,?)',
      [randomUUID(), '黄康杰', hash, 'super_admin', new Date().toISOString()]);
  }

  saveDB();
  console.log('SQLite 数据库已就绪');
}

export function saveDB() {
  try {
    const data = db.export();
    writeFileSync(SQLITE_FILE, Buffer.from(data));
    autoBackup();
  } catch (e) {
    console.error('Failed to save database:', e.message);
  }
}

function autoBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = join(BACKUP_DIR, `backup-${timestamp}.db`);
    copyFileSync(SQLITE_FILE, backupFile);
    const backups = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.db'))
      .sort().reverse();
    for (let i = MAX_BACKUPS; i < backups.length; i++) {
      unlinkSync(join(BACKUP_DIR, backups[i]));
    }
  } catch (e) { /* ignore */ }
}

function migrateFromJSON() {
  if (!existsSync(OLD_DB_FILE)) return;
  try {
    const jsonData = JSON.parse(readFileSync(OLD_DB_FILE, 'utf-8'));

    const existingAdmins = new Set(
      db.exec('SELECT id FROM admins')[0]?.values.map((r) => r[0]) || []
    );
    if (jsonData.admins) {
      for (const a of jsonData.admins) {
        if (existingAdmins.has(a.id)) continue;
        db.run('INSERT OR IGNORE INTO admins (id,username,password,role,createdAt) VALUES (?,?,?,?,?)',
          [a.id, a.username, a.password, a.role || 'admin', a.createdAt || '']);
      }
    }

    const existingProjects = new Set(
      db.exec('SELECT id FROM projects')[0]?.values.map((r) => r[0]) || []
    );
    if (jsonData.projects) {
      for (const p of jsonData.projects) {
        if (existingProjects.has(p.id)) continue;
        db.run(`INSERT OR IGNORE INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [p.id, p.name, p.description || '', p.status || '', p.currentPhase || '',
           p.location || '', p.manager || '', p.budget || 0, p.startDate || '',
           p.endDate || '', p.developer || '', p.contractor || '',
           p.designUnit || '', p.supervisor || '', p.projectType || '',
           p.buildingArea || '', p.structureType || '', p.floorCount || '',
           JSON.stringify(p.memberIds || []), p.createdAt || '', p.updatedAt || '']);
      }
    }

    const existingDocs = new Set(
      db.exec('SELECT id FROM documents')[0]?.values.map((r) => r[0]) || []
    );
    if (jsonData.documents) {
      for (const d of jsonData.documents) {
        if (existingDocs.has(d.id)) continue;
        db.run(`INSERT OR IGNORE INTO documents (id,projectId,phase,name,category,fileType,fileSize,filePath,tags,description,deleted,uploadedAt,deletedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [d.id, d.projectId || '', d.phase || 'construction', d.name, d.category || 'other',
           d.fileType || '', d.fileSize || 0, d.filePath || '',
           JSON.stringify(d.tags || []), d.description || '', d.deleted ? 1 : 0,
           d.uploadedAt || '', d.deletedAt || null]);
      }
    }

    const existingTasks = new Set(
      db.exec('SELECT id FROM tasks')[0]?.values.map((r) => r[0]) || []
    );
    if (jsonData.tasks) {
      for (const t of jsonData.tasks) {
        if (existingTasks.has(t.id)) continue;
        db.run(`INSERT OR IGNORE INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [t.id, t.projectId || '', t.title, t.description || '',
           t.status || 'pending', t.priority || 'medium', t.assignee || '',
           t.dueDate || '', t.completedAt || null, t.createdAt || '', t.updatedAt || '']);
      }
    }

    const existingMembers = new Set(
      db.exec('SELECT id FROM members')[0]?.values.map((r) => r[0]) || []
    );
    if (jsonData.members) {
      for (const m of jsonData.members) {
        if (existingMembers.has(m.id)) continue;
        db.run('INSERT OR IGNORE INTO members VALUES (?,?,?,?,?,?,?,?)',
          [m.id, m.name, m.role || '', m.phone || '', m.email || '',
           m.department || '', m.notes || '', m.createdAt || '']);
      }
    }

    saveDB();
    console.log('已从 JSON 数据库迁移数据');
  } catch (e) {
    console.error('数据迁移失败:', e.message);
  }
}

// ========== 查询辅助 ==========

function rowToObj(row, columns) {
  const obj = {};
  for (let i = 0; i < columns.length; i++) {
    obj[columns[i]] = row[i];
  }
  if (obj.tags && typeof obj.tags === 'string') {
    try { obj.tags = JSON.parse(obj.tags); } catch { obj.tags = []; }
  }
  if (obj.memberIds && typeof obj.memberIds === 'string') {
    try { obj.memberIds = JSON.parse(obj.memberIds); } catch { obj.memberIds = []; }
  }
  if ('deleted' in obj) obj.deleted = !!obj.deleted;
  if (obj.fileData instanceof Uint8Array) {
    obj.fileData = Buffer.from(obj.fileData).toString('base64');
  }
  return obj;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  const columns = stmt.getColumnNames();
  while (stmt.step()) {
    results.push(rowToObj(stmt.get(), columns));
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
}

// ========== Admins ==========

export function getAdmins() {
  return queryAll('SELECT id, username, role, createdAt FROM admins');
}
export function getAdminById(id) {
  return queryOne('SELECT * FROM admins WHERE id = ?', [id]);
}
export function getAdminByUsername(username) {
  return queryOne('SELECT * FROM admins WHERE username = ?', [username]);
}
export function createAdmin(id, username, password, role) {
  run('INSERT INTO admins (id, username, password, role, createdAt) VALUES (?,?,?,?,?)',
    [id, username, password, role, new Date().toISOString()]);
  saveDB();
}
export function updateAdminPassword(id, newPassword) {
  run('UPDATE admins SET password = ? WHERE id = ?', [newPassword, id]);
  saveDB();
}
export function deleteAdmin(id) {
  run('DELETE FROM admins WHERE id = ?', [id]);
  saveDB();
}

// ========== Projects ==========

export function getProjects() {
  return queryAll('SELECT * FROM projects ORDER BY createdAt DESC');
}
export function getProjectById(id) {
  return queryOne('SELECT * FROM projects WHERE id = ?', [id]);
}
export function createProject(project) {
  run(`INSERT INTO projects VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [project.id, project.name, project.description || '', project.status || 'planning',
     project.currentPhase || '', project.location || '', project.manager || '',
     project.budget || 0, project.startDate || '', project.endDate || '',
     project.developer || '', project.contractor || '', project.designUnit || '',
     project.supervisor || '', project.projectType || '', project.buildingArea || '',
     project.structureType || '', project.floorCount || '',
     JSON.stringify(project.memberIds || []),
     project.createdAt || new Date().toISOString(),
     project.updatedAt || new Date().toISOString()]);
  saveDB();
}
export function updateProject(id, data) {
  const clauses = [];
  const params = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'memberIds') {
      clauses.push('memberIds = ?');
      params.push(JSON.stringify(value || []));
    } else {
      clauses.push(`${key} = ?`);
      params.push(value);
    }
  }
  if (clauses.length === 0) return;
  clauses.push('updatedAt = ?');
  params.push(new Date().toISOString());
  params.push(id);
  run(`UPDATE projects SET ${clauses.join(', ')} WHERE id = ?`, params);
  saveDB();
}
export function deleteProject(id) {
  run('DELETE FROM projects WHERE id = ?', [id]);
  run('UPDATE documents SET deleted = 1, deletedAt = ? WHERE projectId = ?',
    [new Date().toISOString(), id]);
  saveDB();
}

// ========== Documents ==========

export function getDocuments(filter = {}) {
  let sql = 'SELECT * FROM documents WHERE deleted = 0';
  const params = [];
  if (filter.projectId) { sql += ' AND projectId = ?'; params.push(filter.projectId); }
  if (filter.phase) { sql += ' AND phase = ?'; params.push(filter.phase); }
  sql += ' ORDER BY uploadedAt DESC';
  return queryAll(sql, params).map((d) => { const { fileData, ...rest } = d; return rest; });
}
export function getDocumentById(id) {
  const doc = queryOne('SELECT * FROM documents WHERE id = ?', [id]);
  if (!doc) return null;
  const { fileData, ...rest } = doc;
  return rest;
}
export function getDocumentWithFileData(id) {
  return queryOne('SELECT * FROM documents WHERE id = ?', [id]);
}
export function createDocument(doc) {
  run(`INSERT INTO documents (id,projectId,phase,name,category,fileType,fileSize,filePath,fileData,tags,description,deleted,uploadedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [doc.id, doc.projectId || '', doc.phase || 'construction', doc.name,
     doc.category || 'other', doc.fileType || '', doc.fileSize || 0,
     doc.filePath || '', doc.fileData || null,
     JSON.stringify(doc.tags || []), doc.description || '',
     doc.deleted ? 1 : 0, doc.uploadedAt || new Date().toISOString()]);
  saveDB();
}
export function softDeleteDocument(id) {
  run('UPDATE documents SET deleted = 1, deletedAt = ? WHERE id = ?',
    [new Date().toISOString(), id]);
  saveDB();
}
export function restoreDocument(id) {
  run('UPDATE documents SET deleted = 0, deletedAt = NULL WHERE id = ?', [id]);
  saveDB();
}
export function permanentDeleteDocument(id) {
  run('DELETE FROM documents WHERE id = ?', [id]);
  saveDB();
}
export function getDeletedDocuments() {
  return queryAll('SELECT * FROM documents WHERE deleted = 1 ORDER BY deletedAt DESC');
}
export function emptyTrash() {
  run('DELETE FROM documents WHERE deleted = 1');
  saveDB();
}
export function searchDocuments(keyword) {
  const k = `%${keyword}%`;
  return queryAll(
    'SELECT * FROM documents WHERE deleted = 0 AND (name LIKE ? OR description LIKE ?) ORDER BY uploadedAt DESC',
    [k, k]
  );
}
export function getDocumentsByProject(projectId) {
  return getDocuments({ projectId });
}
export function getDocumentsByPhase(phase) {
  return getDocuments({ phase });
}

// ========== Tasks ==========

export function getTasks(projectId) {
  if (projectId) {
    return queryAll("SELECT * FROM tasks WHERE (projectId = ? OR projectId = '') ORDER BY createdAt DESC", [projectId]);
  }
  return queryAll('SELECT * FROM tasks ORDER BY createdAt DESC');
}
export function getTaskById(id) {
  return queryOne('SELECT * FROM tasks WHERE id = ?', [id]);
}
export function createTask(task) {
  run(`INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [task.id, task.projectId || '', task.title, task.description || '',
     task.status || 'pending', task.priority || 'medium', task.assignee || '',
     task.dueDate || '', task.completedAt || null,
     task.createdAt || new Date().toISOString(),
     task.updatedAt || new Date().toISOString()]);
  saveDB();
}
export function updateTask(id, data) {
  const clauses = [];
  const params = [];
  for (const [key, value] of Object.entries(data)) {
    clauses.push(`${key} = ?`);
    params.push(value);
  }
  if (clauses.length === 0) return;
  const now = new Date().toISOString();
  clauses.push('updatedAt = ?');
  params.push(now);
  if (data.status === 'completed' && !data.completedAt) {
    clauses.push('completedAt = ?');
    params.push(now);
  }
  params.push(id);
  run(`UPDATE tasks SET ${clauses.join(', ')} WHERE id = ?`, params);
  saveDB();
}
export function deleteTask(id) {
  run('DELETE FROM tasks WHERE id = ?', [id]);
  saveDB();
}

// ========== Members ==========

export function getMembers() {
  return queryAll('SELECT * FROM members ORDER BY createdAt DESC');
}
export function getMemberById(id) {
  return queryOne('SELECT * FROM members WHERE id = ?', [id]);
}
export function createMember(member) {
  run('INSERT INTO members VALUES (?,?,?,?,?,?,?,?)',
    [member.id, member.name, member.role || '', member.phone || '',
     member.email || '', member.department || '', member.notes || '',
     member.createdAt || new Date().toISOString()]);
  saveDB();
}
export function updateMember(id, data) {
  const clauses = [];
  const params = [];
  for (const [key, value] of Object.entries(data)) {
    clauses.push(`${key} = ?`);
    params.push(value);
  }
  if (clauses.length === 0) return;
  params.push(id);
  run(`UPDATE members SET ${clauses.join(', ')} WHERE id = ?`, params);
  saveDB();
}
export function deleteMember(id) {
  run('DELETE FROM members WHERE id = ?', [id]);
  const projects = getProjects();
  for (const p of projects) {
    if (p.memberIds && p.memberIds.includes(id)) {
      run('UPDATE projects SET memberIds = ? WHERE id = ?',
        [JSON.stringify(p.memberIds.filter((mid) => mid !== id)), p.id]);
    }
  }
  saveDB();
}

// ========== 仪表盘 ==========

export function getDashboardStats() {
  const projects = getProjects();
  const documents = getDocuments();
  const tasks = getTasks();
  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((p) => p.status === 'active').length,
    totalDocuments: documents.length,
    pendingTasks: tasks.filter((t) => t.status !== 'completed').length,
    completedTasks: tasks.filter((t) => t.status === 'completed').length,
    recentDocs: documents.slice(0, 5),
  };
}
