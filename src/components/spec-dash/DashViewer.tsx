/**
 * DashViewer — renders .dash files as interactive dashboards inline.
 */
import { useEffect, useState } from 'react'

interface Props {
  filePath: string
  fileName: string
}

export function DashViewer({ filePath, fileName }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const workspace = filePath.split('/').filter(Boolean).slice(0, 3).join('/')

    fetch('/api/sylang/dash-render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, workspace }),
    })
      .then(r => r.json())
      .then(d => { if (d.ok) setHtml(d.html); else setError(d.error) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [filePath])

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center gap-3 px-4 py-1.5 border-b shrink-0"
        style={{ background: 'var(--theme-sidebar)', borderColor: 'var(--theme-border)' }}
      >
        <span className="text-sm font-semibold" style={{ color: '#0d9488' }}>DASH</span>
        <div className="w-px h-5 shrink-0" style={{ background: 'var(--theme-border)' }} />
        <span className="font-mono text-xs font-medium" style={{ color: 'var(--theme-text)' }}>{fileName}</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center flex-1 gap-3" style={{ color: 'var(--theme-muted)' }}>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          Loading dashboard...
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-sm px-4 py-3 rounded-xl" style={{ background: '#3f0f0f', color: '#f87171' }}>{error}</div>
        </div>
      )}

      {html && !loading && (
        <iframe
          srcDoc={html}
          className="flex-1 min-h-0 w-full border-0"
          title={fileName}
          sandbox="allow-scripts allow-same-origin"
        />
      )}
    </div>
  )
}
