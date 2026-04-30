'use client'

import { useState } from 'react'
import { apiFetch } from '../lib/api'

export default function ThemeCard({ theme, onAddedToIntel }) {
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)
  const [err, setErr] = useState('')

  const conv = Math.max(0, Math.min(10, Number(theme.conviction) || 0))

  const allTickers = (theme.valueChain || []).flatMap((l) => l.tickers || [])
  const uniqTickers = [...new Set([...(theme.topPicks || []), ...allTickers])]

  const addToIntel = async () => {
    if (adding || added) return
    setAdding(true); setErr('')
    try {
      const body = theme.suggestedIntelBody || `${theme.theme}\n\n${theme.summary || ''}`
      const res = await apiFetch('/api/intel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'thesis',
          source: 'AI theme scanner',
          conviction: Math.round(conv),
          tickers: uniqTickers.slice(0, 30),
          body,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setAdded(true)
      onAddedToIntel?.()
    } catch (e) {
      setErr(e.message)
    } finally {
      setAdding(false)
    }
  }

  return (
    <article className="theme-card">
      <header className="theme-head">
        <div className="theme-title">
          <h3>{theme.theme}</h3>
          {theme.summary && <p>{theme.summary}</p>}
        </div>
        <div className="conviction" title="AI conviction">
          <span>conv</span>
          <div className="conviction-bar">
            <div className="conviction-fill" style={{ width: `${(conv / 10) * 100}%` }} />
          </div>
          <span className="conviction-num">{conv.toFixed(1)}</span>
        </div>
      </header>

      {theme.topPicks?.length > 0 && (
        <div className="theme-block">
          <div className="pick-block-label">Top picks</div>
          <div className="theme-tickers">
            {theme.topPicks.map((t) => <span key={t} className="tag ticker">${t}</span>)}
          </div>
        </div>
      )}

      {theme.valueChain?.length > 0 && (
        <div className="theme-block">
          <div className="pick-block-label">Value chain</div>
          <div className="theme-chain">
            {theme.valueChain.map((layer, i) => (
              <div key={i} className="theme-layer">
                <div className="theme-layer-name">{layer.layer}</div>
                <div className="theme-tickers">
                  {(layer.tickers || []).map((t) => <span key={t} className="tag">${t}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pick-grid">
        {theme.catalysts?.length > 0 && (
          <div className="pick-block">
            <div className="pick-block-label">Catalysts</div>
            <ul>{theme.catalysts.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </div>
        )}
        {theme.risks?.length > 0 && (
          <div className="pick-block">
            <div className="pick-block-label">Risks</div>
            <ul>{theme.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
          </div>
        )}
      </div>

      {theme.newsHeadlines?.length > 0 && (
        <div className="theme-block">
          <div className="pick-block-label">News triggers</div>
          <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-dim)', fontSize: 12 }}>
            {theme.newsHeadlines.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </div>
      )}

      <div className="theme-actions">
        {err && <span className="theme-err">{err}</span>}
        <button
          className={`btn ${added ? '' : 'btn-primary'}`}
          onClick={addToIntel}
          disabled={adding || added}
        >
          {added ? '✓ saved to intel' : adding ? 'saving…' : '+ Add to intel layer'}
        </button>
      </div>

      <style jsx>{`
        .theme-card {
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-left: 3px solid #c4b5fd;
          border-radius: 10px;
          padding: 16px 18px;
          margin-bottom: 14px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: var(--shadow);
        }
        .theme-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          flex-wrap: wrap;
        }
        .theme-title h3 {
          margin: 0 0 6px;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--text);
        }
        .theme-title p {
          margin: 0;
          font-size: 13px;
          color: var(--text-dim);
          line-height: 1.5;
        }
        .theme-block {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .theme-tickers {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .theme-chain {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .theme-layer {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 10px;
          background: var(--bg-elev-2);
          border: 1px solid var(--border);
          border-radius: 6px;
        }
        .theme-layer-name {
          font-size: 11px;
          color: var(--text-faint);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .theme-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          align-items: center;
          flex-wrap: wrap;
        }
        .theme-err {
          color: var(--danger);
          font-size: 12px;
        }
      `}</style>
    </article>
  )
}
