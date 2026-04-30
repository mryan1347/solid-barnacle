'use client'

import { useEffect, useState } from 'react'
import { apiFetch, getStoredPassword, setStoredPassword, clearStoredPassword } from '../lib/api'

// Wraps the app. On mount, fetches /api/health to learn whether auth
// is required. If yes and the stored password isn't valid, renders
// a password prompt instead of the children.

export default function Lock({ children }) {
  const [status, setStatus] = useState('checking') // checking | open | locked | unlocked
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/health')
        const data = await res.json()
        if (!alive) return
        if (!data.authRequired) { setStatus('open'); return }
        // Auth required — verify stored pw by hitting a protected GET.
        const stored = getStoredPassword()
        if (!stored) { setStatus('locked'); return }
        const probe = await apiFetch('/api/intel')
        if (!alive) return
        if (probe.ok) setStatus('unlocked')
        else { clearStoredPassword(); setStatus('locked') }
      } catch {
        if (alive) setStatus('open') // network error — let app try
      }
    })()
    return () => { alive = false }
  }, [])

  const tryUnlock = async (e) => {
    e?.preventDefault()
    if (!pw || busy) return
    setBusy(true); setErr('')
    setStoredPassword(pw)
    try {
      const probe = await apiFetch('/api/intel')
      if (probe.ok) { setStatus('unlocked'); return }
      clearStoredPassword()
      setErr(probe.status === 401 ? 'Wrong password' : `Unexpected error (${probe.status})`)
    } catch (e) {
      setErr(e.message || 'Network error')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'checking') return null
  if (status === 'open' || status === 'unlocked') return children

  return (
    <div className="lock-shell">
      <form className="lock-card" onSubmit={tryUnlock}>
        <div className="lock-brand">
          <span className="brand-dot" />
          <span className="brand-name">Intel Desk</span>
        </div>
        <h1>Locked</h1>
        <p>This Intel Desk instance requires a password.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        {err && <div className="banner error" style={{ marginTop: 8 }}>{err}</div>}
        <button className="btn btn-primary" type="submit" disabled={!pw || busy} style={{ marginTop: 10 }}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
        <div className="lock-hint">
          Set <span className="mono">APP_PASSWORD</span> in your Vercel env vars; that's the value to enter here.
        </div>
      </form>
      <style jsx global>{`
        .lock-shell {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .lock-card {
          width: 100%;
          max-width: 360px;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          box-shadow: var(--shadow);
        }
        .lock-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        .lock-card h1 {
          margin: 4px 0 0;
          font-size: 20px;
          letter-spacing: -0.01em;
        }
        .lock-card p {
          margin: 0 0 14px;
          color: var(--text-dim);
          font-size: 13px;
        }
        .lock-hint {
          margin-top: 16px;
          font-size: 11px;
          color: var(--text-faint);
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
