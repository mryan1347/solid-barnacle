export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  return Response.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    finnhub: Boolean(process.env.FINNHUB_API_KEY),
    kv: Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    ttsProvider: process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : process.env.OPENAI_API_KEY ? 'openai' : null,
    authRequired: Boolean(process.env.APP_PASSWORD),
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-7',
    vercelEnv: process.env.VERCEL_ENV || null,
    region: process.env.VERCEL_REGION || null,
    asOf: new Date().toISOString(),
  })
}
