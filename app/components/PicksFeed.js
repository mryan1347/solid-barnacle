'use client'

import { useState, useMemo } from 'react'
import PickCard from './PickCard'

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'undervalued', label: 'Undervalued' },
  { key: 'hidden_gem', label: 'Hidden Gems' },
  { key: 'options', label: 'Options' },
  { key: 'momentum', label: 'Momentum' },
  { key: 'contrarian', label: 'Contrarian' },
  { key: 'short', label: 'Shorts' },
]

export default function PicksFeed({ picks, summary, generatedAt }) {
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    const list = filter === 'all' ? picks : picks.filter((p) => p.type === filter)
    return [...list].sort((a, b) => (b.conviction || 0) - (a.conviction || 0))
  }, [picks, filter])

  if (!picks?.length) {
    return (
      <div className="empty" style={{ padding: '60px 20px' }}>
        No picks yet. Drop intel and hit <strong>Generate picks</strong>.
      </div>
    )
  }

  return (
    <div>
      {summary && (
        <div className="summary">
          <div className="summary-label">
            Synthesis {generatedAt && `· ${new Date(generatedAt).toLocaleString()}`}
          </div>
          {summary}
        </div>
      )}

      <div className="filter-bar">
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? picks.length : picks.filter((p) => p.type === f.key).length
          if (f.key !== 'all' && count === 0) return null
          return (
            <button
              key={f.key}
              type="button"
              className={`filter-pill ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span style={{ opacity: 0.6 }}>· {count}</span>
            </button>
          )
        })}
      </div>

      <div className="picks">
        {filtered.map((p, i) => <PickCard key={p.id || i} pick={p} />)}
      </div>
    </div>
  )
}
