/**
 * GET /api/sylang/headers?kind=requirementset&workspacePath=userId/login/repo/...
 *
 * Returns all hdef names for the given set kind, using the server-side
 * WorkspaceSymbolCache (real SylangSymbolManagerCore from sylang2.1).
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'

export const Route = createFileRoute('/api/sylang/headers')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const kind = (url.searchParams.get('kind') ?? '').trim().toLowerCase()
        const workspacePath = (url.searchParams.get('workspacePath') ?? '').trim()

        if (!kind) return json({ ok: false, error: 'kind param required' }, { status: 400 })
        if (!workspacePath) return json({ ok: true, headers: [] })

        const manager = await getWorkspaceManager(workspacePath)
        if (!manager) return json({ ok: true, headers: [] })

        // Collect all hdef names of the requested kind from every loaded document
        const headers = new Set<string>()
        for (const doc of manager.allDocuments.values()) {
          if (doc.headerSymbol?.kind === kind && doc.headerSymbol.name) {
            headers.add(doc.headerSymbol.name)
          }
        }

        return json({ ok: true, headers: Array.from(headers).sort() })
      },
    },
  },
})
