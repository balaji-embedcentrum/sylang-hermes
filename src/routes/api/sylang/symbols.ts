/**
 * GET /api/sylang/symbols?nodeType=requirement&headerKind=requirementset&workspacePath=...
 *
 * Returns all def IDs for the given nodeType, using the server-side
 * WorkspaceSymbolCache (real SylangSymbolManagerCore from sylang2.1).
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'

export const Route = createFileRoute('/api/sylang/symbols')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const nodeType = (url.searchParams.get('nodeType') ?? '').trim().toLowerCase()
        const workspacePath = (url.searchParams.get('workspacePath') ?? '').trim()

        if (!nodeType) return json({ ok: false, error: 'nodeType param required' }, { status: 400 })
        if (!workspacePath) return json({ ok: true, ids: [] })

        const manager = await getWorkspaceManager(workspacePath)
        if (!manager) return json({ ok: true, ids: [] })

        // Collect all definition symbol names of the requested kind across all parsed documents
        const ids = new Set<string>()
        for (const doc of manager.allDocuments.values()) {
          for (const sym of doc.definitionSymbols) {
            if (sym.kind?.toLowerCase() === nodeType) {
              ids.add(sym.name)
            }
          }
        }

        return json({ ok: true, ids: Array.from(ids).sort() })
      },
    },
  },
})
