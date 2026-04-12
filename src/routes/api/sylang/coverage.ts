/**
 * GET /api/sylang/coverage?workspace=userId/owner/repo
 *
 * Computes coverage analysis across all symbols in a workspace.
 * For each symbol: counts outgoing relations, incoming references,
 * and identifies broken refs. Returns summary + per-symbol data.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'
import type { SylangSymbol } from '@sylang-core/symbolManagerCore'

// All relation property keys in the Sylang DSL
const RELATION_KEYS = new Set([
  'implements', 'satisfies', 'derivedfrom', 'refinedfrom',
  'verifiedby', 'allocatedto', 'tracesto', 'detects', 'mitigates',
  'decomposesto', 'decomposedfrom', 'requires', 'provides', 'needs',
  'performs', 'meets', 'enables', 'excludes', 'when', 'inherits',
  'extends', 'generatedfrom', 'basedon', 'implementedby', 'listedfor',
])

type CoverageSymbol = {
  name: string
  kind: string
  fileName: string
  outgoing: number
  incoming: number
  status: 'covered' | 'partial' | 'uncovered'
  brokenRefs: string[]
}

export const Route = createFileRoute('/api/sylang/coverage')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const workspace = (url.searchParams.get('workspace') ?? '').trim()
        if (!workspace) return json({ ok: false, error: 'workspace param required' }, { status: 400 })

        // Use any file path in the workspace to get the manager (parseCacheKey extracts first 3 segments)
        const manager = await getWorkspaceManager(`${workspace}/_.req`)
        if (!manager) return json({ ok: false, error: 'Workspace not found' }, { status: 404 })

        const allSymbols = manager.getAllSymbols()

        // Build name index for checking if relation targets exist
        const symbolNames = new Set<string>()
        for (const sym of allSymbols) {
          symbolNames.add(sym.name)
        }

        // Build reverse index: target name → count of incoming references
        const incomingCount = new Map<string, number>()
        for (const sym of allSymbols) {
          if (!sym.properties) continue
          for (const [key, values] of sym.properties.entries()) {
            if (!RELATION_KEYS.has(key)) continue
            for (const val of values) {
              // Relation values are like "ref requirement REQ_001" or just "REQ_001"
              const targetName = extractTargetName(val)
              if (targetName) {
                incomingCount.set(targetName, (incomingCount.get(targetName) ?? 0) + 1)
              }
            }
          }
        }

        // Build per-symbol coverage data (only def symbols, skip headers and imports)
        const symbols: CoverageSymbol[] = []
        const kindStats = new Map<string, { total: number; covered: number }>()

        for (const sym of allSymbols) {
          if (sym.type !== 'definition') continue

          let outgoing = 0
          const brokenRefs: string[] = []

          if (sym.properties) {
            for (const [key, values] of sym.properties.entries()) {
              if (!RELATION_KEYS.has(key)) continue
              for (const val of values) {
                const targetName = extractTargetName(val)
                if (targetName) {
                  outgoing++
                  if (!symbolNames.has(targetName)) {
                    brokenRefs.push(targetName)
                  }
                }
              }
            }
          }

          const incoming = incomingCount.get(sym.name) ?? 0
          const status: CoverageSymbol['status'] =
            outgoing > 0 && incoming > 0 ? 'covered'
            : outgoing > 0 || incoming > 0 ? 'partial'
            : 'uncovered'

          const fileName = sym.fileUri?.split('/').pop() ?? ''
          symbols.push({ name: sym.name, kind: sym.kind, fileName, outgoing, incoming, status, brokenRefs })

          // Accumulate kind stats
          const stats = kindStats.get(sym.kind) ?? { total: 0, covered: 0 }
          stats.total++
          if (status === 'covered') stats.covered++
          kindStats.set(sym.kind, stats)
        }

        const total = symbols.length
        const covered = symbols.filter(s => s.status === 'covered').length
        const partial = symbols.filter(s => s.status === 'partial').length
        const uncovered = symbols.filter(s => s.status === 'uncovered').length
        const brokenRefCount = symbols.reduce((sum, s) => sum + s.brokenRefs.length, 0)

        const groupedByKind: Record<string, { total: number; covered: number; coveragePercent: number }> = {}
        for (const [kind, stats] of kindStats) {
          groupedByKind[kind] = {
            ...stats,
            coveragePercent: stats.total > 0 ? Math.round((stats.covered / stats.total) * 100) : 0,
          }
        }

        return json({
          ok: true,
          symbols,
          summary: {
            total, covered, partial, uncovered,
            brokenRefCount,
            coveragePercent: total > 0 ? Math.round((covered / total) * 100) : 0,
          },
          groupedByKind,
        })
      },
    },
  },
})

/** Extract the target symbol name from a relation value like "ref requirement REQ_001" */
function extractTargetName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  // Format: "ref <nodeType> <name>" or just "<name>"
  if (trimmed.startsWith('ref ')) {
    const parts = trimmed.split(/\s+/)
    return parts.length >= 3 ? parts[parts.length - 1] : null
  }
  // Single word = direct reference
  return trimmed.includes(' ') ? null : trimmed
}
