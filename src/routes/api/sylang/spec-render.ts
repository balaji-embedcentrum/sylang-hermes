/**
 * POST /api/sylang/spec-render
 * Body: { filePath, workspace }
 *
 * Reads a .spec file, parses it, fetches referenced data from the workspace
 * symbol manager, and returns rendered HTML.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'

export const Route = createFileRoute('/api/sylang/spec-render')({
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
          // Read the spec file
          const content = await manager.readFile(filePath)
          const lines = content.split('\n')

          // Parse header
          let title = 'Specification'
          let owner = ''
          let version = ''
          const sections: Array<{ name: string; description: string; items: Array<{ name: string; kind: string; properties: Record<string, string[]> }> }> = []

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim()
            const hdefMatch = line.match(/^hdef\s+specification\s+(\w+)/)
            if (hdefMatch) {
              for (let j = i + 1; j < lines.length; j++) {
                const pl = lines[j].trim()
                if (pl.startsWith('def ') || pl.startsWith('hdef ')) break
                const nm = pl.match(/^name\s+"(.+)"/)
                if (nm) title = nm[1]
                const ow = pl.match(/^owner\s+"(.+)"/)
                if (ow) owner = ow[1]
                const vr = pl.match(/^version\s+"(.+)"/)
                if (vr) version = vr[1]
              }
            }

            // Parse sections
            const secMatch = line.match(/^def\s+section\s+(\w+)/)
            if (secMatch) {
              const sec: typeof sections[0] = { name: secMatch[1], description: '', items: [] }
              for (let j = i + 1; j < lines.length; j++) {
                const sl = lines[j].trim()
                if (sl.startsWith('def section') || sl.startsWith('hdef ')) break
                const dn = sl.match(/^name\s+"(.+)"/)
                if (dn) sec.name = dn[1]
                const dd = sl.match(/^description\s+"(.+)"/)
                if (dd) sec.description = dd[1]

                // Parse source references
                const srcMatch = sl.match(/^source\s+"(.+)"/)
                if (srcMatch) {
                  const srcPath = srcMatch[1]
                  // Find matching documents in workspace
                  for (const [docUri, doc] of manager.allDocuments.entries()) {
                    if (docUri.includes(srcPath) || docUri.endsWith(srcPath)) {
                      for (const sym of doc.definitionSymbols) {
                        sec.items.push({
                          name: sym.name,
                          kind: sym.kind,
                          properties: Object.fromEntries(sym.properties),
                        })
                      }
                    }
                  }
                }
              }
              sections.push(sec)
            }
          }

          // Render HTML
          const html = renderSpecHtml(title, owner, version, sections)
          return json({ ok: true, html })
        } catch (e) {
          return json({ ok: false, error: `Render failed: ${e}` }, { status: 500 })
        }
      },
    },
  },
})

function renderSpecHtml(
  title: string, owner: string, version: string,
  sections: Array<{ name: string; description: string; items: Array<{ name: string; kind: string; properties: Record<string, string[]> }> }>,
): string {
  const sectionHtml = sections.map(sec => `
    <div class="spec-section">
      <h2>${esc(sec.name)}</h2>
      ${sec.description ? `<p class="spec-desc">${esc(sec.description)}</p>` : ''}
      ${sec.items.length > 0 ? `
        <table>
          <thead>
            <tr>
              <th>Identifier</th>
              <th>Type</th>
              ${Object.keys(sec.items[0]?.properties ?? {}).slice(0, 6).map(k => `<th>${esc(k)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${sec.items.map(item => `
              <tr>
                <td class="id-cell">${esc(item.name)}</td>
                <td><span class="kind-badge">${esc(item.kind)}</span></td>
                ${Object.values(item.properties).slice(0, 6).map(v => `<td>${esc(Array.isArray(v) ? v.join(', ') : String(v))}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<p class="empty">No data found for this section.</p>'}
    </div>
  `).join('')

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0e1117; color: #e2e8f0; line-height: 1.6; padding: 32px; }
  .spec-header { margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); }
  .spec-header h1 { font-size: 28px; font-weight: 700; color: #f1f5f9; margin-bottom: 8px; }
  .spec-meta { display: flex; gap: 24px; font-size: 13px; color: #94a3b8; }
  .spec-section { margin-bottom: 32px; }
  .spec-section h2 { font-size: 20px; font-weight: 600; color: #5EEAD4; margin-bottom: 8px; }
  .spec-desc { font-size: 14px; color: #94a3b8; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px; }
  th { text-align: left; padding: 10px 12px; background: #1a2235; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; border-bottom: 1px solid rgba(255,255,255,0.1); }
  td { padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #e2e8f0; }
  tr:hover td { background: rgba(255,255,255,0.03); }
  .id-cell { font-family: 'JetBrains Mono', monospace; color: #5EEAD4; font-weight: 500; }
  .kind-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: rgba(94,234,212,0.1); color: #5EEAD4; font-size: 11px; }
  .empty { color: #64748b; font-style: italic; padding: 16px 0; }
</style>
</head><body>
  <div class="spec-header">
    <h1>${esc(title)}</h1>
    <div class="spec-meta">
      ${owner ? `<span>Owner: ${esc(owner)}</span>` : ''}
      ${version ? `<span>Version: ${esc(version)}</span>` : ''}
      <span>${sections.length} section${sections.length !== 1 ? 's' : ''}</span>
      <span>Generated: ${new Date().toLocaleString()}</span>
    </div>
  </div>
  ${sectionHtml}
</body></html>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
