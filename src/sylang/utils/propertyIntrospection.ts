/**
 * Property Introspection API
 * Reads keywords.ts schemas programmatically to generate form fields
 * READ-ONLY access to existing keyword definitions
 */

import {
    SylangKeywordManager,
    KeywordType,
    Keyword,
    FileTypeKeywords,
    SYLANG_ENUMS,
    EnumDefinition
} from '../core/keywords';

export interface PropertySchema {
    name: string;
    type: 'text' | 'rich-text' | 'enum' | 'relation' | 'reference';
    description: string;
    required: boolean;
    allowMultiple: boolean;
    enumValues?: string[]; // For enum types
    relationTargets?: string[]; // For relation types (e.g., ['block', 'function'])
}

export interface SlashCommand {
    title: string;
    description: string;
    command: string; // The keyword to insert (e.g., 'requirement', 'use')
    type: 'definition' | 'reference';
}

/**
 * Get property schemas for a file type
 * Used by Smart Form Generator to create UI widgets
 */
export function getPropertySchema(fileExtension: string): PropertySchema[] {
    const fileType = SylangKeywordManager.getFileTypeKeywords(fileExtension);
    if (!fileType) {
        return [];
    }

    return fileType.allowedKeywords
        .filter(k => k.type === KeywordType.PROPERTY || k.type === KeywordType.ENUM || k.type === KeywordType.RELATION)
        .map(k => {
            const schema: PropertySchema = {
                name: k.name,
                type: mapKeywordTypeToPropertyType(k.type),
                description: k.description,
                required: k.required || false,
                allowMultiple: k.allowMultiple || false
            };

            // Add enum values if it's an enum
            if (k.type === KeywordType.ENUM) {
                const enumDef = SYLANG_ENUMS.find(e => e.name === k.name);
                if (enumDef) {
                    schema.enumValues = enumDef.values;
                }
            }

            // Add relation targets if it's a relation
            if (k.type === KeywordType.RELATION) {
                // Relations can target different types based on context
                // This will be enhanced based on relations-matrix-help.md
                schema.relationTargets = ['block', 'function', 'requirement', 'testcase'];
            }

            return schema;
        });
}

/**
 * Get slash commands available for a file type
 * Used by SlashMenuExtension to show context-aware commands
 */
export function getSlashCommands(fileExtension: string): SlashCommand[] {
    const fileType = SylangKeywordManager.getFileTypeKeywords(fileExtension);
    if (!fileType) {
        return [];
    }

    const commands: SlashCommand[] = [];

    // Add 'use' command (available in all file types)
    commands.push({
        title: 'use',
        description: 'Import symbols from another file',
        command: 'use',
        type: 'reference'
    });

    // Add definition commands (def keyword types)
    const defKeywords = fileType.allowedKeywords.filter(k => k.type === KeywordType.DEFINITION);
    for (const keyword of defKeywords) {
        commands.push({
            title: keyword.name,
            description: keyword.description,
            command: keyword.name,
            type: 'definition'
        });
    }

    return commands;
}

/**
 * Get enum values for a specific enum name
 */
export function getEnumValues(enumName: string): string[] {
    const enumDef = SYLANG_ENUMS.find(e => e.name === enumName);
    return enumDef?.values || [];
}

/**
 * Get default attributes for a definition type
 * Used when creating new nodes via slash command
 */
export function getDefaultAttributes(defType: string, fileExtension: string): Record<string, any> {
    const defaults: Record<string, any> = {};

    // Get property schemas
    const schemas = getPropertySchema(fileExtension);

    // Set defaults based on property types
    for (const schema of schemas) {
        if (schema.type === 'enum') {
            // Use first enum value as default
            if (schema.enumValues && schema.enumValues.length > 0) {
                defaults[schema.name] = schema.enumValues[0];
            }
        } else if (schema.type === 'text' && schema.name === 'id') {
            // ID will be auto-generated, skip
            continue;
        } else if (schema.type === 'text' || schema.type === 'rich-text') {
            defaults[schema.name] = '';
        } else if (schema.type === 'relation') {
            defaults[schema.name] = [];
        }
    }

    return defaults;
}

/**
 * Map KeywordType to PropertySchema type
 */
function mapKeywordTypeToPropertyType(keywordType: KeywordType): PropertySchema['type'] {
    switch (keywordType) {
        case KeywordType.PROPERTY:
            // Check if it's description (rich text) or regular text
            return 'text'; // Will be enhanced to detect 'description' → 'rich-text'
        case KeywordType.ENUM:
            return 'enum';
        case KeywordType.RELATION:
            return 'relation';
        case KeywordType.REFERENCE:
            return 'reference';
        default:
            return 'text';
    }
}

/**
 * Check if a property is a description field (should use rich text editor)
 */
export function isRichTextProperty(propertyName: string): boolean {
    return propertyName === 'description';
}
