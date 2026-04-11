/**
 * GET /api/auth/github
 * Initiates GitHub OAuth via Supabase.
 * Redirects user to GitHub → comes back to /api/auth/callback
 */
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

export const Route = createFileRoute('/api/auth/github')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!,
        )

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: `${origin}/api/auth/callback`,
            scopes: 'read:user user:email repo',  // repo scope for private repos
          },
        })

        if (error || !data.url) {
          return new Response('OAuth init failed', { status: 500 })
        }

        return Response.redirect(data.url, 302)
      },
    },
  },
})
