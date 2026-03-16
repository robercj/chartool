import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Uses sync_mode: true on fal.run — result returns in single response, no polling.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    if (authError || !user) {
      console.error('Auth error:', authError)
      return json({ error: 'Unauthorized' }, 401)
    }

    const falKey = Deno.env.get('FAL_KEY')
    if (!falKey) throw new Error('FAL_KEY secret not set')

    const { image_url } = await req.json()
    if (!image_url) return json({ error: 'Missing image_url' }, 400)

    console.log('Calling rembg, image_url length:', image_url.length)

    const falRes = await fetch('https://fal.run/fal-ai/imageutils/rembg', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image_url, sync_mode: true }),
    })

    const falText = await falRes.text()
    console.log('rembg response:', falRes.status, falText.slice(0, 300))

    if (!falRes.ok) {
      return json({ error: `rembg error: ${falText}` }, falRes.status)
    }

    let falData: any
    try { falData = JSON.parse(falText) }
    catch { return json({ error: `rembg non-JSON response: ${falText}` }, 500) }

    const outputUrl = falData.image?.url ?? falData.data?.image?.url
    if (!outputUrl) {
      console.error('No image url in rembg response:', falText)
      return json({ error: 'rembg returned no image', raw: falData }, 500)
    }

    return json({ image: { url: outputUrl } })

  } catch (err) {
    console.error('fal-rembg error:', err)
    return json({ error: err.message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  })
}
