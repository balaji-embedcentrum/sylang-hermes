'use client'

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu'

type Props = {
  workspacePath: string
}

export function NestMenuBar({ workspacePath }: Props) {
  const navigate = useNavigate()
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [processOpen, setProcessOpen] = useState(false)

  // Extract workspace key (first 3 segments: userId/owner/repo)
  const workspace = workspacePath.split('/').filter(Boolean).slice(0, 3).join('/')

  const goTo = (path: string) => {
    navigate({ to: path, search: { workspace, returnPath: workspace } })
  }

  return (
    <div className="flex items-center gap-0.5">
      {/* Analysis menu */}
      <MenuRoot open={analysisOpen} onOpenChange={setAnalysisOpen}>
        <MenuTrigger
          type="button"
          className="px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-white/10"
          style={{ color: 'var(--theme-muted)' }}
        >
          Analysis ▾
        </MenuTrigger>
        <MenuContent side="bottom" align="start">
          <MenuItem onClick={() => goTo('/analysis/coverage')}>
            Coverage Report
          </MenuItem>
          <MenuItem onClick={() => goTo('/analysis/traceability')}>
            Traceability Graph
          </MenuItem>
          <MenuItem onClick={() => goTo('/analysis/fmea')}>
            FMEA AIAG/VDA
          </MenuItem>
        </MenuContent>
      </MenuRoot>

      {/* Process menu */}
      <MenuRoot open={processOpen} onOpenChange={setProcessOpen}>
        <MenuTrigger
          type="button"
          className="px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-white/10"
          style={{ color: 'var(--theme-muted)' }}
        >
          Process ▾
        </MenuTrigger>
        <MenuContent side="bottom" align="start">
          <MenuItem onClick={() => goTo('/analysis/iso26262')}>
            ISO 26262
          </MenuItem>
          <MenuItem onClick={() => goTo('/analysis/aspice')}>
            ASPICE Workbench
          </MenuItem>
        </MenuContent>
      </MenuRoot>
    </div>
  )
}
