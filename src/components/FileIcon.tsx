// 各文件类型对应的 SVG 图标，模仿原生文件图标样式
const WORD = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#2B579A" />
    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#185ABD" />
    <rect x="11" y="0.5" width="2" height="1.5" rx="0.5" fill="#fff" opacity="0.4" />
    <text x="5" y="11.5" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700" fontFamily="Arial">W</text>
  </svg>
)

const EXCEL = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#217346" />
    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#185C37" />
    <rect x="11" y="0.5" width="2" height="1.5" rx="0.5" fill="#fff" opacity="0.4" />
    <text x="5" y="11.5" textAnchor="middle" fill="#fff" fontSize="7" fontWeight="700" fontFamily="Arial">X</text>
  </svg>
)

const PDF = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#E74C3C" />
    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#C0392B" />
    <rect x="11" y="0.5" width="2" height="1.5" rx="0.5" fill="#fff" opacity="0.4" />
    <text x="4.5" y="7" textAnchor="middle" fill="#fff" fontSize="4.5" fontWeight="700" fontFamily="Arial">PDF</text>
  </svg>
)

const IMAGE = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#E67E22" />
    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#D35400" />
    <circle cx="10.5" cy="4" r="1.3" fill="#fff" opacity="0.5" />
    <path d="M13.5 12l-2-2.5L10 12l-1.5-2-2 3.5h7V12z" fill="#fff" opacity="0.5" />
  </svg>
)

const CAD = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#8E44AD" />
    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#6C3483" />
    <rect x="11" y="0.5" width="2" height="1.5" rx="0.5" fill="#fff" opacity="0.4" />
    <text x="4" y="11.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700" fontFamily="Arial">CAD</text>
  </svg>
)

const GENERIC = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#7F8C8D" />
    <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#616A6B" />
    <rect x="11" y="0.5" width="2" height="1.5" rx="0.5" fill="#fff" opacity="0.4" />
  </svg>
)

export function getFileTypeIcon(name: string, fileType?: string): JSX.Element {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (fileType && fileType.startsWith('image/')) return IMAGE
  if (fileType === 'application/pdf' || ext === 'pdf') return PDF
  if (fileType?.includes('word') || ext === 'docx' || ext === 'doc') return WORD
  if (fileType?.includes('excel') || fileType?.includes('spreadsheet') || ext === 'xlsx' || ext === 'xls') return EXCEL
  if (ext === 'dwg' || ext === 'dxf') return CAD
  if (/png|jpg|jpeg|gif|svg|webp|bmp/i.test(ext)) return IMAGE
  return GENERIC
}

const CAT_ICONS: Record<string, JSX.Element> = {
  drawing: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#007AFF" />
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#0062CC" />
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="Arial">CAD</text>
    </svg>
  ),
  contract: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#FF3B30" />
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#CC2F26" />
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700" fontFamily="Arial">DOC</text>
    </svg>
  ),
  report: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#34C759" />
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#28A745" />
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700" fontFamily="Arial">DOC</text>
    </svg>
  ),
  approval: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#FF9500" />
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#CC7700" />
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700" fontFamily="Arial">DOC</text>
    </svg>
  ),
  plan: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#AF52DE" />
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#8C42B2" />
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700" fontFamily="Arial">DOC</text>
    </svg>
  ),
  acceptance_doc: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#5AC8FA" />
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#48A0C8" />
      <text x="8" y="11.5" textAnchor="middle" fill="#fff" fontSize="6" fontWeight="700" fontFamily="Arial">DOC</text>
    </svg>
  ),
  other: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="0.5" width="12" height="15" rx="1.5" fill="#8E8E93" />
      <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h6V1H2z" fill="#717175" />
    </svg>
  ),
}

export function getCategoryIcon(cat: string): JSX.Element {
  return CAT_ICONS[cat] || CAT_ICONS.other
}
