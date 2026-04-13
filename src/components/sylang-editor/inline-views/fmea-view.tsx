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

// FMEA CSS variables + essential styles (extracted from fmea.css, no global resets)
const FMEA_SCOPED_CSS = `
.fmea-scope {
  --fmea-bg: #0e1117;
  --fmea-bg-secondary: #151b28;
  --fmea-bg-card: #1a2235;
  --fmea-bg-hover: #243050;
  --fmea-fg: #e2e8f0;
  --fmea-fg-secondary: #94a3b8;
  --fmea-fg-muted: rgba(113,128,150,0.6);
  --fmea-border: rgba(102,126,234,0.2);
  --fmea-accent: #5EEAD4;
  --fmea-brand: #0D9488;
  --fmea-brand-hover: #0F766E;
  --fmea-brand-light: #14B8A6;
  --fmea-success: #27ae60;
  --fmea-warning: #f39c12;
  --fmea-danger: #e74c3c;
  --fmea-asil-a: #27ae60;
  --fmea-asil-b: #f39c12;
  --fmea-asil-c: #e67e22;
  --fmea-asil-d: #e74c3c;
  --fmea-asil-qm: #3498db;
  color: var(--fmea-fg);
  background: var(--fmea-bg);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.5;
}
`

export default function FmeaView({ workspace }: { workspace: string }) {
  const [symbols, setSymbols] = useState<any[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const styleRef = useRef<HTMLStyleElement | null>(null)
  const cssLoadedRef = useRef(false)

  // Inject scoped CSS vars + load full FMEA CSS (scoped)
  useEffect(() => {
    // Add scoped CSS variables
    const style = document.createElement('style')
    style.textContent = FMEA_SCOPED_CSS
    document.head.appendChild(style)
    styleRef.current = style

    // Dynamically load the full FMEA CSS but scope it
    if (!cssLoadedRef.current) {
      cssLoadedRef.current = true
      fetch(new URL('@sylang-fmea/webview/src/styles/fmea.css', import.meta.url).href)
        .catch(() => {}) // CSS will load via Vite's CSS handling below
    }

    return () => { style.remove() }
  }, [])

  // Load FMEA CSS via dynamic import (Vite handles it)
  useEffect(() => {
    // Import CSS — Vite injects it as a <style> tag
    import('@sylang-fmea/webview/src/styles/fmea.css').catch(() => {})
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
    <div className="fmea-scope" style={{ height: '100%', overflow: 'auto' }}>
      <Suspense fallback={<div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--theme-muted)' }}>Loading FMEA...</div>}>
        <FMEAApp initialSymbols={symbols} />
      </Suspense>
    </div>
  )
}
