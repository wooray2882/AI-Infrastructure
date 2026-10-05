import { useState, useEffect, useCallback } from 'react'
import { Building2, Bot, Plus, X, Users, ChevronRight, Crown, Trash2 } from 'lucide-react'
import { useAgents } from '../layouts/AppLayout'
import StatusBadge from '../components/StatusBadge'
import type { AgentRecord } from '../hooks/useAgentStream'

const API    = import.meta.env.VITE_API_URL ?? ''
const ORG_ID = 'org-corelink-default'

interface Department {
  dept_id: string
  org_id:  string
  name:    string
  created_at: string
}

// ---------------------------------------------------------------------------
// New Department form — slide-in panel
// ---------------------------------------------------------------------------
function NewDeptForm({ onClose, onCreate }: { onClose: () => void; onCreate: () => void }) {
  const [name, setName]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleCreate() {
    if (!name.trim()) { setError('Department name is required.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`${API}/organizations/${ORG_ID}/departments`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Failed to create.'); return }
      onCreate(); onClose()
    } catch { setError('Network error — could not reach the API.') }
    finally  { setSaving(false) }
  }

  return (
    <div style={{
      width: 360, flexShrink: 0,
      backgroundColor: 'var(--bg-surface)',
      border: 'var(--border-width-default) solid var(--border-base)',
      borderRadius: 'var(--radius-medium)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: 'var(--border-width-default) solid var(--border-base)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 'var(--radius-medium)',
            backgroundColor: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Plus size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-family-display)', fontWeight: 600, fontSize: 14 }}>
              New Department
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Add to your organization</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 20 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
          Department Name <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
          placeholder="e.g. Operations, HR, Finance"
          style={inputStyle}
          autoFocus
        />
        {error && (
          <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 'var(--radius-small)', backgroundColor: '#ef444420', color: '#ef4444', fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={handleCreate} disabled={saving} style={{ ...primaryBtnStyle, opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Creating…' : 'Create Department'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Department detail panel — shows agents belonging to this dept
// ---------------------------------------------------------------------------
function DeptDetail({
  dept, allAgents, onClose, onDeleted,
}: {
  dept: Department
  allAgents: Record<string, AgentRecord>
  onClose: () => void
  onDeleted: () => void
}) {
  const [deptAgents, setDeptAgents] = useState<AgentRecord[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    // Filter live agents by dept_id
    const matching = Object.values(allAgents).filter(a => (a as any).dept_id === dept.dept_id)
    setDeptAgents(matching)
  }, [allAgents, dept.dept_id])

  async function handleDelete() {
    setDeleting(true)
    try {
      await fetch(`${API}/departments/${dept.dept_id}`, { method: 'DELETE' })
      onDeleted()
    } catch { /* ignore */ }
    finally { setDeleting(false) }
  }

  return (
    <div style={{
      width: 360, flexShrink: 0,
      backgroundColor: 'var(--bg-surface)',
      border: 'var(--border-width-default) solid var(--border-base)',
      borderRadius: 'var(--radius-medium)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: 'var(--border-width-default) solid var(--border-base)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 'var(--radius-medium)',
            backgroundColor: 'var(--bg-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Building2 size={18} color="var(--color-primary)" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-family-display)', fontWeight: 600, fontSize: 15 }}>
              {dept.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dept.dept_id}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {/* Stat */}
        <div style={{
          display: 'flex', gap: 12, marginBottom: 20,
          padding: '12px 16px',
          backgroundColor: 'var(--bg-muted)',
          borderRadius: 'var(--radius-medium)',
        }}>
          <Users size={18} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontFamily: 'var(--font-family-display)', fontWeight: 700, fontSize: 22 }}>
              {deptAgents.length}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              agent{deptAgents.length !== 1 ? 's' : ''} assigned
            </div>
          </div>
        </div>

        {/* Agent list */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
          Agents
        </div>
        {deptAgents.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            No agents assigned yet. Create an agent and assign it to this department.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deptAgents.map(agent => (
              <div key={agent.agent_id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                borderRadius: 'var(--radius-small)',
                border: 'var(--border-width-default) solid var(--border-base)',
                backgroundColor: 'var(--bg-base)',
              }}>
                <div style={{
                  width: 30, height: 30, flexShrink: 0,
                  borderRadius: 'var(--radius-small)',
                  backgroundColor: 'var(--bg-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bot size={14} color="var(--color-primary)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {agent.agent_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{agent.role}</div>
                </div>
                <StatusBadge status={agent.status} />
              </div>
            ))}
          </div>
        )}

        {/* Danger zone */}
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
            Danger Zone
          </div>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 13, color: '#ef4444', fontWeight: 500,
              background: 'none', border: '1px solid #ef444440',
              borderRadius: 'var(--radius-small)', padding: '8px 14px',
              cursor: 'pointer', width: '100%', justifyContent: 'center',
            }}>
              <Trash2 size={13} />
              Delete Department
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Agents in this department won't be deleted, just unlinked.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmDelete(false)} style={{ ...secondaryBtnStyle, flex: 1 }}>Cancel</button>
                <button onClick={handleDelete} disabled={deleting} style={{
                  flex: 1, padding: '8px 0', borderRadius: 'var(--radius-small)',
                  backgroundColor: '#ef4444', color: '#fff', border: 'none',
                  fontSize: 13, fontWeight: 600, cursor: deleting ? 'default' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}>
                  {deleting ? 'Deleting…' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Department card
// ---------------------------------------------------------------------------
function DeptCard({
  dept, agentCount, selected, onClick,
}: {
  dept: Department
  agentCount: number
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        width: '100%', textAlign: 'left',
        padding: '14px 18px',
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
        backgroundColor: selected ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--bg-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Building2 size={20} color={selected ? 'var(--color-primary)' : 'var(--text-muted)'} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, fontFamily: 'var(--font-family-display)', color: 'var(--text-primary)' }}>
          {dept.name}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {agentCount} agent{agentCount !== 1 ? 's' : ''}
        </div>
      </div>

      <ChevronRight size={16} color="var(--text-muted)" style={{ opacity: selected ? 1 : 0.4, flexShrink: 0 }} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Orchestrator card — pinned at the top, separate from departments
// ---------------------------------------------------------------------------
function OrchestratorCard({ agent }: { agent: AgentRecord | undefined }) {
  if (!agent) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 18px',
      backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, var(--bg-surface))',
      border: 'var(--border-width-default) solid var(--color-primary)',
      borderRadius: 'var(--radius-medium)',
      marginBottom: 24,
    }}>
      <div style={{
        width: 40, height: 40, flexShrink: 0,
        borderRadius: 'var(--radius-medium)',
        backgroundColor: 'var(--color-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Crown size={20} color="#fff" />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-family-display)', color: 'var(--text-primary)' }}>
            {agent.agent_name}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
            padding: '2px 7px',
            borderRadius: 'var(--radius-small)',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            textTransform: 'uppercase',
          }}>
            Orchestrator
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          Oversees all departments · manages task delegation
        </div>
      </div>
      <StatusBadge status={agent.status} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function DepartmentsPage() {
  const { agents } = useAgents()

  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading]         = useState(true)
  const [selected, setSelected]       = useState<string | null>(null)
  const [showForm, setShowForm]       = useState(false)

  const orchestrator = Object.values(agents).find(a => a.role === 'orchestrator')

  const fetchDepts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/organizations/${ORG_ID}/departments`)
      if (res.ok) {
        const data = await res.json()
        setDepartments(data)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchDepts() }, [fetchDepts])

  const selectedDept = departments.find(d => d.dept_id === selected) ?? null

  function agentCountFor(deptId: string) {
    return Object.values(agents).filter(a => (a as any).dept_id === deptId).length
  }

  function handleDeleted() {
    setSelected(null)
    fetchDepts()
  }

  return (
    <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-family-display)', fontSize: 22, fontWeight: 700, margin: 0 }}>
            Departments
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            {loading ? 'Loading…' : `${departments.length} department${departments.length !== 1 ? 's' : ''} · Corelink organization`}
          </p>
        </div>
        <button
          onClick={() => { setSelected(null); setShowForm(true) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '9px 18px',
            borderRadius: 'var(--radius-small)',
            backgroundColor: 'var(--color-primary)', color: '#fff',
            border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <Plus size={15} />
          Add Department
        </button>
      </div>

      {/* Main layout */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        {/* Left — orchestrator + dept list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Orchestrator pinned above departments */}
          <OrchestratorCard agent={orchestrator} />

          {/* Departments label */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
            Departments
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Loading departments…</div>
          ) : departments.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', gap: 12, padding: '40px 0',
            }}>
              <Building2 size={36} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: 14 }}>No departments yet — add one to get started.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {departments.map(dept => (
                <DeptCard
                  key={dept.dept_id}
                  dept={dept}
                  agentCount={agentCountFor(dept.dept_id)}
                  selected={selected === dept.dept_id}
                  onClick={() => {
                    if (showForm) setShowForm(false)
                    setSelected(prev => prev === dept.dept_id ? null : dept.dept_id)
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        {showForm && (
          <NewDeptForm
            onClose={() => setShowForm(false)}
            onCreate={fetchDepts}
          />
        )}
        {!showForm && selectedDept && (
          <DeptDetail
            dept={selectedDept}
            allAgents={agents}
            onClose={() => setSelected(null)}
            onDeleted={handleDeleted}
          />
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
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
