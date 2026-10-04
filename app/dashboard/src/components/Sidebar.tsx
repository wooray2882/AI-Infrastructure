import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Bot, Building2, ScrollText, Settings } from 'lucide-react'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Overview' },
  { to: '/agents',    icon: Bot,             label: 'Agents' },
  { to: '/departments', icon: Building2,     label: 'Departments' },
  { to: '/logs',      icon: ScrollText,      label: 'Activity' },
  { to: '/settings',  icon: Settings,        label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: 220,
        minWidth: 220,
        backgroundColor: 'var(--bg-surface)',
        borderRight: 'var(--border-width-default) solid var(--border-base)',
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2 px-5"
        style={{
          height: 56,
          borderBottom: 'var(--border-width-default) solid var(--border-base)',
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            backgroundColor: 'var(--color-primary)',
            borderRadius: 'var(--radius-medium)',
          }}
        >
          <Bot size={15} strokeWidth={1.75} style={{ color: '#fff' }} />
        </div>
        <span
          style={{
            fontFamily: 'var(--font-family-display)',
            fontWeight: 'var(--font-weight-bold)',
            fontSize: 'var(--text-base)',
            color: 'var(--text-primary)',
            letterSpacing: 'var(--letter-spacing-tight)',
          }}
        >
          Corelink
        </span>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded transition-colors ${isActive ? 'nav-active' : 'nav-item'}`
            }
            style={({ isActive }) => ({
              borderRadius: 'var(--radius-medium)',
              fontSize: 'var(--text-sm)',
              fontWeight: isActive ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
              color: isActive ? 'var(--color-primary)' : 'var(--text-secondary)',
              backgroundColor: isActive ? 'var(--color-primary-light)' : 'transparent',
              textDecoration: 'none',
            })}
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div
        className="px-5 py-4"
        style={{
          borderTop: 'var(--border-width-default) solid var(--border-base)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-tertiary)',
        }}
      >
        v1.0 · dev
      </div>
    </aside>
  )
}
