import type { Project, Document, Task, Member, AdminInfo } from '../types';
import { UserRole } from '../types';

const API = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${url}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: '请求失败' }));
    throw new Error(err.message || '请求失败');
  }
  return res.json();
}

// ========== Authentication ==========

const SESSION_KEY = 'engineering_session';

interface AdminSession {
  username: string;
  role: UserRole;
  adminId: string;
  token: string;
  loginAt: string;
}

export function getSession(): AdminSession | null {
  const stored = localStorage.getItem(SESSION_KEY);
  if (!stored) return null;
  try { return JSON.parse(stored); } catch { return null; }
}

export function getToken(): string {
  return getSession()?.token || '';
}

export function getCurrentRole(): UserRole {
  return getSession()?.role || UserRole.USER;
}

export function isAdmin(): boolean {
  const role = getCurrentRole();
  return role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN;
}

export function isSuperAdmin(): boolean {
  return getCurrentRole() === UserRole.SUPER_ADMIN;
}

export function getAdminId(): string {
  return getSession()?.adminId || '';
}

export async function adminLogin(username: string, password: string): Promise<boolean> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (res.ok) {
    const data = await res.json();
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      username: data.username,
      role: data.role,
      adminId: data.adminId,
      token: data.token,
      loginAt: new Date().toISOString(),
    }));
    return true;
  }
  return false;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API}/auth/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    });
  } catch { /* ignore */ }
  localStorage.removeItem(SESSION_KEY);
}

export async function updateCredentials(newPassword: string, oldPassword: string): Promise<boolean> {
  const res = await fetch(`${API}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPassword, newPassword, adminId: getAdminId() }),
  });
  return res.ok;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const session = getSession();
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: session?.username || '黄康杰', password }),
  });
  return res.ok;
}

// ========== Admin Management ==========

export async function getAllAdmins(): Promise<AdminInfo[]> {
  return request<AdminInfo[]>('/admins');
}

export async function addAdmin(username: string, password: string): Promise<AdminInfo> {
  return request<AdminInfo>('/admins', { method: 'POST', body: JSON.stringify({ username, password }) });
}

export async function deleteAdmin(id: string): Promise<void> {
  await request(`/admins/${id}`, { method: 'DELETE' });
}

export async function resetAdminPassword(adminId: string, newPassword: string): Promise<void> {
  await request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ adminId, newPassword }) });
}

// ========== Project CRUD ==========

export async function getAllProjects(): Promise<Project[]> {
  return request<Project[]>('/projects');
}

export async function getProject(id: string): Promise<Project | undefined> {
  return request<Project>(`/projects/${id}`);
}

export async function addProject(project: Project): Promise<void> {
  await request('/projects', { method: 'POST', body: JSON.stringify(project) });
}

export async function updateProject(project: Project): Promise<void> {
  await request(`/projects/${project.id}`, { method: 'PUT', body: JSON.stringify(project) });
}

export async function deleteProject(id: string): Promise<void> {
  await request(`/projects/${id}`, { method: 'DELETE' });
}

// ========== Document CRUD ==========

export async function getAllDocuments(): Promise<Document[]> {
  return request<Document[]>('/documents');
}

export async function getDocumentsByProject(projectId: string): Promise<Document[]> {
  return request<Document[]>(`/documents?projectId=${encodeURIComponent(projectId)}`);
}

export async function getDocumentsByPhase(phase: string): Promise<Document[]> {
  return request<Document[]>(`/documents?phase=${encodeURIComponent(phase)}`);
}

export async function addDocument(doc: Document): Promise<void> {
  await request('/documents', { method: 'POST', body: JSON.stringify(doc) });
}

export async function softDeleteDocument(id: string): Promise<void> {
  await request(`/documents/${id}/soft-delete`, { method: 'PUT' });
}

export async function restoreDocument(id: string): Promise<void> {
  await request(`/documents/${id}/restore`, { method: 'PUT' });
}

export async function permanentDeleteDocument(id: string): Promise<void> {
  await request(`/documents/${id}`, { method: 'DELETE' });
}

export async function getDeletedDocuments(): Promise<Document[]> {
  return request<Document[]>('/documents/deleted');
}

export async function emptyTrash(): Promise<void> {
  await request('/documents/empty-trash', { method: 'POST' });
}

export async function searchDocuments(keyword: string): Promise<Document[]> {
  return request<Document[]>(`/documents/search?keyword=${encodeURIComponent(keyword)}`);
}

// ========== Stats ==========

export async function getDashboardStats(): Promise<{
  totalProjects: number;
  activeProjects: number;
  totalDocuments: number;
  pendingTasks: number;
  phaseDistribution: Record<string, number>;
}> {
  return request('/stats');
}

// ========== Task CRUD ==========

export async function getAllTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  return request<Task[]>(`/tasks?projectId=${encodeURIComponent(projectId)}`);
}

export async function addTask(task: Task): Promise<void> {
  await request('/tasks', { method: 'POST', body: JSON.stringify(task) });
}

export async function updateTask(task: Task): Promise<void> {
  await request(`/tasks/${task.id}`, { method: 'PUT', body: JSON.stringify(task) });
}

export async function deleteTask(id: string): Promise<void> {
  await request(`/tasks/${id}`, { method: 'DELETE' });
}

export async function getPendingTaskCount(): Promise<number> {
  const tasks = await request<Task[]>('/tasks');
  return tasks.filter((t) => t.status !== 'completed').length;
}

// ========== Members API ==========

export async function getAllMembers(): Promise<Member[]> {
  return request<Member[]>('/members');
}

export async function addMember(member: Member): Promise<Member> {
  return request<Member>('/members', { method: 'POST', body: JSON.stringify(member) });
}

export async function updateMember(member: Member): Promise<Member> {
  return request<Member>(`/members/${member.id}`, { method: 'PUT', body: JSON.stringify(member) });
}

export async function deleteMember(id: string): Promise<void> {
  await request(`/members/${id}`, { method: 'DELETE' });
}
