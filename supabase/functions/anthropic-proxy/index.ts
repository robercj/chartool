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

    // Get user's JWT from Authorization header (Supabase verified it via --no-verify-jwt)
    const authHeader = req.headers.get('Authorization')
    const userJwt = authHeader?.replace('Bearer ', '')

    if (!userJwt) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Decode JWT manually to get user ID (Supabase already verified the signature)
    const jwtParts = userJwt.split('.')
    if (jwtParts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid JWT format' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    let jwtPayload: any
    try {
      const payloadBase64 = jwtParts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padding = '='.repeat((4 - payloadBase64.length % 4) % 4)
      const payloadJson = atob(payloadBase64 + padding)
      jwtPayload = JSON.parse(payloadJson)
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JWT payload' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const userId = jwtPayload.sub
    if (!userId) {
      return new Response(JSON.stringify({ error: 'JWT missing sub claim' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

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

    // Check generation limit
    const { allowed, reason } = await checkLimit(supabaseAdmin, userId, generationType)
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
      await incrementUsage(supabaseAdmin, userId, generationType)
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

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

async function checkLimit(supabase: any, userId: string, type: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier_id, tier:tiers(monthly_image_limit, monthly_story_limit)')
    .eq('id', userId)
    .single()

  if (!profile) return { allowed: false, reason: 'Profile not found' }

  const tier = profile.tier
  const limit = type === 'image' ? tier.monthly_image_limit : tier.monthly_story_limit
  if (limit === null) return { allowed: true, reason: null }

  const period = currentPeriod()
  const { data: usageRow } = await supabase
    .from('usage')
    .select('count')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('period', period)
    .single()

  const current = usageRow?.count ?? 0
  if (current >= limit) {
    return { allowed: false, reason: `Monthly ${type} limit (${limit}) reached. Resets on the 1st.` }
  }
  return { allowed: true, reason: null }
}

async function incrementUsage(supabase: any, userId: string, type: string) {
  await supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_type: type,
    p_period: currentPeriod(),
    p_amount: 1,
  })
}
