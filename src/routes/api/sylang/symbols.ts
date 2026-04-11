/**
 * GET /api/sylang/symbols?nodeType=function&headerKind=functionset
 *
 * Fast workspace scan: finds all files matching the extension for the given
 * headerKind, reads every `def <nodeType> <name>` line, and returns the
 * collected IDs. Used for `relationTargetId` completions.
 *
 * Example: nodeType=requirement&headerKind=requirementset
 * → scans all .req files → returns all `def requirement <id>` values
 */
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'

const WORKSPACE_ROOT = (
  process.env.HERMES_WORKSPACE_DIR ||
  path.join(os.homedir(), '.hermes')
).trim()

const HEADER_KIND_TO_EXT: Record<string, string> = {
  requirementset: '.req',
  functionset: '.fun',
  featureset: '.fml',
  variantset: '.vml',
  configset: '.vcf',
  testset: '.tst',
  testcaseset: '.tst',
  block: '.blk',
  interfaceset: '.ifc',
  failureset: '.flr',
  hazardset: '.haz',
  hazardanalysis: '.haz',
  safetygoalset: '.sgl',
  safetymechanismset: '.sam',
  faulttree: '.fta',
  agentset: '.agt',
  usecaseset: '.ucd',
  sequenceset: '.seq',
  statemachine: '.smd',
  sprint: '.spr',
  itemdefinition: '.itm',
  spec: '.spec',
}

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', '.turbo', '.cache'])

async function findFilesWithExt(dir: string, ext: string, results: string[], depth = 0): Promise<void> {
  if (depth > 6) return
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (IGNORED.has(e.name)) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await findFilesWithExt(full, ext, results, depth + 1)
      } else if (e.isFile() && e.name.endsWith(ext)) {
        results.push(full)
      }
    }
  } catch {
    // skip unreadable dirs
  }
}

/** Extract all `def <nodeType> <name>` identifiers from a file */
async function extractDefIds(filePath: string, nodeType: string): Promise<string[]> {
  const ids: string[] = []
  try {
    const content = await fs.readFile(filePath, 'utf8')
    const prefix = `def ${nodeType} `
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith(prefix)) {
        const tokens = trimmed.split(/\s+/)
        // tokens: ['def', nodeType, name, ...]
        if (tokens.length >= 3) ids.push(tokens[2])
      }
    }
  } catch {
    // skip unreadable files
  }
  return ids
}

export const Route = createFileRoute('/api/sylang/symbols')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const nodeType = (url.searchParams.get('nodeType') ?? '').trim().toLowerCase()
        const headerKind = (url.searchParams.get('headerKind') ?? '').trim().toLowerCase()

        if (!nodeType || !headerKind) {
          return json({ ok: false, error: 'nodeType and headerKind params required' }, { status: 400 })
        }

        const ext = HEADER_KIND_TO_EXT[headerKind]
        if (!ext) {
          return json({ ok: true, ids: [] })
        }

        const files: string[] = []
        await findFilesWithExt(WORKSPACE_ROOT, ext, files)

        // Collect all def IDs from all matching files in parallel
        const allIds = (await Promise.all(files.map((f) => extractDefIds(f, nodeType)))).flat()

        // Deduplicate and sort
        const ids = Array.from(new Set(allIds)).sort()

        return json({ ok: true, ids })
      },
    },
  },
})
