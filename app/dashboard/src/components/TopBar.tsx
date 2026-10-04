import { Search, Bell, User, Wifi, WifiOff, Loader2 } from 'lucide-react'

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error'

interface TopBarProps {
  connectionState: ConnectionState
  isDemoMode: boolean
}

export default function TopBar({ connectionState, isDemoMode }: TopBarProps) {
  return (
    <header
      className="flex items-center justify-between px-6"
      style={{
        height: 56,
        backgroundColor: 'var(--bg-surface)',
        borderBottom: 'var(--border-width-default) solid var(--border-base)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Search */}
      <div
        className="flex items-center gap-2"
        style={{
          backgroundColor: 'var(--bg-subtle)',
          border: 'var(--border-width-default) solid var(--border-subtle)',
          borderRadius: 'var(--radius-medium)',
          padding: '6px 12px',
          width: 260,
        }}
      >
        <Search size={14} strokeWidth={1.75} style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
          Search agents…
        </span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Demo badge */}
        {isDemoMode && (
          <span
            style={{
              backgroundColor: 'var(--color-warning-light)',
              color: 'var(--color-warning-text)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-weight-medium)',
              padding: '3px 10px',
              borderRadius: 'var(--radius-large)',
            }}
          >
            Demo mode
          </span>
        )}

        {/* Connection pill */}
        <div
          className="flex items-center gap-1.5"
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 'var(--font-weight-medium)',
            color: 'var(--text-secondary)',
          }}
        >
          {connectionState === 'connected' && (
            <><Wifi size={13} strokeWidth={1.75} style={{ color: 'var(--color-success)' }} /><span style={{ color: 'var(--color-success)' }}>Live</span></>
          )}
          {connectionState === 'connecting' && (
            <><Loader2 size={13} strokeWidth={1.75} className="animate-spin" /><span>Connecting</span></>
          )}
          {(connectionState === 'disconnected' || connectionState === 'error') && (
            <><WifiOff size={13} strokeWidth={1.75} style={{ color: 'var(--color-error)' }} /><span style={{ color: 'var(--color-error)' }}>Reconnecting</span></>
          )}
        </div>

        {/* Bell */}
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            padding: 4,
          }}
        >
          <Bell size={17} strokeWidth={1.75} />
        </button>

        {/* Avatar */}
        <div
          className="flex items-center justify-center"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary)',
            cursor: 'pointer',
          }}
        >
          <User size={15} strokeWidth={1.75} style={{ color: '#fff' }} />
        </div>
      </div>
    </header>
  )
}
