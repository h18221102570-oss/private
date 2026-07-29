import { useState, useEffect } from 'react'
import {
  getDeletedDocuments, restoreDocument, permanentDeleteDocument, emptyTrash,
  getAllProjects, isAdmin,
} from '../store/db'
import {
  PHASE_LABELS, DOC_CATEGORY_LABELS,
  ProjectPhase, DocumentCategory,
} from '../types'
import { getCategoryIcon } from './FileIcon'
import type { Document as Doc, Project } from '../types'

export default function RecycleBin() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [deleted, allProjects] = await Promise.all([
      getDeletedDocuments(),
      getAllProjects(),
    ])
    setDocs(deleted.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || '')))
    setProjects(allProjects)
  }

  function getProjectName(projectId: string): string {
    const p = projects.find((p) => p.id === projectId)
    return p ? p.name : '(项目已删除)'
  }

  async function handleRestore(id: string) {
    await restoreDocument(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
    setSelected((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm('确定永久删除该文档？此操作不可撤销。')) return
    await permanentDeleteDocument(id)
    setDocs((prev) => prev.filter((d) => d.id !== id))
    setSelected((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  async function handleEmptyTrash() {
    if (docs.length === 0) return
    if (!confirm(`确定清空回收站？将永久删除全部 ${docs.length} 个文档，此操作不可撤销。`)) return
    await emptyTrash()
    setDocs([])
    setSelected(new Set())
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const s = new Set(prev)
      if (s.has(id)) s.delete(id); else s.add(id)
      return s
    })
  }

  function toggleAll() {
    if (selected.size === docs.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(docs.map((d) => d.id)))
    }
  }

  async function batchRestore() {
    for (const id of selected) await restoreDocument(id)
    await loadData()
    setSelected(new Set())
  }

  async function batchDelete() {
    if (!confirm(`确定永久删除选中的 ${selected.size} 个文档？此操作不可撤销。`)) return
    for (const id of selected) await permanentDeleteDocument(id)
    await loadData()
    setSelected(new Set())
  }

  function formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  if (!isAdmin()) {
    return (
      <>
        <div className="page-header"><h2>回收站</h2></div>
        <div className="page-content">
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                <div className="empty-state-icon">🔒</div>
                <h3>需要管理员权限</h3>
                <p>只有管理员才能访问回收站</p>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2>回收站</h2>
          <span style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 500 }}>
            {docs.length} 个已删除文档
          </span>
        </div>
        <div className="page-header-actions">
          {selected.size > 0 && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={batchRestore}>还原选中</button>
              <button className="btn btn-danger btn-sm" onClick={batchDelete}>永久删除选中</button>
            </>
          )}
          <button className="btn btn-danger btn-sm" onClick={handleEmptyTrash} disabled={docs.length === 0}>
            清空回收站
          </button>
        </div>
      </div>

      <div className="page-content">
        {docs.length === 0 ? (
          <div className="card">
            <div className="card-body">
              <div className="empty-state">
                <div className="empty-state-icon">🗑️</div>
                <h3>回收站为空</h3>
                <p>被删除的文档会出现在这里</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        checked={selected.size === docs.length && docs.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>文档名称</th>
                    <th>所属项目</th>
                    <th>分类</th>
                    <th>阶段</th>
                    <th>大小</th>
                    <th>删除时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(doc.id)}
                          onChange={() => toggleSelect(doc.id)}
                        />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="file-icon" style={{ width: 32, height: 32, borderRadius: 6, fontSize: 14 }}>
                            {getCategoryIcon(doc.category)}
                          </div>
                          <span style={{ fontWeight: 500 }}>{doc.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{getProjectName(doc.projectId)}</td>
                      <td><span className="badge badge-gray">{DOC_CATEGORY_LABELS[doc.category]}</span></td>
                      <td><span className="badge badge-gray">{PHASE_LABELS[doc.phase as ProjectPhase]}</span></td>
                      <td style={{ color: 'var(--text-light)' }}>{formatFileSize(doc.fileSize)}</td>
                      <td style={{ color: 'var(--text-light)', fontSize: 12 }}>
                        {doc.deletedAt ? new Date(doc.deletedAt).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="btn btn-secondary btn-sm" onClick={() => handleRestore(doc.id)}>还原</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handlePermanentDelete(doc.id)}>永久删除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
