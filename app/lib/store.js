// Backend store with graceful fallback chain:
//   1. Vercel KV (Redis) when KV_REST_API_URL + KV_REST_API_TOKEN are present
//   2. In-memory (per warm function instance — non-durable, but ok for caching)
//
// Used for: persistent intel layer, scanner result caching.

import { kv } from '@vercel/kv'

const memStore = new Map()
const memSets = new Map()

function kvConfigured() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

export function backend() {
  return kvConfigured() ? 'vercel-kv' : 'memory'
}

export async function get(key) {
  if (kvConfigured()) {
    try { return await kv.get(key) } catch { return memStore.get(key) ?? null }
  }
  return memStore.get(key) ?? null
}

export async function set(key, value, opts = {}) {
  if (kvConfigured()) {
    try {
      if (opts.ttl) await kv.set(key, value, { ex: opts.ttl })
      else await kv.set(key, value)
      return
    } catch {}
  }
  memStore.set(key, value)
  if (opts.ttl) {
    setTimeout(() => memStore.delete(key), opts.ttl * 1000).unref?.()
  }
}

export async function del(key) {
  if (kvConfigured()) { try { await kv.del(key) } catch {} }
  memStore.delete(key)
}

// Sorted set helpers for the intel layer (newest-first).
export async function listAdd(setKey, item) {
  if (kvConfigured()) {
    try {
      await kv.zadd(setKey, { score: Date.now(), member: JSON.stringify(item) })
      return
    } catch {}
  }
  if (!memSets.has(setKey)) memSets.set(setKey, [])
  memSets.get(setKey).unshift({ score: Date.now(), item })
}

export async function listAll(setKey, limit = 200) {
  if (kvConfigured()) {
    try {
      const raw = await kv.zrange(setKey, 0, limit - 1, { rev: true })
      return raw.map((v) => {
        if (typeof v === 'string') {
          try { return JSON.parse(v) } catch { return null }
        }
        return v
      }).filter(Boolean)
    } catch {}
  }
  return (memSets.get(setKey) || []).slice(0, limit).map((e) => e.item)
}

export async function listRemove(setKey, predicate) {
  if (kvConfigured()) {
    try {
      const raw = await kv.zrange(setKey, 0, -1)
      for (const v of raw) {
        let parsed = v
        if (typeof v === 'string') { try { parsed = JSON.parse(v) } catch {} }
        if (predicate(parsed)) {
          await kv.zrem(setKey, typeof v === 'string' ? v : JSON.stringify(v))
        }
      }
      return
    } catch {}
  }
  if (memSets.has(setKey)) {
    memSets.set(setKey, memSets.get(setKey).filter((e) => !predicate(e.item)))
  }
}

export async function listClear(setKey) {
  if (kvConfigured()) { try { await kv.del(setKey) } catch {} }
  memSets.delete(setKey)
}
