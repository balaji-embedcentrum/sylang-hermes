import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  Delete01Icon,
  Download01Icon,
  File01Icon,
  Folder01Icon,
  GitBranchIcon,
  Image01Icon,
  Pen01Icon,
  PlusSignIcon,
  RefreshIcon,
  Upload01Icon,
} from '@hugeicons/core-free-icons'
import FilePreviewDialog from './file-preview-dialog'
import { cn } from '@/lib/utils'
import {
  ScrollAreaCorner,
  ScrollAreaRoot,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from '@/components/ui/scroll-area'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export type FileEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: Array<FileEntry>
}

type FileExplorerSidebarProps = {
  collapsed: boolean
  onToggle: () => void
  onInsertReference: (reference: string) => void
  onOpenFile?: (entry: FileEntry) => void
  selectedPath?: string
  initialPath?: string
  hidden?: boolean
  className?: string
}

type ContextMenuState = {
  x: number
  y: number
  entry: FileEntry
}

type PromptState = {
  mode: 'rename' | 'new-file' | 'new-folder'
  targetPath: string
  defaultValue?: string
}

const ROOT_LABEL = 'Workspace'

function isImageFile(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)
}

function getFileIcon(entry: FileEntry) {
  if (entry.type === 'folder') return Folder01Icon
  if (isImageFile(entry.name)) return Image01Icon
  return File01Icon
}

function normalizePath(pathValue: string) {
  return pathValue.replace(/\\/g, '/')
}

function getParentPath(pathValue: string) {
  const normalized = normalizePath(pathValue)
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

function buildReference(pathValue: string) {
  const normalized = normalizePath(pathValue)
  return `See file: workspace/${normalized}`
}

async function fetchFileTree(rootPath = ''): Promise<Array<FileEntry>> {
  const url = rootPath
    ? `/api/files?action=list&path=${encodeURIComponent(rootPath)}`
    : '/api/files?action=list'
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to load files')
  const data = (await res.json()) as { entries?: Array<FileEntry> }
  return Array.isArray(data.entries) ? data.entries : []
}

function filterTree(entries: Array<FileEntry>, term: string): Array<FileEntry> {
  if (!term.trim()) return entries
  const lower = term.toLowerCase()
  const filterEntry = (entry: FileEntry): FileEntry | null => {
    if (entry.type === 'file') {
      return entry.name.toLowerCase().includes(lower) ? entry : null
    }
    const children = (entry.children || [])
      .map(filterEntry)
      .filter((child): child is FileEntry => child !== null)
    if (entry.name.toLowerCase().includes(lower) || children.length > 0) {
      return { ...entry, children }
    }
    return null
  }

  return entries
    .map(filterEntry)
    .filter((entry): entry is FileEntry => entry !== null)
}

export function FileExplorerSidebar({
  collapsed,
  onToggle,
  onInsertReference,
  onOpenFile,
  selectedPath = '',
  initialPath = '',
  hidden = false,
  className,
}: FileExplorerSidebarProps) {
  const [entries, setEntries] = useState<Array<FileEntry>>([])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(() => new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [promptState, setPromptState] = useState<PromptState | null>(null)
  const [promptValue, setPromptValue] = useState('')
  const [previewPath, setPreviewPath] = useState<string | null>(null)
  const uploadTargetRef = useRef<string>('')
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const nextEntries = await fetchFileTree(initialPath)
      setEntries(nextEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [initialPath])

  const gitPull = useCallback(async () => {
    if (!initialPath || syncing) return
    setSyncing(true)
    try {
      const res = await fetch(
        `/api/files?action=git-pull&path=${encodeURIComponent(initialPath)}`,
      )
      const data = (await res.json()) as { ok: boolean; error?: string }
      if (!data.ok) throw new Error(data.error || 'git pull failed')
      await refresh()
    } catch (err) {
      console.error('[git pull]', err)
    } finally {
      setSyncing(false)
    }
  }, [initialPath, syncing, refresh])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = () => setContextMenu(null)
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null)
    }
    window.addEventListener('click', handleClick)
    window.addEventListener('contextmenu', handleClick)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', handleClick)
      window.removeEventListener('contextmenu', handleClick)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu])

  const filteredEntries = useMemo(
    () => filterTree(entries, search),
    [entries, search],
  )

  const isSearchActive = search.trim().length > 0

  function setChildrenInTree(tree: Array<FileEntry>, targetPath: string, children: Array<FileEntry>): Array<FileEntry> {
    return tree.map((entry) => {
      if (entry.path === targetPath) return { ...entry, children }
      if (entry.children) return { ...entry, children: setChildrenInTree(entry.children, targetPath, children) }
      return entry
    })
  }

  const toggleFolder = useCallback((pathValue: string, childrenLoaded: boolean) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(pathValue)) { next.delete(pathValue); return next }
      next.add(pathValue)
      return next
    })
    // Lazy-load children if not yet fetched
    if (!childrenLoaded) {
      setLoadingFolders((prev) => new Set(prev).add(pathValue))
      fetchFileTree(pathValue).then((children) => {
        setEntries((prev) => setChildrenInTree(prev, pathValue, children))
        setLoadingFolders((prev) => { const next = new Set(prev); next.delete(pathValue); return next })
      }).catch(() => {
        setLoadingFolders((prev) => { const next = new Set(prev); next.delete(pathValue); return next })
      })
    }
  }, [])

  const openPrompt = useCallback((state: PromptState) => {
    setPromptState(state)
    setPromptValue(state.defaultValue || '')
  }, [])

  const handleRename = useCallback(
    (entry: FileEntry) => {
      openPrompt({
        mode: 'rename',
        targetPath: entry.path,
        defaultValue: entry.name,
      })
    },
    [openPrompt],
  )

  const handleNewFile = useCallback(
    (entry: FileEntry) => {
      openPrompt({ mode: 'new-file', targetPath: entry.path })
    },
    [openPrompt],
  )

  const handleNewFolder = useCallback(
    (entry: FileEntry) => {
      openPrompt({ mode: 'new-folder', targetPath: entry.path })
    },
    [openPrompt],
  )

  const handleDelete = useCallback(
    async (entry: FileEntry) => {
      if (!window.confirm(`Move ${entry.name} to trash?`)) return
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'delete', path: entry.path }),
      })
      await refresh()
    },
    [refresh],
  )

  const handleDownload = useCallback(async (entry: FileEntry) => {
    const res = await fetch(
      `/api/files?action=download&path=${encodeURIComponent(entry.path)}`,
    )
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = entry.name
    anchor.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleUploadClick = useCallback((targetPath: string) => {
    uploadTargetRef.current = targetPath
    uploadInputRef.current?.click()
  }, [])

  const handleUploadChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || [])
      if (files.length === 0) return
      for (const file of files) {
        const form = new FormData()
        form.append('action', 'upload')
        let uploadPath = uploadTargetRef.current || ''
        if (initialPath && !uploadPath.startsWith(initialPath)) {
          uploadPath = uploadPath ? `${initialPath}/${uploadPath}` : initialPath
        }
        form.append('path', uploadPath)
        form.append('file', file)
        await fetch('/api/files', { method: 'POST', body: form })
      }
      event.target.value = ''
      await refresh()
    },
    [refresh],
  )

  const handlePromptSubmit = useCallback(async () => {
    if (!promptState) return
    const value = promptValue.trim()
    if (!value) return

    try {
    if (promptState.mode === 'rename') {
      const parent = getParentPath(promptState.targetPath)
      const nextPath = parent ? `${parent}/${value}` : value
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          from: promptState.targetPath,
          to: nextPath,
        }),
      })
    } else if (promptState.mode === 'new-folder') {
      let nextPath = promptState.targetPath
        ? `${promptState.targetPath}/${value}`
        : value
      if (initialPath && !nextPath.startsWith(initialPath)) {
        nextPath = `${initialPath}/${nextPath}`
      }
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'mkdir', path: nextPath }),
      })
    } else {
      // For new file: prepend initialPath if targetPath is empty (root of workspace)
      let nextPath = promptState.targetPath
        ? `${promptState.targetPath}/${value}`
        : value
      // Ensure the path includes the workspace prefix for remote mode
      if (initialPath && !nextPath.startsWith(initialPath)) {
        nextPath = `${initialPath}/${nextPath}`
      }
      const res = await fetch('/api/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'write', path: nextPath, content: '' }),
      })
      if (!res.ok) console.error('[file-explorer] Create file failed:', await res.text())
    }
    } catch (e) {
      console.error('[file-explorer] Prompt submit error:', e)
    }

    setPromptState(null)
    setPromptValue('')
    await refresh()
  }, [promptState, promptValue, refresh, initialPath])

  const handleFileClick = useCallback(
    (entry: FileEntry) => {
      if (entry.type === 'folder') {
        toggleFolder(entry.path, entry.children !== undefined)
        return
      }
      if (onOpenFile) {
        onOpenFile(entry)
      } else {
        onInsertReference(buildReference(entry.path))
        setPreviewPath(entry.path)
      }
    },
    [onInsertReference, onOpenFile, toggleFolder],
  )

  const renderEntry = useCallback(
    (entry: FileEntry, depth: number) => {
      const Icon = getFileIcon(entry)
      const isExpanded = isSearchActive ? true : expanded.has(entry.path)
      const isSelected = selectedPath && entry.path === selectedPath
      const padding = 12 + depth * 14

      return (
        <div key={entry.path}>
          <button
            type="button"
            onClick={() => handleFileClick(entry)}
            onContextMenu={(event) => {
              event.preventDefault()
              setContextMenu({
                x: event.clientX,
                y: event.clientY,
                entry,
              })
            }}
            className={cn(
              'group flex w-full items-center gap-2 rounded-md py-1.5 text-left text-sm text-primary-900',
              isSelected
                ? 'bg-accent-500/15 text-accent-700 font-medium'
                : 'hover:bg-primary-200',
            )}
            style={{ paddingLeft: padding }}
          >
            {entry.type === 'folder' ? (
              <span
                className={cn(
                  'transition-transform',
                  isExpanded ? 'rotate-90' : 'rotate-0',
                )}
              >
                <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
              </span>
            ) : (
              <span className="w-4" />
            )}
            <HugeiconsIcon icon={Icon} size={18} strokeWidth={1.6} />
            <span className="truncate">{entry.name}</span>
          </button>
          {entry.type === 'folder' && isExpanded ? (
            loadingFolders.has(entry.path) ? (
              <div style={{ paddingLeft: padding + 14 }} className="py-1 text-xs text-primary-400">Loading…</div>
            ) : entry.children?.length ? (
              <div>
                {entry.children.map((child) => renderEntry(child, depth + 1))}
              </div>
            ) : entry.children ? (
              <div style={{ paddingLeft: padding + 14 }} className="py-1 text-xs text-primary-400">Empty folder</div>
            ) : null
          ) : null}
        </div>
      )
    },
    [expanded, loadingFolders, handleFileClick, isSearchActive, selectedPath, setContextMenu],
  )

  // Resizable sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const isDraggingSidebar = useRef(false)

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDraggingSidebar.current = true
    const startX = e.clientX
    const startW = sidebarWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (ev: MouseEvent) => {
      if (!isDraggingSidebar.current) return
      const newW = Math.min(500, Math.max(180, startW + (ev.clientX - startX)))
      setSidebarWidth(newW)
    }
    const onUp = () => {
      isDraggingSidebar.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  if (hidden) return null

  return (
    <aside
      className={cn(
        'border-r border-primary-200 bg-primary-100 h-full flex flex-col relative',
        collapsed
          ? 'w-0 opacity-0 pointer-events-none'
          : 'opacity-100',
        className,
      )}
      style={collapsed ? undefined : { width: sidebarWidth }}
    >
      {/* Resize handle — right edge */}
      {!collapsed && (
        <div
          onMouseDown={handleSidebarResizeStart}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-[var(--theme-accent)] transition-colors"
        />
      )}
      <div className="flex items-center justify-between h-12 px-3 border-b border-primary-200">
        <div className="text-sm font-semibold text-primary-900">
          {ROOT_LABEL}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={refresh}
            title="Refresh"
          >
            <HugeiconsIcon icon={RefreshIcon} size={18} />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => handleUploadClick('')}
            title="Upload"
          >
            <HugeiconsIcon icon={Upload01Icon} size={18} />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => openPrompt({ mode: 'new-file', targetPath: '' })}
            title="New file"
          >
            <HugeiconsIcon icon={PlusSignIcon} size={18} />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search files"
          className="w-full rounded-md border border-primary-200 bg-primary-50 px-2 py-1 text-sm text-primary-900 placeholder:text-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </div>

      <ScrollAreaRoot className="flex-1 min-h-0">
        <ScrollAreaViewport className="px-1">
          {loading ? (
            <div className="px-3 py-2 text-xs text-primary-500">Loading…</div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl border border-primary-200 bg-primary-100/60">
                <HugeiconsIcon
                  icon={Folder01Icon}
                  size={20}
                  strokeWidth={1.5}
                  className="text-primary-500"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-800">
                  No workspace selected
                </p>
                <p className="mt-1 text-xs text-primary-500 text-pretty">
                  Select a folder to browse and edit files.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={refresh}
                className="mt-1"
              >
                <HugeiconsIcon icon={RefreshIcon} size={16} />
                Retry
              </Button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl border border-primary-200 bg-primary-100/60">
                <HugeiconsIcon
                  icon={Folder01Icon}
                  size={20}
                  strokeWidth={1.5}
                  className="text-primary-500"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-primary-800">
                  Workspace is empty
                </p>
                <p className="mt-1 text-xs text-primary-500 text-pretty">
                  Create files or upload content to get started.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    openPrompt({ mode: 'new-file', targetPath: '' })
                  }
                >
                  <HugeiconsIcon icon={PlusSignIcon} size={16} />
                  New file
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUploadClick('')}
                >
                  <HugeiconsIcon icon={Upload01Icon} size={16} />
                  Upload
                </Button>
              </div>
            </div>
          ) : (
            <div className="pb-4">
              {filteredEntries.map((entry) => renderEntry(entry, 0))}
            </div>
          )}
        </ScrollAreaViewport>
        <ScrollAreaScrollbar orientation="vertical">
          <ScrollAreaThumb />
        </ScrollAreaScrollbar>
        <ScrollAreaScrollbar orientation="horizontal">
          <ScrollAreaThumb />
        </ScrollAreaScrollbar>
        <ScrollAreaCorner />
      </ScrollAreaRoot>

      <input
        ref={uploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadChange}
      />

      {contextMenu ? (
        <div
          className="fixed z-50 min-w-[160px] rounded-lg bg-primary-50 p-1 text-sm text-primary-900 shadow-lg outline outline-primary-900/10"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100"
            onClick={() => {
              handleRename(contextMenu.entry)
              setContextMenu(null)
            }}
          >
            <HugeiconsIcon icon={Pen01Icon} size={16} /> Rename
          </button>
          {contextMenu.entry.type === 'folder' ? (
            <>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100"
                onClick={() => {
                  handleNewFile(contextMenu.entry)
                  setContextMenu(null)
                }}
              >
                <HugeiconsIcon icon={PlusSignIcon} size={16} /> New file
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100"
                onClick={() => {
                  handleNewFolder(contextMenu.entry)
                  setContextMenu(null)
                }}
              >
                <HugeiconsIcon icon={Folder01Icon} size={16} /> New folder
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100"
                onClick={() => {
                  handleUploadClick(contextMenu.entry.path)
                  setContextMenu(null)
                }}
              >
                <HugeiconsIcon icon={Upload01Icon} size={16} /> Upload
              </button>
            </>
          ) : (
            <button
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-primary-100"
              onClick={() => {
                void handleDownload(contextMenu.entry)
                setContextMenu(null)
              }}
            >
              <HugeiconsIcon icon={Download01Icon} size={16} /> Download
            </button>
          )}
          <button
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-red-700 hover:bg-red-50/80"
            onClick={() => {
              void handleDelete(contextMenu.entry)
              setContextMenu(null)
            }}
          >
            <HugeiconsIcon icon={Delete01Icon} size={16} /> Delete
          </button>
        </div>
      ) : null}

      <DialogRoot
        open={Boolean(promptState)}
        onOpenChange={(open) => {
          if (!open) setPromptState(null)
        }}
      >
        <DialogContent>
          <div className="p-5 space-y-3">
            <DialogTitle>
              {promptState?.mode === 'rename'
                ? 'Rename'
                : promptState?.mode === 'new-folder'
                  ? 'New Folder'
                  : 'New File'}
            </DialogTitle>
            <DialogDescription>
              {promptState?.mode === 'rename'
                ? 'Enter a new name.'
                : 'Enter a name to create.'}
            </DialogDescription>
            <input
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              className="w-full rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-2">
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button onClick={handlePromptSubmit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </DialogRoot>

      <FilePreviewDialog
        path={previewPath}
        onClose={() => setPreviewPath(null)}
        onSaved={refresh}
      />

      <button
        type="button"
        onClick={onToggle}
        className="sr-only"
        aria-label="Toggle file explorer"
      />
    </aside>
  )
}
