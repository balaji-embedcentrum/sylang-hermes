/**
 * Web-portable DataFetcher
 * Port of sylang2.1/src/spec-dash/renderer/dataFetcher.ts
 * Replaces vscode.workspace.findFiles with ServerSymbolManager.allDocuments
 */
import * as path from 'path'
import { SourceReference, FetchedData, DataItem, DataMetadata } from './types'
import { QueryEngine } from './queryEngine'
import type { ServerSymbolManager } from '../symbolManager/workspaceSymbolCache'

export class WebDataFetcher {
    constructor(
        private manager: ServerSymbolManager,
        private workspaceRoot: string
    ) {}

    private shouldIncludeItem(item: DataItem): boolean {
        const configValue = item.properties.get('configValue')
        if (configValue !== undefined && Array.isArray(configValue) && configValue[0] === '0') return false
        const configState = item.properties.get('configState')
        if (configState) {
            try {
                const stateObj = typeof configState === 'string' ? JSON.parse(configState) : configState
                if (stateObj && stateObj.isVisible === false) return false
            } catch {}
        }
        return true
    }

    async fetchData(source: SourceReference, specFilePath: string): Promise<FetchedData> {
        console.info(`[WebDataFetcher] Fetching data for: ${source.filepaths.join(', ')}`)

        const resolvedPaths = this.resolveFilePaths(source.filepaths, specFilePath)

        if (resolvedPaths.length === 0) {
            return { items: [], metadata: { totalCount: 0, filteredCount: 0, sourceFile: source.filepaths.join(', ') } }
        }

        let allItems: DataItem[] = []
        for (const filePath of resolvedPaths) {
            const items = this.extractItems(filePath)
            allItems.push(...items)
        }

        const enabledItems = allItems.filter(item => this.shouldIncludeItem(item))

        let filteredItems = enabledItems
        if (source.where) filteredItems = QueryEngine.applyWhereClause(filteredItems, source.where)
        if (source.groupby) {
            const grouped = QueryEngine.groupBy(filteredItems, source.groupby)
            filteredItems = Array.from(grouped.values()).flat()
        }
        if (source.orderby) filteredItems = QueryEngine.orderBy(filteredItems, source.orderby)

        return {
            items: filteredItems,
            metadata: {
                totalCount: allItems.length,
                filteredCount: filteredItems.length,
                sourceFile: resolvedPaths.map(p => p.split('/').pop() ?? p).join(', ')
            }
        }
    }

    /**
     * Resolve filepaths using the workspace symbol manager's document map.
     * Supports: relative paths, glob patterns (*.req, **\/*.req), multiple files
     */
    private resolveFilePaths(filepaths: string[], specFilePath: string): string[] {
        const resolved: string[] = []
        const specDir = specFilePath.substring(0, specFilePath.lastIndexOf('/'))
        const allDocKeys = [...this.manager.allDocuments.keys()]

        for (const filepath of filepaths) {
            const isGlob = /[\*\?\[]|\*\*/.test(filepath)

            if (isGlob) {
                // Glob pattern — match against all document keys
                const ext = filepath.match(/\*(\.\w+)$/)?.[1]
                if (ext) {
                    for (const key of allDocKeys) {
                        if (key.endsWith(ext)) {
                            // If not workspace-wide (**), check it's in the same directory tree
                            if (filepath.startsWith('**')) {
                                resolved.push(key)
                            } else {
                                // Relative glob — must be in spec's directory subtree
                                if (key.startsWith(specDir)) {
                                    resolved.push(key)
                                }
                            }
                        }
                    }
                }
            } else {
                // Single file — match by filename
                const filename = filepath.split('/').pop() ?? filepath
                for (const key of allDocKeys) {
                    const keyFilename = key.split('/').pop() ?? key
                    if (keyFilename === filename) {
                        resolved.push(key)
                        break
                    }
                    // Also try resolving relative to spec dir
                    if (key.endsWith('/' + filepath) || key === filepath) {
                        resolved.push(key)
                        break
                    }
                }
            }
        }

        // Deduplicate
        return [...new Set(resolved)]
    }

    /**
     * Resolve a single filepath relative to the spec file.
     * PUBLIC — used by SpecRenderer for diagrams and dashboards.
     */
    public resolveFilePath(filepath: string, specFilePath: string): string | null {
        const allDocKeys = [...this.manager.allDocuments.keys()]
        const filename = filepath.split('/').pop() ?? filepath

        for (const key of allDocKeys) {
            const keyFilename = key.split('/').pop() ?? key
            if (keyFilename === filename) return key
            if (key.endsWith('/' + filepath)) return key
        }
        return null
    }

    /**
     * Extract DataItems from a parsed document using the symbol manager.
     */
    private extractItems(filePath: string): DataItem[] {
        const doc = this.manager.allDocuments.get(filePath)
        if (!doc) return []

        const items: DataItem[] = []
        const headerOnlyTypes = ['productline']

        // Include header only for header-only file types
        if (doc.headerSymbol) {
            if (headerOnlyTypes.includes(doc.headerSymbol.kind || '')) {
                items.push(this.symbolToDataItem(doc.headerSymbol, filePath))
            }
        }

        // Include all definition symbols
        for (const sym of doc.definitionSymbols) {
            items.push(this.symbolToDataItem(sym, filePath))
        }

        return items
    }

    private symbolToDataItem(symbol: any, filePath: string): DataItem {
        return {
            identifier: symbol.name,
            name: symbol.properties?.get('name')?.[0],
            description: symbol.properties?.get('description')?.[0],
            properties: symbol.properties ?? new Map(),
            kind: symbol.kind,
            line: symbol.line,
            sourceFile: filePath
        }
    }

    /**
     * Aggregate data for metrics (count, sum, avg, etc.)
     */
    async aggregateMetric(
        source: SourceReference,
        specFilePath: string,
        metricType: string,
        property?: string
    ): Promise<number> {
        const data = await this.fetchData(source, specFilePath)
        const items = data.items

        switch (metricType) {
            case 'count': return items.length
            case 'percentage':
                return data.metadata.totalCount > 0
                    ? (data.metadata.filteredCount / data.metadata.totalCount) * 100
                    : 0
            case 'sum': case 'avg': case 'min': case 'max': {
                if (!property) return 0
                const values = items
                    .map(item => {
                        const pv = item.properties.get(property)?.[0]
                        return pv ? parseFloat(pv) : NaN
                    })
                    .filter(v => !isNaN(v))
                if (values.length === 0) return 0
                if (metricType === 'sum') return values.reduce((a, b) => a + b, 0)
                if (metricType === 'avg') return values.reduce((a, b) => a + b, 0) / values.length
                if (metricType === 'min') return Math.min(...values)
                if (metricType === 'max') return Math.max(...values)
                return 0
            }
            default: return 0
        }
    }
}
