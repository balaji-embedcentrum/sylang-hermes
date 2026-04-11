/**
 * GET /api/auth/github
 * Initiates GitHub OAuth via Supabase PKCE flow.
 * Uses createServerClient so the PKCE code_verifier is stored in a Set-Cookie
 * header on the redirect — the callback handler can then read it from cookies.
 */
import { createFileRoute } from '@tanstack/react-router'
import { createServerClient } from '@supabase/ssr'

function parseCookies(header: string): { name: string; value: string }[] {
  return header
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const idx = c.indexOf('=')
      return { name: c.slice(0, idx).trim(), value: decodeURIComponent(c.slice(idx + 1).trim()) }
    })
}

function serializeCookie(name: string, value: string, opts: Record<string, unknown>, isLocalhost: boolean): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.secure && !isLocalhost) parts.push('Secure')
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`)
  if (opts.path) parts.push(`Path=${opts.path ?? '/'}`)
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
  return parts.join('; ')
}

export const Route = createFileRoute('/api/auth/github')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const origin = url.origin
        const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
        const pendingCookies: string[] = []

        // Use createServerClient so Supabase can store the PKCE verifier in a cookie
        const supabase = createServerClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return parseCookies(request.headers.get('cookie') ?? '')
              },
              setAll(cookiesToSet) {
                for (const { name, value, options } of cookiesToSet) {
                  pendingCookies.push(serializeCookie(name, value, options ?? {}, isLocalhost))
                }
              },
            },
          },
        )

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: `${origin}/api/auth/callback`,
            scopes: 'read:user user:email repo',
          },
        })

        if (error || !data.url) {
          console.error('[auth/github] OAuth init failed:', error?.message)
          return new Response('OAuth init failed', { status: 500 })
        }

        // Redirect to GitHub, forwarding PKCE verifier cookies so the callback can use them
        const headers = new Headers()
        for (const c of pendingCookies) {
          headers.append('Set-Cookie', c)
        }
        headers.set('Location', data.url)
        return new Response(null, { status: 302, headers })
      },
    },
  },
})
