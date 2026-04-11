/**
 * POST /api/workspaces/clone
 * Checks if a workspace repo is cloned. If not, clones it and streams progress.
 * Response: SSE stream of { type: 'progress'|'ready'|'error', message }
 */
import path from 'node:path'
import fs from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { createFileRoute } from '@tanstack/react-router'
import { requireAuth } from '../../../server/supabase-auth'
import { getSupabaseServer } from '../../../lib/supabase'

const WORKSPACES_ROOT = (process.env.HERMES_WORKSPACE_DIR || '/tmp/sylang-workspaces').trim()

export const Route = createFileRoute('/api/workspaces/clone')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuth(request).catch(() => null)
        if (!auth) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
        }

        const { workspace_id } = await request.json() as { workspace_id: string }
        if (!workspace_id) {
          return new Response(JSON.stringify({ error: 'workspace_id required' }), { status: 400 })
        }

        // Load workspace and verify ownership
        const admin = getSupabaseServer()
        const { data: workspace } = await admin
          .from('workspaces')
          .select('*')
          .eq('id', workspace_id)
          .eq('user_id', auth.userId)
          .single()

        if (!workspace) {
          return new Response(JSON.stringify({ error: 'Workspace not found' }), { status: 404 })
        }

        const repoFull: string = workspace.repo_full
        // Path: WORKSPACES_ROOT/{userId}/{owner}/{repo}
        const destPath = path.join(WORKSPACES_ROOT, auth.userId, repoFull)
        // Relative path (relative to WORKSPACES_ROOT) for the file browser
        const relativePath = path.join(auth.userId, repoFull)

        // Check if already cloned
        const alreadyCloned = await fs.stat(path.join(destPath, '.git')).then(() => true).catch(() => false)
        if (alreadyCloned) {
          return new Response(
            JSON.stringify({ status: 'ready', path: relativePath }),
            { headers: { 'Content-Type': 'application/json' } },
          )
        }

        // Need to clone — stream progress via SSE
        const token = auth.profile.github_token
        if (!token) {
          return new Response(
            JSON.stringify({ error: 'No GitHub token — please sign out and sign in again' }),
            { status: 400 },
          )
        }

        const cloneUrl = `https://${token}@github.com/${repoFull}.git`

        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          start(controller) {
            const send = (type: string, message: string) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type, message })}\n\n`),
              )
            }

            send('progress', `Preparing workspace...`)

            // Create parent directory
            fs.mkdir(path.dirname(destPath), { recursive: true })
              .then(() => {
                send('progress', `Cloning ${repoFull}...`)

                const git = spawn('git', [
                  'clone',
                  '--depth=1',
                  '--progress',
                  cloneUrl,
                  destPath,
                ])

                git.stderr.on('data', (chunk: Buffer) => {
                  const line = chunk.toString().trim()
                  if (line) send('progress', line)
                })

                git.on('close', (code) => {
                  if (code === 0) {
                    // Update workspace size in DB (best-effort)
                    admin.from('workspaces').update({
                      fs_path: destPath,
                      last_accessed: new Date().toISOString(),
                    }).eq('id', workspace_id).then(() => {})

                    send('ready', relativePath)
                  } else {
                    send('error', `git clone failed with exit code ${code}`)
                  }
                  controller.close()
                })

                git.on('error', (err) => {
                  send('error', err.message)
                  controller.close()
                })
              })
              .catch((err: Error) => {
                send('error', err.message)
                controller.close()
              })
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
