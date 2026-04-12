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

        // Debug: log what we have
        console.info(`[symbols] workspacePath="${workspacePath}" nodeType="${nodeType}"`)
        console.info(`[symbols] doc found: ${!!doc}`)
        if (!doc) {
          // Try to find by suffix match (path format might differ)
          console.info(`[symbols] Available doc keys (first 10):`, [...manager.allDocuments.keys()].slice(0, 10))
          return json({ ok: true, ids: [] })
        }

        console.info(`[symbols] doc.importedSymbols count: ${doc.importedSymbols.length}`)
        for (const imp of doc.importedSymbols) {
          console.info(`[symbols]   import: ${imp.headerKeyword} ${imp.headerIdentifier} → ${imp.importedSymbols.length} children`)
        }

        // Collect IDs only from imported parent symbols that match the nodeType.
        const ids: string[] = []
        for (const imp of doc.importedSymbols) {
          for (const sym of imp.importedSymbols) {
            if (sym.type === 'definition' && sym.kind?.toLowerCase() === nodeType) {
              ids.push(sym.name)
            }
          }
        }

        console.info(`[symbols] returning ${ids.length} ids for nodeType="${nodeType}"`)
        return json({ ok: true, ids: ids.sort() })
      },
    },
  },
})
