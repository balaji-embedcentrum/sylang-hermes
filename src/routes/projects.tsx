import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'

export const Route = createFileRoute('/projects')({
  component: ProjectsPage,
})

type GitHubRepo = {
  id: number
  full_name: string
  name: string
  description: string | null
  private: boolean
  updated_at: string
  language: string | null
  stargazers_count: number
}

function ProjectsPage() {
  const navigate = useNavigate()
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [cloning, setCloning] = useState<{ repoFull: string; lines: string[] } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/auth-check')
        const auth = await res.json()
        if (!auth.authenticated) {
          window.location.href = '/'
          return
        }
        setGithubLogin(auth.githubLogin)

        // Fetch repos via server proxy (token is server-side only)
        const reposRes = await fetch('/api/github/repos')
        if (!reposRes.ok) throw new Error('Failed to load repositories')
        const data = await reposRes.json()
        setRepos(data.repos ?? [])
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const filtered = repos.filter(
    (r) =>
      r.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.description ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setCloning({ repoFull: repo.full_name, lines: ['Opening workspace…'] })

    // Create or retrieve workspace DB record
    const openRes = await fetch('/api/workspaces/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repo_full: repo.full_name, repo_url: `https://github.com/${repo.full_name}` }),
    })
    if (!openRes.ok) {
      setCloning(null)
      return
    }
    const { workspace_id } = await openRes.json() as { workspace_id: string }

    // Clone or check if already ready (SSE stream)
    const cloneRes = await fetch('/api/workspaces/clone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id }),
    })

    // Already cloned — JSON response
    if (cloneRes.headers.get('content-type')?.includes('application/json')) {
      const { status, path: wsPath } = await cloneRes.json() as { status: string; path: string }
      setCloning(null)
      if (status === 'ready') {
        navigate({ to: '/files', search: { path: wsPath } })
      }
      return
    }

    // Streaming SSE clone progress
    const reader = cloneRes.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) { setCloning(null); return }

    let wsPath = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          const msg = JSON.parse(line.slice(6)) as { type: string; message: string }
          if (msg.type === 'ready') {
            wsPath = msg.message
          } else if (msg.type === 'error') {
            setCloning((c) => c ? { ...c, lines: [...c.lines, `Error: ${msg.message}`] } : null)
          } else {
            setCloning((c) => c ? { ...c, lines: [...c.lines, msg.message] } : null)
          }
        } catch { /* ignore malformed */ }
      }
    }

    setCloning(null)
    if (wsPath) {
      navigate({ to: '/files', search: { path: wsPath } })
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
    >
      {/* Clone progress overlay */}
      {cloning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-2xl"
            style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/80 shrink-0" />
              <span className="font-semibold text-sm" style={{ color: 'var(--theme-text)' }}>
                {cloning.repoFull}
              </span>
            </div>
            <div className="rounded-xl p-3 font-mono text-xs space-y-1 max-h-48 overflow-y-auto" style={{ background: 'var(--theme-bg)' }}>
              {cloning.lines.map((line, i) => (
                <div key={i} style={{ color: 'var(--theme-muted)' }}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center justify-between"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-sidebar)' }}
      >
        <div className="flex items-center gap-3">
          <img src="/sylang-logo.svg" alt="Sylang" className="h-8 w-8 rounded-lg" />
          <span className="font-semibold text-lg" style={{ color: 'var(--theme-text)' }}>
            Sylang
          </span>
        </div>
        <div className="flex items-center gap-4">
          {githubLogin && (
            <span className="text-sm" style={{ color: 'var(--theme-muted)' }}>
              @{githubLogin}
            </span>
          )}
          <button
            onClick={() => navigate({ to: '/chat/$sessionKey', params: { sessionKey: 'new' } })}
            className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ background: 'var(--theme-accent)', color: '#fff' }}
          >
            Open Workspace
          </button>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{ background: 'var(--theme-card2)', color: 'var(--theme-muted)' }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--theme-text)' }}>
          Your Repositories
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--theme-muted)' }}>
          Select a repository to open it in the Sylang workspace
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-5 px-4 py-2.5 rounded-xl text-sm outline-none"
          style={{
            background: 'var(--theme-card)',
            border: '1px solid var(--theme-border)',
            color: 'var(--theme-text)',
          }}
        />

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          </div>
        )}

        {error && (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#3f0f0f', color: '#f87171' }}>
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <p className="text-sm text-center py-16" style={{ color: 'var(--theme-muted)' }}>
            {search ? 'No repositories match your search.' : 'No repositories found.'}
          </p>
        )}

        <div className="space-y-2">
          {filtered.map((repo) => (
            <button
              key={repo.id}
              onClick={() => handleSelectRepo(repo)}
              className="w-full text-left rounded-xl px-4 py-4 transition-colors"
              style={{
                background: 'var(--theme-card)',
                border: '1px solid var(--theme-border)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--theme-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--theme-border)'
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate" style={{ color: 'var(--theme-text)' }}>
                      {repo.full_name}
                    </span>
                    {repo.private && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0"
                        style={{ background: 'var(--theme-card2)', color: 'var(--theme-muted)' }}
                      >
                        Private
                      </span>
                    )}
                  </div>
                  {repo.description && (
                    <p className="text-xs truncate" style={{ color: 'var(--theme-muted)' }}>
                      {repo.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs" style={{ color: 'var(--theme-muted)' }}>
                  {repo.language && <span>{repo.language}</span>}
                  <span>★ {repo.stargazers_count}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
