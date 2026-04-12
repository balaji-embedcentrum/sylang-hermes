/**
 * POST /api/sylang/diagram
 *
 * Generate diagram data for a given Sylang file.
 * Uses the WorkspaceSymbolCache so the full cross-file symbol graph
 * (including all imports) is available — same as VSCode.
 *
 * Request body:
 *   { filePath: string, diagramType: string, focusIdentifier?: string }
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'
import { WebDiagramTransformer } from '../../../sylang/diagrams/WebDiagramTransformer'
import { DiagramType } from '@sylang-diagrams/types/diagramTypes'
import type { ISylangLogger } from '@sylang-core/interfaces/logger'

const logger: ISylangLogger = {
  l1:   (m) => console.info('[Diagram]', m),
  l2:   (m) => console.debug('[Diagram]', m),
  l3:   (m) => console.debug('[Diagram]', m),
  debug:(m) => console.debug('[Diagram]', m),
  info: (m) => console.info('[Diagram]', m),
  error:(m) => console.error('[Diagram]', m),
  warn: (m) => console.warn('[Diagram]', m),
  show: () => {}, hide: () => {}, clear: () => {},
  refreshLogLevel: () => {}, getCurrentLogLevel: () => 0 as ReturnType<ISylangLogger['getCurrentLogLevel']>,
  dispose: () => {},
}

export const Route = createFileRoute('/api/sylang/diagram')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        let body: { filePath?: string; diagramType?: string; focusIdentifier?: string }
        try {
          body = await request.json() as typeof body
        } catch {
          return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
        }

        const { filePath, diagramType, focusIdentifier } = body

        if (!filePath || !diagramType) {
          return json({ ok: false, error: 'filePath and diagramType are required' }, { status: 400 })
        }

        const validTypes = Object.values(DiagramType) as string[]
        if (!validTypes.includes(diagramType)) {
          return json({ ok: false, error: `Unknown diagramType: ${diagramType}` }, { status: 400 })
        }

        // Get the fully-initialized workspace symbol manager (all files parsed, imports resolved)
        const manager = await getWorkspaceManager(filePath)
        if (!manager) {
          return json({ ok: false, error: 'Invalid workspace path' }, { status: 400 })
        }

        // Generate diagram using the full cross-file symbol graph
        const transformer = new WebDiagramTransformer(manager as never, logger)
        const result = await transformer.transformFileToDiagram(
          filePath,
          diagramType as DiagramType,
          focusIdentifier,
        )

        if (!result.success) {
          return json({ ok: false, error: result.error ?? 'Diagram generation failed' }, { status: 422 })
        }

        return json({ ok: true, data: result.data })
      },
    },
  },
})
