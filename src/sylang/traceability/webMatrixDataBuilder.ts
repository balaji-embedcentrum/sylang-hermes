/**
 * Web-portable MatrixDataBuilder
 *
 * Direct port of sylang2.1/src/traceability/core/matrixDataBuilder.ts
 * with VSCode imports replaced by @sylang-core interfaces.
 * Logic is IDENTICAL to the VSCode version.
 */
import { SylangSymbolManagerCore, type SylangSymbol } from '@sylang-core/symbolManagerCore'
import type { ISylangLogger } from '@sylang-core/interfaces/logger'
import { SYLANG_FILE_TYPES, KeywordType } from '@sylang-core/keywords'

// ─── Types (from traceabilityTypes.ts) ────────────────────────────────────

export interface TraceSymbol {
  id: string
  name: string
  type: string
  kind: string
  fileUri: string
  symbolType: 'hdef' | 'def'
  properties: Map<string, string[]>
}

export interface MatrixCell {
  relationships: string[]
  isValid: boolean
  count: number
  rawValues: string[]
  tooltip?: string
}

export interface SymbolGroup {
  type: string
  displayName: string
  symbols: TraceSymbol[]
  color: string
  count: number
}

export interface TraceSummary {
  totalRelationships: number
  validRelationships: number
  brokenRelationships: number
  coverageByType: Record<string, number>
  orphanedSymbols: TraceSymbol[]
  unlinkedSymbols: TraceSymbol[]
  enhancedStats?: EnhancedTraceabilityStats
}

export interface EnhancedTraceabilityStats {
  totalSymbols: number
  isolatedSymbols: TraceSymbol[]
  orphanSymbols: TraceSymbol[]
  sinkSymbols: TraceSymbol[]
  connectedSymbols: TraceSymbol[]
  brokenSymbols: TraceSymbol[]
  isolatedPercentage: number
  orphanPercentage: number
  sinkPercentage: number
  connectedPercentage: number
  brokenPercentage: number
}

export type SymbolTraceabilityStatus = 'isolated' | 'orphan' | 'sink' | 'connected' | 'broken'

export interface RelationshipDetail {
  sourceId: string
  targetId: string
  relationshipType: string
  isValid: boolean
}

export interface SymbolTraceabilityAnalysis {
  symbol: TraceSymbol
  status: SymbolTraceabilityStatus
  outgoingCount: number
  incomingCount: number
  brokenOutgoingCount: number
  businessRelationships: string[]
  outgoingRelationships: RelationshipDetail[]
  incomingRelationships: RelationshipDetail[]
}

export interface MatrixMetadata {
  title: string
  description: string
  sourceFile: string
  generatedAt: string
  symbolCount: number
  relationshipTypes: string[]
}

export interface MatrixData {
  sourceGroups: SymbolGroup[]
  targetGroups: SymbolGroup[]
  matrix: MatrixCell[][]
  summary: TraceSummary
  metadata: MatrixMetadata
}

export interface MatrixFilter {
  relationshipTypes: string[]
  sourceTypes: string[]
  targetTypes: string[]
  showValid: boolean
  showBroken: boolean
  showEmpty: boolean
}

// ─── Builder (exact port) ─────────────────────────────────────────────────

const EXCLUDED_EXTENSIONS = new Set(['spr', 'agt', 'ucd', 'seq'])

export class WebMatrixDataBuilder {
  private _relationshipKeywordsCache?: Set<string>

  constructor(
    private symbolManager: SylangSymbolManagerCore,
    private logger: ISylangLogger,
  ) {}

  async buildMatrixData(filter?: MatrixFilter): Promise<MatrixData> {
    const allSymbols = this.symbolManager.getAllSymbols()
    this.logger.info(`[Traceability] Processing ${allSymbols.length} symbols`)

    const enabledSymbols = allSymbols.filter(sym => this.shouldIncludeSymbol(sym))
    this.logger.info(`[Traceability] After config filtering: ${enabledSymbols.length} symbols`)

    const traceSymbols = this.convertToTraceSymbols(enabledSymbols)

    let sourceGroups = this.groupSymbolsByType(traceSymbols)
    let targetGroups = this.groupSymbolsByType(traceSymbols)

    if (filter?.sourceTypes?.length) {
      sourceGroups = sourceGroups.filter(g => filter.sourceTypes.includes(g.type))
    }
    if (filter?.targetTypes?.length) {
      targetGroups = targetGroups.filter(g => filter.targetTypes.includes(g.type))
    }

    const result = this.buildRelationshipMatrix(sourceGroups, targetGroups, filter)
    const summary = this.generateSummary(result.sourceGroups, result.targetGroups, result.matrix)

    const metadata: MatrixMetadata = {
      title: 'Sylang: Traceability Matrix',
      description: 'Complete relationship matrix for project traceability analysis',
      sourceFile: '',
      generatedAt: new Date().toISOString(),
      symbolCount: allSymbols.length,
      relationshipTypes: [...this.getAllRelationshipKeywords()],
    }

    return {
      sourceGroups: result.sourceGroups,
      targetGroups: result.targetGroups,
      matrix: result.matrix,
      summary,
      metadata,
    }
  }

  // ─── Coverage Analysis (port of symbolAnalysisProvider.extractSymbolAnalyses) ─

  extractSymbolAnalyses(matrixData: MatrixData): SymbolTraceabilityAnalysis[] {
    const allSymbols: TraceSymbol[] = []
    for (const group of matrixData.sourceGroups) allSymbols.push(...group.symbols)
    for (const group of matrixData.targetGroups) allSymbols.push(...group.symbols)

    // Deduplicate by ID
    const uniqueSymbols = new Map<string, TraceSymbol>()
    for (const sym of allSymbols) uniqueSymbols.set(sym.id, sym)

    const allSymbolsMap = new Map<string, TraceSymbol>()
    for (const sym of uniqueSymbols.values()) allSymbolsMap.set(sym.name, sym)

    const analyses: SymbolTraceabilityAnalysis[] = []
    for (const sym of uniqueSymbols.values()) {
      analyses.push(this.analyzeSymbolTraceability(sym, allSymbolsMap))
    }

    return analyses.sort((a, b) => a.symbol.name.localeCompare(b.symbol.name))
  }

  // ─── Private methods (identical to matrixDataBuilder.ts) ─────────────────

  private shouldIncludeSymbol(symbol: SylangSymbol): boolean {
    if (symbol.configValue !== undefined && symbol.configValue === 0) return false
    if (symbol.configState && !symbol.configState.isVisible) return false
    return true
  }

  private convertToTraceSymbols(symbols: SylangSymbol[]): TraceSymbol[] {
    return symbols
      .filter(sym => {
        const ext = sym.fileUri?.split('.').pop() ?? ''
        return !EXCLUDED_EXTENSIONS.has(ext)
      })
      .map(sym => ({
        id: `${sym.fileUri}:${sym.name}`,
        name: sym.name,
        type: sym.kind,
        kind: sym.kind,
        fileUri: sym.fileUri,
        symbolType: sym.type as 'hdef' | 'def',
        properties: sym.properties,
      }))
  }

  private groupSymbolsByType(symbols: TraceSymbol[]): SymbolGroup[] {
    const groups = new Map<string, TraceSymbol[]>()
    for (const sym of symbols) {
      if (!groups.has(sym.type)) groups.set(sym.type, [])
      groups.get(sym.type)!.push(sym)
    }
    const colors = TYPE_COLORS
    let i = 0
    const result: SymbolGroup[] = []
    for (const [type, syms] of groups) {
      result.push({
        type,
        displayName: DISPLAY_NAMES[type] ?? type.charAt(0).toUpperCase() + type.slice(1),
        symbols: syms.sort((a, b) => a.name.localeCompare(b.name)),
        color: colors[i++ % colors.length],
        count: syms.length,
      })
    }
    return result.sort((a, b) => a.displayName.localeCompare(b.displayName))
  }

  private buildRelationshipMatrix(
    sourceGroups: SymbolGroup[],
    targetGroups: SymbolGroup[],
    filter?: MatrixFilter,
  ) {
    const allSource = sourceGroups.flatMap(g => g.symbols)
    const allTarget = targetGroups.flatMap(g => g.symbols)
    const targetLookup = new Map<string, TraceSymbol>()
    allTarget.forEach(s => targetLookup.set(s.name, s))
    const relKeywords = this.getAllRelationshipKeywords()

    const matrix: MatrixCell[][] = []
    for (const src of allSource) {
      const row: MatrixCell[] = []
      for (const tgt of allTarget) {
        row.push(this.buildMatrixCell(src, tgt, targetLookup, relKeywords, filter))
      }
      matrix.push(row)
    }
    return { sourceGroups, targetGroups, matrix }
  }

  private buildMatrixCell(
    src: TraceSymbol, tgt: TraceSymbol,
    targetLookup: Map<string, TraceSymbol>,
    relKeywords: Set<string>,
    filter?: MatrixFilter,
  ): MatrixCell {
    const relationships: string[] = []
    const rawValues: string[] = []
    let validCount = 0

    for (const [propName, values] of src.properties) {
      if (!relKeywords.has(propName)) continue
      if (filter?.relationshipTypes?.length && !filter.relationshipTypes.includes(propName)) continue

      for (const value of values) {
        const cleaned = value.replace(/^ref\s+\w+\s+/, '').replace(/^ref\s+/, '').trim()
        for (const targetId of cleaned.split(',').map(s => s.trim()).filter(Boolean)) {
          if (targetId === tgt.name) {
            relationships.push(propName)
            rawValues.push(value)
            if (targetLookup.has(targetId)) validCount++
          }
        }
      }
    }

    return {
      relationships: [...new Set(relationships)],
      isValid: relationships.length === 0 || validCount === relationships.length,
      count: relationships.length,
      rawValues,
    }
  }

  private generateSummary(sourceGroups: SymbolGroup[], targetGroups: SymbolGroup[], matrix: MatrixCell[][]): TraceSummary {
    let totalRel = 0, validRel = 0, brokenRel = 0
    const coverageByType: Record<string, number> = {}

    for (const row of matrix) {
      for (const cell of row) {
        totalRel += cell.count
        if (cell.isValid) validRel += cell.count
        else brokenRel += cell.count
        for (const rt of cell.relationships) coverageByType[rt] = (coverageByType[rt] ?? 0) + 1
      }
    }

    const allSource = sourceGroups.flatMap(g => g.symbols)
    const allTarget = targetGroups.flatMap(g => g.symbols)

    // Orphaned = targets with no incoming
    const hasIncoming = new Set<number>()
    for (let r = 0; r < matrix.length; r++)
      for (let c = 0; c < matrix[r].length; c++)
        if (matrix[r][c].count > 0) hasIncoming.add(c)
    const orphanedSymbols = allTarget.filter((_, i) => !hasIncoming.has(i))

    // Unlinked = sources with no outgoing
    const hasOutgoing = new Set<number>()
    for (let r = 0; r < matrix.length; r++)
      for (let c = 0; c < matrix[r].length; c++)
        if (matrix[r][c].count > 0) hasOutgoing.add(r)
    const unlinkedSymbols = allSource.filter((_, i) => !hasOutgoing.has(i))

    const enhancedStats = this.generateEnhancedStats(sourceGroups, targetGroups)

    return { totalRelationships: totalRel, validRelationships: validRel, brokenRelationships: brokenRel, coverageByType, orphanedSymbols, unlinkedSymbols, enhancedStats }
  }

  private generateEnhancedStats(sourceGroups: SymbolGroup[], targetGroups: SymbolGroup[]): EnhancedTraceabilityStats {
    const allMap = new Map<string, TraceSymbol>()
    for (const g of [...sourceGroups, ...targetGroups])
      for (const s of g.symbols) allMap.set(s.id, s)

    const all = [...allMap.values()]
    const analyses = all.map(s => this.analyzeSymbolTraceability(s, allMap))

    const isolated = analyses.filter(a => a.status === 'isolated').map(a => a.symbol)
    const orphan = analyses.filter(a => a.status === 'orphan').map(a => a.symbol)
    const sink = analyses.filter(a => a.status === 'sink').map(a => a.symbol)
    const connected = analyses.filter(a => a.status === 'connected').map(a => a.symbol)
    const broken = analyses.filter(a => a.status === 'broken').map(a => a.symbol)
    const total = all.length

    return {
      totalSymbols: total,
      isolatedSymbols: isolated, orphanSymbols: orphan, sinkSymbols: sink,
      connectedSymbols: connected, brokenSymbols: broken,
      isolatedPercentage: total ? Math.round((isolated.length / total) * 100) : 0,
      orphanPercentage: total ? Math.round((orphan.length / total) * 100) : 0,
      sinkPercentage: total ? Math.round((sink.length / total) * 100) : 0,
      connectedPercentage: total ? Math.round((connected.length / total) * 100) : 0,
      brokenPercentage: total ? Math.round((broken.length / total) * 100) : 0,
    }
  }

  private analyzeSymbolTraceability(symbol: TraceSymbol, allSymbolsMap: Map<string, TraceSymbol>): SymbolTraceabilityAnalysis {
    const businessRels = this.getBusinessRelationshipKeywords()
    let outgoing = 0, incoming = 0, broken = 0
    const symRels: string[] = []
    const outgoingRelationships: RelationshipDetail[] = []
    const incomingRelationships: RelationshipDetail[] = []

    // Outgoing: this symbol → others
    for (const [propName, values] of symbol.properties) {
      if (!businessRels.has(propName)) continue
      symRels.push(propName)
      for (const val of values) {
        const cleaned = val.replace(/^ref\s+\w+\s+/, '').replace(/^ref\s+/, '').trim()
        for (const tid of cleaned.split(',').map(s => s.trim()).filter(Boolean)) {
          outgoing++
          const isValid = allSymbolsMap.has(tid)
          if (!isValid) broken++
          outgoingRelationships.push({ sourceId: symbol.name, targetId: tid, relationshipType: propName, isValid })
        }
      }
    }

    // Incoming: others → this symbol
    for (const other of allSymbolsMap.values()) {
      if (other.id === symbol.id) continue
      for (const [propName, values] of other.properties) {
        if (!businessRels.has(propName)) continue
        for (const val of values) {
          const cleaned = val.replace(/^ref\s+\w+\s+/, '').replace(/^ref\s+/, '').trim()
          if (cleaned.split(',').map(s => s.trim()).includes(symbol.name)) {
            incoming++
            incomingRelationships.push({ sourceId: other.name, targetId: symbol.name, relationshipType: propName, isValid: true })
          }
        }
      }
    }

    let status: SymbolTraceabilityStatus
    if (outgoing === 0 && incoming === 0) status = 'isolated'
    else if (outgoing === 0) status = 'orphan'
    else if (incoming === 0) status = 'sink'
    else if (broken > 0) status = 'broken'
    else status = 'connected'

    return { symbol, status, outgoingCount: outgoing, incomingCount: incoming, brokenOutgoingCount: broken, businessRelationships: [...new Set(symRels)], outgoingRelationships, incomingRelationships }
  }

  getAllRelationshipKeywords(): Set<string> {
    if (!this._relationshipKeywordsCache) {
      this._relationshipKeywordsCache = new Set<string>()
      for (const ft of SYLANG_FILE_TYPES) {
        for (const kw of ft.allowedKeywords) {
          if (kw.type === KeywordType.RELATION) this._relationshipKeywordsCache.add(kw.name)
        }
      }
    }
    return this._relationshipKeywordsCache
  }

  private getBusinessRelationshipKeywords(): Set<string> {
    const excluded = new Set(['childof', 'parentof'])
    const all = this.getAllRelationshipKeywords()
    const result = new Set<string>()
    for (const kw of all) if (!excluded.has(kw)) result.add(kw)
    return result
  }
}

// ─── Constants ────────────────────────────────────────────────────────────

const TYPE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
  '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
  '#10AC84', '#EE5A24', '#0984E3', '#A29BFE', '#FD79A8',
]

const DISPLAY_NAMES: Record<string, string> = {
  requirement: 'Requirements', testcase: 'Test Cases', function: 'Functions',
  feature: 'Features', block: 'Blocks', config: 'Configurations',
  productline: 'Product Lines', featureset: 'Feature Sets', variantset: 'Variant Sets',
  failuremode: 'Failure Modes', failureset: 'Failure Sets', hazard: 'Hazards',
  safetymechanism: 'Safety Mechanisms', gate: 'Fault Tree Gates',
  boundary: 'Item Boundaries', operatingmode: 'Operating Modes',
  configset: 'Config Sets', functionset: 'Function Sets',
  requirementset: 'Requirement Sets', testset: 'Test Sets',
  sprint: 'Sprints', agent: 'Agents',
  signal: 'Signals', operation: 'Operations', parameter: 'Parameters',
  datatype: 'Data Types', characteristic: 'Characteristics',
  safetygoal: 'Safety Goals', situation: 'Situations',
  section: 'Sections', table: 'Tables', diagram: 'Diagrams',
  spec: 'Specifications', dashboard: 'Dashboards',
  actor: 'Actors', usecase: 'Use Cases',
  state: 'States', transition: 'Transitions',
}
