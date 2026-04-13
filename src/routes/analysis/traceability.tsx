/**
 * Traceability Graph — full-screen interactive graph visualization
 *
 * Renders the SigmaGraphTraversal React+D3 component directly (no iframe).
 * Same component used by the VSCode extension.
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { SigmaGraphTraversal } from '@sylang-diagrams/webview/src/components/SigmaGraphTraversal'

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
  const [graphData, setGraphData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const repoName = workspace.split('/').filter(Boolean).pop() ?? 'Workspace'

  useEffect(() => {
    if (!workspace) { setLoading(false); setError('No workspace specified'); return }

    fetch(`/api/sylang/traceability?workspace=${encodeURIComponent(workspace)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; data?: any; error?: string }) => {
        if (d.ok && d.data) {
          setGraphData(d.data)
        } else {
          setError(d.error ?? 'Failed to load traceability data')
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [workspace])

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
        {graphData && (
          <span className="text-xs" style={{ color: 'var(--theme-muted)' }}>
            {graphData.nodes?.length ?? 0} nodes | {graphData.edges?.length ?? 0} edges
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

      {/* Graph — rendered directly, no iframe */}
      {graphData && !loading && !error && (
        <div className="flex-1 min-h-0" style={{ height: 'calc(100vh - 48px)' }}>
          <SigmaGraphTraversal data={graphData} theme="dark" />
        </div>
      )}
    </div>
  )
}
