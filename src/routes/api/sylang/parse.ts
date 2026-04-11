/**
 * POST /api/sylang/parse
 * Converts raw Sylang DSL text → Tiptap JSON document.
 * Used by SylangFileEditor to send parsed content to the webview iframe.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { parseDSLToTiptap } from '../../../sylang/parser/dslParser'

export const Route = createFileRoute('/api/sylang/parse')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { content, fileExtension } = await request.json() as {
            content: string
            fileExtension: string
          }
          if (!content || !fileExtension) {
            return json({ error: 'content and fileExtension required' }, { status: 400 })
          }
          const document = parseDSLToTiptap(content, fileExtension)
          return json({ document })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[sylang/parse] error:', msg)
          return json({ error: msg }, { status: 500 })
        }
      },
    },
  },
})
