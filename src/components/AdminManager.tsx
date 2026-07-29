import { useState, useEffect } from 'react'
import { getAllAdmins, addAdmin, deleteAdmin, resetAdminPassword, isSuperAdmin, getAdminId } from '../store/db'
import { ROLE_LABELS, UserRole } from '../types'
import type { AdminInfo } from '../types'

export default function AdminManager() {
  const [admins, setAdmins] = useState<AdminInfo[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState('')
  const [newPass, setNewPass] = useState('')
  const [msg, setMsg] = useState('')
  const [resetId, setResetId] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const superAdmin = isSuperAdmin()
  const myId = getAdminId()

  useEffect(() => { loadAdmins() }, [])

  async function loadAdmins() {
    try {
      const list = await getAllAdmins()
      setAdmins(list)
    } catch (e: any) {
      setMsg('加载失败: ' + e.message)
    }
  }

  async function handleAdd() {
    if (!newUser.trim() || !newPass.trim()) {
      setMsg('用户名和密码不能为空')
      return
    }
    try {
      await addAdmin(newUser.trim(), newPass)
      setNewUser('')
      setNewPass('')
      setShowAdd(false)
      setMsg('添加成功')
      loadAdmins()
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除此管理员？')) return
    try {
      await deleteAdmin(id)
      setMsg('已删除')
      loadAdmins()
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  async function handleResetPwd(id: string) {
    if (!newPwd.trim()) { setMsg('请输入新密码'); return }
    try {
      await resetAdminPassword(id, newPwd)
      setResetId('')
      setNewPwd('')
      setMsg('密码已重置')
    } catch (e: any) {
      setMsg(e.message)
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>账号管理</h2>
      </div>
      <div className="page-content">
        {msg && (
          <div style={{
            padding: '10px 16px', borderRadius: 8, marginBottom: 16,
            fontSize: 13, fontWeight: 500,
            background: msg.includes('成功') || msg.includes('已') ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)',
            color: msg.includes('成功') || msg.includes('已') ? '#34C759' : '#FF3B30',
          }}>
            {msg}
          </div>
        )}

        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>管理员列表</h3>
            {superAdmin && (
              <button className="btn btn-primary btn-sm" onClick={() => { setShowAdd(true); setMsg('') }}>
                + 新增管理员
              </button>
            )}
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>用户名</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>角色</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>创建时间</th>
                  <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '14px 20px', fontSize: 14, fontWeight: 600, verticalAlign: 'middle' }}>
                      {a.username}
                      {a.id === myId && (
                        <span style={{ fontSize: 10, color: 'var(--primary)', marginLeft: 6 }}>(当前)</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 12px', borderRadius: 100,
                        fontSize: 12, fontWeight: 600, lineHeight: 1.4,
                        background: a.role === UserRole.SUPER_ADMIN ? 'rgba(255,149,0,0.12)' : 'rgba(0,122,255,0.08)',
                        color: a.role === UserRole.SUPER_ADMIN ? '#FF9500' : 'var(--primary)',
                      }}>
                        {ROLE_LABELS[a.role]}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--text-secondary)', verticalAlign: 'middle' }}>
                      {new Date(a.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td style={{ padding: '14px 20px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {superAdmin && a.role !== UserRole.SUPER_ADMIN && (
                          <>
                            {resetId === a.id ? (
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                <input
                                  type="password"
                                  placeholder="新密码"
                                  value={newPwd}
                                  onChange={(e) => setNewPwd(e.target.value)}
                                  style={{ width: 100, padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border)' }}
                                />
                                <button className="btn btn-primary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => handleResetPwd(a.id)}>确定</button>
                                <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setResetId(''); setNewPwd('') }}>取消</button>
                              </div>
                            ) : (
                              <button className="btn btn-secondary btn-sm" onClick={() => { setResetId(a.id); setNewPwd(''); setMsg('') }}>重置密码</button>
                            )}
                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}>删除</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showAdd && (
          <div className="modal-overlay" onClick={() => setShowAdd(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <h3>新增管理员</h3>
                <button className="btn-icon" onClick={() => setShowAdd(false)} style={{ fontSize: 18 }}>✕</button>
              </div>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label>用户名</label>
                  <input
                    type="text"
                    value={newUser}
                    onChange={(e) => setNewUser(e.target.value)}
                    placeholder="请输入用户名"
                  />
                </div>
                <div className="form-group">
                  <label>密码</label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="请输入密码"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleAdd}>添加</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
