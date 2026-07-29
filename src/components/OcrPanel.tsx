import { useState, useEffect } from 'react'
import { getAllDocuments, getToken } from '../store/db'
import type { Document } from '../types'

const OCR_SUPPORTED = new Set(['pdf', 'png', 'jpg', 'jpeg', 'bmp', 'tiff', 'tif', 'gif', 'webp'])
const OCR_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/bmp', 'image/tiff', 'image/gif', 'image/webp'])

function isOcrSupported(doc: Document): boolean {
  const ext = doc.name.split('.').pop()?.toLowerCase() || ''
  return OCR_SUPPORTED.has(ext) || OCR_MIME.has(doc.fileType || '')
}

const DEFAULT_EXTRACT_PROMPT = '请提取以下文本中的工程关键信息，以 JSON 格式返回：\n{\n  "projectName": "项目名称",\n  "location": "施工部位",\n  "materialSpec": "材料规格",\n  "strengthGrade": "强度等级",\n  "date": "日期",\n  "otherInfo": "其他重要信息"\n}'

export default function OcrPanel() {
  const [docs, setDocs] = useState<Document[]>([])
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrResult, setOcrResult] = useState<{ fullText: string; pages: number; totalLines: number } | null>(null)
  const [ocrError, setOcrError] = useState('')

  // AI 提取
  const [extractPrompt, setExtractPrompt] = useState(DEFAULT_EXTRACT_PROMPT)
  const [extractLoading, setExtractLoading] = useState(false)
  const [extractResult, setExtractResult] = useState<any>(null)
  const [extractRaw, setExtractRaw] = useState('')

  // 选项卡
  const [activeTab, setActiveTab] = useState<'ocr' | 'extract'>('ocr')

  const token = getToken()

  useEffect(() => {
    getAllDocuments().then((list) => setDocs(list.filter(isOcrSupported)))
  }, [])

  async function handleOcr() {
    if (!selectedDoc) return
    setOcrLoading(true)
    setOcrError('')
    setOcrResult(null)
    setExtractResult(null)

    try {
      const res = await fetch('/api/ocr/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ docId: selectedDoc.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || data.message || '识别失败')
      setOcrResult({ fullText: data.fullText, pages: data.pages, totalLines: data.totalLines || 0 })
      setActiveTab('extract')
    } catch (e: any) {
      setOcrError(e.message)
    } finally {
      setOcrLoading(false)
    }
  }

  async function handleExtract() {
    if (!ocrResult?.fullText) return
    setExtractLoading(true)
    setExtractResult(null)
    setExtractRaw('')

    try {
      const res = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ text: ocrResult.fullText, prompt: extractPrompt }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.message || '提取失败')
      setExtractResult(data.extracted)
      setExtractRaw(data.rawContent)
    } catch (e: any) {
      setOcrError(e.message)
    } finally {
      setExtractLoading(false)
    }
  }

  function formatSize(bytes: number): string {
    if (!bytes) return '-'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <>
      <div className="page-header">
        <h2>OCR 智能识别</h2>
      </div>

      <div className="page-content">
        {/* 文件选择 */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>选择文件</h3></div>
          <div className="card-body">
            {docs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-light)', fontSize: 13 }}>
                暂无支持 OCR 的文件（PDF / 图片），请先在文档管理中上传文件
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={selectedDoc?.id || ''}
                  onChange={(e) => {
                    const doc = docs.find((d) => d.id === e.target.value)
                    setSelectedDoc(doc || null)
                    setOcrResult(null)
                    setOcrError('')
                    setExtractResult(null)
                  }}
                  style={{ flex: 1, minWidth: 250 }}
                >
                  <option value="">选择要识别的文件</option>
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({formatSize(d.fileSize)})
                    </option>
                  ))}
                </select>
                <button
                  className="btn btn-primary"
                  onClick={handleOcr}
                  disabled={!selectedDoc || ocrLoading}
                >
                  {ocrLoading ? '识别中...' : '🔍 开始 OCR 识别'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 选项卡 */}
        {(ocrResult || ocrError) && (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', gap: 0, padding: 0 }}>
              {[
                { key: 'ocr', label: '识别结果' },
                { key: 'extract', label: 'AI 提取' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'ocr' | 'extract')}
                  style={{
                    padding: '12px 24px', background: 'none', border: 'none',
                    borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                    fontWeight: activeTab === tab.key ? 600 : 400, fontSize: 14,
                    color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="card-body">
              {/* OCR 识别结果 */}
              {activeTab === 'ocr' && (
                <>
                  {ocrError && (
                    <div style={{ padding: 16, background: '#fef2f2', borderRadius: 8, color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>
                      {ocrError}
                    </div>
                  )}
                  {ocrResult && (
                    <div>
                      <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <span>页数：{ocrResult.pages}</span>
                        <span>识别行数：{ocrResult.totalLines}</span>
                        <span>总字数：{ocrResult.fullText.length}</span>
                      </div>
                      <div style={{
                        background: '#f8fafc', borderRadius: 8, padding: 16,
                        maxHeight: 400, overflow: 'auto', fontSize: 13, lineHeight: 1.8,
                        whiteSpace: 'pre-wrap', fontFamily: 'Consolas, Monaco, monospace',
                        border: '1px solid var(--border)',
                      }}>
                        {ocrResult.fullText}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* AI 提取 */}
              {activeTab === 'extract' && (
                <>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'block' }}>
                      提取指令（告诉 AI 怎么整理）
                    </label>
                    <textarea
                      value={extractPrompt}
                      onChange={(e) => setExtractPrompt(e.target.value)}
                      rows={5}
                      style={{ fontSize: 12, fontFamily: 'Consolas, Monaco, monospace' }}
                      placeholder="输入提取指令..."
                    />
                  </div>

                  <button
                    className="btn btn-primary"
                    onClick={handleExtract}
                    disabled={!ocrResult?.fullText || extractLoading}
                    style={{ marginBottom: 16 }}
                  >
                    {extractLoading ? 'AI 提取中...' : '🧠 AI 提取关键信息'}
                  </button>

                  {extractResult && (
                    <div>
                      <h4 style={{ fontSize: 14, marginBottom: 12 }}>提取结果</h4>
                      <div style={{
                        background: '#f0fdf4', borderRadius: 8, padding: 16,
                        fontSize: 13, border: '1px solid #bbf7d0',
                      }}>
                        {typeof extractResult === 'object' && extractResult.raw ? (
                          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{extractResult.raw}</div>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <tbody>
                              {Object.entries(extractResult).map(([key, value]) => (
                                <tr key={key}>
                                  <td style={{ padding: '6px 12px', border: '1px solid #ddd', background: '#f5f5f5', fontWeight: 600, width: 140, fontSize: 13 }}>
                                    {key}
                                  </td>
                                  <td style={{ padding: '6px 12px', border: '1px solid #ddd', fontSize: 13 }}>
                                    {String(value)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {extractResult && Object.keys(extractResult).length > 0 && !extractResult.raw && (
                        <div style={{ marginTop: 16 }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={async () => {
                              const rows = Object.entries(extractResult)
                                .map(([k, v]) => `${k}\t${String(v)}`)
                                .join('\n')
                              await navigator.clipboard.writeText(rows)
                              alert('已复制到剪贴板')
                            }}
                          >
                            📋 复制表格数据
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
