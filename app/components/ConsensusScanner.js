'use client'

import { useState } from 'react'

export default function ConsensusScanner({ onScan, scanning }) {
  const [sector, setSector] = useState('any')
  const [marketCap, setMarketCap] = useState('any')
  const [minStrongBuys, setMinStrongBuys] = useState(15)
  const [minUpside, setMinUpside] = useState(10)
  const [theme, setTheme] = useState('')
  const [exclude, setExclude] = useState('')
  const [limit, setLimit] = useState(12)

  const submit = (e) => {
    e.preventDefault()
    const ex = exclude
      .toUpperCase()
      .split(/[\s,]+/)
      .map((t) => t.replace(/[^A-Z0-9.\-]/g, ''))
      .filter(Boolean)
    onScan({
      sector,
      marketCap,
      minStrongBuys: Number(minStrongBuys),
      minUpside: Number(minUpside),
      theme: theme.trim(),
      exclude: ex,
      limit: Number(limit),
    })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13 }}>
        Aggregates names with the highest concentration of <strong style={{ color: 'var(--accent)' }}>Strong Buy</strong> ratings, ranked by consensus depth and upside vs current price.
      </p>

      <div className="field-row">
        <div className="field">
          <label className="label">Sector</label>
          <select value={sector} onChange={(e) => setSector(e.target.value)}>
            <option>any</option>
            <option>Tech</option>
            <option>Semiconductors</option>
            <option>Software</option>
            <option>Biotech</option>
            <option>Healthcare</option>
            <option>Financials</option>
            <option>Energy</option>
            <option>Consumer Discretionary</option>
            <option>Consumer Staples</option>
            <option>Industrials</option>
            <option>Materials</option>
            <option>Utilities</option>
            <option>Real Estate</option>
            <option>Communication</option>
          </select>
        </div>
        <div className="field">
          <label className="label">Market cap</label>
          <select value={marketCap} onChange={(e) => setMarketCap(e.target.value)}>
            <option>any</option>
            <option>mega ($200B+)</option>
            <option>large ($10B-$200B)</option>
            <option>mid ($2B-$10B)</option>
            <option>small ($300M-$2B)</option>
            <option>micro (under $300M)</option>
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label">Min Strong Buys</label>
          <input
            type="number"
            min={1}
            value={minStrongBuys}
            onChange={(e) => setMinStrongBuys(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Min upside %</label>
          <input
            type="number"
            min={0}
            value={minUpside}
            onChange={(e) => setMinUpside(e.target.value)}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label className="label">Theme</label>
          <input
            placeholder="AI infra, GLP-1, nuclear, onshoring..."
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Limit</label>
          <input
            type="number"
            min={3}
            max={25}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label className="label">Exclude tickers</label>
        <input
          placeholder="AAPL, NVDA"
          value={exclude}
          onChange={(e) => setExclude(e.target.value)}
        />
      </div>

      <button className="btn btn-primary" type="submit" disabled={scanning}>
        {scanning ? <><span className="spinner" />Aggregating consensus...</> : 'Run consensus scan'}
      </button>
    </form>
  )
}
