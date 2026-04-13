/**
 * GET /api/auth/github
 *
 * Initiates GitHub OAuth via Supabase using manual PKCE.
 * Generates the PKCE pair ourselves, stores the verifier in a plain
 * HttpOnly cookie, and redirects to Supabase's /auth/v1/authorize.
 *
 * This bypasses @supabase/ssr's cookie adapter entirely — the cookie
 * is explicit, simple, and works across every SSR framework.
 */
import { createFileRoute } from '@tanstack/react-router'
import { randomBytes, createHash } from 'node:crypto'

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!

export const Route = createFileRoute('/api/auth/github')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const origin = url.origin
        const isHttps = url.protocol === 'https:'

        // ── Generate PKCE pair ──────────────────────────────────────────
        const verifier = randomBytes(32).toString('base64url')
        const challenge = createHash('sha256').update(verifier).digest('base64url')

        // ── Build the Supabase authorize URL ────────────────────────────
        // Check if user wants to switch accounts
        const switchAccount = url.searchParams.get('switch') === '1'

        const params = new URLSearchParams({
          provider: 'github',
          redirect_to: `${origin}/api/auth/callback`,
          scopes: 'read:user user:email repo',
          code_challenge: challenge,
          code_challenge_method: 'S256',
        })

        // When switching accounts, bypass Supabase and go directly to GitHub OAuth
        // with login= empty to force the login page
        let authUrl: string
        if (switchAccount) {
          // Direct GitHub OAuth URL — forces login screen
          const ghParams = new URLSearchParams({
            client_id: SUPABASE_ANON_KEY.split('.')[0] || '', // Won't work — need GitHub client ID
            redirect_uri: `${origin}/api/auth/callback`,
            scope: 'read:user user:email repo',
            state: verifier, // Reuse for simplicity
          })
          // Actually, Supabase handles OAuth — just add prompt=consent
          params.set('prompt', 'consent')
          authUrl = `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`
        } else {
          authUrl = `${SUPABASE_URL}/auth/v1/authorize?${params.toString()}`
        }

        // ── Store verifier in a plain cookie ────────────────────────────
        const secure = isHttps ? '; Secure' : ''
        const cookie = `sylang_pkce_verifier=${verifier}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=600`

        console.info('[auth/github] PKCE verifier stored, redirecting to GitHub')

        return new Response(null, {
          status: 302,
          headers: {
            Location: authUrl,
            'Set-Cookie': cookie,
          },
        })
      },
    },
  },
})
