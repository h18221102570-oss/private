import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getProject, updateProject, getDocumentsByProject, addDocument, softDeleteDocument, isAdmin, getAllMembers } from '../store/db'
import DocumentPreviewDialog from './DocumentPreviewDialog'
import { getCategoryIcon } from './FileIcon'
import {
  PHASE_LABELS, STATUS_LABELS, PHASE_ORDER, DOC_CATEGORY_LABELS, MEMBER_ROLE_LABELS,
  ProjectPhase, ProjectStatus, DocumentCategory,
} from '../types'
import type { Project, Document as Doc, Member } from '../types'

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [documents, setDocuments] = useState<Doc[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [activePhase, setActivePhase] = useState<ProjectPhase | null>(null)
  const [showDocModal, setShowDocModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null)
  const [newDoc, setNewDoc] = useState({
    name: '',
    category: DocumentCategory.OTHER,
    tags: '',
    description: '',
    fileData: '',
    fileType: '',
  })

  useEffect(() => {
    if (id) loadData()
  }, [id])

  async function loadData() {
    if (!id) return
    const p = await getProject(id)
    if (!p) { navigate('/projects'); return }
    setProject(p)
    const [docs, members] = await Promise.all([
      getDocumentsByProject(id),
      getAllMembers(),
    ])
    setDocuments(docs)
    setAllMembers(members)
  }

  async function handlePhaseChange(phase: ProjectPhase) {
    if (!project) return
    const updated = { ...project, currentPhase: phase, updatedAt: new Date().toISOString() }
    await updateProject(updated)
    setProject(updated)
  }

  async function handleStatusChange(status: ProjectStatus) {
    if (!project) return
    const updated = { ...project, status, updatedAt: new Date().toISOString() }
    await updateProject(updated)
    setProject(updated)
  }

  async function handleEditSave() {
    if (!editing || !editing.name.trim()) return
    const updated = { ...editing, updatedAt: new Date().toISOString() }
    await updateProject(updated)
    setProject(updated)
    setShowEditModal(false)
  }

  function handleEdit() {
    if (!project) return
    setEditing({ ...project })
    setShowEditModal(true)
  }

  async function handleUpload() {
    if (!newDoc.name.trim() || !project) return

    try {
      let fileData = ''
      let fileType = ''
      let fileSize = 0

      // 如果用户选择了本地文件
      if (newDoc.fileData) {
        fileData = newDoc.fileData
        fileType = newDoc.fileType
        fileSize = Math.round(newDoc.fileData.length * 0.75) // approximate base64 size
      }

      const doc: Doc = {
        id: crypto.randomUUID(),
        projectId: project.id,
        phase: project.currentPhase,
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
      setDocuments((prev) => [doc, ...prev])
      setShowDocModal(false)
      setNewDoc({ name: '', category: DocumentCategory.OTHER, tags: '', description: '', fileData: '', fileType: '' })
    } catch (err) {
      alert('文件过大，请选择小于 10MB 的文件')
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!isAdmin()) { alert('只有管理员才能删除文档'); return }
    if (!confirm('确定将该文档移入回收站？')) return
    await softDeleteDocument(docId)
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      alert('文件大小不能超过 10MB')
      return
    }
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

  function formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (!project) {
    return (
      <div className="page-content">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3>项目未找到</h3>
          <p>该项目可能已被删除或不存在</p>
        </div>
      </div>
    )
  }

  const phaseDocs = documents.filter((d) => !activePhase || d.phase === activePhase)

  const phaseColors: Record<string, string> = {
    initiation: '#7c3aed',
    design: '#2563eb',
    construction: '#059669',
    acceptance: '#ea580c',
    operation: '#64748b',
  }

  const phaseIcons: Record<string, string> = {
    initiation: '🚀',
    design: '🎨',
    construction: '🏗️',
    acceptance: '✅',
    operation: '🔧',
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn-icon" onClick={() => navigate('/projects')} style={{ fontSize: 20 }}>←</button>
          <h2>{project.name}</h2>
          <span className={`badge ${project.status === 'in_progress' ? 'badge-blue' : project.status === 'completed' ? 'badge-green' : project.status === 'planning' ? 'badge-yellow' : 'badge-gray'}`}>
            {STATUS_LABELS[project.status] || project.status}
          </span>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => window.print()}>🖨️ 打印</button>
          <button className="btn btn-secondary" onClick={handleEdit}>编辑项目</button>
          <button className="btn btn-primary" onClick={() => setShowDocModal(true)}>+ 上传文档</button>
        </div>
      </div>

      <div className="page-content">
        {/* Timeline */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3>项目阶段</h3>
            <select
              value={project.status}
              onChange={(e) => handleStatusChange(e.target.value as ProjectStatus)}
              className="search-filter"
              style={{ fontSize: 13 }}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="card-body">
            <div className="timeline">
              {PHASE_ORDER.map((phase, i) => {
                const isCompleted = PHASE_ORDER.indexOf(project.currentPhase as ProjectPhase) > i
                const isActive = project.currentPhase === phase
                return (
                  <div
                    key={phase}
                    className="timeline-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => handlePhaseChange(phase)}
                  >
                    <div className="timeline-line" />
                    <div className={`timeline-dot${isActive ? ' active' : ''}${isCompleted ? ' completed' : ''}`}>
                      {isCompleted ? '✓' : phaseIcons[phase]}
                    </div>
                    <div className="timeline-label">{PHASE_LABELS[phase]}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Detail Grid */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><h3>项目信息</h3></div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-section">
                <div className="detail-field">
                  <span className="detail-field-label">项目名称</span>
                  <span className="detail-field-value">{project.name}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">负责人</span>
                  <span className="detail-field-value">{project.manager || '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">项目地点</span>
                  <span className="detail-field-value">{project.location || '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">预算</span>
                  <span className="detail-field-value">{project.budget ? `${project.budget.toLocaleString()} 万元` : '-'}</span>
                </div>
              </div>
              <div className="detail-section">
                <div className="detail-field">
                  <span className="detail-field-label">开始日期</span>
                  <span className="detail-field-value">{project.startDate || '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">结束日期</span>
                  <span className="detail-field-value">{project.endDate || '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">创建时间</span>
                  <span className="detail-field-value">{new Date(project.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">更新时间</span>
                  <span className="detail-field-value">{new Date(project.updatedAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            </div>
            {project.description && (
              <div style={{ marginTop: 12, padding: '12px 16px', background: '#f8fafc', borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
                {project.description}
              </div>
            )}
          </div>
        </div>

        {/* Engineering Info */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header"><h3>工程信息</h3></div>
          <div className="card-body">
            <div className="detail-grid">
              <div className="detail-section">
                <div className="detail-field">
                  <span className="detail-field-label">建设单位</span>
                  <span className="detail-field-value">{project.developer || '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">施工单位</span>
                  <span className="detail-field-value">{project.contractor || '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">设计单位</span>
                  <span className="detail-field-value">{project.designUnit || '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">监理单位</span>
                  <span className="detail-field-value">{project.supervisor || '-'}</span>
                </div>
              </div>
              <div className="detail-section">
                <div className="detail-field">
                  <span className="detail-field-label">工程类型</span>
                  <span className="detail-field-value">{project.projectType || '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">结构类型</span>
                  <span className="detail-field-value">{project.structureType || '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">建筑面积</span>
                  <span className="detail-field-value">{project.buildingArea ? `${project.buildingArea} m²` : '-'}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-field-label">层数</span>
                  <span className="detail-field-value">{project.floorCount || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Members */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3>项目成员</h3>
            <span style={{ fontSize: 13, color: 'var(--text-light)' }}>
              {project.memberIds?.length || 0} / {allMembers.length} 人
            </span>
          </div>
          <div className="card-body">
            {allMembers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <h3>暂无成员</h3>
                <p>请先在人员架构中添加团队成员</p>
              </div>
            ) : (() => {
              const projectMembers = allMembers.filter((m) => project.memberIds?.includes(m.id))
              return projectMembers.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">👥</div>
                  <h3>未分配成员</h3>
                  <p>点击"编辑项目"为此项目分配团队成员</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {projectMembers.map((m) => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 14px', borderRadius: 10,
                      background: '#f8fafc', border: '1px solid var(--border)',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #e8f0fe, #d4e4fc)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 16,
                      }}>
                        {m.role === 'project_manager' ? '👷' : m.role === 'engineer' ? '🔧' : m.role === 'supervisor' ? '👁️' : m.role === 'designer' ? '✏️' : m.role === 'worker' ? '🏗️' : '👤'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
                          {MEMBER_ROLE_LABELS[m.role]}{m.department ? ` · ${m.department}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>

        {/* Documents */}
        <div className="card">
          <div className="card-header">
            <h3>项目文档</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={activePhase || ''}
                onChange={(e) => setActivePhase((e.target.value as ProjectPhase) || null)}
                className="search-filter"
                style={{ fontSize: 13 }}
              >
                <option value="">全部阶段</option>
                {PHASE_ORDER.map((p) => (
                  <option key={p} value={p}>{PHASE_LABELS[p]}</option>
                ))}
              </select>
              <span style={{ fontSize: 13, color: 'var(--text-light)' }}>共 {documents.length} 个文档</span>
            </div>
          </div>
          <div className="card-body">
            {phaseDocs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📄</div>
                <h3>暂无文档</h3>
                <p>点击右上角"上传文档"添加项目资料</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {phaseDocs.map((doc) => (
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
                      {isAdmin() && (
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteDoc(doc.id)}>删除</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showDocModal && (
        <div className="modal-overlay" onClick={() => setShowDocModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>上传文档</h3>
              <button className="btn-icon" onClick={() => setShowDocModal(false)} style={{ fontSize: 18 }}>✕</button>
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
              <button className="btn btn-secondary" onClick={() => setShowDocModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={!newDoc.name.trim()}>上传</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && editing && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>编辑项目</h3>
              <button className="btn-icon" onClick={() => setShowEditModal(false)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>项目名称 *</label>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="输入项目名称" />
                </div>
                <div className="form-group full-width">
                  <label>项目描述</label>
                  <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>项目状态</label>
                  <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as ProjectStatus })}>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>当前阶段</label>
                  <select value={editing.currentPhase} onChange={(e) => setEditing({ ...editing, currentPhase: e.target.value as ProjectPhase })}>
                    {Object.entries(PHASE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>负责人</label>
                  <input value={editing.manager} onChange={(e) => setEditing({ ...editing, manager: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>项目地点</label>
                  <input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>预算（万元）</label>
                  <input type="number" value={editing.budget || ''} onChange={(e) => setEditing({ ...editing, budget: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>开始日期</label>
                  <input type="date" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>结束日期</label>
                  <input type="date" value={editing.endDate} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} />
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>工程信息</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>建设单位</label>
                    <input value={editing.developer} onChange={(e) => setEditing({ ...editing, developer: e.target.value })} placeholder="建设单位名称" />
                  </div>
                  <div className="form-group">
                    <label>施工单位</label>
                    <input value={editing.contractor} onChange={(e) => setEditing({ ...editing, contractor: e.target.value })} placeholder="施工单位名称" />
                  </div>
                  <div className="form-group">
                    <label>设计单位</label>
                    <input value={editing.designUnit} onChange={(e) => setEditing({ ...editing, designUnit: e.target.value })} placeholder="设计单位名称" />
                  </div>
                  <div className="form-group">
                    <label>监理单位</label>
                    <input value={editing.supervisor} onChange={(e) => setEditing({ ...editing, supervisor: e.target.value })} placeholder="监理单位名称" />
                  </div>
                  <div className="form-group">
                    <label>工程类型</label>
                    <select value={editing.projectType} onChange={(e) => setEditing({ ...editing, projectType: e.target.value })}>
                      <option value="">请选择</option>
                      <option value="房屋建筑">房屋建筑</option>
                      <option value="市政工程">市政工程</option>
                      <option value="水利工程">水利工程</option>
                      <option value="交通工程">交通工程</option>
                      <option value="电力工程">电力工程</option>
                      <option value="工业工程">工业工程</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>结构类型</label>
                    <select value={editing.structureType} onChange={(e) => setEditing({ ...editing, structureType: e.target.value })}>
                      <option value="">请选择</option>
                      <option value="框架结构">框架结构</option>
                      <option value="剪力墙结构">剪力墙结构</option>
                      <option value="框架-剪力墙">框架-剪力墙</option>
                      <option value="钢结构">钢结构</option>
                      <option value="砖混结构">砖混结构</option>
                      <option value="其他">其他</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>建筑面积（m²）</label>
                    <input value={editing.buildingArea} onChange={(e) => setEditing({ ...editing, buildingArea: e.target.value })} placeholder="建筑面积" />
                  </div>
                  <div className="form-group">
                    <label>层数</label>
                    <input value={editing.floorCount} onChange={(e) => setEditing({ ...editing, floorCount: e.target.value })} placeholder="地上/地下层数" />
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>项目成员</h4>
                {allMembers.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--text-light)' }}>暂无成员数据，请先在人员架构中添加</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {allMembers.map((m) => {
                      const selected = (editing.memberIds || []).includes(m.id)
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            const ids = editing.memberIds || []
                            setEditing({
                              ...editing,
                              memberIds: selected ? ids.filter((mid) => mid !== m.id) : [...ids, m.id],
                            })
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 12px', borderRadius: 100,
                            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
                            background: selected ? 'var(--primary-bg)' : '#fff',
                            cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            transition: 'all 0.15s',
                            userSelect: 'none',
                          }}
                        >
                          <span style={{ fontSize: 14 }}>{m.role === 'project_manager' ? '👷' : m.role === 'engineer' ? '🔧' : m.role === 'supervisor' ? '👁️' : m.role === 'designer' ? '✏️' : m.role === 'worker' ? '🏗️' : '👤'}</span>
                          <span>{m.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-light)' }}>({MEMBER_ROLE_LABELS[m.role]})</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={!editing.name.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}

      <DocumentPreviewDialog doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </>
  )
}
