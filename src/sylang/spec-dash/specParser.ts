/**
 * Parser for Sylang Specification (.spec) files
 */


import { SpecDocument, SpecHeader, SpecSection, SpecContent, SourceReference } from './types';
import { QueryEngine } from './queryEngine';

export class SpecParser {
    /**
     * Parse a .spec file into a structured document
     */
    static async parseText(text: string, sourceFile: string): Promise<SpecDocument> {
        const lines = text.split('\n');
        const header = this.parseHeader(lines);
        const sections = this.parseSections(lines);
        
        return {
            header,
            sections,
            sourceFile: sourceFile
        };
    }
    
    /**
     * Parse header definition
     */
    private static parseHeader(lines: string[]): SpecHeader {
        const header: SpecHeader = {
            id: '',
            name: '',
            generatedDate: new Date().toISOString()
        };
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Find hdef specification
            const hdefMatch = line.match(/^hdef\s+specification\s+(\w+)/);
            if (hdefMatch) {
                header.id = hdefMatch[1];
                
                // Parse properties under hdef
                for (let j = i + 1; j < lines.length; j++) {
                    const propLine = lines[j].trim();
                    
                    // Stop at next def or hdef
                    if (propLine.startsWith('def ') || propLine.startsWith('hdef ')) {
                        break;
                    }
                    
                    // Parse name (with multiline support)
                    const nameResult = this.parseStringProperty(lines, j, 'name');
                    if (nameResult) {
                        header.name = nameResult.value;
                        j = nameResult.endLine;
                        continue;
                    }
                    
                    // Parse owner (with multiline support)
                    const ownerResult = this.parseStringProperty(lines, j, 'owner');
                    if (ownerResult) {
                        header.owner = ownerResult.value;
                        j = ownerResult.endLine;
                        continue;
                    }
                    
                    // Parse version (with multiline support)
                    const versionResult = this.parseStringProperty(lines, j, 'version');
                    if (versionResult) {
                        header.version = versionResult.value;
                        j = versionResult.endLine;
                        continue;
                    }
                }
                
                break;
            }
        }
        
        return header;
    }
    
    /**
     * Parse a string property that may span multiple lines
     * Handles: name "value", description """multiline""", etc.
     * Returns: {value: string, endLine: number} or null
     */
    private static parseStringProperty(lines: string[], startLine: number, propertyName: string): {value: string, endLine: number} | null {
        const line = lines[startLine].trim();
        
        // Check if this line starts with the property name
        const propRegex = new RegExp(`^${propertyName}\\s+(.+)$`);
        const match = line.match(propRegex);
        if (!match) {
            return null;
        }
        
        let valueStr = match[1].trim();
        
        // Handle triple-quote multiline strings
        if (valueStr.startsWith('"""')) {
            // Check if it's a single-line triple-quote
            if (valueStr.length > 6 && valueStr.endsWith('"""')) {
                // Single-line: """value"""
                return {
                    value: valueStr.substring(3, valueStr.length - 3),
                    endLine: startLine
                };
            } else {
                // Multi-line triple-quote
                let fullValue = valueStr.substring(3).trim(); // Remove opening """
                let currentLine = startLine + 1;
                
                // Collect lines until we find closing """
                while (currentLine < lines.length) {
                    const nextLine = lines[currentLine].trim();
                    
                    if (nextLine.endsWith('"""')) {
                        // Found closing """
                        fullValue += '\n' + nextLine.substring(0, nextLine.length - 3);
                        return {
                            value: fullValue.trim(),
                            endLine: currentLine
                        };
                    } else {
                        fullValue += '\n' + nextLine;
                    }
                    
                    currentLine++;
                }
                
                // If we reach here, no closing """ found - return what we have
                return {
                    value: fullValue.trim(),
                    endLine: currentLine - 1
                };
            }
        }
        
        // Handle regular quoted strings
        if (valueStr.startsWith('"')) {
            // Check if it's a complete single-line string
            if (valueStr.length > 1 && valueStr.endsWith('"')) {
                // Single-line: "value"
                return {
                    value: valueStr.substring(1, valueStr.length - 1),
                    endLine: startLine
                };
            } else {
                // Multi-line regular string (rare but possible)
                let fullValue = valueStr.substring(1); // Remove opening "
                let currentLine = startLine + 1;
                
                // Collect lines until we find closing "
                while (currentLine < lines.length) {
                    const nextLine = lines[currentLine].trim();
                    
                    if (nextLine.endsWith('"')) {
                        // Found closing "
                        fullValue += ' ' + nextLine.substring(0, nextLine.length - 1);
                        return {
                            value: fullValue.trim(),
                            endLine: currentLine
                        };
                    } else {
                        fullValue += ' ' + nextLine;
                    }
                    
                    currentLine++;
                }
                
                // If we reach here, no closing " found - return what we have
                return {
                    value: fullValue.trim(),
                    endLine: currentLine - 1
                };
            }
        }
        
        // No quotes found - return as-is
        return {
            value: valueStr,
            endLine: startLine
        };
    }
    
    /**
     * Parse sections and their content
     */
    private static parseSections(lines: string[]): SpecSection[] {
        const sections: SpecSection[] = [];
        const sectionStack: {section: SpecSection, indent: number}[] = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            
            // Skip empty lines and comments
            if (!trimmed || trimmed.startsWith('//')) {
                continue;
            }
            
            const indent = line.length - line.trimStart().length;
            
            // Check for def section
            const sectionMatch = trimmed.match(/^def\s+section\s+(\w+)/);
            if (sectionMatch) {
                const section: SpecSection = {
                    id: sectionMatch[1],
                    name: '',
                    content: [],
                    subsections: [],
                    line: i + 1
                };
                
                // Parse section properties and content
                for (let j = i + 1; j < lines.length; j++) {
                    const contentLine = lines[j];
                    const contentTrimmed = contentLine.trim();
                    const contentIndent = contentLine.length - contentLine.trimStart().length;
                    
                    // Stop if we hit another def at same or lower indent
                    if (contentIndent <= indent && contentTrimmed.startsWith('def ')) {
                        break;
                    }
                    
                    // BUG FIX: Parse content blocks FIRST to prevent their properties from overwriting section properties
                    // Parse content (def spec, def diagram, def table, def dashboard)
                    const contentDefMatch = contentTrimmed.match(/^def\s+(spec|diagram|table|dashboard)\s+(\w+)/);
                    if (contentDefMatch) {
                        const content = this.parseContent(lines, j, contentDefMatch[1] as 'spec' | 'diagram' | 'table' | 'dashboard', contentDefMatch[2]);
                        if (content) {
                            section.content.push(content);
                        }
                        // Skip to the end of this content block to avoid parsing its properties as section properties
                        let k = j + 1;
                        while (k < lines.length) {
                            const nextLine = lines[k];
                            const nextIndent = nextLine.length - nextLine.trimStart().length;
                            const nextTrimmed = nextLine.trim();
                            // Stop at next def at same or lower indent
                            if (nextIndent <= contentIndent && nextTrimmed.startsWith('def ')) {
                                break;
                            }
                            k++;
                        }
                        j = k - 1; // -1 because the loop will increment j
                        continue;
                    }
                    
                    // BUG FIX: Parse subsections and skip their content to prevent duplication
                    const subsectionMatch = contentTrimmed.match(/^def\s+section\s+(\w+)/);
                    if (subsectionMatch && contentIndent > indent) {
                        // This is a subsection - skip it as it will be parsed in the main loop
                        let k = j + 1;
                        while (k < lines.length) {
                            const nextLine = lines[k];
                            const nextIndent = nextLine.length - nextLine.trimStart().length;
                            const nextTrimmed = nextLine.trim();
                            // Stop at next def at same or lower indent
                            if (nextIndent <= contentIndent && nextTrimmed.startsWith('def ')) {
                                break;
                            }
                            k++;
                        }
                        j = k - 1; // -1 because the loop will increment j
                        continue;
                    }
                    
                    // Parse section-level properties (name, description)
                    // These are only parsed if we're not inside a content or subsection block
                    
                    // Parse name (with multiline support)
                    const nameResult = this.parseStringProperty(lines, j, 'name');
                    if (nameResult) {
                        section.name = nameResult.value;
                        j = nameResult.endLine;
                        continue;
                    }
                    
                    // Parse description (with multiline support)
                    const descResult = this.parseStringProperty(lines, j, 'description');
                    if (descResult) {
                        section.description = descResult.value;
                        j = descResult.endLine;
                        continue;
                    }
                }
                
                // Add to appropriate parent or root
                if (sectionStack.length > 0 && indent > sectionStack[sectionStack.length - 1].indent) {
                    sectionStack[sectionStack.length - 1].section.subsections.push(section);
                } else {
                    // Pop stack until we find the right parent level
                    while (sectionStack.length > 0 && indent <= sectionStack[sectionStack.length - 1].indent) {
                        sectionStack.pop();
                    }
                    
                    if (sectionStack.length > 0) {
                        sectionStack[sectionStack.length - 1].section.subsections.push(section);
                    } else {
                        sections.push(section);
                    }
                }
                
                sectionStack.push({section, indent});
            }
        }
        
        return sections;
    }
    
    /**
     * Parse content definition (spec, diagram, table, or dashboard)
     */
    private static parseContent(
        lines: string[],
        startLine: number,
        type: 'spec' | 'diagram' | 'table' | 'dashboard',
        id: string
    ): SpecContent | null {
        const content: SpecContent = {
            type,
            id,
            name: '',
            source: {
                filepaths: []
            },
            line: startLine + 1
        };
        
        const baseLine = lines[startLine];
        const baseIndent = baseLine.length - baseLine.trimStart().length;
        
        for (let i = startLine + 1; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            const indent = line.length - line.trimStart().length;
            
            // Stop if we hit another def at same or lower indent
            if (indent <= baseIndent && trimmed.startsWith('def ')) {
                break;
            }
            
            // Parse name (with multiline support)
            const nameResult = this.parseStringProperty(lines, i, 'name');
            if (nameResult) {
                content.name = nameResult.value;
                i = nameResult.endLine;
                continue;
            }
            
            // Parse description (with multiline support)
            const descResult = this.parseStringProperty(lines, i, 'description');
            if (descResult) {
                content.description = descResult.value;
                i = descResult.endLine;
                continue;
            }
            
            // Parse source reference (with multiline support, comma-separated)
            const sourceResult = this.parseStringProperty(lines, i, 'source');
            if (sourceResult) {
                // Split by comma to support multiple sources: source "file1.req", "file2.req", "*.req"
                const sources = sourceResult.value.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
                content.source.filepaths = sources;
                
                // Check for where clause on same line
                const whereMatch = trimmed.match(/where\s+(.+)/);
                if (whereMatch) {
                    content.source.where = QueryEngine.parseWhereClause(whereMatch[1]);
                }
                
                i = sourceResult.endLine;
                continue;
            }
            
            // Parse where clause (if on separate line)
            if (!content.source.where) {
                const whereMatch = trimmed.match(/^where\s+(.+)/);
                if (whereMatch) {
                    content.source.where = QueryEngine.parseWhereClause(whereMatch[1]);
                    continue;
                }
            }
            
            // Parse groupby
            const groupbyMatch = trimmed.match(/^groupby\s+(\w+)/);
            if (groupbyMatch) {
                content.source.groupby = groupbyMatch[1];
                continue;
            }
            
            // Parse orderby
            const orderbyMatch = trimmed.match(/^orderby\s+(.+)/);
            if (orderbyMatch) {
                content.source.orderby = QueryEngine.parseOrderBy(orderbyMatch[1]);
                continue;
            }
            
            // Parse columns
            const columnsMatch = trimmed.match(/^columns\s+(.+)/);
            if (columnsMatch) {
                content.source.columns = columnsMatch[1].split(',').map(c => c.trim());
                continue;
            }
        }
        
        return content;
    }
}

