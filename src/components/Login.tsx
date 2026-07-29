import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogin } from '../store/db'

export default function Login() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password.trim()) {
      setError('请输入账号和密码')
      return
    }

    const ok = await adminLogin(username.trim(), password)
    if (ok) {
      navigate('/')
    } else {
      setError('账号或密码错误')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        padding: 48,
        width: 400,
        maxWidth: '90%',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '1.5px solid #000',
            background: 'transparent',
            padding: 0,
            fontSize: 18,
            fontWeight: 700,
            color: '#000',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <span style={{ lineHeight: 1, marginTop: -1 }}>←</span>
        </button>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64,
            borderRadius: 16,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}>
            <svg width="64" height="64" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="loginLogoBg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#007AFF"/>
                  <stop offset="100%" stopColor="#5856D6"/>
                </linearGradient>
                <linearGradient id="loginLogoFold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4DA3FF"/>
                  <stop offset="100%" stopColor="#7B79F7"/>
                </linearGradient>
              </defs>
              <rect x="32" y="32" width="448" height="448" rx="96" fill="url(#loginLogoBg)"/>
              <rect x="136" y="120" width="260" height="280" rx="24" fill="white" opacity="0.95"/>
              <path d="M316 120L316 184C316 192 324 200 332 200H396L316 120Z" fill="url(#loginLogoFold)" opacity="0.85"/>
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
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginBottom: 4,
          }}>
            管理员登录
          </h1>
          <p style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            fontWeight: 500,
          }}>
            筑迹 - 工程项目全生命周期管理
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{
              background: 'rgba(255,59,48,0.08)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 16,
              textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>账号</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入管理员账号"
              autoFocus
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              style={{ width: '100%' }}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 20px', fontSize: 14 }}
          >
            登录
          </button>
        </form>
      </div>
    </div>
  )
}
