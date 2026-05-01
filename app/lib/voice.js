'use client'

import { apiFetch } from './api'

// Two-tier TTS:
//   1. Studio (ElevenLabs / OpenAI) when configured server-side — fetches MP3
//      via /api/tts and plays through an Audio element.
//   2. System (Web Speech API) as fallback — runs entirely on-device.
//
// `speak(text)` and `speakSequence([texts])` pick the best available tier
// transparently. Caller doesn't need to know which one is running.

let studioMode = null // null | true | false (lazy probed)
let studioMeta = null // { provider, elevenVoiceId, ... } from /api/tts GET
let queueId = 0
let currentSystemUtter = null
let currentStudioAudio = null

function isBrowser() { return typeof window !== 'undefined' }

export function isSupported() {
  if (!isBrowser()) return false
  return studioMode === true || ('speechSynthesis' in window)
}

async function probeStudio() {
  if (studioMode !== null) return studioMode
  try {
    const res = await fetch('/api/tts')
    const d = await res.json()
    studioMode = Boolean(d.provider)
    studioMeta = d
  } catch {
    studioMode = false
  }
  return studioMode
}

export async function getProvider() {
  await probeStudio()
  if (studioMode) return studioMeta?.provider || 'studio'
  if (isBrowser() && 'speechSynthesis' in window) return 'system'
  return null
}

// ---- system voice (fallback) ----
function pickSystemVoice() {
  const voices = window.speechSynthesis.getVoices() || []
  const preferred = ['Samantha', 'Alex', 'Karen', 'Daniel', 'Google US English', 'Microsoft Aria', 'Microsoft Jenny']
  for (const name of preferred) {
    const v = voices.find((x) => x.name?.includes(name))
    if (v) return v
  }
  return voices.find((v) => v.lang?.startsWith('en')) || null
}

function buildSystemUtter(text) {
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.05; u.pitch = 1.0; u.volume = 1.0
  const v = pickSystemVoice()
  if (v) u.voice = v
  return u
}

function playSystem(text, onEnd) {
  const u = buildSystemUtter(text)
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd }
  currentSystemUtter = u
  window.speechSynthesis.speak(u)
  return u
}

// ---- studio (ElevenLabs / OpenAI) ----
async function fetchStudioBlob(text) {
  const res = await apiFetch('/api/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    let msg = `tts ${res.status}`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch {}
    throw new Error(msg)
  }
  return res.blob()
}

async function playStudio(text, onEnd) {
  const blob = await fetchStudioBlob(text)
  const url = URL.createObjectURL(blob)
  const audio = new Audio(url)
  currentStudioAudio = audio
  const cleanup = () => {
    URL.revokeObjectURL(url)
    if (currentStudioAudio === audio) currentStudioAudio = null
  }
  audio.onended = () => { cleanup(); onEnd?.() }
  audio.onerror = () => { cleanup(); onEnd?.() }
  await audio.play()
  return audio
}

// ---- public API ----
export function cancel() {
  queueId++
  if (isBrowser() && window.speechSynthesis) window.speechSynthesis.cancel()
  currentSystemUtter = null
  if (currentStudioAudio) {
    try { currentStudioAudio.pause() } catch {}
    currentStudioAudio = null
  }
}

export async function speak(text, opts = {}) {
  if (!text || !isBrowser()) return null
  cancel()
  const provider = await getProvider()
  if (provider === 'elevenlabs' || provider === 'openai' || provider === 'studio') {
    try { return await playStudio(text, opts.onEnd) }
    catch (e) {
      // Fallback if studio errored mid-flight.
      if ('speechSynthesis' in window) return playSystem(text, opts.onEnd)
      throw e
    }
  }
  if (provider === 'system') return playSystem(text, opts.onEnd)
  return null
}

// Sequence: returns a `stop()` function that cancels playback + queue.
export function speakSequence(texts, { onProgress, onDone } = {}) {
  if (!isBrowser() || !texts?.length) { onDone?.(); return () => {} }
  const myId = ++queueId
  let stopped = false

  ;(async () => {
    const provider = await getProvider()
    if (queueId !== myId) return

    const studio = provider === 'elevenlabs' || provider === 'openai' || provider === 'studio'

    if (studio) {
      // Pre-fetch one blob ahead while the previous plays — keeps audio gapless.
      let nextBlobPromise = fetchStudioBlob(texts[0]).catch(() => null)
      for (let i = 0; i < texts.length; i++) {
        if (stopped || queueId !== myId) break
        onProgress?.(i, texts.length)
        const blob = await nextBlobPromise
        // Kick off pre-fetch for the next one.
        nextBlobPromise = i + 1 < texts.length
          ? fetchStudioBlob(texts[i + 1]).catch(() => null)
          : Promise.resolve(null)
        if (!blob || stopped || queueId !== myId) continue
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        currentStudioAudio = audio
        await new Promise((resolve) => {
          audio.onended = () => { URL.revokeObjectURL(url); resolve() }
          audio.onerror = () => { URL.revokeObjectURL(url); resolve() }
          audio.play().catch(resolve)
        })
        if (currentStudioAudio === audio) currentStudioAudio = null
      }
    } else if (provider === 'system') {
      for (let i = 0; i < texts.length; i++) {
        if (stopped || queueId !== myId) break
        onProgress?.(i, texts.length)
        await new Promise((resolve) => {
          const u = buildSystemUtter(texts[i])
          u.onend = resolve; u.onerror = resolve
          currentSystemUtter = u
          window.speechSynthesis.speak(u)
        })
      }
    }

    if (!stopped && queueId === myId) onDone?.()
  })()

  return () => { stopped = true; cancel() }
}

// ---- script builders (unchanged) ----
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
