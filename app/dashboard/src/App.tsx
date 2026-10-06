import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import OverviewPage from './pages/OverviewPage'
import AgentsPage from './pages/AgentsPage'
import DepartmentsPage from './pages/DepartmentsPage'
import IntegrationsPage from './pages/IntegrationsPage'
import PlaceholderPage from './pages/PlaceholderPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<OverviewPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/orchestrate" element={<Navigate to="/dashboard" replace />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/logs" element={<PlaceholderPage title="Activity Log" description="Heartbeat history — coming soon" />} />
        <Route path="/settings" element={<PlaceholderPage title="Settings" description="Platform settings — coming soon" />} />
      </Route>
    </Routes>
  )
}
