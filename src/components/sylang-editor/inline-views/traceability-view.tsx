import { useEffect, useState } from 'react'
import { SigmaGraphTraversal } from '@sylang-diagrams/webview/src/components/SigmaGraphTraversal'

export default function TraceabilityView({ workspace }: { workspace: string }) {
  const [graphData, setGraphData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/sylang/traceability?workspace=${encodeURIComponent(workspace)}`)
      .then(r => r.json())
      .then(d => { if (d.ok) setGraphData(d.data); else setError(d.error) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [workspace])

  if (loading) return <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--theme-muted)' }}><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />Building graph...</div>
  if (error) return <div className="mx-6 my-6 rounded-xl px-4 py-3 text-sm" style={{ background: '#3f0f0f', color: '#f87171' }}>{error}</div>
  if (!graphData) return null

  return (
    <div style={{ height: '100%', minHeight: 500 }}>
      <SigmaGraphTraversal data={graphData} theme="dark" />
    </div>
  )
}
