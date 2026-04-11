/**
 * DSL Parser - Converts DSL Text → Tiptap JSON
 * Generic and scalable for all Sylang file extensions
 * Handles indentation-based hierarchical structure
 */

import { SylangTiptapDocument, SylangBlockNode, UseBlockAttributes, HeaderBlockAttributes, DefinitionBlockAttributes, CommentBlockAttributes, UseRow, RelationRow } from '../types/sylangTypes';
import { getFileTypeConfig } from '../utils/fileTypeConfig';
import { getPropertySchema, isRichTextProperty } from '../utils/propertyIntrospection';
import { preserveOrGenerateId, extractIdFromDefLine } from '../utils/idManager';
import { getAllowedProperties, getAllowedEnums } from '../utils/editorSchema';

interface ParsedLine {
    indentLevel: number;
    keyword: string;
    tokens: string[];
    rawLine: string;
    lineIndex: number;
}

/**
 * Parse DSL text to Tiptap document
 */
export function parseDSLToTiptap(dslText: string, fileExtension: string): SylangTiptapDocument {
    const config = getFileTypeConfig(fileExtension);
    if (!config) return { type: 'doc', content: [] };

    const parsedLines = parseLines(dslText.split('\n'));
    const rootContent: any[] = [];

    // Track active blocks per indent level
    interface BlockEntry {
        node: any;
        indentLevel: number;
        properties: Record<string, any>;
        relations: RelationRow[];
    }
    const stack: BlockEntry[] = [];
    let useRows: UseRow[] = [];

    // Track indent violations for error reporting
    const indentErrors: Array<{ line: number; message: string }> = [];

    const finalizeBlock = (entry: BlockEntry) => {
        const { node, properties, relations, indentLevel } = entry;
        const isHeader = node.type === 'headerBlock';
        const fileSchema = getPropertySchema(fileExtension);

        // Get block type for filtering properties/enums via editorSchema.ts
        const blockType = isHeader ? (node.attrs.headerKeyword || '') : (node.attrs.defKeyword || '');
        const allowedProps = getAllowedProperties(blockType);
        const allowedEnumsForBlock = getAllowedEnums(blockType);
        const allowedSet = new Set([...allowedProps, ...allowedEnumsForBlock]);

        // Extract common fields
        const name = String(properties.name ?? '').trim();
        // IMPORTANT: do NOT trim description; trimming breaks indentation and makes roundtrips non-idempotent.
        // (This was causing large diffs and triggering the safeguard on unrelated edits.)
        const descriptionHtml = String(properties.description ?? '');

        // Prepare Attributes
        if (isHeader) {
            node.attrs = {
                ...node.attrs,
                headerName: name,
                descriptionHtml,
                indentLevel,
                collapsed: false
            };
        } else {
            node.attrs = {
                ...node.attrs,
                defName: name,
                descriptionHtml,
                indentLevel,
                collapsed: false
            };
        }

        // Prepare Tables
        const propRows: Array<[string, string]> = [];
        const excludedForMeta = isHeader && node.attrs.headerKeyword === 'requirementset'
            ? new Set(['infotype', 'headinglevel', 'rationale', 'verificationcriteria', 'reqtype', 'attach', 'proposal'])
            : new Set();

        // Preserve the property order as written in the file (insertion order of `properties`).
        // This keeps table row order stable and avoids rewrites on first edit.
        const added = new Set<string>();
        const schemaByName = new Map(fileSchema.map(s => [s.name, s]));
        for (const k of Object.keys(properties)) {
            if (k === 'name' || k === 'description') continue;
            if (excludedForMeta.has(k)) continue;
            const s = schemaByName.get(k);
            if ((s as any)?.type === 'relation') continue;
            // Only include if allowed by editorSchema.ts OR if it has a value (preserve user data)
            if (!allowedSet.has(k) && !String(properties[k] ?? '').trim()) continue;
            propRows.push([k, String(properties[k] ?? '')]);
            added.add(k);
        }
        // Append remaining schema keys (empty) for UI completeness - FILTERED by editorSchema.ts
        for (const schema of fileSchema) {
            if (schema.name === 'name' || schema.name === 'description') continue;
            if ((schema as any).type === 'relation') continue;
            if (excludedForMeta.has(schema.name)) continue;
            if (added.has(schema.name)) continue;
            // FILTER: Only add properties/enums allowed by editorSchema.ts
            if (!allowedSet.has(schema.name)) continue;
            propRows.push([schema.name, String(properties[schema.name] ?? '')]);
        }

        const relData: Array<[string, string, string]> = relations.map(r => [r.relationKeyword, r.nodeType, r.targetId]);
        if (relData.length === 0) relData.push(['', '', '']); // Always show one row

        // Tables are the content (prepend them to existing children)
        const existingChildren = node.content || [];
        node.content = [
            buildPropertyTableNode(propRows),
            buildRelationsTableNode(relData as any),
            ...existingChildren
        ];
    };

    for (let i = 0; i < parsedLines.length; i++) {
        const line = parsedLines[i];
        if (!line.keyword) continue;

        // Finalize blocks that are deeper than current line indent
        while (stack.length > 0 && stack[stack.length - 1].indentLevel >= line.indentLevel) {
            finalizeBlock(stack.pop()!);
        }

        if (line.keyword === 'use' && line.indentLevel === 0) {
            useRows.push({ setType: line.tokens[1] || '', setId: line.tokens.slice(2).join(' ') });
            continue;
        }

        if (line.keyword === 'hdef' || line.keyword === 'def') {
            const isHdef = line.keyword === 'hdef';
            const keyword = line.tokens[1];
            const rawId = isHdef ? line.tokens[2] : extractIdFromDefLine(line.tokens);
            const id = preserveOrGenerateId(rawId, fileExtension);

            // INDENT VALIDATION
            if (isHdef) {
                // hdef must be at indent level 0
                if (line.indentLevel !== 0) {
                    indentErrors.push({
                        line: line.lineIndex + 1, // 1-based line numbers
                        message: `hdef '${keyword}' must be at indent level 0, found at indent ${line.indentLevel}`
                    });
                }
            } else {
                // def must be indented more than its parent
                const parentIndent = stack.length > 0 ? stack[stack.length - 1].indentLevel : -1;
                if (line.indentLevel <= parentIndent) {
                    const parentType = stack.length > 0 ? (stack[stack.length - 1].node.type === 'headerBlock' ? 'hdef' : 'def') : 'root';
                    indentErrors.push({
                        line: line.lineIndex + 1,
                        message: `def '${keyword}' (indent ${line.indentLevel}) must be indented more than parent ${parentType} (indent ${parentIndent})`
                    });
                }
            }

            const newBlock: any = {
                type: isHdef ? 'headerBlock' : 'definitionBlock',
                attrs: isHdef
                    ? { headerKeyword: keyword, headerId: id, indentLevel: line.indentLevel }
                    : {
                        defKeyword: keyword,
                        defId: id,
                        indentLevel: line.indentLevel,
                        // For config blocks, preserve the value (1 or 0) from the 4th token
                        configValue: keyword === 'config' && line.tokens[3] !== undefined
                            ? parseInt(line.tokens[3]) || 0
                            : undefined
                    },
                content: []
            };

            // ALWAYS push to root (flat structure, CSS handles visual indentation)
            rootContent.push(newBlock);

            const entry: BlockEntry = {
                node: newBlock,
                indentLevel: line.indentLevel,
                properties: {},
                relations: []
            };
            stack.push(entry);

            // Parse ONLY properties/relations
            i = parseBlockContent(parsedLines, i + 1, entry, config, fileExtension);
            continue;
        }

        // Inline comments - parse header levels (//h1:, //h2:, //h3:) and track indentation
        if (line.rawLine.trim().startsWith('//')) {
            const commentText = line.rawLine.trim().substring(2).trim();
            let headerLevel = 1; // Default level
            let headerText = commentText;

            // Parse header level syntax: //h1:, //h2:, //h3:
            const levelMatch = commentText.match(/^h([123]):\s*(.*)$/i);
            if (levelMatch) {
                headerLevel = parseInt(levelMatch[1], 10);
                headerText = levelMatch[2].trim();
            }

            rootContent.push({
                type: 'commentBlock',
                attrs: {
                    type: 'heading',
                    headerLevel: headerLevel,
                    text: headerText,
                    collapsed: false,
                    indentLevel: line.indentLevel
                }
            });
            continue;
        }

        // Multi-line comments (/* ... */) - rendered as paragraph/info blocks
        if (line.rawLine.trim().startsWith('/*')) {
            let commentText = '';
            const trimmedLine = line.rawLine.trim();

            // Check for single-line comment: /* text */
            if (trimmedLine.endsWith('*/')) {
                // Single line - strip both /* and */
                commentText = trimmedLine.substring(2, trimmedLine.length - 2).trim();
            } else {
                // Multi-line comment
                let j = i;
                while (j < parsedLines.length && !parsedLines[j].rawLine.trim().endsWith('*/')) {
                    if (j === i) commentText += parsedLines[j].rawLine.trim().substring(2);
                    else commentText += '\n' + parsedLines[j].rawLine.trim();
                    j++;
                }
                if (j < parsedLines.length) {
                    // Strip the closing */ from the last line
                    const lastLine = parsedLines[j].rawLine.trim();
                    commentText += '\n' + lastLine.substring(0, lastLine.length - 2).trim();
                    i = j;
                }
            }

            rootContent.push({
                type: 'commentBlock',
                attrs: {
                    type: 'paragraph',
                    text: commentText.trim(),
                    collapsed: false,
                    indentLevel: line.indentLevel
                }
            });
            continue;
        }
    }

    // Check for indent violations before finalizing
    if (indentErrors.length > 0) {
        const errorMsg = indentErrors
            .map(e => `  Line ${e.line}: ${e.message}`)
            .join('\n');
        throw new Error(`Invalid Sylang syntax - indentation errors found:\n${errorMsg}\n\nPlease fix these errors in the text editor.`);
    }

    // Finalize all remaining blocks
    while (stack.length > 0) finalizeBlock(stack.pop()!);

    // File types that don't need a useBlock (no 'use' import mechanism)
    const noUseBlockExtensions = ['.ple'];
    const skipUseBlock = noUseBlockExtensions.includes(fileExtension.toLowerCase());

    const finalContent: any[] = [];

    // Only add useBlock for file types that support 'use' imports
    if (!skipUseBlock) {
        finalContent.push({
            type: 'useBlock',
            attrs: { collapsed: false },
            content: [buildUseTableNode(useRows.length > 0 ? useRows : [{ setType: '', setId: '' }])]
        });
    }
    finalContent.push(...rootContent);

    return { type: 'doc', content: finalContent };
}

function parseBlockContent(
    parsedLines: ParsedLine[],
    startIndex: number,
    entry: { properties: Record<string, any>, relations: RelationRow[] },
    config: any,
    fileExtension: string
): number {
    const parentIndent = entry === (null as any) ? -1 : (entry as any).indentLevel;
    const propertySchemas = getPropertySchema(fileExtension);
    let i = startIndex;

    while (i < parsedLines.length) {
        const line = parsedLines[i];
        if (!line.keyword) { i++; continue; }

        // STOP if we hit a new block at ANY level (leaking prevention)
        if (line.keyword === 'def' || line.keyword === 'hdef') break;
        // STOP if we hit a comment (should be parsed as a separate block)
        if (line.rawLine.trim().startsWith('//') || line.rawLine.trim().startsWith('/*')) break;
        // STOP if indent level is same or lower than parent
        if (line.indentLevel <= parentIndent) break;

        const keyword = line.tokens[0];
        if (config.allowedRelations.includes(keyword)) {
            if (line.tokens[1] === 'ref' && line.tokens.length >= 4) {
                const flags = line.tokens.slice(4).join(' ');
                entry.relations.push({ relationKeyword: keyword, nodeType: line.tokens[2], targetId: line.tokens[3], flags: flags || undefined });
            }
        } else {
            const schema = propertySchemas.find(s => s.name === keyword);
            if (schema?.type === 'enum') {
                entry.properties[keyword] = line.tokens[1] || '';
            } else {
                let value = '';
                const remaining = line.rawLine.trim().substring(keyword.length).trim();
                if (remaining.startsWith('"""')) {
                    const tripleResult = parseTripleQuotedString(parsedLines, i);
                    value = tripleResult.value;
                    // Jump i directly to the closing """ line (returned by parser).
                    // For single-line """text""", endIndex === startIndex so no skip.
                    i = tripleResult.endIndex;
                    // loop will i++ at end
                } else {
                    value = line.tokens.slice(1).join(' ').replace(/^"|"$/g, '');
                }
                entry.properties[keyword] = value;
            }
        }
        i++;
    }
    return i - 1;
}

function buildTextNode(text: string): any {
    return { type: 'text', text };
}

function buildParagraphNode(text: string): any {
    return {
        type: 'paragraph',
        content: text ? [buildTextNode(text)] : []
    };
}

function buildTableCellNode(text: string, cellType: 'tableCell' | 'tableHeader' = 'tableCell'): any {
    return {
        type: cellType,
        content: [buildParagraphNode(text)]
    };
}

function buildTableNode(headers: string[], rows: string[][], tableType?: 'use' | 'properties' | 'relations'): any {
    return {
        type: 'table',
        attrs: tableType ? { sylangTableType: tableType } : {},
        content: [
            {
                type: 'tableRow',
                content: headers.map(h => buildTableCellNode(h, 'tableHeader'))
            },
            ...rows.map((r) => ({
                type: 'tableRow',
                content: r.map(c => buildTableCellNode(c, 'tableCell'))
            }))
        ]
    };
}

function buildUseTableNode(useRows: UseRow[]): any {
    const rows = useRows.map(r => [r.setType || '', r.setId || '']);
    return buildTableNode(['Set', 'ID'], rows, 'use');
}

function buildPropertyTableNode(propRows: Array<[string, string]>): any {
    return buildTableNode(['Property', 'Value'], propRows.map(r => [r[0] || '', r[1] || '']), 'properties');
}

function buildRelationsTableNode(relRows: Array<[string, string, string]>): any {
    return buildTableNode(['Relation', 'Node Type', 'ID'], relRows.map(r => [r[0] || '', r[1] || '', r[2] || '']), 'relations');
}

/**
 * Parse lines into structured format
 */
function parseLines(lines: string[]): ParsedLine[] {
    return lines.map((line, index) => {
        const indentLevel = getIndentLevel(line);
        const trimmed = line.trim();

        // Handle line continuations (backslash at end)
        let fullLine = trimmed;
        let i = index;
        while (i < lines.length - 1 && lines[i].trim().endsWith('\\')) {
            fullLine = fullLine.slice(0, -1) + ' ' + lines[i + 1].trim();
            i++;
        }

        const tokens = parseTokens(fullLine);
        const keyword = tokens[0] || '';

        return {
            indentLevel,
            keyword,
            tokens,
            rawLine: line,
            lineIndex: index
        };
    });
}

/**
 * Get indent level (2 spaces = 1 level)
 */
function getIndentLevel(line: string): number {
    let indent = 0;
    for (const char of line) {
        if (char === ' ' || char === '\u00A0') {
            indent++;
        } else if (char === '\t') {
            indent += 2;
        } else {
            break;
        }
    }
    return Math.floor(indent / 2);
}

/**
 * Parse tokens from a line (handles quoted strings)
 */
function parseTokens(line: string): string[] {
    const tokens: string[] = [];
    let currentToken = '';
    let inQuotes = false;
    let inTripleQuotes = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextTwo = line.substring(i, i + 3);

        // Handle triple quotes
        if (nextTwo === '"""' && !inQuotes) {
            if (inTripleQuotes) {
                // End of triple quotes
                tokens.push(currentToken);
                currentToken = '';
                inTripleQuotes = false;
                i += 3;
                continue;
            } else {
                // Start of triple quotes
                if (currentToken.trim()) {
                    tokens.push(currentToken.trim());
                    currentToken = '';
                }
                inTripleQuotes = true;
                i += 3;
                continue;
            }
        }

        if (inTripleQuotes) {
            currentToken += char;
            i++;
            continue;
        }

        // Handle regular quotes
        if (char === '"') {
            if (inQuotes) {
                tokens.push(currentToken);
                currentToken = '';
                inQuotes = false;
            } else {
                if (currentToken.trim()) {
                    tokens.push(currentToken.trim());
                    currentToken = '';
                }
                inQuotes = true;
            }
        } else if (inQuotes) {
            currentToken += char;
        } else if (char === ' ' || char === '\t') {
            if (currentToken.trim()) {
                tokens.push(currentToken.trim());
                currentToken = '';
            }
        } else {
            currentToken += char;
        }
        i++;
    }

    if (currentToken.trim()) {
        tokens.push(currentToken.trim());
    }

    return tokens;
}



/**
 * Parse triple-quoted string (multiline)
 * Returns both the parsed value and the index of the line containing the closing """
 */
function parseTripleQuotedString(parsedLines: ParsedLine[], startIndex: number): { value: string; endIndex: number } {
    let value = '';
    let i = startIndex;
    const startLine = parsedLines[i].rawLine.trim();

    // Remove opening """
    const startContent = startLine.substring(startLine.indexOf('"""') + 3);
    if (startContent.trim().endsWith('"""')) {
        // Single-line triple quotes: """text"""
        return {
            value: startContent.substring(0, startContent.length - 3),
            endIndex: startIndex  // same line, no advancement needed
        };
    }

    value = startContent;
    i++;

    // Collect lines until closing """
    while (i < parsedLines.length) {
        const line = parsedLines[i].rawLine;
        if (line.trim().includes('"""')) {
            // Found closing """
            const endIndex = line.indexOf('"""');
            value += '\n' + line.substring(0, endIndex);
            // Avoid an extra blank first line when the opening """ was alone on the line.
            if (value.startsWith('\n')) value = value.slice(1);
            if (value.endsWith('\n')) value = value.slice(0, -1);
            return { value, endIndex: i };
        } else {
            value += '\n' + line;
        }
        i++;
    }

    // Avoid an extra blank first line when the opening """ was alone on the line.
    if (value.startsWith('\n')) value = value.slice(1);
    if (value.endsWith('\n')) value = value.slice(0, -1);
    return { value, endIndex: i - 1 };
}
