'use client'

import { useState } from 'react'

const KINDS = [
  { value: 'news', label: 'News' },
  { value: 'research', label: 'Research' },
  { value: 'thesis', label: 'Thesis' },
  { value: 'rumor', label: 'Rumor' },
  { value: 'insider', label: 'Insider' },
  { value: 'macro', label: 'Macro' },
  { value: 'earnings', label: 'Earnings' },
  { value: 'technical', label: 'Technical' },
]

export default function IntelInput({ onAdd }) {
  const [body, setBody] = useState('')
  const [tickers, setTickers] = useState('')
  const [kind, setKind] = useState('news')
  const [source, setSource] = useState('')
  const [conviction, setConviction] = useState(5)

  const submit = (e) => {
    e?.preventDefault()
    const text = body.trim()
    if (!text) return
    const tks = tickers
      .toUpperCase()
      .split(/[\s,]+/)
      .map((t) => t.replace(/[^A-Z0-9.\-]/g, ''))
      .filter(Boolean)
    onAdd({
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      kind,
      tickers: tks,
      source: source.trim(),
      conviction: Number(conviction),
      body: text,
    })
    setBody('')
    setTickers('')
    setSource('')
  }

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
  }

  return (
    <form className="field" onSubmit={submit} onKeyDown={onKeyDown}>
      <div className="section-title">
        <span>Drop Intelligence</span>
        <span className="kbd">⌘ + ↵</span>
      </div>

      <textarea
        rows={5}
        placeholder="Paste a news clip, earnings excerpt, scuttlebutt, a thesis you have on $TICKER, an insider observation, a chart pattern, a macro view..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="field-row">
        <div className="field">
          <label className="label">Tickers</label>
          <input
            placeholder="AAPL, MSFT, $NVDA"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="label">Type</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
        </div>
      </div>

      <details className="advanced">
        <summary>+ source · conviction</summary>
        <div className="field-row">
          <div className="field">
            <label className="label">Source</label>
            <input
              placeholder="WSJ / 10-Q / X / gut"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label">My conviction (1-10)</label>
            <input
              type="number"
              min={1}
              max={10}
              value={conviction}
              onChange={(e) => setConviction(e.target.value)}
            />
          </div>
        </div>
      </details>

      <button className="btn btn-primary" type="submit" disabled={!body.trim()}>
        Add to intel
      </button>
    </form>
  )
}
