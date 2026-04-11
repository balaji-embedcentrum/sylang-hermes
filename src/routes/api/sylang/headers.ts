/**
 * GET /api/sylang/headers?kind=requirementset
 *
 * Fast workspace scan: finds all files matching the extension for a given
 * header kind, reads just the first `hdef <kind> <name>` line, and returns
 * the list of header names. Used to populate `useSetId` completions.
 *
 * Does NOT load the full symbol manager — just a grep-style scan.
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

/** Read just the first `hdef <kind> <name>` line from a file */
async function extractHeader(filePath: string, kind: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith(`hdef ${kind} `)) {
        const tokens = trimmed.split(/\s+/)
        // tokens: ['hdef', kind, name, ...]
        if (tokens.length >= 3) return tokens[2]
      }
    }
  } catch {
    // skip unreadable files
  }
  return null
}

export const Route = createFileRoute('/api/sylang/headers')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const kind = (url.searchParams.get('kind') ?? '').trim().toLowerCase()

        if (!kind) {
          return json({ ok: false, error: 'kind param required' }, { status: 400 })
        }

        const ext = HEADER_KIND_TO_EXT[kind]
        if (!ext) {
          return json({ ok: true, headers: [] })
        }

        // Find all matching files in workspace
        const files: string[] = []
        await findFilesWithExt(WORKSPACE_ROOT, ext, files)

        // Extract header names (first matching hdef line)
        const headers: string[] = []
        await Promise.all(
          files.map(async (filePath) => {
            const name = await extractHeader(filePath, kind)
            if (name) headers.push(name)
          }),
        )

        return json({ ok: true, headers: headers.sort() })
      },
    },
  },
})
