/**
 * GET /api/sylang/coverage?workspace=userId/owner/repo
 *
 * Coverage analysis — uses WebMatrixDataBuilder (port of sylang2.1's
 * matrixDataBuilder.ts + symbolAnalysisProvider.ts).
 * Same logic, same filtering, same status categories.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'
import { WebMatrixDataBuilder } from '../../../sylang/traceability/webMatrixDataBuilder'
import type { ISylangLogger } from '@sylang-core/interfaces/logger'

const logger: ISylangLogger = {
  l1: () => {}, l2: () => {}, l3: () => {},
  info: (m) => console.info('[Coverage]', m),
  warn: (m) => console.warn('[Coverage]', m),
  error: (m) => console.error('[Coverage]', m),
  debug: () => {},
  show: () => {}, hide: () => {}, clear: () => {},
  refreshLogLevel: () => {},
  getCurrentLogLevel: () => 0 as ReturnType<ISylangLogger['getCurrentLogLevel']>,
  dispose: () => {},
}

export const Route = createFileRoute('/api/sylang/coverage')({
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

        const builder = new WebMatrixDataBuilder(manager, logger)
        const matrixData = await builder.buildMatrixData()
        const analyses = builder.extractSymbolAnalyses(matrixData)

        // Build response matching the VSCode symbolAnalysisProvider output
        const statusCounts = { isolated: 0, orphan: 0, sink: 0, connected: 0, broken: 0 }
        const symbols = analyses.map(a => {
          statusCounts[a.status]++
          return {
            name: a.symbol.name,
            kind: a.symbol.kind,
            fileName: a.symbol.fileUri.split('/').pop() ?? '',
            outgoing: a.outgoingCount,
            incoming: a.incomingCount,
            broken: a.brokenOutgoingCount,
            status: a.status,
          }
        })

        return json({
          ok: true,
          symbols,
          summary: {
            total: symbols.length,
            ...statusCounts,
            brokenRefCount: symbols.reduce((s, r) => s + r.broken, 0),
          },
        })
      },
    },
  },
})
