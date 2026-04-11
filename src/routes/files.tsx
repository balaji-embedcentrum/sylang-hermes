import { useCallback, useEffect, useState } from 'react'
import { Editor } from '@monaco-editor/react'
import { createFileRoute } from '@tanstack/react-router'
import { usePageTitle } from '@/hooks/use-page-title'
import { FileExplorerSidebar, type FileEntry } from '@/components/file-explorer'
import { resolveTheme, useSettings } from '@/hooks/use-settings'
import {
  SylangFileEditor,
  isSylangFile,
} from '@/components/sylang-editor/SylangFileEditor'

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
}

function FilesRoute() {
  usePageTitle('Files')
  const { settings } = useSettings()
  const { path: initialPath } = Route.useSearch()
  const [isMobile, setIsMobile] = useState(false)
  const [fileExplorerCollapsed, setFileExplorerCollapsed] = useState(false)
  const [editorValue, setEditorValue] = useState(INITIAL_EDITOR_VALUE)
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const resolvedTheme = resolveTheme(settings.theme)

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
      setSelectedFile({ path: targetPath, name, ext })
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
            />
          ) : (
            <>
              <header className="border-b border-primary-200 px-3 py-2 md:px-4 md:py-3">
                <h1 className="text-base font-medium text-balance md:text-lg">
                  {selectedFile
                    ? selectedFile.name
                    : initialPath
                      ? initialPath.split('/').slice(1).join('/')
                      : 'Files'}
                </h1>
                {!selectedFile && (
                  <p className="hidden text-sm text-primary-600 text-pretty sm:block">
                    Explore your workspace and draft notes in the editor.
                  </p>
                )}
              </header>
              <div className="min-h-0 flex-1 pb-24 md:pb-0">
                <Editor
                  height="100%"
                  theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
                  language={selectedFile ? guessLanguage(selectedFile.ext) : 'typescript'}
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
          )}
        </main>
      </div>
    </div>
  )
}
