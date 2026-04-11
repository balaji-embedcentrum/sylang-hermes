/**
 * DSL Serializer - Converts Tiptap JSON → DSL Text
 * Generic and scalable for all Sylang file extensions
 */

import { SylangTiptapDocument, SylangBlockNode, UseBlockAttributes, HeaderBlockAttributes, DefinitionBlockAttributes, CommentBlockAttributes } from '../types/sylangTypes';
import { getFileTypeConfig } from '../utils/fileTypeConfig';
import { getPropertySchema, isRichTextProperty } from '../utils/propertyIntrospection';
import { SylangKeywordManager } from '../core/keywords';

/**
 * Serialize Tiptap document to DSL text
 */
export function serializeToDSL(tiptapDoc: SylangTiptapDocument, fileExtension: string): string {
    const lines: string[] = [];
    const config = getFileTypeConfig(fileExtension);
    if (!config) return '';

    for (const block of tiptapDoc.content) {
        switch (block.type) {
            case 'useBlock':
                serializeUseBlockNode(block as any, lines);
                break;
            case 'headerBlock':
                serializeHeaderBlockNode(block as any, config, fileExtension, lines, 0);
                break;
            case 'definitionBlock':
                serializeDefinitionBlockNode(block as any, config, fileExtension, lines, 0);
                break;
            case 'commentBlock':
                serializeCommentBlock(block.attrs as CommentBlockAttributes, lines, 0);
                break;
        }
    }

    return lines.join('\n');
}



function prettyHtmlForReqif(html: string): string {
    const trimmed = (html || '').trim();
    if (!trimmed) return '';
    // Insert newlines between tags for readability in exported/imported REQIF.
    // Only between tags (safe whitespace in HTML).
    return trimmed.replace(/></g, '>\n<');
}

function normalizeDescriptionForDsl(input: string): { text: string; isHtml: boolean } {
    const trimmed = (input || '').trim();
    if (!trimmed) return { text: '', isHtml: false };

    // Fast path: no tags at all => treat as plain text
    if (!/[<>]/.test(trimmed)) {
        return { text: trimmed, isHtml: false };
    }

    // If there are tags beyond simple <p> / <br>, keep as HTML.
    const hasNonParagraphTags = /<(?!\/?(p|br)\b)[a-zA-Z][^>]*>/i.test(trimmed);
    if (hasNonParagraphTags) {
        return { text: trimmed, isHtml: true };
    }

    // Treat paragraph-only HTML as plain text so property edits don't rewrite the whole file.
    let s = trimmed;
    s = s.replace(/<\/p>\s*<p>/gi, '\n');
    s = s.replace(/<br\s*\/?>/gi, '\n');
    s = s.replace(/<\/?p>/gi, '');
    s = s.trim();

    // If anything tag-like remains, keep original HTML.
    if (/[<>]/.test(s)) {
        return { text: trimmed, isHtml: true };
    }

    return { text: s, isHtml: false };
}

function serializeTextOrTripleQuoted(lines: string[], indent: string, key: string, value: string): void {
    const textValue = String(value ?? '');
    if (!textValue.trim()) return;

    const singleLine = !textValue.includes('\n');

    if (singleLine) {
        // Always use triple quotes for single-line string values
        lines.push(`${indent}${key} """${textValue}"""`);
        return;
    }

    lines.push(`${indent}${key} """`);
    for (const l of textValue.split('\n')) lines.push(l);
    lines.push(`${indent}"""`);
}

function serializeTagsProperty(lines: string[], indent: string, rawValue: string): void {
    const v = String(rawValue ?? '').trim();
    if (!v) return;
    // Accept either: 'a, b, c' or '"a", "b"' etc; normalize to: tags "a", "b", "c"
    const cleaned = v.replace(/"/g, '');
    const tags = cleaned.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length === 0) return;
    const rhs = tags.map(t => `"${t}"`).join(', ');
    lines.push(`${indent}tags ${rhs}`);
}

/**
 * Serialize use block to DSL
 * Only includes rows that have both setType and setId filled
 */
function serializeUseBlockNode(block: any, lines: string[]): void {
    const table = findFirstTable(block);
    if (table) {
        const rows = readTableRows(table);
        let wrote = false;
        for (const row of rows) {
            const setType = (row[0] || '').trim();
            const setId = (row[1] || '').trim();
            if (setType && setId) {
                lines.push(`use ${setType} ${setId}`);
                wrote = true;
            }
        }
        if (wrote) {
            lines.push('');
        }
        return;
    }

    // Backward compat: old format stored rows in attrs
    const attrs = (block.attrs || {}) as UseBlockAttributes;
    for (const row of (attrs.rows || [])) {
        if (row.setType && row.setId) {
            lines.push(`use ${row.setType} ${row.setId}`);
        }
    }
    if ((attrs.rows || []).some(r => r.setType && r.setId)) {
        lines.push('');
    }
}

/**
 * Serialize header block (hdef) to DSL
 */
function serializeHeaderBlockNode(
    block: any,
    config: any,
    fileExtension: string,
    lines: string[],
    depth: number
): void {
    const attrs = (block.attrs || {}) as any;
    // Use indentLevel from attrs (flat structure with visual indentation)
    const indent = '  '.repeat(attrs.indentLevel ?? depth);
    const tables = findAllTables(block);
    const propertyTable = tables.find(t => isPropertyTable(t));
    const relationsTable = tables.find(t => isRelationsTable(t));
    const propertiesFromTable = propertyTable ? readPropertyTable(propertyTable) : null;
    const relationsFromTable = relationsTable ? readRelationsTable(relationsTable) : null;

    // hdef keyword identifier
    lines.push(`${indent}hdef ${attrs.headerKeyword} ${attrs.headerId}`);

    // Serialize properties
    const propertySchemas = getPropertySchema(fileExtension);
    const props = propertiesFromTable ?? (attrs.properties || {});

    // Meta data (requirementset) excludes requirement-only properties.
    const excludedForMeta = new Set([
        'infotype',
        'headinglevel',
        'rationale',
        'verificationcriteria',
        'reqtype',
        'attach',
        'proposal',
        // Critical: prevent block keywords from appearing as properties if they leak into the table
        'def',
        'hdef'
    ]);

    const propIndent = indent + '  ';

    // name
    const headerName = (attrs as any).headerName;
    if (headerName) {
        if (headerName.includes('\n')) {
            lines.push(`${propIndent}name """`);
            lines.push(headerName);
            lines.push(`${propIndent}"""`);
        } else {
            lines.push(`${propIndent}name """${headerName}"""`);
        }
    }

    // description
    const descriptionHtml = (attrs as any).descriptionHtml;
    const normalized = normalizeDescriptionForDsl(String(descriptionHtml ?? ''));
    if (normalized.text) {
        if (normalized.isHtml) {
            const pretty = prettyHtmlForReqif(normalized.text);
            serializeTextOrTripleQuoted(lines, propIndent, 'description', pretty);
        } else {
            serializeTextOrTripleQuoted(lines, propIndent, 'description', normalized.text);
        }
    }

    for (const [key, value] of Object.entries(props)) {
        if (key === 'name' || key === 'description') continue;
        if (attrs.headerKeyword === 'requirementset' && excludedForMeta.has(key)) continue;
        if (!value) continue;

        const schema = propertySchemas.find(s => s.name === key);
        if (schema?.type === 'enum') {
            lines.push(`${propIndent}${key} ${value}`);
        } else {
            if (key.toLowerCase() === 'tags') {
                serializeTagsProperty(lines, propIndent, String(value));
                continue;
            }
            const textValue = String(value);
            if (textValue.includes('\n')) {
                lines.push(`${propIndent}${key} """`);
                lines.push(textValue);
                lines.push(`${propIndent}"""`);
            } else {
                lines.push(`${propIndent}${key} """${textValue}"""`);
            }
        }
    }

    // Serialize header relations
    const rels = relationsFromTable ?? (attrs as any).relations ?? [];
    if (rels && rels.length > 0) {
        for (const relation of rels) {
            if (relation.relationKeyword && relation.nodeType && relation.targetId) {
                const flagsSuffix = relation.flags ? ` ${relation.flags}` : '';
                lines.push(`${indent}  ${relation.relationKeyword} ref ${relation.nodeType} ${relation.targetId}${flagsSuffix}`);
            }
        }
    }

    // No nested content processing - all blocks are flat at root level

    lines.push(''); // Blank line after header
}

/**
 * Serialize definition block (def) to DSL
 */
function serializeDefinitionBlockNode(
    block: any,
    config: any,
    fileExtension: string,
    lines: string[],
    depth: number
): void {
    const attrs = (block.attrs || {}) as any;
    // Use indentLevel from attrs (flat structure with visual indentation)
    const indent = '  '.repeat(attrs.indentLevel ?? depth);
    const tables = findAllTables(block);
    const propertyTable = tables.find(t => isPropertyTable(t));
    const relationsTable = tables.find(t => isRelationsTable(t));
    const propertiesFromTable = propertyTable ? readPropertyTable(propertyTable) : null;
    const relationsFromTable = relationsTable ? readRelationsTable(relationsTable) : null;

    // def keyword identifier
    // For config blocks, append the configValue (1 or 0) after the ID
    const configValueSuffix = attrs.defKeyword === 'config' && attrs.configValue !== undefined
        ? ` ${attrs.configValue}` : '';
    lines.push(`${indent}def ${attrs.defKeyword} ${attrs.defId}${configValueSuffix}`);

    // Serialize properties
    const propertySchemas = getPropertySchema(fileExtension);
    const props = propertiesFromTable ?? (attrs.properties || {});

    // `name` is edited via toggle title (attrs). Emit it first for stable UX.
    const defName = (attrs as any).defName ?? (props as any).name;
    if (defName !== null && defName !== undefined && String(defName).trim() !== '') {
        const textValue = String(defName);
        const propIndent = indent + '  ';
        if (isRichTextProperty('name') && textValue.includes('\n')) {
            lines.push(`${propIndent}name """`);
            lines.push(textValue);
            lines.push(`${propIndent}"""`);
        } else {
            lines.push(`${propIndent}name """${textValue}"""`);
        }
    }

    // `description` is edited via rich editor (attrs). Emit it next as HTML triple-quoted.
    const descriptionHtml = (attrs as any).descriptionHtml ?? (props as any).description;
    const normalized = normalizeDescriptionForDsl(String(descriptionHtml ?? ''));
    if (normalized.text) {
        const propIndent = indent + '  ';
        if (normalized.isHtml) {
            const pretty = prettyHtmlForReqif(normalized.text);
            serializeTextOrTripleQuoted(lines, propIndent, 'description', pretty);
        } else {
            serializeTextOrTripleQuoted(lines, propIndent, 'description', normalized.text);
        }
    }

    for (const [key, value] of Object.entries(props)) {
        if (key === 'name') continue;
        if (key === 'description') continue;
        // Block property keys
        if (key === 'def' || key === 'hdef') continue;

        if (value === null || value === undefined || value === '') {
            continue;
        }

        const schema = propertySchemas.find(s => s.name === key);
        // IMPORTANT (lossless-ish): don't drop unknown/extensible properties.
        // If schema is missing, we still serialize it as a quoted string by default.

        const propIndent = indent + '  ';

        // Handle enum values
        if (schema?.type === 'enum') {
            lines.push(`${propIndent}${key} ${value}`);
        }
        // Handle rich text
        else if (isRichTextProperty(key)) {
            if (key.toLowerCase() === 'tags') {
                serializeTagsProperty(lines, propIndent, String(value));
                continue;
            }
            const textValue = String(value);
            if (textValue.includes('\n')) {
                lines.push(`${propIndent}${key} """`);
                lines.push(textValue);
                lines.push(`${propIndent}"""`);
            } else {
                lines.push(`${propIndent}${key} """${textValue}"""`);
            }
        }
        // Handle regular text
        else {
            if (key.toLowerCase() === 'tags') {
                serializeTagsProperty(lines, propIndent, String(value));
                continue;
            }
            const textValue = String(value);
            if (textValue.includes('\n')) {
                lines.push(`${propIndent}${key} """`);
                lines.push(textValue);
                lines.push(`${propIndent}"""`);
            } else {
                lines.push(`${propIndent}${key} """${textValue}"""`);
            }
        }
    }

    // Serialize relations
    const rels = relationsFromTable ?? (attrs.relations || []);
    if (rels && rels.length > 0) {
        for (const relation of rels) {
            if (relation.relationKeyword && relation.nodeType && relation.targetId) {
                const flagsSuffix = relation.flags ? ` ${relation.flags}` : '';
                lines.push(`${indent}  ${relation.relationKeyword} ref ${relation.nodeType} ${relation.targetId}${flagsSuffix}`);
            }
        }
    }

    // No nested content processing - all blocks are flat at root level

    lines.push(''); // Blank line after definition
}

function isTableNode(n: any): boolean {
    return !!n && n.type === 'table';
}

function findFirstTable(block: any): any | null {
    const content = block?.content;
    if (!Array.isArray(content)) return null;
    return content.find(isTableNode) || null;
}

function findAllTables(block: any): any[] {
    const content = block?.content;
    if (!Array.isArray(content)) return [];
    return content.filter(isTableNode);
}

function nodeText(node: any): string {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.type === 'hardBreak') return '\n';
    const children = Array.isArray(node.content) ? node.content : [];
    if (children.length === 0) return '';
    // Join paragraphs with newline; otherwise join directly.
    if (node.type === 'paragraph') {
        return children.map(nodeText).join('');
    }
    return children.map(nodeText).join('');
}

function cellText(cell: any): string {
    const children = Array.isArray(cell?.content) ? cell.content : [];
    // Usually paragraph(s) inside
    const parts = children.map(nodeText).filter(Boolean);
    return parts.join('\n').trim();
}

function readTableRows(table: any): string[][] {
    const rows = Array.isArray(table?.content) ? table.content : [];
    // Skip header row (index 0)
    return rows.slice(1).map((rowNode: any) => {
        const cells = Array.isArray(rowNode?.content) ? rowNode.content : [];
        return cells.map(cellText);
    });
}

function headerRowTexts(table: any): string[] {
    const rows = Array.isArray(table?.content) ? table.content : [];
    const headerRow = rows[0];
    const cells = Array.isArray(headerRow?.content) ? headerRow.content : [];
    return cells.map(cellText);
}

function isPropertyTable(table: any): boolean {
    const headers = headerRowTexts(table).map(h => h.toLowerCase());
    return headers.length >= 2 && headers[0] === 'property' && headers[1] === 'value';
}

function isRelationsTable(table: any): boolean {
    // Check sylangTableType attribute first (most reliable)
    if (table?.attrs?.sylangTableType === 'relations') return true;
    // Fallback: check header text for backward compatibility
    const headers = headerRowTexts(table).map(h => h.toLowerCase());
    return headers.length >= 3 && headers[0] === 'relation' && headers[1] === 'node type' && headers[2] === 'id';
}

function readPropertyTable(table: any): Record<string, any> {
    const props: Record<string, any> = {};
    const rows = readTableRows(table);
    for (const row of rows) {
        const key = (row[0] || '').trim();
        const value = (row[1] || '').trim();
        if (!key) continue;
        // UI-only row (we render ID inside the table, but it is NOT a DSL property)
        if (key.toLowerCase() === 'id') continue;
        props[key] = value;
    }
    return props;
}

function readRelationsTable(table: any): Array<{ relationKeyword: string; nodeType: string; targetId: string; flags?: string }> {
    const rels: Array<{ relationKeyword: string; nodeType: string; targetId: string; flags?: string }> = [];
    const rows = readTableRows(table);
    for (const row of rows) {
        const relationKeyword = (row[0] || '').trim();
        const nodeType = (row[1] || '').trim();
        const targetId = (row[2] || '').trim();
        if (!relationKeyword || !nodeType || !targetId) continue;
        const flags = (row[3] || '').trim();
        rels.push({ relationKeyword, nodeType, targetId, flags: flags || undefined });
    }
    return rels;
}

/**
 * Serialize comment block to DSL
 * Headers: //h1: text, //h2: text, //h3: text (h1 can omit prefix)
 * Paragraphs: multi-line blocks wrapped in slash-star delimiters
 */
function serializeCommentBlock(attrs: any, lines: string[], depth: number): void {
    // Use indentLevel from attrs if provided, otherwise fall back to depth
    const indentLevel = attrs.indentLevel ?? depth;
    const indent = '  '.repeat(indentLevel);
    const headerLevel = attrs.headerLevel ?? 1;

    if (attrs.type === 'heading') {
        // Single-line header comment with level prefix
        // Always use explicit //h1:, //h2:, //h3: format for consistency
        lines.push(`${indent}//h${headerLevel}: ${attrs.text}`);
    } else {
        // Multi-line paragraph comment
        // IMPORTANT: Strip any existing /* and */ markers to prevent nesting
        let cleanText = (attrs.text || '').toString();

        // Strip leading /* markers (with possible spaces between them)
        while (cleanText.trim().startsWith('/*')) {
            cleanText = cleanText.trim().substring(2).trim();
        }
        // Strip trailing */ markers
        while (cleanText.trim().endsWith('*/')) {
            cleanText = cleanText.trim().slice(0, -2).trim();
        }

        const textLines = cleanText.split('\n');
        if (textLines.length === 1 && !textLines[0].trim()) {
            // Empty paragraph - skip
            return;
        } else if (textLines.length === 1) {
            lines.push(`${indent}/* ${textLines[0]} */`);
        } else {
            lines.push(`${indent}/*`);
            for (const line of textLines) {
                lines.push(`${indent}${line}`);
            }
            lines.push(`${indent}*/`);
        }
    }
    lines.push('');
}
