import {
  isConfigured,
  getQuote,
  getQuotes,
  getProfile,
  getRecommendations,
  getPriceTarget,
  getCompanyNews,
  getMarketNews,
  getEarningsCalendar,
  snapshot,
  snapshotMany,
} from '../../lib/marketData'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || 'snapshot'
  const symbol = searchParams.get('symbol') || ''
  const symbols = searchParams.get('symbols') || ''

  if (!isConfigured()) {
    return Response.json(
      { error: 'FINNHUB_API_KEY is not configured. Add it in Vercel → Project Settings → Environment Variables.' },
      { status: 503 },
    )
  }

  try {
    switch (action) {
      case 'quote':
        return Response.json({ data: await getQuote(symbol) })
      case 'quotes': {
        const list = symbols.split(',').map((s) => s.trim()).filter(Boolean)
        return Response.json({ data: await getQuotes(list) })
      }
      case 'profile':
        return Response.json({ data: await getProfile(symbol) })
      case 'recommendations':
        return Response.json({ data: await getRecommendations(symbol) })
      case 'priceTarget':
        return Response.json({ data: await getPriceTarget(symbol) })
      case 'companyNews':
        return Response.json({ data: await getCompanyNews(symbol) })
      case 'marketNews':
        return Response.json({ data: await getMarketNews(searchParams.get('category') || 'general') })
      case 'earnings':
        return Response.json({ data: await getEarningsCalendar(symbol) })
      case 'snapshot':
        return Response.json({ data: await snapshot(symbol) })
      case 'snapshotMany': {
        const list = symbols.split(',').map((s) => s.trim()).filter(Boolean)
        return Response.json({ data: await snapshotMany(list) })
      }
      default:
        return Response.json({ error: `unknown action: ${action}` }, { status: 400 })
    }
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
