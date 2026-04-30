'use client'

import { useState } from 'react'

const STRATEGIES = [
  'long_call',
  'long_put',
  'bull_call_spread',
  'bear_put_spread',
  'cash_secured_put',
  'covered_call',
  'iron_condor',
  'calendar',
  'leap_call',
  'diagonal',
]

export default function OptionsScanner({ onScan, scanning }) {
  const [watchlist, setWatchlist] = useState('')
  const [capital, setCapital] = useState('')
  const [risk, setRisk] = useState('defined-risk preferred')
  const [horizon, setHorizon] = useState('any')
  const [bias, setBias] = useState('neutral')
  const [strategies, setStrategies] = useState([])
  const [notes, setNotes] = useState('')

  const toggle = (s) => {
    setStrategies((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  const submit = (e) => {
    e.preventDefault()
    const wl = watchlist
      .toUpperCase()
      .split(/[\s,]+/)
      .map((t) => t.replace(/[^A-Z0-9.\-]/g, ''))
      .filter(Boolean)
    onScan({
      watchlist: wl,
      capital: capital.trim(),
      risk,
      horizon,
      bias,
      strategies,
      notes: notes.trim(),
    })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="field">
        <label className="label">Watchlist (optional — leave blank to scan from intel + market)</label>
        <input
          placeholder="NVDA, TSLA, META, COIN, $SMCI"
          value={watchlist}
          onChange={(e) => setWatchlist(e.target.value)}
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label">Capital available</label>
          <input
            placeholder="$5,000"
            value={capital}
            onChange={(e) => setCapital(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Risk</label>
          <select value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option>defined-risk preferred</option>
            <option>aggressive (naked long premium ok)</option>
            <option>income-only (sell premium)</option>
            <option>conservative (LEAPS / spreads only)</option>
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label">Horizon</label>
          <select value={horizon} onChange={(e) => setHorizon(e.target.value)}>
            <option value="any">any</option>
            <option value="0-7d">0–7d (weeklies)</option>
            <option value="7-30d">7–30d</option>
            <option value="30-90d">30–90d</option>
            <option value="LEAPS">LEAPS (6mo+)</option>
          </select>
        </div>
        <div className="field">
          <label className="label">Directional bias</label>
          <select value={bias} onChange={(e) => setBias(e.target.value)}>
            <option value="neutral">neutral / let setup decide</option>
            <option value="bullish">bullish</option>
            <option value="bearish">bearish</option>
            <option value="rangebound">range-bound</option>
            <option value="vol-expansion">vol expansion</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label className="label">Strategies (none = all allowed)</label>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          {STRATEGIES.map((s) => (
            <button
              key={s}
              type="button"
              className={`filter-pill ${strategies.includes(s) ? 'active' : ''}`}
              onClick={() => toggle(s)}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label">Notes / constraints</label>
        <textarea
          rows={2}
          placeholder="Avoid earnings IV crush. Prefer 0.30 delta. Skip weeklies."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={scanning}>
        {scanning ? <><span className="spinner" />Scanning options chain...</> : 'Run options scan'}
      </button>
    </form>
  )
}
