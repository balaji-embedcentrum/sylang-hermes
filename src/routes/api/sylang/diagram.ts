/**
 * POST /api/sylang/diagram
 *
 * Generate diagram data for a given Sylang file.
 *
 * Request body:
 *   { filePath: string, diagramType: string, focusIdentifier?: string }
 *
 * filePath is relative to WORKSPACE_ROOT (same convention as /api/files).
 *
 * Returns DiagramData or an error object.
 */
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { SylangSymbolManagerCore, type SimpleLogger, type IFileOps } from '../../../sylang/symbolManager/symbolManagerCore'
import { WebDiagramTransformer } from '../../../sylang/diagrams/WebDiagramTransformer'
import { DiagramType } from '../../../sylang/diagrams/diagramTypes'

const WORKSPACE_ROOT = (
  process.env.HERMES_WORKSPACE_DIR ||
  path.join(os.homedir(), '.hermes')
).trim()

// ─── Simple console logger ─────────────────────────────────────────────────

const logger: SimpleLogger = {
  info: (m) => console.info('[Diagram]', m),
  error: (m) => console.error('[Diagram]', m),
  warn: (m) => console.warn('[Diagram]', m),
  debug: (m) => console.debug('[Diagram]', m),
}

// ─── File ops backed by fs/promises ───────────────────────────────────────

class NodeFileOps implements IFileOps {
  async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8')
  }

  async findFiles(pattern: string): Promise<string[]> {
    // Simple glob: pattern is like "**/*.req" — walk WORKSPACE_ROOT
    const ext = pattern.replace(/^.*\*(\.[^*]+)$/, '$1')
    const results: string[] = []
    await walkDir(WORKSPACE_ROOT, ext, results)
    return results
  }
}

const IGNORED = new Set(['.git', 'node_modules', '.next', 'dist', '.turbo', '.cache'])

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
  } catch {
    // skip unreadable dirs
  }
}

// ─── Thin subclass to expose parseDocumentContent publicly ─────────────────

class ServerSymbolManager extends SylangSymbolManagerCore {
  constructor() {
    super(logger, new NodeFileOps())
  }

  /** Expose protected parseDocumentContent as public for the API route */
  async parseContent(filePath: string, content: string): Promise<void> {
    return this.parseDocumentContent(filePath, content)
  }
}

// ─── Route ─────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/api/sylang/diagram')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        let body: { filePath?: string; diagramType?: string; focusIdentifier?: string }
        try {
          body = await request.json() as typeof body
        } catch {
          return json({ ok: false, error: 'Invalid JSON body' }, { status: 400 })
        }

        const { filePath, diagramType, focusIdentifier } = body

        if (!filePath || !diagramType) {
          return json({ ok: false, error: 'filePath and diagramType are required' }, { status: 400 })
        }

        // Validate diagramType
        const validTypes = Object.values(DiagramType) as string[]
        if (!validTypes.includes(diagramType)) {
          return json({ ok: false, error: `Unknown diagramType: ${diagramType}` }, { status: 400 })
        }

        // Resolve absolute path
        const resolved = path.isAbsolute(filePath)
          ? filePath
          : path.join(WORKSPACE_ROOT, filePath)

        // Security: ensure resolved path stays within WORKSPACE_ROOT
        const rel = path.relative(WORKSPACE_ROOT, resolved)
        if (rel.startsWith('..')) {
          return json({ ok: false, error: 'Access denied: path outside workspace' }, { status: 403 })
        }

        // Read file content
        let content: string
        try {
          content = await fs.readFile(resolved, 'utf8')
        } catch {
          return json({ ok: false, error: `File not found: ${filePath}` }, { status: 404 })
        }

        // Build symbol manager with this file pre-loaded
        const sm = new ServerSymbolManager()
        await sm.parseContent(resolved, content)

        // Generate diagram
        const transformer = new WebDiagramTransformer(sm, logger)
        const result = await transformer.transformFileToDiagram(
          resolved,
          diagramType as DiagramType,
          focusIdentifier,
        )

        if (!result.success) {
          return json({ ok: false, error: result.error ?? 'Diagram generation failed' }, { status: 422 })
        }

        return json({ ok: true, data: result.data })
      },
    },
  },
})
