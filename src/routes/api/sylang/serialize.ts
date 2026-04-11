/**
 * POST /api/sylang/serialize
 * Converts Tiptap JSON document → Sylang DSL text.
 * Called when the webview iframe sends a save/contentChange message.
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { serializeToDSL } from '../../../sylang/serializer/dslSerializer'

export const Route = createFileRoute('/api/sylang/serialize')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { document, fileExtension } = await request.json() as {
            document: unknown
            fileExtension: string
          }
          if (!document || !fileExtension) {
            return json({ error: 'document and fileExtension required' }, { status: 400 })
          }
          const content = serializeToDSL(document as any, fileExtension)
          return json({ content })
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error('[sylang/serialize] error:', msg)
          return json({ error: msg }, { status: 500 })
        }
      },
    },
  },
})
