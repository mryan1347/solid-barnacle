// Seeds the intelligence layer with starter themes if it's empty. Called
// automatically by the daily cron warm-up, and idempotent — re-running
// against a non-empty layer is a no-op.

import { listAdd, listAll } from '../../../lib/store'

export const runtime = 'nodejs'

const KEY = 'intel:v1'

const SEEDS = [
  {
    kind: 'thesis',
    source: '@SergeyCYW data center stack',
    conviction: 8,
    tickers: ['NVDA','AMD','AVGO','INTC','SMCI','DELL','HPE','VRT','ETN','MOD','SNDK','MU','WDC','ANET','CSCO','MRVL','CRDO','CIEN','NOK','NBIS','IREN','CRWV','APLD','CEG','NEE','EOSE','GEV','EQT','VST'],
    body: `AI infrastructure thematic — full data center stack. Compute is shifting from chips to full-stack systems where compute, memory, networking, power, and cooling all scale together. Use this map to find non-obvious beneficiaries:

- Compute Silicon: NVDA, AMD, AVGO, INTC
- Server OEMs & Solutions: SMCI, DELL, HPE, VRT (Vertiv), ETN (Eaton), MOD (Modine)
- Memory & Storage: SNDK, SK Hynix, MU, WDC, P (Pure Storage), Samsung, NTAP
- Networking & Connectivity: ANET, CSCO, MRVL, CRDO, CIEN, NOK
- Neoclouds & Physical Infrastructure: NBIS, IREN, CRWV, APLD
- Energy: CEG, NEE, EOSE, GEV, EQT, VST

The picks-and-shovels framing: when there's a gold rush, sell shovels. The obvious winners (NVDA) are crowded — look up the stack to power, cooling, transmission, fab equipment, copper, water, and specialty components.`,
  },
]

export async function POST() {
  const existing = await listAll(KEY)
  if (existing.length > 0) {
    return Response.json({ skipped: true, reason: 'intel layer not empty', count: existing.length })
  }
  const added = []
  for (const seed of SEEDS) {
    const item = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      createdAt: Date.now(),
      ...seed,
    }
    await listAdd(KEY, item)
    added.push(item.id)
  }
  return Response.json({ seeded: added.length, ids: added })
}
