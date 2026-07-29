import { useState, useEffect, useMemo } from 'react'
import { getAllMembers, addMember, updateMember, deleteMember } from '../store/db'
import { MEMBER_ROLE_LABELS, MemberRole } from '../types'
import type { Member } from '../types'

const emptyMember = (): Member => ({
  id: '',
  name: '',
  role: MemberRole.OTHER,
  phone: '',
  email: '',
  department: '',
  notes: '',
  createdAt: '',
})

const roleIcons: Record<string, string> = {
  project_manager: '👷',
  engineer: '🔧',
  supervisor: '👁️',
  designer: '✏️',
  worker: '🏗️',
  other: '👤',
}

export default function Members() {
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Member | null>(null)
  const [form, setForm] = useState(emptyMember())

  useEffect(() => {
    loadMembers()
  }, [])

  async function loadMembers() {
    const list = await getAllMembers()
    setMembers(list)
  }

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (search) {
        const s = search.toLowerCase()
        const match = m.name.toLowerCase().includes(s)
          || m.department.toLowerCase().includes(s)
          || m.phone.includes(s)
          || m.email.toLowerCase().includes(s)
        if (!match) return false
      }
      if (roleFilter && m.role !== roleFilter) return false
      return true
    })
  }, [members, search, roleFilter])

  function openAdd() {
    setEditing(null)
    setForm(emptyMember())
    setShowModal(true)
  }

  function openEdit(member: Member) {
    setEditing(member)
    setForm({ ...member })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    if (editing) {
      const updated = await updateMember({ ...form, id: editing.id })
      setMembers((prev) => prev.map((m) => m.id === updated.id ? updated : m))
    } else {
      const created = await addMember({ ...form, id: crypto.randomUUID(), createdAt: new Date().toISOString() })
      setMembers((prev) => [...prev, created])
    }
    setShowModal(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('确定要删除该成员吗？将从所有项目中移除此人。')) return
    await deleteMember(id)
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  const roleOptions = Object.entries(MEMBER_ROLE_LABELS)

  return (
    <>
      <div className="page-header">
        <h2>人员架构</h2>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={openAdd}>+ 添加成员</button>
        </div>
      </div>

      <div className="page-content">
        <div className="search-bar">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="搜索姓名、部门、电话..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="search-filter"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ paddingRight: 32 }}
          >
            <option value="">全部角色</option>
            {roleOptions.map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span style={{ fontSize: 13, color: 'var(--text-light)', whiteSpace: 'nowrap', alignSelf: 'center' }}>
            共 {filtered.length} 人
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <h3>暂无成员</h3>
            <p>点击"添加成员"建立人员架构</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filtered.map((m) => (
              <div
                key={m.id}
                className="card"
                style={{ cursor: 'pointer' }}
                onClick={() => openEdit(m)}
              >
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #e8f0fe, #d4e4fc)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 24, flexShrink: 0,
                    }}>
                      {roleIcons[m.role] || '👤'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 15 }}>{m.name}</span>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 100,
                          background: 'var(--primary-bg)', color: 'var(--primary)',
                          fontWeight: 500,
                        }}>
                          {MEMBER_ROLE_LABELS[m.role]}
                        </span>
                      </div>
                      {m.department && (
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>
                          {m.department}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 6 }}>
                        {m.phone && (
                          <div style={{ fontSize: 12, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>📱</span>
                            <span>{m.phone}</span>
                          </div>
                        )}
                        {m.email && (
                          <div style={{ fontSize: 12, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>📧</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn-icon"
                      onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                      style={{ fontSize: 14, color: 'var(--danger)', opacity: 0.6 }}
                      title="删除成员"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>{editing ? '编辑成员' : '添加成员'}</h3>
              <button className="btn-icon" onClick={() => setShowModal(false)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="form-group full-width">
                  <label>姓名 *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="输入成员姓名"
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>角色</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as MemberRole })}
                  >
                    {roleOptions.map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>部门</label>
                  <input
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    placeholder="所属部门"
                  />
                </div>
                <div className="form-group">
                  <label>手机号</label>
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="手机号码"
                  />
                </div>
                <div className="form-group">
                  <label>邮箱</label>
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="电子邮箱"
                  />
                </div>
                <div className="form-group full-width">
                  <label>备注</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="备注信息（可选）"
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>
                {editing ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
