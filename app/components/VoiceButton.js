'use client'

import { useEffect, useRef, useState } from 'react'
import { speak, cancel, isSupported } from '../lib/voice'

export default function VoiceButton({ text, label = 'Listen', size = 'md' }) {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const playingRef = useRef(false)

  useEffect(() => {
    return () => { if (playingRef.current) cancel() }
  }, [])

  if (!isSupported() && typeof window !== 'undefined' && !('speechSynthesis' in window)) {
    return null
  }

  const onClick = async (e) => {
    e?.stopPropagation?.()
    if (playing || loading) {
      cancel()
      setPlaying(false)
      setLoading(false)
      playingRef.current = false
      return
    }
    setLoading(true)
    try {
      await speak(text, {
        onEnd: () => {
          setPlaying(false)
          setLoading(false)
          playingRef.current = false
        },
      })
      setPlaying(true)
      playingRef.current = true
    } catch {
      setPlaying(false)
    } finally {
      setLoading(false)
    }
  }

  const styles = size === 'sm'
    ? { minHeight: 28, padding: '3px 9px', fontSize: 11 }
    : { minHeight: 32, padding: '4px 11px', fontSize: 12 }

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={onClick}
      aria-label={playing ? 'Stop voice playback' : label}
      style={styles}
    >
      {loading ? '… loading' : playing ? '■ Stop' : `▶ ${label}`}
    </button>
  )
}
