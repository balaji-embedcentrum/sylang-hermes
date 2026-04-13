/**
 * GET /api/sylang/git/log?workspace=userId/owner/repo&limit=50
 * Proxies to hermes-agent GET /ws/{repo}/git/log
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../../server/auth-middleware'

const HERMES_API_URL = (process.env.HERMES_API_URL || '').trim().replace(/\/$/, '')

export const Route = createFileRoute('/api/sylang/git/log')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const workspace = url.searchParams.get('workspace') ?? ''
        const limit = url.searchParams.get('limit') ?? '50'
        const repo = workspace.split('/').filter(Boolean)[2] ?? ''
        if (!repo || !HERMES_API_URL) return json({ error: 'Missing params' }, { status: 400 })

        try {
          const r = await fetch(`${HERMES_API_URL}/ws/${encodeURIComponent(repo)}/git/log?limit=${limit}`)
          return json(await r.json())
        } catch (e) {
          return json({ status: 'error', message: String(e) }, { status: 500 })
        }
      },
    },
  },
})
