/**
 * GET /api/sylang/git/files?workspace=userId/owner/repo&commit=<hash>
 * Proxies to hermes-agent GET /ws/{repo}/git/files
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../../server/auth-middleware'

const HERMES_API_URL = (process.env.HERMES_API_URL || '').trim().replace(/\/$/, '')

export const Route = createFileRoute('/api/sylang/git/files')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const workspace = url.searchParams.get('workspace') ?? ''
        const commit = url.searchParams.get('commit') ?? 'HEAD'
        const repo = workspace.split('/').filter(Boolean)[2] ?? ''
        if (!repo || !HERMES_API_URL) return json({ error: 'Missing params' }, { status: 400 })

        try {
          const r = await fetch(`${HERMES_API_URL}/ws/${encodeURIComponent(repo)}/git/files?commit=${commit}`)
          if (!r.ok) return json({ status: 'error', message: `Agent returned ${r.status}` }, { status: r.status })
          const text = await r.text()
          try { return json(JSON.parse(text)) } catch { return json({ status: 'error', message: 'Invalid JSON from agent' }, { status: 502 }) }
        } catch (e) {
          return json({ status: 'error', message: String(e) }, { status: 500 })
        }
      },
    },
  },
})
