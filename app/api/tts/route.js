// Studio-quality text-to-speech proxy. Picks provider by env var:
//   1. ELEVENLABS_API_KEY  →  ElevenLabs (best quality, ~$0.30/1k chars)
//   2. OPENAI_API_KEY      →  OpenAI tts-1 (~$0.015/1k chars)
//   else 503 → client falls back to browser speechSynthesis
//
// Costs at typical pick summary length (~500 chars):
//   ElevenLabs: ~$0.15 per pick
//   OpenAI:     ~$0.0075 per pick
//
// Auth: same APP_PASSWORD gate as every other write endpoint.

import { isAuthorized, unauthorized } from '../../lib/auth'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// OpenAI voices
const OPENAI_VOICES = new Set(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'])
const DEFAULT_OPENAI_VOICE = 'nova'

// ElevenLabs default voice IDs (publicly documented stock voices)
// Override with ELEVENLABS_VOICE_ID env var.
const ELEVEN_DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb' // 'George' — clear, neutral male
const ELEVEN_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5'

const MAX_CHARS = 4000

function audioResponse(stream) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=86400',
    },
  })
}

async function elevenSpeak(text, voiceId) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: ELEVEN_MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  })
  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return Response.json({ error: `ElevenLabs ${upstream.status}: ${errText.slice(0, 200)}` }, { status: 502 })
  }
  return audioResponse(upstream.body)
}

async function openaiSpeak(text, voice, hd) {
  const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: hd ? 'tts-1-hd' : 'tts-1',
      voice: OPENAI_VOICES.has(voice) ? voice : DEFAULT_OPENAI_VOICE,
      input: text,
      response_format: 'mp3',
    }),
  })
  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '')
    return Response.json({ error: `OpenAI ${upstream.status}: ${errText.slice(0, 200)}` }, { status: 502 })
  }
  return audioResponse(upstream.body)
}

export async function POST(req) {
  if (!isAuthorized(req)) return unauthorized()

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return Response.json({ error: 'text required' }, { status: 400 })
  if (text.length > MAX_CHARS) return Response.json({ error: `text too long (max ${MAX_CHARS} chars)` }, { status: 400 })

  // ElevenLabs first if configured (better quality), otherwise OpenAI.
  if (process.env.ELEVENLABS_API_KEY) {
    const voiceId = typeof body.voiceId === 'string' && body.voiceId ? body.voiceId : ELEVEN_DEFAULT_VOICE
    return elevenSpeak(text, voiceId)
  }
  if (process.env.OPENAI_API_KEY) {
    return openaiSpeak(text, body.voice, body.hd === true)
  }
  return Response.json(
    { error: 'No TTS provider configured. Set ELEVENLABS_API_KEY or OPENAI_API_KEY in Vercel env vars.' },
    { status: 503 },
  )
}

export async function GET() {
  return Response.json({
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    provider: process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : process.env.OPENAI_API_KEY ? 'openai' : null,
    elevenVoiceId: ELEVEN_DEFAULT_VOICE,
    elevenModel: ELEVEN_MODEL,
  })
}
