/**
 * GET /api/sylang/symbols?nodeType=requirement&workspacePath=userId/owner/repo/path/file.req
 *
 * Returns definition symbol IDs of the given nodeType, scoped to what the
 * requesting file has imported via `use` statements.
 *
 * E.g. if file.req has `use requirementset SafetyReqs`, this returns only
 * the `def requirement` children of SafetyReqs — not every requirement
 * in the workspace.
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

        // Find the requesting document
        const doc = manager.allDocuments.get(workspacePath)
        if (!doc) return json({ ok: true, ids: [] })

        // Collect IDs only from imported parent symbols that match the nodeType.
        // A file imports a parent via `use requirementset SafetyReqs` — the
        // importedSymbols array for that entry contains the hdef + all def children.
        const ids: string[] = []
        for (const imp of doc.importedSymbols) {
          for (const sym of imp.importedSymbols) {
            if (sym.type === 'definition' && sym.kind?.toLowerCase() === nodeType) {
              ids.push(sym.name)
            }
          }
        }

        return json({ ok: true, ids: ids.sort() })
      },
    },
  },
})
