import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

interface Props {
  initialContent?: string
  initialFileName?: string
  onSave?: (fileName: string, content: string) => void
  onClose?: () => void
}

export default function DocEditor({ initialContent = '', initialFileName = '', onSave, onClose }: Props) {
  const navigate = useNavigate()
  const editorRef = useRef<HTMLDivElement>(null)
  const [fileName, setFileName] = useState(initialFileName || '新建文档')
  const [saved, setSaved] = useState(false)

  function handleClose() {
    if (onClose) onClose()
    else navigate(-1)
  }

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent
    }
  }, [initialContent])

  function execCmd(cmd: string, val?: string) {
    document.execCommand(cmd, false, val)
    editorRef.current?.focus()
  }

  function handleSave() {
    const content = editorRef.current?.innerHTML || ''
    if (onSave) {
      onSave(fileName, content)
    } else {
      // Download as HTML file
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title></head><body>${content}</body></html>`
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName + '.html'
      a.click()
      URL.revokeObjectURL(url)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleInsertTable() {
    const rows = prompt('行数:', '3')
    const cols = prompt('列数:', '3')
    if (!rows || !cols) return
    let table = '<table border="1" style="border-collapse:collapse;width:100%">'
    for (let i = 0; i < +rows; i++) {
      table += '<tr>'
      for (let j = 0; j < +cols; j++) {
        table += `<td style="padding:6px 10px;min-width:60px">&nbsp;</td>`
      }
      table += '</tr>'
    }
    table += '</table><p><br></p>'
    execCmd('insertHTML', table)
  }

  const toolbarGroups: { label: string; title: string; cmd: string; val?: string; style?: string }[][] = [
    [
      { label: 'B', title: '加粗', cmd: 'bold' },
      { label: 'I', title: '斜体', cmd: 'italic', style: 'italic' },
      { label: 'U', title: '下划线', cmd: 'underline' },
      { label: 'S', title: '删除线', cmd: 'strikeThrough' },
    ],
    [
      { label: 'H1', title: '标题1', cmd: 'formatBlock', val: 'h1' },
      { label: 'H2', title: '标题2', cmd: 'formatBlock', val: 'h2' },
      { label: 'H3', title: '标题3', cmd: 'formatBlock', val: 'h3' },
      { label: 'P', title: '正文', cmd: 'formatBlock', val: 'p' },
    ],
    [
      { label: '•', title: '无序列表', cmd: 'insertUnorderedList' },
      { label: '1.', title: '有序列表', cmd: 'insertOrderedList' },
    ],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        borderBottom: '1px solid var(--border)', background: '#fff', flexWrap: 'wrap',
      }}>
        <button className="btn-icon" onClick={handleClose} style={{ fontSize: 18 }} title="返回">
          ←
        </button>
        <input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          style={{
            border: 'none', fontSize: 16, fontWeight: 600, outline: 'none',
            background: 'transparent', minWidth: 120, color: 'var(--text)',
          }}
          placeholder="文档名称"
        />
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          {saved ? '✓ 已保存' : '保存'}
        </button>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 4, padding: '8px 20px', alignItems: 'center',
        borderBottom: '1px solid var(--border)', background: '#fafafa', flexWrap: 'wrap',
      }}>
        {toolbarGroups.map((group, gi) => (
          <span key={gi} style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            {gi > 0 && <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px' }} />}
            {group.map((btn) => (
              <button
                key={btn.cmd + (btn.val || '')}
                title={btn.title}
                onClick={() => execCmd(btn.cmd, btn.val)}
                style={{
                  width: 32, height: 30, border: 'none', borderRadius: 6,
                  background: 'transparent', cursor: 'pointer', fontSize: 13,
                  fontWeight: btn.style === 'italic' ? 400 : btn.label.length > 2 ? 600 : 500,
                  fontStyle: btn.style === 'italic' ? 'italic' : 'normal',
                  color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: btn.label.length > 2 ? 'inherit' : 'Georgia, serif',
                }}
                onMouseOver={(e) => { (e.target as HTMLElement).style.background = '#e8e8ed' }}
                onMouseOut={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
              >
                {btn.label}
              </button>
            ))}
          </span>
        ))}
        <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 6px' }} />
        <button
          title="插入表格"
          onClick={handleInsertTable}
          style={{
            height: 30, border: 'none', borderRadius: 6, background: 'transparent',
            cursor: 'pointer', fontSize: 13, color: 'var(--text)', padding: '0 8px',
          }}
          onMouseOver={(e) => { (e.target as HTMLElement).style.background = '#e8e8ed' }}
          onMouseOut={(e) => { (e.target as HTMLElement).style.background = 'transparent' }}
        >
          📊 表格
        </button>
      </div>

      {/* Editor */}
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px', background: '#f5f5f7' }}>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          style={{
            maxWidth: 800, margin: '0 auto', minHeight: '100%',
            background: '#fff', padding: '40px 48px', borderRadius: 8,
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)', outline: 'none',
            fontSize: 15, lineHeight: 1.8, color: 'var(--text)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
          data-placeholder="开始输入内容..."
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault()
              execCmd('insertHTML', '&emsp;&emsp;')
            }
          }}
        />
      </div>

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: #c0c0c0;
          pointer-events: none;
        }
        [contenteditable] h1 { font-size: 24px; font-weight: 700; margin: 16px 0 8px; }
        [contenteditable] h2 { font-size: 20px; font-weight: 600; margin: 14px 0 6px; }
        [contenteditable] h3 { font-size: 17px; font-weight: 600; margin: 12px 0 6px; }
        [contenteditable] p { margin: 4px 0; }
        [contenteditable] ul, [contenteditable] ol { padding-left: 24px; margin: 8px 0; }
        [contenteditable] table { margin: 12px 0; }
        [contenteditable] td, [contenteditable] th { padding: 6px 12px; min-width: 60px; }
      `}</style>
    </div>
  )
}
