import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAllProjects, addProject, updateProject, deleteProject, isAdmin, getAllMembers } from '../store/db'
import { PHASE_LABELS, STATUS_LABELS, ProjectPhase, ProjectStatus, MEMBER_ROLE_LABELS } from '../types'
import type { Project, Member } from '../types'

const emptyProject = (): Project => ({
  id: '',
  name: '',
  description: '',
  status: ProjectStatus.PLANNING,
  currentPhase: ProjectPhase.INITIATION,
  location: '',
  manager: '',
  budget: 0,
  startDate: '',
  endDate: '',
  createdAt: '',
  updatedAt: '',
  developer: '',
  contractor: '',
  designUnit: '',
  supervisor: '',
  projectType: '',
  buildingArea: '',
  structureType: '',
  floorCount: '',
  memberIds: [],
})

export default function ProjectList() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Project>(emptyProject())
  const [isNew, setIsNew] = useState(true)
  const [search, setSearch] = useState('')
  const [allMembers, setAllMembers] = useState<Member[]>([])

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    const list = await getAllProjects()
    setProjects(list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  }

  async function handleCreate() {
    setIsNew(true)
    setEditing({
      ...emptyProject(),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    const members = await getAllMembers()
    setAllMembers(members)
    setShowModal(true)
  }

  async function handleEdit(p: Project) {
    setIsNew(false)
    setEditing({ ...p, memberIds: p.memberIds || [] })
    const members = await getAllMembers()
    setAllMembers(members)
    setShowModal(true)
  }

  async function handleSave() {
    if (!editing.name.trim()) return
    const project = { ...editing, updatedAt: new Date().toISOString() }
    if (isNew) {
      await addProject(project)
    } else {
      await updateProject(project)
    }
    setShowModal(false)
    await loadProjects()
  }

  async function handleDelete(id: string) {
    if (!isAdmin()) { alert('只有管理员才能删除项目'); return }
    if (!confirm('确定删除该项目及其所有文档？此操作不可撤销。')) return
    await deleteProject(id)
    await loadProjects()
  }

  function resetEdit() {
    setEditing(emptyProject())
    setShowModal(false)
  }

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location.toLowerCase().includes(search.toLowerCase()) ||
    p.manager.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (s: ProjectStatus) => {
    const map: Record<string, string> = {
      planning: 'badge-yellow',
      in_progress: 'badge-blue',
      completed: 'badge-green',
      suspended: 'badge-gray',
    }
    return map[s] || 'badge-gray'
  }

  const getPhaseBadge = (p: ProjectPhase) => {
    const map: Record<string, string> = {
      initiation: 'badge-purple',
      design: 'badge-blue',
      construction: 'badge-green',
      acceptance: 'badge-orange',
      operation: 'badge-gray',
    }
    if (!map[p]) return 'badge-gray'
    return map[p]
  }

  return (
    <>
      <div className="page-header">
        <h2>项目管理</h2>
        <button className="btn btn-primary" onClick={handleCreate}>+ 新建项目</button>
      </div>
      <div className="page-content">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="搜索项目名称、地点、负责人..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>项目名称</th>
                  <th>当前阶段</th>
                  <th>状态</th>
                  <th>负责人</th>
                  <th>地点</th>
                  <th>预算 (万元)</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <div className="empty-state-icon">📁</div>
                        <h3>{search ? '没有匹配的项目' : '暂无项目'}</h3>
                        <p>{search ? '尝试修改搜索条件' : '点击右上角"新建项目"按钮开始'}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/projects/${p.id}`)}>
                      <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{p.name}</td>
                      <td><span className={`badge ${getPhaseBadge(p.currentPhase as ProjectPhase)}`}>{PHASE_LABELS[p.currentPhase as ProjectPhase] || p.currentPhase}</span></td>
                      <td><span className={`badge ${getStatusBadge(p.status)}`}>{STATUS_LABELS[p.status] || p.status}</span></td>
                      <td>{p.manager}</td>
                      <td>{p.location}</td>
                      <td>{p.budget.toLocaleString()}</td>
                      <td style={{ color: 'var(--text-light)', fontSize: 13 }}>{new Date(p.updatedAt).toLocaleDateString('zh-CN')}</td>
                      <td>
                        <div className="table-actions" onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(p)}>编辑</button>
                          {isAdmin() && (
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>删除</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={resetEdit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isNew ? '新建项目' : '编辑项目'}</h3>
              <button className="btn-icon" onClick={resetEdit} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>项目名称 *</label>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="输入项目名称" />
                </div>
                <div className="form-group full-width">
                  <label>项目描述</label>
                  <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="输入项目描述" />
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
                  <input value={editing.manager} onChange={(e) => setEditing({ ...editing, manager: e.target.value })} placeholder="负责人姓名" />
                </div>
                <div className="form-group">
                  <label>项目地点</label>
                  <input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} placeholder="项目地点" />
                </div>
                <div className="form-group">
                  <label>预算（万元）</label>
                  <input type="number" value={editing.budget || ''} onChange={(e) => setEditing({ ...editing, budget: Number(e.target.value) })} placeholder="预算金额" />
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
              <button className="btn btn-secondary" onClick={resetEdit}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!editing.name.trim()}>
                {isNew ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
