/**
 * Web-portable DashRenderer
 * Port of sylang2.1/src/spec-dash/renderer/dashRenderer.ts
 *
 * Replaces VSCode query parsers with WebDataFetcher for data resolution.
 * Preserves the full HTML/CSS/JS output including Chart.js widgets.
 */
import { DashDocument, DashWidget, DashQuery, RenderedContent, DataItem } from './types'
import { WebDataFetcher } from './webDataFetcher'
import { QueryEngine } from './queryEngine'

export type DashTheme = 'dark' | 'light'

export class WebDashRenderer {
    constructor(
        private dataFetcher: WebDataFetcher,
    ) {}

    private getTheme(): DashTheme {
        return 'dark'
    }

    /**
     * Render full dashboard HTML (standalone page)
     */
    async render(document: DashDocument): Promise<RenderedContent> {
        const theme = this.getTheme()
        const widgetResults = await this.processWidgets(document.widgets, document.sourceFile)

        const html = this.generateFullHTML(document, widgetResults, theme)
        return { html, css: '', javascript: '' }
    }

    /**
     * Render embedded dashboard (no full HTML wrapper — for spec embedding)
     */
    async renderEmbedded(document: DashDocument): Promise<string> {
        const theme = this.getTheme()
        const widgetResults = await this.processWidgets(document.widgets, document.sourceFile)
        return this.generateWidgetGrid(document, widgetResults, theme)
    }

    /**
     * Process all widgets — fetch data using query or source
     */
    private async processWidgets(
        widgets: DashWidget[],
        sourceFile: string,
    ): Promise<Map<string, { value?: number; label?: string; items?: any[]; chartData?: any }>> {
        const results = new Map<string, any>()

        for (const widget of widgets) {
            try {
                // Get items for this widget using query-based resolution
                const items = this.resolveWidgetData(widget)

                if (widget.widgetType === 'metric') {
                    let value = items.length
                    const mt = widget.metricType ?? 'count'
                    if (mt === 'percentage' && (widget as any).query?.where) {
                        // Percentage: filtered / total
                        const allItems = this.resolveWidgetDataUnfiltered(widget)
                        value = allItems.length > 0 ? (items.length / allItems.length) * 100 : 0
                    } else if ((mt === 'sum' || mt === 'avg' || mt === 'min' || mt === 'max') && widget.property) {
                        const vals = items.map(i => parseFloat(i.properties.get(widget.property!)?.[0] ?? '')).filter(v => !isNaN(v))
                        if (vals.length > 0) {
                            if (mt === 'sum') value = vals.reduce((a, b) => a + b, 0)
                            else if (mt === 'avg') value = vals.reduce((a, b) => a + b, 0) / vals.length
                            else if (mt === 'min') value = Math.min(...vals)
                            else if (mt === 'max') value = Math.max(...vals)
                        } else { value = 0 }
                    }
                    results.set(widget.identifier, {
                        value: Math.round(value * 100) / 100,
                        label: mt === 'percentage' ? '%' : '',
                    })
                } else if (widget.widgetType === 'chart') {
                    const groupProp = widget.xaxis ?? (widget as any).query?.groupby ?? 'kind'
                    const groups = new Map<string, number>()
                    for (const item of items) {
                        const key = item.properties.get(groupProp)?.[0] ?? item.kind ?? 'other'
                        groups.set(key, (groups.get(key) ?? 0) + 1)
                    }
                    results.set(widget.identifier, {
                        chartData: {
                            labels: [...groups.keys()],
                            values: [...groups.values()],
                            chartType: widget.chartType ?? 'pie',
                        },
                    })
                } else if (widget.widgetType === 'table') {
                    results.set(widget.identifier, { items })
                }
            } catch (e) {
                console.error(`[DashRenderer] Widget ${widget.identifier} failed:`, e)
                results.set(widget.identifier, { value: 0, error: String(e) })
            }
        }

        return results
    }

    /**
     * Resolve data for a widget using its query (sourcetype + where)
     */
    private resolveWidgetData(widget: DashWidget): DataItem[] {
        const query = (widget as any).query as DashQuery | undefined
        const sourceTypes = query?.sourcetypes ?? (query?.sourcetype ? [query.sourcetype] : [])

        // Collect all symbols matching the sourcetype(s)
        let items: DataItem[] = []
        for (const doc of this.dataFetcher['manager'].allDocuments.values()) {
            for (const sym of doc.definitionSymbols) {
                if (sourceTypes.length === 0 || sourceTypes.includes('all') || sourceTypes.includes(sym.kind)) {
                    items.push({
                        identifier: sym.name,
                        name: sym.properties?.get('name')?.[0],
                        description: sym.properties?.get('description')?.[0],
                        properties: sym.properties ?? new Map(),
                        kind: sym.kind,
                        line: sym.line,
                        sourceFile: doc.uri,
                    })
                }
            }
        }

        // Apply where filter
        if (query?.where) {
            items = QueryEngine.applyWhereClause(items, query.where)
        }

        return items
    }

    /**
     * Same as resolveWidgetData but without where filter (for percentage calculations)
     */
    private resolveWidgetDataUnfiltered(widget: DashWidget): DataItem[] {
        const query = (widget as any).query as DashQuery | undefined
        const sourceTypes = query?.sourcetypes ?? (query?.sourcetype ? [query.sourcetype] : [])

        const items: DataItem[] = []
        for (const doc of this.dataFetcher['manager'].allDocuments.values()) {
            for (const sym of doc.definitionSymbols) {
                if (sourceTypes.length === 0 || sourceTypes.includes('all') || sourceTypes.includes(sym.kind)) {
                    items.push({
                        identifier: sym.name,
                        name: sym.properties?.get('name')?.[0],
                        properties: sym.properties ?? new Map(),
                        kind: sym.kind,
                        line: sym.line,
                        sourceFile: doc.uri,
                    })
                }
            }
        }
        return items
    }

    /**
     * Generate full standalone HTML dashboard
     */
    private generateFullHTML(
        document: DashDocument,
        widgetResults: Map<string, any>,
        theme: DashTheme,
    ): string {
        const gridCols = document.header.grid?.cols ?? 4
        const widgetGrid = this.generateWidgetGrid(document, widgetResults, theme)

        return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${this.esc(document.header.name ?? 'Dashboard')}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: ${theme === 'dark' ? '#0e1117' : '#f8fafc'};
    color: ${theme === 'dark' ? '#e2e8f0' : '#1e293b'};
    padding: 24px;
  }
  .dash-header {
    padding: 20px 24px;
    background: linear-gradient(135deg, #0d9488, #0891b2);
    border-radius: 12px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .dash-header .badge {
    background: rgba(255,255,255,0.2);
    padding: 6px 12px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 14px;
    color: #fff;
  }
  .dash-header h1 { font-size: 22px; font-weight: 700; color: #fff; flex: 1; }
  .dash-meta { font-size: 12px; color: rgba(255,255,255,0.7); display: flex; gap: 16px; }
  .grid {
    display: grid;
    grid-template-columns: repeat(${gridCols}, 1fr);
    gap: 16px;
  }
  .widget {
    background: ${theme === 'dark' ? '#111827' : '#ffffff'};
    border: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e2e8f0'};
    border-radius: 12px;
    padding: 20px;
    position: relative;
  }
  .widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  .widget-name { font-size: 13px; font-weight: 600; color: ${theme === 'dark' ? '#e2e8f0' : '#1e293b'}; }
  .widget-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .badge-metric { background: rgba(20,184,166,0.15); color: #14b8a6; }
  .badge-chart { background: rgba(99,102,241,0.15); color: #6366f1; }
  .badge-table { background: rgba(245,158,11,0.15); color: #f59e0b; }
  .metric-value {
    font-size: 42px;
    font-weight: 800;
    color: #14b8a6;
    line-height: 1;
  }
  .metric-label {
    font-size: 11px;
    color: ${theme === 'dark' ? '#64748b' : '#94a3b8'};
    text-transform: uppercase;
    margin-top: 4px;
    font-weight: 600;
  }
  .chart-container { height: 240px; position: relative; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { text-align: left; padding: 8px 10px; background: ${theme === 'dark' ? '#0e1117' : '#f1f5f9'}; color: ${theme === 'dark' ? '#94a3b8' : '#64748b'}; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; border-bottom: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}; }
  td { padding: 6px 10px; border-bottom: 1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}; }
  .id-cell { font-family: monospace; color: #14b8a6; font-weight: 500; }
  .kind-badge { display: inline-block; padding: 1px 6px; border-radius: 3px; background: rgba(20,184,166,0.1); color: #14b8a6; font-size: 10px; }
  .span-2 { grid-column: span 2; }
  .span-3 { grid-column: span 3; }
</style>
</head><body>
<div class="dash-header">
  <span class="badge">DASH</span>
  <div>
    <h1>${this.esc(document.header.name ?? 'Dashboard')}</h1>
    <div class="dash-meta">
      ${document.header.owner ? `<span>Owner: ${this.esc(document.header.owner)}</span>` : ''}
      ${document.header.version ? `<span>Version: ${this.esc(document.header.version)}</span>` : ''}
      <span>Grid: ${document.header.grid?.rows ?? 4}x${gridCols}</span>
      <span>Generated: ${new Date().toLocaleString()}</span>
    </div>
  </div>
</div>
${widgetGrid}
</body></html>`
    }

    /**
     * Generate just the widget grid HTML (for embedding)
     */
    private generateWidgetGrid(
        document: DashDocument,
        widgetResults: Map<string, any>,
        theme: DashTheme,
    ): string {
        const gridCols = document.header.grid?.cols ?? 4
        const widgetHtml = document.widgets.map(w => {
            const result = widgetResults.get(w.identifier) ?? {}
            const spanClass = (w.span?.cols ?? 1) > 1 ? `span-${Math.min(w.span!.cols, 3)}` : ''

            if (w.widgetType === 'metric') {
                return `<div class="widget ${spanClass}">
                    <div class="widget-header">
                        <span class="widget-name">${this.esc(w.name)}</span>
                        <span class="widget-badge badge-metric">METRIC</span>
                    </div>
                    <div class="metric-value">${result.value ?? 0}${result.label === '%' ? ' <span style="font-size:20px">%</span>' : ''}</div>
                    <div class="metric-label">${this.esc(w.metricType ?? 'count')}</div>
                </div>`
            }

            if (w.widgetType === 'chart' && result.chartData) {
                const canvasId = `chart_${w.identifier}_${Date.now()}`
                const cd = result.chartData
                return `<div class="widget ${spanClass}">
                    <div class="widget-header">
                        <span class="widget-name">${this.esc(w.name)}</span>
                        <span class="widget-badge badge-chart">CHART</span>
                    </div>
                    <div class="chart-container">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                    <script>
                    (function() {
                        const ctx = document.getElementById('${canvasId}');
                        if (ctx) new Chart(ctx, {
                            type: '${cd.chartType === 'line' ? 'line' : cd.chartType === 'bar' ? 'bar' : 'pie'}',
                            data: {
                                labels: ${JSON.stringify(cd.labels)},
                                datasets: [{
                                    label: '${this.esc(w.name)}',
                                    data: ${JSON.stringify(cd.values)},
                                    backgroundColor: ['#14b8a6','#6366f1','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#10b981','#f97316','#3b82f6'],
                                    borderWidth: 0
                                }]
                            },
                            options: {
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { position: 'bottom', labels: { color: '${theme === 'dark' ? '#94a3b8' : '#64748b'}', font: { size: 11 } } } },
                                scales: ${cd.chartType === 'pie' ? '{}' : `{ y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } }`}
                            }
                        });
                    })();
                    </script>
                </div>`
            }

            if (w.widgetType === 'table' && result.items?.length) {
                const cols = ['name', 'description', 'status', 'severity', 'priority'].filter(c =>
                    result.items.some((item: any) => item.properties.get(c)?.[0])
                ).slice(0, 5)
                return `<div class="widget ${spanClass || 'span-2'}">
                    <div class="widget-header">
                        <span class="widget-name">${this.esc(w.name)}</span>
                        <span class="widget-badge badge-table">TABLE</span>
                    </div>
                    <table>
                        <thead><tr><th>ID</th><th>Kind</th>${cols.map(c => `<th>${this.esc(c)}</th>`).join('')}</tr></thead>
                        <tbody>${result.items.slice(0, 15).map((item: any) => `<tr>
                            <td class="id-cell">${this.esc(item.identifier ?? item.name)}</td>
                            <td><span class="kind-badge">${this.esc(item.kind)}</span></td>
                            ${cols.map(c => `<td>${this.esc(item.properties.get(c)?.[0] ?? '')}</td>`).join('')}
                        </tr>`).join('')}</tbody>
                    </table>
                    ${result.items.length > 15 ? `<div style="text-align:center;padding:8px;color:#64748b;font-size:12px">+ ${result.items.length - 15} more</div>` : ''}
                </div>`
            }

            return `<div class="widget"><div class="widget-name">${this.esc(w.name)}</div><div class="metric-value">—</div></div>`
        }).join('\n')

        return `<div class="grid">${widgetHtml}</div>`
    }

    private esc(s: string): string {
        return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
    }
}
