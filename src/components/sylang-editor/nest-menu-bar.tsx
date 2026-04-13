'use client'

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu'

type Props = {
  workspacePath: string
  onViewChange?: (view: string | null) => void
}

type GitStatus = {
  changed?: Array<{ path: string; status: string }>
  ahead?: number
  behind?: number
} | null

export function NestMenuBar({ workspacePath, onViewChange }: Props) {
  const navigate = useNavigate()
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [processOpen, setProcessOpen] = useState(false)
  const [gitOpen, setGitOpen] = useState(false)
  const [gitStatus, setGitStatus] = useState<GitStatus>(null)
  const [gitLoading, setGitLoading] = useState(false)
  const [commitMsg, setCommitMsg] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const workspace = workspacePath.split('/').filter(Boolean).slice(0, 3).join('/')

  // Map route paths to inline view keys
  const VIEW_MAP: Record<string, string> = {
    '/analysis/coverage': 'coverage',
    '/analysis/traceability': 'traceability',
    '/analysis/git-history': 'git-history',
    '/analysis/fmea': 'fmea',
    '/analysis/iso26262': 'iso26262',
    '/analysis/aspice': 'aspice',
  }

  const goTo = (path: string) => {
    const viewKey = VIEW_MAP[path]
    if (onViewChange && viewKey) {
      onViewChange(viewKey)
    } else {
      navigate({ to: path, search: { workspace, returnPath: workspace } })
    }
  }

  // Fetch git status when menu opens
  const fetchStatus = useCallback(async () => {
    setGitLoading(true)
    try {
      const r = await fetch(`/api/sylang/git/status?workspace=${encodeURIComponent(workspace)}`)
      const d = await r.json()
      if (d.status === 'ok') setGitStatus(d)
      else setGitStatus(null)
    } catch { setGitStatus(null) }
    setGitLoading(false)
  }, [workspace])

  useEffect(() => {
    if (gitOpen) { fetchStatus(); setActionResult(null) }
  }, [gitOpen, fetchStatus])

  // Clear action result after 3s
  useEffect(() => {
    if (!actionResult) return
    const t = setTimeout(() => setActionResult(null), 3000)
    return () => clearTimeout(t)
  }, [actionResult])

  const handleCommit = async () => {
    if (!commitMsg.trim()) return
    setActionLoading('commit')
    try {
      const r = await fetch('/api/sylang/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace, message: commitMsg.trim() }),
      })
      const d = await r.json()
      if (d.status === 'ok') {
        setActionResult({ type: 'success', msg: `Committed: ${d.sha?.slice(0, 7) ?? ''}` })
        setCommitMsg('')
        fetchStatus()
      } else {
        setActionResult({ type: 'error', msg: d.message ?? 'Commit failed' })
      }
    } catch (e) {
      setActionResult({ type: 'error', msg: String(e) })
    }
    setActionLoading(null)
  }

  const handlePush = async () => {
    setActionLoading('push')
    try {
      const r = await fetch('/api/sylang/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace }),
      })
      const d = await r.json()
      setActionResult(d.status === 'ok'
        ? { type: 'success', msg: 'Pushed to origin' }
        : { type: 'error', msg: d.message ?? 'Push failed' })
      fetchStatus()
    } catch (e) { setActionResult({ type: 'error', msg: String(e) }) }
    setActionLoading(null)
  }

  const handlePull = async () => {
    setActionLoading('pull')
    try {
      const r = await fetch('/api/sylang/git/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace }),
      })
      const d = await r.json()
      setActionResult(d.status === 'ok'
        ? { type: 'success', msg: 'Pulled latest' }
        : { type: 'error', msg: d.message ?? 'Pull failed' })
      fetchStatus()
    } catch (e) { setActionResult({ type: 'error', msg: String(e) }) }
    setActionLoading(null)
  }

  const changedCount = gitStatus?.changed?.length ?? 0
  const ahead = gitStatus?.ahead ?? 0
  const behind = gitStatus?.behind ?? 0

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
          <MenuItem onClick={() => goTo('/analysis/coverage')}>Coverage Report</MenuItem>
          <MenuItem onClick={() => goTo('/analysis/traceability')}>Traceability Graph</MenuItem>
          <MenuItem onClick={() => goTo('/analysis/fmea')}>FMEA AIAG/VDA</MenuItem>
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
          <MenuItem onClick={() => goTo('/analysis/iso26262')}>ISO 26262</MenuItem>
          <MenuItem onClick={() => goTo('/analysis/aspice')}>ASPICE Workbench</MenuItem>
        </MenuContent>
      </MenuRoot>

      {/* Git menu */}
      <MenuRoot open={gitOpen} onOpenChange={setGitOpen}>
        <MenuTrigger
          type="button"
          className="px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-white/10"
          style={{ color: 'var(--theme-muted)' }}
        >
          Git ▾
        </MenuTrigger>
        <MenuContent side="bottom" align="start">
          {/* Status display */}
          <div className="px-2 py-2 text-xs" style={{ color: 'var(--theme-muted)', borderBottom: '1px solid var(--theme-border)', minWidth: 280, maxHeight: 300, overflowY: 'auto' }}>
            {gitLoading ? (
              <span>Loading status...</span>
            ) : gitStatus ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span style={{ color: changedCount > 0 ? '#f59e0b' : '#10b981' }}>
                    {changedCount === 0 ? 'Working tree clean' : `${changedCount} file${changedCount > 1 ? 's' : ''} changed`}
                  </span>
                  {(ahead > 0 || behind > 0) && (
                    <span>
                      {ahead > 0 && <span style={{ color: '#10b981' }}>↑{ahead}</span>}
                      {ahead > 0 && behind > 0 && ' '}
                      {behind > 0 && <span style={{ color: '#f59e0b' }}>↓{behind}</span>}
                    </span>
                  )}
                </div>
                {/* Changed file list */}
                {changedCount > 0 && gitStatus.changed && (
                  <div className="mt-1.5 flex flex-col gap-0.5">
                    {gitStatus.changed.map((f, i) => {
                      const st = f.status?.trim()
                      const icon = st === 'A' || st === '??' ? '➕' : st === 'D' ? '❌' : st === 'R' ? '↪️' : '📝'
                      const color = st === 'A' || st === '??' ? '#10b981' : st === 'D' ? '#ef4444' : st === 'R' ? '#06b6d4' : '#f59e0b'
                      return (
                        <div key={i} className="flex items-center gap-1.5 font-mono" style={{ fontSize: 11 }}>
                          <span>{icon}</span>
                          <span style={{ color }} className="truncate">{f.path}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <span style={{ color: '#ef4444' }}>Unable to fetch status</span>
            )}
          </div>

          {/* Action result toast */}
          {actionResult && (
            <div className="px-2 py-1.5 text-xs font-medium" style={{
              color: actionResult.type === 'success' ? '#10b981' : '#ef4444',
              borderBottom: '1px solid var(--theme-border)',
            }}>
              {actionResult.type === 'success' ? '✓' : '✕'} {actionResult.msg}
            </div>
          )}

          {/* Commit input — always visible, styled as part of the menu */}
          <div className="p-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
            <div className="text-[11px] font-medium mb-1.5" style={{ color: 'var(--theme-muted)' }}>Commit Message</div>
            <textarea
              placeholder="Describe your changes..."
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommit() } }}
              rows={2}
              className="w-full px-2 py-1.5 rounded text-xs outline-none resize-none mb-2"
              style={{ background: 'var(--theme-bg)', border: '1px solid var(--theme-border)', color: 'var(--theme-text)' }}
            />
            <button
              onClick={handleCommit}
              disabled={actionLoading === 'commit' || !commitMsg.trim()}
              className="w-full px-2 py-1.5 rounded text-xs font-medium"
              style={{ background: 'var(--theme-accent)', color: '#fff', opacity: !commitMsg.trim() ? 0.5 : 1 }}
            >
              {actionLoading === 'commit' ? 'Committing...' : 'Commit All'}
            </button>
          </div>

          {/* Push / Pull actions */}
          <div
            className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium cursor-pointer rounded-md"
            style={{ color: 'var(--theme-text)' }}
            onClick={handlePush}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--theme-card2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {actionLoading === 'push' ? 'Pushing...' : '↑ Push'}
          </div>
          <div
            className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium cursor-pointer rounded-md"
            style={{ color: 'var(--theme-text)' }}
            onClick={handlePull}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--theme-card2)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {actionLoading === 'pull' ? 'Pulling...' : '↓ Pull'}
          </div>

          {/* Separator */}
          <div style={{ height: 1, background: 'var(--theme-border)', margin: '4px 0' }} />

          <MenuItem onClick={() => goTo('/analysis/git-history')}>
            History
          </MenuItem>
        </MenuContent>
      </MenuRoot>
    </div>
  )
}
