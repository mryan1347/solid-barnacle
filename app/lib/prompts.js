'use client'

// Builds a type-aware prompt for each pick / theme and a one-click
// claude.ai URL. Claude.ai accepts ?q=<encoded prompt> on /new.

const CLAUDE_BASE = 'https://claude.ai/new'

function joinLines(parts) {
  return parts.filter(Boolean).join('\n')
}

function buildContext(pick) {
  const ticker = pick.ticker ? `$${pick.ticker}` : 'this stock'
  const head = pick.company ? `${ticker} (${pick.company})` : ticker
  return joinLines([
    `Pick: ${head}`,
    pick.type && `Type: ${pick.type}`,
    pick.sector && `Sector: ${pick.sector}`,
    pick.conviction != null && `AI conviction: ${pick.conviction}/10`,
    pick.thesis && `\nThesis: ${pick.thesis}`,
    pick.catalysts?.length && `Catalysts: ${pick.catalysts.join('; ')}`,
    pick.risks?.length && `Risks: ${pick.risks.join('; ')}`,
    pick.entry && `Entry: ${pick.entry}`,
    pick.target && `Target: ${pick.target}`,
    pick.stop && `Stop: ${pick.stop}`,
    pick.upsidePct != null && `Upside: ${pick.upsidePct}%`,
    pick.timeHorizon && `Horizon: ${pick.timeHorizon}`,
    pick.option && `Option: ${pick.option.strategy || ''}${pick.option.strike ? ` strike ${pick.option.strike}` : ''}${pick.option.expiry ? ` expiry ${pick.option.expiry}` : ''}${pick.option.premium != null ? ` premium ${pick.option.premium}` : ''}${pick.option.breakeven != null ? ` breakeven ${pick.option.breakeven}` : ''}`,
    pick.strongBuyCount != null && `Wall St: ${pick.strongBuyCount} Strong Buys${pick.totalAnalysts ? ` of ${pick.totalAnalysts}` : ''}${pick.analystTarget ? `, target ${pick.analystTarget}` : ''}`,
    pick.theme && `Theme: ${pick.theme}`,
    pick.obviousAlternative && `Crowded alternative: ${pick.obviousAlternative}`,
  ])
}

function questionFor(pick) {
  const t = pick.type || 'pick'
  const ticker = pick.ticker || 'this name'

  if (t === 'options' || pick.option) {
    const strat = pick.option?.strategy ? String(pick.option.strategy).replace(/_/g, ' ') : 'this trade'
    return `Walk me through executing the ${strat} on $${ticker} step by step:
1. Exact order types and how to leg in (single ticket vs. legging)
2. The math: max profit, max loss, breakeven, P/L at each price
3. Greeks at entry (delta, theta, vega) and how they evolve
4. How to manage if it goes against me — when to roll vs. close vs. hold
5. Assignment risk and how to react if it triggers
6. When to take profit (% of max, threshold, time-based)
7. Capital requirements and margin treatment in a typical broker (IBKR/Fidelity/Schwab)`
  }

  if (t === 'sleeper') {
    return `Build me a deep sleeper / picks-and-shovels case for $${ticker}${pick.theme ? ` within the ${pick.theme} theme` : ''}:
1. What % of revenue/EBIT is actually exposed to the theme — segment-level breakdown
2. The supply chain map: where does $${ticker} sit and who depends on it
3. Why is this a better risk/reward than ${pick.obviousAlternative ? `$${pick.obviousAlternative}` : 'the obvious crowded leader'}
4. The 3 things that have to break for this thesis to fail
5. Specific catalysts in the next 6-12 months with dates
6. How to size it relative to the obvious leader (pair trade ratio?)`
  }

  if (t === 'undervalued') {
    return `Help me pressure-test $${ticker} as a deep-value pick:
1. Build a clean 1-page thesis: what's mispriced and what closes the gap
2. Top 3 line items in the latest 10-K I should personally re-read
3. Bear case: what does management need to NOT screw up
4. Is this a value trap? Three signals that would prove me wrong
5. Comp set: which 3 names should I track this vs. (multiple, growth, margins)
6. Catalyst path with realistic timing (next earnings, capital allocation event, regulatory)`
  }

  if (t === 'hidden_gem') {
    return `Give me everything an under-followed $${ticker} bull would know:
1. Why is the street sleeping on it (sell-side coverage gap, market cap floor, free float)
2. Insider activity, recent buybacks, secondary risk
3. Special situation history (spin-off, post-IPO orphan, post-overhang re-rate)
4. Quality of the business: gross margins, customer concentration, moat
5. The single biggest risk a small-cap investor would worry about
6. Where would I find the highest-quality forum/research community for this name`
  }

  if (t === 'short') {
    return `Build the short thesis on $${ticker} like an experienced short seller:
1. What's actually broken — TAM rolling over, accounting flags, terminal decline?
2. Borrow availability, short interest, days-to-cover
3. Squeeze risk: who could buy it (strategic, PE, activist long)
4. Best expression: outright short vs. put options vs. put spread vs. credit call spread
5. Sizing rules and stop-loss methodology for shorts specifically
6. Catalysts that confirm the short is working`
  }

  if (t === 'momentum' || t === 'top_pick') {
    return `Give me a clean execution plan for $${ticker}:
1. Position sizing as % of portfolio (Kelly fraction, fixed risk, volatility-adjusted)
2. Entry strategy: lump sum vs. DCA over X weeks; pyramid up on confirmation?
3. Stop-loss methodology: % below entry, ATR-based, technical level — pick one and justify
4. Profit-taking rules: scale-out tiers, trail-stop, target-based
5. Three things to monitor weekly (specific metrics, not vibes)
6. Pair-hedge candidate to neutralize sector beta`
  }

  if (t === 'contrarian') {
    return `I'm taking a contrarian view on $${ticker}. Help me make sure it's a real contrarian setup, not catching a falling knife:
1. What's the consensus narrative I'm betting against
2. What specifically has to change for sentiment to flip
3. Three observable leading indicators that the turn is happening
4. How to size it given path-dependence (lump vs. ladder in)
5. The "I'm wrong" trigger — at what price/event do I cut`
  }

  // Default — generic deep dive
  return `Help me execute $${ticker} as a position:
1. Sanity-check the thesis above — is anything materially missing
2. Position sizing for a $portfolio_size of $X (replace X with your number)
3. Entry plan, stop-loss, profit-taking
4. Three weekly monitoring metrics
5. The single catalyst with the highest information value`
}

export function pickPrompt(pick) {
  return joinLines([
    buildContext(pick),
    '',
    'My question:',
    questionFor(pick),
  ])
}

export function themePrompt(theme) {
  const layers = (theme.valueChain || [])
    .map((l) => `- ${l.layer}: ${(l.tickers || []).join(', ')}`).join('\n')
  const ctx = joinLines([
    `Theme: ${theme.theme || 'this theme'}`,
    theme.summary && `Summary: ${theme.summary}`,
    theme.topPicks?.length && `Top picks across the chain: ${theme.topPicks.join(', ')}`,
    layers && `Value chain:\n${layers}`,
    theme.catalysts?.length && `Catalysts: ${theme.catalysts.join('; ')}`,
    theme.risks?.length && `Risks: ${theme.risks.join('; ')}`,
  ])
  return joinLines([
    ctx,
    '',
    'My question:',
    `Help me actually allocate to "${theme.theme}":
1. ETF vs. basket of single stocks vs. concentrate in 2-3 — which fits a $portfolio_size of $X
2. How should I weight across the value chain layers shown above
3. What time horizon — months vs. years — and what would make me exit early
4. The single best risk/reward name in the chain today and why
5. A hedge I can put on against the entire theme failing
6. The 3 leading indicators I should track weekly to know if the theme is accelerating or stalling`,
  ])
}

export function claudeUrl(prompt) {
  return `${CLAUDE_BASE}?q=${encodeURIComponent(prompt)}`
}
