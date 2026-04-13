/**
 * Dashboard Parser
 * 
 * Parses .dash files into structured DashDocument objects
 * Handles header, widgets (metric, chart, table), and query syntax
 */


import {
    DashDocument,
    DashHeader,
    DashWidget,
    MetricWidget,
    ChartWidget,
    TableWidget,
    DashQuery,
    WhereClause,
    CorrelateClause,
    AnalyzeType,
    OrderByClause,
    WidgetSpan,
    MetricType,
    ChartType
} from './types';

export class DashParser {
    /**
     * Parse text content into a DashDocument
     */
    parseText(text: string, sourceFile: string = ''): DashDocument | null {
        const lines = text.split('\n');

        let header: DashHeader | null = null;
        const widgets: DashWidget[] = [];

        let currentWidget: Partial<DashWidget> | null = null;
        let currentQuery: Partial<DashQuery> = {};
        let inHeaderBlock = false;
        let inWidgetBlock = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('//')) {
                continue;
            }

            const tokens = this.parseTokens(trimmed);
            if (tokens.length === 0) continue;

            const keyword = tokens[0];

            // Parse header
            if (keyword === 'hdef' && tokens[1] === 'dashboard') {
                inHeaderBlock = true;
                header = {
                    identifier: tokens[2] || '',
                    name: '',
                    owner: '',
                    version: '',
                    grid: { rows: 3, columns: 3 }, // Default
                    generatedDate: new Date().toISOString()
                };
            } else if (inHeaderBlock && keyword === 'name') {
                if (header) header.name = this.extractQuotedString(tokens.slice(1).join(' '));
            } else if (inHeaderBlock && keyword === 'owner') {
                if (header) header.owner = this.extractQuotedString(tokens.slice(1).join(' '));
            } else if (inHeaderBlock && keyword === 'version') {
                if (header) header.version = this.extractQuotedString(tokens.slice(1).join(' '));
            } else if (inHeaderBlock && keyword === 'grid') {
                if (header) {
                    const gridMatch = tokens[1]?.match(/(\d+)x(\d+)/);
                    if (gridMatch) {
                        header.grid = {
                            rows: parseInt(gridMatch[1]),
                            columns: parseInt(gridMatch[2])
                        };
                    }
                }
            }

            // Parse widget definitions
            else if (keyword === 'def' && ['metric', 'chart', 'table'].includes(tokens[1])) {
                // Save previous widget
                if (currentWidget && inWidgetBlock) {
                    const widget = this.finalizeWidget(currentWidget, currentQuery);
                    if (widget) widgets.push(widget);
                }

                inHeaderBlock = false;
                inWidgetBlock = true;
                const widgetType = tokens[1] as 'metric' | 'chart' | 'table';
                const identifier = tokens[2] || '';

                currentWidget = {
                    widgetType,
                    identifier,
                    name: '',
                    query: {} as DashQuery
                };
                currentQuery = {};
            }

            // Parse widget properties
            else if (inWidgetBlock && currentWidget) {
                if (keyword === 'name') {
                    currentWidget.name = this.extractQuotedString(tokens.slice(1).join(' '));
                } else if (keyword === 'description' && currentWidget.widgetType === 'table') {
                    (currentWidget as Partial<TableWidget>).description = this.extractQuotedString(tokens.slice(1).join(' '));
                } else if (keyword === 'type') {
                    if (currentWidget.widgetType === 'metric') {
                        (currentWidget as Partial<MetricWidget>).metricType = tokens[1] as MetricType;
                    } else if (currentWidget.widgetType === 'chart') {
                        (currentWidget as Partial<ChartWidget>).chartType = tokens[1] as ChartType;
                    }
                } else if (keyword === 'xaxis' && currentWidget.widgetType === 'chart') {
                    (currentWidget as Partial<ChartWidget>).xaxis = this.extractQuotedString(tokens.slice(1).join(' '));
                } else if (keyword === 'yaxis' && currentWidget.widgetType === 'chart') {
                    (currentWidget as Partial<ChartWidget>).yaxis = this.extractQuotedString(tokens.slice(1).join(' '));
                } else if (keyword === 'columns' && currentWidget.widgetType === 'table') {
                    const columnsStr = tokens.slice(1).join(' ');
                    (currentWidget as Partial<TableWidget>).columns = columnsStr.split(',').map(c => c.trim());
                } else if (keyword === 'span') {
                    const spanMatch = tokens[1]?.match(/(\d+)x(\d+)/);
                    if (spanMatch) {
                        currentWidget.span = {
                            rows: parseInt(spanMatch[1]),
                            columns: parseInt(spanMatch[2])
                        };
                    }
                }

                // Parse query keywords (RENAMED v2.32.0)
                else if (keyword === 'sourcetype') {
                    // v2.32.0: sourcetype <nodetype> (renamed from "source type")
                    const nodeType = tokens[1];

                    // Check if this is the first sourcetype or additional sourcetype
                    if (!currentQuery.sourcetype) {
                        currentQuery.sourcetype = nodeType;
                    } else {
                        // Multiple sourcetypes - this is a very complex query
                        if (!currentQuery.sourcetypes) {
                            currentQuery.sourcetypes = [currentQuery.sourcetype]; // Move first to array
                        }
                        currentQuery.sourcetypes.push(nodeType);
                    }

                    // Check for inline where clause on same line: "sourcetype requirement where status = approved"
                    const whereIndex = tokens.indexOf('where');
                    if (whereIndex !== -1 && whereIndex > 1) {
                        const whereExpression = tokens.slice(whereIndex + 1).join(' ');
                        currentQuery.where = { expression: whereExpression };
                    }
                } else if (keyword === 'source') {
                    // Handle BOTH old and new syntax:
                    // OLD (pre v2.32.0): source requirementset InverterSystemRequirements
                    //                    source failureset PowerStageFailures
                    // NEW (v2.32.0+):    source "*.req", "file1.req"

                    // Known Sylang set keywords → maps to node kind (sourcetype)
                    const SYLANG_SET_KEYWORDS: Record<string, string> = {
                        'requirementset': 'requirement',
                        'featureset': 'feature',
                        'failureset': 'failuremode',
                        'testset': 'testcase',
                        'functionset': 'function',
                        'blockset': 'block',
                        'configset': 'config',
                        'variantset': 'variant',
                        'interfaceset': 'interface',
                        'usecaseset': 'usecase',
                        'hazardset': 'hazard',
                        'safetymechanismset': 'safetymechanism',
                        'safetygoalset': 'safetygoal',
                        'agentset': 'agent',
                        'sequenceset': 'sequence',
                        'sprintset': 'sprint',
                    };

                    const secondToken = tokens[1]?.replace(/^["']|["']$/g, '');

                    if (secondToken && SYLANG_SET_KEYWORDS[secondToken]) {
                        // OLD syntax: source <settype> <name>
                        // Extract sourcetype from set keyword
                        currentQuery.sourcetype = SYLANG_SET_KEYWORDS[secondToken];
                        // The third token (if present) is the set name — not used as source path
                        // but stored for reference if needed
                        if (tokens[2]) {
                            currentQuery.sourceName = tokens[2];
                        }
                    } else {
                        // NEW syntax: source "*.req", "file1.req"
                        const sourceStr = tokens.slice(1).join(' ');
                        const sourcePaths = sourceStr.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                        currentQuery.source = sourcePaths;
                    }
                } else if (keyword === 'where') {
                    // Standalone where clause on separate line
                    currentQuery.where = { expression: tokens.slice(1).join(' ') };
                } else if (keyword === 'correlate' && tokens[1] === 'type') {
                    if (!currentQuery.correlate) currentQuery.correlate = [];
                    const nodeType = tokens[2];
                    const viaIndex = tokens.indexOf('via');
                    const via = viaIndex !== -1 ? tokens[viaIndex + 1] : '';

                    // Check for direction (forward/reverse)
                    const direction = tokens.includes('reverse') ? 'reverse' :
                        tokens.includes('forward') ? 'forward' :
                            'forward'; // Default

                    currentQuery.correlate.push({ nodeType, via, direction });
                } else if (keyword === 'analyze') {
                    currentQuery.analyze = tokens[1] as AnalyzeType;
                } else if (keyword === 'groupby') {
                    currentQuery.groupby = tokens[1];
                } else if (keyword === 'orderby') {
                    const property = tokens[1];
                    const direction = (tokens[2] === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';
                    currentQuery.orderby = { property, direction };
                } else if (keyword === 'property') {
                    currentQuery.property = tokens[1];
                } else if (keyword === 'calculate') {
                    currentQuery.calculate = tokens.slice(1).join(' ');
                }
            }
        }

        // Save last widget
        if (currentWidget && inWidgetBlock) {
            const widget = this.finalizeWidget(currentWidget, currentQuery);
            if (widget) widgets.push(widget);
        }

        if (!header) {
            console.error('[DashParser] No header found in dashboard file');
            return null;
        }

        return { header, widgets, sourceFile };
    }

    private finalizeWidget(widget: Partial<DashWidget>, query: Partial<DashQuery>): DashWidget | null {
        if (!widget.widgetType || !widget.identifier || !widget.name || !query.sourcetype) {
            console.error('[DashParser] Incomplete widget definition', widget);
            return null;
        }

        const baseWidget = {
            widgetType: widget.widgetType,
            identifier: widget.identifier,
            name: widget.name,
            query: query as DashQuery,
            span: widget.span || { rows: 1, columns: 1 }
        };

        if (widget.widgetType === 'metric') {
            return {
                ...baseWidget,
                widgetType: 'metric',
                metricType: (widget as Partial<MetricWidget>).metricType || 'count'
            } as MetricWidget;
        } else if (widget.widgetType === 'chart') {
            return {
                ...baseWidget,
                widgetType: 'chart',
                chartType: (widget as Partial<ChartWidget>).chartType || 'bar',
                xaxis: (widget as Partial<ChartWidget>).xaxis,
                yaxis: (widget as Partial<ChartWidget>).yaxis
            } as ChartWidget;
        } else if (widget.widgetType === 'table') {
            return {
                ...baseWidget,
                widgetType: 'table',
                description: (widget as Partial<TableWidget>).description,
                columns: (widget as Partial<TableWidget>).columns || []
            } as TableWidget;
        }

        return null;
    }

    private parseTokens(line: string): string[] {
        const tokens: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
                current += char;
            } else if (char === ' ' && !inQuotes) {
                if (current) {
                    tokens.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }

        if (current) tokens.push(current);
        return tokens;
    }

    private extractQuotedString(str: string): string {
        const match = str.match(/"([^"]*)"/);
        return match ? match[1] : str;
    }
}
