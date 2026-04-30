const BASE = 'https://finnhub.io/api/v1'

function key() {
  const k = process.env.FINNHUB_API_KEY
  if (!k) throw new Error('FINNHUB_API_KEY not configured')
  return k
}

async function get(path, params = {}) {
  const url = new URL(BASE + path)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
  }
  url.searchParams.set('token', key())
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Finnhub ${path} ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

export function isConfigured() {
  return Boolean(process.env.FINNHUB_API_KEY)
}

export async function getQuote(symbol) {
  const q = await get('/quote', { symbol })
  if (!q || q.c == null || q.c === 0) return null
  return {
    symbol,
    price: q.c,
    change: q.d,
    pctChange: q.dp,
    high: q.h,
    low: q.l,
    open: q.o,
    prevClose: q.pc,
    asOf: q.t ? q.t * 1000 : Date.now(),
  }
}

export async function getQuotes(symbols) {
  const list = Array.isArray(symbols) ? symbols : String(symbols).split(',').map((s) => s.trim()).filter(Boolean)
  const results = await Promise.allSettled(list.map((s) => getQuote(s)))
  return results
    .map((r, i) => (r.status === 'fulfilled' ? r.value : null))
    .filter(Boolean)
}

export async function getProfile(symbol) {
  const p = await get('/stock/profile2', { symbol })
  if (!p || !p.ticker) return null
  return {
    symbol: p.ticker,
    name: p.name,
    sector: p.finnhubIndustry,
    country: p.country,
    currency: p.currency,
    marketCap: p.marketCapitalization,
    sharesOutstanding: p.shareOutstanding,
    ipoDate: p.ipo,
    logo: p.logo,
    weburl: p.weburl,
    exchange: p.exchange,
  }
}

export async function getRecommendations(symbol) {
  const arr = await get('/stock/recommendation', { symbol })
  if (!Array.isArray(arr) || arr.length === 0) return null
  const latest = arr[0]
  const total =
    (latest.strongBuy || 0) +
    (latest.buy || 0) +
    (latest.hold || 0) +
    (latest.sell || 0) +
    (latest.strongSell || 0)
  return {
    symbol,
    period: latest.period,
    strongBuy: latest.strongBuy || 0,
    buy: latest.buy || 0,
    hold: latest.hold || 0,
    sell: latest.sell || 0,
    strongSell: latest.strongSell || 0,
    total,
    history: arr.slice(0, 6),
  }
}

export async function getPriceTarget(symbol) {
  const t = await get('/stock/price-target', { symbol })
  if (!t || !t.targetMean) return null
  return {
    symbol,
    targetMean: t.targetMean,
    targetHigh: t.targetHigh,
    targetLow: t.targetLow,
    targetMedian: t.targetMedian,
    numAnalysts: t.numberOfAnalysts,
    lastUpdated: t.lastUpdated,
  }
}

export async function getCompanyNews(symbol, fromDate, toDate) {
  const today = new Date()
  const to = toDate || today.toISOString().slice(0, 10)
  const fromObj = fromDate ? new Date(fromDate) : new Date(today.getTime() - 14 * 86400 * 1000)
  const from = fromObj.toISOString().slice(0, 10)
  const arr = await get('/company-news', { symbol, from, to })
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 15).map((n) => ({
    headline: n.headline,
    summary: n.summary,
    source: n.source,
    url: n.url,
    datetime: n.datetime ? n.datetime * 1000 : null,
    category: n.category,
  }))
}

export async function getMarketNews(category = 'general') {
  const arr = await get('/news', { category })
  if (!Array.isArray(arr)) return []
  return arr.slice(0, 20).map((n) => ({
    headline: n.headline,
    summary: n.summary,
    source: n.source,
    url: n.url,
    datetime: n.datetime ? n.datetime * 1000 : null,
    category: n.category,
  }))
}

export async function getEarningsCalendar(symbol, days = 30) {
  const today = new Date()
  const from = today.toISOString().slice(0, 10)
  const to = new Date(today.getTime() + days * 86400 * 1000).toISOString().slice(0, 10)
  const data = await get('/calendar/earnings', { from, to, symbol })
  return data?.earningsCalendar || []
}

export async function getMetrics(symbol) {
  const m = await get('/stock/metric', { symbol, metric: 'all' })
  return m?.metric || null
}

export async function snapshot(symbol) {
  const [quote, profile, recs, target] = await Promise.allSettled([
    getQuote(symbol),
    getProfile(symbol),
    getRecommendations(symbol),
    getPriceTarget(symbol),
  ])
  return {
    symbol,
    quote: quote.status === 'fulfilled' ? quote.value : null,
    profile: profile.status === 'fulfilled' ? profile.value : null,
    recommendations: recs.status === 'fulfilled' ? recs.value : null,
    priceTarget: target.status === 'fulfilled' ? target.value : null,
  }
}

export async function snapshotMany(symbols) {
  const list = Array.isArray(symbols) ? symbols : []
  const out = await Promise.allSettled(list.map((s) => snapshot(s)))
  return out.map((r) => (r.status === 'fulfilled' ? r.value : null)).filter(Boolean)
}
