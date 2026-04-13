import { useEffect, useRef, useState, lazy, Suspense } from 'react'

// Set up VSCode API shim before FMEA modules load
if (typeof window !== 'undefined' && !(window as any).acquireVsCodeApi) {
  ;(window as any).acquireVsCodeApi = () => ({
    postMessage: (msg: any) => {
      if (msg?.type === 'log') console.info('[FMEA]', msg.text)
      if (msg?.type === 'error') console.error('[FMEA]', msg.text)
      if (msg?.type === 'navigateToSymbol') console.info('[FMEA] Navigate to:', msg.symbolId)
    },
    getState: () => undefined,
    setState: () => {},
  })
}

const FMEAApp = lazy(() => import('@sylang-fmea/webview/src/App').then(m => ({ default: m.App })))

export default function FmeaView({ workspace }: { workspace: string }) {
  const [symbols, setSymbols] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Inject FMEA CSS scoped inside our container (not globally)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let styleEl: HTMLStyleElement | null = null

    import('@sylang-fmea/webview/src/styles/fmea.css?raw').then(mod => {
      const css = (mod.default ?? mod) as string
      // Scope all rules under .fmea-scope to prevent global leakage
      const scoped = css
        .replace(/\bbody\b/g, '.fmea-scope')
        .replace(/\*\s*\{/g, '.fmea-scope * {')
        .replace(/:root\s*\{/g, '.fmea-scope {')
      styleEl = document.createElement('style')
      styleEl.textContent = scoped
      document.head.appendChild(styleEl)
    }).catch(() => {})

    return () => { if (styleEl) styleEl.remove() }
  }, [])

  useEffect(() => {
    fetch(`/api/sylang/fmea?workspace=${encodeURIComponent(workspace)}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) setSymbols(d.symbols)
        else setError(d.error ?? 'Failed to load FMEA data')
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [workspace])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--theme-muted)' }}>
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        Loading FMEA data...
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-6 my-6 rounded-xl px-4 py-3 text-sm" style={{ background: '#3f0f0f', color: '#f87171' }}>
        {error}
      </div>
    )
  }

  if (!symbols) return null

  return (
    <div ref={containerRef} className="fmea-scope" style={{ height: '100%', overflow: 'auto' }}>
      <Suspense fallback={<div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--theme-muted)' }}>Loading FMEA...</div>}>
        <FMEAApp initialSymbols={symbols} />
      </Suspense>
    </div>
  )
}
