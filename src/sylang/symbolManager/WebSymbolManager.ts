/**
 * WebSymbolManager
 *
 * Web implementation of SylangSymbolManagerCore.
 *
 * Architecture:
 *  - Per-file-session: call loadDocumentWithImports() when a file is opened in the editor.
 *    The manager parses the file + all its `use X id` imports via /api/files, storing
 *    everything in RAM for that browser session. This is the source of truth for
 *    relation/import dropdowns in the Tiptap editor.
 *
 *  - Server-side (WorkspaceSymbolManager): a separate singleton with 5-min TTL is used
 *    for workspace-wide analysis (diagrams, traceability). It is NOT this class.
 *
 * Usage:
 *   const sm = new WebSymbolManager('/api/files');
 *   await sm.loadDocumentWithImports(filePath, dslContent);
 *   const ids = sm.getImportedHeaderIds(filePath, 'requirementset');
 */

import { SylangSymbolManagerCore, type DocumentSymbols, type SylangSymbol } from '@sylang-core/symbolManagerCore';
import type { FileOps } from '@sylang-core/interfaces/fileOps';
import type { ISylangLogger } from '@sylang-core/interfaces/logger';
import { getRequiredSetTypeForTargetNodeType } from '@sylang-tiptap/utils/editorSchema';

// ─── Console logger ────────────────────────────────────────────────────────

const consoleLogger: ISylangLogger = {
    l1:   (m) => console.info('[SymbolManager]', m),
    l2:   (m) => console.debug('[SymbolManager]', m),
    l3:   (m) => console.debug('[SymbolManager]', m),
    debug:(m) => console.debug('[SymbolManager]', m),
    info: (m) => console.info('[SymbolManager]', m),
    error:(m) => console.error('[SymbolManager]', m),
    warn: (m) => console.warn('[SymbolManager]', m),
    show: () => {}, hide: () => {}, clear: () => {},
    refreshLogLevel: () => {}, getCurrentLogLevel: () => 0 as ReturnType<ISylangLogger['getCurrentLogLevel']>,
    dispose: () => {},
};

// ─── File ops via /api/files ───────────────────────────────────────────────

class WebFileOps implements FileOps {
    constructor(private apiBase: string = '/api/files') {}

    async readFile(filePath: string): Promise<string> {
        const res = await fetch(`${this.apiBase}?action=read&path=${encodeURIComponent(filePath)}`);
        if (!res.ok) throw new Error(`Cannot read file ${filePath}: HTTP ${res.status}`);
        const { content } = await res.json() as { content: string };
        return content;
    }

    async findFiles(pattern: string): Promise<string[]> {
        // Extract workspace root and extension from glob pattern like "userId/owner/repo/**/*.req"
        // The /api/files?action=list endpoint expects a directory path, not a glob.
        const extMatch = pattern.match(/\*(\.\w+)$/)
        const ext = extMatch ? extMatch[1] : ''

        // Extract workspace root: everything before the first *
        const starIdx = pattern.indexOf('*')
        const rootPath = starIdx > 0 ? pattern.substring(0, starIdx).replace(/\/+$/, '') : ''

        // Fetch directory tree recursively (maxDepth=6)
        const res = await fetch(
            `${this.apiBase}?action=list&path=${encodeURIComponent(rootPath)}&maxDepth=6`
        );
        if (!res.ok) return [];
        const data = await res.json() as { entries?: Array<{ path: string; name: string; type: string; children?: unknown[] }> };
        if (!data.entries) return [];

        // Flatten the tree and filter by extension
        const results: string[] = [];
        const flatten = (entries: Array<{ path: string; name: string; type: string; children?: any[] }>) => {
            for (const e of entries) {
                if (e.type === 'file' && (!ext || e.name.endsWith(ext))) {
                    results.push(e.path);
                }
                if (e.children) flatten(e.children);
            }
        };
        flatten(data.entries);
        return results;
    }

    // Not used in browser context — stubs to satisfy FileOps interface
    async readDirectory(_fsPath: string): Promise<string[]> { return []; }
    async fileExists(fsPath: string): Promise<boolean> {
        try { await this.readFile(fsPath); return true; } catch { return false; }
    }
}

// ─── WebSymbolManager ──────────────────────────────────────────────────────

export class WebSymbolManager extends SylangSymbolManagerCore {
    private loadedPaths = new Set<string>();
    /** First 3 segments of the open file path: {uuid}/{owner}/{repo} */
    private workspaceRoot = '';

    constructor() {
        super(consoleLogger, new WebFileOps());
    }

    /**
     * Load a file from already-fetched content (avoids second fetch since SylangFileEditor
     * already read the file), then recursively load all `use` imports.
     *
     * Call this once when the user opens a file. The manager stores the parsed doc + all
     * imported docs in RAM for the life of the editor session.
     */
    async loadDocumentWithImports(filePath: string, content: string): Promise<void> {
        // Derive workspace root ({uuid}/{owner}/{repo}) from the file path
        const segs = filePath.replace(/\\/g, '/').split('/').filter(Boolean)
        if (segs.length >= 3 && !this.workspaceRoot) {
            this.workspaceRoot = segs.slice(0, 3).join('/')
        }

        if (this.loadedPaths.has(filePath)) {
            // Re-parse if content has changed (e.g. after a save)
            const existing = this.documents.get(filePath);
            if (existing && existing.lastModified > Date.now() - 500) return;
        }

        // Parse the file content directly (content already in hand)
        await this.parseDocumentContent(filePath, content);
        this.loadedPaths.add(filePath);

        // Resolve imports
        const doc = this.documents.get(filePath);
        if (!doc) return;

        await this.resolveImports(doc);
    }

    /**
     * Force re-parse a document (e.g. after save).
     * Provide content if already available to avoid a redundant fetch.
     */
    async refreshDocument(filePath: string, content?: string): Promise<void> {
        this.loadedPaths.delete(filePath);
        const dsl = content ?? await this.fileOps.readFile(filePath);
        await this.loadDocumentWithImports(filePath, dsl);
    }

    private async resolveImports(doc: DocumentSymbols): Promise<void> {
        for (const imported of doc.importedSymbols) {
            const headerId = imported.headerIdentifier;
            const headerKind = imported.headerKeyword;

            // Check if we already have this document parsed
            const alreadyLoaded = this.findDocumentByHeader(headerId, headerKind);
            if (alreadyLoaded) {
                imported.importedSymbols = [
                    ...(alreadyLoaded.headerSymbol ? [alreadyLoaded.headerSymbol] : []),
                    ...alreadyLoaded.definitionSymbols,
                ];
                continue;
            }

            // Find the file in the workspace via /api/files glob
            const matchingDoc = await this.findAndLoadDocumentByHeader(headerId, headerKind);
            if (matchingDoc) {
                imported.importedSymbols = [
                    ...(matchingDoc.headerSymbol ? [matchingDoc.headerSymbol] : []),
                    ...matchingDoc.definitionSymbols,
                ];
            }
        }
    }

    private findDocumentByHeader(headerName: string, headerKind: string): DocumentSymbols | undefined {
        for (const doc of this.documents.values()) {
            if (doc.headerSymbol?.name === headerName && doc.headerSymbol?.kind === headerKind) {
                return doc;
            }
        }
        return undefined;
    }

    private async findAndLoadDocumentByHeader(headerName: string, headerKind: string): Promise<DocumentSymbols | undefined> {
        // Map headerKind → file extension
        const ext = headerKindToExtension(headerKind);
        if (!ext) return undefined;

        // Search workspace for files with matching extension
        // Prefix with workspace root so /api/files can resolve the path correctly
        const pattern = this.workspaceRoot ? `${this.workspaceRoot}/**/*${ext}` : `**/*${ext}`
        const files = await this.fileOps.findFiles(pattern);
        for (const filePath of files) {
            if (this.loadedPaths.has(filePath)) {
                const doc = this.documents.get(filePath);
                if (doc?.headerSymbol?.name === headerName) return doc;
                continue;
            }
            try {
                const content = await this.fileOps.readFile(filePath);
                await this.parseDocumentContent(filePath, content);
                this.loadedPaths.add(filePath);
                const doc = this.documents.get(filePath);
                if (doc?.headerSymbol?.name === headerName && doc.headerSymbol?.kind === headerKind) {
                    return doc;
                }
            } catch {
                // skip unreadable files
            }
        }
        return undefined;
    }

    // ─── Completions API ─────────────────────────────────────────────────────

    /**
     * Get all header IDs that the given document has imported, filtered by kind.
     * Used for `useSetId` completions: which X can I `use X id` in this file?
     *
     * Example: for a .req file listing all available requirementsets.
     */
    getAvailableSetIds(docPath: string, setKind: string): string[] {
        const ids: string[] = [];
        for (const doc of this.documents.values()) {
            if (doc.headerSymbol?.kind === setKind) {
                ids.push(doc.headerSymbol.name);
            }
        }
        return ids;
    }

    /**
     * Get all imported header IDs that match the required set type.
     * Used for `relationTargetId` completions — first level (pick the header/set).
     */
    getImportedHeaderIds(docPath: string, requiredSetKind: string): string[] {
        const doc = this.documents.get(docPath);
        if (!doc) return [];

        return doc.importedSymbols
            .filter((imp) => imp.headerKeyword === requiredSetKind)
            .map((imp) => imp.headerIdentifier);
    }

    /**
     * Get child symbol IDs under an imported header that match the target node type.
     * Used for `relationTargetId` completions — second level (pick the specific item).
     */
    getChildIdsForImportedHeader(
        docPath: string,
        setKind: string,
        parentHeaderId: string,
        targetNodeType: string,
    ): string[] {
        const doc = this.documents.get(docPath);
        if (!doc) return [];

        const importEntry = doc.importedSymbols.find(
            (imp) => imp.headerKeyword === setKind && imp.headerIdentifier === parentHeaderId,
        );
        if (!importEntry) return [];

        return importEntry.importedSymbols
            .filter((sym) => sym.type === 'definition' && sym.kind === targetNodeType)
            .map((sym) => sym.name);
    }

    /**
     * Given a target node type (e.g. 'requirement'), find the required set kind
     * (e.g. 'requirementset') and return all IDs of definitions of that type
     * from all imported documents.
     *
     * This is the shortcut used when we want ALL available target IDs without
     * knowing the specific parent header first.
     */
    getAllTargetIds(docPath: string, targetNodeType: string): string[] {
        const requiredSetKind = getRequiredSetTypeForTargetNodeType(targetNodeType);
        if (!requiredSetKind) return [];

        const doc = this.documents.get(docPath);
        if (!doc) return [];

        const ids: string[] = [];
        for (const importEntry of doc.importedSymbols) {
            if (importEntry.headerKeyword !== requiredSetKind) continue;
            for (const sym of importEntry.importedSymbols) {
                if (sym.type === 'definition' && sym.kind === targetNodeType) {
                    ids.push(sym.name);
                }
            }
        }
        return ids;
    }

    /**
     * Find a symbol by its ID across all loaded documents.
     * Returns the symbol, its file name, and file path, or null if not found.
     */
    findSymbolById(id: string): { symbol: SylangSymbol; fileName: string; filePath: string } | null {
        for (const doc of this.documents.values()) {
            if (doc.headerSymbol?.name === id) {
                const filePath = doc.uri;
                return { symbol: doc.headerSymbol, fileName: filePath.split('/').pop() ?? filePath, filePath };
            }
            const found = searchInSymbols(doc.definitionSymbols, id);
            if (found) {
                const filePath = doc.uri;
                return { symbol: found, fileName: filePath.split('/').pop() ?? filePath, filePath };
            }
        }
        return null;
    }

    /** Clear all state (call when user closes the file / navigates away) */
    reset(): void {
        this.documents.clear();
        this.globalIdentifiers.clear();
        this.fileDependencies.clear();
        this.reverseDependencies.clear();
        this.loadedPaths.clear();
    }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function headerKindToExtension(headerKind: string): string | undefined {
    const map: Record<string, string> = {
        requirementset: '.req',
        functionset: '.fun',
        featureset: '.fml',
        variantset: '.vml',
        configset: '.vcf',
        testset: '.tst',
        block: '.blk',
        interfaceset: '.ifc',
        failureset: '.flr',
        hazardset: '.haz',
        safetygoalset: '.sgl',
        safetymechanismset: '.sam',
        faulttree: '.fta',
        agentset: '.agt',
        usecaseset: '.ucd',
        sequenceset: '.seq',
        statemachine: '.smd',
        sprint: '.spr',
        itemdefinition: '.itm',
        hazardanalysis: '.haz',
    };
    return map[headerKind];
}

function searchInSymbols(symbols: SylangSymbol[], id: string): SylangSymbol | null {
    for (const sym of symbols) {
        if (sym.name === id) return sym;
        if (sym.children?.length) {
            const found = searchInSymbols(sym.children, id);
            if (found) return found;
        }
    }
    return null;
}

// ─── Singleton per browser tab / file session ──────────────────────────────

let _instance: WebSymbolManager | null = null;

export function getWebSymbolManager(): WebSymbolManager {
    if (!_instance) {
        _instance = new WebSymbolManager();
    }
    return _instance;
}
