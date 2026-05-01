'use client'

// Web Speech API wrapper. Uses the device's system voices — free,
// no API call, works on iOS Safari with high-quality voices.

export function isSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let queueId = 0

export function cancel() {
  if (!isSupported()) return
  queueId++ // invalidate any in-flight queue
  window.speechSynthesis.cancel()
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices() || []
  // Prefer high-quality English voices that exist on iOS / macOS / Android / Win
  const preferred = [
    'Samantha', 'Alex', 'Karen', 'Daniel',
    'Google US English', 'Google UK English Female',
    'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Guy',
  ]
  for (const name of preferred) {
    const v = voices.find((x) => x.name?.includes(name))
    if (v) return v
  }
  return voices.find((v) => v.lang?.startsWith('en')) || null
}

function utterance(text) {
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.05
  u.pitch = 1.0
  u.volume = 1.0
  const v = pickVoice()
  if (v) u.voice = v
  return u
}

export function speak(text, { onEnd } = {}) {
  if (!isSupported() || !text) return null
  cancel()
  const u = utterance(text)
  if (onEnd) {
    u.onend = onEnd
    u.onerror = onEnd
  }
  window.speechSynthesis.speak(u)
  return u
}

// Queue multiple texts in sequence. Returns a `stop()` fn that
// stops the current playback AND prevents queued items from starting.
export function speakSequence(texts, { onProgress, onDone } = {}) {
  if (!isSupported() || !texts?.length) {
    onDone?.()
    return () => {}
  }
  cancel()
  const myId = ++queueId
  let i = 0

  const next = () => {
    if (queueId !== myId) return // canceled
    if (i >= texts.length) { onDone?.(); return }
    const idx = i++
    onProgress?.(idx, texts.length)
    const u = utterance(texts[idx])
    u.onend = () => { if (queueId === myId) next() }
    u.onerror = () => { if (queueId === myId) next() }
    window.speechSynthesis.speak(u)
  }

  next()
  return () => { queueId++; window.speechSynthesis.cancel() }
}

function humanType(t) {
  return ({
    undervalued: 'Undervalued',
    hidden_gem: 'Hidden gem',
    options: 'Options play',
    sleeper: 'Sleeper',
    momentum: 'Momentum',
    contrarian: 'Contrarian',
    short: 'Short',
    top_pick: 'Top pick',
    theme: 'Theme',
  })[t] || t
}

export function pickScript(p) {
  const lines = []
  if (p.ticker) lines.push(`${p.ticker}.`)
  if (p.company) lines.push(`${p.company}.`)
  if (p.type) lines.push(`${humanType(p.type)}.`)
  if (p.conviction != null) lines.push(`Conviction ${Number(p.conviction).toFixed(0)} out of ten.`)
  if (p.thesis) lines.push(p.thesis)
  if (p.catalysts?.length) lines.push(`Catalysts. ${p.catalysts.slice(0, 2).join('. ')}.`)
  if (p.risks?.length) lines.push(`Risks. ${p.risks.slice(0, 2).join('. ')}.`)
  if (p.entry) lines.push(`Entry ${p.entry}.`)
  if (p.target) lines.push(`Target ${p.target}.`)
  if (p.upsidePct != null) lines.push(`${Number(p.upsidePct).toFixed(0)} percent upside.`)
  if (p.option?.strategy) {
    lines.push(`Options: ${String(p.option.strategy).replace(/_/g, ' ')}${p.option.strike ? `, strike ${p.option.strike}` : ''}${p.option.expiry ? `, expiry ${p.option.expiry}` : ''}.`)
  }
  return lines.join(' ')
}

export function themeScript(t) {
  const lines = []
  if (t.theme) lines.push(`${t.theme}.`)
  if (t.summary) lines.push(t.summary)
  if (t.topPicks?.length) lines.push(`Top picks: ${t.topPicks.slice(0, 5).join(', ')}.`)
  if (t.catalysts?.length) lines.push(`Top catalyst. ${t.catalysts[0]}.`)
  if (t.risks?.length) lines.push(`Top risk. ${t.risks[0]}.`)
  return lines.join(' ')
}
