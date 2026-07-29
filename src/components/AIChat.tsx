import { useState, useRef, useEffect } from 'react'
import { aiChat, getAIConfig, setAIConfig, type ChatMessage } from '../services/ai'
import { getAllProjects, getAllDocuments } from '../store/db'
import type { Project } from '../types'

export default function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: '你好！我是筑迹 AI 助手，可以帮你：\n\n• 回答工程相关问题\n• 智能搜索项目资料\n• 分析文档内容\n• 提供项目管理建议\n\n请问有什么可以帮你的？' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getAllProjects().then(setProjects)
    getAIConfig().then((c) => setHasKey(c.hasKey))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      let context = ''
      if (selectedProject) {
        const project = projects.find((p) => p.id === selectedProject)
        const docs = await getAllDocuments()
        const projectDocs = docs.filter((d) => d.projectId === selectedProject)
        context = `当前项目：${project?.name || ''}，阶段：${project?.currentPhase || ''}，文档数：${projectDocs.length}`
      }

      const reply = await aiChat([...messages, userMsg], context)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `抱歉，AI 服务暂时不可用：${e.message}\n\n请确认已配置 DEEPSEEK_API_KEY 环境变量。` }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleSaveKey() {
    await setAIConfig(apiKeyInput.trim())
    setHasKey(true)
    setShowKeyModal(false)
    setApiKeyInput('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 88px)' }}>
      <div className="page-header">
        <h2>AI 助手</h2>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowKeyModal(true)}
            style={{ fontSize: 12 }}
          >
            🔑 API 设置
          </button>
          <select
            className="search-filter"
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            style={{ minWidth: 160 }}
          >
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!hasKey && (
        <div style={{
          margin: '0 36px',
          padding: '12px 18px',
          borderRadius: 12,
          background: 'rgba(255,149,0,0.08)',
          border: '1px solid rgba(255,149,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <span style={{ fontSize: 13, color: 'var(--warning)' }}>
            ⚠️ 未配置 DeepSeek API Key，AI 功能暂时不可用
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowKeyModal(true)}
          >
            配置 Key
          </button>
        </div>
      )}

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 36px',
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 20,
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.role === 'assistant' && (
              <div style={{
                width: 36, height: 36,
                borderRadius: 10,
                background: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 16,
                color: '#fff',
              }}>
                AI
              </div>
            )}
            <div style={{
              maxWidth: '70%',
              padding: '12px 18px',
              borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'user' ? 'var(--primary)' : 'var(--bg-card)',
              color: msg.role === 'user' ? '#fff' : 'var(--text)',
              border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
              fontSize: 14,
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              boxShadow: msg.role === 'user' ? '0 2px 8px rgba(0,122,255,0.25)' : 'var(--shadow-sm)',
            }}>
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div style={{
                width: 36, height: 36,
                borderRadius: 10,
                background: 'rgba(0,0,0,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 16,
              }}>
                👤
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <div style={{
              width: 36, height: 36,
              borderRadius: 10,
              background: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: '#fff',
            }}>
              AI
            </div>
            <div style={{
              padding: '12px 18px',
              borderRadius: '18px 18px 18px 4px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              fontSize: 14,
              color: 'var(--text-light)',
            }}>
              思考中...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div style={{
        padding: '16px 36px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-card)',
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
            rows={2}
            style={{
              flex: 1,
              padding: '10px 14px',
              border: '1px solid var(--border)',
              borderRadius: 14,
              fontSize: 14,
              fontFamily: 'inherit',
              resize: 'none',
              outline: 'none',
              background: 'rgba(0,0,0,0.02)',
              color: 'var(--text)',
            }}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{ padding: '10px 24px', alignSelf: 'flex-end' }}
          >
            发送
          </button>
        </div>
      </div>

      {showKeyModal && (
        <div className="modal-overlay" onClick={() => setShowKeyModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3>配置 DeepSeek API Key</h3>
              <button className="btn-icon" onClick={() => setShowKeyModal(false)} style={{ fontSize: 18 }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                请前往 <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>platform.deepseek.com</a> 注册并获取 API Key
              </p>
              <div className="form-group">
                <label>API Key</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-xxxxxxxxxxxxxxxx"
                  autoFocus
                  style={{ width: '100%' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowKeyModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSaveKey} disabled={!apiKeyInput.trim()}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
