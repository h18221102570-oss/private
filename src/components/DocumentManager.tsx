import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllDocuments, softDeleteDocument, isAdmin } from '../store/db'
import { aiAnalyzeDoc } from '../services/ai'
import DocumentPreviewDialog from './DocumentPreviewDialog'
import { getCategoryIcon } from './FileIcon'
import {
  PHASE_LABELS, DOC_CATEGORY_LABELS,
  ProjectPhase, DocumentCategory,
} from '../types'
import type { Document as Doc } from '../types'

export default function DocumentManager() {
  const navigate = useNavigate()
  const [documents, setDocuments] = useState<Doc[]>([])
  const [filterPhase, setFilterPhase] = useState<string>('')
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [search, setSearch] = useState('')
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<{ summary: string; keywords: string[]; phase: string; type: string } | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    const docs = await getAllDocuments()
    setDocuments(docs.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)))
  }

  async function handleDelete(docId: string) {
    if (!isAdmin()) { alert('只有管理员才能删除文档'); return }
    if (!confirm('确定将该文档移入回收站？')) return
    try {
      await softDeleteDocument(docId)
      setDocuments((prev) => prev.filter((d) => d.id !== docId))
    } catch (e: any) {
      alert('删除失败：' + e.message)
    }
  }

  async function handleAnalyze(doc: Doc) {
    setAnalyzing(doc.id)
    try {
      const content = doc.description || doc.name
      const result = await aiAnalyzeDoc(doc.name, content, DOC_CATEGORY_LABELS[doc.category])
      setAnalysisResult(result)
      setShowAnalysis(true)
    } catch (e: any) {
      alert('AI 分析失败：' + e.message)
    } finally {
      setAnalyzing(null)
    }
  }

  function formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const filtered = documents.filter((d) => {
    if (filterPhase && d.phase !== filterPhase) return false
    if (filterCategory && d.category !== filterCategory) return false
    if (search) {
      const lower = search.toLowerCase()
      return (
        d.name.toLowerCase().includes(lower) ||
        d.description.toLowerCase().includes(lower) ||
        d.tags.some((t) => t.toLowerCase().includes(lower))
      )
    }
    return true
  })

  return (
    <>
      <div className="page-header">
        <h2>文档中心</h2>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/sheet-editor')}>📊 新建表格</button>
          <button className="btn btn-secondary" onClick={() => navigate('/doc-editor')}>📝 新建文档</button>
          <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ 打印</button>
          <button className="btn btn-primary" onClick={() => {
            if (documents.length > 0) {
              navigate(`/projects/${documents[0].projectId}`)
            } else {
              navigate('/projects')
            }
          }}>
            + 上传文档
          </button>
        </div>
      </div>
      <div className="page-content">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="搜索文档名称、标签、描述..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="search-filter" value={filterPhase} onChange={(e) => setFilterPhase(e.target.value)}>
            <option value="">全部阶段</option>
            {Object.entries(PHASE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select className="search-filter" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">全部分类</option>
            {Object.entries(DOC_CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-light)' }}>
          共 {filtered.length} 个文档
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <div className="empty-state">
                  <div className="empty-state-icon">📄</div>
                  <h3>{search || filterPhase || filterCategory ? '没有匹配的文档' : '暂无文档'}</h3>
                  <p>{search || filterPhase || filterCategory ? '尝试修改筛选条件' : '进入项目详情页上传文档'}</p>
                </div>
              </div>
            </div>
          ) : (
            filtered.map((doc) => (
              <div key={doc.id} className="file-card">
                <div className="file-icon">{getCategoryIcon(doc.category)}</div>
                <div className="file-info">
                  <div className="file-name">{doc.name}</div>
                  <div className="file-meta">
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
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setPreviewDoc(doc)}>预览</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { const a = document.createElement('a'); a.href = `/api/files/download/${doc.id}`; a.click(); }}>下载</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/projects/${doc.projectId}`)}>查看项目</button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleAnalyze(doc)}
                    disabled={analyzing === doc.id}
                  >
                    🤖 {analyzing === doc.id ? '分析中...' : 'AI 分析'}
                  </button>
                  {isAdmin() && (
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(doc.id)}>删除</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showAnalysis && analysisResult && (
        <div className="modal-overlay" onClick={() => setShowAnalysis(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>🤖 AI 文档分析</h3>
              <button className="btn-icon" onClick={() => setShowAnalysis(false)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>摘要</label>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>{analysisResult.summary}</div>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>关键词</label>
                <div className="tags-list">
                  {analysisResult.keywords.map((kw, i) => (
                    <span key={i} className="tag" style={{ background: 'rgba(0,122,255,0.08)', color: 'var(--primary)' }}>{kw}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>建议阶段</label>
                  <span className="badge badge-blue">{analysisResult.phase}</span>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>建议分类</label>
                  <span className="badge badge-green">{analysisResult.type}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAnalysis(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      <DocumentPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  )
}
