// Seeds the intelligence layer with curated research items. Idempotent
// per seed via the `seedKey` field — re-running only adds items whose
// seedKey isn't already present, never duplicates.
//
// Triggered:
//   - Daily cron (/api/cron/refresh) when the layer is being warmed
//   - Manually by the user visiting /api/intel/seed in a browser (GET)
//   - From a future "Sync seeds" button (POST)

import { listAdd, listAll } from '../../../lib/store'
import { isAuthorized, unauthorized } from '../../../lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KEY = 'intel:v1'

const SEEDS = [
  {
    seedKey: 'datacenter-stack-2026-04',
    kind: 'thesis',
    source: '@SergeyCYW data center stack',
    conviction: 8,
    tickers: ['NVDA','AMD','AVGO','INTC','SMCI','DELL','HPE','VRT','ETN','MOD','SNDK','MU','WDC','ANET','CSCO','MRVL','CRDO','CIEN','NOK','NBIS','IREN','CRWV','APLD','CEG','NEE','EOSE','GEV','EQT','VST'],
    body: `AI infrastructure thematic — full data center stack. Compute is shifting from chips to full-stack systems where compute, memory, networking, power, and cooling all scale together.

- Compute Silicon: NVDA, AMD, AVGO, INTC
- Server OEMs & Solutions: SMCI, DELL, HPE, VRT (Vertiv), ETN (Eaton), MOD (Modine)
- Memory & Storage: SNDK, SK Hynix, MU, WDC, P (Pure Storage), Samsung, NTAP
- Networking & Connectivity: ANET, CSCO, MRVL, CRDO, CIEN, NOK
- Neoclouds & Physical Infrastructure: NBIS, IREN, CRWV, APLD
- Energy: CEG, NEE, EOSE, GEV, EQT, VST

The picks-and-shovels framing: when there's a gold rush, sell shovels. The obvious winners (NVDA) are crowded — look up the stack to power, cooling, transmission, fab equipment, copper, water, and specialty components.`,
  },
  {
    seedKey: 'bofa-semis-2026-13t',
    kind: 'research',
    source: 'BofA — Vivek Arya (Apr 2026)',
    conviction: 8,
    tickers: ['NVDA','AVGO','MRVL','AMD','AMAT','LRCX','CDNS','SNPS','KLAC','ADI'],
    body: `BofA / Vivek Arya hiked 2026 global semiconductor revenue forecast to $1.3T — a $300B leap from his prior estimate four months ago, representing a 30% YoY surge that pushes the sector past $1T in annual sales for the first time. He's calling for the AI-driven half of the market to keep eating: BofA models +43% YoY in compute & storage vs. -9% in wireless comms.

The 8 names he's putting forward as 2026 leaders (originally 6, expanded):
1. NVDA — AI compute, ~75% market share
2. AVGO — custom AI silicon + networking, 70-75% share in key segments
3. MRVL — custom ASIC, optical, networking
4. AMD — CPU + accelerator share gains, MI series ramp
5. AMAT — wafer fab equip; etch/dep "could expand to 42% of share" up 3% since 2023
6. LRCX — etch leadership for HBM, advanced packaging, leading-edge logic (3nm/2nm)
7. CDNS — EDA / chip design tools (compounder)
8. SNPS — EDA / chip design tools (compounder)

(Other names also flagged in BofA writeups: KLAC, ADI.)

Macro frame: BofA WFE forecast 10%/14% YoY in CY26/CY27 to $131B/$150B, driven by HBM, higher-layer-count NAND, leading-edge logic, advanced packaging. AI data center TAM $1.2T+ by 2030 (38% CAGR). Arya: industry is at the "midpoint" of a decade-long transformation led by NVDA + AVGO.

Use this as a high-conviction overlay for Top Picks, Sleepers (look up/down the value chain from these), and Strong Buy scans.`,
  },
]

async function applySeeds() {
  const existing = await listAll(KEY)
  const existingKeys = new Set(existing.map((it) => it.seedKey).filter(Boolean))
  const existingSources = new Set(existing.map((it) => it.source).filter(Boolean))
  const added = []
  const skipped = []
  for (const seed of SEEDS) {
    if (existingKeys.has(seed.seedKey) || existingSources.has(seed.source)) {
      skipped.push(seed.seedKey)
      continue
    }
    const item = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      createdAt: Date.now(),
      ...seed,
    }
    await listAdd(KEY, item)
    added.push({ seedKey: seed.seedKey, id: item.id })
  }
  return { added, skipped, totalSeeds: SEEDS.length, layerSize: existing.length + added.length }
}

export async function GET(req) {
  if (!isAuthorized(req)) return unauthorized()
  const result = await applySeeds()
  return Response.json(result)
}

export async function POST(req) {
  if (!isAuthorized(req)) return unauthorized()
  const result = await applySeeds()
  return Response.json(result)
}
