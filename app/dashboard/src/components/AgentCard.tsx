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
      className="flex flex-col gap-3 p-4 transition-shadow"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: 'var(--border-width-default) solid var(--border-base)',
        borderRadius: 'var(--radius-medium)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className="font-medium truncate"
            style={{
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-family-display)',
              fontWeight: 'var(--font-weight-medium)',
            }}
          >
            {agent.agent_name}
          </p>
          <p
            className="mt-0.5 truncate"
            style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}
          >
            {agent.agent_id}
          </p>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      {agent.message && (
        <p
          className="italic"
          style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}
        >
          {agent.message}
        </p>
      )}

      {tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tools.map(t => (
            <span
              key={t}
              className="inline-flex items-center gap-1"
              style={{
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--font-weight-medium)',
                padding: '2px var(--space-2)',
                borderRadius: 'var(--radius-small)',
              }}
            >
              <Wrench size={10} strokeWidth={1.75} />
              {t}
            </span>
          ))}
        </div>
      )}

      <div
        className="flex items-center gap-1"
        style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}
      >
        <Clock size={11} strokeWidth={1.75} />
        {agent.last_heartbeat ? timeAgo(agent.last_heartbeat) : 'never'}
      </div>
    </div>
  )
}
