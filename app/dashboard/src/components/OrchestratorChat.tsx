import { useState, useRef, useCallback, useEffect } from 'react'
import { Bot, X, Send, Loader2, User, Minimize2 } from 'lucide-react'

const API = import.meta.env.VITE_API_URL ?? ''

interface Message {
  id:       string
  role:     'user' | 'agent'
  text:     string
  agent_id?: string
  loading?: boolean
  error?:   boolean
}

export default function OrchestratorChat() {
  const [open, setOpen]         = useState(false)
  const [input, setInput]       = useState('')
  const [busy, setBusy]         = useState(false)
  const [messages, setMessages] = useState<Message[]>([{
    id:   'welcome',
    role: 'agent',
    text: "Hi! I'm your Corelink Orchestrator. Tell me what you need done and I'll route it to the right agent — or help you set up new ones.",
  }])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setBusy(true)

    const userMsg:    Message = { id: crypto.randomUUID(), role: 'user',  text }
    const loadingMsg: Message = { id: crypto.randomUUID(), role: 'agent', text: '', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])

    try {
      const res  = await fetch(`${API}/orchestrate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ task: text }),
      })
      const data = await res.json()

      setMessages(prev => prev.map(m =>
        m.id === loadingMsg.id ? {
          ...m,
          loading:  false,
          error:    !res.ok,
          text:     res.ok ? (data.result || 'Done.') : (data.error ?? 'Something went wrong.'),
          agent_id: data.agent_id,
        } : m
      ))
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === loadingMsg.id
          ? { ...m, loading: false, error: true, text: 'Network error — could not reach the API.' }
          : m
      ))
    } finally {
      setBusy(false)
    }
  }, [input, busy])

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Open orchestrator chat"
        style={{
          position:        'fixed',
          bottom:          28,
          right:           28,
          width:           52,
          height:          52,
          borderRadius:    '50%',
          backgroundColor: 'var(--color-primary)',
          border:          'none',
          cursor:          'pointer',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          boxShadow:       '0 4px 16px rgba(0,0,0,0.18)',
          zIndex:          1000,
          transition:      'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.transform  = 'scale(1.08)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(0,0,0,0.26)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.transform  = 'scale(1)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'
        }}
      >
        {open
          ? <X    size={20} color="#fff" />
          : <Bot  size={20} color="#fff" />
        }
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position:        'fixed',
            bottom:          92,
            right:           28,
            width:           380,
            height:          520,
            borderRadius:    'var(--radius-large, 12px)',
            backgroundColor: 'var(--bg-page)',
            border:          'var(--border-width-default) solid var(--border-base)',
            boxShadow:       '0 8px 40px rgba(0,0,0,0.18)',
            zIndex:          999,
            display:         'flex',
            flexDirection:   'column',
            overflow:        'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display:         'flex',
            alignItems:      'center',
            gap:             10,
            padding:         '14px 16px',
            borderBottom:    'var(--border-width-default) solid var(--border-base)',
            backgroundColor: 'var(--bg-surface)',
            flexShrink:      0,
          }}>
            <div style={{
              width: 30, height: 30,
              borderRadius: 'var(--radius-medium)',
              backgroundColor: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Bot size={15} color="var(--color-primary)" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-family-display)', fontWeight: 700, fontSize: 13 }}>
                Orchestrator
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Always on · routes to best agent</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}
            >
              <Minimize2 size={14} />
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex:      1,
            overflowY: 'auto',
            padding:   '16px 14px',
            display:   'flex',
            flexDirection: 'column',
            gap:       14,
            minHeight: 0,
          }}>
            {messages.map(msg => (
              msg.role === 'user'
                ? (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      maxWidth:        '80%',
                      padding:         '9px 13px',
                      borderRadius:    'var(--radius-medium)',
                      backgroundColor: 'var(--color-primary)',
                      color:           '#fff',
                      fontSize:        13,
                      lineHeight:      1.5,
                      whiteSpace:      'pre-wrap',
                    }}>
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 26, height: 26, flexShrink: 0,
                      borderRadius: 'var(--radius-medium)',
                      backgroundColor: msg.error ? '#ef444420' : 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginTop: 2,
                    }}>
                      {msg.loading
                        ? <Loader2 size={13} color="var(--color-primary)" style={{ animation: 'spin 1s linear infinite' }} />
                        : <Bot     size={13} color={msg.error ? '#ef4444' : 'var(--color-primary)'} />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      {msg.agent_id && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>
                          via {msg.agent_id}
                        </div>
                      )}
                      <div style={{
                        padding:         '9px 13px',
                        borderRadius:    'var(--radius-medium)',
                        backgroundColor: msg.error ? '#ef444415' : 'var(--bg-surface)',
                        border:          `var(--border-width-default) solid ${msg.error ? '#ef444440' : 'var(--border-base)'}`,
                        fontSize:        13,
                        lineHeight:      1.5,
                        color:           msg.error ? '#ef4444' : 'var(--text-primary)',
                        whiteSpace:      'pre-wrap',
                      }}>
                        {msg.loading
                          ? <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Thinking…</span>
                          : msg.text
                        }
                      </div>
                    </div>
                  </div>
                )
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            flexShrink:      0,
            padding:         '10px 12px',
            borderTop:       'var(--border-width-default) solid var(--border-base)',
            backgroundColor: 'var(--bg-surface)',
            display:         'flex',
            gap:             8,
            alignItems:      'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
              }}
              placeholder="Describe a task…"
              rows={2}
              style={{
                flex:        1,
                resize:      'none',
                background:  'none',
                border:      'none',
                outline:     'none',
                fontSize:    13,
                lineHeight:  1.5,
                color:       'var(--text-primary)',
                fontFamily:  'var(--font-family-body)',
              }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || busy}
              style={{
                width:           34,
                height:          34,
                flexShrink:      0,
                borderRadius:    'var(--radius-small)',
                backgroundColor: !input.trim() || busy ? 'var(--bg-muted)' : 'var(--color-primary)',
                border:          'none',
                cursor:          !input.trim() || busy ? 'default' : 'pointer',
                display:         'flex',
                alignItems:      'center',
                justifyContent:  'center',
              }}
            >
              <Send size={14} color={!input.trim() || busy ? 'var(--text-muted)' : '#fff'} />
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
