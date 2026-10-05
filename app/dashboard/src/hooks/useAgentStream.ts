import { useEffect, useRef, useState, useCallback } from 'react'

export interface AgentRecord {
  agent_id: string
  agent_name: string
  department: string
  role: string
  model_id?: string
  status: 'online' | 'idle' | 'error' | 'offline'
  tools: string
  last_heartbeat: string
  last_action?: string
  message?: string
  extra?: Record<string, unknown>
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

export function useAgentStream(wsUrl: string) {
  const [agents, setAgents] = useState<Record<string, AgentRecord>>({})
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const wsRef = useRef<WebSocket | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)

  const connect = useCallback(() => {
    if (!wsUrl) return

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setConnectionState('connecting')

    ws.onopen = () => {
      setConnectionState('connected')
      retryCount.current = 0
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'heartbeat_update') {
          setAgents(prev => {
            const next = { ...prev }
            for (const agent of msg.agents as AgentRecord[]) {
              next[agent.agent_id] = agent
            }
            return next
          })
        }
      } catch {
        // malformed message — ignore
      }
    }

    ws.onclose = () => {
      setConnectionState('disconnected')
      // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
      const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000)
      retryCount.current++
      retryRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      setConnectionState('error')
      ws.close()
    }
  }, [wsUrl])

  useEffect(() => {
    connect()
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { agents, connectionState }
}
