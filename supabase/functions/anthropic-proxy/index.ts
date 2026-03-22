// ─── anthropic-proxy/index.ts ────────────────────────────────────────────────
// Proxies requests to the Anthropic Messages API after verifying the user's
// JWT and checking their monthly usage limit.
//
// Required Supabase secrets (set via `supabase secrets set`):
//   CharacterForge   — Supabase service-role / admin API key (sb_secret_...)
//   ANTHROPIC_KEY    — Anthropic API key (sk-ant-...)
//
// Deploy with: supabase functions deploy anthropic-proxy --no-verify-jwt
//
// NOTE: Uses the `CharacterForge` secret name (not the standard
// SUPABASE_SERVICE_ROLE_KEY) to support the new sb_secret_ key format.
// The JWT signature is verified by Supabase at the edge before this function
// runs; we only decode the payload here to extract the user ID.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractUserId } from '../_shared/auth.ts'
import { checkLimit, incrementUsage } from '../_shared/limits.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Use new Supabase API keys (non-JWT) ────────────────────────────────────────
    // With --no-verify-jwt flag, Supabase already verified the JWT at the edge.
    // We just need to extract the user from the verified token.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseSecretKey = Deno.env.get('CharacterForge')!

    if (!supabaseSecretKey) {
      return new Response(JSON.stringify({ error: 'CharacterForge secret not configured in Edge Function secrets.' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const auth = extractUserId(req)
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }
    const { userId, authHeader } = auth
    console.log('Authenticated user:', userId)

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    // Use a user-scoped client for RLS-protected queries
    const supabase = createClient(
      supabaseUrl,
      supabaseSecretKey,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Parse body and strip internal _generation_type field
    const body = await req.json()
    const generationType: string = body._generation_type || 'story'
    delete body._generation_type

    // Map generation type to quota type
    const CHARACTER_TYPES = new Set([
      'character_manifest',
      'character_identity_prompt',
      'character_appearance_description',
    ])
    const quotaType =
      generationType === 'image'          ? 'image' :
      generationType === 'story'          ? 'story' :
      CHARACTER_TYPES.has(generationType) ? 'character' :
      'story' // fallback for unknown types

    // Check generation limit
    const { allowed, reason } = await checkLimit(supabaseAdmin, userId, quotaType)
    if (!allowed) {
      return new Response(JSON.stringify({ error: reason }), {
        status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Forward to Anthropic
    const anthropicKey = Deno.env.get('ANTHROPIC_KEY')
    if (!anthropicKey) throw new Error('ANTHROPIC_KEY secret not set')

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    const responseData = await anthropicRes.json()

    if (anthropicRes.ok) {
      await incrementUsage(supabaseAdmin, userId, quotaType)
    }

    return new Response(JSON.stringify(responseData), {
      status: anthropicRes.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('anthropic-proxy error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
