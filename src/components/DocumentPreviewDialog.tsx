import { useState, useEffect, useRef } from 'react'
import { getFileTypeIcon } from './FileIcon'
import { getToken } from '../store/db'

interface Props {
  doc: { id: string; name: string; fileType?: string; fileSize?: number } | null
  onClose: () => void
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'])
const TEXT_EXTS = new Set(['txt', 'md', 'csv', 'json', 'xml', 'html', 'htm', 'log', 'sql', 'yaml', 'yml'])

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function DocumentPreviewDialog({ doc, onClose }: Props) {
  const [dataUrl, setDataUrl] = useState('')
  const [textContent, setTextContent] = useState('')
  const [docxHtml, setDocxHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const blobUrlRef = useRef('')

  // 清理 blob URL
  function revokeBlobUrl() {
    if (blobUrlRef.current && blobUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = ''
    }
  }

  // Reset on new doc
  useEffect(() => {
    if (!doc) return
    setLoading(true)
    setError('')
    revokeBlobUrl()
    setDataUrl('')
    setTextContent('')
    setDocxHtml('')

    const ext = doc.name.split('.').pop()?.toLowerCase() || ''
    const isImage = IMAGE_EXTS.has(ext) || (doc.fileType && doc.fileType.startsWith('image/'))
    const isPDF = doc.fileType === 'application/pdf' || ext === 'pdf'
    const isText = TEXT_EXTS.has(ext) || (doc.fileType && doc.fileType.startsWith('text/'))
    const isDocx = ext === 'docx' || doc.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    const isXlsx = ext === 'xlsx' || ext === 'xls' || doc.fileType?.includes('excel') || doc.fileType?.includes('spreadsheet')

    const controller = new AbortController()

    if (isDocx) {
      fetch(`/api/files/preview-docx/${doc.id}`, { signal: controller.signal, headers: { 'Authorization': 'Bearer ' + getToken() } })
        .then((res) => {
          if (!res.ok) throw new Error('转换失败')
          return res.text()
        })
        .then((html) => {
          setDocxHtml(html); setLoading(false)
        })
        .catch((err) => {
          if (err.name !== 'AbortError') { setError(err.message); setLoading(false) }
        })
    } else if (isImage || isPDF) {
      fetch(`/api/files/view/${doc.id}`, { signal: controller.signal, headers: { 'Authorization': 'Bearer ' + getToken() } })
        .then((res) => {
          if (!res.ok) throw new Error('加载失败')
          return res.blob()
        })
        .then((blob) => {
          revokeBlobUrl()
          const url = URL.createObjectURL(blob)
          blobUrlRef.current = url
          setDataUrl(url)
          setLoading(false)
        })
        .catch((err) => {
          if (err.name !== 'AbortError') { setError(err.message); setLoading(false) }
        })
    } else if (isText) {
      fetch(`/api/files/view/${doc.id}`, { signal: controller.signal, headers: { 'Authorization': 'Bearer ' + getToken() } })
        .then((res) => {
          if (!res.ok) throw new Error('加载失败')
          return res.text()
        })
        .then((text) => {
          setTextContent(text.slice(0, 50000)); setLoading(false)
        })
        .catch((err) => {
          if (err.name !== 'AbortError') { setError(err.message); setLoading(false) }
        })
    } else if (isXlsx) {
      fetch(`/api/files/view/${doc.id}`, { signal: controller.signal, headers: { 'Authorization': 'Bearer ' + getToken() } })
        .then((res) => res.blob())
        .then((blob) => {
          revokeBlobUrl()
          const url = URL.createObjectURL(blob)
          blobUrlRef.current = url
          setDataUrl(url)
          setLoading(false)
        })
        .catch((err) => {
          if (err.name !== 'AbortError') { setError(err.message); setLoading(false) }
        })
    } else {
      setLoading(false)
    }

    return () => {
      controller.abort()
      revokeBlobUrl()
    }
  }, [doc])

  if (!doc) return null

  const ext = doc.name.split('.').pop()?.toLowerCase() || ''
  const isImage = IMAGE_EXTS.has(ext) || (doc.fileType && doc.fileType.startsWith('image/'))
  const isPDF = doc.fileType === 'application/pdf' || ext === 'pdf'
  const isText = TEXT_EXTS.has(ext) || (doc.fileType && doc.fileType.startsWith('text/'))
  const isDocx = ext === 'docx' || doc.fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const isXlsx = ext === 'xlsx' || ext === 'xls' || doc.fileType?.includes('excel') || doc.fileType?.includes('spreadsheet')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '95%', maxHeight: '90vh' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 22 }}>{getFileTypeIcon(doc.name, doc.fileType)}</span>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {doc.fileSize ? formatSize(doc.fileSize) : ''} {doc.fileType ? `· ${doc.fileType}` : ''}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn-icon" onClick={onClose} title="关闭" style={{ fontSize: 18 }}>✕</button>
          </div>
        </div>
        <div className="modal-body" style={{
          padding: 0, overflow: 'auto',
          background: isImage ? '#1a1a1a' : '#fff',
          minHeight: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>加载中...</p>
            </div>
          )}
          {error && !loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <p style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</p>
            </div>
          )}
          {!loading && !error && isImage && dataUrl && (
            <img src={dataUrl} alt={doc.name} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }} />
          )}
          {!loading && !error && isPDF && dataUrl && (
            <iframe src={dataUrl} title={doc.name} style={{ width: '100%', height: '75vh', border: 'none' }} />
          )}
          {!loading && !error && isText && textContent && (
            <pre style={{
              width: '100%', minHeight: 300, maxHeight: '70vh',
              margin: 0, padding: 24,
              fontSize: 12, fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              lineHeight: 1.6, color: '#1d1d1f', overflow: 'auto',
            }}>
              {textContent}
            </pre>
          )}
          {!loading && !error && isDocx && docxHtml && (
            <iframe
              srcDoc={docxHtml}
              title={doc.name}
              style={{ width: '100%', height: '75vh', border: 'none', background: '#fff' }}
              sandbox="allow-same-origin"
            />
          )}
          {!loading && !error && isDocx && !docxHtml && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>文档转换中...</p>
            </div>
          )}
          {!loading && !error && !isImage && !isPDF && !isText && !isDocx && (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5 }}>{getFileTypeIcon(doc.name, doc.fileType)}</div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                {isXlsx ? 'Excel 文件请下载后查看' : '此文件类型暂不支持在线预览'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-light)' }}>
                {doc.fileType || '二进制文件'} {doc.fileSize ? `· ${formatSize(doc.fileSize)}` : ''}
              </p>
              <a
                href={`/api/files/download/${doc.id}`}
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
        <div className="modal-footer">
          <a href={`/api/files/download/${doc.id}`} className="btn btn-primary" style={{ textDecoration: 'none' }}>
            下载文件
          </a>
        </div>
      </div>
    </div>
  )
}
