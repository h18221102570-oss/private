import { useState, useRef, useCallback, useEffect } from 'react'
import { classifyFiles, batchUploadFiles, type FileClassification } from '../services/ai'
import { getAllProjects } from '../store/db'
import { getFileTypeIcon } from './FileIcon'
import {
  DOC_CATEGORY_LABELS,
  PHASE_LABELS,
  DocumentCategory,
  ProjectPhase,
  PHASE_ORDER,
} from '../types'
import type { Project } from '../types'

type Stage = 'upload' | 'classifying' | 'review' | 'saving' | 'done'

interface QueuedFile {
  name: string
  size: number
  fileType: string
  fileData: string
  textContent: string
  classification?: FileClassification
}

const CATEGORY_OPTIONS = Object.entries(DOC_CATEGORY_LABELS)
const PHASE_OPTIONS = PHASE_ORDER.map((p) => [p, PHASE_LABELS[p]] as const)

// 可提取文本的文件扩展名
const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts',
  'jsx', 'tsx', 'yaml', 'yml', 'ini', 'cfg', 'log', 'sql', 'rtf',
])

// 图片类型
const IMAGE_TYPES = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'])

export default function SmartFileOrganizer() {
  const [stage, setStage] = useState<Stage>('upload')
  const [files, setFiles] = useState<QueuedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [classifyError, setClassifyError] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveCount, setSaveCount] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // PDF
  const isPDF = (fileType: string, name: string) => fileType === 'application/pdf' || name.toLowerCase().endsWith('.pdf')

  // 获取文件 data URL
  function getFileDataUrl(f: QueuedFile) {
    return `data:${f.fileType};base64,${f.fileData}`
  }

  useEffect(() => {
    getAllProjects().then(setProjects).catch(() => {})
  }, [])

  // 读取文件为 base64
  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.includes('base64,') ? result.split('base64,')[1] : result
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // 尝试读取文件文本内容
  function readFileText(file: File): Promise<string> {
    return new Promise((resolve) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const mime = file.type || ''
      const isTextExt = TEXT_EXTENSIONS.has(ext)
      const isTextMime = mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml'
      
      if (!isTextExt && !isTextMime) {
        resolve('')
        return
      }

      const reader = new FileReader()
      reader.onload = () => {
        const text = (reader.result as string).slice(0, 5000)
        resolve(text)
      }
      reader.onerror = () => resolve('')
      reader.readAsText(file)
    })
  }

  // 添加文件
  async function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList)
    if (!incoming.length) return

    setClassifyError('')
    setSaveMsg('')

    const newFiles: QueuedFile[] = []
    for (const file of incoming) {
      try {
        const [fileData, textContent] = await Promise.all([
          readFileAsBase64(file),
          readFileText(file),
        ])
        newFiles.push({
          name: file.name,
          size: file.size,
          fileType: file.type || 'application/octet-stream',
          fileData,
          textContent,
        })
      } catch {
        // skip unreadable files
      }
    }

    setFiles((prev) => [...prev, ...newFiles])
  }

  // 拖拽事件
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (e.dataTransfer.files.length) {
      await addFiles(e.dataTransfer.files)
    }
  }, [])

  // 文件选择
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) {
      await addFiles(e.target.files)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 移除单个文件
  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // 清空所有文件
  function clearAll() {
    setFiles([])
    setStage('upload')
    setClassifyError('')
    setSaveMsg('')
  }

  // 智能分类
  async function handleClassify() {
    if (!files.length) return
    setStage('classifying')
    setClassifyError('')

    try {
      const fileInfos = files.map((f) => ({
        name: f.name,
        size: f.size,
        textContent: f.textContent,
        fileType: f.fileType,
      }))
      const results = await classifyFiles(fileInfos)

      setFiles((prev) =>
        prev.map((f, i) => ({
          ...f,
          classification: results[i] || undefined,
        }))
      )
      setStage('review')
    } catch (e: any) {
      setClassifyError(e.message || '分类失败，请重试')
      setStage('upload')
    }
  }

  // 修改单个文件的分类 / 文件名
  function updateClassification(index: number, field: 'category' | 'phase' | 'suggestedName', value: string) {
    setFiles((prev) =>
      prev.map((f, i) => {
        if (i !== index || !f.classification) return f
        const updated = { ...f.classification, [field]: value }
        if (field === 'category') {
          updated.categoryLabel = DOC_CATEGORY_LABELS[value as DocumentCategory] || value
        }
        if (field === 'phase') {
          updated.phaseLabel = PHASE_LABELS[value as ProjectPhase] || value
        }
        return { ...f, classification: updated }
      })
    )
  }

  // 确认入库
  async function handleSave() {
    if (!selectedProjectId) {
      setSaveMsg('请先选择目标项目')
      return
    }
    if (!files.length) return

    setStage('saving')
    setSaveMsg('')

    try {
      const payload = files.map((f) => ({
        name: f.classification?.suggestedName || f.name,
        size: f.size,
        fileData: f.fileData,
        fileType: f.fileType,
        category: f.classification?.category || 'other',
        phase: f.classification?.phase || 'construction',
      }))

      const result = await batchUploadFiles(selectedProjectId, payload)
      setSaveCount(result.count)
      setStage('done')
    } catch (e: any) {
      setSaveMsg(e.message || '入库失败')
      setStage('review')
    }
  }

  // 再来一批
  function reset() {
    setFiles([])
    setStage('upload')
    setClassifyError('')
    setSaveMsg('')
    setSaveCount(0)
    setSelectedProjectId('')
  }

  // 格式化文件大小
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="page-content" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* 上传阶段 */}
      {stage === 'upload' && (
        <>
          <div className="page-header" style={{ padding: '0 0 20px', background: 'none', backdropFilter: 'none', borderBottom: '1px solid var(--border)', position: 'static' }}>
            <div>
              <h2>智能文件收纳</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                批量拖拽文件，AI 分析内容智能分类并生成归档文件名，确认后一键入库
              </p>
            </div>
          </div>

          {/* 拖拽上传区域 */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              marginTop: 24,
              border: `2px dashed ${dragOver ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 'var(--radius-xl)',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'rgba(0,122,255,0.04)' : 'rgba(0,0,0,0.01)',
              transition: 'all var(--transition)',
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.6 }}>📂</div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              拖拽文件到此处上传
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              或点击此处选择文件（支持批量）
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>

          {/* 已添加文件列表 */}
          {files.length > 0 && (
            <div
              className="card"
              style={{ marginTop: 20, borderRadius: 'var(--radius-lg)' }}
            >
              <div className="card-header">
                <h3>
                  已选择 {files.length} 个文件
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" onClick={clearAll}>
                    清空
                  </button>
                  <button className="btn btn-primary" onClick={handleClassify}>
                    AI 智能分类
                  </button>
                </div>
              </div>
              <div className="card-body" style={{ padding: '8px 0', maxHeight: 400, overflowY: 'auto' }}>
                {files.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '10px 24px',
                      borderBottom: i < files.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: 'default',
                    }}
                  >
                    <span style={{ fontSize: 20 }}>{getFileTypeIcon(f.name, f.fileType)}</span>
                    <div style={{ flex: 1, minWidth: 0 }} onClick={() => setPreviewIndex(i)} title="点击预览">
                      <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', color: 'var(--primary)' }}>
                        {f.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{formatSize(f.size)}</div>
                    </div>
                    <button
                      className="btn-icon"
                      onClick={(e) => { e.stopPropagation(); setPreviewIndex(i) }}
                      title="预览"
                      style={{ fontSize: 15, width: 28, height: 28 }}
                    >
                      👁
                    </button>
                    <button
                      className="btn-icon"
                      onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                      title="移除"
                      style={{ fontSize: 14, width: 28, height: 28 }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 分类中 */}
      {stage === 'classifying' && (
        <>
          <div className="page-header" style={{ padding: '0 0 20px', background: 'none', backdropFilter: 'none', borderBottom: '1px solid var(--border)', position: 'static' }}>
            <h2>AI 正在分析分类...</h2>
          </div>
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16, animation: 'pulse 1.5s ease infinite' }}>
              🤖
            </div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              正在分析 {files.length} 个文件，请稍候...
            </p>
          </div>
        </>
      )}

      {/* 审核阶段 */}
      {stage === 'review' && (
        <>
          <div className="page-header" style={{ padding: '0 0 20px', background: 'none', backdropFilter: 'none', borderBottom: '1px solid var(--border)', position: 'static' }}>
            <div>
              <h2>确认分类结果</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                AI 已完成分类，请核对并修改，确认无误后入库
              </p>
            </div>
          </div>

          {/* 目标项目选择 */}
          <div className="card" style={{ marginTop: 24, borderRadius: 'var(--radius-lg)' }}>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px' }}>
              <label style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>目标项目：</label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  fontSize: 13,
                  fontFamily: 'inherit',
                  background: 'rgba(0,0,0,0.02)',
                  color: 'var(--text)',
                  outline: 'none',
                  textAlign: 'center',
                  textAlignLast: 'center',
                  appearance: 'none',
                  WebkitAppearance: 'none',
                }}
              >
                <option value="">-- 请选择项目 --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                style={{ whiteSpace: 'nowrap' }}
                disabled={!selectedProjectId}
              >
                确认入库
              </button>
            </div>
          </div>

          {classifyError && (
            <div style={{
              marginTop: 12, padding: '10px 16px', borderRadius: 10,
              background: 'rgba(255,59,48,0.08)', color: 'var(--danger)', fontSize: 13,
            }}>
              {classifyError}
            </div>
          )}

          {/* 分类结果表格 */}
          <div className="card" style={{ marginTop: 16, borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div className="table-container">
              <table style={{ minWidth: 1000 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>#</th>
                    <th style={{ width: 160 }}>原文件名</th>
                    <th style={{ width: 220 }}>归档文件名（可编辑）</th>
                    <th style={{ width: 80 }}>大小</th>
                    <th style={{ width: 100 }}>分类</th>
                    <th style={{ width: 100 }}>所属阶段</th>
                    <th>内容摘要</th>
                    <th style={{ width: 50 }}>预览</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f, i) => (
                    <tr key={i}>
                      <td style={{ color: 'var(--text-light)', textAlign: 'center', fontSize: 12 }}>{i + 1}</td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 500, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>
                          {f.name}
                        </div>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={f.classification?.suggestedName || ''}
                          onChange={(e) => updateClassification(i, 'suggestedName', e.target.value)}
                          placeholder={f.name}
                          style={{
                            width: '100%', padding: '5px 8px', border: '1px solid var(--border)',
                            borderRadius: 6, fontSize: 11, fontFamily: 'inherit',
                            background: 'rgba(0,0,0,0.02)', color: 'var(--text)', outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatSize(f.size)}</td>
                      <td>
                        <select
                          value={f.classification?.category || 'other'}
                          onChange={(e) => updateClassification(i, 'category', e.target.value)}
                          style={{
                            width: '100%', padding: '5px 8px', border: '1px solid var(--border)',
                            borderRadius: 6, fontSize: 11, fontFamily: 'inherit',
                            background: 'rgba(0,0,0,0.02)', color: 'var(--text)', outline: 'none',
                            textAlign: 'center', textAlignLast: 'center',
                            appearance: 'none', WebkitAppearance: 'none',
                          }}
                        >
                          {CATEGORY_OPTIONS.map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          value={f.classification?.phase || 'construction'}
                          onChange={(e) => updateClassification(i, 'phase', e.target.value)}
                          style={{
                            width: '100%', padding: '5px 8px', border: '1px solid var(--border)',
                            borderRadius: 6, fontSize: 11, fontFamily: 'inherit',
                            background: 'rgba(0,0,0,0.02)', color: 'var(--text)', outline: 'none',
                            textAlign: 'center', textAlignLast: 'center',
                            appearance: 'none', WebkitAppearance: 'none',
                          }}
                        >
                          {PHASE_OPTIONS.map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.classification?.summary || '-'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn-icon"
                          onClick={() => setPreviewIndex(i)}
                          title="预览"
                          style={{ fontSize: 14, width: 26, height: 26 }}
                        >
                          👁
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setStage('upload')}>
              返回修改文件
            </button>
            <button className="btn btn-secondary" onClick={handleClassify}>
              重新分类
            </button>
          </div>
        </>
      )}

      {/* 保存中 */}
      {stage === 'saving' && (
        <>
          <div className="page-header" style={{ padding: '0 0 20px', background: 'none', backdropFilter: 'none', borderBottom: '1px solid var(--border)', position: 'static' }}>
            <h2>正在入库...</h2>
          </div>
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>💾</div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
              正在保存 {files.length} 个文件到项目中...
            </p>
          </div>
          {saveMsg && (
            <div style={{
              marginTop: 12, padding: '10px 16px', borderRadius: 10,
              background: 'rgba(255,59,48,0.08)', color: 'var(--danger)', fontSize: 13,
            }}>
              {saveMsg}
            </div>
          )}
        </>
      )}

      {/* 完成 */}
      {stage === 'done' && (
        <>
          <div className="page-header" style={{ padding: '0 0 20px', background: 'none', backdropFilter: 'none', borderBottom: '1px solid var(--border)', position: 'static' }}>
            <h2>入库完成</h2>
          </div>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              成功入库 {saveCount} 个文件
            </h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              文件已按分类存放至对应项目文件夹
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={reset}>
                再来一批
              </button>
              {selectedProjectId && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    window.location.href = `/projects/${selectedProjectId}`
                  }}
                >
                  前往项目查看
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* 文件预览弹窗 */}
      {previewIndex !== null && files[previewIndex] && (() => {
        const f = files[previewIndex]
        const ext = f.name.split('.').pop()?.toLowerCase() || ''
        const isImage = IMAGE_TYPES.has(ext) || f.fileType.startsWith('image/')
        const isPdf = isPDF(f.fileType, f.name)
        const dataUrl = getFileDataUrl(f)

        return (
          <div className="modal-overlay" onClick={() => setPreviewIndex(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '95%', maxHeight: '90vh' }}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 22 }}>{getFileTypeIcon(f.name, f.fileType)}</span>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</h3>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{formatSize(f.size)} · {f.fileType || '未知类型'}</span>
                  </div>
                </div>
                <button className="btn-icon" onClick={() => setPreviewIndex(null)} style={{ fontSize: 18 }}>✕</button>
              </div>
              <div className="modal-body" style={{ padding: 0, overflow: 'auto', background: isImage ? '#1a1a1a' : '#fff', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isImage && (
                  <img
                    src={dataUrl}
                    alt={f.name}
                    style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
                  />
                )}
                {isPdf && (
                  <iframe
                    src={dataUrl}
                    title={f.name}
                    style={{ width: '100%', height: '75vh', border: 'none' }}
                  />
                )}
                {!isImage && !isPdf && f.textContent && (
                  <pre style={{
                    width: '100%', minHeight: 300, maxHeight: '70vh',
                    margin: 0, padding: 24,
                    fontSize: 12, fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    lineHeight: 1.6, color: '#1d1d1f', overflow: 'auto',
                  }}>
                    {f.textContent}
                  </pre>
                )}
                {!isImage && !isPdf && !f.textContent && (
                  <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                    <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>{getFileTypeIcon(f.name, f.fileType)}</div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      此文件类型暂不支持在线预览
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text-light)' }}>
                      {f.fileType || '二进制文件'} · {formatSize(f.size)}
                    </p>
                    <a
                      href={dataUrl}
                      download={f.name}
                      style={{
                        display: 'inline-block', marginTop: 16,
                        padding: '8px 20px', borderRadius: 100,
                        background: 'var(--primary)', color: '#fff',
                        textDecoration: 'none', fontSize: 13, fontWeight: 600,
                      }}
                    >
                      下载文件
                    </a>
                  </div>
                )}
              </div>
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary" onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))} disabled={previewIndex <= 0}>
                    ← 上一个
                  </button>
                  <button className="btn btn-secondary" onClick={() => setPreviewIndex(Math.min(files.length - 1, previewIndex + 1))} disabled={previewIndex >= files.length - 1}>
                    下一个 →
                  </button>
                </div>
                <a href={dataUrl} download={f.name} className="btn btn-primary" style={{ textDecoration: 'none' }}>
                  下载
                </a>
              </div>
            </div>
          </div>
        )
      })()}

      {/* keyframe animation for pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.95); }
        }
      `}</style>
    </div>
  )
}
