import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Bot, User, Loader2, ChevronDown } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? ''

interface Agent {
  agent_id: string
  name:     string
  role:     string
}

interface Message {
  id:      string
  role:    'user' | 'agent'
  text:    string
  agent_id?: string
  skills?: string[]
  loading?: boolean
  error?:  boolean
}

function AgentBubble({ msg }: { msg: Message }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{
        width: 34, height: 34, flexShrink: 0,
        borderRadius: 'var(--radius-medium)',
        backgroundColor: msg.error ? '#ef444420' : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 2,
      }}>
        {msg.loading
          ? <Loader2 size={16} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
          : <Bot size={16} color={msg.error ? '#ef4444' : 'var(--color-primary)'} />
        }
      </div>
      <div style={{ flex: 1 }}>
        {msg.agent_id && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
            {msg.agent_id}
          </div>
        )}
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-medium)',
          backgroundColor: msg.error ? '#ef444415' : 'var(--bg-surface)',
          border: `var(--border-width-default) solid ${msg.error ? '#ef444440' : 'var(--border-base)'}`,
          fontSize: 14, lineHeight: 1.6,
          color: msg.error ? '#ef4444' : 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
        }}>
          {msg.loading ? (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Agent is thinking…</span>
          ) : msg.text}
        </div>
        {msg.skills && msg.skills.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {msg.skills.map(s => (
              <span key={s} style={{
                fontSize: 11, padding: '2px 8px',
                borderRadius: 'var(--radius-small)',
                backgroundColor: 'var(--bg-muted)',
                color: 'var(--text-muted)',
                fontWeight: 500,
              }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserBubble({ msg }: { msg: Message }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: 'row-reverse' }}>
      <div style={{
        width: 34, height: 34, flexShrink: 0,
        borderRadius: 'var(--radius-medium)',
        backgroundColor: 'var(--bg-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 2,
      }}>
        <User size={16} color="var(--text-muted)" />
      </div>
      <div style={{
        padding: '12px 16px',
        borderRadius: 'var(--radius-medium)',
        backgroundColor: 'var(--color-primary)',
        fontSize: 14, lineHeight: 1.6, color: '#fff',
        maxWidth: '70%',
        whiteSpace: 'pre-wrap',
      }}>
        {msg.text}
      </div>
    </div>
  )
}

export default function OrchestratePage() {
  const [agents, setAgents]         = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState('')
  const [input, setInput]   = useState('')
  const [messages, setMessages] = useState<Message[]>([{
    id:   'welcome',
    role: 'agent',
    text: 'Hello! I\'m the Corelink Orchestrator. Describe a task and I\'ll route it to the right agent — or pick a department to target a specific team.',
  }])
  const [busy, setBusy]     = useState(false)
  const bottomRef           = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`${API}/agents`)
      .then(r => r.ok ? r.json() : [])
      .then((all: Agent[]) => setAgents(all.filter(a => a.role !== 'orchestrator')))
      .catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text }
    const loadingMsg: Message = { id: crypto.randomUUID(), role: 'agent', text: '', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])

    try {
      const body: Record<string, string> = { task: text }
      if (selectedAgent) body.agent_id = selectedAgent

      const res  = await fetch(`${API}/orchestrate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, loading: false, error: true, text: data.error ?? 'The orchestrator returned an error.' }
            : m
        ))
      } else {
        setMessages(prev => prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, loading: false, text: data.result || 'Task completed.', agent_id: data.agent_id, skills: data.skills }
            : m
        ))
      }
    } catch (err) {
      setMessages(prev => prev.map(m =>
        m.id === loadingMsg.id
          ? { ...m, loading: false, error: true, text: 'Network error — could not reach the API.' }
          : m
      ))
    } finally {
      setBusy(false)
    }
  }, [input, busy, selectedDept])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      padding: '28px 32px', boxSizing: 'border-box', gap: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-family-display)', fontSize: 22, fontWeight: 700, margin: 0 }}>
            Orchestrate
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Send a task — the orchestrator picks the best agent, or choose one directly from the dropdown
          </p>
        </div>

        {/* Agent selector */}
        <div style={{ position: 'relative' }}>
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            style={{
              appearance: 'none',
              padding: '8px 36px 8px 14px',
              borderRadius: 'var(--radius-small)',
              border: 'var(--border-width-default) solid var(--border-base)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-family-body)',
            }}
          >
            <option value="">Auto-route (best match for task)</option>
            {agents.map(a => (
              <option key={a.agent_id} value={a.agent_id}>
                {a.name} · {a.role}
              </option>
            ))}
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Chat thread */}
      <div style={{
        flex: 1, overflowY: 'auto', minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 20,
        padding: '4px 0',
      }}>
        {messages.map(msg =>
          msg.role === 'user'
            ? <UserBubble key={msg.id} msg={msg} />
            : <AgentBubble key={msg.id} msg={msg} />
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        flexShrink: 0,
        display: 'flex', gap: 10,
        padding: '14px 16px',
        borderRadius: 'var(--radius-medium)',
        border: 'var(--border-width-default) solid var(--border-base)',
        backgroundColor: 'var(--bg-surface)',
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
          }}
          placeholder="Describe a task… e.g. 'Send a welcome email to Alex at alex@acme.com'"
          rows={2}
          style={{
            flex: 1, resize: 'none',
            background: 'none', border: 'none', outline: 'none',
            fontSize: 14, lineHeight: 1.5,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-family-body)',
          }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || busy}
          style={{
            width: 40, height: 40, flexShrink: 0,
            borderRadius: 'var(--radius-small)',
            backgroundColor: !input.trim() || busy ? 'var(--bg-muted)' : 'var(--color-primary)',
            border: 'none', cursor: !input.trim() || busy ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background-color 0.15s',
            alignSelf: 'flex-end',
          }}
        >
          <Send size={16} color={!input.trim() || busy ? 'var(--text-muted)' : '#fff'} />
        </button>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
