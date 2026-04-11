'use client'

import { useEffect, useRef, useState } from 'react'
import { parseDSLToTiptap } from '../../sylang/parser/dslParser'
import { serializeToDSL } from '../../sylang/serializer/dslSerializer'
import { getWebSymbolManager } from '../../sylang/symbolManager/WebSymbolManager'
import type { SylangSymbol } from '../../sylang/symbolManager/symbolManagerCore'
import { getAllowedRelations, getAllowedTargetNodeTypes, getRequiredSetTypeForTargetNodeType } from '../../sylang/utils/editorSchema'
import { getAvailableSetTypes } from '../../sylang/utils/fileTypeConfig'
import { getEnumValues } from '../../sylang/utils/propertyIntrospection'

interface Props {
  /** Relative path from WORKSPACE_ROOT, e.g. "{userId}/owner/repo/src/system.req" */
  filePath: string
  fileName: string
  /** e.g. ".req", ".blk", ".agt" */
  fileExtension: string
}

export const SYLANG_EXTENSIONS = new Set([
  '.req', '.agt', '.blk', '.fml', '.fun', '.haz',
  '.ifc', '.itm', '.ple', '.sam', '.seq', '.sgl',
  '.smd', '.spec', '.spr', '.tst', '.ucd', '.vcf',
  '.vml', '.fta', '.flr', '.dash', '.extend',
])

export function isSylangFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.'))
  return SYLANG_EXTENSIONS.has(ext)
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | null

export function SylangFileEditor({ filePath, fileName, fileExtension }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null)
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Store parsed doc so the 'ready' handler can send it regardless of timing
  const pendingDoc = useRef<unknown>(null)
  // Track disk mtime so we can detect external changes (e.g. Hermes agent edits)
  const lastMtimeRef = useRef<string | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sendInit = (doc: unknown) => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: 'init',
        document: doc,
        fileExtension,
        fileName,
        relativePath: filePath,
        colorPalette: 'teal',
        disabledBlockIds: [],
      },
      '*',
    )
  }

  // Load file → parse → store doc, send init if iframe already ready
  useEffect(() => {
    let cancelled = false
    pendingDoc.current = null

    async function loadAndInit() {
      setLoading(true)
      setError(null)
      try {
        const readRes = await fetch(
          `/api/files?action=read&path=${encodeURIComponent(filePath)}`,
        )
        if (!readRes.ok) throw new Error(`Cannot read file: HTTP ${readRes.status}`)
        const { content: dslText, modifiedAt } = await readRes.json() as { content: string; modifiedAt?: string }

        const doc = parseDSLToTiptap(dslText, fileExtension)

        if (cancelled) return

        lastMtimeRef.current = modifiedAt ?? null
        pendingDoc.current = doc
        setLoading(false)

        // Load symbols in background (non-blocking) for completions
        const sm = getWebSymbolManager()
        sm.loadDocumentWithImports(filePath, dslText).catch(() => {
          // non-critical: completions just won't have import context
        })

        // If iframe is already loaded and ready, send now.
        if (iframeRef.current?.contentWindow) {
          sendInit(doc)
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      }
    }

    void loadAndInit()
    return () => { cancelled = true }
  }, [filePath, fileExtension, fileName])

  // Poll for external file changes (e.g. Hermes agent edits on disk)
  // Every 2 seconds, stat the file — if mtime changed, reload and re-init the editor.
  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      // Don't poll while user is actively saving (pendingSave in flight)
      if (pendingSave.current) {
        pollTimerRef.current = setTimeout(poll, 2000)
        return
      }
      try {
        const res = await fetch(`/api/files?action=read&path=${encodeURIComponent(filePath)}`)
        if (!res.ok || cancelled) return
        const { content: dslText, modifiedAt } = await res.json() as { content: string; modifiedAt?: string }
        if (cancelled) return
        if (modifiedAt && modifiedAt !== lastMtimeRef.current) {
          // File changed externally — reload
          lastMtimeRef.current = modifiedAt
          const doc = parseDSLToTiptap(dslText, fileExtension)
          pendingDoc.current = doc
          setSaveStatus(null)
          // Refresh symbol manager
          getWebSymbolManager().refreshDocument(filePath, dslText).catch(() => {})
          // Re-send init to iframe so editor reflects new content
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage(
              { type: 'init', document: doc, fileExtension, fileName, relativePath: filePath, colorPalette: 'teal', disabledBlockIds: [] },
              '*',
            )
          }
        }
      } catch { /* ignore poll errors */ }
      if (!cancelled) pollTimerRef.current = setTimeout(poll, 2000)
    }

    pollTimerRef.current = setTimeout(poll, 2000)
    return () => {
      cancelled = true
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [filePath, fileExtension, fileName])

  // Listen for messages from the webview iframe
  useEffect(() => {
    async function handleMessage(event: MessageEvent) {
      const msg = event.data
      if (!msg || typeof msg !== 'object') return

      switch (msg.type) {
        case 'ready':
          // iframe signalled ready — send the document if we have it
          if (pendingDoc.current) {
            sendInit(pendingDoc.current)
          }
          break

        case 'contentChange': {
          if (pendingSave.current) clearTimeout(pendingSave.current)
          setSaveStatus('unsaved')
          pendingSave.current = setTimeout(async () => {
            setSaveStatus('saving')
            try {
              const content = serializeToDSL(msg.document, fileExtension)
              await fetch('/api/files', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'write', path: filePath, content }),
              })
              // Refresh symbol manager after save so completions stay fresh
              getWebSymbolManager().refreshDocument(filePath, content).catch(() => {})
              setSaveStatus('saved')
            } catch {
              setSaveStatus('unsaved')
            }
          }, 800)
          break
        }

        case 'getPropertySchema': {
          const { requestId } = msg
          iframeRef.current?.contentWindow?.postMessage(
            { requestId, ok: true, result: { schema: [] } },
            '*',
          )
          break
        }

        case 'getSlashCompletions': {
          const { requestId, context, query } = msg as {
            requestId: string
            query: string
            // Matches CellPickerContext from cellPickerExtension.ts exactly:
            context: {
              kind: string
              defKeyword?: string      // source node type (e.g. 'requirement')
              setType?: string         // useSetId: which set kind was picked
              relationKeyword?: string // col 0 of relations table
              nodeType?: string        // col 1 of relations table (target node type)
              propName?: string        // propertyValue: property name
              rowIndex?: number
              colIndex?: number
            }
          }
          const items = await resolveCompletions(filePath, fileExtension, context, query)
          // CellPickerMenu expects Item[] with { label, kind, insertText }
          const structured = items.map((s) => ({ label: s, kind: 'insertText' as const, insertText: s }))
          iframeRef.current?.contentWindow?.postMessage(
            { requestId, ok: true, result: { items: structured } },
            '*',
          )
          break
        }

        case 'getSymbolDetails': {
          const { requestId, symbolId } = msg as { requestId: string; symbolId: string }
          const sm = getWebSymbolManager()
          let found = sm.findSymbolById(symbolId)

          // If not in memory (file not yet loaded), do a server-side scan
          if (!found) {
            found = await fetchSymbolDetailsFromServer(symbolId)
          }

          if (found) {
            const properties: Record<string, string> = {}
            for (const [key, values] of found.symbol.properties.entries()) {
              const v = Array.isArray(values) ? values.join(', ') : String(values)
              if (v.trim()) properties[key] = v
            }
            iframeRef.current?.contentWindow?.postMessage({
              type: 'symbolDetails',
              requestId,
              ok: true,
              symbol: {
                id: found.symbol.name,
                kind: found.symbol.kind,
                type: found.symbol.type,
                properties,
                fileName: found.fileName,
                filePath: found.filePath,
                line: found.symbol.line,
              },
            }, '*')
          } else {
            iframeRef.current?.contentWindow?.postMessage({
              type: 'symbolDetails', requestId, ok: false, error: `Symbol '${symbolId}' not found`,
            }, '*')
          }
          break
        }

        case 'openSymbolById': {
          const { symbolId } = msg as { symbolId: string }
          if (!symbolId) break
          // Find the file that contains this symbol
          const sm = getWebSymbolManager()
          let symResult = sm.findSymbolById(symbolId)
          if (!symResult) {
            symResult = await fetchSymbolDetailsFromServer(symbolId)
          }
          if (symResult?.filePath) {
            // Navigate to that file — the files route picks up ?path= and opens the editor
            // Use relative path from workspace root (what /api/files uses)
            const targetPath = symResult.filePath
            window.parent.postMessage({ type: '__sylang_navigate', path: targetPath, symbolId }, '*')
          }
          break
        }

        case 'openFile': {
          const { path: openPath } = msg as { path: string }
          if (openPath) window.parent.postMessage({ type: '__sylang_navigate', path: openPath }, '*')
          break
        }

        case 'getDiagram': {
          // The iframe sends { type: 'getDiagram', fileExtension }
          // and expects back { type: 'diagramData', data, diagramType }
          const extToType: Record<string, string> = {
            '.fml': 'feature-model',
            '.vml': 'variant-model',
            '.blk': 'internal-block-diagram',
            '.fun': 'functional-decomposition',
            '.ucd': 'use-case-diagram',
            '.seq': 'sequence-diagram',
            '.flr': 'fmea-diagram',
            '.smd': 'state-machine-diagram',
            '.fta': 'fault-tree-analysis',
          }
          const msgExt = (msg as { fileExtension?: string }).fileExtension ?? fileExtension
          const resolvedDiagramType = extToType[msgExt]
          if (!resolvedDiagramType) {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'diagramData', error: `No diagram type for extension ${msgExt}` },
              '*',
            )
            break
          }
          try {
            const res = await fetch('/api/sylang/diagram', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ filePath, diagramType: resolvedDiagramType }),
            })
            const data = await res.json() as { ok: boolean; data?: unknown; error?: string }
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'diagramData', diagramType: resolvedDiagramType, data: data.data, error: data.error },
              '*',
            )
          } catch (e) {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'diagramData', error: String(e) },
              '*',
            )
          }
          break
        }

        case 'getVariantMatrix': {
          // VariantMatrixView sends { type: 'getVariantMatrix' } (no args)
          // Expects back { type: 'variantMatrixData', data: VariantMatrixData }
          try {
            const res = await fetch(`/api/sylang/variant-matrix?path=${encodeURIComponent(filePath)}`)
            const data = await res.json() as { ok: boolean; matrix?: unknown; error?: string }
            if (data.ok) {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'variantMatrixData', data: data.matrix },
                '*',
              )
            } else {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'variantMatrixError', error: data.error ?? 'Failed to load variant matrix' },
                '*',
              )
            }
          } catch (e) {
            iframeRef.current?.contentWindow?.postMessage(
              { type: 'variantMatrixError', error: String(e) },
              '*',
            )
          }
          break
        }

        case 'toggleFeature': {
          // { type: 'toggleFeature', variantPath, featureId, selected, autoRegenerateVcf }
          const { variantPath, featureId, selected } = msg as {
            variantPath: string
            featureId: string
            selected: boolean
          }
          try {
            const res = await fetch('/api/sylang/variant-matrix', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'toggleFeature', variantPath, featureId, selected }),
            })
            const data = await res.json() as { ok: boolean; variantName?: string; error?: string }
            if (data.ok) {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'featureToggled', variantName: data.variantName, featureId, selected },
                '*',
              )
            }
          } catch (e) {
            console.error('[toggleFeature]', e)
          }
          break
        }

        case 'createVariant': {
          // { type: 'createVariant', variantId, variantName, description, owner }
          const { variantId, variantName: vName, description, owner } = msg as {
            variantId: string
            variantName: string
            description: string
            owner: string
          }
          try {
            const res = await fetch('/api/sylang/variant-matrix', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'createVariant', fmlPath: filePath, variantId, variantName: vName, description, owner }),
            })
            const data = await res.json() as { ok: boolean; name?: string; path?: string; error?: string }
            if (data.ok) {
              iframeRef.current?.contentWindow?.postMessage(
                { type: 'variantCreated', name: data.name, path: data.path, success: true },
                '*',
              )
            }
          } catch (e) {
            console.error('[createVariant]', e)
          }
          break
        }

        case 'selectVariantForVcf': {
          // { type: 'selectVariantForVcf', vmlPath, variantName }
          const { vmlPath, variantName: svName } = msg as {
            vmlPath: string
            variantName: string
          }
          try {
            const res = await fetch('/api/sylang/variant-matrix', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'selectVariantForVcf', vmlPath, variantName: svName }),
            })
            const data = await res.json() as { ok: boolean; error?: string }
            if (!data.ok) console.error('[selectVariantForVcf]', data.error)
          } catch (e) {
            console.error('[selectVariantForVcf]', e)
          }
          break
        }

        case 'openExternal':
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [filePath, fileExtension])

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b shrink-0 text-xs"
        style={{
          background: 'var(--theme-sidebar)',
          borderColor: 'var(--theme-border)',
          color: 'var(--theme-muted)',
        }}
      >
        <span className="font-mono font-medium" style={{ color: 'var(--theme-text)' }}>
          {fileName}
        </span>
        <span>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && '✓ Saved'}
          {saveStatus === 'unsaved' && '● Unsaved'}
        </span>
      </div>

      {loading && (
        <div className="flex items-center justify-center flex-1 gap-3" style={{ color: 'var(--theme-muted)' }}>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          <span className="text-sm">Parsing {fileName}…</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-sm px-4 py-3 rounded-xl" style={{ background: '#3f0f0f', color: '#f87171' }}>
            {error}
          </div>
        </div>
      )}

      {/* Always render the iframe so it starts loading immediately;
          hide it while we're still parsing so it doesn't flash */}
      <iframe
        ref={iframeRef}
        src="/sylang-editor/main.html"
        className="flex-1 min-h-0 w-full border-0"
        style={{ display: loading || error ? 'none' : 'block' }}
        title={`Sylang editor — ${fileName}`}
        sandbox="allow-scripts allow-same-origin"
        onLoad={() => {
          // iframe DOM ready — send probe; iframe will respond with 'ready'
          iframeRef.current?.contentWindow?.postMessage({ type: 'probe' }, '*')
        }}
      />
    </div>
  )
}

// ─── Completion resolver (browser-side) ───────────────────────────────────────

async function resolveCompletions(
  filePath: string,
  fileExtension: string,
  // Matches CellPickerContext from cellPickerExtension.ts exactly
  context: {
    kind: string
    defKeyword?: string
    setType?: string
    relationKeyword?: string
    nodeType?: string
    propName?: string
    rowIndex?: number
    colIndex?: number
  },
  query: string,
): Promise<string[]> {
  const sm = getWebSymbolManager()
  const ext = fileExtension.toLowerCase().startsWith('.')
    ? fileExtension.toLowerCase()
    : `.${fileExtension.toLowerCase()}`

  let items: string[] = []

  switch (context.kind) {
    // Which set type keywords can follow `use`?
    // ALL header keywords are valid in any file — same as VSCode getAvailableSetTypes()
    case 'useSetType': {
      items = getAvailableSetTypes()
      break
    }

    // Which header IDs exist for the chosen set kind? Scan workspace via API.
    case 'useSetId': {
      const setKind = context.setType ?? ''
      try {
        const res = await fetch(`/api/sylang/headers?kind=${encodeURIComponent(setKind)}`)
        if (res.ok) {
          const data = await res.json() as { ok: boolean; headers?: string[] }
          items = data.headers ?? []
        }
      } catch {
        items = sm.getAvailableSetIds(filePath, setKind)
      }
      break
    }

    // Which relation keywords are valid for this block type?
    // context.defKeyword = the block's node type, e.g. 'requirement'
    case 'relationKeyword': {
      items = getAllowedRelations(context.defKeyword ?? '')
      break
    }

    // Which target node types are valid for (defKeyword + relationKeyword)?
    case 'relationNodeType': {
      items = getAllowedTargetNodeTypes(context.defKeyword ?? '', context.relationKeyword ?? '')
      break
    }

    // Which IDs can be the relation target?
    // context.nodeType = col 1 content, e.g. 'requirement' or 'function'
    case 'relationTargetId': {
      const targetNodeType = context.nodeType ?? ''
      const requiredSetKind = getRequiredSetTypeForTargetNodeType(targetNodeType)
      if (requiredSetKind && targetNodeType) {
        try {
          const res = await fetch(
            `/api/sylang/symbols?nodeType=${encodeURIComponent(targetNodeType)}&headerKind=${encodeURIComponent(requiredSetKind)}`
          )
          if (res.ok) {
            const data = await res.json() as { ok: boolean; ids?: string[] }
            items = data.ids ?? []
          }
        } catch {
          // fall back to already-loaded docs
          items = sm.getAllTargetIds(filePath, targetNodeType)
        }
      }
      break
    }

    // Enum values for a property cell
    // context.propName = property name, e.g. 'safetylevel', 'status'
    case 'propertyValue': {
      items = getEnumValues(context.propName ?? '')
      break
    }
  }

  // Filter by query (case-insensitive prefix/substring)
  if (query) {
    const q = query.toLowerCase()
    items = items.filter((item) => item.toLowerCase().includes(q))
  }

  return items
}

// ─── Server-side symbol detail fallback ──────────────────────────────────────
// Used when the symbol is not in the in-memory WebSymbolManager (e.g. it lives
// in a file that hasn't been opened yet in this session).

async function fetchSymbolDetailsFromServer(
  symbolId: string,
): Promise<{ symbol: SylangSymbol; fileName: string; filePath: string } | null> {
  try {
    const res = await fetch(`/api/sylang/symbol-details?id=${encodeURIComponent(symbolId)}`)
    if (!res.ok) return null
    const data = await res.json() as {
      ok: boolean
      symbol?: {
        name: string; kind: string; type: 'header' | 'definition'
        properties: Record<string, string>; fileName: string; filePath: string; line: number
      }
    }
    if (!data.ok || !data.symbol) return null
    const s = data.symbol
    // Reconstruct a minimal SylangSymbol compatible object
    const sym: SylangSymbol = {
      name: s.name, kind: s.kind, type: s.type,
      fileUri: s.filePath, line: s.line, column: 0,
      children: [], indentLevel: 0,
      properties: new Map(Object.entries(s.properties).map(([k, v]) => [k, [v]])),
    }
    return { symbol: sym, fileName: s.fileName, filePath: s.filePath }
  } catch {
    return null
  }
}
