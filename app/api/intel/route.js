import { listAdd, listAll, listRemove, listClear, backend } from '../../lib/store'

export const runtime = 'nodejs'
export const maxDuration = 30

const KEY = 'intel:v1'

export async function GET() {
  const items = await listAll(KEY)
  return Response.json({ items, backend: backend() })
}

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!body || !body.body || typeof body.body !== 'string') {
    return Response.json({ error: 'body field required' }, { status: 400 })
  }
  const item = {
    id: body.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    createdAt: body.createdAt || Date.now(),
    kind: body.kind || 'note',
    tickers: Array.isArray(body.tickers) ? body.tickers : [],
    source: body.source || '',
    conviction: body.conviction != null ? Number(body.conviction) : null,
    body: body.body,
  }
  await listAdd(KEY, item)
  return Response.json({ item, backend: backend() })
}

export async function DELETE(req) {
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
