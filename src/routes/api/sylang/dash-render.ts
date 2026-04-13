/**
 * POST /api/sylang/dash-render
 * Body: { filePath, workspace }
 *
 * Reads a .dash file, parses widgets, executes queries against workspace
 * symbol manager, and returns rendered HTML dashboard.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'

export const Route = createFileRoute('/api/sylang/dash-render')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })

        const body = await request.json() as { filePath: string; workspace: string }
        const { filePath, workspace } = body
        if (!filePath || !workspace) return json({ ok: false, error: 'filePath and workspace required' }, { status: 400 })

        const manager = await getWorkspaceManager(filePath)
        if (!manager) return json({ ok: false, error: 'Workspace not found' }, { status: 404 })

        try {
          const content = await manager.readFile(filePath)
          const lines = content.split('\n')

          // Parse dashboard
          let title = 'Dashboard'
          let gridCols = 3
          const widgets: Array<{
            type: 'metric' | 'chart' | 'table'
            name: string
            metricType?: string
            value?: number | string
            items?: Array<{ name: string; kind: string; properties: Record<string, string[]> }>
          }> = []

          let currentWidget: any = null

          for (const line of lines) {
            const trimmed = line.trim()

            const hdefMatch = trimmed.match(/^hdef\s+dashboard\s+(\w+)/)
            if (hdefMatch) continue

            const nameMatch = trimmed.match(/^name\s+"(.+)"/)
            if (nameMatch && !currentWidget) { title = nameMatch[1]; continue }

            const gridMatch = trimmed.match(/^grid\s+(\d+)\s*[x×]\s*(\d+)/)
            if (gridMatch) { gridCols = parseInt(gridMatch[2]); continue }

            // Widget definitions
            const metricMatch = trimmed.match(/^def\s+metric\s+(\w+)/)
            if (metricMatch) {
              if (currentWidget) widgets.push(currentWidget)
              currentWidget = { type: 'metric', id: metricMatch[1], name: metricMatch[1], metricType: 'count' }
              continue
            }
            const chartMatch = trimmed.match(/^def\s+chart\s+(\w+)/)
            if (chartMatch) {
              if (currentWidget) widgets.push(currentWidget)
              currentWidget = { type: 'chart', id: chartMatch[1], name: chartMatch[1] }
              continue
            }
            const tableMatch = trimmed.match(/^def\s+table\s+(\w+)/)
            if (tableMatch) {
              if (currentWidget) widgets.push(currentWidget)
              currentWidget = { type: 'table', id: tableMatch[1], name: tableMatch[1], items: [] }
              continue
            }

            if (currentWidget) {
              if (nameMatch) { currentWidget.name = nameMatch[1]; continue }
              const mtMatch = trimmed.match(/^metrictype\s+(\w+)/)
              if (mtMatch) { currentWidget.metricType = mtMatch[1]; continue }

              // Source — query the workspace
              const srcMatch = trimmed.match(/^source\s+"(.+)"/)
              if (srcMatch) {
                const srcPattern = srcMatch[1]
                // Count matching symbols
                let count = 0
                const items: any[] = []
                for (const [docUri, doc] of manager.allDocuments.entries()) {
                  const ext = docUri.split('.').pop() ?? ''
                  if (srcPattern.includes('*.' + ext) || docUri.includes(srcPattern) || srcPattern === '**/*.' + ext) {
                    count += doc.definitionSymbols.length
                    for (const sym of doc.definitionSymbols) {
                      items.push({ name: sym.name, kind: sym.kind, properties: Object.fromEntries(sym.properties) })
                    }
                  }
                }
                currentWidget.value = count
                if (currentWidget.type === 'table') currentWidget.items = items
              }
            }
          }
          if (currentWidget) widgets.push(currentWidget)

          const html = renderDashHtml(title, gridCols, widgets)
          return json({ ok: true, html })
        } catch (e) {
          return json({ ok: false, error: `Render failed: ${e}` }, { status: 500 })
        }
      },
    },
  },
})

function renderDashHtml(title: string, gridCols: number, widgets: any[]): string {
  const widgetHtml = widgets.map(w => {
    if (w.type === 'metric') {
      return `<div class="widget metric">
        <div class="widget-label">${esc(w.name)}</div>
        <div class="widget-value">${w.value ?? 0}</div>
        <div class="widget-type">${esc(w.metricType ?? 'count')}</div>
      </div>`
    }
    if (w.type === 'table' && w.items?.length) {
      const cols = Object.keys(w.items[0]?.properties ?? {}).slice(0, 5)
      return `<div class="widget table-widget" style="grid-column: span ${Math.min(gridCols, 3)}">
        <div class="widget-label">${esc(w.name)}</div>
        <table>
          <thead><tr><th>ID</th><th>Kind</th>${cols.map((c: string) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
          <tbody>${w.items.slice(0, 20).map((item: any) => `<tr>
            <td class="id-cell">${esc(item.name)}</td>
            <td><span class="kind-badge">${esc(item.kind)}</span></td>
            ${cols.map((c: string) => `<td>${esc(Array.isArray(item.properties[c]) ? item.properties[c].join(', ') : '')}</td>`).join('')}
          </tr>`).join('')}</tbody>
        </table>
        ${w.items.length > 20 ? `<div class="more">+ ${w.items.length - 20} more</div>` : ''}
      </div>`
    }
    return `<div class="widget"><div class="widget-label">${esc(w.name)}</div><div class="widget-value">${w.value ?? '—'}</div></div>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0e1117; color: #e2e8f0; padding: 24px; }
  .dash-header { margin-bottom: 24px; padding: 20px 24px; background: linear-gradient(135deg, #0d9488, #0891b2); border-radius: 12px; }
  .dash-header h1 { font-size: 24px; font-weight: 700; color: #fff; }
  .dash-header .meta { font-size: 12px; color: rgba(255,255,255,0.7); margin-top: 4px; }
  .grid { display: grid; grid-template-columns: repeat(${gridCols}, 1fr); gap: 16px; }
  .widget { background: #111827; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 20px; }
  .widget-label { font-size: 13px; color: #94a3b8; margin-bottom: 8px; font-weight: 500; }
  .widget-value { font-size: 36px; font-weight: 700; color: #5EEAD4; }
  .widget-type { font-size: 11px; color: #64748b; margin-top: 4px; text-transform: uppercase; }
  .table-widget { padding: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { text-align: left; padding: 8px 10px; background: #0e1117; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.1); }
  td { padding: 6px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .id-cell { font-family: monospace; color: #5EEAD4; }
  .kind-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; background: rgba(94,234,212,0.1); color: #5EEAD4; font-size: 10px; }
  .more { font-size: 12px; color: #64748b; margin-top: 8px; text-align: center; }
</style>
</head><body>
  <div class="dash-header">
    <h1>${esc(title)}</h1>
    <div class="meta">${widgets.length} widgets · Generated ${new Date().toLocaleString()}</div>
  </div>
  <div class="grid">${widgetHtml}</div>
</body></html>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
