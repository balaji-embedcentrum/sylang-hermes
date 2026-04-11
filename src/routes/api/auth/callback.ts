/**
 * GET /api/auth/callback
 * GitHub OAuth callback — Supabase exchanges code for session.
 * Sets HttpOnly cookie and redirects to /projects.
 */
import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { provisionProfile } from '../../../server/supabase-auth'

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')

        if (!code) {
          return Response.redirect(new URL('/?error=no_code', url).toString(), 302)
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!,
        )

        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error || !data.session) {
          console.error('[auth/callback] exchange failed:', error?.message)
          return Response.redirect(new URL('/?error=auth_failed', url).toString(), 302)
        }

        const { access_token, refresh_token, expires_in } = data.session
        const user = data.user

        // Provision profile if first login (idempotent)
        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY!,
          { auth: { persistSession: false } },
        )
        const { data: existing } = await admin
          .from('profiles')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!existing) {
          await provisionProfile(admin, user)
        } else {
          // Update GitHub token on every login (token rotates)
          const githubToken = user.user_metadata?.provider_token ?? null
          if (githubToken) {
            await admin.from('profiles')
              .update({ github_token: githubToken })
              .eq('id', user.id)
          }
        }

        // Set secure HttpOnly cookies
        const cookieOpts = `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${expires_in}`
        const headers = new Headers()
        headers.append('Set-Cookie', `sb-access-token=${encodeURIComponent(access_token)}; ${cookieOpts}`)
        headers.append('Set-Cookie', `sb-refresh-token=${encodeURIComponent(refresh_token ?? '')}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`)
        headers.append('Location', '/projects')

        return new Response(null, { status: 302, headers })
      },
    },
  },
})
