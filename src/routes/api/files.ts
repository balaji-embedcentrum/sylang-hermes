import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import {
  isAuthenticated,
  requireLocalOrAuth,
} from '../../server/auth-middleware'
import {
  getClientIp,
  rateLimit,
  rateLimitResponse,
  requireJsonContentType,
  safeErrorMessage,
} from '../../server/rate-limit'

const execFileAsync = promisify(execFile)

const WORKSPACE_ROOT = (
  process.env.HERMES_WORKSPACE_DIR ||
  process.env.HERMES_WORKSPACE_DIR ||
  path.join(os.homedir(), '.hermes')
).trim()

// When set, all file reads/writes are proxied to the Hermes agent's /ws/ API
// so the editor and the agent operate on the exact same files.
const HERMES_AGENT_URL = (process.env.HERMES_API_URL || '').trim().replace(/\/$/, '')

/**
 * Parse a frontend workspace-relative path like:
 *   {userId}/{githubLogin}/{repo}/{relInRepo}
 * Returns repo name and path relative to repo root.
 */
function parseWorkspacePath(relPath: string) {
  const parts = relPath.replace(/\\/g, '/').split('/').filter(Boolean)
  // parts[0]=userId, parts[1]=githubLogin, parts[2]=repo, parts[3+]=relInRepo
  if (parts.length < 3) return null
  return {
    repo: parts[2],
    relInRepo: parts.slice(3).join('/'),
  }
}

/**
 * Translate a repo-relative path back to a frontend workspace-relative path
 * by prepending the prefix from the original frontend path.
 */
function toFrontendPath(prefix: string, agentRelPath: string) {
  return agentRelPath ? `${prefix}/${agentRelPath}` : prefix
}

type FileEntry = {
  name: string
  path: string
  type: 'file' | 'folder'
  size?: number
  modifiedAt?: string
  children?: Array<FileEntry>
}

function ensureWorkspacePath(input: string) {
  const raw = input.trim()
  if (!raw) return WORKSPACE_ROOT
  const resolved = path.isAbsolute(raw)
    ? path.resolve(raw)
    : path.resolve(WORKSPACE_ROOT, raw)
  if (!resolved.startsWith(WORKSPACE_ROOT)) {
    throw new Error('Path is outside workspace')
  }
  return resolved
}

function toRelative(resolvedPath: string) {
  const relative = path.relative(WORKSPACE_ROOT, resolvedPath)
  return relative || ''
}

function sortEntries(entries: Array<FileEntry>) {
  return entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

function normalizePathForGlob(input: string) {
  return input.replace(/\\/g, '/')
}

function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasGlob(input: string) {
  return input.includes('*')
}

function parseGlobPattern(input: string) {
  const normalized = normalizePathForGlob(input.trim())
  const lastSlashIndex = normalized.lastIndexOf('/')
  const directoryPath =
    lastSlashIndex >= 0 ? normalized.slice(0, lastSlashIndex) : ''
  const filePattern =
    lastSlashIndex >= 0 ? normalized.slice(lastSlashIndex + 1) : normalized

  const regexSource = `^${escapeRegex(filePattern).replace(/\\\*/g, '.*')}$`

  return {
    directoryPath,
    regex: new RegExp(regexSource),
  }
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'dist',
  '.DS_Store',
])

const MAX_DIRECTORY_DEPTH = 3
const MAX_DIRECTORY_ENTRIES = 20_000

type ReadDirectoryOptions = {
  maxDepth: number
  maxEntries: number | null
  countedEntries: { value: number }
}

function parseMaxDepth(input: string | null): number | null {
  if (!input) return null
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) return null
  return Math.min(MAX_DIRECTORY_DEPTH, Math.max(0, Math.floor(parsed)))
}

function parseMaxEntries(input: string | null): number | null {
  if (!input) return null
  const parsed = Number(input)
  if (!Number.isFinite(parsed)) return null
  return Math.min(MAX_DIRECTORY_ENTRIES, Math.max(1, Math.floor(parsed)))
}

async function readDirectory(
  dirPath: string,
  depth: number,
  options: ReadDirectoryOptions,
): Promise<Array<FileEntry>> {
  if (depth > options.maxDepth) return []
  if (
    options.maxEntries !== null &&
    options.countedEntries.value >= options.maxEntries
  ) {
    return []
  }

  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const mapped: Array<FileEntry> = []

  for (const entry of entries) {
    if (
      options.maxEntries !== null &&
      options.countedEntries.value >= options.maxEntries
    ) {
      break
    }

    if (IGNORED_DIRS.has(entry.name)) continue
    const fullPath = path.join(dirPath, entry.name)
    const relativePath = toRelative(fullPath)
    try {
      const stats = await fs.stat(fullPath)
      if (entry.isDirectory()) {
        const children = await readDirectory(fullPath, depth + 1, options)
        mapped.push({
          name: entry.name,
          path: relativePath,
          type: 'folder',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
          children,
        })
      } else {
        mapped.push({
          name: entry.name,
          path: relativePath,
          type: 'file',
          size: stats.size,
          modifiedAt: stats.mtime.toISOString(),
        })
      }
      options.countedEntries.value += 1
    } catch {
      // Skip broken symlinks or inaccessible entries
      continue
    }
  }

  return sortEntries(mapped)
}

async function readGlobDirectory(globPath: string) {
  const { directoryPath, regex } = parseGlobPattern(globPath)
  const resolvedDirectory = ensureWorkspacePath(directoryPath)
  const entries = await fs.readdir(resolvedDirectory, { withFileTypes: true })
  const mapped: Array<FileEntry> = []

  for (const entry of entries) {
    if (!regex.test(entry.name)) continue
    const fullPath = path.join(resolvedDirectory, entry.name)
    const stats = await fs.stat(fullPath)
    mapped.push({
      name: entry.name,
      path: toRelative(fullPath),
      type: entry.isDirectory() ? 'folder' : 'file',
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
    })
  }

  return {
    root: toRelative(resolvedDirectory),
    entries: sortEntries(mapped),
  }
}

function getMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    default:
      return 'application/octet-stream'
  }
}

function isImageFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)
}

export const Route = createFileRoute('/api/files')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        try {
          const url = new URL(request.url)
          const action = url.searchParams.get('action') || 'list'
          const inputPath = url.searchParams.get('path') || ''
          const maxDepthParam = parseMaxDepth(url.searchParams.get('maxDepth'))
          const maxEntriesParam = parseMaxEntries(
            url.searchParams.get('maxEntries'),
          )

          if (action === 'list' && hasGlob(inputPath)) {
            const globListing = await readGlobDirectory(inputPath)
            return json({
              root: globListing.root,
              base: WORKSPACE_ROOT,
              entries: globListing.entries,
            })
          }

          // --- Proxy to Hermes agent /ws/ API ---
          // When HERMES_API_URL is configured and the path is a workspace path
          // ({userId}/{githubLogin}/{repo}/...), ALL reads and listings go to the
          // agent. There is NO fallback to local filesystem — that would silently
          // serve stale/wrong data from /tmp/sylang-workspaces.
          if (HERMES_AGENT_URL && !hasGlob(inputPath)) {
            const parsed = parseWorkspacePath(inputPath)
            if (parsed) {
              const { repo, relInRepo } = parsed
              const prefix = inputPath
                .replace(/\\/g, '/')
                .split('/')
                .slice(0, 3)
                .join('/')

              if (action === 'read') {
                if (!relInRepo) {
                  return json({ error: 'Cannot read a directory as a file' }, { status: 400 })
                }
                const agentRes = await fetch(
                  `${HERMES_AGENT_URL}/ws/${encodeURIComponent(repo)}/file?path=${encodeURIComponent(relInRepo)}`,
                )
                if (!agentRes.ok) {
                  const err = await agentRes.json().catch(() => ({})) as Record<string, unknown>
                  return json({ error: (err as { message?: string }).message || 'Agent read failed' }, { status: agentRes.status })
                }
                const data = await agentRes.json() as { content?: string }
                return json({
                  type: 'text',
                  path: inputPath,
                  content: data.content ?? '',
                })
              }

              if (action === 'list') {
                const agentRes = await fetch(
                  `${HERMES_AGENT_URL}/ws/${encodeURIComponent(repo)}/tree?path=${encodeURIComponent(relInRepo)}`,
                )
                if (!agentRes.ok) {
                  const err = await agentRes.json().catch(() => ({})) as Record<string, unknown>
                  return json({ error: (err as { message?: string }).message || 'Agent tree failed' }, { status: agentRes.status })
                }
                const data = await agentRes.json() as { entries?: Array<{ name: string; path: string; type: string }> }
                const entries: Array<FileEntry> = (data.entries ?? []).map((e) => ({
                  name: e.name,
                  path: toFrontendPath(prefix, e.path),
                  type: e.type === 'dir' ? 'folder' : 'file',
                }))
                return json({
                  root: inputPath,
                  base: WORKSPACE_ROOT,
                  entries,
                })
              }

              // For any other action (download etc.) on a workspace path, error
              // rather than silently falling back to the wrong local copy.
              return json({ error: `Action '${action}' not supported via agent proxy` }, { status: 400 })
            }
          }
          // --- End proxy ---

          const resolvedPath = ensureWorkspacePath(inputPath)

          if (action === 'read') {
            const [buffer, stats] = await Promise.all([
              fs.readFile(resolvedPath),
              fs.stat(resolvedPath),
            ])
            if (isImageFile(resolvedPath)) {
              const mime = getMimeType(resolvedPath)
              return json({
                type: 'image',
                path: toRelative(resolvedPath),
                content: `data:${mime};base64,${buffer.toString('base64')}`,
                modifiedAt: stats.mtime.toISOString(),
              })
            }
            return json({
              type: 'text',
              path: toRelative(resolvedPath),
              content: buffer.toString('utf8'),
              modifiedAt: stats.mtime.toISOString(),
            })
          }

          if (action === 'download') {
            const buffer = await fs.readFile(resolvedPath)
            return new Response(buffer, {
              headers: {
                'Content-Type': getMimeType(resolvedPath),
                'Content-Disposition': `attachment; filename="${path.basename(
                  resolvedPath,
                )}"`,
              },
            })
          }

          const tree = await readDirectory(resolvedPath, 0, {
            maxDepth: maxDepthParam ?? MAX_DIRECTORY_DEPTH,
            maxEntries: maxEntriesParam,
            countedEntries: { value: 0 },
          })
          return json({
            root: toRelative(resolvedPath),
            base: WORKSPACE_ROOT,
            entries: tree,
          })
        } catch (err) {
          return json({ error: safeErrorMessage(err) }, { status: 500 })
        }
      },
      POST: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }
        const ip = getClientIp(request)
        if (!rateLimit(`files:${ip}`, 30, 60_000)) {
          return rateLimitResponse()
        }

        try {
          const contentType = request.headers.get('content-type') || ''
          if (!contentType.includes('multipart/form-data')) {
            const csrfCheck = requireJsonContentType(request)
            if (csrfCheck) return csrfCheck
          }
          if (contentType.includes('multipart/form-data')) {
            const form = await request.formData()
            const action = String(form.get('action') || 'upload')
            if (action !== 'upload') {
              return json({ error: 'Invalid upload request' }, { status: 400 })
            }
            const file = form.get('file')
            const targetPath = String(form.get('path') || '')
            if (!(file instanceof File)) {
              return json({ error: 'Missing file' }, { status: 400 })
            }
            const resolvedTarget = ensureWorkspacePath(targetPath)
            const isDir = (await fs.stat(resolvedTarget)).isDirectory()
            const destination = isDir
              ? path.join(resolvedTarget, file.name)
              : resolvedTarget
            await fs.mkdir(path.dirname(destination), { recursive: true })
            const buffer = Buffer.from(await file.arrayBuffer())
            await fs.writeFile(destination, buffer)
            return json({ ok: true, path: toRelative(destination) })
          }

          const body = (await request.json().catch(() => ({}))) as Record<
            string,
            unknown
          >
          const action = typeof body.action === 'string' ? body.action : 'write'

          if (action === 'mkdir') {
            const dirPath = ensureWorkspacePath(String(body.path || ''))
            await fs.mkdir(dirPath, { recursive: true })
            return json({ ok: true, path: toRelative(dirPath) })
          }

          if (action === 'rename') {
            const fromPath = ensureWorkspacePath(String(body.from || ''))
            const toPath = ensureWorkspacePath(String(body.to || ''))
            await fs.mkdir(path.dirname(toPath), { recursive: true })
            await fs.rename(fromPath, toPath)
            return json({ ok: true, path: toRelative(toPath) })
          }

          if (action === 'delete') {
            if (!requireLocalOrAuth(request)) {
              return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
            }
            const targetPath = ensureWorkspacePath(String(body.path || ''))
            try {
              // Try macOS trash command first
              await execFileAsync('trash', [targetPath])
            } catch {
              // Fallback to rm -rf if trash is not available
              await fs.rm(targetPath, { recursive: true, force: true })
            }
            return json({ ok: true })
          }

          // --- Proxy write to Hermes agent /ws/ API ---
          if (HERMES_AGENT_URL) {
            const rawPath = String(body.path || '')
            const parsed = parseWorkspacePath(rawPath)
            if (parsed?.relInRepo) {
              const { repo, relInRepo } = parsed
              const agentRes = await fetch(
                `${HERMES_AGENT_URL}/ws/${encodeURIComponent(repo)}/file`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    path: relInRepo,
                    content: typeof body.content === 'string' ? body.content : '',
                  }),
                },
              )
              if (!agentRes.ok) {
                const err = await agentRes.json().catch(() => ({})) as Record<string, unknown>
                return json({ error: (err as { message?: string }).message || 'Agent write failed' }, { status: agentRes.status })
              }
              return json({ ok: true, path: rawPath })
            }
          }
          // --- End proxy ---

          const filePath = ensureWorkspacePath(String(body.path || ''))
          const content = typeof body.content === 'string' ? body.content : ''
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          await fs.writeFile(filePath, content, 'utf8')
          return json({ ok: true, path: toRelative(filePath) })
        } catch (err) {
          return json({ error: safeErrorMessage(err) }, { status: 500 })
        }
      },
    },
  },
})
