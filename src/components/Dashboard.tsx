import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardStats, getAllDocuments, getAllProjects, getPendingTaskCount } from '../store/db'
import { PHASE_LABELS, ProjectPhase, PHASE_ORDER } from '../types'
import type { Project } from '../types'

async function fetchSummary() {
  const res = await fetch('/api/data/summary')
  if (!res.ok) return { projects: 0, documents: 0, deletedDocs: 0, tasks: 0, pendingTasks: 0, dbSize: 0 }
  return res.json()
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalProjects: 0, activeProjects: 0, totalDocuments: 0,
    pendingTasks: 0, phaseDistribution: {} as Record<string, number>,
  })
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [summary, setSummary] = useState({ projects: 0, documents: 0, deletedDocs: 0, tasks: 0, pendingTasks: 0, dbSize: 0 })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [s, projects, docs] = await Promise.all([
      getDashboardStats(),
      getAllProjects(),
      getAllDocuments(),
    ])
    setStats(s)
    setRecentProjects(projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5))
    const sum = await fetchSummary()
    setSummary(sum)
  }

  function handleExport() {
    window.open('/api/data/export', '_blank')
  }

  function handleOpenFolder() {
    fetch('/api/data/open-folder', { method: 'POST' })
  }

  return (
    <>
      <div className="page-header">
        <h2>首页</h2>
      </div>
      <div className="page-content">
        <div className="stats-grid">
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
            <div className="stat-card-header">
              <div className="stat-icon blue">📁</div>
            </div>
            <div className="stat-value">{stats.totalProjects}</div>
            <div className="stat-label">项目总数</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-icon green">🔄</div>
            </div>
            <div className="stat-value">{stats.activeProjects}</div>
            <div className="stat-label">进行中项目</div>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/documents')}>
            <div className="stat-card-header">
              <div className="stat-icon purple">📄</div>
            </div>
            <div className="stat-value">{stats.totalDocuments}</div>
            <div className="stat-label">文档总数</div>
          </div>
          <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/tasks')}>
            <div className="stat-card-header">
              <div className="stat-icon orange">✅</div>
            </div>
            <div className="stat-value">{stats.pendingTasks}</div>
            <div className="stat-label">待处理任务</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <div className="card-header">
              <h3>项目阶段分布</h3>
            </div>
            <div className="card-body">
              {PHASE_ORDER.map((phase) => {
                const count = stats.phaseDistribution[phase] || 0
                const max = Math.max(...Object.values(stats.phaseDistribution).map(Number), 1)
                const pct = max > 0 ? (count / max) * 100 : 0
                return (
                  <div key={phase} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                      <span style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>{PHASE_LABELS[phase]}</span>
                      <span style={{ color: 'var(--text-light)', fontWeight: 500 }}>{count} 个项目</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>最近项目</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>查看全部</button>
            </div>
            <div className="card-body">
              {recentProjects.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">📁</div>
                  <h3>暂无项目</h3>
                  <p>点击"项目管理"创建您的第一个项目</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {recentProjects.map((p) => (
                    <div
                      key={p.id}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer' }}
                      onClick={() => navigate(`/projects/${p.id}`)}
                    >
                      <div>
                        <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{PHASE_LABELS[p.currentPhase as ProjectPhase]}</div>
                      </div>
                      <span className={`badge ${p.status === 'in_progress' ? 'badge-blue' : p.status === 'completed' ? 'badge-green' : p.status === 'planning' ? 'badge-yellow' : 'badge-gray'}`}>
                        {p.status === 'in_progress' ? '进行中' : p.status === 'completed' ? '已完成' : p.status === 'planning' ? '规划中' : '已暂停'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 数据管理 */}
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h3>数据管理</h3>
            <button className="btn btn-primary btn-sm" onClick={handleExport}>导出备份</button>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: '#f8fafc', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{summary.projects}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 4 }}>项目</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: '#f8fafc', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#34c759' }}>{summary.documents}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 4 }}>文档</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: '#f8fafc', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ff9500' }}>{summary.tasks}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 4 }}>任务</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: '#f8fafc', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ff3b30' }}>{summary.deletedDocs}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 4 }}>回收站</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px', background: '#f8fafc', borderRadius: 10 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-secondary)' }}>{formatBytes(summary.dbSize)}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500, marginTop: 4 }}>数据量</div>
              </div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/projects')}>项目管理</button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/documents')}>文档中心</button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/tasks')}>待办事项</button>
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/trash')}>回收站</button>
              <button className="btn btn-secondary btn-sm" onClick={handleExport}>备份数据库</button>
              <button className="btn btn-secondary btn-sm" onClick={handleOpenFolder}>打开文件夹</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
