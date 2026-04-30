// Daily pre-market scanner warm-up. Triggered by Vercel cron at 13:00 UTC
// (~8am ET, before US market open) Mon-Fri.
//
// What it does:
//   1. Seeds the intel layer with starter themes if it's empty.
//   2. Re-runs every default scanner with fresh=true so the first user
//      of the day gets cached results in <100ms.
//
// Cost (current model + Finnhub free tier):
//   ~$0.20 / day on Anthropic, ~$6 / month. Vercel cron itself is free
//   on Hobby (up to 2 cron jobs).
//
// Auth: Vercel automatically attaches the CRON_SECRET as a Bearer header
// when invoking. Reject anything without it in production.

import { listAll } from '../../../lib/store'

export const runtime = 'nodejs'
export const maxDuration = 300

const SCANNERS = ['top_picks', 'hidden_gems', 'undervalued', 'sleepers', 'consensus']

function authorized(req) {
  if (!process.env.CRON_SECRET) return true
  const auth = req.headers.get('authorization') || ''
  return auth === `Bearer ${process.env.CRON_SECRET}`
}

async function seedIfEmpty(origin) {
  const items = await listAll('intel:v1')
  if (items.length > 0) return { seeded: false, count: items.length }
  const res = await fetch(`${origin}/api/intel/seed`, { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  return { seeded: true, ...data }
}

export async function GET(req) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const origin = `${url.protocol}//${url.host}`

  const seedResult = await seedIfEmpty(origin)
  const results = {}

  for (const mode of SCANNERS) {
    const t0 = Date.now()
    try {
      const res = await fetch(`${origin}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, fresh: true }),
      })
      const data = await res.json()
      results[mode] = {
        ok: res.ok,
        ms: Date.now() - t0,
        picks: data.picks?.length ?? 0,
        error: data.error || null,
      }
    } catch (e) {
      results[mode] = { ok: false, ms: Date.now() - t0, error: e.message }
    }
  }

  return Response.json({
    ranAt: new Date().toISOString(),
    seed: seedResult,
    scanners: results,
  })
}
