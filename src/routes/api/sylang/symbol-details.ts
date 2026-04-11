/**
 * GET /api/sylang/symbol-details?id=<symbolId>
 *
 * Scans the workspace for a symbol (header or definition) matching <id>.
 * Returns the first match including its properties. Used as a fallback
 * when the browser-side WebSymbolManager hasn't loaded the relevant file yet.
 *
 * Example: id=REQ-001 → scans all .req files → returns def/hdef match
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

const SYLANG_EXTENSIONS = [
  '.req', '.agt', '.blk', '.fml', '.fun', '.haz',
  '.ifc', '.itm', '.ple', '.sam', '.seq', '.sgl',
  '.smd', '.spec', '.spr', '.tst', '.ucd', '.vcf', '.vml', '.fta', '.flr',
]

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', '.turbo', '.cache'])

async function findAllSylangFiles(dir: string, results: string[], depth = 0): Promise<void> {
  if (depth > 6) return
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      if (IGNORED.has(e.name)) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        await findAllSylangFiles(full, results, depth + 1)
      } else if (e.isFile() && SYLANG_EXTENSIONS.some((ext) => e.name.endsWith(ext))) {
        results.push(full)
      }
    }
  } catch { /* skip */ }
}

type FoundSymbol = {
  name: string
  kind: string
  type: 'header' | 'definition'
  properties: Record<string, string>
  fileName: string
  filePath: string
  line: number
}

async function searchFileForSymbol(filePath: string, symbolId: string): Promise<FoundSymbol | null> {
  let content: string
  try {
    content = await fs.readFile(filePath, 'utf8')
  } catch { return null }

  const lines = content.split('\n')
  let currentSymbol: FoundSymbol | null = null
  const properties: Record<string, string> = {}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) continue

    const tokens = trimmed.split(/\s+/)

    // hdef <kind> <name>
    if (tokens[0] === 'hdef' && tokens.length >= 3 && tokens[2] === symbolId) {
      return {
        name: symbolId,
        kind: tokens[1],
        type: 'header',
        properties: {},
        fileName: path.basename(filePath),
        filePath,
        line: i + 1,
      }
    }

    // def <kind> <name>
    if (tokens[0] === 'def' && tokens.length >= 3 && tokens[2] === symbolId) {
      currentSymbol = {
        name: symbolId,
        kind: tokens[1],
        type: 'definition',
        properties,
        fileName: path.basename(filePath),
        filePath,
        line: i + 1,
      }
      continue
    }

    // Collect properties that follow the def line (indented lines with key value)
    if (currentSymbol) {
      // Next top-level keyword ends the block
      if (tokens[0] === 'def' || tokens[0] === 'hdef' || tokens[0] === 'use' || tokens[0] === 'relation') {
        break
      }
      // Property line: indented, "key value..." — skip keywords like 'relation', 'use'
      if (line.startsWith('  ') || line.startsWith('\t')) {
        const propKey = tokens[0]
        const propVal = tokens.slice(1).join(' ')
        if (propKey && propVal && !['relation', 'use'].includes(propKey)) {
          properties[propKey] = propVal
        }
      }
    }
  }

  return currentSymbol
}

export const Route = createFileRoute('/api/sylang/symbol-details')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const symbolId = (url.searchParams.get('id') ?? '').trim()

        if (!symbolId) {
          return json({ ok: false, error: 'id param required' }, { status: 400 })
        }

        const files: string[] = []
        await findAllSylangFiles(WORKSPACE_ROOT, files)

        // Search files in parallel, return first match
        const results = await Promise.all(files.map((f) => searchFileForSymbol(f, symbolId)))
        const found = results.find((r) => r !== null) ?? null

        if (!found) {
          return json({ ok: false, error: `Symbol '${symbolId}' not found` })
        }

        return json({ ok: true, symbol: found })
      },
    },
  },
})
