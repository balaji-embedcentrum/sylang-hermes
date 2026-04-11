/**
 * GET /api/auth-check
 * Returns authentication status for the workspace shell.
 * Replaces old password-based check.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { getAuthUser } from '../../server/supabase-auth'
import { ensureGatewayProbed } from '../../server/gateway-capabilities'

export const Route = createFileRoute('/api/auth-check')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Check gateway reachability
        try {
          const caps = await ensureGatewayProbed()
          const reachable = caps.health || caps.chatCompletions || caps.models
          if (!reachable) {
            return json({ authenticated: false, authRequired: true, error: 'hermes_agent_unreachable' }, { status: 503 })
          }
        } catch {
          return json({ authenticated: false, authRequired: true, error: 'hermes_agent_unreachable' }, { status: 503 })
        }

        const auth = await getAuthUser(request)
        return json({
          authenticated: !!auth,
          authRequired: true,
          userId: auth?.userId ?? null,
          githubLogin: auth?.profile.github_login ?? null,
          credits: auth?.profile.credits ?? 0,
          tier: auth?.profile.tier ?? null,
        })
      },
    },
  },
})
