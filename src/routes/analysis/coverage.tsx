import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/analysis/coverage')({
  validateSearch: (search: Record<string, unknown>) => ({
    workspace: typeof search.workspace === 'string' ? search.workspace : '',
  }),
  component: CoveragePage,
})

type CoverageStatus = 'isolated' | 'orphan' | 'sink' | 'connected' | 'broken'

type RelationshipDetail = {
  sourceId: string
  targetId: string
  relationshipType: string
  isValid: boolean
}

type CoverageSymbol = {
  name: string
  kind: string
  fileName: string
  outgoing: number
  incoming: number
  broken: number
  status: CoverageStatus
  outgoingRelationships: RelationshipDetail[]
  incomingRelationships: RelationshipDetail[]
}

type CoverageData = {
  symbols: CoverageSymbol[]
  summary: {
    total: number
    isolated: number
    orphan: number
    sink: number
    connected: number
    broken: number
    brokenRefCount: number
  }
}

function CoveragePage() {
  const { workspace } = Route.useSearch()
  const navigate = useNavigate()
  const [data, setData] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<'name' | 'kind' | 'outgoing' | 'incoming' | 'status'>('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [filterStatus, setFilterStatus] = useState<CoverageStatus | ''>('')

  useEffect(() => {
    if (!workspace) { setLoading(false); setError('No workspace specified'); return }
    setLoading(true)
    fetch(`/api/sylang/coverage?workspace=${encodeURIComponent(workspace)}`)
      .then(r => r.json())
      .then((d: { ok: boolean } & Partial<CoverageData> & { error?: string }) => {
        if (d.ok && d.symbols) {
          setData({ symbols: d.symbols, summary: d.summary! })
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

  const statusOrder: Record<CoverageStatus, number> = { isolated: 0, orphan: 1, sink: 2, broken: 3, connected: 4 }
  const sorted = data?.symbols
    .filter(s => !filterStatus || s.status === filterStatus)
    .sort((a, b) => {
      let cmp = 0
      if (sortKey === 'status') cmp = statusOrder[a.status] - statusOrder[b.status]
      else if (sortKey === 'outgoing') cmp = a.outgoing - b.outgoing
      else if (sortKey === 'incoming') cmp = a.incoming - b.incoming
      else cmp = a[sortKey].localeCompare(b[sortKey])
      return sortAsc ? cmp : -cmp
    }) ?? []

  const repoName = workspace.split('/').pop() ?? workspace
  const s = data?.summary

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">Coverage Analysis</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--theme-muted)' }}>
              Detailed analysis of identifier relationships and states
            </p>
            {s && (
              <p className="text-xs mt-1" style={{ color: 'var(--theme-muted)' }}>
                {repoName} | Identifiers: {s.total}
              </p>
            )}
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

        {data && s && (
          <>
            {/* Summary cards — matching VSCode Nest layout */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <StatusCard
                label="Isolated"
                icon="🧊"
                value={s.isolated}
                sublabel="No relationships"
                color="#6b7280"
                active={filterStatus === 'isolated'}
                onClick={() => setFilterStatus(filterStatus === 'isolated' ? '' : 'isolated')}
              />
              <StatusCard
                label="Orphan"
                icon="🟡"
                value={s.orphan}
                sublabel="No outgoing"
                color="#f59e0b"
                active={filterStatus === 'orphan'}
                onClick={() => setFilterStatus(filterStatus === 'orphan' ? '' : 'orphan')}
              />
              <StatusCard
                label="Sink"
                icon="🔥"
                value={s.sink}
                sublabel="Only outgoing"
                color="#f97316"
                active={filterStatus === 'sink'}
                onClick={() => setFilterStatus(filterStatus === 'sink' ? '' : 'sink')}
              />
              <StatusCard
                label="Connected"
                icon="✅"
                value={s.connected}
                sublabel="Valid outgoing"
                color="#10b981"
                active={filterStatus === 'connected'}
                onClick={() => setFilterStatus(filterStatus === 'connected' ? '' : 'connected')}
              />
              <StatusCard
                label="Broken"
                icon="❌"
                value={s.broken}
                sublabel="Missing targets"
                color="#ef4444"
                active={filterStatus === 'broken'}
                onClick={() => setFilterStatus(filterStatus === 'broken' ? '' : 'broken')}
              />
            </div>

            {/* Symbol table */}
            <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--theme-border)' }}>
              <table className="w-full text-sm" style={{ minWidth: '1200px' }}>
                <thead>
                  <tr style={{ background: 'var(--theme-card)' }}>
                    <Th onClick={() => handleSort('name')} active={sortKey === 'name'}>Identifier</Th>
                    <Th onClick={() => handleSort('kind')} active={sortKey === 'kind'}>Type</Th>
                    <Th>File</Th>
                    <Th onClick={() => handleSort('status')} active={sortKey === 'status'}>Status</Th>
                    <Th onClick={() => handleSort('outgoing')} active={sortKey === 'outgoing'} align="right">Outgoing</Th>
                    <Th onClick={() => handleSort('incoming')} active={sortKey === 'incoming'} align="right">Incoming</Th>
                    <Th align="right">Broken</Th>
                    <Th>Outgoing Relationships</Th>
                    <Th>Incoming Relationships</Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((sym, i) => (
                    <tr
                      key={`${sym.name}-${sym.fileName}-${i}`}
                      className="transition-colors"
                      style={{ borderTop: '1px solid var(--theme-border)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--theme-card)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-2 font-mono text-xs font-medium" style={{ color: 'var(--theme-accent)' }}>{sym.name}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--theme-card2)', color: 'var(--theme-muted)' }}>
                          {sym.kind}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs" style={{ color: 'var(--theme-muted)' }}>{sym.fileName}</td>
                      <td className="px-4 py-2"><StatusBadge status={sym.status} /></td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums">{sym.outgoing}</td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums">{sym.incoming}</td>
                      <td className="px-4 py-2 text-xs text-right tabular-nums" style={{ color: sym.broken > 0 ? '#ef4444' : 'var(--theme-muted)' }}>
                        {sym.broken}
                      </td>
                      <td className="px-4 py-2">
                        <RelationshipList items={sym.outgoingRelationships} direction="outgoing" />
                      </td>
                      <td className="px-4 py-2">
                        <RelationshipList items={sym.incomingRelationships} direction="incoming" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sorted.length === 0 && (
                <div className="text-center py-10 text-sm" style={{ color: 'var(--theme-muted)' }}>
                  {filterStatus ? `No ${filterStatus} identifiers` : 'No identifiers found'}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatusCard({ label, icon, value, sublabel, color, active, onClick }: {
  label: string; icon: string; value: number; sublabel: string; color: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl px-4 py-3 text-left transition-all"
      style={{
        background: 'var(--theme-card)',
        border: active ? `2px solid ${color}` : '1px solid var(--theme-border)',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div className="text-xs mb-1" style={{ color: 'var(--theme-muted)' }}>{icon} {label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-[10px] mt-0.5" style={{ color: 'var(--theme-muted)' }}>{sublabel}</div>
    </button>
  )
}

const STATUS_CONFIG: Record<CoverageStatus, { bg: string; color: string; label: string }> = {
  isolated: { bg: 'rgba(107,114,128,0.2)', color: '#9ca3af', label: 'ISOLATED' },
  orphan: { bg: 'rgba(245,158,11,0.2)', color: '#f59e0b', label: 'ORPHAN' },
  sink: { bg: 'rgba(249,115,22,0.2)', color: '#f97316', label: 'SINK' },
  connected: { bg: 'rgba(16,185,129,0.2)', color: '#10b981', label: 'CONNECTED' },
  broken: { bg: 'rgba(239,68,68,0.2)', color: '#ef4444', label: 'BROKEN' },
}

function StatusBadge({ status }: { status: CoverageStatus }) {
  const c = STATUS_CONFIG[status]
  return (
    <span className="text-[10px] px-2 py-0.5 rounded font-bold tracking-wide" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

function RelationshipList({ items, direction }: { items: RelationshipDetail[]; direction: 'outgoing' | 'incoming' }) {
  if (!items || items.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((r, i) => (
        <div key={i} className="text-[11px] font-mono whitespace-nowrap flex items-center gap-1" style={{ color: r.isValid ? 'var(--theme-muted)' : '#ef4444' }}>
          <span style={{ borderLeft: `3px solid ${r.isValid ? 'var(--theme-accent)' : '#ef4444'}`, paddingLeft: 6 }}>
            {direction === 'outgoing'
              ? <>{r.sourceId} <span style={{ color: 'var(--theme-accent)' }}>—{r.relationshipType}→</span> {r.targetId}</>
              : <>{r.sourceId} <span style={{ color: 'var(--theme-accent)' }}>—{r.relationshipType}→</span> {r.targetId}</>
            }
          </span>
        </div>
      ))}
    </div>
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
