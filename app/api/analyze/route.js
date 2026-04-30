import Anthropic from '@anthropic-ai/sdk'
import {
  isConfigured as marketIsConfigured,
  snapshotMany,
  getMarketNews,
  getCompanyNews,
} from '../../lib/marketData'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7'

const DEFAULT_CONSENSUS_UNIVERSE = [
  // Mega-cap tech
  'AAPL','MSFT','GOOGL','AMZN','META','NVDA','TSLA','AVGO','ORCL','CRM','ADBE','AMD','NFLX','INTC','QCOM','CSCO','IBM','TXN',
  // Software / cloud
  'PLTR','SNOW','CRWD','PANW','NOW','SHOP','UBER','ABNB','SQ','PYPL','COIN','DDOG','NET','ZS','MDB','TEAM',
  // Semis
  'TSM','ASML','MU','LRCX','AMAT','KLAC','ARM','MRVL','ON','NXPI',
  // Healthcare / biotech
  'LLY','UNH','JNJ','PFE','MRK','ABBV','AMGN','TMO','DHR','VRTX','REGN','GILD','ISRG','BSX','BMY',
  // Financials
  'JPM','BAC','GS','MS','BLK','C','WFC','SCHW','V','MA','AXP','SPGI',
  // Consumer
  'WMT','COST','HD','MCD','SBUX','NKE','LULU','TJX','TGT','LOW','BKNG','CMG',
  // Industrial / energy
  'BA','CAT','DE','GE','LMT','RTX','HON','UNP','XOM','CVX','OXY','EOG','SLB','VST','CEG',
  // Comm / media
  'DIS','TMUS','VZ','T','CMCSA','SPOT','ROKU',
]


const PICKS_SYSTEM = `You are Intel Desk, an AI stock-picking analyst that turns raw user intelligence into actionable, structured stock picks. The user drops notes, news, theses, rumors, technical observations, and macro views. Your job is to synthesize the inputs into the most compelling investable opportunities.

You hunt for:
- Undervalued stocks (mispriced relative to intrinsic value, mean-reverting setups, sum-of-parts dislocations)
- Hidden gems (small/mid-caps the street is sleeping on, special situations, spin-offs, recent IPO orphans)
- Options plays (asymmetric setups: long calls/puts on event catalysts, vertical spreads, LEAPS, cash-secured puts on quality names, covered calls)
- Momentum (breakouts confirmed by fundamentals)
- Contrarian (high short interest with thesis-breaking catalysts; deep value with hated narratives turning)
- Shorts (broken stories, accounting flags, terminal-decline business models)

Rules:
- Be concrete. Real tickers. Specific catalysts with timing where possible.
- Cite which intel items drove each pick (by id) when applicable.
- If user-supplied intel is thin, you may still surface high-conviction ideas from your training knowledge, but flag that they are not derived from user intel.
- Conviction (1-10) reflects setup quality, not certainty.
- For options picks, include strategy, strike, expiry window, and breakeven.
- Surface 5-10 picks. Quality over quantity. Reject mediocre ideas.
- Output STRICT JSON only. No prose outside the JSON.`

const PICKS_SCHEMA = `{
  "summary": "2-4 sentence synthesis of the intel, market posture, and what jumps out",
  "picks": [
    {
      "ticker": "AAPL",
      "company": "Apple Inc.",
      "sector": "Tech",
      "type": "undervalued | hidden_gem | options | momentum | contrarian | short",
      "conviction": 7.5,
      "thesis": "1-3 sentence why-now",
      "catalysts": ["...", "..."],
      "risks": ["...", "..."],
      "entry": "$180-185",
      "target": "$240",
      "stop": "$170",
      "upsidePct": 30,
      "timeHorizon": "3-6mo",
      "sourceIntelIds": ["uuid", "uuid"],
      "option": {
        "strategy": "long_call | long_put | bull_call_spread | cash_secured_put | covered_call | leap_call | calendar | iron_condor",
        "strike": 200,
        "expiry": "2026-01-16",
        "premium": 4.20,
        "breakeven": 204.20,
        "contracts": 1,
        "maxLoss": "premium paid",
        "rationale": "..."
      }
    }
  ]
}`

const OPTIONS_SYSTEM = `You are Intel Desk's options scanner. You generate concrete options trade ideas given a watchlist, capital constraints, and the user's market view & intel.

You think in terms of:
- IV regime (rich vs cheap), event calendar (earnings, FDA, Fed, product launches)
- Asymmetric R/R (defined-risk longs on cheap IV with a catalyst; premium-selling on rich IV in range-bound names)
- Specific strategies: long calls/puts, vertical spreads (debit/credit), iron condors, calendars, diagonals, LEAPS, cash-secured puts on quality names you'd own, covered calls on existing holdings
- Greeks intuition: delta as proxy for prob, theta vs gamma trade-off, vega exposure

For each idea give: strategy, strikes, expiry (use realistic monthly/weekly cycles), estimated debit/credit, breakeven, max loss, max profit, catalyst & timing, why this strategy over the alternatives.

Output STRICT JSON only.`

const OPTIONS_SCHEMA = `{
  "summary": "Quick read on the watchlist's options landscape and the highest-conviction setups",
  "picks": [
    {
      "ticker": "NVDA",
      "company": "Nvidia",
      "type": "options",
      "conviction": 8,
      "thesis": "Why this trade now",
      "catalysts": ["earnings 2026-02-25", "..."],
      "risks": ["IV crush post-earnings", "..."],
      "timeHorizon": "0-30d",
      "option": {
        "strategy": "bull_call_spread",
        "strike": "180/200",
        "expiry": "2026-02-27",
        "premium": 6.50,
        "breakeven": 186.50,
        "contracts": 1,
        "maxLoss": "$650",
        "maxProfit": "$1350",
        "rationale": "Defined risk into earnings; cheaper than naked call given elevated IV"
      }
    }
  ]
}`

const CONSENSUS_SYSTEM = `You are Intel Desk's analyst-consensus aggregator. Surface stocks with the highest concentration of Strong Buy ratings from sell-side analysts.

When a "Live Strong-Buy ranking from Finnhub" block is provided in the user message, treat it as authoritative ground truth: copy the strongBuyCount, totalAnalysts, analystTarget, and upsidePct verbatim from that block into your output for each picked ticker. Use your reasoning ONLY for the qualitative fields: thesis, catalysts, risks, your independent take, conviction.

When live data is NOT provided, fall back to your training-time knowledge but lower confidence and flag the figures as approximate.

For each name include:
- Strong Buy count and total analysts covering
- Aggregate price target vs current price → upside %
- 2-3 reasons the street is bullish
- Key risks the bulls are downplaying
- Whether YOU agree and why

Mix mega-caps with under-followed mid-caps where consensus is unusually concentrated. Respect user filters.

Output STRICT JSON only.`

const CONSENSUS_SCHEMA = `{
  "summary": "What the street is loving right now and where consensus looks crowded vs warranted",
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
      "thesis": "Why the street is bullish + your independent read",
      "catalysts": ["...", "..."],
      "risks": ["...", "..."],
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
  if (!items?.length) return '(no intel dropped yet — use your training knowledge)'
  return items
    .map((it) => {
      const tickers = it.tickers?.length ? `[${it.tickers.join(', ')}]` : '[no ticker]'
      const meta = [
        it.kind && `kind=${it.kind}`,
        it.source && `src=${it.source}`,
        it.conviction != null && `userConv=${it.conviction}/10`,
      ].filter(Boolean).join(' · ')
      const when = new Date(it.createdAt).toISOString()
      return `--- intel id=${it.id} ${tickers} ${meta} at=${when}\n${it.body}`
    })
    .join('\n\n')
}

function formatSnapshots(snaps) {
  if (!snaps?.length) return '(no live data available)'
  return snaps.map((s) => {
    const q = s.quote
    const r = s.recommendations
    const t = s.priceTarget
    const p = s.profile
    const upside = q?.price && t?.targetMean ? (((t.targetMean - q.price) / q.price) * 100).toFixed(1) : null
    const parts = [
      `${s.symbol}${p?.name ? ` (${p.name})` : ''}${p?.sector ? ` · ${p.sector}` : ''}`,
    ]
    if (q) parts.push(`px=$${q.price?.toFixed?.(2) ?? q.price} (${q.pctChange >= 0 ? '+' : ''}${q.pctChange?.toFixed?.(2) ?? q.pctChange}%)`)
    if (p?.marketCap) parts.push(`mcap=$${(p.marketCap / 1000).toFixed(1)}B`)
    if (r) parts.push(`ratings: SB=${r.strongBuy} B=${r.buy} H=${r.hold} S=${r.sell} SS=${r.strongSell} (n=${r.total}, ${r.period})`)
    if (t) parts.push(`target: mean=$${t.targetMean} hi=$${t.targetHigh} lo=$${t.targetLow} n=${t.numAnalysts}${upside ? ` upside=${upside}%` : ''}`)
    return parts.join(' | ')
  }).join('\n')
}

function formatCompanyNews(byTicker) {
  const lines = []
  for (const [tkr, items] of Object.entries(byTicker)) {
    if (!items?.length) continue
    lines.push(`# ${tkr} news`)
    for (const n of items.slice(0, 5)) {
      const when = n.datetime ? new Date(n.datetime).toISOString().slice(0, 10) : ''
      lines.push(`- [${when}] ${n.headline}${n.summary ? ` — ${n.summary.slice(0, 180)}` : ''}`)
    }
  }
  return lines.join('\n') || '(no recent news)'
}

function uniqTickers(...lists) {
  const set = new Set()
  for (const l of lists) {
    if (!l) continue
    for (const t of l) if (t) set.add(String(t).toUpperCase())
  }
  return [...set]
}

async function gatherLiveContext({ tickers, includeNews = true, marketNewsCategory = null }) {
  if (!marketIsConfigured()) return { snapshots: [], companyNews: {}, marketNews: [], note: 'FINNHUB_API_KEY not configured — live market data disabled.' }
  const out = { snapshots: [], companyNews: {}, marketNews: [], note: null }
  try {
    if (tickers.length) {
      out.snapshots = await snapshotMany(tickers.slice(0, 20))
    }
  } catch (e) { out.note = `snapshot failed: ${e.message}` }
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
    lines.push('## Live snapshot (Finnhub, real-time):')
    lines.push(formatSnapshots(ctx.snapshots))
  }
  if (Object.keys(ctx.companyNews || {}).length) {
    lines.push('\n## Recent company news:')
    lines.push(formatCompanyNews(ctx.companyNews))
  }
  if (ctx.marketNews?.length) {
    lines.push('\n## General market news headlines:')
    for (const n of ctx.marketNews.slice(0, 10)) {
      const when = n.datetime ? new Date(n.datetime).toISOString().slice(0, 10) : ''
      lines.push(`- [${when}] ${n.headline}`)
    }
  }
  return lines.join('\n') || '(no live market context available)'
}

async function buildPrompt(mode, payload) {
  const today = new Date().toISOString().slice(0, 10)
  if (mode === 'picks') {
    const intel = formatIntel(payload.intel)
    const filters = payload.filters || {}
    const intelTickers = (payload.intel || []).flatMap((i) => i.tickers || [])
    const ctx = await gatherLiveContext({
      tickers: uniqTickers(intelTickers),
      includeNews: true,
      marketNewsCategory: 'general',
    })
    return `Today: ${today}

${liveBlock(ctx)}

User intel feed:

${intel}

Constraints:
- focus types: ${filters.types?.length ? filters.types.join(', ') : 'all (undervalued, hidden_gem, options, momentum, contrarian, short)'}
- risk profile: ${filters.risk || 'balanced'}
- capital: ${filters.capital || 'unspecified'}
- horizon bias: ${filters.horizon || 'any'}
- notes: ${filters.notes || 'none'}

When live data is present, anchor entry/target/stop on the real current price and analyst-target ranges, not estimates.

Return STRICT JSON matching:
${PICKS_SCHEMA}`
  }
  if (mode === 'options') {
    const intel = formatIntel(payload.intel)
    const intelTickers = (payload.intel || []).flatMap((i) => i.tickers || [])
    const universe = uniqTickers(payload.watchlist, intelTickers)
    const ctx = await gatherLiveContext({
      tickers: universe,
      includeNews: true,
      marketNewsCategory: null,
    })
    return `Today: ${today}

${liveBlock(ctx)}

Watchlist: ${payload.watchlist?.length ? payload.watchlist.join(', ') : '(use the most actionable names from intel + your knowledge)'}
Capital: ${payload.capital || 'unspecified'}
Risk tolerance: ${payload.risk || 'defined-risk preferred'}
Strategies preferred: ${payload.strategies?.length ? payload.strategies.join(', ') : 'any'}
Horizon: ${payload.horizon || 'any (0-30d, 30-90d, LEAPS)'}
Bias: ${payload.bias || 'neutral — let the setup dictate direction'}
Notes: ${payload.notes || 'none'}

User intel for context:
${intel}

When live prices are present, pick strikes relative to actual spot (e.g., 5-10% OTM means relative to the live price shown above). Set realistic monthly expirations.

Return STRICT JSON matching:
${OPTIONS_SCHEMA}`
  }
  if (mode === 'consensus') {
    const intelTickers = (payload.intel || []).flatMap((i) => i.tickers || [])
    const exclude = new Set((payload.exclude || []).map((s) => s.toUpperCase()))
    const universe = uniqTickers(intelTickers, DEFAULT_CONSENSUS_UNIVERSE).filter((t) => !exclude.has(t))
    const ctx = await gatherLiveContext({
      tickers: universe.slice(0, 20),
      includeNews: false,
      marketNewsCategory: null,
    })
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
        liveRanking = '## Live Strong-Buy ranking from Finnhub (verified counts):\n' +
          ranked.map((r) =>
            `${r.s.symbol} | strongBuy=${r.sb}/${r.total} | px=$${r.px?.toFixed?.(2) ?? r.px} | target=$${r.tgt ?? '?'} | upside=${r.upside != null ? r.upside.toFixed(1) + '%' : '?'} | sector=${r.s.profile?.sector || '?'}`
          ).join('\n')
      }
    }
    return `Today: ${today}

${liveBlock(ctx)}

${liveRanking}

Generate the top stocks with the highest concentration of Strong Buy analyst ratings.

Filters:
- sector: ${payload.sector || 'any'}
- market cap: ${payload.marketCap || 'any'}
- min strong buys: ${payload.minStrongBuys || 15}
- min upside vs current price: ${payload.minUpside || 'any'}
- theme: ${payload.theme || 'none'}
- exclude tickers: ${[...exclude].join(', ') || 'none'}
- limit: ${payload.limit || 12}

If a live Strong-Buy ranking is included above, USE THOSE EXACT NUMBERS for strongBuyCount, totalAnalysts, analystTarget, and upsidePct in your output. Do not invent or estimate them. Use your reasoning for the thesis, catalysts, risks, and your independent take.

Optional user intel:
${formatIntel(payload.intel)}

Return STRICT JSON matching:
${CONSENSUS_SCHEMA}`
  }
  throw new Error(`Unknown mode: ${mode}`)
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to your environment (Vercel → Project Settings → Environment Variables) and redeploy.' },
      { status: 500 },
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const mode = body.mode || 'picks'
  let system, userPrompt
  try {
    if (mode === 'picks') system = PICKS_SYSTEM
    else if (mode === 'options') system = OPTIONS_SYSTEM
    else if (mode === 'consensus') system = CONSENSUS_SYSTEM
    else return Response.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
    userPrompt = await buildPrompt(mode, body)
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: [
        { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = resp.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')

    let parsed
    try {
      parsed = extractJson(text)
    } catch (e) {
      return Response.json(
        { error: 'Model did not return valid JSON', raw: text },
        { status: 502 },
      )
    }

    const picks = (parsed.picks || []).map((p) => ({
      id: crypto.randomUUID(),
      ...p,
      type: p.type || (mode === 'options' ? 'options' : 'undervalued'),
    }))

    return Response.json({
      mode,
      summary: parsed.summary || '',
      picks,
      generatedAt: Date.now(),
      usage: resp.usage,
    })
  } catch (e) {
    return Response.json(
      { error: e?.message || 'Anthropic request failed' },
      { status: 500 },
    )
  }
}
