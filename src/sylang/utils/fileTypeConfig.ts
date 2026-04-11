/**
 * File Type Configuration Factory
 * Generates file-type specific configurations using keywords.ts
 * Generic and scalable for all Sylang extensions
 */

import {
    SylangKeywordManager,
    KeywordType,
    FileTypeKeywords,
    SYLANG_FILE_TYPES
} from '../core/keywords';
import { FileTypeConfig, NodeConfig, SlashCommand } from '../types/sylangTypes';
import { getSlashCommands, getPropertySchema } from './propertyIntrospection';
import { preserveOrGenerateId } from './idManager';
import { getInsertableBlocks } from './editorSchema';

/**
 * Get file type configuration for a given extension
 */
export function getFileTypeConfig(fileExtension: string): FileTypeConfig | null {
    const fileType = SylangKeywordManager.getFileTypeKeywords(fileExtension);
    if (!fileType) {
        return null;
    }

    // Extract header keyword (hdef keyword)
    const headerKeyword = fileType.headerKeyword;

    // Extract def keywords (all keywords of type DEFINITION)
    const defKeywords = fileType.allowedKeywords
        .filter(k => k.type === KeywordType.DEFINITION)
        .map(k => k.name);

    // Extract property keywords
    const allowedProperties = fileType.allowedKeywords
        .filter(k => k.type === KeywordType.PROPERTY || k.type === KeywordType.ENUM)
        .map(k => k.name);

    // Extract relation keywords
    const allowedRelations = fileType.allowedKeywords
        .filter(k => k.type === KeywordType.RELATION)
        .map(k => k.name);

    // Extract required keywords
    const requiredProperties = fileType.requiredKeywords || [];

    return {
        fileExtension,
        headerKeyword,
        headerDisplayName: fileType.displayName,
        defKeywords,
        allowedProperties,
        allowedRelations,
        requiredProperties
    };
}

/**
 * Get node configuration for a file type
 * Used to determine what nodes can be created
 */
export function getNodeConfig(fileExtension: string): NodeConfig | null {
    const config = getFileTypeConfig(fileExtension);
    if (!config) {
        return null;
    }

    const fileType = SylangKeywordManager.getFileTypeKeywords(fileExtension);
    if (!fileType) {
        return null;
    }

    // Get insertable blocks from editorSchema.ts (the curated source of truth)
    const insertableBlocks = getInsertableBlocks(fileExtension);
    const defKeywords = insertableBlocks.map(b => ({
        keyword: b.keyword,
        displayName: b.displayName,
        canHaveMultiple: true
    }));

    return {
        fileExtension,
        headerKeyword: config.headerKeyword,
        headerDisplayName: fileType.displayName,
        defKeywords
    };
}

/**
 * Get slash commands for a file type
 * Filters commands based on what's allowed for this extension
 */
export function getSlashCommandsForFileType(fileExtension: string): SlashCommand[] {
    const commands: SlashCommand[] = [];

    // Always add 'use' command (available in all file types)
    commands.push({
        title: 'use',
        description: 'Import symbols from another file',
        command: 'use',
        type: 'use'
    });

    // Add header command (e.g., '/requirementset', '/functionset')
    const config = getFileTypeConfig(fileExtension);
    if (config) {
        commands.push({
            title: config.headerKeyword,
            description: `Create or edit ${config.headerDisplayName}`,
            command: config.headerKeyword,
            type: 'header'
        });
    }

    // Add def commands (e.g., '/requirement', '/function')
    const nodeConfig = getNodeConfig(fileExtension);
    if (nodeConfig) {
        for (const defKeyword of nodeConfig.defKeywords) {
            commands.push({
                title: defKeyword.keyword,
                description: `Create ${defKeyword.displayName} definition`,
                command: defKeyword.keyword,
                type: 'definition'
            });
        }
    }

    // Add comment commands
    commands.push({
        title: 'heading',
        description: 'Add section heading (comment)',
        command: 'heading',
        type: 'comment'
    });

    commands.push({
        title: 'paragraph',
        description: 'Add paragraph (comment)',
        command: 'paragraph',
        type: 'comment'
    });

    return commands;
}

/**
 * Get default template for a new file
 * Generates initial structure based on file extension
 */
export function getDefaultTemplate(fileExtension: string, fileName: string): string {
    const config = getFileTypeConfig(fileExtension);
    if (!config) {
        return '';
    }

    // Extract filename without extension
    const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');

    // Build minimal header block - just hdef with name
    // User adds properties as needed via slash menu
    const headerId = preserveOrGenerateId(undefined, fileExtension);
    let template = `hdef ${config.headerKeyword} ${headerId}\n`;
    template += `  name "${baseName}"\n`;

    return template.trim();
}

/**
 * Get available set types for use block
 * Returns all header keywords that can be imported
 */
export function getAvailableSetTypes(): string[] {
    // Generic: any headerKeyword from the language definition is a valid set type for `use`.
    // Keeps this scalable across all Sylang extensions.
    const setTypes = SYLANG_FILE_TYPES.map(ft => ft.headerKeyword).filter(Boolean);
    return Array.from(new Set(setTypes)).sort((a, b) => a.localeCompare(b));
}

/**
 * Get available node types for relations
 * Based on what can be referenced
 */
export function getAvailableNodeTypes(): string[] {
    return [
        'function',
        'block',
        'requirement',
        'testcase',
        'config',
        'feature',
        'characteristic',
        'operation',
        'signal',
        'failuremode',
        'hazard',
        'safetymechanism',
        'agent'
    ];
}
