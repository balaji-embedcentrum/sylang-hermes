/**
 * GET /api/sylang/fmea?workspace=userId/owner/repo
 *
 * Returns all symbols in FMEASymbol format for the FMEA workbench.
 * Converts Map<string, string[]> properties to Record<string, string[]>.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'

export const Route = createFileRoute('/api/sylang/fmea')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const workspace = (url.searchParams.get('workspace') ?? '').trim()
        if (!workspace) return json({ ok: false, error: 'workspace param required' }, { status: 400 })

        const manager = await getWorkspaceManager(`${workspace}/_.req`)
        if (!manager) return json({ ok: false, error: 'Workspace not found' }, { status: 404 })

        const allSymbols = manager.getAllSymbols()

        // Deduplicate by fileUri:name (getAllSymbols includes imported symbols)
        const seen = new Set<string>()
        const uniqueSymbols = allSymbols.filter(sym => {
          const key = `${sym.fileUri}:${sym.name}`
          if (seen.has(key)) return false
          seen.add(key)
          if (sym.configValue === 0) return false
          return true
        })

        // Convert properties Map → Record
        const symbols = uniqueSymbols
          .map(sym => ({
            name: sym.name,
            type: sym.type,
            kind: sym.kind,
            fileUri: sym.fileUri,
            line: sym.line,
            column: sym.column,
            parentSymbol: sym.parentSymbol,
            children: (sym.children ?? []).map(c => ({
              name: c.name,
              type: c.type,
              kind: c.kind,
              fileUri: c.fileUri,
              line: c.line,
              column: c.column,
              properties: Object.fromEntries(c.properties ?? new Map()),
              indentLevel: c.indentLevel,
              children: [],
            })),
            properties: Object.fromEntries(sym.properties ?? new Map()),
            indentLevel: sym.indentLevel,
            level: sym.level,
          }))

        return json({ ok: true, symbols })
      },
    },
  },
})
