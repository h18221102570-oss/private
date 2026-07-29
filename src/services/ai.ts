import { getToken } from '../store/db';

const API = '/api';

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + getToken(),
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function getAIConfig(): Promise<{ hasKey: boolean; keyPreview: string }> {
  const res = await fetch(`${API}/ai/config`, { headers: authHeaders() });
  return res.json();
}

export async function setAIConfig(apiKey: string): Promise<void> {
  await fetch(`${API}/ai/config`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ apiKey }),
  });
}

export async function aiChat(messages: ChatMessage[], projectContext?: string): Promise<string> {
  const res = await fetch(`${API}/ai/chat`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ messages, projectContext }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'AI 请求失败' }));
    throw new Error(err.error || 'AI 请求失败');
  }
  const data = await res.json();
  return data.content;
}

export async function aiSearch(keyword: string): Promise<any[]> {
  const res = await fetch(`${API}/ai/search?q=${encodeURIComponent(keyword)}`, { headers: authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '搜索失败' }));
    throw new Error(err.error || '搜索失败');
  }
  return res.json();
}

export async function aiAnalyzeDoc(docName: string, docContent: string, docType: string): Promise<{
  summary: string;
  keywords: string[];
  phase: string;
  type: string;
}> {
  const res = await fetch(`${API}/ai/analyze-doc`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ docName, docContent, docType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '分析失败' }));
    throw new Error(err.error || '分析失败');
  }
  return res.json();
}

// ========== 智能文件收纳 ==========

export interface FileClassification {
  name: string;
  size: number;
  category: string;
  categoryLabel: string;
  phase: string;
  phaseLabel: string;
  suggestedName: string;
  summary: string;
}

export async function classifyFiles(files: {
  name: string;
  size: number;
  textContent: string;
  fileType: string;
}[]): Promise<FileClassification[]> {
  const res = await fetch(`${API}/files/classify`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ files }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '分类失败' }));
    throw new Error(err.error || '分类失败');
  }
  return res.json();
}

export async function batchUploadFiles(projectId: string, files: {
  name: string;
  size: number;
  fileData: string;
  fileType: string;
  category: string;
  phase: string;
}[]): Promise<{ success: boolean; count: number; documents: any[] }> {
  const res = await fetch(`${API}/files/batch-upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ projectId, files }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '入库失败' }));
    throw new Error(err.error || '入库失败');
  }
  return res.json();
}
