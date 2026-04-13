import { useEffect, useState } from 'react'

type Commit = { hash: string; shortHash: string; author: string; email: string; date: string; message: string; parents: string[] }
type FileChange = { path: string; status: string }

export default function GitHistoryView({ workspace }: { workspace: string }) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [commitFiles, setCommitFiles] = useState<Record<string, FileChange[]>>({})
  const [filesLoading, setFilesLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/sylang/git/log?workspace=${encodeURIComponent(workspace)}&limit=50`)
      .then(r => r.json())
      .then(d => { if (d.status === 'ok') setCommits(d.commits ?? []); else setError(d.message ?? 'Failed') })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [workspace])

  const toggleCommit = async (hash: string) => {
    if (expanded === hash) { setExpanded(null); return }
    setExpanded(hash)
    if (commitFiles[hash]) return
    setFilesLoading(hash)
    try {
      const r = await fetch(`/api/sylang/git/files?workspace=${encodeURIComponent(workspace)}&commit=${hash}`)
      const d = await r.json()
      if (d.status === 'ok') setCommitFiles(prev => ({ ...prev, [hash]: d.files ?? [] }))
    } catch {}
    setFilesLoading(null)
  }

  const formatDate = (s: string) => {
    try {
      const d = new Date(s), diff = Date.now() - d.getTime()
      if (diff < 60000) return 'just now'
      if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
      if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
      if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
      return d.toLocaleDateString()
    } catch { return s }
  }

  const statusIcon: Record<string, string> = { added: '➕', modified: '📝', deleted: '❌', renamed: '↪️' }
  const statusColor: Record<string, string> = { added: '#10b981', modified: '#f59e0b', deleted: '#ef4444', renamed: '#06b6d4' }

  if (loading) return <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--theme-muted)' }}><div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />Loading history...</div>
  if (error) return <div className="mx-6 my-6 rounded-xl px-4 py-3 text-sm" style={{ background: '#3f0f0f', color: '#f87171' }}>{error}</div>

  return (
    <div className="max-w-4xl mx-auto px-6 py-6" style={{ color: 'var(--theme-text)' }}>
      <div className="space-y-1">
        {commits.map((commit, i) => {
          const isMerge = commit.parents.length > 1
          const isExpanded = expanded === commit.hash
          const files = commitFiles[commit.hash]
          return (
            <div key={commit.hash}>
              <button onClick={() => toggleCommit(commit.hash)} className="w-full text-left rounded-lg px-4 py-3 transition-colors"
                style={{ background: isExpanded ? 'var(--theme-card)' : 'transparent', border: isExpanded ? '1px solid var(--theme-border)' : '1px solid transparent' }}
                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--theme-card)' }}
                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0 pt-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: isMerge ? '#8b5cf6' : 'var(--theme-accent)' }} />
                    {i < commits.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'var(--theme-border)', minHeight: 20 }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-card2)', color: 'var(--theme-accent)' }}>{commit.shortHash}</span>
                      {isMerge && <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: '#8b5cf620', color: '#a78bfa' }}>merge</span>}
                      <span className="text-xs" style={{ color: 'var(--theme-muted)' }}>{formatDate(commit.date)}</span>
                    </div>
                    <div className="text-sm font-medium truncate">{commit.message}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--theme-muted)' }}>{commit.author}</div>
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="ml-8 mb-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--theme-border)' }}>
                  {filesLoading === commit.hash ? <div className="px-4 py-3 text-xs" style={{ color: 'var(--theme-muted)' }}>Loading files...</div>
                    : files && files.length > 0 ? files.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-2 px-4 py-2 text-xs" style={{ borderTop: fi > 0 ? '1px solid var(--theme-border)' : 'none' }}>
                        <span>{statusIcon[f.status] ?? '📄'}</span>
                        <span className="font-mono" style={{ color: statusColor[f.status] ?? 'var(--theme-text)' }}>{f.path}</span>
                      </div>
                    )) : <div className="px-4 py-3 text-xs" style={{ color: 'var(--theme-muted)' }}>No files changed</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
