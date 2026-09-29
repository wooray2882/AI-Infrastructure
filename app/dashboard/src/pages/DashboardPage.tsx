import { useMemo } from 'react'
import { Wifi, WifiOff, Loader2, Bot } from 'lucide-react'
import { useAgentStream } from '../hooks/useAgentStream'
import DepartmentGroup from '../components/DepartmentGroup'

const WS_URL = import.meta.env.VITE_WS_URL as string

function KpiTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="flex flex-col gap-1 px-5 py-3"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: 'var(--border-width-default) solid var(--border-base)',
        borderRadius: 'var(--radius-medium)',
        boxShadow: 'var(--shadow-sm)',
        minWidth: 80,
      }}
    >
      <span
        style={{
          fontSize: 'var(--text-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          fontFamily: 'var(--font-family-display)',
          color,
          lineHeight: 'var(--line-height-tight)',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          fontWeight: 'var(--font-weight-medium)',
          letterSpacing: 'var(--letter-spacing-wide)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
    </div>
  )
}

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
  const totalErrors = Object.values(agents).filter(a => a.status === 'error').length

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
      {/* Top nav bar */}
      <header
        style={{
          backgroundColor: 'var(--color-primary)',
          borderBottom: 'none',
          padding: 'var(--space-4) var(--space-6)',
        }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Bot size={20} strokeWidth={1.75} style={{ color: 'var(--text-inverse)' }} />
          <div>
            <span
              style={{
                color: 'var(--text-inverse)',
                fontSize: 'var(--text-base)',
                fontWeight: 'var(--font-weight-bold)',
                fontFamily: 'var(--font-family-display)',
                letterSpacing: 'var(--letter-spacing-tight)',
              }}
            >
              Corelink
            </span>
            <span
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontSize: 'var(--text-xs)',
                marginLeft: 'var(--space-2)',
              }}
            >
              Agent Operations Center
            </span>
          </div>
        </div>

        {/* Connection state pill */}
        <div
          className="flex items-center gap-2"
          style={{
            backgroundColor: 'rgba(255,255,255,0.12)',
            padding: '4px var(--space-3)',
            borderRadius: 'var(--radius-large)',
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--text-inverse)',
          }}
        >
          {connectionState === 'connected' && (
            <><Wifi size={12} strokeWidth={1.75} style={{ color: '#4ADE80' }} /><span style={{ color: '#4ADE80' }}>Live</span></>
          )}
          {connectionState === 'connecting' && (
            <><Loader2 size={12} strokeWidth={1.75} className="animate-spin" /><span>Connecting</span></>
          )}
          {(connectionState === 'disconnected' || connectionState === 'error') && (
            <><WifiOff size={12} strokeWidth={1.75} style={{ color: '#FCA5A5' }} /><span style={{ color: '#FCA5A5' }}>Reconnecting</span></>
          )}
        </div>
      </header>

      <main className="p-6 space-y-8">
        {/* KPI strip */}
        <div className="flex flex-wrap gap-3">
          <KpiTile label="Online"  value={totalOnline} color="var(--color-success)" />
          <KpiTile label="Total"   value={total}       color="var(--text-primary)" />
          <KpiTile label="Errors"  value={totalErrors} color={totalErrors > 0 ? 'var(--color-error)' : 'var(--text-tertiary)'} />
        </div>

        {/* Empty state */}
        {total === 0 && connectionState === 'connected' && (
          <div
            className="flex flex-col items-center justify-center py-24 gap-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <Bot size={40} strokeWidth={1.25} />
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-secondary)' }}>
              No agents reporting yet
            </p>
            <p style={{ fontSize: 'var(--text-sm)' }}>
              Agents will appear here once they send their first heartbeat.
            </p>
          </div>
        )}

        {/* Department sections */}
        {Object.entries(byDepartment)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([dept, agentList]) => (
            <DepartmentGroup key={dept} department={dept} agents={agentList} />
          ))}
      </main>
    </div>
  )
}
