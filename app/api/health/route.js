export const runtime = 'nodejs'

export async function GET() {
  return Response.json({
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    finnhub: Boolean(process.env.FINNHUB_API_KEY),
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-4-7',
  })
}
