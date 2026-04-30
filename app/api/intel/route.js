import { listAdd, listAll, listRemove, listClear, backend } from '../../lib/store'
import { isAuthorized, unauthorized } from '../../lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 30

const KEY = 'intel:v1'
const MAX_BODY = 8000
const MAX_TICKERS = 60
const MAX_SOURCE = 200

export async function GET(req) {
  if (!isAuthorized(req)) return unauthorized()
  const items = await listAll(KEY)
  return Response.json({ items, backend: backend() })
}

export async function POST(req) {
  if (!isAuthorized(req)) return unauthorized()
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body || !body.body || typeof body.body !== 'string') {
    return Response.json({ error: 'body field required (string)' }, { status: 400 })
  }
  if (body.body.length > MAX_BODY) {
    return Response.json({ error: `body too long (max ${MAX_BODY} chars)` }, { status: 400 })
  }
  const tickers = Array.isArray(body.tickers)
    ? body.tickers
        .filter((t) => typeof t === 'string')
        .map((t) => t.toUpperCase().replace(/[^A-Z0-9.\-]/g, ''))
        .filter(Boolean)
        .slice(0, MAX_TICKERS)
    : []
  const item = {
    id: body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    createdAt: body.createdAt || Date.now(),
    kind: typeof body.kind === 'string' ? body.kind.slice(0, 30) : 'note',
    tickers,
    source: typeof body.source === 'string' ? body.source.slice(0, MAX_SOURCE) : '',
    conviction: body.conviction != null ? Math.max(1, Math.min(10, Number(body.conviction) || 5)) : null,
    body: body.body,
  }
  await listAdd(KEY, item)
  return Response.json({ item, backend: backend() })
}

export async function DELETE(req) {
  if (!isAuthorized(req)) return unauthorized()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const all = searchParams.get('all') === '1'
  if (all) {
    await listClear(KEY)
    return Response.json({ cleared: true })
  }
  if (!id) return Response.json({ error: 'id or all=1 required' }, { status: 400 })
  await listRemove(KEY, (item) => item.id === id)
  return Response.json({ removed: id })
}
