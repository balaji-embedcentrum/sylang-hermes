import * as path from 'path';
import { SylangKeywordManager, KeywordType } from '../core/keywords';

// ─── Minimal interfaces ────────────────────────────────────────────────────

export interface SimpleLogger {
    info(msg: string): void;
    error(msg: string): void;
    warn(msg: string): void;
    debug(msg: string): void;
}

export interface IFileOps {
    readFile(filePath: string): Promise<string>;
    findFiles(pattern: string): Promise<string[]>;
}

/** Tracks config variable values for variant/feature model awareness */
class SimpleConfigManager {
    private configValues = new Map<string, number>();

    getConfigValue(name: string): number | undefined {
        return this.configValues.get(name);
    }

    setConfigValue(name: string, value: number): void {
        this.configValues.set(name, value);
    }

    createNodeState(_nodeId: string): Record<string, unknown> {
        return {};
    }

    updateNodeVisibility(_nodeId: string, _configName: string): void {
        // no-op for web; used only for VSCode tree decorations
    }
}

// ─── Data types ────────────────────────────────────────────────────────────

export interface SylangSymbol {
    name: string;
    type: 'header' | 'definition';
    kind: string;
    fileUri: string;
    line: number;
    column: number;
    parentSymbol?: string;
    children: SylangSymbol[];
    properties: Map<string, string[]>;
    configValue?: number;
    indentLevel: number;
    configState?: Record<string, unknown>;
    level?: 'def' | 'hdef';
}

export interface ImportedSymbol {
    headerKeyword: string;
    headerIdentifier: string;
    fileUri: string;
    importedSymbols: SylangSymbol[];
}

export interface DocumentSymbols {
    uri: string;
    fileExtension: string;
    headerSymbol?: SylangSymbol;
    definitionSymbols: SylangSymbol[];
    importedSymbols: ImportedSymbol[];
    lastModified: number;
}

// ─── Core class ────────────────────────────────────────────────────────────

export class SylangSymbolManagerCore {
    protected documents: Map<string, DocumentSymbols> = new Map();
    protected globalIdentifiers: Map<string, { type: string, fileUri: string, line: number, column: number }> = new Map();
    protected fileDependencies: Map<string, Set<string>> = new Map();
    protected reverseDependencies: Map<string, Set<string>> = new Map();
    protected initializationComplete: boolean = false;
    protected configManager: SimpleConfigManager;

    constructor(
        protected logger: SimpleLogger,
        protected fileOps: IFileOps,
    ) {
        this.configManager = new SimpleConfigManager();
    }

    public async initializeWorkspace(projectRoot: string): Promise<void> {
        this.logger.info(`Initializing SylangWorkspace using core at: ${projectRoot}`);
        const files = await this.fileOps.findFiles('**/*.{ple,fml,vml,vcf,fun,req,tst,blk,spr,agt,ucd,seq,flr,itm,haz,sgl,sam,fta,smd,ifc,cad,fem}');

        for (const file of files) {
            await this.addDocument(file);
        }
        this.initializationComplete = true;
    }

    public async addDocument(filePath: string): Promise<void> {
        try {
            const content = await this.fileOps.readFile(filePath);
            await this.parseDocumentContent(filePath, content);
            this.logger.info(`Added document: ${filePath}`);
        } catch (error) {
            this.logger.error(`Failed to add document ${filePath}: ${error}`);
        }
    }

    protected async parseDocumentContent(filePath: string, content: string): Promise<void> {
        const fileExtension = path.extname(filePath);

        // Clear old symbols
        this.removeGlobalIdentifiersForFile(filePath);
        this.removeDependenciesForFile(filePath);

        const documentSymbols: DocumentSymbols = {
            uri: filePath,
            fileExtension,
            definitionSymbols: [],
            importedSymbols: [],
            lastModified: Date.now()
        };

        const rawLines = content.split('\n');
        const { processedLines: lines } = this.processLineContinuations(rawLines);
        let parentSymbolStack: SylangSymbol[] = [];

        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            const line = lines[lineIndex];
            const trimmedLine = line.trim();

            // Skip empty lines and comments
            if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
                continue;
            }

            const indentLevel = this.getIndentLevel(line);
            const tokens = this.parseTokensWithQuotes(trimmedLine);
            const keyword = tokens[0];

            // Handle indentation-based parent-child relationships
            while (parentSymbolStack.length > 0 && indentLevel <= parentSymbolStack[parentSymbolStack.length - 1].indentLevel) {
                parentSymbolStack.pop();
            }

            if (keyword === 'use') {
                this.parseUseStatement(tokens, documentSymbols);
            } else if (keyword === 'hdef') {
                const headerSymbol = this.parseHeaderDefinition(tokens, filePath, lineIndex, indentLevel);
                if (headerSymbol) {
                    documentSymbols.headerSymbol = headerSymbol;
                    parentSymbolStack = [headerSymbol];
                }
            } else if (keyword === 'def') {
                const defSymbol = this.parseDefinition(tokens, filePath, lineIndex, indentLevel);
                if (defSymbol) {
                    const parentSymbol = parentSymbolStack[parentSymbolStack.length - 1];
                    if (parentSymbol) {
                        defSymbol.parentSymbol = parentSymbol.name;
                        parentSymbol.children.push(defSymbol);
                    }
                    documentSymbols.definitionSymbols.push(defSymbol);
                    parentSymbolStack.push(defSymbol);
                }
            } else if (this.isPropertyKeyword(fileExtension, keyword)) {
                // Handle multiline properties
                const { finalTokens, newLineIndex } = this.parseMultilineProperty(lines, lineIndex, tokens);
                this.parseProperty(finalTokens, parentSymbolStack[parentSymbolStack.length - 1]);
                lineIndex = newLineIndex; // Skip processed lines
            }
        }

        this.documents.set(filePath, documentSymbols);
    }

    protected parseMultilineProperty(lines: string[], startLineIndex: number, initialTokens: string[]): { finalTokens: string[], newLineIndex: number } {
        const propertyName = initialTokens[0];
        let propertyValue = initialTokens.slice(1).join(' ');
        let currentLineIndex = startLineIndex;
        const startIndent = this.getIndentLevel(lines[startLineIndex]);

        if (propertyValue.startsWith('"""')) {
            if (propertyValue.length > 3 && propertyValue.endsWith('"""')) {
                propertyValue = propertyValue.substring(3, propertyValue.length - 3);
            } else {
                propertyValue = propertyValue.substring(3).trim();
            }
        }
        else if (propertyValue.startsWith('"') && !propertyValue.endsWith('"')) {
            propertyValue = propertyValue.substring(1);
            for (let i = startLineIndex + 1; i < lines.length; i++) {
                const nextLine = lines[i];
                const trimmedNextLine = nextLine.trim();

                if (!trimmedNextLine) {
                    propertyValue += '\n';
                    currentLineIndex = i;
                    continue;
                }

                const nextIndent = this.getIndentLevel(nextLine);
                if (nextIndent > startIndent) {
                    if (trimmedNextLine.endsWith('"')) {
                        propertyValue += '\n' + trimmedNextLine.substring(0, trimmedNextLine.length - 1);
                        currentLineIndex = i;
                        break;
                    } else {
                        propertyValue += '\n' + trimmedNextLine;
                        currentLineIndex = i;
                    }
                } else {
                    break;
                }
            }
        }

        return {
            finalTokens: [propertyName, propertyValue],
            newLineIndex: currentLineIndex
        };
    }

    protected parseUseStatement(tokens: string[], documentSymbols: DocumentSymbols): void {
        if (tokens.length >= 3) {
            const headerKeyword = tokens[1];
            const identifiers = tokens.slice(2).join(' ').split(',').map(id => id.trim());

            for (const identifier of identifiers) {
                const importedSymbol: ImportedSymbol = {
                    headerKeyword,
                    headerIdentifier: identifier,
                    fileUri: documentSymbols.uri,
                    importedSymbols: []
                };
                documentSymbols.importedSymbols.push(importedSymbol);
            }
        }
    }

    public getAllSymbols(): SylangSymbol[] {
        const symbols: SylangSymbol[] = [];
        for (const doc of this.documents.values()) {
            if (doc.headerSymbol) symbols.push(doc.headerSymbol);
            symbols.push(...doc.definitionSymbols);
            symbols.push(...doc.importedSymbols.flatMap(i => i.importedSymbols));
        }
        return symbols;
    }

    public getDocumentSymbols(uri: string): DocumentSymbols | undefined {
        return this.documents.get(uri);
    }

    public removeGlobalIdentifiersForFile(fileUri: string): void {
        for (const [identifier, metadata] of this.globalIdentifiers.entries()) {
            if (metadata.fileUri === fileUri) {
                this.globalIdentifiers.delete(identifier);
            }
        }
    }

    public removeDependenciesForFile(fileUri: string): void {
        this.fileDependencies.delete(fileUri);
        for (const [, deps] of this.reverseDependencies.entries()) {
            deps.delete(fileUri);
        }
    }

    // ─── Parser Utility Functions ───────────────────────────────────────────

    protected getIndentLevel(line: string): number {
        let indent = 0;
        for (const char of line) {
            if (char === ' ') {
                indent++;
            } else if (char === '\t') {
                indent += 2; // Tab counts as 2 spaces
            } else {
                break;
            }
        }
        return Math.floor(indent / 2); // 2 spaces = 1 level
    }

    protected parseTokensWithQuotes(line: string): string[] {
        const tokens: string[] = [];
        let currentToken = '';
        let inQuotes = false;
        let i = 0;

        while (i < line.length) {
            const char = line[i];

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

    protected processLineContinuations(lines: string[]): { processedLines: string[], lineMap: number[] } {
        const processedLines: string[] = [];
        const lineMap: number[] = [];

        let currentLine = '';
        let originalStartIndex = 0;
        let isContinuing = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trimEnd();

            if (trimmedLine.endsWith('\\')) {
                const contentToAdd = trimmedLine.slice(0, -1).trimEnd();

                if (!isContinuing) {
                    originalStartIndex = i;
                    isContinuing = true;
                }

                currentLine += contentToAdd + ' ';
            } else {
                if (isContinuing) {
                    currentLine += line.trimStart();
                    processedLines.push(currentLine);
                    lineMap.push(originalStartIndex);

                    currentLine = '';
                    isContinuing = false;
                } else {
                    processedLines.push(line);
                    lineMap.push(i);
                }
            }
        }

        if (isContinuing) {
            processedLines.push(currentLine.trimEnd());
            lineMap.push(originalStartIndex);
        }

        return { processedLines, lineMap };
    }

    protected isConfigAwareFile(fileExtension: string): boolean {
        const configAwareExtensions = ['.fun', '.blk', '.req', '.tst', '.spr'];
        return configAwareExtensions.includes(fileExtension);
    }

    protected resolveConfigValue(configName: string): number | undefined {
        return this.configManager.getConfigValue(configName);
    }

    protected parseHeaderDefinition(tokens: string[], uri: string, line: number, indentLevel: number): SylangSymbol | undefined {
        if (tokens.length >= 3) {
            const kind = tokens[1];
            const name = tokens[2];

            const nodeId = `${uri}:${name}`;
            const configState = this.configManager.createNodeState(nodeId);

            return {
                name,
                type: 'header',
                kind,
                fileUri: uri,
                line,
                column: 0,
                children: [],
                properties: new Map(),
                indentLevel,
                level: 'hdef',
                configState
            };
        }
        return undefined;
    }

    protected parseDefinition(tokens: string[], uri: string, line: number, indentLevel: number): SylangSymbol | undefined {
        if (tokens.length >= 3) {
            const kind = tokens[1];
            const name = tokens[2];

            const fileExtension = path.extname(uri);
            const isConfigAwareFile = this.isConfigAwareFile(fileExtension);
            const nodeId = `${uri}:${name}`;
            const configState = isConfigAwareFile ? this.configManager.createNodeState(nodeId) : undefined;

            const symbol: SylangSymbol = {
                name,
                type: 'definition',
                kind,
                fileUri: uri,
                line,
                column: 0,
                children: [],
                properties: new Map(),
                indentLevel,
                level: 'def',
                configState
            };

            if (kind === 'config' && tokens.length >= 4) {
                const configValue = parseInt(tokens[3]);
                if (!isNaN(configValue)) {
                    symbol.configValue = configValue;
                    this.configManager.setConfigValue(name, configValue);
                }
            }

            if (tokens.length >= 4 && kind !== 'config') {
                const optionalFlags = ['mandatory', 'optional', 'or', 'alternative', 'selected'];
                const flags: string[] = [];

                for (let i = 3; i < tokens.length; i++) {
                    const token = tokens[i];
                    if (optionalFlags.includes(token)) {
                        flags.push(token);
                    }
                }

                if (flags.length > 0) {
                    for (const flag of flags) {
                        symbol.properties.set(flag, ['true']);
                    }
                }
            }

            return symbol;
        }
        return undefined;
    }

    protected parseProperty(tokens: string[], parentSymbol?: SylangSymbol): void {
        if (!parentSymbol || tokens.length < 2) return;

        const propertyName = tokens[0];
        const propertyValues = tokens.slice(1);

        if (propertyName === 'when' && propertyValues.length >= 3 &&
            propertyValues[0] === 'ref' && propertyValues[1] === 'config') {
            const configName = propertyValues[2];
            const configValue = this.resolveConfigValue(configName);
            if (configValue !== undefined) {
                parentSymbol.configValue = configValue;
            }
        }

        if (propertyName === 'ref' && propertyValues.length >= 2 && propertyValues[0] === 'config') {
            const configName = propertyValues[1];
            const configValue = this.resolveConfigValue(configName);
            if (configValue !== undefined) {
                parentSymbol.configValue = configValue;
            }
        }

        if (propertyName === 'config' && propertyValues.length > 0) {
            const configValue = parseInt(propertyValues[propertyValues.length - 1]);
            if (!isNaN(configValue)) {
                parentSymbol.configValue = configValue;
            }
        }

        // For multi-line properties, append new values to existing array
        const existingValues = parentSymbol.properties.get(propertyName);
        if (existingValues) {
            existingValues.push(...propertyValues);
        } else {
            parentSymbol.properties.set(propertyName, propertyValues);
        }
    }

    protected isPropertyKeyword(fileExtension: string, keyword: string): boolean {
        const keywordType = SylangKeywordManager.getKeywordType(fileExtension, keyword);
        return keywordType === KeywordType.PROPERTY ||
            keywordType === KeywordType.ENUM ||
            keywordType === KeywordType.RELATION;
    }

    protected findSymbolIncludingChildren(symbols: SylangSymbol[], identifier: string): SylangSymbol | undefined {
        for (const symbol of symbols) {
            if (symbol.name === identifier) {
                return symbol;
            }
            if (symbol.children && symbol.children.length > 0) {
                const childMatch = this.findSymbolIncludingChildren(symbol.children, identifier);
                if (childMatch) {
                    return childMatch;
                }
            }
        }
        return undefined;
    }

    public resolveSymbol(identifier: string, fileUri: string): SylangSymbol | undefined {
        const documentSymbols = this.documents.get(fileUri);
        if (!documentSymbols) {
            return undefined;
        }

        if (documentSymbols.headerSymbol?.name === identifier) {
            return documentSymbols.headerSymbol;
        }

        const localMatch = this.findSymbolIncludingChildren(documentSymbols.definitionSymbols, identifier);
        if (localMatch) {
            return localMatch;
        }

        for (const importedSymbol of documentSymbols.importedSymbols) {
            const resolvedSymbols = this.getSymbolsFromImport(importedSymbol);
            const found = this.findSymbolIncludingChildren(resolvedSymbols.filter(symbol => this.isSymbolVisible(symbol)), identifier);
            if (found) {
                return found;
            }
        }

        return undefined;
    }

    protected getSymbolsFromImport(importedSymbol: ImportedSymbol): SylangSymbol[] {
        for (const [, documentSymbols] of this.documents) {
            if (documentSymbols.headerSymbol?.name === importedSymbol.headerIdentifier &&
                documentSymbols.headerSymbol?.kind === importedSymbol.headerKeyword) {

                const allSymbols = [documentSymbols.headerSymbol];
                allSymbols.push(...documentSymbols.definitionSymbols);
                return allSymbols;
            }
        }
        return [];
    }

    protected isSymbolVisible(symbol: SylangSymbol): boolean {
        if (symbol.kind === 'config') {
            return true;
        }

        const documentSymbols = this.documents.get(symbol.fileUri);
        if (documentSymbols?.headerSymbol && documentSymbols.headerSymbol !== symbol) {
            if (this.symbolUsesDisabledConfig(documentSymbols.headerSymbol)) {
                return false;
            }
        }

        if (this.symbolUsesDisabledConfig(symbol)) {
            return false;
        }

        if (symbol.parentSymbol) {
            const parentDoc = this.documents.get(symbol.fileUri);
            if (parentDoc) {
                const parent = this.findSymbolByName(parentDoc, symbol.parentSymbol);
                if (parent && !this.isSymbolVisible(parent)) {
                    return false;
                }
            }
        }

        return true;
    }

    protected symbolUsesDisabledConfig(symbol: SylangSymbol): boolean {
        for (const [propertyName, propertyValues] of symbol.properties.entries()) {
            if (propertyName === 'when' && propertyValues.length >= 3 &&
                propertyValues[0] === 'ref' && propertyValues[1] === 'config') {
                const configName = propertyValues[2];
                const configValue = this.resolveConfigValue(configName);
                if (configValue === 0) {
                    return true;
                }
            }
            else if (propertyName === 'ref' && propertyValues.length >= 2 && propertyValues[0] === 'config') {
                const configName = propertyValues[1];
                const configValue = this.resolveConfigValue(configName);
                if (configValue === 0) {
                    return true;
                }
            }
        }
        return false;
    }

    protected findSymbolByName(documentSymbols: DocumentSymbols, name: string): SylangSymbol | undefined {
        if (documentSymbols.headerSymbol?.name === name) {
            return documentSymbols.headerSymbol;
        }
        return documentSymbols.definitionSymbols.find(symbol => symbol.name === name);
    }
}
