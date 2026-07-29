import { useState, useCallback, useRef, useEffect } from 'react'

interface Props {
  initialData?: string[][]  // 2D array of cell values
  initialFileName?: string
  onSave?: (fileName: string, data: string[][]) => void
  onClose?: () => void
}

const COLS = 26
const ROWS = 50
const COL_WIDTH = 100
const ROW_HEIGHT = 32

function colLabel(n: number): string {
  let s = ''
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

export default function SheetEditor({ initialData, initialFileName = '', onSave, onClose }: Props) {
  const [fileName, setFileName] = useState(initialFileName || '新建表格')
  const [data, setData] = useState<string[][]>(() => {
    if (initialData && initialData.length > 0) return initialData
    return Array.from({ length: ROWS }, () => Array(COLS).fill(''))
  })
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [saved, setSaved] = useState(false)
  const [colWidths, setColWidths] = useState<number[]>(Array(COLS).fill(COL_WIDTH))
  const inputRef = useRef<HTMLInputElement>(null)

  // Handle cell selection
  const selectCell = useCallback((row: number, col: number) => {
    setSelected({ row, col })
    setEditValue(data[row]?.[col] || '')
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [data])

  // Handle cell edit commit
  const commitEdit = useCallback(() => {
    if (!selected) return
    setData((prev) => {
      const next = prev.map((r) => [...r])
      if (!next[selected.row]) next[selected.row] = Array(COLS).fill('')
      next[selected.row][selected.col] = editValue
      return next
    })
  }, [selected, editValue])

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (!selected) return
      const { row, col } = selected
      if (e.key === 'ArrowUp' && row > 0) {
        e.preventDefault(); selectCell(row - 1, col)
      } else if (e.key === 'ArrowDown' && row < ROWS - 1) {
        e.preventDefault(); selectCell(row + 1, col)
      } else if (e.key === 'ArrowLeft' && col > 0) {
        e.preventDefault(); selectCell(row, col - 1)
      } else if (e.key === 'ArrowRight' && col < COLS - 1) {
        e.preventDefault(); selectCell(row, col + 1)
      } else if (e.key === 'Enter') {
        e.preventDefault(); commitEdit()
        if (row < ROWS - 1) selectCell(row + 1, col)
      } else if (e.key === 'Tab') {
        e.preventDefault(); commitEdit()
        if (col < COLS - 1) selectCell(row, col + 1)
      } else if (e.key === 'Escape') {
        setSelected(null)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [selected, selectCell, commitEdit])

  function handleSave() {
    // Trim trailing empty rows
    let lastRow = data.length - 1
    while (lastRow >= 0 && data[lastRow].every((c) => !c)) lastRow--
    const trimmed = data.slice(0, lastRow + 1)

    if (onSave) {
      onSave(fileName, trimmed)
    } else {
      // Download as CSV
      const csv = trimmed.map((row) =>
        row.map((c) => {
          if (c.includes(',') || c.includes('"') || c.includes('\n')) {
            return '"' + c.replace(/"/g, '""') + '"'
          }
          return c
        }).join(',')
      ).join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName + '.csv'
      a.click()
      URL.revokeObjectURL(url)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleColResize(colIdx: number, e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = colWidths[colIdx]
    function onMove(ev: MouseEvent) {
      setColWidths((prev) => {
        const next = [...prev]
        next[colIdx] = Math.max(50, startW + (ev.clientX - startX))
        return next
      })
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        borderBottom: '1px solid var(--border)', background: '#fff',
      }}>
        <button className="btn-icon" onClick={onClose} style={{ fontSize: 18 }} title="返回">
          ←
        </button>
        <input
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          style={{
            border: 'none', fontSize: 16, fontWeight: 600, outline: 'none',
            background: 'transparent', minWidth: 120, color: 'var(--text)',
          }}
          placeholder="表格名称"
        />
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
          {selected ? `${colLabel(selected.col)}${selected.row + 1}` : '点击选择单元格'}
        </span>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          {saved ? '✓ 已保存' : '保存'}
        </button>
      </div>

      {/* Formula bar */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '6px 12px',
        borderBottom: '1px solid var(--border)', background: '#fafafa', gap: 8,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
          minWidth: 50, textAlign: 'center', padding: '2px 6px',
          background: '#e8e8ed', borderRadius: 4,
        }}>
          {selected ? colLabel(selected.col) + (selected.row + 1) : ''}
        </span>
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          style={{
            flex: 1, border: '1px solid var(--border)', borderRadius: 4,
            padding: '4px 8px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
          }}
          placeholder="输入内容..."
        />
      </div>

      {/* Spreadsheet */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{
                width: 50, height: ROW_HEIGHT, background: '#f0f0f0',
                border: '1px solid var(--border)', position: 'sticky', top: 0, left: 0, zIndex: 3,
                fontSize: 12, color: 'var(--text-light)',
              }} />
              {Array.from({ length: COLS }, (_, c) => (
                <th key={c} style={{
                  width: colWidths[c], height: ROW_HEIGHT, background: '#f0f0f0',
                  border: '1px solid var(--border)', position: 'sticky', top: 0,
                  fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
                  userSelect: 'none',
                }}>
                  {colLabel(c)}
                  <div
                    onMouseDown={(e) => handleColResize(c, e)}
                    style={{
                      position: 'absolute', right: 0, top: 0, bottom: 0, width: 5,
                      cursor: 'col-resize',
                    }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, r) => (
              <tr key={r}>
                <td style={{
                  width: 50, height: ROW_HEIGHT, background: '#f0f0f0',
                  border: '1px solid var(--border)', textAlign: 'center',
                  fontSize: 12, color: 'var(--text-light)', position: 'sticky', left: 0,
                  userSelect: 'none',
                }}>
                  {r + 1}
                </td>
                {row.map((cell, c) => {
                  const isSel = selected?.row === r && selected?.col === c
                  return (
                    <td
                      key={c}
                      onClick={() => selectCell(r, c)}
                      style={{
                        width: colWidths[c], height: ROW_HEIGHT,
                        border: `2px solid ${isSel ? 'var(--primary)' : 'var(--border)'}`,
                        padding: '2px 6px', fontSize: 13, cursor: 'cell',
                        background: isSel ? 'var(--primary-bg)' : '#fff',
                        overflow: 'hidden', whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis', position: 'relative',
                      }}
                    >
                      {isSel ? null : cell}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export { COL_WIDTH, ROW_HEIGHT, COLS, ROWS }
