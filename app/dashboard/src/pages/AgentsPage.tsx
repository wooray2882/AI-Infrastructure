import { useState, useEffect } from 'react'
import { Bot, X, Plus, Trash2, Zap, ZapOff, ChevronRight } from 'lucide-react'
import { useAgents } from '../layouts/AppLayout'
import StatusBadge from '../components/StatusBadge'
import type { AgentRecord } from '../hooks/useAgentStream'

const API = import.meta.env.VITE_API_URL ?? ''

// Available skills that can be attached to any agent
const AVAILABLE_SKILLS = [
  { id: 'email', label: 'Email', description: 'Send emails via Amazon SES' },
]

const TOOL_DESCRIPTIONS: Record<string, string> = {
  ses:           'Send emails via Amazon SES',
  bedrock:       'Call AI models via Amazon Bedrock',
  bedrock_agent: 'Run Bedrock Inline Agents with dynamic skills',
  dynamodb:      'Read/write DynamoDB tables',
  s3:            'Access S3 object storage',
  lambda_invoke: 'Invoke other Lambda agents',
  registry_read: 'Read the agent registry',
  secrets:       'Fetch secrets from Secrets Manager',
  rds:           'Run SQL queries via RDS Data API',
}

const DEPARTMENTS = ['client-relations', 'sales', 'tech', 'comms', 'core', 'ops']
const ROLES       = ['specialist', 'manager', 'orchestrator', 'analyst', 'comms', 'database']

const AVAILABLE_MODELS = [
  { id: 'amazon.nova-micro-v1:0',  label: 'Nova Micro',  description: 'Fastest · lowest cost · best for simple tasks' },
  { id: 'amazon.nova-lite-v1:0',   label: 'Nova Lite',   description: 'Balanced speed and capability' },
  { id: 'amazon.nova-pro-v1:0',    label: 'Nova Pro',    description: 'Most capable · best for planning and reasoning' },
]
const DEFAULT_MODEL = 'amazon.nova-micro-v1:0'

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

// ---------------------------------------------------------------------------
// New Agent form — slide-in panel from the right
// ---------------------------------------------------------------------------
interface NewAgentFormProps {
  onClose: () => void
  onCreate: () => void
}

function NewAgentForm({ onClose, onCreate }: NewAgentFormProps) {
  const [name, setName]               = useState('')
  const [department, setDepartment]   = useState('client-relations')
  const [role, setRole]               = useState('specialist')
  const [modelId, setModelId]         = useState(DEFAULT_MODEL)
  const [systemPrompt, setSystemPrompt] = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  async function handleCreate() {
    if (!name.trim()) { setError('Agent name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${API}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), department, role, model_id: modelId, system_prompt: systemPrompt }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Failed to create agent.')
        return
      }
      onCreate()
      onClose()
    } catch {
      setError('Network error — could not reach the API.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      width: 420,
      flexShrink: 0,
      backgroundColor: 'var(--bg-surface)',
      border: 'var(--border-width-default) solid var(--border-base)',
      borderRadius: 'var(--radius-medium)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: 'var(--border-width-default) solid var(--border-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-medium)',
            backgroundColor: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Plus size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-family-display)', fontWeight: 600, fontSize: 15 }}>
              New Agent
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Configure and deploy</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
          <X size={18} />
        </button>
      </div>

      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <FormField label="Name" required>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Sales Outreach Agent"
            style={inputStyle}
          />
        </FormField>

        <FormField label="Department">
          <select value={department} onChange={e => setDepartment(e.target.value)} style={inputStyle}>
            {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </FormField>

        <FormField label="Role">
          <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </FormField>

        <FormField label="Model" hint={AVAILABLE_MODELS.find(m => m.id === modelId)?.description ?? ''}>
          <select value={modelId} onChange={e => setModelId(e.target.value)} style={inputStyle}>
            {AVAILABLE_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="System Prompt" hint="Instructions that define this agent's personality and behavior.">
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="You are a specialist agent for Corelink. Your job is to..."
            rows={5}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
          />
        </FormField>

        {error && (
          <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 'var(--radius-small)', backgroundColor: '#ef444420', color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '16px 20px',
        borderTop: 'var(--border-width-default) solid var(--border-base)',
        display: 'flex', gap: 10,
      }}>
        <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={handleCreate} disabled={saving} style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Creating…' : 'Create Agent'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agent detail panel
// ---------------------------------------------------------------------------
interface AgentDetailProps {
  agent: AgentRecord
  onClose: () => void
  onDeleted: () => void
}

function AgentDetail({ agent, onClose, onDeleted }: AgentDetailProps) {
  const [skills, setSkills]       = useState<string[]>([])
  const [loadingSkill, setLoadingSkill] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const tools = (agent.tools ?? '').split(' ').filter(Boolean)

  useEffect(() => {
    fetch(`${API}/agents/${agent.agent_id}/skills`)
      .then(r => r.json())
      .then(setSkills)
      .catch(() => {})
  }, [agent.agent_id])

  async function toggleSkill(skillId: string) {
    const attached = skills.includes(skillId)
    setLoadingSkill(skillId)
    try {
      await fetch(`${API}/agents/${agent.agent_id}/skills/${skillId}`, {
        method: attached ? 'DELETE' : 'PUT',
      })
      setSkills(prev => attached ? prev.filter(s => s !== skillId) : [...prev, skillId])
    } catch { /* ignore */ }
    finally { setLoadingSkill(null) }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`${API}/agents/${agent.agent_id}`, { method: 'DELETE' })
      onDeleted()
    } catch { /* ignore */ }
    finally { setDeleting(false) }
  }

  return (
    <div style={{
      width: 380,
      flexShrink: 0,
      backgroundColor: 'var(--bg-surface)',
      border: 'var(--border-width-default) solid var(--border-base)',
      borderRadius: 'var(--radius-medium)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: 'var(--border-width-default) solid var(--border-base)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40,
            borderRadius: 'var(--radius-medium)',
            backgroundColor: 'var(--bg-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={20} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-family-display)', fontWeight: 600, fontSize: 15 }}>
              {agent.agent_name}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              {agent.agent_id}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

        {/* Status */}
        <Section label="Status">
          <StatusBadge status={agent.status} />
          {agent.last_action && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>{agent.last_action}</div>
          )}
        </Section>

        {/* Heartbeat */}
        <Section label="Last Heartbeat">
          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>{timeAgo(agent.last_heartbeat)}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {new Date(agent.last_heartbeat).toLocaleString()}
          </div>
        </Section>

        {/* Identity */}
        <Section label="Identity">
          <Row label="Department" value={agent.department} />
          <Row label="Role"       value={agent.role} />
          {agent.model_id && (
            <Row
              label="Model"
              value={AVAILABLE_MODELS.find(m => m.id === agent.model_id)?.label ?? agent.model_id}
            />
          )}
        </Section>

        {/* Tools */}
        {tools.length > 0 && (
          <Section label="Declared Tools">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tools.map(t => (
                <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-small)',
                    backgroundColor: 'var(--bg-muted)',
                    color: 'var(--color-primary)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}>{t}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', paddingTop: 2 }}>
                    {TOOL_DESCRIPTIONS[t] ?? t}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Skills */}
        <Section label="Skills">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AVAILABLE_SKILLS.map(skill => {
              const active  = skills.includes(skill.id)
              const loading = loadingSkill === skill.id
              return (
                <div key={skill.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-small)',
                  border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-base)'}`,
                  backgroundColor: active ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {active
                      ? <Zap size={14} color="var(--color-primary)" />
                      : <ZapOff size={14} color="var(--text-muted)" />
                    }
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                        {skill.label}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{skill.description}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSkill(skill.id)}
                    disabled={loading}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: '4px 12px',
                      borderRadius: 'var(--radius-small)',
                      border: `1px solid ${active ? 'var(--color-primary)' : 'var(--border-base)'}`,
                      backgroundColor: active ? 'var(--color-primary)' : 'transparent',
                      color: active ? '#fff' : 'var(--text-muted)',
                      cursor: loading ? 'default' : 'pointer',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    {loading ? '…' : active ? 'Detach' : 'Attach'}
                  </button>
                </div>
              )
            })}
          </div>
        </Section>

        {/* Delete */}
        <Section label="Danger Zone">
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: '#ef4444', fontWeight: 500,
              background: 'none', border: '1px solid #ef444440',
              borderRadius: 'var(--radius-small)', padding: '8px 14px',
              cursor: 'pointer', width: '100%', justifyContent: 'center',
            }}>
              <Trash2 size={14} />
              Delete Agent
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                This will permanently delete the agent and all its skill assignments.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ ...secondaryBtnStyle, flex: 1 }}>
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 'var(--radius-small)',
                    backgroundColor: '#ef4444', color: '#fff', border: 'none',
                    fontSize: 13, fontWeight: 600, cursor: deleting ? 'default' : 'pointer',
                    opacity: deleting ? 0.6 : 1,
                  }}
                >
                  {deleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------
function AgentCard({ agent, selected, onClick }: { agent: AgentRecord; selected: boolean; onClick: () => void }) {
  const tools = (agent.tools ?? '').split(' ').filter(Boolean)
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        width: '100%', textAlign: 'left',
        padding: '14px 20px',
        backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 6%, var(--bg-surface))' : 'var(--bg-surface)',
        border: `var(--border-width-default) solid ${selected ? 'var(--color-primary)' : 'var(--border-base)'}`,
        borderRadius: 'var(--radius-medium)',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
      }}
    >
      <div style={{
        width: 40, height: 40, flexShrink: 0,
        borderRadius: 'var(--radius-medium)',
        backgroundColor: 'var(--bg-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Bot size={20} color="var(--color-primary)" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-family-display)' }}>
            {agent.agent_name}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {agent.agent_id} · {agent.department} · {timeAgo(agent.last_heartbeat)} · {tools.length} tool{tools.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <StatusBadge status={agent.status} />
        <ChevronRight size={16} color="var(--text-muted)" style={{ opacity: selected ? 1 : 0.4 }} />
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

function FormField({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '9px 12px',
  borderRadius: 'var(--radius-small)',
  border: 'var(--border-width-default) solid var(--border-base)',
  backgroundColor: 'var(--bg-base)',
  color: 'var(--text-primary)',
  fontSize: 13,
  fontFamily: 'var(--font-family-body)',
  outline: 'none',
}

const primaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '9px 0',
  borderRadius: 'var(--radius-small)',
  backgroundColor: 'var(--color-primary)', color: '#fff',
  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '9px 0',
  borderRadius: 'var(--radius-small)',
  backgroundColor: 'transparent',
  border: 'var(--border-width-default) solid var(--border-base)',
  color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AgentsPage() {
  const { agents } = useAgents()
  const list = Object.values(agents).sort((a, b) => a.agent_name.localeCompare(b.agent_name))

  const [selected, setSelected]   = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [_refresh, setRefresh]    = useState(0) // bump to re-fetch

  const selectedAgent = selected ? agents[selected] : null

  function handleSelect(id: string) {
    if (showForm) setShowForm(false)
    setSelected(prev => prev === id ? null : id)
  }

  function handleNewAgent() {
    setSelected(null)
    setShowForm(true)
  }

  function handleDeleted() {
    setSelected(null)
    setRefresh(n => n + 1)
  }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-family-display)', fontSize: 22, fontWeight: 700, margin: 0 }}>
            Agents
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {list.length} registered agent{list.length !== 1 ? 's' : ''} — click any agent to inspect or manage
          </p>
        </div>
        <button
          onClick={handleNewAgent}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px',
            borderRadius: 'var(--radius-small)',
            backgroundColor: 'var(--color-primary)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          New Agent
        </button>
      </div>

      {/* Main layout — list + detail panel */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        {/* Agent list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          {list.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', gap: 12,
            }}>
              <Bot size={40} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 14 }}>No agents yet — create one to get started.</div>
              <button onClick={handleNewAgent} style={{ ...primaryBtnStyle, flex: 'unset', padding: '9px 20px' }}>
                <Plus size={14} style={{ marginRight: 6 }} />
                New Agent
              </button>
            </div>
          ) : (
            list.map(agent => (
              <AgentCard
                key={agent.agent_id}
                agent={agent}
                selected={selected === agent.agent_id}
                onClick={() => handleSelect(agent.agent_id)}
              />
            ))
          )}
        </div>

        {/* Right panel — detail or new-agent form */}
        {showForm && (
          <NewAgentForm
            onClose={() => setShowForm(false)}
            onCreate={() => setRefresh(n => n + 1)}
          />
        )}
        {!showForm && selectedAgent && (
          <AgentDetail
            agent={selectedAgent}
            onClose={() => setSelected(null)}
            onDeleted={handleDeleted}
          />
        )}
      </div>
    </div>
  )
}
