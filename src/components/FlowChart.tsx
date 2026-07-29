import { useState, useEffect } from 'react'
import {
  getAllProjects, getDocumentsByProject, addDocument, softDeleteDocument, isAdmin,
} from '../store/db'
import DocumentPreviewDialog from './DocumentPreviewDialog'
import { getCategoryIcon } from './FileIcon'
import {
  PHASE_LABELS, PHASE_ORDER, DOC_CATEGORY_LABELS,
  ProjectPhase, DocumentCategory,
} from '../types'
import type { Project, Document as Doc } from '../types'

const phaseIcons: Record<string, string> = {
  initiation: '🚀',
  design: '🎨',
  construction: '🏗️',
  acceptance: '✅',
  operation: '🔧',
}

const phaseColors: Record<string, string> = {
  initiation: '#7c3aed',
  design: '#2563eb',
  construction: '#059669',
  acceptance: '#ea580c',
  operation: '#64748b',
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function FlowChart() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [project, setProject] = useState<Project | null>(null)
  const [phaseDocs, setPhaseDocs] = useState<Record<string, Doc[]>>({})
  const [showUpload, setShowUpload] = useState(false)
  const [uploadPhase, setUploadPhase] = useState<ProjectPhase | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)
  const [newDoc, setNewDoc] = useState({
    name: '', category: DocumentCategory.OTHER, tags: '', description: '',
    fileData: '', fileType: '',
  })

  useEffect(() => {
    getAllProjects().then((list) => {
      setProjects(list)
      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(list[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!selectedProjectId) return
    const p = projects.find((p) => p.id === selectedProjectId)
    setProject(p || null)
    loadDocs(selectedProjectId)
  }, [selectedProjectId, projects])

  async function loadDocs(projectId: string) {
    const docs = await getDocumentsByProject(projectId)
    const map: Record<string, Doc[]> = {}
    for (const phase of PHASE_ORDER) {
      map[phase] = docs.filter((d) => d.phase === phase)
    }
    setPhaseDocs(map)
  }

  function openUpload(phase: ProjectPhase) {
    setUploadPhase(phase)
    setNewDoc({ name: '', category: DocumentCategory.OTHER, tags: '', description: '', fileData: '', fileType: '' })
    setShowUpload(true)
  }

  async function handleUpload() {
    if (!newDoc.name.trim() || !selectedProjectId || !uploadPhase) return

    let fileData = ''
    let fileType = ''
    let fileSize = 0
    if (newDoc.fileData) {
      fileData = newDoc.fileData
      fileType = newDoc.fileType
      fileSize = Math.round(newDoc.fileData.length * 0.75)
    }

    const doc: Doc = {
      id: crypto.randomUUID(),
      projectId: selectedProjectId,
      phase: uploadPhase,
      name: newDoc.name,
      category: newDoc.category,
      fileData,
      fileType,
      fileSize,
      tags: newDoc.tags.split(',').map((t) => t.trim()).filter(Boolean),
      description: newDoc.description,
      uploadedAt: new Date().toISOString(),
      deleted: false,
    }

    await addDocument(doc)
    setShowUpload(false)
    await loadDocs(selectedProjectId)
  }

  async function handleDeleteDoc(docId: string) {
    if (!isAdmin()) { alert('只有管理员才能删除文档'); return }
    if (!confirm('确定将该文档移入回收站？')) return
    await softDeleteDocument(docId)
    if (selectedProjectId) await loadDocs(selectedProjectId)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('文件大小不能超过 10MB'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setNewDoc((prev) => ({
        ...prev,
        name: prev.name || file.name,
        fileData: result.split(',')[1] || result,
        fileType: file.type,
      }))
    }
    reader.readAsDataURL(file)
  }

  const currentPhaseIndex = project ? PHASE_ORDER.indexOf(project.currentPhase as ProjectPhase) : -1

  return (
    <>
      <div className="page-header">
        <h2>全周期流程图</h2>
        <div className="page-header-actions">
          <select
            className="search-filter"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.length === 0 && <option value="">暂无项目</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="page-content">
        {!selectedProjectId || !project ? (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                <div className="empty-state-icon">📁</div>
                <h3>请先选择一个项目</h3>
                <p>从右上角下拉菜单中选择一个项目查看其全周期流程</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Flow Chart */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <h3>{project.name} — 全生命周期流程</h3>
              </div>
              <div className="card-body" style={{ padding: '32px 24px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  justifyContent: 'center',
                  flexWrap: 'wrap',
                  gap: 0,
                  position: 'relative',
                }}>
                  {PHASE_ORDER.map((phase, i) => {
                    const isActive = i === currentPhaseIndex
                    const isCompleted = i < currentPhaseIndex
                    const color = phaseColors[phase]
                    const docs = phaseDocs[phase] || []
                    const totalDocs = docs.length

                    return (
                      <div key={phase} style={{
                        display: 'flex',
                        alignItems: 'center',
                        position: 'relative',
                      }}>
                        {/* Connector Line */}
                        {i > 0 && (
                          <div style={{
                            width: 40, height: 3,
                            background: isCompleted ? color : 'rgba(0,0,0,0.1)',
                            borderRadius: 2,
                            flexShrink: 0,
                            margin: '0 4px',
                            alignSelf: 'center',
                          }} />
                        )}

                        {/* Phase Node */}
                        <div
                          onClick={() => openUpload(phase)}
                          style={{
                            width: 150,
                            padding: '20px 12px',
                            borderRadius: 16,
                            background: isActive
                              ? `linear-gradient(135deg, ${color}15, ${color}08)`
                              : isCompleted
                                ? `linear-gradient(135deg, ${color}08, ${color}04)`
                                : '#fafafa',
                            border: isActive
                              ? `2px solid ${color}`
                              : isCompleted
                                ? `1.5px solid ${color}60`
                                : '1px solid rgba(0,0,0,0.08)',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1)',
                            position: 'relative',
                            flexShrink: 0,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-4px)'
                            e.currentTarget.style.boxShadow = `0 8px 24px ${color}20`
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          {/* Status indicator */}
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: isActive ? color : isCompleted ? color : 'rgba(0,0,0,0.15)',
                            margin: '0 auto 10px',
                            boxShadow: isActive ? `0 0 0 4px ${color}20` : 'none',
                          }} />

                          <div style={{ fontSize: 28, marginBottom: 8 }}>
                            {isCompleted ? '✓' : phaseIcons[phase]}
                          </div>
                          <div style={{
                            fontSize: 13, fontWeight: 700,
                            color: isActive ? color : isCompleted ? color : 'var(--text-secondary)',
                            marginBottom: 4,
                            letterSpacing: '-0.01em',
                          }}>
                            {PHASE_LABELS[phase]}
                          </div>
                          <div style={{
                            fontSize: 11,
                            color: 'var(--text-light)',
                            fontWeight: 500,
                          }}>
                            {totalDocs > 0 ? `${totalDocs} 份资料` : '点击上传'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Phase Detail Cards */}
            <div className="card">
              <div className="card-header">
                <h3>各阶段资料详情</h3>
              </div>
              <div className="card-body">
                {PHASE_ORDER.map((phase) => {
                  const docs = phaseDocs[phase] || []
                  const color = phaseColors[phase]
                  const isActive = PHASE_ORDER.indexOf(phase) === currentPhaseIndex
                  const isCompleted = PHASE_ORDER.indexOf(phase) < currentPhaseIndex

                  return (
                    <div key={phase} style={{
                      marginBottom: 16,
                      border: `1px solid ${isActive ? color : 'var(--border)'}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 18px',
                        background: isActive ? `${color}08` : isCompleted ? `${color}04` : 'transparent',
                        borderBottom: docs.length > 0 ? '1px solid var(--border)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: isActive ? color : isCompleted ? color : 'rgba(0,0,0,0.15)',
                            flexShrink: 0,
                          }} />
                          <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em' }}>
                            {PHASE_LABELS[phase]}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
                            {docs.length} 份资料
                          </span>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => openUpload(phase)}>
                          + 上传
                        </button>
                      </div>

                      {docs.length > 0 && (
                        <div style={{ padding: '8px 18px' }}>
                          {docs.map((doc) => (
                            <div key={doc.id} style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '10px 0',
                              borderBottom: '1px solid var(--border)',
                            }}>
                              <div className="file-icon" style={{
                                width: 34, height: 34, borderRadius: 8, fontSize: 16, flexShrink: 0,
                              }}>
                                {getCategoryIcon(doc.category)}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {doc.name}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                                  {DOC_CATEGORY_LABELS[doc.category]} · {formatFileSize(doc.fileSize)} · {new Date(doc.uploadedAt).toLocaleDateString('zh-CN')}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => setPreviewDoc(doc)} style={{ fontSize: 11, padding: '3px 8px' }}>预览</button>
                              {isAdmin() && (
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc.id)}>删除</button>
                              )}
                            </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {docs.length === 0 && (
                        <div style={{ padding: '16px 18px', fontSize: 12, color: 'var(--text-light)', textAlign: 'center' }}>
                          暂无资料，点击"上传"添加
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && uploadPhase && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>上传资料 — {PHASE_LABELS[uploadPhase]}</h3>
              <button className="btn-icon" onClick={() => setShowUpload(false)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>文档名称 *</label>
                  <input value={newDoc.name} onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })} placeholder="输入文档名称" />
                </div>
                <div className="form-group">
                  <label>文档分类</label>
                  <select value={newDoc.category} onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value as DocumentCategory })}>
                    {Object.entries(DOC_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>标签（逗号分隔）</label>
                  <input value={newDoc.tags} onChange={(e) => setNewDoc({ ...newDoc, tags: e.target.value })} placeholder="例如：结构, 电气" />
                </div>
                <div className="form-group full-width">
                  <label>描述</label>
                  <textarea value={newDoc.description} onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })} placeholder="文档描述（可选）" />
                </div>
                <div className="form-group full-width">
                  <label>选择文件</label>
                  <input type="file" onChange={handleFileSelect} />
                  {newDoc.fileData && (
                    <span style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>文件已选择</span>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowUpload(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={!newDoc.name.trim()}>上传</button>
            </div>
          </div>
        </div>
      )}

      <DocumentPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  )
}
