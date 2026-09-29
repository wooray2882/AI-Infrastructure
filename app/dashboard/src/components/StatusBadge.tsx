const config = {
  online:  { label: 'Online',  dot: 'bg-green-500',  text: 'text-green-400' },
  idle:    { label: 'Idle',    dot: 'bg-amber-400',  text: 'text-amber-400' },
  error:   { label: 'Error',   dot: 'bg-red-500',    text: 'text-red-400'   },
  offline: { label: 'Offline', dot: 'bg-gray-500',   text: 'text-gray-400'  },
}

export default function StatusBadge({ status }: { status: keyof typeof config }) {
  const c = config[status] ?? config.offline
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot} ${status === 'online' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  )
}
