'use client'

import { useEffect, useState } from 'react'

export default function StatusDots() {
  const [s, setS] = useState(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setS)
      .catch(() => {})
  }, [])

  if (!s) return null

  const dot = (ok, label, hint) => (
    <span title={`${label}: ${ok ? 'connected' : 'missing key'} — ${hint}`} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 10.5,
      color: 'var(--text-faint)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      <span style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: ok ? 'var(--accent)' : 'var(--danger)',
        boxShadow: ok ? '0 0 8px var(--accent)' : 'none',
      }} />
      {label}
    </span>
  )

  return (
    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
      {dot(s.anthropic, 'AI', 'ANTHROPIC_API_KEY')}
      {dot(s.finnhub, 'Live', 'FINNHUB_API_KEY')}
    </div>
  )
}
