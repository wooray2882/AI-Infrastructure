import { useMemo } from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useAgentStream } from '../hooks/useAgentStream'
import DepartmentGroup from '../components/DepartmentGroup'

const WS_URL = import.meta.env.VITE_WS_URL as string

export default function DashboardPage() {
  const { agents, connectionState } = useAgentStream(WS_URL)

  const byDepartment = useMemo(() => {
    const map: Record<string, typeof agents[string][]> = {}
    for (const agent of Object.values(agents)) {
      const dept = agent.department ?? 'unknown'
      if (!map[dept]) map[dept] = []
      map[dept].push(agent)
    }
    return map
  }, [agents])

  const totalOnline = Object.values(agents).filter(a => a.status === 'online').length
  const total = Object.values(agents).length

  return (
    <div className="min-h-screen p-6 space-y-8" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Corelink
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Agent Operations Center
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* KPI strip */}
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-400">{totalOnline}</p>
              <p style={{ color: 'var(--text-muted)' }}>Online</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{total}</p>
              <p style={{ color: 'var(--text-muted)' }}>Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-400">
                {Object.values(agents).filter(a => a.status === 'error').length}
              </p>
              <p style={{ color: 'var(--text-muted)' }}>Errors</p>
            </div>
          </div>

          {/* Connection indicator */}
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            {connectionState === 'connected' && <><Wifi size={12} className="text-green-400" /><span className="text-green-400">Live</span></>}
            {connectionState === 'connecting' && <><Loader2 size={12} className="animate-spin text-amber-400" /><span className="text-amber-400">Connecting</span></>}
            {(connectionState === 'disconnected' || connectionState === 'error') && <><WifiOff size={12} className="text-red-400" /><span className="text-red-400">Reconnecting</span></>}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {total === 0 && connectionState === 'connected' && (
        <div className="flex flex-col items-center justify-center py-24 gap-3"
          style={{ color: 'var(--text-muted)' }}>
          <p className="text-lg font-medium">No agents reporting yet</p>
          <p className="text-sm">Agents will appear here once they send their first heartbeat.</p>
        </div>
      )}

      {/* Department sections */}
      {Object.entries(byDepartment)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dept, agentList]) => (
          <DepartmentGroup key={dept} department={dept} agents={agentList} />
        ))}
    </div>
  )
}
