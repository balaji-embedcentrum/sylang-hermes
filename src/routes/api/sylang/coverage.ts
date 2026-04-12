/**
 * GET /api/sylang/coverage?workspace=userId/owner/repo
 *
 * Coverage analysis — port of symbolAnalysisProvider.ts from sylang2.1.
 * Uses the same logic: matrixDataBuilder pattern → TraceSymbol conversion →
 * business relationship analysis → status categorization.
 *
 * Statuses (matching VSCode exactly):
 *   isolated  — no outgoing, no incoming
 *   orphan    — no outgoing, has incoming
 *   sink      — has outgoing, no incoming
 *   broken    — has outgoing with missing targets
 *   connected — has valid outgoing and incoming
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'
import type { SylangSymbol } from '@sylang-core/symbolManagerCore'

// Business relationship keywords only (matches symbolAnalysisProvider.getBusinessRelationshipKeywords)
// Excludes structural keywords like 'extends', 'inherits', 'when', 'basedon', 'generatedfrom'
const BUSINESS_RELATIONS = new Set([
  'implements', 'satisfies', 'verifies', 'validates', 'traces', 'allocatedto',
  'enables', 'requires', 'excludes', 'derivedfrom', 'refinedfrom',
  'mitigates', 'composedof', 'needs', 'assignedto',
])

// File extensions excluded from coverage analysis (diagram/management files)
const EXCLUDED_EXTENSIONS = new Set(['.spr', '.agt', '.ucd', '.seq'])

type CoverageStatus = 'isolated' | 'orphan' | 'sink' | 'connected' | 'broken'

type CoverageSymbol = {
  name: string
  kind: string
  fileName: string
  outgoing: number
  incoming: number
  broken: number
  status: CoverageStatus
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

        const manager = await getWorkspaceManager(`${workspace}/_.req`)
        if (!manager) return json({ ok: false, error: 'Workspace not found' }, { status: 404 })

        // Step 1: Get all symbols, filter disabled (configValue === 0)
        const allSymbols = manager.getAllSymbols()
        const enabledSymbols = allSymbols.filter(sym => {
          if (sym.configValue === 0) return false
          // Exclude diagram/management file types
          const ext = sym.fileUri ? '.' + (sym.fileUri.split('.').pop() ?? '') : ''
          if (EXCLUDED_EXTENSIONS.has(ext)) return false
          return true
        })

        // Step 2: Deduplicate by fileUri:name (same as TraceSymbol.id)
        const uniqueMap = new Map<string, SylangSymbol>()
        for (const sym of enabledSymbols) {
          const key = `${sym.fileUri}:${sym.name}`
          if (!uniqueMap.has(key)) uniqueMap.set(key, sym)
        }
        const symbols = [...uniqueMap.values()]

        // Step 3: Build name lookup for target resolution
        const nameSet = new Set<string>()
        for (const sym of symbols) nameSet.add(sym.name)

        // Step 4: Analyze each symbol
        const results: CoverageSymbol[] = []
        // Build reverse index for incoming counts
        const incomingCounts = new Map<string, number>()
        for (const sym of symbols) {
          if (!sym.properties) continue
          for (const [key, values] of sym.properties.entries()) {
            if (!BUSINESS_RELATIONS.has(key)) continue
            for (const val of values) {
              for (const targetName of extractTargetNames(val)) {
                incomingCounts.set(targetName, (incomingCounts.get(targetName) ?? 0) + 1)
              }
            }
          }
        }

        const statusCounts = { isolated: 0, orphan: 0, sink: 0, connected: 0, broken: 0 }

        for (const sym of symbols) {
          let outgoing = 0
          let broken = 0

          if (sym.properties) {
            for (const [key, values] of sym.properties.entries()) {
              if (!BUSINESS_RELATIONS.has(key)) continue
              for (const val of values) {
                for (const targetName of extractTargetNames(val)) {
                  outgoing++
                  if (!nameSet.has(targetName)) broken++
                }
              }
            }
          }

          const incoming = incomingCounts.get(sym.name) ?? 0

          let status: CoverageStatus
          if (outgoing === 0 && incoming === 0) status = 'isolated'
          else if (outgoing === 0) status = 'orphan'
          else if (incoming === 0) status = 'sink'
          else if (broken > 0) status = 'broken'
          else status = 'connected'

          statusCounts[status]++
          const fileName = sym.fileUri?.split('/').pop() ?? ''
          results.push({ name: sym.name, kind: sym.kind, fileName, outgoing, incoming, broken, status })
        }

        results.sort((a, b) => a.name.localeCompare(b.name))

        return json({
          ok: true,
          symbols: results,
          summary: {
            total: results.length,
            ...statusCounts,
            brokenRefCount: results.reduce((s, r) => s + r.broken, 0),
          },
        })
      },
    },
  },
})

/** Extract target symbol names from a relation value like "ref requirement REQ_001, REQ_002" */
function extractTargetNames(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  // Strip "ref <nodeType> " prefix
  const cleaned = trimmed.replace(/^ref\s+\w+\s+/, '')
  // Split by comma for multi-target relations
  return cleaned.split(',').map(s => s.trim()).filter(s => s.length > 0 && !s.includes(' '))
}
