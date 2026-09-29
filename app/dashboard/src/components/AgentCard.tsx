import { Clock, Wrench } from 'lucide-react'
import StatusBadge from './StatusBadge'
import type { AgentRecord } from '../hooks/useAgentStream'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

export default function AgentCard({ agent }: { agent: AgentRecord }) {
  const tools = (agent.tools ?? '').split(' ').filter(Boolean)

  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-3 transition-colors"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
            {agent.agent_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {agent.agent_id}
          </p>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      {agent.message && (
        <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
          {agent.message}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tools.map(t => (
          <span
            key={t}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
          >
            <Wrench size={10} />
            {t}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
        <Clock size={11} />
        {agent.last_heartbeat ? timeAgo(agent.last_heartbeat) : 'never'}
      </div>
    </div>
  )
}
