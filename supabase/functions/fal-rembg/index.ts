// ─── fal-rembg/index.ts ──────────────────────────────────────────────────────
// Background removal via fal-ai/imageutils/rembg.
// No usage increment — background removal is not counted against the user's
// generation quota.
//
// Required Supabase secrets:
//   CharacterForge  — Supabase admin key (sb_secret_...)
//   FAL_KEY         — fal.ai API key
//
// Deploy with: supabase functions deploy fal-rembg --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractUserId } from '../_shared/auth.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Uses sync_mode: true on fal.run — result returns in single response, no polling.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── Auth using new Supabase API keys (non-JWT) ───────────────────────────
    // With --no-verify-jwt flag, Supabase already verified the JWT at the edge.
    // We just need to extract the user from the verified token.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseSecretKey = Deno.env.get('CharacterForge')!

    if (!supabaseSecretKey) {
      return json({ error: 'CharacterForge secret not configured in Edge Function secrets.' }, 500)
    }

    const auth = extractUserId(req)
    if (!auth.ok) return json({ error: auth.error }, auth.status)
    const { userId } = auth
    console.log('Authenticated user:', userId)

    // Create admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    const falKey = Deno.env.get('FAL_KEY')
    if (!falKey) throw new Error('FAL_KEY secret not set')

    const { image_url } = await req.json()
    if (!image_url) return json({ error: 'Missing image_url' }, 400)

    console.log('Calling rembg, image_url length:', image_url.length)

    // Retry up to 3 attempts with linear backoff + jitter for transient 5xx errors (e.g. 504).
    // Delays: ~1s, ~2s (each ± up to 500ms of random jitter to reduce thundering-herd spikes).
    // If fal.ai returns 429 with a Retry-After header, that duration is respected instead.
    // Each attempt is independently capped at 90s via AbortController; platform timeout is 150s.
    const MAX_ATTEMPTS = 3
    const TIMEOUT_MS = 90_000
    let falRes!: Response
    let falText = ''

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)

      try {
        falRes = await fetch('https://fal.run/fal-ai/imageutils/rembg', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image_url, sync_mode: true }),
          signal: timeoutController.signal,
        })
        clearTimeout(timeoutId)
        falText = await falRes.text()
        console.log(`rembg response (attempt ${attempt}/${MAX_ATTEMPTS}):`, falRes.status, falText.slice(0, 300))

        // Stop immediately on success or permanent client errors (4xx), except 429 which may be retried
        if (falRes.ok) break
        if (falRes.status >= 400 && falRes.status < 500 && falRes.status !== 429) break

        if (attempt < MAX_ATTEMPTS) {
          let delay: number
          if (falRes.status === 429) {
            // Respect Retry-After header if present, otherwise fall back to linear backoff
            const retryAfter = falRes.headers.get('Retry-After')
            delay = retryAfter ? parseFloat(retryAfter) * 1000 : 1000 * attempt + Math.random() * 500
            console.log(`rembg rate limited (429), retrying in ${Math.round(delay)}ms…`)
          } else {
            delay = 1000 * attempt + Math.random() * 500 // linear backoff with jitter
            console.log(`rembg ${falRes.status}, retrying in ${Math.round(delay)}ms…`)
          }
          await new Promise(r => setTimeout(r, delay))
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        if (fetchErr.name === 'AbortError') {
          console.error(`rembg timed out after ${TIMEOUT_MS}ms (attempt ${attempt}/${MAX_ATTEMPTS})`)
          if (attempt === MAX_ATTEMPTS) {
            return json({ error: 'Background removal timed out — please try again' }, 504)
          }
          const delay = 1000 * attempt + Math.random() * 500
          console.log(`Timeout, retrying in ${Math.round(delay)}ms…`)
          await new Promise(r => setTimeout(r, delay))
          continue
        }
        throw fetchErr
      }
    }

    if (!falRes!.ok) {
      return json({ error: `rembg error: ${falText}` }, falRes!.status)
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
