import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/agents')({
  component: AgentsPage,
})

type Agent = {
  id: string
  persona_name: string
  specialist_type: string
  status: string
  container_name: string
}

const AGENT_SKILLS: Record<string, string[]> = {
  'Harry Potter': ['Coding', 'Development', 'Debugging'],
  'Hermione': ['Research', 'Documentation', 'Intelligence'],
}

const AGENT_MODELS: Record<string, string> = {
  'Harry Potter': 'OpenRouter / DeepSeek R1',
  'Hermione': 'OpenRouter / DeepSeek R1',
}

const AGENT_COLORS: Record<string, string> = {
  'Harry Potter': '#f59e0b',
  'Hermione': '#8b5cf6',
}

function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selecting, setSelecting] = useState(false)

  useEffect(() => {
    fetch('/api/agents/list')
      .then(r => r.json())
      .then(d => setAgents(d.agents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSelect = async (agent: Agent) => {
    setSelecting(true)
    try {
      const res = await fetch('/api/agents/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      })
      const data = await res.json()
      if (data.ok) {
        setSelectedId(agent.id)
      }
    } catch {}
    setSelecting(false)
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--theme-bg)', color: 'var(--theme-text)' }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-2">AI Agents</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--theme-muted)' }}>
          Select an agent to assist you. Each agent has different specializations.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--theme-muted)' }}>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            Loading agents...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map(agent => {
            const color = AGENT_COLORS[agent.persona_name] ?? '#14b8a6'
            const skills = AGENT_SKILLS[agent.persona_name] ?? [agent.specialist_type]
            const model = AGENT_MODELS[agent.persona_name] ?? 'Unknown'
            const isSelected = selectedId === agent.id

            return (
              <button
                key={agent.id}
                onClick={() => handleSelect(agent)}
                disabled={selecting}
                className="text-left rounded-xl p-5 transition-all hover:scale-[1.01]"
                style={{
                  background: 'var(--theme-card)',
                  border: isSelected ? `2px solid ${color}` : '1px solid var(--theme-border)',
                }}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{ background: `${color}20`, color }}
                  >
                    {agent.persona_name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--theme-text)' }}>
                      {agent.persona_name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--theme-muted)' }}>
                      {model}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: agent.status === 'idle' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                        color: agent.status === 'idle' ? '#10b981' : '#f59e0b',
                      }}
                    >
                      {agent.status}
                    </span>
                  </div>
                </div>

                {/* Skills */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {skills.map(skill => (
                    <span
                      key={skill}
                      className="text-[11px] px-2 py-0.5 rounded"
                      style={{ background: `${color}15`, color }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>

                {/* Select indicator */}
                {isSelected && (
                  <div className="text-xs font-medium" style={{ color }}>
                    ✓ Selected — chat will use this agent
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {!loading && agents.length === 0 && (
          <div className="text-center py-16" style={{ color: 'var(--theme-muted)' }}>
            <p className="text-sm">No agents available</p>
            <p className="text-xs mt-2">Configure agents in the Supabase agent_instances table</p>
          </div>
        )}
      </div>
    </div>
  )
}
