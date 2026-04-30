'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import IntelDrawer from './components/IntelDrawer'
import PicksFeed from './components/PicksFeed'
import OptionsScanner from './components/OptionsScanner'
import ConsensusScanner from './components/ConsensusScanner'
import LivePanel from './components/LivePanel'
import StatusDots from './components/StatusDots'
import ThemeCard from './components/ThemeCard'
import Lock from './components/Lock'
import { apiFetch } from './lib/api'

const SCANNERS = [
  { key: 'top_picks', label: 'Top Picks', auto: true },
  { key: 'themes', label: 'Themes', auto: true },
  { key: 'sleepers', label: 'Sleepers', auto: true },
  { key: 'hidden_gems', label: 'Hidden Gems', auto: true },
  { key: 'undervalued', label: 'Undervalued', auto: true },
  { key: 'consensus', label: 'Strong Buy', auto: true },
  { key: 'options', label: 'Options', auto: false },
]

const RESULT_CACHE_KEY = 'intel-desk-results-v2'

export default function Home() {
  const [results, setResults] = useState({})
  const [busy, setBusy] = useState({})
  const [errors, setErrors] = useState({})
  const [tab, setTab] = useState('top_picks')
  const [intel, setIntel] = useState([])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hydrate cached scanner results from localStorage so reloads are instant.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RESULT_CACHE_KEY)
      if (raw) setResults(JSON.parse(raw))
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(RESULT_CACHE_KEY, JSON.stringify(results)) } catch {}
  }, [results, hydrated])

  const refreshIntel = useCallback(async () => {
    try {
      const res = await apiFetch('/api/intel')
      const data = await res.json()
      if (res.ok) setIntel(data.items || [])
    } catch {}
  }, [])

  useEffect(() => { refreshIntel() }, [refreshIntel])

  const runScan = useCallback(async (mode, payload = {}, fresh = false) => {
    setBusy((b) => ({ ...b, [mode]: true }))
    setErrors((e) => ({ ...e, [mode]: '' }))
    try {
      const res = await apiFetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, payload, fresh }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Scan failed')
      setResults((r) => ({ ...r, [mode]: data }))
      return data
    } catch (e) {
      setErrors((er) => ({ ...er, [mode]: e.message }))
      return null
    } finally {
      setBusy((b) => ({ ...b, [mode]: false }))
    }
  }, [])

  // Lazy-load: only the active tab autoloads on mount or tab switch. This
  // avoids burning the Anthropic budget on a cold cache (6 simultaneous
  // scans = $1-2). Server-side cache makes the scan cheap on repeat hits.
  useEffect(() => {
    if (!hydrated) return
    const s = SCANNERS.find((x) => x.key === tab)
    if (!s?.auto) return
    if (results[tab]?.picks?.length) return
    if (busy[tab]) return
    runScan(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tab])

  const trackedTickers = useMemo(() => {
    const set = new Set()
    intel.forEach((i) => i.tickers?.forEach((t) => set.add(t)))
    return [...set]
  }, [intel])

  const onIntelAdded = async () => {
    await refreshIntel()
    // Intel changed — drop scanner caches client-side; server cache key
    // includes intel digest so next scan will be fresh anyway.
    setResults({})
  }

  const current = results[tab]
  const meta = SCANNERS.find((s) => s.key === tab)

  return (
    <Lock>
    <div className="shell shell-mobile">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand-dot" />
          <div>
            <div className="brand-name">Intel Desk</div>
            <StatusDots />
          </div>
        </div>
        <div className="topbar-right">
          <button
            className="btn"
            onClick={() => runScan(tab, {}, true)}
            disabled={busy[tab]}
            title="Refresh this scanner with fresh data"
          >
            {busy[tab] ? '↻…' : '↻'}
          </button>
          <button className="btn btn-primary" onClick={() => setDrawerOpen(true)}>
            Intel · {intel.length}
          </button>
        </div>
      </header>

      <nav className="tabbar">
        {SCANNERS.map((s) => (
          <button
            key={s.key}
            className={`tab ${tab === s.key ? 'active' : ''}`}
            onClick={() => setTab(s.key)}
          >
            {s.label}
            {results[s.key]?.picks?.length > 0 && (
              <span className="tab-count">{results[s.key].picks.length}</span>
            )}
          </button>
        ))}
      </nav>

      <main className="main main-mobile">
        {trackedTickers.length > 0 && (
          <details className="livewrap">
            <summary>Live · {trackedTickers.length} ticker{trackedTickers.length === 1 ? '' : 's'}</summary>
            <LivePanel tickers={trackedTickers} />
          </details>
        )}

        {tab === 'options' ? (
          <section className="card">
            <OptionsScanner
              onScan={(payload) => runScan('options', payload, true)}
              scanning={busy.options}
            />
          </section>
        ) : tab === 'consensus' && !current?.picks?.length ? (
          <section className="card">
            <ConsensusScanner
              onScan={(payload) => runScan('consensus', payload, true)}
              scanning={busy.consensus}
            />
          </section>
        ) : null}

        {errors[tab] && <div className="banner error">⚠ {errors[tab]}</div>}

        {busy[tab] && !current?.picks?.length ? (
          <div className="empty"><span className="spinner" />Scanning {meta?.label.toLowerCase()}…</div>
        ) : current?.picks?.length ? (
          tab === 'themes' ? (
            <div>
              {current.summary && (
                <div className="summary">
                  <div className="summary-label">
                    Theme synthesis · {new Date(current.generatedAt).toLocaleString()}
                  </div>
                  {current.summary}
                </div>
              )}
              {current.picks.map((t) => (
                <ThemeCard key={t.id} theme={t} onAddedToIntel={refreshIntel} />
              ))}
            </div>
          ) : (
            <PicksFeed
              picks={current.picks}
              summary={current.summary}
              generatedAt={current.generatedAt}
            />
          )
        ) : (
          <div className="empty">
            {tab === 'options'
              ? 'Configure parameters above and run an options scan.'
              : 'No picks yet — tap ↻ to run.'}
          </div>
        )}

        {current?.cached && (
          <div className="meta-line">
            Cached. Tap ↻ for fresh data. Intel: {current.intelCount ?? intel.length} items.
          </div>
        )}
      </main>

      {drawerOpen && (
        <IntelDrawer
          intel={intel}
          onClose={() => setDrawerOpen(false)}
          onChange={onIntelAdded}
        />
      )}

      <style jsx global>{`
        .shell-mobile {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--bg-elev);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 10;
          gap: 10px;
        }
        .topbar-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .topbar-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tabbar {
          display: flex;
          overflow-x: auto;
          gap: 4px;
          padding: 8px 12px;
          background: var(--bg);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 57px;
          z-index: 9;
          -webkit-overflow-scrolling: touch;
        }
        .tabbar::-webkit-scrollbar { display: none; }
        .tab {
          flex-shrink: 0;
          background: var(--bg-elev);
          border: 1px solid var(--border);
          color: var(--text-dim);
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 999px;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .tab.active {
          background: rgba(52,211,153,0.1);
          border-color: var(--accent-dim);
          color: var(--accent);
        }
        .tab-count {
          background: var(--border);
          color: var(--text-dim);
          font-size: 10.5px;
          padding: 1px 6px;
          border-radius: 999px;
          font-family: var(--mono);
        }
        .tab.active .tab-count {
          background: var(--accent-dim);
          color: var(--accent);
        }
        .main-mobile {
          padding: 16px 14px 32px;
          max-width: 900px;
          margin: 0 auto;
          width: 100%;
        }
        .card {
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .livewrap {
          background: var(--bg-elev);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 6px 12px 0;
          margin-bottom: 14px;
        }
        .livewrap summary {
          cursor: pointer;
          font-size: 11px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--text-faint);
          padding: 6px 0;
          user-select: none;
        }
        .livewrap[open] { padding-bottom: 12px; }
        .meta-line {
          margin-top: 14px;
          color: var(--text-faint);
          font-size: 11px;
          text-align: center;
        }
        @media (min-width: 720px) {
          .main-mobile { padding: 24px 28px 40px; }
        }
      `}</style>
    </div>
    </Lock>
  )
}
