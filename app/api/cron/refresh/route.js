// Daily pre-market scanner warm-up. Triggered by Vercel cron at 13:00 UTC
// (~8am ET, before US market open) Mon-Fri.
//
// Auth: in production, requires either CRON_SECRET (Vercel cron sets this
// automatically) or APP_PASSWORD. Fails closed by default in production —
// no quiet fallback that lets a public hit drain the wallet.

import { listAll } from '../../../lib/store'
import { isCronAuthorized } from '../../../lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 300

const SCANNERS = ['top_picks', 'hidden_gems', 'undervalued', 'sleepers', 'consensus', 'themes']

function authHeaders() {
  const h = { 'Content-Type': 'application/json' }
  if (process.env.APP_PASSWORD) h['x-app-password'] = process.env.APP_PASSWORD
  return h
}

async function seedIfEmpty(origin) {
  const items = await listAll('intel:v1')
  if (items.length > 0) return { seeded: false, count: items.length }
  const res = await fetch(`${origin}/api/intel/seed`, { method: 'POST', headers: authHeaders() })
  const data = await res.json().catch(() => ({}))
  return { seeded: true, ...data }
}

export async function GET(req) {
  // Fail closed in production unless properly authorized.
  const inProd = (process.env.VERCEL_ENV || '') === 'production'
  if (!isCronAuthorized(req)) {
    if (inProd) return Response.json({ error: 'unauthorized' }, { status: 401 })
    if (process.env.CRON_SECRET || process.env.APP_PASSWORD) {
      return Response.json({ error: 'unauthorized' }, { status: 401 })
    }
    // Dev mode with no secrets configured — allow.
  }

  const url = new URL(req.url)
  const origin = `${url.protocol}//${url.host}`

  const seedResult = await seedIfEmpty(origin)
  const results = {}

  for (const mode of SCANNERS) {
    const t0 = Date.now()
    try {
      const res = await fetch(`${origin}/api/analyze`, {
        method: 'POST',
        headers: authHeaders(),
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
