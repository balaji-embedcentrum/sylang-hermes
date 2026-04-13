/**
 * POST /api/sylang/dash-render
 * Body: { filePath, workspace }
 *
 * Uses the ported DashRenderer from sylang2.1 to produce Chart.js dashboards.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'
import { DashParser } from '../../../sylang/spec-dash/dashParser'
import { WebDashRenderer } from '../../../sylang/spec-dash/webDashRenderer'
import { WebDataFetcher } from '../../../sylang/spec-dash/webDataFetcher'

export const Route = createFileRoute('/api/sylang/dash-render')({
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

          // Parse the dash file
          const dashParser = new DashParser()
          const dashDocument = dashParser.parseText(content, filePath)
          if (!dashDocument) {
            return json({ ok: false, error: 'Failed to parse dashboard file' }, { status: 422 })
          }

          console.info(`[dash-render] Parsed: ${dashDocument.header.name}, ${dashDocument.widgets.length} widgets`)
          for (const w of dashDocument.widgets) {
            const q = (w as any).query
            console.info(`[dash-render]   Widget ${w.id}: type=${w.type}, sourcetype=${q?.sourcetype ?? 'none'}, filepaths=${w.source?.filepaths?.join(',') ?? 'none'}`)
          }

          // Create data fetcher and renderer
          const workspaceRoot = filePath.split('/').filter(Boolean).slice(0, 3).join('/')
          const dataFetcher = new WebDataFetcher(manager, workspaceRoot)
          const dashRenderer = new WebDashRenderer(dataFetcher)

          // Render to HTML
          const rendered = await dashRenderer.render(dashDocument)

          return json({ ok: true, html: rendered.html })
        } catch (e) {
          console.error('[dash-render]', e)
          return json({ ok: false, error: `Render failed: ${e}` }, { status: 500 })
        }
      },
    },
  },
})
