/**
 * POST /api/sylang/completions
 *
 * Handles all `getSlashCompletions` context kinds from the Tiptap webview iframe.
 * Called server-side so static lookups (editorSchema) stay in one place.
 * Symbol-dependent lookups (useSetId, relationTargetId) receive parsed doc state
 * from the client (the browser already has the parsed document via WebSymbolManager).
 *
 * Request body:
 * {
 *   kind: 'useSetType' | 'useSetId' | 'relationKeyword' | 'relationNodeType' | 'relationTargetId' | 'propertyValue',
 *   fileExtension: string,
 *   // kind-specific fields:
 *   sourceType?: string,
 *   relationKeyword?: string,
 *   targetNodeType?: string,
 *   enumName?: string,
 *   // For symbol-dependent kinds — client sends pre-resolved IDs:
 *   availableIds?: string[],
 * }
 */

import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
    getAllowedRelations,
    getAllowedTargetNodeTypes,
    getInsertableBlocks,
    normalizeType,
} from '../../../sylang/utils/editorSchema'
import { getEnumValues } from '../../../sylang/utils/propertyIntrospection'

type CompletionsRequest = {
    kind: string
    fileExtension?: string
    sourceType?: string
    relationKeyword?: string
    targetNodeType?: string
    enumName?: string
    // For symbol-dependent completions the browser resolves symbols and passes IDs
    availableIds?: string[]
}

export const Route = createFileRoute('/api/sylang/completions')({
    server: {
        handlers: {
            POST: async ({ request }) => {
                try {
                    const body = await request.json() as CompletionsRequest
                    const { kind, fileExtension } = body

                    switch (kind) {

                        // ─── useSetType ──────────────────────────────────────────────
                        // Which keywords can follow `use` in this file type?
                        case 'useSetType': {
                            const ext = fileExtension ?? ''
                            const blocks = getInsertableBlocks(ext)
                            // The set types are the header keyword variants (e.g. requirementset, functionset)
                            // We can derive them from the insertable blocks + known header kinds.
                            // For now return the full static list; the webview will filter by query.
                            const setTypes = deriveSetTypes(ext)
                            return json({ ok: true, items: setTypes })
                        }

                        // ─── useSetId ─────────────────────────────────────────────────
                        // Which IDs exist for a given set type in the workspace?
                        // The browser resolves symbols and passes the list.
                        case 'useSetId': {
                            // availableIds is resolved by the client-side WebSymbolManager.
                            // This route is a passthrough that can optionally filter.
                            const ids = body.availableIds ?? []
                            return json({ ok: true, items: ids })
                        }

                        // ─── relationKeyword ─────────────────────────────────────────
                        // Which relation keywords are valid for a given source node type?
                        case 'relationKeyword': {
                            const src = normalizeType(body.sourceType ?? '')
                            const relations = getAllowedRelations(src)
                            return json({ ok: true, items: relations })
                        }

                        // ─── relationNodeType ─────────────────────────────────────────
                        // Which target node types are valid for (sourceType, relation)?
                        case 'relationNodeType': {
                            const src = normalizeType(body.sourceType ?? '')
                            const rel = normalizeType(body.relationKeyword ?? '')
                            const targets = getAllowedTargetNodeTypes(src, rel)
                            return json({ ok: true, items: targets })
                        }

                        // ─── relationTargetId ─────────────────────────────────────────
                        // Which IDs can be the target? Resolved client-side, passed here.
                        case 'relationTargetId': {
                            const ids = body.availableIds ?? []
                            return json({ ok: true, items: ids })
                        }

                        // ─── propertyValue (enum) ────────────────────────────────────
                        case 'propertyValue': {
                            const enumName = body.enumName ?? ''
                            const values = getEnumValues(enumName)
                            return json({ ok: true, items: values })
                        }

                        default:
                            return json({ ok: false, error: `Unknown completion kind: ${kind}` }, { status: 400 })
                    }
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err)
                    console.error('[sylang/completions] error:', msg)
                    return json({ ok: false, error: msg }, { status: 500 })
                }
            },
        },
    },
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive the set-header keyword options for a given file extension */
function deriveSetTypes(fileExtension: string): string[] {
    const ext = fileExtension.toLowerCase().startsWith('.')
        ? fileExtension.toLowerCase()
        : `.${fileExtension.toLowerCase()}`

    const map: Record<string, string[]> = {
        '.req': ['requirementset'],
        '.fun': ['functionset'],
        '.fml': ['featureset'],
        '.vml': ['variantset'],
        '.vcf': ['configset'],
        '.tst': ['testset', 'testcaseset'],
        '.blk': ['block'],
        '.ifc': ['interfaceset'],
        '.flr': ['failureset'],
        '.haz': ['hazardset', 'hazardanalysis'],
        '.sgl': ['safetygoalset'],
        '.sam': ['safetymechanismset'],
        '.fta': ['faulttree'],
        '.agt': ['agentset'],
        '.ucd': ['usecaseset'],
        '.seq': ['sequenceset'],
        '.smd': ['statemachine'],
        '.spr': ['sprint'],
        '.itm': ['itemdefinition'],
        '.spec': ['spec'],
        '.ple': ['ple'],
    }
    return map[ext] ?? []
}
