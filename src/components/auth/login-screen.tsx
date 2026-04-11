'use client'

import { getSupabaseBrowser } from '@/lib/supabase'

export function LoginScreen() {
  async function handleGitHubLogin() {
    const supabase = getSupabaseBrowser()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: 'read:user user:email repo',
      },
    })
    // Supabase redirects browser to GitHub — nothing else needed here
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-950 to-primary-900 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-primary-900/80 px-8 py-10 shadow-2xl ring-1 ring-white/10 backdrop-blur">

          {/* Logo */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <img src="/sylang-logo.svg" alt="Sylang" className="h-16 w-16 rounded-2xl" />
            <div className="text-center">
              <h1 className="text-2xl font-bold tracking-tight text-white">Sylang</h1>
              <p className="text-sm text-primary-400 mt-1">AI-powered MBSE workspace</p>
            </div>
          </div>

          {/* GitHub login button */}
          <button
            onClick={handleGitHubLogin}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 font-semibold text-gray-900 shadow transition-all hover:bg-gray-50 active:scale-[0.98]"
          >
            <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Continue with GitHub
          </button>

          <p className="mt-6 text-center text-xs text-primary-500">
            By signing in you agree to our{' '}
            <a href="/terms" className="text-accent-400 hover:text-accent-300">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="text-accent-400 hover:text-accent-300">Privacy Policy</a>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-primary-600">
          Model-Based Systems Engineering · ISO 26262 · ASPICE
        </p>
      </div>
    </div>
  )
}
