// Optional shared-secret auth for write/expensive endpoints.
//
// If APP_PASSWORD is set, every protected endpoint requires the
// `x-app-password` header (or `?p=` query param for browser-friendly
// GET routes like /api/intel/seed) to match exactly. If unset, the
// app runs in open mode (no auth) — a deliberate choice the user
// makes by setting / not setting the env var.
//
// /api/health remains unauthenticated so the client can ask whether
// auth is required before deciding whether to prompt.

const PROTECTED_HEADER = 'x-app-password'

export function authRequired() {
  return Boolean(process.env.APP_PASSWORD)
}

export function isAuthorized(req) {
  const required = process.env.APP_PASSWORD
  if (!required) return true
  const fromHeader = req.headers.get(PROTECTED_HEADER) || ''
  if (fromHeader && fromHeader === required) return true
  try {
    const url = new URL(req.url)
    const fromQuery = url.searchParams.get('p') || ''
    if (fromQuery && fromQuery === required) return true
  } catch {}
  return false
}

export function unauthorized(message = 'auth_required') {
  return Response.json(
    { error: message, hint: 'Set the APP_PASSWORD env var, then send it as the x-app-password header (or ?p= query param).' },
    { status: 401 },
  )
}

export function isCronAuthorized(req) {
  // Vercel cron attaches `Authorization: Bearer ${CRON_SECRET}`.
  // Fall back to APP_PASSWORD so the user can hit /api/cron/refresh
  // manually when troubleshooting.
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization') || ''
    if (auth === `Bearer ${process.env.CRON_SECRET}`) return true
  }
  return isAuthorized(req)
}
