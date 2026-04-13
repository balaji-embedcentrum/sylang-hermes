/**
 * GET /api/sylang/traceability?workspace=userId/owner/repo
 *
 * Returns the full project traceability graph data (GraphTraversalData)
 * using WebDiagramTransformer.transformToGraphTraversal().
 * This is the same data used by the right-click "Show Traceability Graph"
 * command in the VSCode extension.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'
import { WebDiagramTransformer } from '../../../sylang/diagrams/WebDiagramTransformer'
import type { ISylangLogger } from '@sylang-core/interfaces/logger'

const logger: ISylangLogger = {
  l1: () => {}, l2: () => {}, l3: () => {},
  info: (m) => console.info('[Traceability]', m),
  warn: (m) => console.warn('[Traceability]', m),
  error: (m) => console.error('[Traceability]', m),
  debug: () => {},
  show: () => {}, hide: () => {}, clear: () => {},
  refreshLogLevel: () => {},
  getCurrentLogLevel: () => 0 as ReturnType<ISylangLogger['getCurrentLogLevel']>,
  dispose: () => {},
}

export const Route = createFileRoute('/api/sylang/traceability')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const workspace = (url.searchParams.get('workspace') ?? '').trim()
        if (!workspace) return json({ ok: false, error: 'workspace param required' }, { status: 400 })

        // Use a dummy file path to get the workspace manager
        const manager = await getWorkspaceManager(`${workspace}/_.req`)
        if (!manager) return json({ ok: false, error: 'Workspace not found' }, { status: 404 })

        const transformer = new WebDiagramTransformer(
          manager as never,
          logger,
          (p) => manager.readFile(p),
        )

        try {
          // transformToGraphTraversal builds nodes + edges from ALL symbols in workspace
          const graphData = await transformer.transformToGraphTraversal(`${workspace}/_.req`)

          return json({
            ok: true,
            data: graphData,
            nodeCount: graphData.nodes?.length ?? 0,
            edgeCount: graphData.edges?.length ?? 0,
          })
        } catch (err) {
          logger.error(`Transform failed: ${err}`)
          return json({ ok: false, error: `Graph generation failed: ${err}` }, { status: 500 })
        }
      },
    },
  },
})
