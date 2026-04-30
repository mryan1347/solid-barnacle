'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../lib/api'

export default function LivePanel({ tickers }) {
  const [snaps, setSnaps] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!tickers.length) {
      setSnaps([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const url = `/api/market?action=snapshotMany&symbols=${encodeURIComponent(tickers.join(','))}`
      const res = await apiFetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setSnaps(data.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [tickers])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 60000)
    return () => clearInterval(id)
  }, [refresh])

  if (!tickers.length) return null

  return (
    <div>
      <div className="section-title">
        <span>Live · {tickers.length}</span>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={refresh}
          disabled={loading}
          title="Refresh"
        >
          {loading ? '...' : '↻'}
        </button>
      </div>

      {error && (
        <div className="banner error" style={{ fontSize: 11, padding: '6px 10px', marginBottom: 8 }}>
          {error.includes('FINNHUB') ? 'Add FINNHUB_API_KEY to enable live data' : error}
        </div>
      )}

      {snaps.length === 0 && !error ? (
        <div className="empty" style={{ padding: '10px 0' }}>
          {loading ? 'loading…' : 'no quotes'}
        </div>
      ) : (
        <div className="live-list">
          {snaps.map((s) => {
            const q = s.quote
            const r = s.recommendations
            const t = s.priceTarget
            const up = q && t ? (((t.targetMean - q.price) / q.price) * 100) : null
            const pct = q?.pctChange ?? 0
            const dirColor = pct > 0 ? 'var(--accent)' : pct < 0 ? 'var(--danger)' : 'var(--text-dim)'
            return (
              <div key={s.symbol} className="live-row">
                <div className="live-row-top">
                  <span className="live-tkr">{s.symbol}</span>
                  {q ? (
                    <span className="live-px mono">
                      ${q.price?.toFixed(2)}
                      <span style={{ color: dirColor, marginLeft: 6 }}>
                        {pct >= 0 ? '+' : ''}{pct?.toFixed?.(2)}%
                      </span>
                    </span>
                  ) : <span className="live-px mono" style={{ color: 'var(--text-faint)' }}>—</span>}
                </div>
                {(r || t) && (
                  <div className="live-row-bot">
                    {r && (
                      <span title="Strong Buy / Buy / Hold / Sell / Strong Sell">
                        <span style={{ color: 'var(--accent)' }}>{r.strongBuy}</span>
                        <span style={{ color: 'var(--text-faint)' }}>·{r.buy}·{r.hold}·{r.sell}·{r.strongSell}</span>
                      </span>
                    )}
                    {t && (
                      <span style={{ color: up > 0 ? 'var(--accent)' : 'var(--text-dim)' }}>
                        tgt ${t.targetMean}{up != null ? ` (${up >= 0 ? '+' : ''}${up.toFixed(0)}%)` : ''}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style jsx>{`
        .live-list { display: flex; flex-direction: column; gap: 6px; }
        .live-row {
          background: var(--bg-elev-2);
          border: 1px solid var(--border);
          border-radius: 5px;
          padding: 7px 10px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .live-row-top {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px;
        }
        .live-tkr {
          font-family: var(--mono);
          font-weight: 700;
          font-size: 12.5px;
          color: var(--text);
        }
        .live-px { font-size: 12px; }
        .live-row-bot {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          color: var(--text-dim);
          font-family: var(--mono);
        }
      `}</style>
    </div>
  )
}
