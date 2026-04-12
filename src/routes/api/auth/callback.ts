/**
 * GET /api/auth/callback
 * GitHub OAuth callback — Supabase exchanges code for session via PKCE.
 * Uses @supabase/ssr createServerClient so it can read the code_verifier
 * cookie that createBrowserClient stored during signInWithOAuth.
 */
import { createFileRoute } from '@tanstack/react-router'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { provisionProfile } from '../../../server/supabase-auth'

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

type CookieOptions = {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: string
  path?: string
  maxAge?: number
  domain?: string
}

function serializeCookie(name: string, value: string, opts: CookieOptions, isHttps: boolean): string {
  const parts = [`${name}=${encodeURIComponent(value)}`]
  if (opts.httpOnly) parts.push('HttpOnly')
  if (opts.secure && isHttps) parts.push('Secure')
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`)
  if (opts.path) parts.push(`Path=${opts.path}`)
  if (opts.maxAge !== undefined) parts.push(`Max-Age=${opts.maxAge}`)
  if (opts.domain) parts.push(`Domain=${opts.domain}`)
  return parts.join('; ')
}

export const Route = createFileRoute('/api/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')

        if (!code) {
          return Response.redirect(new URL('/?error=no_code', url).toString(), 302)
        }

        const isHttps = url.protocol === 'https:'
        const pendingCookies: string[] = []

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
                  const opts: CookieOptions = {
                    ...options,
                    sameSite: typeof options?.sameSite === 'boolean' ? undefined : options?.sameSite,
                  }
                  pendingCookies.push(serializeCookie(name, value, opts, isHttps))
                }
              },
            },
          },
        )

        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (error || !data.session) {
          console.error('[auth/callback] exchange failed:', error?.message)
          return Response.redirect(new URL('/?error=auth_failed', url).toString(), 302)
        }

        const { access_token, refresh_token, expires_in, provider_token } = data.session
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
          await provisionProfile(admin, user, provider_token ?? null)
        } else {
          // Always update github_token — it rotates on every login
          if (provider_token) {
            await admin.from('profiles').update({ github_token: provider_token }).eq('id', user.id)
          }
        }

        // Set our own sb-access-token / sb-refresh-token cookies for requireAuth()
        const secure = isHttps ? '; Secure' : ''
        const responseHeaders = new Headers()
        // Supabase SSR session cookies (for the browser client's auto-refresh)
        for (const c of pendingCookies) {
          responseHeaders.append('Set-Cookie', c)
        }
        // Our custom HttpOnly cookies used by requireAuth() on the server
        responseHeaders.append(
          'Set-Cookie',
          `sb-access-token=${encodeURIComponent(access_token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${expires_in}`,
        )
        responseHeaders.append(
          'Set-Cookie',
          `sb-refresh-token=${encodeURIComponent(refresh_token ?? '')}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`,
        )
        responseHeaders.append('Location', '/projects')

        return new Response(null, { status: 302, headers: responseHeaders })
      },
    },
  },
})
