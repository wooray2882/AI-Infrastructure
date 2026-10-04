import { useState } from 'react'
import { Bot, X, Cpu, Clock, Tag, Wrench, Activity } from 'lucide-react'
import { useAgents } from '../layouts/AppLayout'
import StatusBadge from '../components/StatusBadge'
import type { AgentRecord } from '../hooks/useAgentStream'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  ses:           'Send emails via Amazon SES',
  bedrock:       'Call AI models via Amazon Bedrock',
  dynamodb:      'Read/write DynamoDB tables',
  s3:            'Access S3 object storage',
  lambda_invoke: 'Invoke other Lambda agents',
  registry_read: 'Read the agent registry',
  secrets:       'Fetch secrets from Secrets Manager',
  rds:           'Run SQL queries via RDS Data API',
}

// ---------------------------------------------------------------------------
// Detail panel — slides in from the right when an agent is selected
// ---------------------------------------------------------------------------
function AgentDetail({ agent, onClose }: { agent: AgentRecord; onClose: () => void }) {
  const tools = (agent.tools ?? '').split(' ').filter(Boolean)

  return (
    <div
      style={{
        width: 360,
        flexShrink: 0,
        backgroundColor: 'var(--bg-surface)',
        border: 'var(--border-width-default) solid var(--border-base)',
        borderRadius: 'var(--radius-medium)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: 'var(--border-width-default) solid var(--border-base)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-medium)',
              backgroundColor: 'var(--color-primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Bot size={20} strokeWidth={1.75} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <p
              style={{
                fontFamily: 'var(--font-family-display)',
                fontWeight: 'var(--font-weight-semibold)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                lineHeight: 1.3,
              }}
            >
              {agent.agent_name}
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              {agent.agent_id}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-tertiary)',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

        {/* Status */}
        <Section icon={Activity} label="Status">
          <StatusBadge status={agent.status} />
        </Section>

        {/* Last action */}
        {agent.last_action && (
          <Section icon={Clock} label="Last action">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {agent.last_action}
            </p>
          </Section>
        )}

        {/* Heartbeat */}
        <Section icon={Clock} label="Last heartbeat">
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {agent.last_heartbeat ? timeAgo(agent.last_heartbeat) : '—'}
          </p>
          {agent.last_heartbeat && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
              {new Date(agent.last_heartbeat).toLocaleString()}
            </p>
          )}
        </Section>

        {/* Identity */}
        <Section icon={Tag} label="Identity">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label="Department" value={agent.department ?? '—'} />
            <Row label="Role"       value={agent.role ?? '—'} />
          </div>
        </Section>

        {/* Tools */}
        <Section icon={Wrench} label="Declared tools">
          {tools.length === 0 ? (
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>None</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tools.map(t => (
                <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--font-weight-medium)',
                      backgroundColor: 'var(--color-primary-light)',
                      color: 'var(--color-primary)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-small)',
                      width: 'fit-content',
                    }}
                  >
                    {t}
                  </span>
                  {TOOL_DESCRIPTIONS[t] && (
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', paddingLeft: 2 }}>
                      {TOOL_DESCRIPTIONS[t]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Runtime info */}
        <Section icon={Cpu} label="Runtime">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Row label="Platform" value="AWS Lambda (Python 3.12)" />
            <Row label="Trigger"  value="EventBridge — rate(5 min)" />
            <Row label="Region"   value="us-east-1" />
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Icon size={13} strokeWidth={2} style={{ color: 'var(--text-tertiary)' }} />
        <p
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--letter-spacing-wider)',
          }}
        >
          {label}
        </p>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agent card in the list
// ---------------------------------------------------------------------------
function AgentCard({ agent, selected, onClick }: { agent: AgentRecord; selected: boolean; onClick: () => void }) {
  const tools = (agent.tools ?? '').split(' ').filter(Boolean)
  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-medium)',
        border: selected
          ? '2px solid var(--color-primary)'
          : 'var(--border-width-default) solid var(--border-base)',
        backgroundColor: selected ? 'var(--color-primary-light)' : 'var(--bg-surface)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 'var(--radius-medium)',
          backgroundColor: 'var(--color-primary-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Bot size={18} strokeWidth={1.75} style={{ color: 'var(--color-primary)' }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <p
            style={{
              fontFamily: 'var(--font-family-display)',
              fontWeight: 'var(--font-weight-medium)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {agent.agent_name}
          </p>
          <StatusBadge status={agent.status} />
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
          {agent.agent_id}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {agent.department ?? '—'}
          </span>
          <span style={{ color: 'var(--border-base)', fontSize: 10 }}>•</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {agent.last_heartbeat ? timeAgo(agent.last_heartbeat) : 'no heartbeat'}
          </span>
          <span style={{ color: 'var(--border-base)', fontSize: 10 }}>•</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            {tools.length} tool{tools.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AgentsPage() {
  const { agents } = useAgents()
  const agentList = Object.values(agents).sort((a, b) =>
    (a.agent_name ?? '').localeCompare(b.agent_name ?? '')
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? agents[selectedId] ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
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
          Agents
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 4 }}>
          {agentList.length} registered agent{agentList.length !== 1 ? 's' : ''} — click any agent to inspect it
        </p>
      </div>

      {agentList.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center"
          style={{ minHeight: 300, gap: 12 }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              backgroundColor: 'var(--bg-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bot size={24} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            No agents reporting yet
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Agent list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {agentList.map(agent => (
              <AgentCard
                key={agent.agent_id}
                agent={agent}
                selected={selectedId === agent.agent_id}
                onClick={() => setSelectedId(
                  selectedId === agent.agent_id ? null : agent.agent_id
                )}
              />
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <AgentDetail
              agent={selected}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}
