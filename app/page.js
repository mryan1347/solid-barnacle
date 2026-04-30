'use client'

import { useEffect, useMemo, useState } from 'react'
import IntelInput from './components/IntelInput'
import IntelList from './components/IntelList'
import PicksFeed from './components/PicksFeed'
import OptionsScanner from './components/OptionsScanner'
import ConsensusScanner from './components/ConsensusScanner'

const STORAGE_KEY = 'intel-desk-v1'

const TABS = [
  { key: 'picks', label: 'Picks' },
  { key: 'options', label: 'Options Scanner' },
  { key: 'consensus', label: 'Strong Buy Consensus' },
]

const initialState = {
  intel: [],
  picks: [],
  picksSummary: '',
  picksAt: null,
  options: [],
  optionsSummary: '',
  optionsAt: null,
  consensus: [],
  consensusSummary: '',
  consensusAt: null,
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false)
  const [state, setState] = useState(initialState)
  const [tab, setTab] = useState('picks')
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setState({ ...initialState, ...JSON.parse(raw) })
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
  }, [state, hydrated])

  const addIntel = (item) => setState((s) => ({ ...s, intel: [item, ...s.intel] }))
  const deleteIntel = (id) => setState((s) => ({ ...s, intel: s.intel.filter((i) => i.id !== id) }))
  const clearIntel = () => {
    if (!confirm('Clear all intel?')) return
    setState((s) => ({ ...s, intel: [] }))
  }

  const callAnalyze = async (mode, payload) => {
    setBusy(mode)
    setError('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, ...payload, intel: state.intel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    } catch (e) {
      setError(e.message)
      return null
    } finally {
      setBusy(null)
    }
  }

  const generatePicks = async () => {
    const data = await callAnalyze('picks', {})
    if (!data) return
    setState((s) => ({
      ...s,
      picks: data.picks || [],
      picksSummary: data.summary || '',
      picksAt: data.generatedAt,
    }))
  }

  const runOptions = async (filters) => {
    const data = await callAnalyze('options', filters)
    if (!data) return
    setState((s) => ({
      ...s,
      options: data.picks || [],
      optionsSummary: data.summary || '',
      optionsAt: data.generatedAt,
    }))
  }

  const runConsensus = async (filters) => {
    const data = await callAnalyze('consensus', filters)
    if (!data) return
    setState((s) => ({
      ...s,
      consensus: data.picks || [],
      consensusSummary: data.summary || '',
      consensusAt: data.generatedAt,
    }))
  }

  const stats = useMemo(() => {
    const tickerSet = new Set()
    state.intel.forEach((i) => i.tickers?.forEach((t) => tickerSet.add(t)))
    return {
      intel: state.intel.length,
      tickers: tickerSet.size,
      picks: state.picks.length,
      options: state.options.length,
    }
  }, [state])

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">Intel Desk</span>
          <span className="brand-sub">stock AI</span>
        </div>

        <IntelInput onAdd={addIntel} />

        <div className="divider" />

        <IntelList items={state.intel} onDelete={deleteIntel} onClear={clearIntel} />
      </aside>

      <main className="main">
        <div className="header">
          <div>
            <h1>Stock intelligence</h1>
            <p>Drop intel on the left. Generate picks, scan options, or pull analyst consensus.</p>
          </div>
          <div className="header-actions">
            {tab === 'picks' && (
              <button className="btn btn-primary" onClick={generatePicks} disabled={busy === 'picks'}>
                {busy === 'picks' ? <><span className="spinner" />Synthesizing...</> : 'Generate picks'}
              </button>
            )}
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-label">Intel items</div>
            <div className="stat-value">{stats.intel}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Tickers tracked</div>
            <div className="stat-value">{stats.tickers}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Active picks</div>
            <div className="stat-value">{stats.picks}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Options ideas</div>
            <div className="stat-value">{stats.options}</div>
          </div>
        </div>

        {error && <div className="banner error">⚠ {error}</div>}

        <div className="filter-bar" style={{ marginBottom: 18 }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`filter-pill ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'picks' && (
          <PicksFeed picks={state.picks} summary={state.picksSummary} generatedAt={state.picksAt} />
        )}

        {tab === 'options' && (
          <div style={{ display: 'grid', gap: 24 }}>
            <section className="pick" style={{ padding: 18 }}>
              <OptionsScanner onScan={runOptions} scanning={busy === 'options'} />
            </section>
            <PicksFeed picks={state.options} summary={state.optionsSummary} generatedAt={state.optionsAt} />
          </div>
        )}

        {tab === 'consensus' && (
          <div style={{ display: 'grid', gap: 24 }}>
            <section className="pick" style={{ padding: 18 }}>
              <ConsensusScanner onScan={runConsensus} scanning={busy === 'consensus'} />
            </section>
            <PicksFeed picks={state.consensus} summary={state.consensusSummary} generatedAt={state.consensusAt} />
          </div>
        )}
      </main>
    </div>
  )
}
