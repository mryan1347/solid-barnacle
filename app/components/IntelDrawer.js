'use client'

import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/api'

const KINDS = [
  { value: 'note', label: 'Note' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'news', label: 'News' },
  { value: 'research', label: 'Research' },
  { value: 'rumor', label: 'Rumor' },
  { value: 'insider', label: 'Insider' },
  { value: 'macro', label: 'Macro' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'technical', label: 'Technical' },
]

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function IntelDrawer({ intel, onClose, onChange }) {
  const [body, setBody] = useState('')
  const [tickers, setTickers] = useState('')
  const [kind, setKind] = useState('thesis')
  const [source, setSource] = useState('')
  const [conviction, setConviction] = useState(7)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async (e) => {
    e?.preventDefault()
    if (!body.trim() || busy) return
    setBusy(true); setErr('')
    const tks = tickers
      .toUpperCase()
      .split(/[\s,]+/)
      .map((t) => t.replace(/[^A-Z0-9.\-]/g, ''))
      .filter(Boolean)
    try {
      const res = await apiFetch('/api/intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          tickers: tks,
          kind,
          source: source.trim(),
          conviction: Number(conviction),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setBody(''); setTickers(''); setSource('')
      onChange?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (id) => {
    try {
      const res = await apiFetch(`/api/intel?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (res.ok) onChange?.()
    } catch {}
  }

  const clearAll = async () => {
    if (!confirm(`Delete all ${intel.length} intel items?`)) return
    try {
      const res = await apiFetch('/api/intel?all=1', { method: 'DELETE' })
      if (res.ok) onChange?.()
    } catch {}
  }

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer-head">
          <div>
            <div className="brand-name">Intelligence Layer</div>
            <div className="drawer-sub">Persisted on backend · {intel.length} items</div>
          </div>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <form className="drawer-form" onSubmit={submit}>
          <textarea
            rows={5}
            placeholder="Drop research, a thesis, news, an observation. Use $TICKER tags. The AI will use this layer for every scan."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="field-row">
            <input
              placeholder="$NVDA, $VRT, $CEG"
              value={tickers}
              onChange={(e) => setTickers(e.target.value)}
            />
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </div>
          <details className="advanced">
            <summary>+ source · conviction</summary>
            <div className="field-row">
              <input
                placeholder="Source (WSJ, X post, gut)"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              />
              <input
                type="number" min={1} max={10}
                placeholder="Conv 1-10"
                value={conviction}
                onChange={(e) => setConviction(e.target.value)}
              />
            </div>
          </details>
          {err && <div className="banner error">{err}</div>}
          <button className="btn btn-primary" type="submit" disabled={!body.trim() || busy}>
            {busy ? 'Saving…' : 'Save to intelligence layer'}
          </button>
        </form>

        <div className="drawer-list-head">
          <span>Stored intel</span>
          {intel.length > 0 && (
            <button className="btn-ghost btn" onClick={clearAll}>clear all</button>
          )}
        </div>

        <div className="drawer-list">
          {intel.length === 0 ? (
            <div className="empty">No intel yet. The seeds will populate after the daily cron runs.</div>
          ) : intel.map((it) => (
            <article key={it.id} className="intel-item">
              <div className="intel-meta">
                <span className={`tag kind-${it.kind || 'note'}`}>{it.kind || 'note'}</span>
                {it.tickers?.map((t) => <span key={t} className="tag ticker">${t}</span>)}
                <span style={{ marginLeft: 'auto' }}>{timeAgo(it.createdAt)}</span>
              </div>
              <div className="intel-body">{it.body}</div>
              {(it.source || it.conviction != null) && (
                <div className="intel-meta">
                  {it.source && <span>src: {it.source}</span>}
                  {it.conviction != null && <span>conv: {it.conviction}/10</span>}
                </div>
              )}
              <div className="intel-actions">
                <button className="btn btn-danger-ghost" onClick={() => remove(it.id)}>remove</button>
              </div>
            </article>
          ))}
        </div>
      </aside>

      <style jsx global>{`
        .drawer-backdrop {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 50;
          animation: fade 0.15s ease-out;
        }
        @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
        .drawer {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: 100%;
          max-width: 480px;
          background: var(--bg);
          border-left: 1px solid var(--border);
          z-index: 51;
          display: flex;
          flex-direction: column;
          animation: slide 0.18s ease-out;
        }
        @keyframes slide {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .drawer-head {
          padding: 14px 18px;
          border-bottom: 1px solid var(--border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-elev);
        }
        .drawer-sub {
          font-size: 11px;
          color: var(--text-faint);
          letter-spacing: 0.04em;
          margin-top: 3px;
        }
        .drawer-form {
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-bottom: 1px solid var(--border);
        }
        .drawer-list-head {
          padding: 12px 18px 6px;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-faint);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .drawer-list {
          padding: 4px 18px 24px;
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
      `}</style>
    </>
  )
}
