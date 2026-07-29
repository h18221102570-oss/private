import { useState, useEffect, useRef, useCallback } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { isAdmin, logout, getSession, updateCredentials, verifyPassword, getAllDocuments } from '../store/db'

export default function Layout() {
  const navigate = useNavigate()
  const admin = isAdmin()
  const session = getSession()
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [pwdMsg, setPwdMsg] = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ type: 'nav' | 'doc'; label: string; sub?: string; to?: string; docId?: string; projectId?: string }[]>([])
  const [showResults, setShowResults] = useState(false)
  const [syncTime, setSyncTime] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [synced, setSynced] = useState(false)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const searchRef = useRef<HTMLDivElement>(null)

  function handleLogout() {
    logout()
    navigate('/')
  }

  function openPwdModal() {
    setOldPass('')
    setNewPass('')
    setPwdMsg('')
    setShowPwdModal(true)
  }

  async function handleUpdatePwd() {
    if (!oldPass.trim()) {
      setPwdMsg('请输入原密码')
      return
    }
    const verified = await verifyPassword(oldPass)
    if (!verified) {
      setPwdMsg('原密码错误')
      return
    }
    if (!newPass.trim()) {
      setPwdMsg('请输入新密码')
      return
    }
    await updateCredentials(newPass.trim(), oldPass)
    setShowPwdModal(false)
    setPwdSuccess(true)
    setTimeout(() => setPwdSuccess(false), 3000)
  }

  async function handleSearch(value: string) {
    setSearchQuery(value)
    if (!value.trim()) {
      setSearchResults([])
      setShowResults(false)
      return
    }
    const lower = value.toLowerCase()

    // 搜索导航项
    const matchedNav = navItems
      .filter((item) => item.label.toLowerCase().includes(lower))
      .map((item) => ({ type: 'nav' as const, label: item.label, sub: item.icon, to: item.to }))

    // 搜索文档
    const docs = await getAllDocuments()
    const matchedDocs = docs
      .filter((doc) =>
        doc.name.toLowerCase().includes(lower) ||
        doc.description.toLowerCase().includes(lower) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(lower))
      )
      .slice(0, 5)
      .map((doc) => ({ type: 'doc' as const, label: doc.name, sub: '📄', docId: doc.id, projectId: doc.projectId }))

    setSearchResults([...matchedNav, ...matchedDocs])
    setShowResults(true)
  }

  function handleResultClick(item: { type: string; to?: string; docId?: string; projectId?: string }) {
    setSearchQuery('')
    setShowResults(false)
    if (item.type === 'nav' && item.to) {
      navigate(item.to)
    } else if (item.type === 'doc' && item.projectId) {
      navigate(`/projects/${item.projectId}`)
    }
  }

  // 点击外部关闭搜索面板
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 获取同步时间
  const fetchSyncTime = useCallback(async (manual = false) => {
    try {
      setSyncing(true)
      const res = await fetch('/api/sync-time')
      const data = await res.json()
      if (data.lastSaved) {
        setSyncTime(new Date(data.lastSaved).toLocaleString('zh-CN'))
      }
      if (manual) {
        setSynced(true)
        clearTimeout(syncTimerRef.current)
        syncTimerRef.current = setTimeout(() => setSynced(false), 2000)
      }
    } catch { /* ignore */ }
    setSyncing(false)
  }, [])

  useEffect(() => {
    fetchSyncTime()
    const interval = setInterval(fetchSyncTime, 30000)
    return () => clearInterval(interval)
  }, [fetchSyncTime])

  const navItems = [
    { to: '/', label: '首页', icon: '🏠' },
    { to: '/projects', label: '项目管理', icon: '📁' },
    { to: '/flowchart', label: '全周期流程', icon: '🔀' },
    { to: '/tasks', label: '待办事项', icon: '✅' },
    { to: '/members', label: '人员架构', icon: '👥' },
    { to: '/inspection', label: '材料检测', icon: '🧪' },
    { to: '/file-organizer', label: '智能收纳', icon: '🗂️' },
    { to: '/doc-creator', label: '资料编制', icon: '📝' },
    { to: '/ai', label: 'AI 助手', icon: '🤖' },
    { to: '/documents', label: '文档中心', icon: '📄' },
  ]

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <div className="sidebar-logo-icon">
            <svg width="38" height="38" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="logoBgGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#007AFF"/>
                  <stop offset="100%" stopColor="#5856D6"/>
                </linearGradient>
                <linearGradient id="logoFoldGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4DA3FF"/>
                  <stop offset="100%" stopColor="#7B79F7"/>
                </linearGradient>
              </defs>
              <rect x="32" y="32" width="448" height="448" rx="96" fill="url(#logoBgGrad)"/>
              <rect x="136" y="120" width="260" height="280" rx="24" fill="white" opacity="0.95"/>
              <path d="M316 120L316 184C316 192 324 200 332 200H396L316 120Z" fill="url(#logoFoldGrad)" opacity="0.85"/>
              <rect x="168" y="236" width="140" height="14" rx="7" fill="#007AFF" opacity="0.3"/>
              <rect x="168" y="268" width="180" height="14" rx="7" fill="#007AFF" opacity="0.2"/>
              <rect x="168" y="300" width="120" height="14" rx="7" fill="#007AFF" opacity="0.15"/>
              <rect x="168" y="332" width="90" height="14" rx="7" fill="#007AFF" opacity="0.1"/>
              <circle cx="358" cy="370" r="44" fill="#007AFF"/>
              <circle cx="358" cy="370" r="24" fill="white"/>
              <g fill="#007AFF">
                <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(0 358 370)"/>
                <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(45 358 370)"/>
                <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(90 358 370)"/>
                <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(135 358 370)"/>
                <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(180 358 370)"/>
                <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(225 358 370)"/>
                <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(270 358 370)"/>
                <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(315 358 370)"/>
              </g>
            </svg>
          </div>
          <div className="sidebar-logo-text">
            <h1>筑迹</h1>
            <span>工程项目全生命周期管理</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-search" ref={searchRef}>
            <div className="sidebar-search-input">
              <span className="sidebar-search-icon">🔍</span>
              <input
                type="text"
                placeholder="全局搜索"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => { if (searchQuery.trim()) setShowResults(true) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
                    setSearchQuery('')
                    setShowResults(false)
                  }
                }}
              />
            </div>
            {showResults && searchResults.length > 0 && (
              <div className="sidebar-search-results">
                {searchResults.map((item, i) => (
                  <div
                    key={i}
                    className="sidebar-search-item"
                    onClick={() => handleResultClick(item)}
                  >
                    <span className="sidebar-search-item-icon">{item.sub}</span>
                    <div className="sidebar-search-item-info">
                      <div className="sidebar-search-item-label">{item.label}</div>
                      <div className="sidebar-search-item-type">
                        {item.type === 'nav' ? '功能' : '文档'}
                      </div>
                    </div>
                  </div>
                ))}
                <div
                  className="sidebar-search-item sidebar-search-more"
                  onClick={() => {
                    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
                    setSearchQuery('')
                    setShowResults(false)
                  }}
                >
                  <span className="sidebar-search-item-icon">🔍</span>
                  <div className="sidebar-search-item-info">
                    <div className="sidebar-search-item-label">在全局搜索中查看全部结果</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="nav-section-label">功能</div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span className="nav-item-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
          {admin && (
            <>
              <div className="nav-section-label">管理</div>
              <NavLink
                to="/trash"
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span className="nav-item-icon">🗑️</span>
                <span>回收站</span>
              </NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          {admin ? (
            <div>
              <div
                style={{ marginBottom: 6, fontSize: 12, cursor: 'pointer', color: 'var(--primary)', fontWeight: 600 }}
                onClick={() => navigate('/admin-accounts')}
                title="账号管理"
              >
                {session?.username || '管理员'}
              </div>
              <div style={{ marginBottom: 6, fontSize: 10, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <span>{syncTime ? `同步: ${syncTime}` : '同步中...'}</span>
                {synced ? (
                  <span style={{ color: 'var(--success)', fontSize: 10 }}>已同步</span>
                ) : (
                  <button onClick={() => fetchSyncTime(true)} title="手动同步" style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '2px 4px', lineHeight: 0, opacity: 0.4,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" style={{
                      animation: syncing ? 'spin 0.8s linear infinite' : 'none',
                      verticalAlign: 'middle',
                    }}>
                      <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M2 8a6 6 0 0 1 10.47-4M14 8a6 6 0 0 1-10.47 4" strokeLinecap="round"/>
                      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="11.5,1.5 12.5,4 10,4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button onClick={openPwdModal} style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                  padding: '3px 10px', fontSize: 11, color: 'var(--text-light)',
                  cursor: 'pointer', fontWeight: 500,
                }}>
                  修改密码
                </button>
                <button onClick={handleLogout} style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                  padding: '3px 10px', fontSize: 11, color: 'var(--text-light)',
                  cursor: 'pointer', fontWeight: 500,
                }}>
                  退出登录
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: 6 }}>
                未登录
              </div>
              <button
                onClick={() => navigate('/login')}
                style={{
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 11,
                  color: 'var(--text-light)',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                管理员登录
              </button>
            </div>
          )}
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>

      {/* 密码修改成功提示 */}
      {pwdSuccess && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          background: '#34c759',
          color: '#fff',
          padding: '10px 24px',
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          zIndex: 2000,
          boxShadow: '0 4px 16px rgba(52,199,89,0.35)',
          animation: 'modalIn 0.3s ease',
        }}>
          ✓ 密码修改成功
        </div>
      )}

      {/* 修改密码弹窗 */}
      {showPwdModal && (
        <div className="modal-overlay" onClick={() => setShowPwdModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3>修改管理员密码</h3>
              <button className="btn-icon" onClick={() => setShowPwdModal(false)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              {pwdMsg && (
                <div style={{
                  background: 'rgba(255,59,48,0.08)', color: 'var(--danger)',
                  padding: '8px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: 'center',
                }}>
                  {pwdMsg}
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 14 }}>
                <label>原密码</label>
                <input
                  type="password"
                  value={oldPass}
                  onChange={(e) => setOldPass(e.target.value)}
                  placeholder="请输入当前密码"
                  style={{ width: '100%' }}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>新密码</label>
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="请输入新密码"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPwdModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleUpdatePwd}>确认修改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
