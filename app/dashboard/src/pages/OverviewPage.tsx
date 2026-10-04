import { useMemo, useState } from 'react'
import { DonutChart, BarChart, Legend } from '@tremor/react'
import { ChevronUp, ChevronDown, ChevronsUpDown, CheckCircle2, AlertCircle, Clock3, MinusCircle } from 'lucide-react'
import { useAgents } from '../layouts/AppLayout'
import StatusBadge from '../components/StatusBadge'
import type { AgentRecord } from '../hooks/useAgentStream'

type SortKey = 'agent_name' | 'department' | 'status' | 'last_heartbeat'
type SortDir = 'asc' | 'desc'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function KpiCard({ label, value, sub, icon: Icon, color }: {
  label: string
  value: number | string
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div
      className="flex items-center gap-4 p-5"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: 'var(--border-width-default) solid var(--border-base)',
        borderRadius: 'var(--radius-medium)',
        boxShadow: 'var(--shadow-sm)',
        flex: '1 1 0',
        minWidth: 160,
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: 40,
          height: 40,
          borderRadius: 'var(--radius-medium)',
          backgroundColor: color + '1a',
          flexShrink: 0,
        }}
      >
        <Icon size={20} strokeWidth={1.75} style={{ color }} />
      </div>
      <div>
        <p
          style={{
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--font-weight-bold)',
            fontFamily: 'var(--font-family-display)',
            color: 'var(--text-primary)',
            lineHeight: 1.1,
          }}
        >
          {value}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
          {label}
        </p>
        {sub && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 1 }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  )
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={13} strokeWidth={1.5} style={{ opacity: 0.3 }} />
  return sortDir === 'asc'
    ? <ChevronUp size={13} strokeWidth={1.75} />
    : <ChevronDown size={13} strokeWidth={1.75} />
}

const TH_STYLE = {
  fontSize: 'var(--text-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase' as const,
  letterSpacing: 'var(--letter-spacing-wider)',
  padding: '10px 16px',
  textAlign: 'left' as const,
  cursor: 'pointer',
  userSelect: 'none' as const,
  whiteSpace: 'nowrap' as const,
  borderBottom: 'var(--border-width-default) solid var(--border-base)',
  backgroundColor: 'var(--bg-subtle)',
}

export default function OverviewPage() {
  const { agents } = useAgents()
  const agentList = Object.values(agents)

  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const online  = agentList.filter(a => a.status === 'online').length
  const idle    = agentList.filter(a => a.status === 'idle').length
  const errors  = agentList.filter(a => a.status === 'error').length
  const offline = agentList.filter(a => a.status === 'offline').length
  const total   = agentList.length
  const uptime  = total > 0 ? Math.round(((online + idle) / total) * 100) : 0

  // Donut chart data — agents by status
  const statusData = [
    { name: 'Online',  value: online  },
    { name: 'Idle',    value: idle    },
    { name: 'Error',   value: errors  },
    { name: 'Offline', value: offline },
  ].filter(d => d.value > 0)

  // Bar chart data — agents per department
  const deptCounts = useMemo(() => {
    const map: Record<string, { online: number; idle: number; error: number }> = {}
    for (const a of agentList) {
      const dept = a.department ?? 'Unknown'
      if (!map[dept]) map[dept] = { online: 0, idle: 0, error: 0 }
      if (a.status === 'online') map[dept].online++
      else if (a.status === 'idle') map[dept].idle++
      else if (a.status === 'error') map[dept].error++
    }
    return Object.entries(map).map(([dept, counts]) => ({ department: dept, ...counts }))
  }, [agentList])

  // Sorted table
  const sorted = useMemo(() => {
    return [...agentList].sort((a, b) => {
      let av: string, bv: string
      if (sortKey === 'last_heartbeat') {
        av = a.last_heartbeat ?? ''
        bv = b.last_heartbeat ?? ''
      } else {
        av = (a[sortKey] ?? '').toLowerCase()
        bv = (b[sortKey] ?? '').toLowerCase()
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [agentList, sortKey, sortDir])

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const STATUS_COLORS: Record<string, string> = {
    Online: '#22c55e',
    Idle: '#f59e0b',
    Error: '#ef4444',
    Offline: '#94a3b8',
  }

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div>
        <h1
          style={{
            fontFamily: 'var(--font-family-display)',
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--text-xl)',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Overview
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
          Real-time status of all Corelink agents
        </p>
      </div>

      {/* KPI row */}
      <div className="flex flex-wrap gap-3">
        <KpiCard label="Total agents"  value={total}          icon={CheckCircle2} color="var(--color-primary)" />
        <KpiCard label="Online"        value={online}         icon={CheckCircle2} color="var(--color-success)" sub={`${uptime}% uptime`} />
        <KpiCard label="Errors"        value={errors}         icon={AlertCircle}  color={errors > 0 ? 'var(--color-error)' : 'var(--text-tertiary)'} />
        <KpiCard label="Idle / standby" value={idle}          icon={Clock3}       color="var(--color-warning)" />
        <KpiCard label="Offline"       value={offline}        icon={MinusCircle}  color="var(--text-tertiary)" />
      </div>

      {/* Charts row */}
      <div className="flex flex-wrap gap-4">
        {/* Donut — status breakdown */}
        <div
          className="flex-1 p-5"
          style={{
            minWidth: 260,
            backgroundColor: 'var(--bg-surface)',
            border: 'var(--border-width-default) solid var(--border-base)',
            borderRadius: 'var(--radius-medium)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <p
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-medium)',
              fontFamily: 'var(--font-family-display)',
              color: 'var(--text-primary)',
              marginBottom: 16,
            }}
          >
            Status breakdown
          </p>
          <DonutChart
            data={statusData}
            category="value"
            index="name"
            colors={['green', 'yellow', 'red', 'slate']}
            showLabel={true}
            className="h-36"
          />
          <Legend
            categories={statusData.map(d => d.name)}
            colors={['green', 'yellow', 'red', 'slate']}
            className="mt-4"
          />
        </div>

        {/* Bar — agents per department */}
        <div
          className="flex-1 p-5"
          style={{
            minWidth: 320,
            backgroundColor: 'var(--bg-surface)',
            border: 'var(--border-width-default) solid var(--border-base)',
            borderRadius: 'var(--radius-medium)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <p
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-medium)',
              fontFamily: 'var(--font-family-display)',
              color: 'var(--text-primary)',
              marginBottom: 16,
            }}
          >
            Agents per department
          </p>
          <BarChart
            data={deptCounts}
            index="department"
            categories={['online', 'idle', 'error']}
            colors={['green', 'yellow', 'red']}
            stack={true}
            className="h-36"
            showLegend={true}
          />
        </div>
      </div>

      {/* Agent table */}
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: 'var(--border-width-default) solid var(--border-base)',
          borderRadius: 'var(--radius-medium)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: 'var(--border-width-default) solid var(--border-base)' }}
        >
          <p
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-medium)',
              fontFamily: 'var(--font-family-display)',
              color: 'var(--text-primary)',
            }}
          >
            All agents
          </p>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            {total} total
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH_STYLE} onClick={() => handleSort('agent_name')}>
                  <span className="flex items-center gap-1">Agent <SortIcon col="agent_name" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th style={TH_STYLE} onClick={() => handleSort('status')}>
                  <span className="flex items-center gap-1">Status <SortIcon col="status" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th style={TH_STYLE} onClick={() => handleSort('department')}>
                  <span className="flex items-center gap-1">Department <SortIcon col="department" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
                <th style={{ ...TH_STYLE, cursor: 'default' }}>Tools</th>
                <th style={TH_STYLE} onClick={() => handleSort('last_heartbeat')}>
                  <span className="flex items-center gap-1">Last heartbeat <SortIcon col="last_heartbeat" sortKey={sortKey} sortDir={sortDir} /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((agent, i) => (
                <AgentRow key={agent.agent_id} agent={agent} even={i % 2 === 0} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AgentRow({ agent, even }: { agent: AgentRecord; even: boolean }) {
  const tools = (agent.tools ?? '').split(' ').filter(Boolean)
  return (
    <tr
      style={{
        backgroundColor: even ? 'transparent' : 'var(--bg-subtle)',
        borderBottom: 'var(--border-width-default) solid var(--border-base)',
      }}
    >
      <td style={{ padding: '12px 16px' }}>
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-primary)', fontFamily: 'var(--font-family-display)' }}>
          {agent.agent_name}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
          {agent.agent_id}
        </p>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <StatusBadge status={agent.status} />
      </td>
      <td style={{ padding: '12px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
        {agent.department ?? '—'}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div className="flex flex-wrap gap-1">
          {tools.slice(0, 3).map(t => (
            <span
              key={t}
              style={{
                fontSize: 'var(--text-xs)',
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-small)',
                fontWeight: 'var(--font-weight-medium)',
              }}
            >
              {t}
            </span>
          ))}
          {tools.length > 3 && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>+{tools.length - 3}</span>
          )}
        </div>
      </td>
      <td style={{ padding: '12px 16px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
        {agent.last_heartbeat ? timeAgo(agent.last_heartbeat) : '—'}
      </td>
    </tr>
  )
}
