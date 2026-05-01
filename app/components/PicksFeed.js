'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import PickCard from './PickCard'
import { speakSequence, cancel as cancelVoice, isSupported as voiceSupported, pickScript } from '../lib/voice'

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
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState({ idx: 0, total: 0 })
  const stopRef = useRef(null)

  const filtered = useMemo(() => {
    const list = filter === 'all' ? picks : picks.filter((p) => p.type === filter)
    return [...list].sort((a, b) => (b.conviction || 0) - (a.conviction || 0))
  }, [picks, filter])

  useEffect(() => () => { if (stopRef.current) stopRef.current() }, [])

  const playAll = () => {
    if (playing) {
      stopRef.current?.()
      stopRef.current = null
      setPlaying(false)
      return
    }
    if (!voiceSupported() || !filtered.length) return
    setPlaying(true)
    setProgress({ idx: 0, total: filtered.length })
    const stop = speakSequence(
      filtered.map((p) => pickScript(p)),
      {
        onProgress: (i, total) => setProgress({ idx: i + 1, total }),
        onDone: () => { setPlaying(false); stopRef.current = null },
      },
    )
    stopRef.current = stop
  }

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

      <div className="filter-bar" style={{ alignItems: 'center' }}>
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
        {voiceSupported() && filtered.length > 0 && (
          <button
            type="button"
            className={`filter-pill ${playing ? 'active' : ''}`}
            onClick={playAll}
            style={{ marginLeft: 'auto' }}
            aria-label={playing ? 'Stop playback' : 'Listen to all picks'}
          >
            {playing
              ? `■ Stop · ${progress.idx}/${progress.total}`
              : `▶ Play all · ${filtered.length}`}
          </button>
        )}
      </div>

      <div className="picks">
        {filtered.map((p, i) => <PickCard key={p.id || i} pick={p} />)}
      </div>
    </div>
  )
}
