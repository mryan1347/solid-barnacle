export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  return Response.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    finnhub: Boolean(process.env.FINNHUB_API_KEY),
    kv: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-7',
    vercelEnv: process.env.VERCEL_ENV || null,
    deployment: process.env.VERCEL_URL || null,
    region: process.env.VERCEL_REGION || null,
    asOf: new Date().toISOString(),
  })
}
