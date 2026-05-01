'use client'

import { useEffect, useRef, useState } from 'react'
import { speak, cancel, isSupported } from '../lib/voice'

export default function VoiceButton({ text, label = 'Listen', size = 'md', stopOnUnmount = true }) {
  const [playing, setPlaying] = useState(false)
  const utterRef = useRef(null)

  useEffect(() => {
    return () => { if (stopOnUnmount && utterRef.current) cancel() }
  }, [stopOnUnmount])

  if (!isSupported()) return null

  const onClick = (e) => {
    e?.stopPropagation?.()
    if (playing) {
      cancel()
      setPlaying(false)
      utterRef.current = null
      return
    }
    const u = speak(text, { onEnd: () => { setPlaying(false); utterRef.current = null } })
    if (!u) return
    utterRef.current = u
    setPlaying(true)
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
      {playing ? '■ Stop' : `▶ ${label}`}
    </button>
  )
}
