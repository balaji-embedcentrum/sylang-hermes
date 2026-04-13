/**
 * POST /api/sylang/spec-render
 * Body: { filePath, workspace }
 *
 * Uses the ported SpecRenderer from sylang2.1 to produce professional HTML.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'
import { SpecParser } from '../../../sylang/spec-dash/specParser'
import { WebSpecRenderer } from '../../../sylang/spec-dash/webSpecRenderer'
import { WebDataFetcher } from '../../../sylang/spec-dash/webDataFetcher'
import { WebDashRenderer } from '../../../sylang/spec-dash/webDashRenderer'

export const Route = createFileRoute('/api/sylang/spec-render')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })

        const body = await request.json() as { filePath: string; workspace: string }
        const { filePath } = body
        if (!filePath) return json({ ok: false, error: 'filePath required' }, { status: 400 })

        const manager = await getWorkspaceManager(filePath)
        if (!manager) return json({ ok: false, error: 'Workspace not found' }, { status: 404 })

        try {
          const content = await manager.readFile(filePath)

          // Parse the spec file
          const specDocument = await SpecParser.parseText(content, filePath)

          // Create data fetcher and renderers
          const workspaceRoot = filePath.split('/').filter(Boolean).slice(0, 3).join('/')
          const dataFetcher = new WebDataFetcher(manager, workspaceRoot)
          const dashRenderer = new WebDashRenderer(dataFetcher)
          const specRenderer = new WebSpecRenderer(dataFetcher, dashRenderer)

          // Render to HTML
          const rendered = await specRenderer.render(specDocument, filePath)

          return json({ ok: true, html: rendered.html })
        } catch (e) {
          console.error('[spec-render]', e)
          return json({ ok: false, error: `Render failed: ${e}` }, { status: 500 })
        }
      },
    },
  },
})
