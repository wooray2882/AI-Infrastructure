interface Props { title: string; description: string }

export default function PlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full" style={{ minHeight: 400 }}>
      <p style={{ fontFamily: 'var(--font-family-display)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-primary)' }}>
        {title}
      </p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 8 }}>
        {description}
      </p>
    </div>
  )
}
