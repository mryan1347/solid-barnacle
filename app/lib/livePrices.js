'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from './api'

// Module-scoped cache of live quotes shared across all components.
// Refreshes every 60s as long as at least one subscriber is mounted.

const cache = new Map() // ticker -> { quote, fetchedAt }
const subscribers = new Set()
const wanted = new Set() // union of all tickers any subscriber wants
let timer = null
let inFlight = null

function notify() {
  for (const s of subscribers) s()
}

async function refresh() {
  if (inFlight) return inFlight
  const list = [...wanted]
  if (!list.length) return
  inFlight = (async () => {
    try {
      const url = `/api/market?action=snapshotMany&symbols=${encodeURIComponent(list.join(','))}`
      const res = await apiFetch(url)
      if (!res.ok) return
      const data = await res.json()
      const now = Date.now()
      for (const s of data.data || []) {
        if (s?.symbol) cache.set(s.symbol, { quote: s.quote, profile: s.profile, fetchedAt: now })
      }
      notify()
    } catch {}
  })()
  await inFlight
  inFlight = null
}

function ensureTimer() {
  if (timer) return
  timer = setInterval(refresh, 60000)
}

function maybeStopTimer() {
  if (subscribers.size === 0 && timer) {
    clearInterval(timer)
    timer = null
  }
}

export function useLivePrices(tickers) {
  const [, force] = useState(0)

  useEffect(() => {
    const sub = () => force((n) => n + 1)
    subscribers.add(sub)
    ensureTimer()
    return () => {
      subscribers.delete(sub)
      maybeStopTimer()
    }
  }, [])

  const tickerKey = tickers.join(',')
  useEffect(() => {
    if (!tickers.length) return
    let added = false
    for (const t of tickers) {
      if (!wanted.has(t)) { wanted.add(t); added = true }
    }
    // Fire immediate refresh for any ticker we don't have yet.
    const stale = tickers.filter((t) => {
      const c = cache.get(t)
      return !c || Date.now() - c.fetchedAt > 60000
    })
    if (added || stale.length) refresh()
  }, [tickerKey])

  const map = {}
  for (const t of tickers) {
    const entry = cache.get(t)
    if (entry?.quote) map[t] = entry.quote
  }
  return map
}
