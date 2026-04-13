import { useCallback, useEffect, useState } from 'react'
import { Editor } from '@monaco-editor/react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { FileExplorerSidebar, type FileEntry } from '@/components/file-explorer'
import { resolveTheme, useSettings } from '@/hooks/use-settings'
import {
  SylangFileEditor,
  isSylangFile,
} from '@/components/sylang-editor/SylangFileEditor'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { NestMenuBar } from '@/components/sylang-editor/nest-menu-bar'

const INITIAL_EDITOR_VALUE = `// Files workspace
// Use the file tree on the left to browse and manage project files.
// "Insert as reference" actions appear here for quick context snippets.

function note() {
  return 'Ready to explore files.'
}
`

export const Route = createFileRoute('/files')({
  validateSearch: (search: Record<string, unknown>) => ({
    path: typeof search.path === 'string' ? search.path : '',
  }),
  component: FilesRoute,
  errorComponent: function FilesError({ error }) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-primary-50">
        <h2 className="text-xl font-semibold text-primary-900 mb-3">
          Failed to Load Files
        </h2>
        <p className="text-sm text-primary-600 mb-4 max-w-md">
          {error instanceof Error
            ? error.message
            : 'An unexpected error occurred'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 transition-colors"
        >
          Reload Page
        </button>
      </div>
    )
  },
  pendingComponent: function FilesPending() {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-accent-500 border-r-transparent mb-3" />
          <p className="text-sm text-primary-500">Loading file explorer...</p>
        </div>
      </div>
    )
  },
})

function guessLanguage(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'typescript',
    '.js': 'javascript', '.jsx': 'javascript',
    '.json': 'json', '.md': 'markdown',
    '.css': 'css', '.html': 'html',
    '.py': 'python', '.rs': 'rust',
    '.go': 'go', '.yaml': 'yaml', '.yml': 'yaml',
    '.sh': 'shell', '.c': 'c', '.cpp': 'cpp',
  }
  return map[ext] ?? 'plaintext'
}

type SelectedFile = {
  path: string
  name: string
  ext: string
  focusSymbolId?: string
}

function FilesRoute() {
  usePageTitle('Files')
  const { settings } = useSettings()
  const { path: initialPath } = Route.useSearch()
  const [isMobile, setIsMobile] = useState(false)
  const [fileExplorerCollapsed, setFileExplorerCollapsed] = useState(false)
  const [editorValue, setEditorValue] = useState(INITIAL_EDITOR_VALUE)
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const [activeView, setActiveView] = useState<string | null>(null) // null = editor, 'coverage' | 'traceability' | 'git-history' | etc.
  const resolvedTheme = resolveTheme(settings.theme)
  const setActiveWorkspacePath = useWorkspaceStore((s) => s.setActiveWorkspacePath)

  // Track workspace root so the chat agent works in the right directory
  useEffect(() => {
    if (initialPath) {
      setActiveWorkspacePath(initialPath)
    }
  }, [initialPath, setActiveWorkspacePath])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!isMobile) return
    setFileExplorerCollapsed(true)
  }, [isMobile])

  // Handle navigation requests from the Sylang editor iframe (openSymbolById / openFile)
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const msg = event.data
      if (!msg || msg.type !== '__sylang_navigate') return
      const targetPath: string = msg.path ?? ''
      if (!targetPath) return
      const name = targetPath.split('/').pop() ?? targetPath
      const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
      setSelectedFile({ path: targetPath, name, ext, focusSymbolId: msg.symbolId ?? undefined })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const handleInsertReference = useCallback(function handleInsertReference(
    reference: string,
  ) {
    setEditorValue((prev) => `${prev}\n${reference}\n`)
  }, [])

  const handleOpenFile = useCallback(async (entry: FileEntry) => {
    const ext = entry.name.includes('.')
      ? entry.name.slice(entry.name.lastIndexOf('.'))
      : ''
    setSelectedFile({ path: entry.path, name: entry.name, ext })
    setActiveView(null) // return to editor when switching files
    if (!isSylangFile(entry.name)) {
      try {
        const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(entry.path)}`)
        if (res.ok) {
          const { content } = await res.json() as { content: string }
          setEditorValue(content)
        }
      } catch {
        // keep existing editor value
      }
    }
  }, [])

  return (
    <div className="h-full min-h-0 overflow-hidden bg-surface text-primary-900">
      <div className="flex h-full min-h-0 overflow-hidden">
        <FileExplorerSidebar
          collapsed={fileExplorerCollapsed}
          onToggle={function onToggleFileExplorer() {
            setFileExplorerCollapsed((prev) => !prev)
          }}
          onInsertReference={handleInsertReference}
          onOpenFile={handleOpenFile}
          selectedPath={selectedFile?.path ?? ''}
          initialPath={initialPath || ''}
        />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {selectedFile && isSylangFile(selectedFile.name) ? (
            <SylangFileEditor
              filePath={selectedFile.path}
              fileName={selectedFile.name}
              fileExtension={selectedFile.ext}
              focusSymbolId={selectedFile.focusSymbolId}
              activeView={activeView}
              onViewChange={setActiveView}
            />
          ) : selectedFile ? (
            <>
              <header className="border-b border-primary-200 px-3 py-2 md:px-4 md:py-3">
                <h1 className="text-base font-medium text-balance md:text-lg">
                  {selectedFile.name}
                </h1>
              </header>
              <div className="min-h-0 flex-1 pb-24 md:pb-0">
                <Editor
                  height="100%"
                  theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
                  language={guessLanguage(selectedFile.ext)}
                  value={editorValue}
                  onChange={function onEditorChange(value) {
                    setEditorValue(value || '')
                  }}
                  options={{
                    minimap: { enabled: settings.editorMinimap },
                    fontSize: settings.editorFontSize,
                    scrollBeyondLastLine: false,
                    wordWrap: settings.editorWordWrap ? 'on' : 'off',
                  }}
                />
              </div>
            </>
          ) : (
            <>
              {/* Header with Sylang branding + menus on home page */}
              <div
                className="flex items-center gap-3 px-4 py-1.5 border-b shrink-0"
                style={{ background: 'var(--theme-sidebar)', borderColor: 'var(--theme-border)' }}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <img src="/sylang-logo.svg" alt="" className="h-6 w-6 rounded-md" style={{ filter: 'invert(1) brightness(2)' }} />
                  <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--theme-accent)' }}>Sylang</span>
                </div>
                <div className="w-px h-5 shrink-0" style={{ background: 'var(--theme-border)' }} />
                <NestMenuBar workspacePath={initialPath} onViewChange={setActiveView} />
              </div>
              {activeView ? (
                <InlineViewHome view={activeView} workspace={initialPath} onClose={() => setActiveView(null)} />
              ) : (
                <WorkspaceHome workspacePath={initialPath} onViewChange={setActiveView} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}

// ─── Inline View (for home page) ────────────────────────────────────────────

import { Suspense, lazy } from 'react'

const CoverageView = lazy(() => import('@/components/sylang-editor/inline-views/coverage-view'))
const TraceabilityView = lazy(() => import('@/components/sylang-editor/inline-views/traceability-view'))
const GitHistoryView = lazy(() => import('@/components/sylang-editor/inline-views/git-history-view'))
const FmeaView = lazy(() => import('@/components/sylang-editor/inline-views/fmea-view'))

function InlineViewHome({ view, workspace, onClose }: { view: string; workspace: string; onClose: () => void }) {
  const ws = workspace.split('/').filter(Boolean).slice(0, 3).join('/')
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1 shrink-0" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <button onClick={onClose} className="text-xs px-2 py-0.5 rounded font-medium hover:bg-white/10" style={{ color: 'var(--theme-accent)' }}>
          ← Back to Home
        </button>
      </div>
      <div className={`flex-1 min-h-0 ${view === 'traceability' ? 'overflow-hidden' : 'overflow-y-auto'}`} style={{ background: 'var(--theme-bg)' }}>
        <Suspense fallback={<div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--theme-muted)' }}><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />Loading...</div>}>
          {view === 'coverage' && <CoverageView workspace={ws} />}
          {view === 'traceability' && <TraceabilityView workspace={ws} />}
          {view === 'git-history' && <GitHistoryView workspace={ws} />}
          {view === 'fmea' && <FmeaView workspace={ws} />}
          {!['coverage', 'traceability', 'git-history', 'fmea'].includes(view) && (
            <div className="flex items-center justify-center py-20 text-sm" style={{ color: 'var(--theme-muted)' }}>{view} — coming soon</div>
          )}
        </Suspense>
      </div>
    </div>
  )
}

// ─── Workspace Home ─────────────────────────────────────────────────────────

const FILE_TYPE_INFO = [
  { ext: '.req', label: 'Requirements', icon: '📋', desc: 'System & software requirements with traceability' },
  { ext: '.fun', label: 'Functions', icon: '⚙️', desc: 'Functional decomposition & function networks' },
  { ext: '.blk', label: 'Blocks', icon: '🧱', desc: 'Internal block diagrams & architecture' },
  { ext: '.fml', label: 'Feature Models', icon: '🌳', desc: 'Product line features & variability' },
  { ext: '.vml', label: 'Variants', icon: '🔀', desc: 'Variant configurations & selections' },
  { ext: '.flr', label: 'Failure Modes', icon: '⚠️', desc: 'FMEA failure analysis (AIAG/VDA)' },
  { ext: '.fta', label: 'Fault Trees', icon: '🌲', desc: 'Fault tree analysis (ISO 26262)' },
  { ext: '.tst', label: 'Test Cases', icon: '✅', desc: 'Verification & validation test specs' },
  { ext: '.haz', label: 'Hazards', icon: '🔴', desc: 'Hazard analysis & risk assessment' },
  { ext: '.ifc', label: 'Interfaces', icon: '🔌', desc: 'Signals, operations & data types' },
  { ext: '.smd', label: 'State Machines', icon: '🔄', desc: 'State machine diagrams' },
  { ext: '.ucd', label: 'Use Cases', icon: '👤', desc: 'Use case diagrams & actor mapping' },
]

const QUICK_ACTIONS = [
  { label: 'Coverage Analysis', viewKey: 'coverage', icon: '📊', desc: 'Analyze identifier relationships and coverage' },
  { label: 'Traceability Graph', viewKey: 'traceability', icon: '🔗', desc: 'Interactive cross-file relationship graph' },
  { label: 'FMEA AIAG/VDA', viewKey: 'fmea', icon: '⚠️', desc: 'Failure mode and effects analysis' },
  { label: 'ASPICE Workbench', viewKey: 'aspice', icon: '🏗️', desc: 'Automotive SPICE process assessment' },
]

function WorkspaceHome({ workspacePath, onViewChange }: { workspacePath: string; onViewChange?: (view: string) => void }) {
  const segments = workspacePath.split('/').filter(Boolean)
  const repoName = segments.length >= 3 ? segments[2] : segments.pop() ?? 'Workspace'
  const workspace = segments.slice(0, 3).join('/')

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--theme-bg)' }}>
      <div className="max-w-4xl mx-auto px-8 py-10">

        {/* Hero */}
        <div className="flex items-center gap-4 mb-10">
          <img src="/sylang-logo.svg" alt="" className="h-14 w-14 rounded-2xl shadow-lg" style={{ filter: 'invert(1) brightness(2)' }} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--theme-text)' }}>
              Sylang
            </h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--theme-muted)' }}>
              Model-Based Systems Engineering Workspace
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-muted)' }}>
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.path}
                onClick={() => onViewChange?.(action.viewKey)}
                className="rounded-xl px-4 py-4 text-left transition-all hover:scale-[1.02]"
                style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
              >
                <div className="text-2xl mb-2">{action.icon}</div>
                <div className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{action.label}</div>
                <div className="text-[11px] mt-1 leading-snug" style={{ color: 'var(--theme-muted)' }}>{action.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* File types guide */}
        <div className="mb-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--theme-muted)' }}>
            Sylang File Types
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {FILE_TYPE_INFO.map(ft => (
              <div
                key={ft.ext}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
              >
                <span className="text-lg shrink-0">{ft.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: 'var(--theme-text)' }}>{ft.label}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-card2)', color: 'var(--theme-accent)' }}>{ft.ext}</span>
                  </div>
                  <div className="text-[11px] mt-0.5 leading-snug" style={{ color: 'var(--theme-muted)' }}>{ft.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Standards */}
        <div className="rounded-xl px-5 py-4" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-lg">🛡️</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>Built for Safety-Critical Engineering</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--theme-muted)' }}>
            Sylang supports ISO 26262 functional safety, Automotive SPICE process compliance, FMEA AIAG/VDA failure analysis,
            and product line engineering (150% model). Select a file from the sidebar to start editing, or use the quick actions above
            to analyze your project.
          </p>
        </div>
      </div>
    </div>
  )
}
