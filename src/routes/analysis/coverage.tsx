import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/analysis/coverage')({
  validateSearch: (search: Record<string, unknown>) => ({
    workspace: typeof search.workspace === 'string' ? search.workspace : '',
  }),
  component: CoveragePage,
})

type CoverageSymbol = {
  name: string
  kind: string
  fileName: string
  outgoing: number
  incoming: number
  status: 'covered' | 'partial' | 'uncovered'
  brokenRefs: string[]
}

type CoverageData = {
  symbols: CoverageSymbol[]
  summary: {
    total: number
    covered: number
    partial: number
    uncovered: number
    brokenRefCount: number
    coveragePercent: number
  }
  groupedByKind: Record<string, { total: number; covered: number; coveragePercent: number }>
}

function CoveragePage() {
  const { workspace } = Route.useSearch()
  const navigate = useNavigate()
  const [data, setData] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'name' | 'kind' | 'outgoing' | 'incoming' | 'status'>('status')
  const [sortAsc, setSortAsc] = useState(true)
  const [filterKind, setFilterKind] = useState<string>('')

  useEffect(() => {
    if (!workspace) { setLoading(false); setError('No workspace specified'); return }
    setLoading(true)
    fetch(`/api/sylang/coverage?workspace=${encodeURIComponent(workspace)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; symbols?: CoverageSymbol[]; summary?: CoverageData['summary']; groupedByKind?: CoverageData['groupedByKind']; error?: string }) => {
        if (d.ok && d.symbols) {
          setData({ symbols: d.symbols, summary: d.summary!, groupedByKind: d.groupedByKind! })
        } else {
          setError(d.error ?? 'Failed to load coverage data')
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [workspace])

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(true) }
  }

  const statusOrder = { uncovered: 0, partial: 1, covered: 2 }
  const sorted = data?.symbols
    .filter(s => !filterKind || s.kind === filterKind)
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'status') cmp = statusOrder[a.status] - statusOrder[b.status]
      else if (sortKey === 'outgoing') cmp = a.outgoing - b.outgoing
      else if (sortKey === 'incoming') cmp = a.incoming - b.incoming
      else cmp = a[sortKey].localeCompare(b[sortKey])
      return sortAsc ? cmp : -cmp
    }) ?? []

  const repoName = workspace.split('/').pop() ?? workspace

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Coverage Report</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--theme-muted)' }}>{repoName}</p>
          </div>
          <button
            onClick={() => navigate({ to: '/files', search: { path: workspace } })}
            className="text-sm px-3 py-1.5 rounded-lg font-medium"
            style={{ background: 'var(--theme-card)', color: 'var(--theme-muted)', border: '1px solid var(--theme-border)' }}
          >
            Back to Files
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--theme-muted)' }}>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            Analyzing coverage...
          </div>
        )}

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#3f0f0f', color: '#f87171' }}>
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <SummaryCard label="Total Symbols" value={data.summary.total} />
              <SummaryCard label="Covered" value={data.summary.covered} color="#10b981" />
              <SummaryCard label="Partial" value={data.summary.partial} color="#f59e0b" />
              <SummaryCard label="Uncovered" value={data.summary.uncovered} color="#ef4444" />
              <SummaryCard label="Coverage" value={`${data.summary.coveragePercent}%`} large />
            </div>

            {/* Kind breakdown */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--theme-muted)' }}>By Kind</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterKind('')}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{
                    background: filterKind === '' ? 'var(--theme-accent)' : 'var(--theme-card)',
                    color: filterKind === '' ? '#fff' : 'var(--theme-muted)',
                    border: '1px solid var(--theme-border)',
                  }}
                >
                  All ({data.summary.total})
                </button>
                {Object.entries(data.groupedByKind).sort(([,a], [,b]) => b.total - a.total).map(([kind, stats]) => (
                  <button
                    key={kind}
                    onClick={() => setFilterKind(kind === filterKind ? '' : kind)}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                    style={{
                      background: filterKind === kind ? 'var(--theme-accent)' : 'var(--theme-card)',
                      color: filterKind === kind ? '#fff' : 'var(--theme-muted)',
                      border: '1px solid var(--theme-border)',
                    }}
                  >
                    {kind} ({stats.covered}/{stats.total} — {stats.coveragePercent}%)
                  </button>
                ))}
              </div>
            </div>

            {/* Broken refs warning */}
            {data.summary.brokenRefCount > 0 && (
              <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                {data.summary.brokenRefCount} broken reference{data.summary.brokenRefCount > 1 ? 's' : ''} found
              </div>
            )}

            {/* Symbol table */}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--theme-card)' }}>
                    <Th onClick={() => handleSort('name')} active={sortKey === 'name'}>Name</Th>
                    <Th onClick={() => handleSort('kind')} active={sortKey === 'kind'}>Kind</Th>
                    <Th>File</Th>
                    <Th onClick={() => handleSort('outgoing')} active={sortKey === 'outgoing'} align="right">Out</Th>
                    <Th onClick={() => handleSort('incoming')} active={sortKey === 'incoming'} align="right">In</Th>
                    <Th onClick={() => handleSort('status')} active={sortKey === 'status'}>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((sym) => (
                    <tr
                      key={`${sym.name}-${sym.fileName}`}
                      className="transition-colors"
                      style={{ borderTop: '1px solid var(--theme-border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--theme-card)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-2 font-mono text-xs font-medium">{sym.name}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--theme-card2)', color: 'var(--theme-muted)' }}>
                          {sym.kind}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'var(--theme-muted)' }}>{sym.fileName}</td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums">{sym.outgoing}</td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums">{sym.incoming}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={sym.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sorted.length === 0 && (
                <div className="text-center py-10 text-sm" style={{ color: 'var(--theme-muted)' }}>
                  No symbols found
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color, large }: { label: string; value: string | number; color?: string; large?: boolean }) {
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
      <div className="text-xs mb-1" style={{ color: 'var(--theme-muted)' }}>{label}</div>
      <div className={large ? 'text-2xl font-bold' : 'text-lg font-semibold'} style={{ color: color ?? 'var(--theme-text)' }}>
        {value}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: 'covered' | 'partial' | 'uncovered' }) {
  const config = {
    covered: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Covered' },
    partial: { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Partial' },
    uncovered: { bg: 'rgba(239,68,68,0.15)', color: '#ef4444', label: 'Uncovered' },
  }[status]
  return (
    <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: config.bg, color: config.color }}>
      {config.label}
    </span>
  )
}

function Th({ children, onClick, active, align }: { children: React.ReactNode; onClick?: () => void; active?: boolean; align?: 'right' }) {
  return (
    <th
      className={`px-4 py-2.5 text-xs font-semibold ${align === 'right' ? 'text-right' : 'text-left'} ${onClick ? 'cursor-pointer select-none' : ''}`}
      style={{ color: active ? 'var(--theme-accent)' : 'var(--theme-muted)' }}
      onClick={onClick}
    >
      {children}
    </th>
  )
}
