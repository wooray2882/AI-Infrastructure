import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useAgentStream } from '../hooks/useAgentStream'
import { MOCK_AGENTS } from '../data/mockAgents'
import { useMemo } from 'react'
import type { AgentRecord } from '../hooks/useAgentStream'

const WS_URL = import.meta.env.VITE_WS_URL as string

export interface AgentContext {
  agents: Record<string, AgentRecord>
  isDemoMode: boolean
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
}

// React context so child pages can access the live agent data
import { createContext, useContext } from 'react'
export const AgentsContext = createContext<AgentContext>({
  agents: {},
  isDemoMode: true,
  connectionState: 'connecting',
})
export function useAgents() { return useContext(AgentsContext) }

export default function AppLayout() {
  const { agents: liveAgents, connectionState } = useAgentStream(WS_URL)

  const hasLiveData = Object.keys(liveAgents).length > 0
  const isDemoMode = !hasLiveData

  const agents: Record<string, AgentRecord> = useMemo(() => {
    if (hasLiveData) return liveAgents
    return Object.fromEntries(MOCK_AGENTS.map(a => [a.agent_id, a]))
  }, [liveAgents, hasLiveData])

  return (
    <AgentsContext.Provider value={{ agents, isDemoMode, connectionState }}>
      <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-page)' }}>
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <TopBar connectionState={connectionState} isDemoMode={isDemoMode} />
          <main className="flex-1 overflow-y-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </AgentsContext.Provider>
  )
}
