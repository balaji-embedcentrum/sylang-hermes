'use client'

import { useEffect, useRef, useState } from 'react'
import { parseDSLToTiptap } from '../../sylang/parser/dslParser'
import { serializeToDSL } from '../../sylang/serializer/dslSerializer'

interface Props {
  /** Relative path from WORKSPACE_ROOT, e.g. "{userId}/owner/repo/src/system.req" */
  filePath: string
  fileName: string
  /** e.g. ".req", ".blk", ".agt" */
  fileExtension: string
}

export const SYLANG_EXTENSIONS = new Set([
  '.req', '.agt', '.blk', '.fml', '.fun', '.haz',
  '.ifc', '.itm', '.ple', '.sam', '.seq', '.sgl',
  '.smd', '.spec', '.spr', '.tst', '.ucd', '.vcf',
  '.vml', '.fta', '.flr', '.dash', '.extend',
])

export function isSylangFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.'))
  return SYLANG_EXTENSIONS.has(ext)
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | null

export function SylangFileEditor({ filePath, fileName, fileExtension }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null)
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Store parsed doc so the 'ready' handler can send it regardless of timing
  const pendingDoc = useRef<unknown>(null)

  const sendInit = (doc: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'init',
        document: doc,
        fileExtension,
        fileName,
        relativePath: filePath,
        colorPalette: 'teal',
        disabledBlockIds: [],
      },
      '*',
    )
  }

  // Load file → parse → store doc, send init if iframe already ready
  useEffect(() => {
    let cancelled = false
    pendingDoc.current = null

    async function loadAndInit() {
      setLoading(true)
      setError(null)
      try {
        const readRes = await fetch(
          `/api/files?action=read&path=${encodeURIComponent(filePath)}`,
        )
        if (!readRes.ok) throw new Error(`Cannot read file: HTTP ${readRes.status}`)
        const { content: dslText } = await readRes.json() as { content: string }

        const doc = parseDSLToTiptap(dslText, fileExtension)

        if (cancelled) return

        pendingDoc.current = doc
        setLoading(false)

        // If iframe is already loaded and ready, send now.
        // If not, the onLoad → probe → ready flow will pick it up.
        if (iframeRef.current?.contentWindow) {
          sendInit(doc)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      }
    }

    void loadAndInit()
    return () => { cancelled = true }
  }, [filePath, fileExtension, fileName])

  // Listen for messages from the webview iframe
  useEffect(() => {
    async function handleMessage(event: MessageEvent) {
      const msg = event.data
      if (!msg || typeof msg !== 'object') return

      switch (msg.type) {
        case 'ready':
          // iframe signalled ready — send the document if we have it
          if (pendingDoc.current) {
            sendInit(pendingDoc.current)
          }
          break

        case 'contentChange': {
          if (pendingSave.current) clearTimeout(pendingSave.current)
          setSaveStatus('unsaved')
          pendingSave.current = setTimeout(async () => {
            setSaveStatus('saving')
            try {
              const content = serializeToDSL(msg.document, fileExtension)
              await fetch('/api/files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'write', path: filePath, content }),
              })
              setSaveStatus('saved')
            } catch {
              setSaveStatus('unsaved')
            }
          }, 800)
          break
        }

        case 'getPropertySchema': {
          const { requestId } = msg
          iframeRef.current?.contentWindow?.postMessage(
            { requestId, ok: true, result: { schema: [] } },
            '*',
          )
          break
        }

        case 'getDiagram':
        case 'openSymbolById':
        case 'openFile':
        case 'openExternal':
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [filePath, fileExtension])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0 text-xs"
        style={{
          background: 'var(--theme-sidebar)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-muted)',
        }}
      >
        <span className="font-mono font-medium" style={{ color: 'var(--theme-text)' }}>
          {fileName}
        </span>
        <span>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && '✓ Saved'}
          {saveStatus === 'unsaved' && '● Unsaved'}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center flex-1 gap-3" style={{ color: 'var(--theme-muted)' }}>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          <span className="text-sm">Parsing {fileName}…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-sm px-4 py-3 rounded-xl" style={{ background: '#3f0f0f', color: '#f87171' }}>
            {error}
          </div>
        </div>
      )}

      {/* Always render the iframe so it starts loading immediately;
          hide it while we're still parsing so it doesn't flash */}
      <iframe
        ref={iframeRef}
        src="/sylang-editor/main.html"
        className="flex-1 min-h-0 w-full border-0"
        style={{ display: loading || error ? 'none' : 'block' }}
        title={`Sylang editor — ${fileName}`}
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => {
          // iframe DOM ready — send probe; iframe will respond with 'ready'
          iframeRef.current?.contentWindow?.postMessage({ type: 'probe' }, '*')
        }}
      />
    </div>
  )
}
