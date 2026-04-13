/**
 * Renderer for Sylang Specification (.spec) files
 * Generates beautiful HTML with professional UI
 */


import * as path from 'path';
import { SpecDocument, FetchedData, RenderedContent } from './types';
import { WebDataFetcher } from './webDataFetcher';

import { WebDashRenderer } from './webDashRenderer';
import { DashParser } from './dashParser';




export class WebSpecRenderer {
    private dashRenderer: WebDashRenderer;

    constructor(
        private dataFetcher: WebDataFetcher,
        dashRenderer: WebDashRenderer,
    ) {
        this.dashRenderer = dashRenderer;
    }

    /**
     * Escape HTML and convert newlines to <br> tags for multiline strings
     */
    private escapeAndFormatHTML(text: string): string {
        if (!text) return '';

        // Escape HTML special characters
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        // Convert newlines to <br> tags
        return escaped.replace(/\n/g, '<br>');
    }

    /**
     * Render specification document to HTML
     */
    async render(document: SpecDocument, specFilePath: string): Promise<RenderedContent> {
        const html = await this.generateHTML(document, specFilePath);
        const css = this.generateCSS();
        const javascript = this.generateJavaScript();

        return { html, css, javascript };
    }

    /**
     * Generate HTML content
     */
    private async generateHTML(document: SpecDocument, specFilePath: string): Promise<string> {
        const fileName = document.sourceFile.split('/').pop() || 'specification.spec';

        let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src data:;">
    <title>${document.header.name || document.header.id}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>${this.generateCSS()}</style>
</head>
<body>
    <div class="spec-container">
        <div class="header">
            <div style="flex: 1;">
                <h1>${document.header.name || document.header.id}</h1>
                <div class="header-meta">
                    <div class="header-meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <span>${fileName}</span>
                    </div>
                    <div class="header-meta-item">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 3h7v7H3z"></path>
                            <path d="M14 3h7v7h-7z"></path>
                            <path d="M14 14h7v7h-7z"></path>
                            <path d="M3 14h7v7H3z"></path>
                        </svg>
                        <span>${document.sections.length} ${document.sections.length === 1 ? 'Section' : 'Sections'}</span>
                    </div>
                    ${document.header.owner ? `<div class="header-meta-item"><span>Owner: ${document.header.owner}</span></div>` : ''}
                    ${document.header.version ? `<div class="header-meta-item"><span>Version: ${document.header.version}</span></div>` : ''}
                </div>
            </div>
            <div class="header-controls">
                <div class="search-container-header">
                    <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <input type="text" class="search-input-header" id="search-input" placeholder="Search...">
                </div>
                <button class="header-btn" id="btn-download-html" title="Download as HTML - Export specification to standalone HTML file">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                </button>
                <button class="header-btn" id="btn-refresh" title="Refresh View - Reload specification from .spec file">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <polyline points="1 20 1 14 7 14"></polyline>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                    </svg>
                </button>
                <button class="header-btn" id="btn-open-source" title="Edit Source File - Opens .spec file for editing">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
            </div>
        </div>
        <div class="spec-content">
`;

        // Render sections
        for (const section of document.sections) {
            html += await this.renderSection(section, 1, specFilePath);
        }

        html += `
        </div>
    </div>
    <script>${this.generateJavaScript()}</script>
</body>
</html>`;

        return html;
    }

    /**
     * Render a section and its content
     */
    private async renderSection(section: any, level: number, specFilePath: string): Promise<string> {
        console.log(`[SpecRenderer] ===== RENDERING SECTION =====`);
        console.log(`[SpecRenderer] Section: ${section.name || section.id}`);
        console.log(`[SpecRenderer] Content items: ${section.content?.length || 0}`);

        const headingTag = `h${Math.min(level + 1, 6)}`;
        let html = `
        <div class="spec-section level-${level}">
            <${headingTag} class="section-title">${this.escapeAndFormatHTML(section.name || section.id)}</${headingTag}>
            ${section.description ? `<p class="section-description">${this.escapeAndFormatHTML(section.description)}</p>` : ''}
`;

        // Render content items
        for (let i = 0; i < section.content.length; i++) {
            const content = section.content[i];
            console.log(`[SpecRenderer] Processing content item ${i + 1}/${section.content.length}`);
            html += await this.renderContent(content, specFilePath);
        }

        // Render subsections
        for (const subsection of section.subsections) {
            html += await this.renderSection(subsection, level + 1, specFilePath);
        }

        html += `</div>`;
        return html;
    }

    /**
     * Render content (spec, diagram, table)
     */
    private async renderContent(content: any, specFilePath: string): Promise<string> {
        let html = `<div class="content-block ${content.type}-content">`;

        if (content.name) {
            html += `<h4 class="content-title">${this.escapeAndFormatHTML(content.name)}</h4>`;
        }
        if (content.description) {
            html += `<p class="content-description">${this.escapeAndFormatHTML(content.description)}</p>`;
        }

        // Fetch data
        console.log(`[SpecRenderer] Rendering content type: ${content.type}, source: ${content.source.filepaths.join(', ')}`);
        const data = await this.dataFetcher.fetchData(content.source, specFilePath);
        console.log(`[SpecRenderer] Fetched ${data.items.length} items`);

        // Show debug info if no data
        if (data.items.length === 0) {
            html += `<div class="debug-info" style="background: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 10px 0; border-radius: 4px;">
                <strong>⚠️ Debug Info:</strong><br>
                No data found for:<br>
                • File(s): <code>${content.source.filepaths.join(', ')}</code><br>
                <br>
                <strong>Check:</strong><br>
                1. Does the file exist at this path (relative to .spec file)?<br>
                2. Press <strong>F12</strong> and check <strong>Console</strong> tab for detailed logs<br>
                3. Look for [DataFetcher] logs showing file resolution
            </div>`;
        }

        console.log(`[SpecRenderer] Content type: ${content.type}`);
        console.log(`[SpecRenderer] Content:`, content);

        if (content.type === 'table') {
            console.log(`[SpecRenderer] Rendering TABLE`);
            html += this.renderTable(data, content.source.columns);
        } else if (content.type === 'spec') {
            console.log(`[SpecRenderer] Rendering SPEC`);
            html += this.renderSpecContent(data);
        } else if (content.type === 'diagram') {
            console.log(`[SpecRenderer] ===== DIAGRAM DETECTED =====`);
            console.log(`[SpecRenderer] About to call renderDiagram() for: ${content.source?.filepath}`);
            html += await this.renderDiagram(content, specFilePath);
            console.log(`[SpecRenderer] renderDiagram() completed`);
        } else if (content.type === 'dashboard') {
            console.log(`[SpecRenderer] ===== DASHBOARD DETECTED =====`);
            console.log(`[SpecRenderer] About to call renderDashboard() for: ${content.source?.filepath}`);
            html += await this.renderDashboard(content, specFilePath);
            console.log(`[SpecRenderer] renderDashboard() completed`);
        } else {
            console.log(`[SpecRenderer] UNKNOWN content type: ${content.type}`);
        }

        html += `</div>`;
        return html;
    }

    /**
     * Render spec content (list of items with ALL properties)
     */
    private renderSpecContent(data: FetchedData): string {
        if (data.items.length === 0) {
            return `<p class="no-data">No data available</p>`;
        }

        let html = '<div class="spec-items">';

        for (const item of data.items) {
            html += `
            <div class="spec-item">
                <div class="item-header">
                    <span class="item-id">${this.escapeAndFormatHTML(item.identifier)}</span>
                    ${item.name ? `<span class="item-name">${this.escapeAndFormatHTML(item.name)}</span>` : ''}
                </div>
                ${item.description ? `<div class="item-description">${this.escapeAndFormatHTML(item.description)}</div>` : ''}
`;

            // Display ALL properties
            if (item.properties && item.properties.size > 0) {
                html += '<div class="item-properties">';
                item.properties.forEach((values, key) => {
                    // Skip name and description as they're already displayed
                    if (key !== 'name' && key !== 'description') {
                        // Special handling for attachments
                        if (key === 'attach' && Array.isArray(values)) {
                            const attachmentHtml = this.renderAttachmentsInSpec(values);
                            html += `<div class="property-item"><span class="property-label">${this.escapeAndFormatHTML(key)}:</span> <span class="property-value">${attachmentHtml}</span></div>`;
                        } else {
                            let displayValue = Array.isArray(values) ? values.join(', ') : values;
                            // Remove "ref" keyword from relation values (e.g., "ref function ABC" -> "function ABC")
                            displayValue = displayValue.replace(/\bref\s+/g, '');
                            html += `<div class="property-item"><span class="property-label">${this.escapeAndFormatHTML(key)}:</span> <span class="property-value">${this.escapeAndFormatHTML(displayValue)}</span></div>`;
                        }
                    }
                });
                html += '</div>';
            }

            html += `</div>`;
        }

        html += '</div>';
        return html;
    }

    /**
     * Render attachments in spec view with icons
     */
    private renderAttachmentsInSpec(attachments: any[]): string {
        if (!attachments || attachments.length === 0) {
            return '';
        }

        return attachments.map(attachment => {
            const filename = typeof attachment === 'string' ? attachment : attachment.path || 'unknown';
            const ext = filename.split('.').pop()?.toLowerCase() || '';

            let icon = '📄'; // Default file icon
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'].includes(ext)) {
                icon = '🖼️';
            } else if (ext === 'pdf') {
                icon = '📕';
            } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
                icon = '📊';
            } else if (['doc', 'docx'].includes(ext)) {
                icon = '📝';
            }

            return `<span class="attachment-badge" title="${this.escapeAndFormatHTML(filename)}">${icon} ${this.escapeAndFormatHTML(filename)}</span>`;
        }).join(' ');
    }

    /**
     * Render table
     */
    private renderTable(data: FetchedData, columns?: string[]): string {
        if (data.items.length === 0) {
            return `<p class="no-data">No data available</p>`;
        }

        // Determine columns to display
        let displayColumns = columns || ['identifier', 'name', 'description'];

        // Auto-detect attachments - if any item has attachments and 'attach' not in columns, add it
        if (!displayColumns.includes('attach')) {
            const hasAttachments = data.items.some(item =>
                item.properties.has('attach') &&
                Array.isArray(item.properties.get('attach')) &&
                item.properties.get('attach')!.length > 0
            );
            if (hasAttachments) {
                displayColumns = [...displayColumns, 'attach'];
            }
        }

        let html = '<table class="data-table"><thead><tr>';
        for (const col of displayColumns) {
            html += `<th>${col}</th>`;
        }
        html += '</tr></thead><tbody>';

        for (const item of data.items) {
            html += '<tr>';
            for (const col of displayColumns) {
                let value = '';
                let isAttachment = false;

                if (col === 'identifier') {
                    value = item.identifier;
                } else if (col === 'name') {
                    value = item.name || '';
                } else if (col === 'description') {
                    value = item.description || '';
                } else if (item.properties.has(col)) {
                    const propValue = item.properties.get(col);

                    // Special handling for attachments
                    if (col === 'attach' && Array.isArray(propValue)) {
                        isAttachment = true;
                        value = this.renderAttachmentsInTable(propValue);
                    } else {
                        value = Array.isArray(propValue) ? propValue.join(', ') : propValue || '';
                    }
                }

                if (isAttachment) {
                    html += `<td class="attachment-cell">${value}</td>`;
                } else {
                    html += `<td>${this.escapeAndFormatHTML(value)}</td>`;
                }
            }
            html += '</tr>';
        }

        html += '</tbody></table>';
        return html;
    }

    /**
     * Render attachments in table cell
     */
    private renderAttachmentsInTable(attachments: string[]): string {
        return attachments.map(attachPath => {
            const cleanPath = attachPath.replace(/"/g, '');
            const fileName = cleanPath.split('/').pop() || cleanPath.split('\\').pop() || cleanPath;
            const ext = fileName.toLowerCase().split('.').pop() || '';

            // Get file icon
            const icon = ext === 'pdf' ? '📕' :
                ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'svg' ? '🖼️' :
                    ext === 'doc' || ext === 'docx' ? '📘' :
                        ext === 'xls' || ext === 'xlsx' || ext === 'csv' ? '📗' :
                            ext === 'ppt' || ext === 'pptx' ? '📙' :
                                ext === 'zip' || ext === 'rar' || ext === '7z' ? '🗜️' :
                                    ext === 'txt' || ext === 'md' ? '📝' :
                                        '📄';

            return `<span class="attachment-item" title="${cleanPath}">${icon} ${fileName}</span>`;
        }).join(' ');
    }

    /**
     * Render diagram with SVG preview + clickable to open full diagram
     */
    private async renderDiagram(content: any, specFilePath: string): Promise<string> {
        // Diagrams only support single file, use the first filepath
        const filepath = content.source.filepaths && content.source.filepaths.length > 0
            ? content.source.filepaths[0]
            : undefined;

        if (!filepath) {
            return this.renderDiagramError('undefined', 'No source file specified', [
                `Spec file: ${specFilePath}`,
                'Add a "source" property with a file path to the diagram definition'
            ]);
        }

        console.log(`[SpecRenderer] Rendering diagram for: ${filepath}`);

        // Resolve the source file path
        const sourceFilePath = this.dataFetcher.resolveFilePath(filepath, specFilePath);

        if (!sourceFilePath) {
            return this.renderDiagramError(filepath, 'Failed to resolve file path', [
                `File path: ${filepath}`,
                `Spec file: ${specFilePath}`,
                'Check if the file exists relative to the .spec file'
            ]);
        }

        console.log(`[SpecRenderer] Resolved diagram file to: ${sourceFilePath}`);

        // Web version: show diagram placeholder with file info
        // (SVG generation requires VSCode diagram manager — not available in web)
        return this.renderDiagramPlaceholder(filepath, sourceFilePath);
    }

    /**
     * Render diagram with SVG preview + clickable to open full diagram
     */
    private renderDiagramWithSvg(content: any, sourceFilePath: string, svg: string): string {
        const filepath = content.source.filepaths && content.source.filepaths.length > 0
            ? content.source.filepaths[0]
            : '';
        return `
        <div class="diagram-container" data-filepath="${filepath}" data-fspath="${sourceFilePath}">
            <div class="diagram-controls">
                <button class="zoom-btn" data-action="zoom-in" title="Zoom In">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                        <line x1="11" y1="8" x2="11" y2="14"></line>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                </button>
                <button class="zoom-btn" data-action="zoom-out" title="Zoom Out">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                        <line x1="8" y1="11" x2="14" y2="11"></line>
                    </svg>
                </button>
                <button class="zoom-btn" data-action="zoom-reset" title="Reset Zoom">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                </button>
            </div>
            <div class="diagram-preview">
                <div class="diagram-svg-wrapper">
                    ${svg}
                </div>
            </div>
            <div class="diagram-overlay">
                <button class="diagram-open-btn">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 3h6v6M10 14L21 3M5 21h14a2 2 0 0 0 2-2V10"></path>
                    </svg>
                    Open Interactive Diagram
                </button>
            </div>
        </div>`;
    }

    /**
     * Render embedded dashboard
     */
    private async renderDashboard(content: any, specFilePath: string): Promise<string> {
        // Dashboards only support single file, use the first filepath
        const filepath = content.source.filepaths && content.source.filepaths.length > 0
            ? content.source.filepaths[0]
            : undefined;

        if (!filepath) {
            return this.renderDashboardError('undefined', 'No source file specified', [
                'Add a "source" property with a file path to the dashboard definition'
            ]);
        }

        console.log(`[SpecRenderer] Rendering dashboard for: ${filepath}`);

        // Resolve the dashboard file path
        const dashFileUri = this.dataFetcher.resolveFilePath(filepath, specFilePath);

        if (!dashFileUri) {
            return this.renderDashboardError(filepath, 'Failed to resolve file path', [
                'Check that the file path is correct relative to the .spec file',
                'Verify the .dash file exists at the specified location'
            ]);
        }

        try {
            // Read the dashboard file via data fetcher's manager
            const dashText = await (this.dataFetcher as any).manager.readFile(dashFileUri);

            // Parse the dashboard file
            const dashParser = new DashParser();
            const dashDoc = dashParser.parseText(dashText, dashFileUri);

            if (!dashDoc) {
                return this.renderDashboardError(filepath, 'Failed to parse dashboard file', [
                    'Check the dashboard file syntax',
                    'Ensure all required properties are defined'
                ]);
            }

            // Render the dashboard using DashRenderer (embedded mode - no full HTML wrapper)
            const dashboardHTML = await this.dashRenderer.renderEmbedded(dashDoc);

            // Return the embedded dashboard content
            return `
            <div class="embedded-dashboard">
                ${dashboardHTML}
            </div>`;

        } catch (error) {
            console.error(`[SpecRenderer] Error rendering dashboard:`, error);
            const filepath = content.source.filepaths && content.source.filepaths.length > 0
                ? content.source.filepaths[0]
                : 'undefined';
            return this.renderDashboardError(filepath, `Error: ${error}`, [
                'Check the VS Code Output panel for detailed error logs',
                'Verify the dashboard file is valid and accessible'
            ]);
        }
    }

    /**
     * Render dashboard error message
     */
    private renderDashboardError(filepath: string, errorMessage: string, recommendations: string[]): string {
        return `
        <div class="dashboard-error">
            <div class="error-icon">⚠️</div>
            <div class="error-content">
                <h4>Failed to Load Dashboard</h4>
                <p><strong>File:</strong> <code>${filepath}</code></p>
                <p><strong>Error:</strong> ${errorMessage}</p>
                <div class="error-recommendations">
                    <strong>Recommendations:</strong>
                    <ul>
                        ${recommendations.map(rec => `<li>${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
        </div>`;
    }

    /**
     * Render diagram placeholder with "View Diagram" button
     */
    private renderDiagramPlaceholder(filepath: string, fsPath: string): string {
        return `
        <div class="diagram-placeholder" data-fspath="${fsPath}" data-filepath="${filepath}">
            <div class="placeholder-content">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
                <h4>Diagram Preview</h4>
                <p>Click the button below to view the interactive diagram</p>
                <button class="view-diagram-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    View Diagram
                </button>
                <p class="placeholder-file"><code>${filepath}</code></p>
            </div>
        </div>`;
    }

    /**
     * Render diagram error with detailed debug info
     */
    private renderDiagramError(filepath: string, errorMessage: string, debugSteps: string[]): string {
        return `
        <div class="diagram-error">
            <div class="error-header">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h4>Diagram Rendering Failed</h4>
            </div>
            <div class="error-content">
                <p class="error-message"><strong>Error:</strong> ${errorMessage}</p>
                <p class="error-file"><strong>Source:</strong> <code>${filepath}</code></p>
                <div class="error-debug">
                    <strong>Debug Information:</strong>
                    <ul>
                        ${debugSteps.map(step => `<li>${step}</li>`).join('')}
                    </ul>
                </div>
                <p class="error-help">
                    <strong>💡 Tip:</strong> Press <kbd>F12</kbd> to open DevTools and check the Console tab for detailed logs.
                </p>
            </div>
        </div>`;
    }

    /**
     * Generate CSS
     */
    private generateCSS(): string {
        return `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
            height: 100%; 
            overflow: hidden; 
            font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            font-size: 11px; 
            line-height: 1.6; 
            color: #2d3748; 
            background: #f7fafc;
        }
        body {
            display: flex;
            flex-direction: column;
        }
        .spec-container { 
            max-width: 1400px; 
            margin: 0 auto; 
            width: 100%;
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        /* Header - Fixed at top */
        .header { 
            background: linear-gradient(135deg, #14b8a6 0%, #0891b2 100%); 
            color: white; 
            padding: 24px 32px; 
            border-radius: 0;
            flex-shrink: 0;
            display: flex; 
            align-items: center; 
            justify-content: space-between; 
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
            position: sticky;
            top: 0;
            z-index: 100;
        }
        .header h1 { 
            font-size: 18px; 
            font-weight: 600; 
            margin-bottom: 12px; 
            color: white;
        }
        .header-meta { 
            display: flex; 
            gap: 20px; 
            font-size: 13px; 
            opacity: 0.95; 
            flex-wrap: wrap;
        }
        .header-meta-item { 
            display: flex; 
            align-items: center; 
            gap: 6px;
        }
        .header-meta-item svg { 
            opacity: 0.9;
        }
        .header-controls { 
            display: flex; 
            gap: 8px;
            align-items: center;
        }
        .search-container-header {
            position: relative;
            margin-right: 8px;
        }
        .search-icon {
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0.7;
            pointer-events: none;
        }
        .search-input-header {
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.2);
            color: white;
            padding: 8px 12px 8px 36px;
            border-radius: 8px;
            font-size: 13px;
            width: 200px;
            transition: all 0.2s;
        }
        .search-input-header::placeholder {
            color: rgba(255,255,255,0.6);
        }
        .search-input-header:focus {
            outline: none;
            background: rgba(255,255,255,0.25);
            border-color: rgba(255,255,255,0.4);
        }
        .header-btn { 
            background: rgba(255,255,255,0.15); 
            border: 1px solid rgba(255,255,255,0.2); 
            color: white; 
            width: 40px; 
            height: 40px; 
            border-radius: 8px; 
            cursor: pointer; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            transition: all 0.2s;
        }
        .header-btn:hover { 
            background: rgba(255,255,255,0.25); 
            transform: translateY(-1px);
        }
        .header-btn svg { 
            width: 18px; 
            height: 18px;
        }
        
        /* Content - Scrollable */
        .spec-content { 
            background: var(--vscode-editor-background, white); 
            color: var(--vscode-editor-foreground, #2d3748);
            padding: 24px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
        }
        .spec-section { margin-bottom: 32px; }
        .section-title { font-size: 14px; font-weight: 600; color: var(--vscode-editor-foreground, #2d3748); margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #14b8a6; }
        h3.section-title { font-size: 12px; }
        h4.section-title { font-size: 11px; }
        .section-description { font-size: 11px; color: var(--vscode-descriptionForeground, #4a5568); margin-bottom: 16px; line-height: 1.6; }
        .content-block { margin-bottom: 24px; padding: 16px; background: var(--vscode-sideBar-background, #f8f9fa); border-radius: 6px; border-left: 3px solid #14b8a6; }
        .content-title { font-size: 10px; font-weight: 600; color: var(--vscode-editor-foreground, #2d3748); margin-bottom: 12px; }
        .content-description { font-size: 11px; color: var(--vscode-descriptionForeground, #4a5568); margin-bottom: 16px; }
        
        /* Spec Items */
        .spec-items { display: flex; flex-direction: column; gap: 16px; }
        .spec-item { background: var(--vscode-editor-background, white); border: 1px solid var(--vscode-panel-border, #e2e8f0); border-radius: 6px; padding: 16px; }
        .item-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .item-id { font-weight: 600; color: #14b8a6; font-size: 11px; }
        .item-name { color: var(--vscode-editor-foreground, #2d3748); font-size: 11px; font-weight: 500; }
        .item-description { font-size: 11px; color: var(--vscode-descriptionForeground, #4a5568); margin-bottom: 12px; line-height: 1.5; }
        
        /* Properties */
        .item-properties { 
            display: grid; 
            grid-template-columns: repeat(2, 1fr); 
            gap: 8px; 
            padding: 12px; 
            background: var(--vscode-sideBar-background, #f8f9fa); 
            border-radius: 4px; 
            margin-top: 12px;
        }
        .property-item { 
            font-size: 10px; 
            display: flex; 
            gap: 6px;
        }
        .property-label { 
            font-weight: 600; 
            color: var(--vscode-descriptionForeground, #4a5568); 
            text-transform: capitalize;
        }
        .property-value { 
            color: var(--vscode-editor-foreground, #2d3748);
        }
        
        /* Table */
        .data-table { 
            width: 100%; 
            border-collapse: collapse; 
            font-size: 10px; 
            background: var(--vscode-editor-background, white);
            color: var(--vscode-editor-foreground, #2d3748);
        }
        .data-table th { 
            background: var(--vscode-sideBar-background, #f8f9fa); 
            padding: 12px; 
            text-align: left; 
            font-weight: 600; 
            border-bottom: 2px solid #14b8a6; 
            color: var(--vscode-editor-foreground, #2d3748);
        }
        .data-table td { 
            padding: 12px; 
            border-bottom: 1px solid var(--vscode-panel-border, #e2e8f0);
            color: var(--vscode-editor-foreground, #2d3748);
        }
        .data-table tr:hover { 
            background: var(--vscode-list-hoverBackground, #f8f9fa);
        }
        .attachment-cell {
            white-space: nowrap;
        }
        .attachment-item {
            display: inline-block;
            padding: 4px 8px;
            margin: 2px;
            background: var(--vscode-badge-background, #f0f9ff);
            border: 1px solid var(--vscode-panel-border, #bae6fd);
            border-radius: 4px;
            font-size: 10px;
            cursor: default;
            color: var(--vscode-badge-foreground, inherit);
        }
        .attachment-item:hover {
            background: var(--vscode-list-hoverBackground, #e0f2fe);
        }
        .attachment-badge {
            display: inline-block;
            padding: 4px 8px;
            margin: 2px 4px 2px 0;
            background: var(--vscode-badge-background, #f0f9ff);
            border: 1px solid var(--vscode-panel-border, #bae6fd);
            border-radius: 4px;
            font-size: 10px;
            cursor: default;
            white-space: nowrap;
            color: var(--vscode-badge-foreground, inherit);
        }
        .attachment-badge:hover {
            background: var(--vscode-list-hoverBackground, #e0f2fe);
        }

        .no-data { font-size: 11px; color: var(--vscode-descriptionForeground, #718096); font-style: italic; padding: 16px; text-align: center; }
        
        /* Search Highlighting */
        mark.search-highlight {
            background: #fef08a;
            color: #854d0e;
            padding: 2px 0;
            border-radius: 2px;
            font-weight: 600;
        }
        
        /* Diagram Styles - Larger with 2:3 aspect ratio */
        .diagram-container {
            position: relative;
            margin: 16px 0;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
            background: white;
            transition: all 0.3s;
        }
        .diagram-container:hover {
            border-color: #14b8a6;
            box-shadow: 0 4px 12px rgba(20, 184, 166, 0.15);
        }
        .diagram-controls {
            position: absolute;
            top: 12px;
            right: 12px;
            display: flex;
            gap: 8px;
            z-index: 10;
            background: rgba(255, 255, 255, 0.95);
            padding: 8px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .zoom-btn {
            background: white;
            border: 1px solid #e2e8f0;
            color: #4a5568;
            width: 36px;
            height: 36px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .zoom-btn:hover {
            background: #f7fafc;
            border-color: #14b8a6;
            color: #14b8a6;
        }
        .diagram-preview {
            position: relative;
            width: 100%;
            padding-top: 66.67%; /* 2:3 aspect ratio (height = 2/3 * width) */
            background: #f8f9fa;
            overflow: hidden;
        }
        .diagram-svg-wrapper {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow: auto;
            transform-origin: center center;
            transition: transform 0.2s ease;
        }
        .diagram-svg-wrapper svg {
            max-width: 100%;
            max-height: 100%;
            display: block;
            margin: 0 auto;
        }
        .diagram-overlay {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
            padding: 20px;
            opacity: 0;
            transition: opacity 0.3s;
        }
        .diagram-container:hover .diagram-overlay {
            opacity: 1;
        }
        .diagram-open-btn {
            background: #14b8a6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 0 auto;
            transition: all 0.2s;
        }
        .diagram-open-btn:hover {
            background: #0891b2;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(20, 184, 166, 0.4);
        }
        .diagram-open-btn svg {
            width: 18px;
            height: 18px;
        }
        
        /* Diagram Error Styles */
        .diagram-placeholder {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 2px dashed #0ea5e9;
            border-radius: 12px;
            padding: 40px 20px;
            margin: 16px 0;
            text-align: center;
        }
        .diagram-placeholder .placeholder-content {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }
        .diagram-placeholder svg {
            color: #0284c7;
        }
        .diagram-placeholder h4 {
            font-size: 16px;
            font-weight: 600;
            color: #0c4a6e;
            margin: 0;
        }
        .diagram-placeholder p {
            font-size: 11px;
            color: #075985;
            margin: 0;
        }
        .diagram-placeholder .view-diagram-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .diagram-placeholder .view-diagram-btn:hover {
            background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
        }
        .diagram-placeholder .placeholder-file {
            font-size: 10px;
            color: #64748b;
        }
        .diagram-placeholder .placeholder-file code {
            background: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .diagram-error {
            background: #fef2f2;
            border: 2px solid #ef4444;
            border-radius: 8px;
            padding: 20px;
            margin: 16px 0;
        }
        .diagram-error .error-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            color: #991b1b;
        }
        .diagram-error .error-header svg {
            width: 24px;
            height: 24px;
            stroke: #dc2626;
        }
        .diagram-error .error-header h4 {
            font-size: 14px;
            font-weight: 600;
            margin: 0;
        }
        .diagram-error .error-content {
            font-size: 11px;
            color: #7f1d1d;
        }
        .diagram-error .error-message {
            background: white;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 12px;
            border-left: 3px solid #dc2626;
        }
        .diagram-error .error-file {
            margin-bottom: 12px;
        }
        .diagram-error .error-file code {
            background: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 10px;
        }
        .diagram-error .error-debug {
            background: white;
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 12px;
        }
        .diagram-error .error-debug ul {
            margin: 8px 0 0 20px;
            padding: 0;
        }
        .diagram-error .error-debug li {
            margin: 4px 0;
        }
        .diagram-error .error-help {
            background: #fef3c7;
            padding: 10px;
            border-radius: 4px;
            border-left: 3px solid #f59e0b;
            color: #78350f;
        }
        .diagram-error kbd {
            background: #1f2937;
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 10px;
        }
        
        /* Embedded Dashboard Styles */
        .embedded-dashboard {
            margin: 20px 0;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            overflow: hidden;
            background: var(--vscode-editor-background);
        }
        .embedded-dashboard .dashboard-wrapper {
            /* Dashboard content inherits all dashboard styles */
        }
        .dashboard-error {
            background: #fee;
            border: 2px solid #c33;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            display: flex;
            gap: 16px;
        }
        .dashboard-error .error-icon {
            font-size: 32px;
            flex-shrink: 0;
        }
        .dashboard-error .error-content {
            flex: 1;
        }
        .dashboard-error h4 {
            margin: 0 0 12px 0;
            color: #c33;
        }
        .dashboard-error p {
            margin: 8px 0;
        }
        .dashboard-error code {
            background: rgba(0,0,0,0.1);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        .dashboard-error .error-recommendations {
            margin-top: 12px;
        }
        .dashboard-error ul {
            margin: 8px 0 0 20px;
            padding: 0;
        }
        .dashboard-error li {
            margin: 4px 0;
        }
        `;
    }

    /**
     * Generate JavaScript
     */
    private generateJavaScript(): string {
        return `
        console.log('[SpecRenderer JS] JavaScript is executing!');
        const vscode = { postMessage: (m) => console.log('[spec]', m) };
        
        console.log('[SpecRenderer JS] Setting up button listeners...');
        document.getElementById('btn-refresh').addEventListener('click', () => {
            console.log({ type: 'refresh' });
        });
        
        document.getElementById('btn-open-source').addEventListener('click', () => {
            console.log({ type: 'openSource' });
        });
        
        document.getElementById('btn-download-html').addEventListener('click', () => {
            console.log({ type: 'downloadHTML' });
        });
        
        // Search functionality with highlighting - works for both card view AND table view
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            // Store original HTML for each item
            const itemsOriginalHTML = new WeakMap();
            
            // Get BOTH card items AND table rows
            const cardItems = document.querySelectorAll('.spec-item');
            const tableRows = document.querySelectorAll('.data-table tbody tr');
            const allItems = [...cardItems, ...tableRows];
            
            allItems.forEach(item => {
                itemsOriginalHTML.set(item, item.innerHTML);
            });
            
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.trim();
                const searchLower = searchTerm.toLowerCase();
                
                allItems.forEach(item => {
                    // Restore original HTML first
                    const originalHTML = itemsOriginalHTML.get(item);
                    item.innerHTML = originalHTML;
                    
                    if (!searchTerm) {
                        // No search term - show all items
                        item.style.display = '';
                        return;
                    }
                    
                    const text = item.textContent.toLowerCase();
                    if (text.includes(searchLower)) {
                        // Item matches - show and highlight
                        item.style.display = '';
                        highlightSearchTerm(item, searchTerm);
                    } else {
                        // No match - hide
                        item.style.display = 'none';
                    }
                });
            });
        }
        
        // Highlight search term in element (case-insensitive)
        function highlightSearchTerm(element, searchTerm) {
            if (!searchTerm || searchTerm.length === 0) return;
            
            const walker = document.createTreeWalker(
                element,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            const nodesToReplace = [];
            let node;
            
            while (node = walker.nextNode()) {
                const text = node.nodeValue;
                const lowerText = text.toLowerCase();
                const lowerSearch = searchTerm.toLowerCase();
                
                if (lowerText.includes(lowerSearch)) {
                    nodesToReplace.push(node);
                }
            }
            
            nodesToReplace.forEach(node => {
                const text = node.nodeValue;
                const lowerText = text.toLowerCase();
                const lowerSearch = searchTerm.toLowerCase();
                
                let lastIndex = 0;
                const fragment = document.createDocumentFragment();
                
                let index = lowerText.indexOf(lowerSearch);
                while (index !== -1) {
                    // Add text before match
                    if (index > lastIndex) {
                        fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
                    }
                    
                    // Add highlighted match
                    const mark = document.createElement('mark');
                    mark.className = 'search-highlight';
                    mark.textContent = text.substring(index, index + searchTerm.length);
                    fragment.appendChild(mark);
                    
                    lastIndex = index + searchTerm.length;
                    index = lowerText.indexOf(lowerSearch, lastIndex);
                }
                
                // Add remaining text
                if (lastIndex < text.length) {
                    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
                }
                
                node.parentNode.replaceChild(fragment, node);
            });
        }
        
        // Delegated zoom + pan handlers (robust to dynamic DOM)
        const zoomStateByContainer = new WeakMap();
        let currentDraggingContainer = null;
        
        function getZoomState(container) {
            let state = zoomStateByContainer.get(container);
            if (!state) {
                state = { zoom: 1, panX: 0, panY: 0, dragging: false, startX: 0, startY: 0 };
                zoomStateByContainer.set(container, state);
            }
            return state;
        }
        
        function applyTransform(container) {
            const wrapper = container.querySelector('.diagram-svg-wrapper');
            if (!wrapper) return;
            const s = getZoomState(container);
            wrapper.style.transform = \`translate(\${s.panX}px, \${s.panY}px) scale(\${s.zoom})\`;
        }
        
        // Initialize cursors for any existing previews
        document.querySelectorAll('.diagram-preview').forEach(preview => {
            preview.style.cursor = 'grab';
        });
        
        // Zoom buttons (delegated)
        document.addEventListener('click', (e) => {
            const t = e.target;
            const btn = (t && t.closest) ? t.closest('.zoom-btn') : null;
            if (!btn) return;
            const container = btn.closest('.diagram-container');
            if (!container) return;
            e.stopPropagation();
            e.preventDefault();
            const action = btn.getAttribute('data-action');
            const s = getZoomState(container);
            if (action === 'zoom-in') {
                s.zoom = Math.min(s.zoom + 0.25, 3);
            } else if (action === 'zoom-out') {
                s.zoom = Math.max(s.zoom - 0.25, 0.5);
            } else if (action === 'zoom-reset') {
                s.zoom = 1;
                s.panX = 0;
                s.panY = 0;
            }
            applyTransform(container);
        }, true);
        
        // Pan start (delegated)
        document.addEventListener('mousedown', (e) => {
            const target = e.target;
            if (!target || !target.closest) return;
            const preview = target.closest('.diagram-preview');
            if (!preview) return;
            if (target.closest('.diagram-controls') || target.closest('.diagram-open-btn')) return;
            const container = preview.closest('.diagram-container');
            if (!container) return;
            const s = getZoomState(container);
            s.dragging = true;
            s.startX = e.clientX - s.panX;
            s.startY = e.clientY - s.panY;
            currentDraggingContainer = container;
            preview.style.cursor = 'grabbing';
            e.preventDefault();
        }, true);
        
        // Pan move (delegated)
        document.addEventListener('mousemove', (e) => {
            if (!currentDraggingContainer) return;
            const s = getZoomState(currentDraggingContainer);
            if (!s.dragging) return;
            s.panX = e.clientX - s.startX;
            s.panY = e.clientY - s.startY;
            applyTransform(currentDraggingContainer);
        });
        
        // Pan end (delegated)
        document.addEventListener('mouseup', () => {
            if (!currentDraggingContainer) return;
            const s = getZoomState(currentDraggingContainer);
            if (!s.dragging) return;
            s.dragging = false;
            const preview = currentDraggingContainer.querySelector('.diagram-preview');
            if (preview) preview.style.cursor = 'grab';
            currentDraggingContainer = null;
        });
        
        // Open diagram on overlay button click (delegated)
        document.addEventListener('click', (e) => {
            const t = e.target;
            const overlayBtn = (t && t.closest) ? t.closest('.diagram-overlay .diagram-open-btn') : null;
            if (!overlayBtn) return;
            const container = overlayBtn.closest('.diagram-container');
            if (!container) return;
            e.stopPropagation();
            e.preventDefault();
            const fsPath = container.getAttribute('data-fspath');
            const filepath = container.getAttribute('data-filepath');
            if (fsPath) {
                console.log({ type: 'openDiagram', fsPath, filepath });
            }
        }, true);
        
        // Open diagram on double-click (delegated) - prevents accidental opens during drag
        document.addEventListener('dblclick', (e) => {
            const target = e.target;
            if (!target || !target.closest) return;
            const container = target.closest('.diagram-container');
            if (!container) return;
            if (target.closest('.diagram-controls') || target.closest('.zoom-btn')) return;
            const fsPath = container.getAttribute('data-fspath');
            const filepath = container.getAttribute('data-filepath');
            if (fsPath) {
                console.log({ type: 'openDiagram', fsPath, filepath });
            }
        }, true);
        
        // Diagram placeholder button handlers
        document.querySelectorAll('.diagram-placeholder .view-diagram-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const placeholder = btn.closest('.diagram-placeholder');
                const fsPath = placeholder.getAttribute('data-fspath');
                const filepath = placeholder.getAttribute('data-filepath');
                console.log({ type: 'openDiagram', fsPath, filepath });
            });
        });
        `;
    }
}
