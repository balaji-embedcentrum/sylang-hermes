/**
 * GET /api/sylang/disabled-blocks?path=<filePath>
 *
 * Computes which definition blocks should be grayed out based on VCF config values.
 * This is the server-side equivalent of tiptapCustomEditorProvider.getDisabledBlockIds()
 * — the core of ISO 26262 Product Line Engineering (150% → 100% derivation).
 *
 * A block is disabled when it has `when ref config <configName>` and that config's
 * value is 0 (feature not selected in the active variant).
 */
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { isAuthenticated } from '../../../server/auth-middleware'
import { getWorkspaceManager } from '../../../sylang/symbolManager/workspaceSymbolCache'
import type { SylangSymbol, DocumentSymbols } from '@sylang-core/symbolManagerCore'

/**
 * Resolve the value of a named config by searching all parsed symbols.
 * Config symbols have `kind === 'config'` and `configValue` set during parsing.
 */
function resolveConfigValue(allSymbols: SylangSymbol[], configName: string): number | undefined {
  for (const sym of allSymbols) {
    if (sym.kind === 'config' && sym.name === configName) {
      return sym.configValue
    }
  }
  return undefined
}

/**
 * Check if a symbol uses a config whose value is 0.
 * Looks for the `when` property containing `ref config <configName>`.
 */
function symbolUsesDisabledConfig(symbol: SylangSymbol, allSymbols: SylangSymbol[]): boolean {
  if (!symbol.properties) return false

  for (const [propertyName, propertyValues] of symbol.properties.entries()) {
    if (propertyName !== 'when') continue

    let configName: string | undefined

    if (propertyValues.length >= 3 && propertyValues[0] === 'ref' && propertyValues[1] === 'config') {
      // Format: ["ref", "config", "c_ConfigName"]
      configName = propertyValues[2]
    } else if (propertyValues.length === 1 && propertyValues[0].startsWith('ref config ')) {
      // Format: ["ref config c_ConfigName"]
      const parts = propertyValues[0].split(' ')
      if (parts.length >= 3 && parts[0] === 'ref' && parts[1] === 'config') {
        configName = parts[2]
      }
    }

    if (configName) {
      const value = resolveConfigValue(allSymbols, configName)
      if (value === 0) return true
    }
  }

  return false
}

/**
 * Compute the list of block IDs that should be grayed out for a given file.
 */
function getDisabledBlockIds(docSymbols: DocumentSymbols, allSymbols: SylangSymbol[]): string[] {
  const disabled: string[] = []

  // If header uses a disabled config, ALL blocks are disabled
  if (docSymbols.headerSymbol && symbolUsesDisabledConfig(docSymbols.headerSymbol, allSymbols)) {
    disabled.push(docSymbols.headerSymbol.name)
    for (const sym of docSymbols.definitionSymbols) {
      disabled.push(sym.name)
    }
    return disabled
  }

  // Check individual definition symbols
  for (const sym of docSymbols.definitionSymbols) {
    if (symbolUsesDisabledConfig(sym, allSymbols)) {
      disabled.push(sym.name)
    }
  }

  return disabled
}

export const Route = createFileRoute('/api/sylang/disabled-blocks')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(request.url)
        const filePath = url.searchParams.get('path') ?? ''
        if (!filePath) {
          return json({ ok: false, error: 'path param required' }, { status: 400 })
        }

        const manager = await getWorkspaceManager(filePath)
        if (!manager) {
          return json({ ok: false, disabledBlockIds: [] })
        }

        const docSymbols = manager.allDocuments.get(filePath)
        if (!docSymbols) {
          return json({ ok: true, disabledBlockIds: [] })
        }

        const allSymbols = manager.getAllSymbols()
        const disabledBlockIds = getDisabledBlockIds(docSymbols, allSymbols)

        return json({ ok: true, disabledBlockIds })
      },
    },
  },
})
