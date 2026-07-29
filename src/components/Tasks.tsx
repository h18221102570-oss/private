import { useState, useEffect } from 'react'
import {
  getAllTasks, addTask, updateTask, deleteTask, getAllProjects,
} from '../store/db'
import {
  TaskStatus, TASK_STATUS_LABELS,
  TaskPriority, TASK_PRIORITY_LABELS,
} from '../types'
import type { Task, Project } from '../types'

const emptyTask = (): Task => ({
  id: '',
  projectId: '',
  title: '',
  description: '',
  status: TaskStatus.PENDING,
  priority: TaskPriority.MEDIUM,
  assignee: '',
  dueDate: '',
  createdAt: '',
  updatedAt: '',
})

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterProject, setFilterProject] = useState<string>('')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Task>(emptyTask())
  const [isNew, setIsNew] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [t, p] = await Promise.all([getAllTasks(), getAllProjects()])
    setTasks(t.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
    setProjects(p)
  }

  function handleCreate() {
    setIsNew(true)
    setEditing({
      ...emptyTask(),
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    setShowModal(true)
  }

  function handleEdit(task: Task) {
    setIsNew(false)
    setEditing({ ...task })
    setShowModal(true)
  }

  async function handleSave() {
    if (!editing.title.trim()) return
    const task = { ...editing, updatedAt: new Date().toISOString() }
    if (isNew) {
      await addTask(task)
    } else {
      await updateTask(task)
    }
    setShowModal(false)
    await loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该待办事项？')) return
    await deleteTask(id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  async function toggleStatus(task: Task) {
    const newStatus =
      task.status === TaskStatus.COMPLETED
        ? TaskStatus.PENDING
        : task.status === TaskStatus.IN_PROGRESS
          ? TaskStatus.COMPLETED
          : TaskStatus.IN_PROGRESS

    const updated: Task = {
      ...task,
      status: newStatus,
      updatedAt: new Date().toISOString(),
      completedAt: newStatus === TaskStatus.COMPLETED ? new Date().toISOString() : undefined,
    }
    await updateTask(updated)
    setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)))
  }

  function getProjectName(id: string): string {
    if (!id) return '全局'
    return projects.find((p) => p.id === id)?.name || id.slice(0, 8)
  }

  const priorityBadge: Record<string, string> = {
    high: 'badge-red',
    medium: 'badge-yellow',
    low: 'badge-gray',
  }

  const statusBadge: Record<string, string> = {
    pending: 'badge-yellow',
    in_progress: 'badge-blue',
    completed: 'badge-green',
  }

  const filtered = tasks.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false
    if (filterProject && t.projectId !== filterProject) return false
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pendingCount = tasks.filter((t) => t.status !== TaskStatus.COMPLETED).length

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>待办事项</h2>
          {pendingCount > 0 && (
            <span className="badge badge-orange">{pendingCount} 项待处理</span>
          )}
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>+ 新建任务</button>
      </div>

      <div className="page-content">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="搜索任务标题..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="search-filter" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">全部状态</option>
            {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select className="search-filter" value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>任务标题</th>
                  <th>项目</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>负责人</th>
                  <th>截止日期</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state">
                        <div className="empty-state-icon">✅</div>
                        <h3>{tasks.length === 0 ? '暂无待办事项' : '没有匹配的任务'}</h3>
                        <p>{tasks.length === 0 ? '点击右上角"新建任务"开始' : '尝试修改筛选条件'}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((task) => (
                    <tr key={task.id}>
                      <td style={{ textAlign: 'center' }}>
                        <div
                          onClick={() => toggleStatus(task)}
                          style={{
                            width: 20, height: 20, borderRadius: '50%',
                            border: `2px solid ${task.status === TaskStatus.COMPLETED ? 'var(--success)' : 'var(--border)'}`,
                            background: task.status === TaskStatus.COMPLETED ? 'var(--success)' : 'transparent',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                        >
                          {task.status === TaskStatus.COMPLETED && (
                            <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{
                          fontWeight: 500, fontSize: 13,
                          textDecoration: task.status === TaskStatus.COMPLETED ? 'line-through' : 'none',
                          opacity: task.status === TaskStatus.COMPLETED ? 0.4 : 1,
                          cursor: 'pointer',
                        }} onClick={() => handleEdit(task)}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{task.description}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{getProjectName(task.projectId)}</td>
                      <td>
                        <span className={`badge ${statusBadge[task.status]}`}>{TASK_STATUS_LABELS[task.status]}</span>
                      </td>
                      <td>
                        <span className={`badge ${priorityBadge[task.priority]}`}>{TASK_PRIORITY_LABELS[task.priority]}</span>
                      </td>
                      <td style={{ fontSize: 12 }}>{task.assignee || '-'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-light)' }}>
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString('zh-CN') : '-'}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(task)}>编辑</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(task.id)}>删除</button>
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isNew ? '新建任务' : '编辑任务'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group full-width">
                  <label>任务标题 *</label>
                  <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="输入任务标题" autoFocus />
                </div>
                <div className="form-group full-width">
                  <label>描述</label>
                  <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="任务描述" />
                </div>
                <div className="form-group">
                  <label>关联项目</label>
                  <select value={editing.projectId} onChange={(e) => setEditing({ ...editing, projectId: e.target.value })}>
                    <option value="">全局（不关联项目）</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>负责人</label>
                  <input value={editing.assignee} onChange={(e) => setEditing({ ...editing, assignee: e.target.value })} placeholder="负责人" />
                </div>
                <div className="form-group">
                  <label>状态</label>
                  <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as TaskStatus })}>
                    {Object.entries(TASK_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>优先级</label>
                  <select value={editing.priority} onChange={(e) => setEditing({ ...editing, priority: e.target.value as TaskPriority })}>
                    {Object.entries(TASK_PRIORITY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>截止日期</label>
                  <input type="date" value={editing.dueDate} onChange={(e) => setEditing({ ...editing, dueDate: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!editing.title.trim()}>
                {isNew ? '创建' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
