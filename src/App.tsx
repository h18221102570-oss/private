import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import ProjectList from './components/ProjectList'
import ProjectDetail from './components/ProjectDetail'
import DocumentManager from './components/DocumentManager'
import SearchView from './components/SearchView'
import RecycleBin from './components/RecycleBin'
import Login from './components/Login'
import FlowChart from './components/FlowChart'
import Tasks from './components/Tasks'
import AIChat from './components/AIChat'
import Members from './components/Members'
import MaterialInspection from './components/MaterialInspection'
import DocEditor from './components/DocEditor'
import UniverSheet from './components/UniverSheet'
import DocumentCreator from './components/DocumentCreator'
import SmartFileOrganizer from './components/SmartFileOrganizer'
import AdminManager from './components/AdminManager'

function SplashScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f5f5f7',
      animation: 'splashFadeIn 0.4s ease',
    }}>
      <svg width="96" height="96" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="sBgGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#007AFF"/>
            <stop offset="100%" stopColor="#5856D6"/>
          </linearGradient>
          <linearGradient id="sFoldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4DA3FF"/>
            <stop offset="100%" stopColor="#7B79F7"/>
          </linearGradient>
        </defs>
        <rect x="32" y="32" width="448" height="448" rx="96" fill="url(#sBgGrad)"/>
        <rect x="136" y="120" width="260" height="280" rx="24" fill="white" opacity="0.95"/>
        <path d="M316 120L316 184C316 192 324 200 332 200H396L316 120Z" fill="url(#sFoldGrad)" opacity="0.85"/>
        <rect x="168" y="236" width="140" height="14" rx="7" fill="#007AFF" opacity="0.3"/>
        <rect x="168" y="268" width="180" height="14" rx="7" fill="#007AFF" opacity="0.2"/>
        <rect x="168" y="300" width="120" height="14" rx="7" fill="#007AFF" opacity="0.15"/>
        <rect x="168" y="332" width="90" height="14" rx="7" fill="#007AFF" opacity="0.1"/>
        <circle cx="358" cy="370" r="44" fill="#007AFF"/>
        <circle cx="358" cy="370" r="24" fill="white"/>
        <g fill="#007AFF">
          <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(0 358 370)"/>
          <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(45 358 370)"/>
          <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(90 358 370)"/>
          <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(135 358 370)"/>
          <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(180 358 370)"/>
          <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(225 358 370)"/>
          <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(270 358 370)"/>
          <rect x="352" y="314" width="12" height="20" rx="6" transform="rotate(315 358 370)"/>
        </g>
      </svg>
      <h1 style={{
        marginTop: 24,
        fontSize: 28,
        fontWeight: 700,
        color: '#1d1d1f',
        letterSpacing: '-0.02em',
      }}>
        筑迹
      </h1>
      <p style={{
        marginTop: 8,
        fontSize: 16,
        color: '#86868b',
        fontWeight: 500,
      }}>
        工程项目全生命周期管理
      </p>
      <p style={{
        marginTop: 28,
        fontSize: 14,
        color: '#1d1d1f',
        fontWeight: 500,
        letterSpacing: '0.04em',
      }}>
        DESIGN BY 黄康杰
      </p>
    </div>
  )
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true)

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<ProjectList />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/documents" element={<DocumentManager />} />
            <Route path="/search" element={<SearchView />} />
            <Route path="/flowchart" element={<FlowChart />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/members" element={<Members />} />
            <Route path="/inspection" element={<MaterialInspection />} />
            <Route path="/doc-editor" element={<DocEditor />} />
            <Route path="/sheet-editor" element={<UniverSheet />} />
            <Route path="/doc-creator" element={<DocumentCreator />} />
            <Route path="/file-organizer" element={<SmartFileOrganizer />} />
            <Route path="/ai" element={<AIChat />} />
            <Route path="/trash" element={<RecycleBin />} />
            <Route path="/admin-accounts" element={<AdminManager />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}
