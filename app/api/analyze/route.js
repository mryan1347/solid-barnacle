import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-7'

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

const CONSENSUS_SYSTEM = `You are Intel Desk's analyst-consensus aggregator. Surface stocks with the highest concentration of Strong Buy ratings from sell-side analysts, weighted by quality of coverage and recency.

For each name include:
- Approximate Strong Buy count (and total analysts covering)
- Aggregate price target vs current price → upside %
- 2-3 reasons the street is bullish
- Key risks the bulls are downplaying
- Whether YOU agree (independent take) and your conviction

Lean toward names with 15+ Strong Buys and meaningful upside vs current price. Mix mega-caps with under-followed mid-caps where consensus is unusually concentrated. If the user provided sector / market-cap / theme constraints, respect them.

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

function buildPrompt(mode, payload) {
  const today = new Date().toISOString().slice(0, 10)
  if (mode === 'picks') {
    const intel = formatIntel(payload.intel)
    const filters = payload.filters || {}
    return `Today: ${today}
User intel feed:

${intel}

Constraints:
- focus types: ${filters.types?.length ? filters.types.join(', ') : 'all (undervalued, hidden_gem, options, momentum, contrarian, short)'}
- risk profile: ${filters.risk || 'balanced'}
- capital: ${filters.capital || 'unspecified'}
- horizon bias: ${filters.horizon || 'any'}
- notes: ${filters.notes || 'none'}

Return STRICT JSON matching:
${PICKS_SCHEMA}`
  }
  if (mode === 'options') {
    const intel = formatIntel(payload.intel)
    return `Today: ${today}
Watchlist: ${payload.watchlist?.length ? payload.watchlist.join(', ') : '(use the most actionable names from intel + your knowledge)'}
Capital: ${payload.capital || 'unspecified'}
Risk tolerance: ${payload.risk || 'defined-risk preferred'}
Strategies preferred: ${payload.strategies?.length ? payload.strategies.join(', ') : 'any'}
Horizon: ${payload.horizon || 'any (0-30d, 30-90d, LEAPS)'}
Bias: ${payload.bias || 'neutral — let the setup dictate direction'}
Notes: ${payload.notes || 'none'}

User intel for context:
${intel}

Return STRICT JSON matching:
${OPTIONS_SCHEMA}`
  }
  if (mode === 'consensus') {
    return `Today: ${today}
Generate the top stocks with the highest concentration of Strong Buy analyst ratings.

Filters:
- sector: ${payload.sector || 'any'}
- market cap: ${payload.marketCap || 'any'}
- min strong buys: ${payload.minStrongBuys || 15}
- min upside vs current price: ${payload.minUpside || 'any'}
- theme: ${payload.theme || 'none'}
- exclude tickers: ${payload.exclude?.join(', ') || 'none'}
- limit: ${payload.limit || 12}

Optional user intel (use to bias / overlay your picks but do NOT let it constrain you to only those tickers):
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
    userPrompt = buildPrompt(mode, body)
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
