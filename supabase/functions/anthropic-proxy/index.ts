import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // Use the service role client to verify the user JWT from the Authorization header
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // Use a user-scoped client for RLS-protected queries
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    // Parse body and strip internal _generation_type field
    const body = await req.json()
    const generationType: string = body._generation_type || 'story'
    delete body._generation_type

    // Check generation limit
    const { allowed, reason } = await checkLimit(supabaseAdmin, user.id, generationType)
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
      await incrementUsage(supabaseAdmin, user.id, generationType)
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
