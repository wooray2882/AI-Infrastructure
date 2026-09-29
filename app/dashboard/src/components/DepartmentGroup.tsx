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
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          {department}
        </h2>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
          {online}/{agents.length} online
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map(a => <AgentCard key={a.agent_id} agent={a} />)}
      </div>
    </section>
  )
}
