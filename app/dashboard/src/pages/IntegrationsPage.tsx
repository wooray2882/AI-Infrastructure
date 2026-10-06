import { useState } from 'react'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink, Lock } from 'lucide-react'

// ---------------------------------------------------------------------------
// Integration catalog
// ---------------------------------------------------------------------------
type AuthType = 'oauth' | 'apikey'
type Category = 'Communication' | 'Scheduling' | 'Productivity' | 'CRM'

interface Integration {
  id:          string
  name:        string
  description: string
  category:    Category
  authType:    AuthType
  keyLabel?:   string        // label shown on the input (API key integrations)
  keyHint?:    string        // placeholder text
  docsUrl?:    string
  comingSoon?: boolean
}

const INTEGRATIONS: Integration[] = [
  // Communication
  {
    id:          'gmail',
    name:        'Gmail',
    description: 'Send and read emails on behalf of agents using your Google account.',
    category:    'Communication',
    authType:    'oauth',
    docsUrl:     'https://developers.google.com/gmail/api',
  },
  {
    id:          'twilio_sms',
    name:        'Twilio SMS',
    description: 'Send text messages to leads and clients from a dedicated number.',
    category:    'Communication',
    authType:    'apikey',
    keyLabel:    'Account SID + Auth Token',
    keyHint:     'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  },
  {
    id:          'sendgrid',
    name:        'SendGrid',
    description: 'High-volume transactional and marketing email delivery.',
    category:    'Communication',
    authType:    'apikey',
    keyLabel:    'API Key',
    keyHint:     'SG.xxxxxxxxxxxxxxxxxxxxxxxx',
  },
  // Scheduling
  {
    id:          'google_calendar',
    name:        'Google Calendar',
    description: 'Book, check, and manage calendar events — agents can schedule calls automatically.',
    category:    'Scheduling',
    authType:    'oauth',
    docsUrl:     'https://developers.google.com/calendar',
  },
  {
    id:          'calendly',
    name:        'Calendly',
    description: 'Share booking links and sync confirmed meetings back to agents.',
    category:    'Scheduling',
    authType:    'apikey',
    keyLabel:    'Personal Access Token',
    keyHint:     'eyJhbGciOiJIUzI1NiJ9...',
    comingSoon:  true,
  },
  // Productivity
  {
    id:          'slack',
    name:        'Slack',
    description: 'Post agent updates, alerts, and task results directly to your workspace.',
    category:    'Productivity',
    authType:    'oauth',
    docsUrl:     'https://api.slack.com/authentication/oauth-v2',
  },
  {
    id:          'notion',
    name:        'Notion',
    description: 'Let agents read from and write to your Notion workspace.',
    category:    'Productivity',
    authType:    'apikey',
    keyLabel:    'Integration Token',
    keyHint:     'secret_xxxxxxxxxxxxxxxx',
    comingSoon:  true,
  },
  // CRM
  {
    id:          'hubspot',
    name:        'HubSpot',
    description: 'Sync contacts, deals, and activities with your HubSpot CRM.',
    category:    'CRM',
    authType:    'oauth',
    comingSoon:  true,
  },
  {
    id:          'custom',
    name:        'Custom API',
    description: 'Connect any platform that provides an API key or bearer token.',
    category:    'CRM',
    authType:    'apikey',
    keyLabel:    'API Key or Bearer Token',
    keyHint:     'Paste your key here…',
  },
]

const CATEGORIES: Category[] = ['Communication', 'Scheduling', 'Productivity', 'CRM']

// ---------------------------------------------------------------------------
// Integration icons (simple letter-based avatars — swap for real logos later)
// ---------------------------------------------------------------------------
const COLORS: Record<string, string> = {
  gmail:           '#EA4335',
  twilio_sms:      '#F22F46',
  sendgrid:        '#1A82E2',
  google_calendar: '#4285F4',
  calendly:        '#006BFF',
  slack:           '#4A154B',
  notion:          '#000000',
  hubspot:         '#FF7A59',
  custom:          'var(--color-primary)',
}

function IntegrationIcon({ id, name }: { id: string; name: string }) {
  return (
    <div style={{
      width: 44, height: 44, flexShrink: 0,
      borderRadius: 'var(--radius-medium)',
      backgroundColor: COLORS[id] ?? 'var(--color-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff',
      fontFamily: 'var(--font-family-display)',
      fontWeight: 700, fontSize: 16,
    }}>
      {name[0]}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single integration card
// ---------------------------------------------------------------------------
function IntegrationCard({ integration }: { integration: Integration }) {
  const [connected, setConnected] = useState(false)
  const [expanded, setExpanded]   = useState(false)
  const [keyValue, setKeyValue]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  async function handleSave() {
    if (!keyValue.trim()) return
    setSaving(true)
    // Stub: in production this calls POST /integrations/{id} which saves to Secrets Manager
    await new Promise(r => setTimeout(r, 800))
    setConnected(true)
    setSaved(true)
    setSaving(false)
    setExpanded(false)
    setTimeout(() => setSaved(false), 3000)
  }

  function handleDisconnect() {
    setConnected(false)
    setKeyValue('')
    setExpanded(false)
  }

  const isOAuth = integration.authType === 'oauth'

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      border: `var(--border-width-default) solid ${connected ? 'var(--color-primary)' : 'var(--border-base)'}`,
      borderRadius: 'var(--radius-medium)',
      overflow: 'hidden',
      opacity: integration.comingSoon ? 0.55 : 1,
    }}>
      {/* Card header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <IntegrationIcon id={integration.id} name={integration.name} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-family-display)', fontWeight: 600, fontSize: 14 }}>
              {integration.name}
            </span>
            {integration.comingSoon && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 7px',
                borderRadius: 'var(--radius-small)',
                backgroundColor: 'var(--bg-muted)', color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                Soon
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {integration.description}
          </div>
        </div>

        {/* Status + action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {connected ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#22c55e', fontWeight: 500 }}>
                <CheckCircle2 size={14} />
                Connected
              </div>
              <button onClick={handleDisconnect} style={{
                fontSize: 12, color: 'var(--text-muted)',
                background: 'none', border: 'var(--border-width-default) solid var(--border-base)',
                borderRadius: 'var(--radius-small)', padding: '5px 12px', cursor: 'pointer',
              }}>
                Disconnect
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }}>
                <Circle size={14} />
                Not connected
              </div>
              {!integration.comingSoon && (
                <button
                  onClick={() => isOAuth ? undefined : setExpanded(e => !e)}
                  disabled={isOAuth}
                  title={isOAuth ? 'OAuth setup required — coming soon' : undefined}
                  style={{
                    fontSize: 12, fontWeight: 600,
                    backgroundColor: isOAuth ? 'var(--bg-muted)' : 'var(--color-primary)',
                    color: isOAuth ? 'var(--text-muted)' : '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-small)', padding: '6px 14px', cursor: isOAuth ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  {isOAuth ? (
                    <><ExternalLink size={12} /> OAuth — coming soon</>
                  ) : (
                    <>{expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Connect</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Expanded API key form */}
      {expanded && !isOAuth && !connected && (
        <div style={{
          padding: '0 20px 18px',
          borderTop: 'var(--border-width-default) solid var(--border-base)',
          paddingTop: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            <Lock size={12} />
            Encrypted and stored in AWS Secrets Manager — never exposed after saving.
          </div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
            {integration.keyLabel ?? 'API Key'}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder={integration.keyHint ?? 'Paste your key…'}
              style={{
                flex: 1, padding: '9px 12px',
                borderRadius: 'var(--radius-small)',
                border: 'var(--border-width-default) solid var(--border-base)',
                backgroundColor: 'var(--bg-base)',
                color: 'var(--text-primary)',
                fontSize: 13, fontFamily: 'var(--font-family-body)',
                outline: 'none',
              }}
            />
            <button onClick={handleSave} disabled={!keyValue.trim() || saving} style={{
              padding: '9px 18px',
              borderRadius: 'var(--radius-small)',
              backgroundColor: !keyValue.trim() || saving ? 'var(--bg-muted)' : 'var(--color-primary)',
              color: !keyValue.trim() || saving ? 'var(--text-muted)' : '#fff',
              border: 'none', fontSize: 13, fontWeight: 600,
              cursor: !keyValue.trim() || saving ? 'default' : 'pointer',
              whiteSpace: 'nowrap',
            }}>
              {saving ? 'Saving…' : 'Save & Connect'}
            </button>
          </div>
          {saved && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#22c55e', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle2 size={12} /> Saved securely.
            </div>
          )}
          {integration.docsUrl && (
            <a href={integration.docsUrl} target="_blank" rel="noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              marginTop: 8, fontSize: 11, color: 'var(--text-muted)',
              textDecoration: 'none',
            }}>
              <ExternalLink size={11} /> Where to find your key
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function IntegrationsPage() {
  const connectedCount = 0 // will be live once API is wired

  return (
    <div style={{ padding: '28px 32px', boxSizing: 'border-box' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-family-display)', fontSize: 22, fontWeight: 700, margin: 0 }}>
          Integrations
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
          Connect external platforms so your agents can use them as tools.
          {connectedCount > 0 && ` ${connectedCount} connected.`}
        </p>
      </div>

      {/* Notice banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 16px', marginBottom: 28,
        backgroundColor: 'color-mix(in srgb, var(--color-primary) 6%, var(--bg-surface))',
        border: 'var(--border-width-default) solid color-mix(in srgb, var(--color-primary) 20%, transparent)',
        borderRadius: 'var(--radius-medium)',
        fontSize: 13, color: 'var(--text-secondary)',
      }}>
        <Lock size={15} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          All credentials are encrypted at rest in <strong>AWS Secrets Manager</strong>. They are only accessible
          to your agents at runtime — never stored in the database or returned to the browser.
        </span>
      </div>

      {/* Sections by category */}
      {CATEGORIES.map(category => {
        const items = INTEGRATIONS.filter(i => i.category === category)
        return (
          <div key={category} style={{ marginBottom: 32 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
              textTransform: 'uppercase', color: 'var(--text-muted)',
              marginBottom: 12,
            }}>
              {category}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(integration => (
                <IntegrationCard key={integration.id} integration={integration} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
