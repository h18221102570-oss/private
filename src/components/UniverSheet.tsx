import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createUniver, defaultTheme, LocaleType, merge } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core'
import UniverPresetSheetsCoreZhCN from '@univerjs/presets/preset-sheets-core/locales/zh-CN'
import '@univerjs/presets/lib/styles/preset-sheets-core.css'

interface Props {
  initialFileName?: string
  onSave?: (fileName: string) => void
  onClose?: () => void
}

let instanceCount = 0

export default function UniverSheet({ initialFileName = '新建表格', onSave, onClose }: Props) {
  const navigate = useNavigate()
  const containerId = useRef(`univer-container-${++instanceCount}`)
  const [fileName, setFileName] = useState(initialFileName)
  const [saved, setSaved] = useState(false)
  const [ready, setReady] = useState(false)
  const univerAPI = useRef<any>(null)

  function handleClose() {
    if (onClose) onClose()
    else navigate(-1)
  }

  useEffect(() => {
    const id = containerId.current
    let disposed = false

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (disposed) return
      try {
        const result = createUniver({
          locale: LocaleType.ZH_CN,
          locales: {
            [LocaleType.ZH_CN]: merge({}, UniverPresetSheetsCoreZhCN),
          },
          theme: defaultTheme,
          presets: [
            UniverSheetsCorePreset({
              container: id,
            }),
          ],
        })
        if (!disposed) {
          univerAPI.current = result.univerAPI
          result.univerAPI.createWorkbook({ name: fileName })
          setReady(true)
        }
      } catch (e) {
        console.error('Univer init error:', e)
      }
    }, 100)

    return () => {
      disposed = true
      clearTimeout(timer)
      // Univer handles its own cleanup through dispose
    }
  }, [])

  function handleSave() {
    if (univerAPI.current) {
      try {
        const workbook = univerAPI.current.getActiveWorkbook()
        if (workbook) {
          const sheet = workbook.getActiveSheet()
          if (sheet) {
            const maxRow = sheet.getMaxRows() || 100
            const maxCol = sheet.getMaxColumns() || 26
            const range = sheet.getRange(0, 0, maxRow, maxCol)
            const values = range.getValues()
            if (values && values.length) {
              const csvRows: string[] = []
              for (const row of values) {
                if (!row || row.every((c: any) => c == null || c === '')) continue
                csvRows.push(row.map((cell: any) => {
                  const v = cell ?? ''
                  const s = String(v)
                  if (s.includes(',') || s.includes('"') || s.includes('\n'))
                    return '"' + s.replace(/"/g, '""') + '"'
                  return s
                }).join(','))
              }
              if (csvRows.length > 0) {
                const csv = csvRows.join('\n')
                const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
                const a = document.createElement('a')
                a.href = URL.createObjectURL(blob)
                a.download = fileName + '.csv'
                a.click()
                URL.revokeObjectURL(a.href)
              }
            }
          }
        }
      } catch (e) {
        console.error('Save error:', e)
      }
    }
    if (onSave) onSave(fileName)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
        borderBottom: '1px solid var(--border)', background: '#fff',
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
          placeholder="表格名称"
        />
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          {saved ? '✓ 已保存' : '保存为 CSV'}
        </button>
      </div>
      {!ready && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-light)' }}>
          正在加载电子表格引擎...
        </div>
      )}
      <div id={containerId.current} style={{ flex: 1, overflow: 'hidden', display: ready ? 'block' : 'none' }} />
    </div>
  )
}
