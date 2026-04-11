/**
 * Variant Matrix API
 *
 * GET  /api/sylang/variant-matrix?path=<fmlOrVmlPath>
 *   Returns VariantMatrixData matching the VariantMatrixView component contract:
 *   { features: FeatureHierarchy[], variants: VariantFile[], selections: Record<variantName, Record<featureId, FeatureSelection>>, activeVcfVariant? }
 *
 * POST /api/sylang/variant-matrix
 *   Body: { action: 'toggleFeature', variantPath, featureId, selected }
 *       | { action: 'createVariant', fmlPath, variantId, variantName, description, owner }
 *       | { action: 'selectVariantForVcf', vmlPath, variantName }
 */
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { SylangSymbolManagerCore, type SimpleLogger, type IFileOps } from '../../../sylang/symbolManager/symbolManagerCore'

const WORKSPACE_ROOT = (
  process.env.HERMES_WORKSPACE_DIR ||
  path.join(os.homedir(), '.hermes')
).trim()

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', '.turbo', '.cache'])

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

// ─── Helpers ───────────────────────────────────────────────────────────────

const logger: SimpleLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
}

class NodeFileOps implements IFileOps {
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8')
  }
  async findFiles(pattern: string): Promise<string[]> {
    const ext = pattern.replace(/^.*\*(\.[^*]+)$/, '$1')
    const results: string[] = []
    await walkDir(WORKSPACE_ROOT, ext, results)
    return results
  }
}

class ServerSymbolManager extends SylangSymbolManagerCore {
  constructor() { super(logger, new NodeFileOps()) }
  async parseContent(filePath: string, content: string): Promise<void> {
    return this.parseDocumentContent(filePath, content)
  }
}

function resolveWorkspacePath(filePath: string): string | null {
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.join(WORKSPACE_ROOT, filePath)
  const rel = path.relative(WORKSPACE_ROOT, resolved)
  if (rel.startsWith('..')) return null
  return resolved
}

async function walkDir(dir: string, ext: string, results: string[], depth = 0): Promise<void> {
  if (depth > 6) return
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (IGNORED.has(e.name)) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await walkDir(full, ext, results, depth + 1)
      } else if (e.isFile() && e.name.endsWith(ext)) {
        results.push(full)
      }
    }
  } catch { /* skip */ }
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

  for (const sym of sorted) {
    const feature = featureMap.get(sym.name)
    if (!feature) continue

    while (parentStack.length > 0 && parentStack[parentStack.length - 1].indentLevel >= sym.indentLevel) {
      parentStack.pop()
    }

    if (parentStack.length > 0) {
      const parent = featureMap.get(parentStack[parentStack.length - 1].name)
      if (parent) {
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

// ─── GET handler ───────────────────────────────────────────────────────────

async function handleGet(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const rawPath = url.searchParams.get('path') ?? ''
  if (!rawPath) return json({ ok: false, error: 'path param required' }, { status: 400 })

  const resolved = resolveWorkspacePath(rawPath)
  if (!resolved) return json({ ok: false, error: 'Access denied' }, { status: 403 })

  let fmlPath = resolved
  if (path.extname(resolved) === '.vml') {
    try {
      const vmlContent = await fs.readFile(resolved, 'utf8')
      const useMatch = vmlContent.match(/use\s+featureset\s+(\w+)/)
      if (useMatch) {
        const allFml: string[] = []
        await walkDir(WORKSPACE_ROOT, '.fml', allFml)
        for (const f of allFml) {
          const fc = await fs.readFile(f, 'utf8').catch(() => '')
          if (fc.includes(`hdef featureset ${useMatch[1]}`)) { fmlPath = f; break }
        }
      }
    } catch { /* keep resolved */ }
  }

  let fmlContent: string
  try { fmlContent = await fs.readFile(fmlPath, 'utf8') } catch {
    return json({ ok: false, error: `FML not found: ${fmlPath}` }, { status: 404 })
  }

  const sm = new ServerSymbolManager()
  await sm.parseContent(fmlPath, fmlContent)
  const docSymbols = sm.getDocumentSymbols(fmlPath)
  const featureSymbols = (docSymbols?.definitionSymbols ?? []).filter((s: any) => s.kind === 'feature')
  const features = buildFeatureHierarchy(featureSymbols as any)
  const allFeatures = flattenFeatures(features)

  const fmlDir = path.dirname(fmlPath)
  const allVml: string[] = []
  await walkDir(fmlDir, '.vml', allVml)
  if (allVml.length === 0) await walkDir(WORKSPACE_ROOT, '.vml', allVml)

  const variants: VariantFile[] = []
  for (const vmlFile of allVml) {
    const vc = await fs.readFile(vmlFile, 'utf8').catch(() => '')
    const vsName = extractVariantsetName(vc)
    if (vsName) variants.push({ name: vsName, path: vmlFile, variantsetName: vsName })
  }

  const selections: Record<string, Record<string, FeatureSelection>> = {}
  for (const variant of variants) {
    const vc = await fs.readFile(variant.path, 'utf8').catch(() => '')
    const parsed = parseVmlSelections(vc)
    const sel: Record<string, FeatureSelection> = {}
    for (const f of allFeatures) {
      const p = parsed.get(f.id)
      sel[f.id] = { featureId: f.id, selected: p?.selected ?? false, mandatory: p?.mandatory ?? f.mandatory, optional: p?.optional ?? f.optional }
    }
    selections[variant.name] = sel
  }

  let activeVcfVariant: string | undefined
  try {
    const fmlBase = path.basename(fmlPath, '.fml')
    const vcfPath = path.join(fmlDir, `${fmlBase}_Config.vcf`)
    const vcfContent = await fs.readFile(vcfPath, 'utf8')
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

  switch (action) {
    case 'toggleFeature': {
      const variantPath = resolveWorkspacePath(body.variantPath as string)
      if (!variantPath) return json({ ok: false, error: 'Access denied' }, { status: 403 })
      const featureId = body.featureId as string
      const selected = body.selected as boolean

      let text: string
      try { text = await fs.readFile(variantPath, 'utf8') } catch {
        return json({ ok: false, error: 'VML file not found' }, { status: 404 })
      }

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

      await fs.writeFile(variantPath, lines.join('\n'), 'utf8')
      return json({ ok: true, type: 'featureToggled', variantName: path.basename(variantPath, '.vml'), featureId, selected })
    }

    case 'createVariant': {
      const fmlPathRaw = resolveWorkspacePath((body.fmlPath as string) || '')
      if (!fmlPathRaw) return json({ ok: false, error: 'Access denied: fmlPath required' }, { status: 403 })
      const variantId = body.variantId as string
      const variantName = body.variantName as string
      const description = (body.description as string) || ''
      const owner = (body.owner as string) || ''

      let fmlContent: string
      try { fmlContent = await fs.readFile(fmlPathRaw, 'utf8') } catch {
        return json({ ok: false, error: 'FML not found' }, { status: 404 })
      }

      const sm = new ServerSymbolManager()
      await sm.parseContent(fmlPathRaw, fmlContent)
      const docSymbols = sm.getDocumentSymbols(fmlPathRaw)
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

      const fmlDir = path.dirname(fmlPathRaw)
      const vmlPath = path.join(fmlDir, `${variantId}.vml`)
      await fs.writeFile(vmlPath, vmlContent, 'utf8')
      return json({ ok: true, type: 'variantCreated', name: variantId, path: vmlPath, success: true })
    }

    case 'selectVariantForVcf': {
      const vmlPath = resolveWorkspacePath(body.vmlPath as string)
      if (!vmlPath) return json({ ok: false, error: 'Access denied' }, { status: 403 })

      let vmlContent: string
      try { vmlContent = await fs.readFile(vmlPath, 'utf8') } catch {
        return json({ ok: false, error: 'VML file not found' }, { status: 404 })
      }

      const fmlDir = path.dirname(vmlPath)
      const fmlFiles: string[] = []
      await walkDir(fmlDir, '.fml', fmlFiles)
      if (fmlFiles.length === 0) return json({ ok: false, error: 'No FML file found' }, { status: 404 })
      const fmlPath = fmlFiles[0]
      const fmlBase = path.basename(fmlPath, '.fml')
      const fmlContent = await fs.readFile(fmlPath, 'utf8')

      const sm = new ServerSymbolManager()
      await sm.parseContent(fmlPath, fmlContent)
      const docSymbols = sm.getDocumentSymbols(fmlPath)
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

      const vcfPath = path.join(fmlDir, `${fmlBase}_Config.vcf`)
      await fs.writeFile(vcfPath, vcfContent, 'utf8')
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
