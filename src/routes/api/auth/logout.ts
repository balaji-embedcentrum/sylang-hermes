/**
 * POST /api/auth/logout
 * Clears session cookies and redirects to landing page.
 */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        const headers = new Headers()
        // Expire both cookies
        headers.append('Set-Cookie', 'sb-access-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
        headers.append('Set-Cookie', 'sb-refresh-token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0')
        headers.append('Location', '/')
        return new Response(null, { status: 302, headers })
      },
    },
  },
})
