/**
 * POST /api/sylang/git/push
 * Body: { workspace }
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../../server/auth-middleware'

const HERMES_API_URL = (process.env.HERMES_API_URL || '').trim().replace(/\/$/, '')

export const Route = createFileRoute('/api/sylang/git/push')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, { status: 401 })
        const body = await request.json() as { workspace: string }
        const repo = body.workspace?.split('/').filter(Boolean)[2] ?? ''
        if (!repo || !HERMES_API_URL) return json({ error: 'Missing params' }, { status: 400 })

        try {
          const r = await fetch(`${HERMES_API_URL}/ws/${encodeURIComponent(repo)}/git/push`, { method: 'POST' })
          return json(await r.json())
        } catch (e) {
          return json({ status: 'error', message: String(e) }, { status: 500 })
        }
      },
    },
  },
})
