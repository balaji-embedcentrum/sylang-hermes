/**
 * Variant Matrix API
 *
 * GET  /api/sylang/variant-matrix?path=<workspacePath>
 *   Returns VariantMatrixData matching the VariantMatrixView component contract.
 *
 * POST /api/sylang/variant-matrix
 *   Body: { action: 'toggleFeature', variantPath, featureId, selected }
 *       | { action: 'createVariant', fmlPath, variantId, variantName, description, owner }
 *       | { action: 'selectVariantForVcf', vmlPath, variantName }
 */
import path from 'node:path'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager, type ServerSymbolManager } from '../../../sylang/symbolManager/workspaceSymbolCache'

// ─── Types matching VariantMatrixView contract ──────────────────────────────

interface FeatureHierarchy {
  id: string
  name: string
  level: number
  mandatory: boolean
  optional: boolean
  alternative: boolean
  or: boolean
  children: FeatureHierarchy[]
  fullPath: string
}

interface VariantFile {
  name: string
  path: string
  variantsetName: string
}

interface FeatureSelection {
  featureId: string
  selected: boolean
  mandatory: boolean
  optional: boolean
}

interface VariantMatrixData {
  features: FeatureHierarchy[]
  variants: VariantFile[]
  selections: Record<string, Record<string, FeatureSelection>>
  activeVcfVariant?: string
}

// ─── Feature hierarchy builder ─────────────────────────────────────────────

function buildFeatureHierarchy(symbols: Array<{ name: string; indentLevel: number; properties: Map<string, string[]>; line: number }>): FeatureHierarchy[] {
  const featureMap = new Map<string, FeatureHierarchy>()

  for (const sym of symbols) {
    const nameVal = sym.properties.get('name')
    const displayName = nameVal ? nameVal[0].replace(/^"(.*)"$/, '$1') : sym.name
    featureMap.set(sym.name, {
      id: sym.name,
      name: displayName,
      level: sym.indentLevel,
      mandatory: sym.properties.has('mandatory'),
      optional: sym.properties.has('optional'),
      alternative: sym.properties.has('alternative'),
      or: sym.properties.has('or'),
      children: [],
      fullPath: sym.name,
    })
  }

  const rootFeatures: FeatureHierarchy[] = []
  const sorted = [...symbols].sort((a, b) => a.line - b.line)
  const parentStack: Array<{ name: string; indentLevel: number }> = []
  const placed = new Set<FeatureHierarchy>()

  for (const sym of sorted) {
    const feature = featureMap.get(sym.name)
    if (!feature || placed.has(feature)) continue
    placed.add(feature)

    while (parentStack.length > 0 && parentStack[parentStack.length - 1].indentLevel >= sym.indentLevel) {
      parentStack.pop()
    }

    if (parentStack.length > 0) {
      const parent = featureMap.get(parentStack[parentStack.length - 1].name)
      if (parent && parent !== feature) {
        parent.children.push(feature)
        feature.fullPath = `${parent.fullPath}.${sym.name}`
      }
    } else {
      rootFeatures.push(feature)
    }

    parentStack.push({ name: sym.name, indentLevel: sym.indentLevel })
  }

  return rootFeatures
}

function flattenFeatures(feats: FeatureHierarchy[]): FeatureHierarchy[] {
  const result: FeatureHierarchy[] = []
  for (const f of feats) { result.push(f); result.push(...flattenFeatures(f.children)) }
  return result
}

// ─── VML parser ────────────────────────────────────────────────────────────

const FEATURE_LINE_RE = /^(\s*)extends\s+ref\s+feature\s+(\w+)\s+(mandatory|optional|or|alternative)\s*(selected)?/

function parseVmlSelections(content: string): Map<string, { mandatory: boolean; optional: boolean; selected: boolean }> {
  const result = new Map<string, { mandatory: boolean; optional: boolean; selected: boolean }>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('use ') || trimmed.startsWith('hdef ')) continue
    const m = trimmed.match(/extends\s+ref\s+feature\s+(\w+)\s+(mandatory|optional|or|alternative)\s*(selected)?/)
    if (m) {
      result.set(m[1], { mandatory: m[2] === 'mandatory', optional: m[2] === 'optional', selected: m[3] === 'selected' })
    }
  }
  return result
}

function extractVariantsetName(content: string): string | null {
  const m = content.match(/hdef\s+variantset\s+(\w+)/)
  return m ? m[1] : null
}

// ─── Helper: find files by extension in the cached document map ───────────

function findDocsByExtension(manager: ServerSymbolManager, ext: string): string[] {
  const result: string[] = []
  for (const key of manager.allDocuments.keys()) {
    if (key.endsWith(ext)) result.push(key)
  }
  return result
}

/** Find a file in the same directory (virtual path) as the reference file */
function findSiblingByExt(manager: ServerSymbolManager, refPath: string, ext: string): string[] {
  const dir = refPath.replace(/\/[^/]+$/, '')
  const results: string[] = []
  for (const key of manager.allDocuments.keys()) {
    if (key.endsWith(ext) && key.startsWith(dir + '/')) results.push(key)
  }
  return results
}

// ─── GET handler ───────────────────────────────────────────────────────────

async function handleGet(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const rawPath = url.searchParams.get('path') ?? ''
  if (!rawPath) return json({ ok: false, error: 'path param required' }, { status: 400 })

  const manager = await getWorkspaceManager(rawPath)
  if (!manager) return json({ ok: false, error: 'Invalid workspace path' }, { status: 400 })

  // Determine the FML file path
  let fmlPath = rawPath
  if (rawPath.endsWith('.vml')) {
    // Read VML to find which featureset it uses, then find the FML
    try {
      const vmlContent = await manager.readFile(rawPath)
      const useMatch = vmlContent.match(/use\s+featureset\s+(\w+)/)
      if (useMatch) {
        const allFml = findDocsByExtension(manager, '.fml')
        for (const f of allFml) {
          const fc = await manager.readFile(f).catch(() => '')
          if (fc.includes(`hdef featureset ${useMatch[1]}`)) { fmlPath = f; break }
        }
      }
    } catch { /* keep rawPath */ }
  }

  let fmlContent: string
  try { fmlContent = await manager.readFile(fmlPath) } catch {
    return json({ ok: false, error: `FML not found: ${fmlPath}` }, { status: 404 })
  }

  // Parse the FML to get features
  await manager.parseContent(fmlPath, fmlContent)
  const docSymbols = manager.allDocuments.get(fmlPath)
  const featureSymbols = (docSymbols?.definitionSymbols ?? []).filter((s: any) => s.kind === 'feature')
  const features = buildFeatureHierarchy(featureSymbols as any)
  const allFeatures = flattenFeatures(features)

  // Find VML files (siblings first, then all)
  let allVml = findSiblingByExt(manager, fmlPath, '.vml')
  if (allVml.length === 0) allVml = findDocsByExtension(manager, '.vml')

  const variants: VariantFile[] = []
  for (const vmlFile of allVml) {
    const vc = await manager.readFile(vmlFile).catch(() => '')
    const vsName = extractVariantsetName(vc)
    if (vsName) variants.push({ name: vsName, path: vmlFile, variantsetName: vsName })
  }

  // Build selection matrix
  const selections: Record<string, Record<string, FeatureSelection>> = {}
  for (const variant of variants) {
    const vc = await manager.readFile(variant.path).catch(() => '')
    const parsed = parseVmlSelections(vc)
    const sel: Record<string, FeatureSelection> = {}
    for (const f of allFeatures) {
      const p = parsed.get(f.id)
      sel[f.id] = { featureId: f.id, selected: p?.selected ?? false, mandatory: p?.mandatory ?? f.mandatory, optional: p?.optional ?? f.optional }
    }
    selections[variant.name] = sel
  }

  // Check for active VCF
  let activeVcfVariant: string | undefined
  try {
    const fmlBase = path.basename(fmlPath, '.fml')
    const fmlDir = fmlPath.replace(/\/[^/]+$/, '')
    const vcfPath = `${fmlDir}/${fmlBase}_Config.vcf`
    const vcfContent = await manager.readFile(vcfPath)
    const genMatch = vcfContent.match(/generatedfrom\s+ref\s+variantset\s+(\S+)/i)
    if (genMatch) {
      const vsName = genMatch[1]
      for (const v of variants) {
        if (vsName === v.variantsetName || vsName.includes(v.name) || v.variantsetName?.includes(vsName)) {
          activeVcfVariant = v.name; break
        }
      }
    }
  } catch { /* no VCF */ }

  const matrix: VariantMatrixData = { features, variants, selections, activeVcfVariant }
  return json({ ok: true, matrix })
}

// ─── POST handler ──────────────────────────────────────────────────────────

async function handlePost(request: Request): Promise<Response> {
  let body: Record<string, unknown>
  try { body = await request.json() as Record<string, unknown> } catch {
    return json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }

  const action = body.action as string
  const HERMES_API_URL = (process.env.HERMES_API_URL || '').trim().replace(/\/$/, '')

  // Helper: write file via agent API or local fs
  async function writeFile(filePath: string, content: string): Promise<void> {
    // Extract repo name from path (3rd segment: userId/owner/repo/...)
    const parts = filePath.replace(/\\/g, '/').split('/').filter(Boolean)
    const repo = parts.length >= 3 ? parts[2] : ''
    const relInRepo = parts.length >= 3 ? parts.slice(3).join('/') : filePath

    if (HERMES_API_URL && repo) {
      const r = await fetch(`${HERMES_API_URL}/ws/${encodeURIComponent(repo)}/file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relInRepo, content }),
      })
      if (!r.ok) throw new Error(`Agent write failed: ${r.status}`)
    } else {
      const fs = await import('node:fs/promises')
      const os = await import('node:os')
      const pathMod = await import('node:path')
      const root = (process.env.HERMES_WORKSPACE_DIR || pathMod.join(os.homedir(), '.hermes')).trim()
      const abs = pathMod.join(root, filePath)
      await fs.mkdir(pathMod.dirname(abs), { recursive: true })
      await fs.writeFile(abs, content, 'utf8')
    }
  }

  // Helper: get manager + read file
  async function readViaManager(filePath: string): Promise<{ manager: ServerSymbolManager; content: string }> {
    const manager = await getWorkspaceManager(filePath)
    if (!manager) throw new Error('Invalid workspace path')
    const content = await manager.readFile(filePath)
    return { manager, content }
  }

  switch (action) {
    case 'toggleFeature': {
      const variantPath = body.variantPath as string
      const featureId = body.featureId as string
      const selected = body.selected as boolean

      const { content: text } = await readViaManager(variantPath).catch(() => ({ content: '' }))
      if (!text) return json({ ok: false, error: 'VML file not found' }, { status: 404 })

      const lines = text.split('\n')
      let targetIdx = -1; let targetType = ''; let targetIndent = ''

      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(FEATURE_LINE_RE)
        if (m && m[2] === featureId) { targetIdx = i; targetIndent = m[1]; targetType = m[3]; break }
      }

      if (targetIdx === -1) {
        return json({ ok: false, error: `Feature ${featureId} not found in VML` }, { status: 404 })
      }

      if (!selected && targetType === 'mandatory' && targetIndent.length === 0) {
        return json({ ok: false, error: 'Cannot deselect mandatory feature' }, { status: 400 })
      }

      lines[targetIdx] = selected
        ? `${targetIndent}extends ref feature ${featureId} ${targetType} selected`
        : `${targetIndent}extends ref feature ${featureId} ${targetType}`

      if (selected && targetType === 'alternative') {
        const indentLen = targetIndent.length
        for (let i = 0; i < lines.length; i++) {
          if (i === targetIdx) continue
          const m = lines[i].match(FEATURE_LINE_RE)
          if (m && m[1].length === indentLen && m[3] === 'alternative' && m[4] === 'selected') {
            lines[i] = `${m[1]}extends ref feature ${m[2]} alternative`
          }
        }
      }

      const newContent = lines.join('\n')
      await writeFile(variantPath, newContent)
      return json({ ok: true, type: 'featureToggled', variantName: path.basename(variantPath, '.vml'), featureId, selected })
    }

    case 'createVariant': {
      const fmlPathRaw = body.fmlPath as string
      if (!fmlPathRaw) return json({ ok: false, error: 'fmlPath required' }, { status: 400 })
      const variantId = body.variantId as string
      const variantName = body.variantName as string
      const description = (body.description as string) || ''
      const owner = (body.owner as string) || ''

      const { manager, content: fmlContent } = await readViaManager(fmlPathRaw).catch(() => ({ manager: null, content: '' }))
      if (!manager || !fmlContent) return json({ ok: false, error: 'FML not found' }, { status: 404 })

      const docSymbols = manager.allDocuments.get(fmlPathRaw)
      const headerName = docSymbols?.headerSymbol?.name ?? path.basename(fmlPathRaw, '.fml')
      const features = (docSymbols?.definitionSymbols ?? []).filter((s: any) => s.kind === 'feature') as any[]

      let vmlContent = `use featureset ${headerName}\n\n`
      vmlContent += `hdef variantset ${variantId}\n`
      vmlContent += `  name "${variantName}"\n`
      vmlContent += `  description "${description}"\n`
      vmlContent += `  owner "${owner}"\n`
      vmlContent += `  tags "variants", "configuration", "product-family"\n\n`

      const mandatoryChain: boolean[] = [true]
      for (const feature of features) {
        const level = feature.indentLevel || 1
        const indent = '  '.repeat(level)
        const props = feature.properties as Map<string, string[]>
        let flagStr = 'optional'
        for (const k of ['mandatory', 'optional', 'or', 'alternative']) {
          if (props.has(k)) { flagStr = k; break }
        }
        const isMandatory = props.has('mandatory')
        const parentMandatory = level === 1 ? true : (mandatoryChain[level - 1] ?? false)
        mandatoryChain[level] = isMandatory && parentMandatory
        const shouldSelect = isMandatory && parentMandatory
        vmlContent += shouldSelect
          ? `${indent}extends ref feature ${feature.name} ${flagStr} selected\n`
          : `${indent}extends ref feature ${feature.name} ${flagStr}\n`
      }
      vmlContent += `\n// Configure feature selections for your specific variant\n`

      const fmlDir = fmlPathRaw.replace(/\/[^/]+$/, '')
      const vmlPath = `${fmlDir}/${variantId}.vml`
      await writeFile(vmlPath, vmlContent)
      return json({ ok: true, type: 'variantCreated', name: variantId, path: vmlPath, success: true })
    }

    case 'selectVariantForVcf': {
      const vmlPath = body.vmlPath as string
      const { manager, content: vmlContent } = await readViaManager(vmlPath).catch(() => ({ manager: null, content: '' }))
      if (!manager || !vmlContent) return json({ ok: false, error: 'VML file not found' }, { status: 404 })

      const fmlFiles = findSiblingByExt(manager, vmlPath, '.fml')
      if (fmlFiles.length === 0) return json({ ok: false, error: 'No FML file found' }, { status: 404 })
      const fmlPath = fmlFiles[0]
      const fmlBase = path.basename(fmlPath, '.fml')
      const fmlContent = await manager.readFile(fmlPath)

      await manager.parseContent(fmlPath, fmlContent)
      const docSymbols = manager.allDocuments.get(fmlPath)
      const featureSymbols = (docSymbols?.definitionSymbols ?? []).filter((s: any) => s.kind === 'feature') as any[]
      const vmlSelections = parseVmlSelections(vmlContent)
      const vsName = extractVariantsetName(vmlContent) ?? (body.variantName as string)

      let vcfContent = `hdef config ${fmlBase}_Config\n`
      vcfContent += `  generatedfrom ref variantset ${vsName}\n\n`
      vcfContent += `// Feature configuration generated from variant: ${body.variantName}\n\n`
      for (const feature of featureSymbols) {
        const props = feature.properties as Map<string, string[]>
        const nameVal = props.get('name')
        const displayName = nameVal ? nameVal[0].replace(/^"(.*)"$/, '$1') : feature.name
        const sel = vmlSelections.get(feature.name)
        vcfContent += `def featurevalue ${feature.name}\n`
        vcfContent += `  name "${displayName}"\n`
        vcfContent += `  value ${sel?.selected ? 'true' : 'false'}\n\n`
      }

      const fmlDir = fmlPath.replace(/\/[^/]+$/, '')
      const vcfPath = `${fmlDir}/${fmlBase}_Config.vcf`
      await writeFile(vcfPath, vcfContent)
      return json({ ok: true, type: 'vcfGenerated', vcfPath })
    }

    default:
      return json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  }
}

// ─── Route ─────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/api/sylang/variant-matrix')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        return handleGet(request)
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        return handlePost(request)
      },
    },
  },
})
