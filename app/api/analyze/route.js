import Anthropic from '@anthropic-ai/sdk'
import {
  isConfigured as marketIsConfigured,
  snapshotMany,
  getMarketNews,
  getCompanyNews,
} from '../../lib/marketData'
import { listAll } from '../../lib/store'
import { get as cacheGet, set as cacheSet } from '../../lib/store'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7'
const CACHE_TTL_S = 30 * 60 // 30 minutes — scanners don't need to re-bill on every page reload

const DEFAULT_UNIVERSE = [
  // Mega-cap tech
  'AAPL','MSFT','GOOGL','AMZN','META','NVDA','TSLA','AVGO','ORCL','CRM','ADBE','AMD','NFLX','INTC','QCOM','CSCO','IBM','TXN',
  // Software / cloud
  'PLTR','SNOW','CRWD','PANW','NOW','SHOP','UBER','ABNB','SQ','PYPL','COIN','DDOG','NET','ZS','MDB','TEAM',
  // Semis
  'TSM','ASML','MU','LRCX','AMAT','KLAC','ARM','MRVL','ON','NXPI','SMCI','ANET','CRDO',
  // Healthcare / biotech
  'LLY','UNH','JNJ','PFE','MRK','ABBV','AMGN','TMO','DHR','VRTX','REGN','GILD','ISRG','BSX','BMY',
  // Financials
  'JPM','BAC','GS','MS','BLK','C','WFC','SCHW','V','MA','AXP','SPGI',
  // Consumer
  'WMT','COST','HD','MCD','SBUX','NKE','LULU','TJX','TGT','LOW','BKNG','CMG',
  // Industrial / energy
  'BA','CAT','DE','GE','LMT','RTX','HON','UNP','XOM','CVX','OXY','EOG','SLB','VST','CEG','GEV','NEE','EQT',
  // Comm / media
  'DIS','TMUS','VZ','T','CMCSA','SPOT','ROKU',
  // Picks-and-shovels candidates often hidden
  'ETN','VRT','MOD','APLD','NBIS','IREN','CRWV','EOSE','SNDK','WDC','NTAP',
]

const SHARED_RULES = `Output STRICT JSON only — no prose outside the JSON object.
Pick conviction (1-10) reflects setup quality, not certainty. Be honest. Reject mediocre ideas.
When live snapshot data is provided, anchor entry/target/stop on real prices and analyst targets — do not invent numbers.
When a "Live ranking" block is provided, copy strongBuyCount / totalAnalysts / analystTarget / upsidePct verbatim.
Cite intel item ids in sourceIntelIds when they drive a pick.`

const SYSTEMS = {
  top_picks: `You are Intel Desk, an AI portfolio strategist. Build a tight, conviction-weighted Top Picks list combining: (a) the user's intelligence layer, (b) live market data, (c) analyst consensus signals, (d) your own market knowledge. Mix categories — the list should include a couple undervalued names, 1-2 hidden gems, 1-2 momentum/breakout names, 1-2 sleeper picks-and-shovels plays, and at most one short. 7-10 names. ${SHARED_RULES}`,
  hidden_gems: `You are Intel Desk's hidden-gem hunter. Surface small/mid-cap names the street is sleeping on: under-followed (≤15 analysts), recent positive operational momentum, special situations (spin-offs, recent IPO orphans, post-overhang re-rate setups), or cheap relative to growth. Avoid mega caps. Bias toward names with concentrated insider buying, accelerating revenue, or thesis-changing catalysts within 6 months. ${SHARED_RULES}`,
  undervalued: `You are Intel Desk's deep-value hunter. Find names trading at meaningful discounts to fair value: large discount to mean analyst price target, low EV/EBITDA or P/FCF for the sector, or sum-of-parts dislocations. Prefer setups where the catalyst to close the gap is identifiable (margin recovery, capital return, segment monetization, regulatory clearing). Avoid value traps — flag declining moats explicitly. ${SHARED_RULES}`,
  sleepers: `You are Intel Desk's "picks and shovels" specialist. The user is interested in indirect, non-obvious beneficiaries of secular themes — when there's a gold rush, sell shovels.

For each theme present in the user's intel (or that you identify from live news), DON'T pick the obvious leader. Instead, look UP and DOWN the value chain to find:
- Critical input suppliers the obvious winner depends on (chemicals, components, IP, materials)
- Bottleneck infrastructure that scales whether or not specific winners emerge (power generation, cooling, transmission, water, real estate, networking, fabs)
- Tools / instrumentation companies (the "Levi's of the gold rush")
- Specialty equipment, testing, and certification names
- Royalty / licensing models with asymmetric exposure
- Ancillary service providers with high switching costs
- Foreign listings or ADRs the US market under-prices

For each pick: explicitly state (1) the theme, (2) the obvious/expensive ticker everyone owns, (3) why your sleeper has comparable or better exposure with less crowded ownership, (4) what would have to be wrong for the thesis to break.

7-10 sleeper picks. Quality over quantity. ${SHARED_RULES}`,
  options: `You are Intel Desk's options scanner. Generate concrete options trade ideas given watchlist, capital, and the user's intel.

Think in: IV regime (rich vs cheap), event calendar (earnings, FDA, Fed, product launches), asymmetric R/R (defined-risk longs on cheap IV with catalyst; premium-selling on rich IV in range-bound names), specific strategies (long calls/puts, vertical spreads, iron condors, calendars, diagonals, LEAPS, cash-secured puts on quality names you'd own, covered calls on holdings).

For each idea give: strategy, strikes, expiry (use realistic monthly/weekly cycles), estimated debit/credit, breakeven, max loss, max profit, catalyst & timing, why this strategy over alternatives. ${SHARED_RULES}`,
  consensus: `You are Intel Desk's analyst-consensus aggregator. Surface stocks with the highest concentration of Strong Buy ratings.

When a "Live Strong-Buy ranking" block is provided, treat it as authoritative ground truth and copy strongBuyCount / totalAnalysts / analystTarget / upsidePct verbatim. Use your reasoning ONLY for thesis, catalysts, risks, and your independent take.

Mix mega-caps with under-followed mid-caps where consensus is unusually concentrated. Respect user filters. ${SHARED_RULES}`,

  themes: `You are Intel Desk's theme scout. Read recent market news and identify emerging investable narratives — secular shifts that aren't yet fully priced in but are showing up across multiple data points.

For each theme:
- Name it crisply (3-6 words)
- 2-3 sentence summary of what's shifting and why now
- Map the full value chain — break it into 3-6 layers (e.g., Generation, Transmission, Cooling, Compute) and list 2-4 representative tickers per layer
- Pick 3-5 highest-conviction tickers across the chain (mix of obvious leaders and sleeper picks-and-shovels)
- List 2-4 dated catalysts that would accelerate the theme
- List 2-4 risks / what would invalidate it
- Cite 2-4 specific recent headlines that triggered this theme
- Suggest a "intel body" text — a paragraph the user can save to the intelligence layer for future scans to leverage

Surface 4-7 themes. Avoid generic bucket themes like "AI" or "Energy" — they need to be specific (e.g., "Liquid cooling for AI fabs", "Sovereign LLM build-outs in EU", "GLP-1 supply bottleneck shift to oral formulations"). De-duplicate from themes already represented in the user's intel. Output STRICT JSON only.`,
}

const PICKS_SCHEMA = `{
  "summary": "2-4 sentence synthesis of intel, market posture, and what jumps out",
  "picks": [
    {
      "ticker": "AAPL",
      "company": "Apple Inc.",
      "sector": "Tech",
      "type": "undervalued | hidden_gem | options | momentum | contrarian | short | sleeper",
      "conviction": 7.5,
      "thesis": "1-3 sentence why-now",
      "catalysts": ["...", "..."],
      "risks": ["...", "..."],
      "entry": "$180-185",
      "target": "$240",
      "stop": "$170",
      "upsidePct": 30,
      "timeHorizon": "3-6mo",
      "theme": "AI infra / GLP-1 / etc (sleepers and theme picks only)",
      "obviousAlternative": "the crowded ticker this is a sleeper relative to (sleepers only)",
      "sourceIntelIds": ["uuid"],
      "strongBuyCount": 30,
      "totalAnalysts": 45,
      "analystTarget": "$240",
      "option": {
        "strategy": "long_call | bull_call_spread | cash_secured_put | covered_call | leap_call | iron_condor",
        "strike": 200,
        "expiry": "2026-01-16",
        "premium": 4.20,
        "breakeven": 204.20,
        "maxLoss": "premium paid",
        "rationale": "..."
      }
    }
  ]
}`

const THEMES_SCHEMA = `{
  "summary": "2-3 sentence read of where the market's narrative is shifting",
  "picks": [
    {
      "theme": "Liquid cooling for AI fabs",
      "type": "theme",
      "conviction": 8,
      "summary": "Why this is emerging now (2-3 sentences)",
      "valueChain": [
        { "layer": "Cold plates / loops", "tickers": ["VRT","MOD"] },
        { "layer": "Refrigerants / fluids", "tickers": ["HON","CE"] },
        { "layer": "Power", "tickers": ["ETN","GEV"] }
      ],
      "topPicks": ["VRT","MOD","ETN"],
      "catalysts": ["NVDA earnings 2026-02-25 commentary on liquid-cooled SKUs", "..."],
      "risks": ["Air-cooled efficiency gains close the gap", "..."],
      "newsHeadlines": ["[2026-04-28] Vertiv guides ...", "..."],
      "suggestedIntelBody": "Markdown text to save to the intelligence layer so future scans pick this up..."
    }
  ]
}`

const CONSENSUS_SCHEMA = `{
  "summary": "What the street is loving and where consensus looks crowded vs warranted",
  "picks": [
    {
      "ticker": "MSFT",
      "company": "Microsoft",
      "sector": "Tech",
      "type": "momentum",
      "conviction": 8,
      "strongBuyCount": 42,
      "totalAnalysts": 56,
      "analystTarget": "$520",
      "upsidePct": 18,
      "thesis": "...",
      "catalysts": ["..."],
      "risks": ["..."],
      "timeHorizon": "6-12mo"
    }
  ]
}`

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const candidate = fenced ? fenced[1] : text
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON object found in model output')
  return JSON.parse(candidate.slice(start, end + 1))
}

function formatIntel(items) {
  if (!items?.length) return '(no intelligence layer entries — proceed with live data + your knowledge only)'
  return items.map((it) => {
    const tickers = it.tickers?.length ? `[${it.tickers.join(', ')}]` : '[no ticker]'
    const meta = [
      it.kind && `kind=${it.kind}`,
      it.source && `src=${it.source}`,
      it.conviction != null && `userConv=${it.conviction}/10`,
    ].filter(Boolean).join(' · ')
    const when = new Date(it.createdAt).toISOString()
    return `--- intel id=${it.id} ${tickers} ${meta} at=${when}\n${it.body}`
  }).join('\n\n')
}

function formatSnapshots(snaps) {
  if (!snaps?.length) return '(no live data available)'
  return snaps.map((s) => {
    const q = s.quote, r = s.recommendations, t = s.priceTarget, p = s.profile
    const upside = q?.price && t?.targetMean ? (((t.targetMean - q.price) / q.price) * 100).toFixed(1) : null
    const parts = [`${s.symbol}${p?.name ? ` (${p.name})` : ''}${p?.sector ? ` · ${p.sector}` : ''}`]
    if (q) parts.push(`px=$${q.price?.toFixed?.(2) ?? q.price} (${q.pctChange >= 0 ? '+' : ''}${q.pctChange?.toFixed?.(2) ?? q.pctChange}%)`)
    if (p?.marketCap) parts.push(`mcap=$${(p.marketCap / 1000).toFixed(1)}B`)
    if (r) parts.push(`ratings: SB=${r.strongBuy} B=${r.buy} H=${r.hold} S=${r.sell} SS=${r.strongSell} (n=${r.total})`)
    if (t) parts.push(`target: $${t.targetMean} (n=${t.numAnalysts}${upside ? `, upside=${upside}%` : ''})`)
    return parts.join(' | ')
  }).join('\n')
}

function formatCompanyNews(byTicker) {
  const lines = []
  for (const [tkr, items] of Object.entries(byTicker)) {
    if (!items?.length) continue
    lines.push(`# ${tkr} news`)
    for (const n of items.slice(0, 4)) {
      const when = n.datetime ? new Date(n.datetime).toISOString().slice(0, 10) : ''
      lines.push(`- [${when}] ${n.headline}${n.summary ? ` — ${n.summary.slice(0, 160)}` : ''}`)
    }
  }
  return lines.join('\n') || '(no recent news)'
}

function uniqTickers(...lists) {
  const set = new Set()
  for (const l of lists) if (l) for (const t of l) if (t) set.add(String(t).toUpperCase())
  return [...set]
}

async function gatherLiveContext({ tickers, includeNews = true, marketNewsCategory = null }) {
  if (!marketIsConfigured()) {
    return { snapshots: [], companyNews: {}, marketNews: [], note: 'FINNHUB_API_KEY not configured — live market data disabled.' }
  }
  const out = { snapshots: [], companyNews: {}, marketNews: [], note: null }
  if (tickers.length) {
    try { out.snapshots = await snapshotMany(tickers.slice(0, 25)) }
    catch (e) { out.note = `snapshot failed: ${e.message}` }
  }
  if (includeNews && tickers.length) {
    const newsResults = await Promise.allSettled(
      tickers.slice(0, 8).map((t) => getCompanyNews(t).then((n) => [t, n])),
    )
    for (const r of newsResults) {
      if (r.status === 'fulfilled' && r.value) out.companyNews[r.value[0]] = r.value[1]
    }
  }
  if (marketNewsCategory) {
    try { out.marketNews = await getMarketNews(marketNewsCategory) } catch {}
  }
  return out
}

function liveBlock(ctx) {
  const lines = []
  if (ctx.note) lines.push(`(${ctx.note})`)
  if (ctx.snapshots?.length) {
    lines.push('## Live snapshot (Finnhub real-time):')
    lines.push(formatSnapshots(ctx.snapshots))
  }
  if (Object.keys(ctx.companyNews || {}).length) {
    lines.push('\n## Recent company news:')
    lines.push(formatCompanyNews(ctx.companyNews))
  }
  if (ctx.marketNews?.length) {
    lines.push('\n## Market headlines:')
    for (const n of ctx.marketNews.slice(0, 8)) {
      const when = n.datetime ? new Date(n.datetime).toISOString().slice(0, 10) : ''
      lines.push(`- [${when}] ${n.headline}`)
    }
  }
  return lines.join('\n') || '(no live market context available)'
}

async function buildPrompt(mode, payload, intel) {
  const today = new Date().toISOString().slice(0, 10)
  const intelTickers = (intel || []).flatMap((i) => i.tickers || [])
  const intelText = formatIntel(intel)

  if (mode === 'top_picks') {
    const universe = uniqTickers(intelTickers, DEFAULT_UNIVERSE).slice(0, 25)
    const ctx = await gatherLiveContext({ tickers: universe, includeNews: true, marketNewsCategory: 'general' })
    return `Today: ${today}\n\n${liveBlock(ctx)}\n\n## Intelligence layer (user-curated research):\n${intelText}\n\nProduce 7-10 highest-conviction picks blending intel themes, live data, and your knowledge.\n\nReturn STRICT JSON matching:\n${PICKS_SCHEMA}`
  }

  if (mode === 'hidden_gems') {
    const universe = uniqTickers(intelTickers, DEFAULT_UNIVERSE).slice(0, 25)
    const ctx = await gatherLiveContext({ tickers: universe, includeNews: true })
    return `Today: ${today}\n\n${liveBlock(ctx)}\n\n## Intelligence layer:\n${intelText}\n\nFind 6-10 small/mid-cap hidden gems. Bias toward under-covered names. Most picks should NOT be in the live snapshot universe — surface from your knowledge of the market.\n\nReturn STRICT JSON matching:\n${PICKS_SCHEMA}`
  }

  if (mode === 'undervalued') {
    const universe = uniqTickers(intelTickers, DEFAULT_UNIVERSE).slice(0, 25)
    const ctx = await gatherLiveContext({ tickers: universe, includeNews: false })
    let valueRanking = ''
    if (ctx.snapshots?.length) {
      const ranked = ctx.snapshots
        .filter((s) => s.quote?.price && s.priceTarget?.targetMean)
        .map((s) => ({ s, upside: ((s.priceTarget.targetMean - s.quote.price) / s.quote.price) * 100 }))
        .filter((r) => r.upside >= 15)
        .sort((a, b) => b.upside - a.upside)
        .slice(0, 15)
      if (ranked.length) {
        valueRanking = '## Live discount-to-target ranking (≥15% upside, sorted):\n' +
          ranked.map((r) => `${r.s.symbol} | px=$${r.s.quote.price?.toFixed(2)} | target=$${r.s.priceTarget.targetMean} | upside=${r.upside.toFixed(1)}% | n=${r.s.priceTarget.numAnalysts} | sector=${r.s.profile?.sector || '?'}`).join('\n')
      }
    }
    return `Today: ${today}\n\n${liveBlock(ctx)}\n\n${valueRanking}\n\n## Intelligence layer:\n${intelText}\n\nIdentify 6-10 undervalued names. Use the live ranking as one input but you may add others from your knowledge. Set entry near current price, target near analyst mean, stop ~10% below entry. Flag value traps.\n\nReturn STRICT JSON matching:\n${PICKS_SCHEMA}`
  }

  if (mode === 'sleepers') {
    const universe = uniqTickers(intelTickers, DEFAULT_UNIVERSE).slice(0, 25)
    const ctx = await gatherLiveContext({ tickers: universe, includeNews: true, marketNewsCategory: 'general' })
    return `Today: ${today}\n\n${liveBlock(ctx)}\n\n## Intelligence layer (the user's themes — extract gold-rush opportunities from these):\n${intelText}\n\nFor every theme present in the intel, look up/down the value chain and surface non-obvious beneficiaries. Avoid the names already crowded in the intel itself — find the second-order winners. If the intel mentions NVDA, you should be talking about power, cooling, copper, fabs, optical components, water, REITs, transformers, etc.\n\nReturn STRICT JSON matching:\n${PICKS_SCHEMA}`
  }

  if (mode === 'options') {
    const universe = uniqTickers(payload.watchlist, intelTickers)
    const ctx = await gatherLiveContext({ tickers: universe, includeNews: true })
    return `Today: ${today}\n\n${liveBlock(ctx)}\n\nWatchlist: ${payload.watchlist?.length ? payload.watchlist.join(', ') : '(use intel + market)'}\nCapital: ${payload.capital || 'unspecified'}\nRisk: ${payload.risk || 'defined-risk preferred'}\nStrategies: ${payload.strategies?.length ? payload.strategies.join(', ') : 'any'}\nHorizon: ${payload.horizon || 'any'}\nBias: ${payload.bias || 'neutral'}\nNotes: ${payload.notes || 'none'}\n\n## Intelligence layer:\n${intelText}\n\nReturn STRICT JSON matching:\n${PICKS_SCHEMA}`
  }

  if (mode === 'themes') {
    const ctx = await gatherLiveContext({
      tickers: uniqTickers(intelTickers).slice(0, 15),
      includeNews: true,
      marketNewsCategory: 'general',
    })
    return `Today: ${today}\n\n${liveBlock(ctx)}\n\n## Existing intelligence layer (de-duplicate from these):\n${intelText}\n\nProduce 4-7 distinct emerging themes as described in your system instructions. Each must include a value-chain breakdown and a suggestedIntelBody.\n\nReturn STRICT JSON matching:\n${THEMES_SCHEMA}`
  }

  if (mode === 'consensus') {
    const exclude = new Set((payload.exclude || []).map((s) => s.toUpperCase()))
    const universe = uniqTickers(intelTickers, DEFAULT_UNIVERSE).filter((t) => !exclude.has(t)).slice(0, 25)
    const ctx = await gatherLiveContext({ tickers: universe, includeNews: false })
    let liveRanking = ''
    if (ctx.snapshots?.length) {
      const ranked = ctx.snapshots
        .filter((s) => s.recommendations && s.recommendations.strongBuy >= (Number(payload.minStrongBuys) || 0))
        .map((s) => {
          const sb = s.recommendations.strongBuy
          const total = s.recommendations.total
          const px = s.quote?.price
          const tgt = s.priceTarget?.targetMean
          const upside = px && tgt ? (((tgt - px) / px) * 100) : null
          return { s, sb, total, px, tgt, upside }
        })
        .filter((r) => payload.minUpside ? (r.upside ?? -999) >= Number(payload.minUpside) : true)
        .sort((a, b) => b.sb - a.sb)
        .slice(0, Number(payload.limit) || 12)
      if (ranked.length) {
        liveRanking = '## Live Strong-Buy ranking (Finnhub, verified counts):\n' +
          ranked.map((r) => `${r.s.symbol} | strongBuy=${r.sb}/${r.total} | px=$${r.px?.toFixed?.(2) ?? r.px} | target=$${r.tgt ?? '?'} | upside=${r.upside != null ? r.upside.toFixed(1) + '%' : '?'} | sector=${r.s.profile?.sector || '?'}`).join('\n')
      }
    }
    return `Today: ${today}\n\n${liveBlock(ctx)}\n\n${liveRanking}\n\nFilters: sector=${payload.sector || 'any'} | mcap=${payload.marketCap || 'any'} | minSB=${payload.minStrongBuys || 15} | minUpside=${payload.minUpside || 'any'} | theme=${payload.theme || 'none'} | exclude=${[...exclude].join(', ') || 'none'} | limit=${payload.limit || 12}\n\n## Intelligence layer:\n${intelText}\n\nReturn STRICT JSON matching:\n${CONSENSUS_SCHEMA}`
  }

  throw new Error(`Unknown mode: ${mode}`)
}

function cacheKey(mode, payload, intelHash) {
  return `scan:${mode}:${intelHash}:${JSON.stringify(payload || {})}`
}

function intelDigest(intel) {
  return `${intel.length}:${intel.map((i) => i.id).slice(0, 50).join(',')}`
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not configured.' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const mode = body.mode || 'top_picks'
  const fresh = Boolean(body.fresh)
  const system = SYSTEMS[mode]
  if (!system) return Response.json({ error: `Unknown mode: ${mode}` }, { status: 400 })

  // Always pull intel from the backend store. Client doesn't need to send it.
  const intel = await listAll('intel:v1')
  const ckey = cacheKey(mode, body.payload || {}, intelDigest(intel))

  if (!fresh) {
    const cached = await cacheGet(ckey)
    if (cached) return Response.json({ ...cached, cached: true })
  }

  let userPrompt
  try { userPrompt = await buildPrompt(mode, body.payload || {}, intel) }
  catch (e) { return Response.json({ error: e.message }, { status: 400 }) }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    })
    const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    let parsed
    try { parsed = extractJson(text) }
    catch { return Response.json({ error: 'Model did not return valid JSON', raw: text }, { status: 502 }) }

    const fallbackType = {
      options: 'options',
      sleepers: 'sleeper',
      hidden_gems: 'hidden_gem',
      undervalued: 'undervalued',
      themes: 'theme',
      top_picks: 'top_pick',
      consensus: 'momentum',
    }[mode] || 'undervalued'
    const picks = (parsed.picks || []).map((p) => ({
      id: crypto.randomUUID(),
      ...p,
      type: p.type || fallbackType,
    }))

    const result = {
      mode,
      summary: parsed.summary || '',
      picks,
      generatedAt: Date.now(),
      intelCount: intel.length,
    }
    await cacheSet(ckey, result, { ttl: CACHE_TTL_S })
    return Response.json(result)
  } catch (e) {
    return Response.json({ error: e?.message || 'Anthropic request failed' }, { status: 500 })
  }
}
