/**
 * Traceability Graph — full-screen interactive graph visualization
 *
 * Fetches GraphTraversalData from the server, then renders it using
 * the SigmaGraphTraversal component inside the editor iframe.
 * Same React+D3 component used by the VSCode extension.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/analysis/traceability')({
  validateSearch: (search: Record<string, unknown>) => ({
    workspace: typeof search.workspace === 'string' ? search.workspace : '',
    returnPath: typeof search.returnPath === 'string' ? search.returnPath : '',
  }),
  component: TraceabilityPage,
})

function TraceabilityPage() {
  const { workspace, returnPath } = Route.useSearch()
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<{ nodes: number; edges: number } | null>(null)
  const graphDataRef = useRef<unknown>(null)

  const repoName = workspace.split('/').filter(Boolean).pop() ?? 'Workspace'

  // Fetch graph data
  useEffect(() => {
    if (!workspace) { setLoading(false); setError('No workspace specified'); return }

    fetch(`/api/sylang/traceability?workspace=${encodeURIComponent(workspace)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; data?: unknown; nodeCount?: number; edgeCount?: number; error?: string }) => {
        if (d.ok && d.data) {
          graphDataRef.current = d.data
          setStats({ nodes: d.nodeCount ?? 0, edges: d.edgeCount ?? 0 })
          // If iframe is already ready, send data
          sendGraphData()
        } else {
          setError(d.error ?? 'Failed to load traceability data')
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [workspace])

  function sendGraphData() {
    if (!graphDataRef.current || !iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'init',
        document: { type: 'doc', content: [] }, // empty doc — we only need the diagram
        fileExtension: '.graph',
        fileName: 'Traceability Graph',
        relativePath: '',
        colorPalette: 'teal',
        disabledBlockIds: [],
      },
      '*',
    )
    // Send diagram data after a short delay to let the editor init
    setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: 'diagramData',
          diagramType: 'graph-traversal',
          data: graphDataRef.current,
        },
        '*',
      )
      // Hide the editor chrome and fix graph container sizing
      setTimeout(() => {
        try {
          const doc = iframeRef.current?.contentDocument
          if (doc) {
            const style = doc.createElement('style')
            style.textContent = `
              /* Hide editor chrome */
              .sylang-tab-bar { display: none !important; }
              .sylang-topbar { display: none !important; }
              /* Make the diagram embed fill the viewport */
              .sylang-diagram-embed {
                padding: 0 !important;
                height: 100vh !important;
                overflow: hidden !important;
              }
              /* Graph container needs explicit height */
              .sylang-diagram-embed > div {
                height: 100% !important;
                min-height: 100vh !important;
              }
              /* SVG should fill its container */
              .sylang-diagram-embed svg {
                width: 100% !important;
                height: 100% !important;
                min-height: calc(100vh - 60px) !important;
              }
            `
            doc.head.appendChild(style)
          }
        } catch { /* cross-origin — ignore */ }
      }, 500)
    }, 300)
  }

  // Listen for iframe ready
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === 'ready') {
        sendGraphData()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-4 px-4 py-2 border-b shrink-0"
        style={{ background: 'var(--theme-sidebar)', borderColor: 'var(--theme-border)' }}
      >
        <div className="flex items-center gap-2">
          <img src="/sylang-logo.svg" alt="" className="h-5 w-5 rounded" style={{ filter: 'invert(1) brightness(2)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--theme-accent)' }}>Traceability Graph</span>
        </div>
        <span className="text-xs" style={{ color: 'var(--theme-muted)' }}>{repoName}</span>
        {stats && (
          <span className="text-xs" style={{ color: 'var(--theme-muted)' }}>
            {stats.nodes} nodes | {stats.edges} edges
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => navigate({ to: '/files', search: { path: returnPath || workspace } })}
          className="text-xs px-3 py-1 rounded-lg font-medium"
          style={{ background: 'var(--theme-card)', color: 'var(--theme-muted)', border: '1px solid var(--theme-border)' }}
        >
          Back to Files
        </button>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex items-center justify-center flex-1 gap-3" style={{ color: 'var(--theme-muted)' }}>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          <span className="text-sm">Building traceability graph...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-sm px-4 py-3 rounded-xl" style={{ background: '#3f0f0f', color: '#f87171' }}>
            {error}
          </div>
        </div>
      )}

      {/* Graph iframe — uses the editor bundle's DiagramContainer → SigmaGraphTraversal */}
      <iframe
        ref={iframeRef}
        src="/sylang-editor/main.html"
        className="flex-1 min-h-0 w-full border-0"
        style={{ display: loading || error ? 'none' : 'block' }}
        title="Traceability Graph"
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => {
          iframeRef.current?.contentWindow?.postMessage({ type: 'probe' }, '*')
        }}
      />
    </div>
  )
}
