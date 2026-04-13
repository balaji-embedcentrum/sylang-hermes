/**
 * GET /api/sylang/git/status?workspace=userId/owner/repo
 * Proxies to hermes-agent GET /ws/{repo}/git/status
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../../server/auth-middleware'

const HERMES_API_URL = (process.env.HERMES_API_URL || '').trim().replace(/\/$/, '')

function extractRepo(workspace: string): string {
  return workspace.split('/').filter(Boolean)[2] ?? ''
}

export const Route = createFileRoute('/api/sylang/git/status')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ error: 'Unauthorized' }, { status: 401 })
        const url = new URL(request.url)
        const workspace = url.searchParams.get('workspace') ?? ''
        const repo = extractRepo(workspace)
        if (!repo || !HERMES_API_URL) return json({ error: 'Missing workspace or agent URL' }, { status: 400 })

        try {
          const r = await fetch(`${HERMES_API_URL}/ws/${encodeURIComponent(repo)}/git/status`)
          const data = await r.json()
          return json(data)
        } catch (e) {
          return json({ status: 'error', message: String(e) }, { status: 500 })
        }
      },
    },
  },
})
