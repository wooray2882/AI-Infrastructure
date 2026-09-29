type Status = 'online' | 'idle' | 'error' | 'offline'

const config: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  online:  { label: 'Online',  bg: 'var(--color-success-light)', text: 'var(--color-success-text)', dot: 'var(--color-success)' },
  idle:    { label: 'Idle',    bg: 'var(--color-warning-light)', text: 'var(--color-warning-text)', dot: 'var(--color-warning)' },
  error:   { label: 'Error',   bg: 'var(--color-error-light)',   text: 'var(--color-error-text)',   dot: 'var(--color-error)'   },
  offline: { label: 'Offline', bg: 'var(--bg-muted)',            text: 'var(--text-secondary)',     dot: 'var(--border-strong)' },
}

export default function StatusBadge({ status }: { status: string }) {
  const c = config[status as Status] ?? config.offline
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded"
      style={{
        backgroundColor: c.bg,
        color: c.text,
        borderRadius: 'var(--radius-small)',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--font-weight-medium)',
        letterSpacing: 'var(--letter-spacing-wide)',
      }}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'animate-pulse' : ''}`}
        style={{ backgroundColor: c.dot, flexShrink: 0 }}
      />
      {c.label.toUpperCase()}
    </span>
  )
}
