/**
 * Sylang Tiptap Types - Generic, Scalable Architecture
 * Works for all Sylang file extensions (.req, .fun, .blk, .tst, etc.)
 */

// ProseMirror types - only used in webview, not in extension
// import { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * Base block attributes (shared by all Sylang blocks)
 */
export interface SylangBlockAttributes {
    id?: string; // Auto-generated ID for definitions
    collapsed?: boolean; // Toggle state
}

/**
 * Use Block - Same for all file types
 * Represents import statements (use functionset X, use configset Y, etc.)
 */
export interface UseBlockAttributes extends SylangBlockAttributes {
    rows: UseRow[];
}

export interface UseRow {
    setType: string; // 'functionset', 'configset', 'interfaceset', etc.
    setId: string; // ID of the set (e.g., 'EPB_InputProcessingSubsystem_Functions')
}

/**
 * Header Block - Parameterized by file type
 * Represents hdef statements (hdef requirementset, hdef functionset, etc.)
 */
export interface HeaderBlockAttributes extends SylangBlockAttributes {
    headerKeyword: string; // 'requirementset', 'functionset', 'block', etc.
    headerId: string; // Identifier (e.g., filename or user-defined)
    headerName?: string; // UI title, serializes as `name` property
    descriptionHtml?: string; // UI description (HTML), serializes as `description` triple-quoted
    properties: Record<string, any>; // Property name → value
    relations?: RelationRow[]; // Relations table (Meta data can also have relations)
    indentLevel: number; // Indentation level (0 for hdef, 1+ for nested def)
}

/**
 * Definition Block - Parameterized by file type
 * Represents def statements (def requirement, def function, def characteristic, etc.)
 */
export interface DefinitionBlockAttributes extends SylangBlockAttributes {
    defKeyword: string; // 'requirement', 'function', 'characteristic', 'testcase', etc.
    defId: string; // Auto-generated or user-defined ID
    defName?: string; // UI title, serializes as `name` property
    descriptionHtml?: string; // UI description (HTML), serializes as `description` triple-quoted
    properties: Record<string, any>; // Property name → value
    relations: RelationRow[]; // Relations table
    indentLevel: number; // Indentation level (always > parent)
}

/**
 * Relation Row - Inside definition blocks
 * 3-column table: Relation | Node Type | Name
 */
export interface RelationRow {
    relationKeyword: string; // 'implements', 'when', 'derivedfrom', etc.
    nodeType: string; // 'function', 'block', 'requirement', 'config', etc.
    targetId: string; // ID of target (e.g., 'VehicleStateValidator', 'REQ_INPUT_001')
    flags?: string; // Extra tokens like 'mandatory selected' (used by VML extends)
}

/**
 * Comment Block - Heading or Paragraph
 * Renders as visible heading/paragraph in UI, serializes to comments in DSL
 */
export interface CommentBlockAttributes extends SylangBlockAttributes {
    type: 'heading' | 'paragraph';
    text: string;
}

/**
 * File Type Configuration
 * Determines what's allowed for each file extension
 */
export interface FileTypeConfig {
    fileExtension: string;
    headerKeyword: string; // Required header keyword (e.g., 'requirementset')
    headerDisplayName?: string; // Display name for header (e.g., 'Requirements Set')
    defKeywords: string[]; // Allowed def keywords (e.g., ['requirement'])
    allowedProperties: string[]; // Allowed property keywords
    allowedRelations: string[]; // Allowed relation keywords
    requiredProperties?: string[]; // Required properties (if any)
}

/**
 * Tiptap Document Structure
 */
export interface SylangTiptapDocument {
    type: 'doc';
    content: SylangBlockNode[];
}

export type SylangBlockNode =
    | UseBlockNode
    | HeaderBlockNode
    | DefinitionBlockNode
    | CommentBlockNode;

// Node types - only used in webview
export interface UseBlockNode {
    type: 'useBlock';
    attrs: UseBlockAttributes;
}

export interface HeaderBlockNode {
    type: 'headerBlock';
    attrs: HeaderBlockAttributes;
}

export interface DefinitionBlockNode {
    type: 'definitionBlock';
    attrs: DefinitionBlockAttributes;
}

export interface CommentBlockNode {
    type: 'commentBlock';
    attrs: CommentBlockAttributes;
}

/**
 * Slash Command Definition
 */
export interface SlashCommand {
    title: string;
    description: string;
    command: string; // The keyword to insert
    type: 'use' | 'header' | 'definition' | 'comment';
    icon?: string;
}

/**
 * Node Configuration for a file type
 */
export interface NodeConfig {
    fileExtension: string;
    headerKeyword: string;
    headerDisplayName: string;
    defKeywords: Array<{
        keyword: string;
        displayName: string;
        canHaveMultiple: boolean;
    }>;
}

