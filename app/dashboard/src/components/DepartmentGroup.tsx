import AgentCard from './AgentCard'
import type { AgentRecord } from '../hooks/useAgentStream'

export default function DepartmentGroup({
  department,
  agents,
}: {
  department: string
  agents: AgentRecord[]
}) {
  const online = agents.filter(a => a.status === 'online').length

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        <h2
          style={{
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-weight-bold)',
            letterSpacing: 'var(--letter-spacing-wider)',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-family-display)',
          }}
        >
          {department}
        </h2>
        <span
          style={{
            backgroundColor: 'var(--bg-subtle)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-xs)',
            padding: '2px var(--space-2)',
            borderRadius: 'var(--radius-small)',
            border: 'var(--border-width-default) solid var(--border-subtle)',
          }}
        >
          {online}/{agents.length} online
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map(a => <AgentCard key={a.agent_id} agent={a} />)}
      </div>
    </section>
  )
}
