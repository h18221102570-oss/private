import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getAllDocuments, getAllProjects, softDeleteDocument, isAdmin } from '../store/db'
import { aiSearch } from '../services/ai'
import DocumentPreviewDialog from './DocumentPreviewDialog'
import { getCategoryIcon } from './FileIcon'
import {
  PHASE_LABELS, DOC_CATEGORY_LABELS,
  ProjectPhase, DocumentCategory,
} from '../types'
import type { Document as Doc, Project } from '../types'

export default function SearchView() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<Doc[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [searchMode, setSearchMode] = useState<'normal' | 'ai'>('normal')
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)

  useEffect(() => {
    getAllProjects().then(setProjects)
  }, [])

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setKeyword(q)
      doSearch(q)
    }
  }, [searchParams])

  async function doSearch(q: string) {
    if (!q.trim()) return
    setHasSearched(true)
    setSearchMode('normal')
    const docs = await getAllDocuments()
    const lower = q.toLowerCase()
    const filtered = docs.filter(
      (doc) =>
        doc.name.toLowerCase().includes(lower) ||
        doc.description.toLowerCase().includes(lower) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(lower))
    )
    setResults(filtered.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)))
  }

  async function handleSearch() {
    if (!keyword.trim()) return
    doSearch(keyword)
  }

  async function handleAISearch() {
    if (!keyword.trim()) return
    setHasSearched(true)
    setSearchMode('ai')
    setAiLoading(true)
    try {
      const aiResults = await aiSearch(keyword)
      setResults(aiResults.sort((a: Doc, b: Doc) => b.uploadedAt.localeCompare(a.uploadedAt)))
    } catch (e: any) {
      alert('AI 搜索失败：' + e.message)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!isAdmin()) { alert('只有管理员才能删除文档'); return }
    if (!confirm('确定将该文档移入回收站？')) return
    await softDeleteDocument(docId)
    setResults((prev) => prev.filter((d) => d.id !== docId))
  }

  function getProjectName(projectId: string): string {
    return projects.find((p) => p.id === projectId)?.name || projectId.slice(0, 8)
  }

  function formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <>
      <div className="page-header">
        <h2>全局搜索</h2>
      </div>
      <div className="page-content">
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body">
            <div className="search-bar" style={{ marginBottom: 0 }}>
              <div className="search-input-wrapper" style={{ flex: 1 }}>
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="搜索文档名称、标签、描述..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  autoFocus
                />
              </div>
              <button className="btn btn-primary" onClick={handleSearch} disabled={!keyword.trim()}>
                搜索
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleAISearch}
                disabled={!keyword.trim() || aiLoading}
                style={aiLoading ? { opacity: 0.6 } : {}}
              >
                🤖 {aiLoading ? '搜索中...' : 'AI 智能搜索'}
              </button>
            </div>
          </div>
        </div>

        {!hasSearched ? (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <h3>全局搜索</h3>
                <p>输入关键词，搜索所有项目中的文档资料</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-light)' }}>
              {searchMode === 'ai' && <span style={{ color: 'var(--primary)', fontWeight: 600 }}>🤖 AI 智能搜索 · </span>}
              找到 {results.length} 个结果
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {results.length === 0 ? (
                <div className="card">
                  <div className="card-body">
                    <div className="empty-state">
                      <div className="empty-state-icon">🔍</div>
                      <h3>未找到匹配的文档</h3>
                      <p>尝试使用其他关键词搜索</p>
                    </div>
                  </div>
                </div>
              ) : (
                results.map((doc) => (
                  <div key={doc.id} className="file-card">
                    <div className="file-icon">{getCategoryIcon(doc.category)}</div>
                    <div className="file-info">
                      <div className="file-name">{doc.name}</div>
                      <div className="file-meta">
                        <span>{getProjectName(doc.projectId)}</span>
                        <span>{PHASE_LABELS[doc.phase as ProjectPhase]}</span>
                        <span>{DOC_CATEGORY_LABELS[doc.category]}</span>
                        <span>{formatFileSize(doc.fileSize)}</span>
                        <span>{new Date(doc.uploadedAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                      {doc.tags.length > 0 && (
                        <div className="tags-list" style={{ marginTop: 4 }}>
                          {doc.tags.map((t, i) => (
                            <span key={i} className="tag">{t}</span>
                          ))}
                        </div>
                      )}
                      {doc.description && (
                        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-light)' }}>{doc.description}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setPreviewDoc(doc)}>预览</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${doc.projectId}`)}>查看项目</button>
                    {isAdmin() && (
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc.id)}>删除</button>
                    )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <DocumentPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  )
}
