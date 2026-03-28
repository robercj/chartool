// ─── fal-generate/index.ts ───────────────────────────────────────────────────
// Reference-image-guided image generation via fal-ai/nano-banana-2/edit.
// Requires at least one reference image URL in `input.image_urls`.
//
// Required Supabase secrets:
//   CharacterForge  — Supabase admin key (sb_secret_...)
//   FAL_KEY         — fal.ai API key
//
// Deploy with: supabase functions deploy fal-generate --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractUserId } from '../_shared/auth.ts'
import { checkLimit, incrementUsage } from '../_shared/limits.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DEFAULT_MODEL = 'fal-ai/nano-banana-2/edit'

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

    // Create admin client for database operations (using new secret key)
    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    // ── Limit check ───────────────────────────────────────────────────────────
    const { allowed, reason } = await checkLimit(supabaseAdmin, userId, 'image')
    if (!allowed) return json({ error: reason }, 429)

    const falKey = Deno.env.get('FAL_KEY')
    if (!falKey) throw new Error('FAL_KEY secret not set')

    const { input } = await req.json()
    const model = input?.model || DEFAULT_MODEL

    // Validate reference images
    const imageUrls = (input.image_urls ?? []).filter(Boolean)
    if (imageUrls.length === 0) {
      return json({ error: 'At least one reference image is required' }, 400)
    }

    // sync_mode: true → fal returns the image data URI directly in the response,
    // no polling needed, result comes back in the same HTTP response
    const falInput = {
      ...input,
      image_urls: imageUrls,
      sync_mode: true,
    }

    console.log('Calling fal.ai sync, model:', model, 'images:', imageUrls.length, 'prompt:', falInput.prompt?.slice(0, 80))

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
        falRes = await fetch(`https://fal.run/${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(falInput),
          signal: timeoutController.signal,
        })
        clearTimeout(timeoutId)
        falText = await falRes.text()
        console.log(`fal.ai response (attempt ${attempt}/${MAX_ATTEMPTS}):`, falRes.status, falText.slice(0, 400))

        // Stop immediately on success or permanent client errors (4xx), except 429 which may be retried
        if (falRes.ok) break
        if (falRes.status >= 400 && falRes.status < 500 && falRes.status !== 429) break

        if (attempt < MAX_ATTEMPTS) {
          let delay: number
          if (falRes.status === 429) {
            // Respect Retry-After header if present, otherwise fall back to linear backoff
            const retryAfter = falRes.headers.get('Retry-After')
            delay = retryAfter ? parseFloat(retryAfter) * 1000 : 1000 * attempt + Math.random() * 500
            console.log(`fal.ai rate limited (429), retrying in ${Math.round(delay)}ms…`)
          } else {
            delay = 1000 * attempt + Math.random() * 500 // linear backoff with jitter
            console.log(`fal.ai ${falRes.status}, retrying in ${Math.round(delay)}ms…`)
          }
          await new Promise(r => setTimeout(r, delay))
        }
      } catch (fetchErr: any) {
        clearTimeout(timeoutId)
        if (fetchErr.name === 'AbortError') {
          console.error(`fal.ai timed out after ${TIMEOUT_MS}ms (attempt ${attempt}/${MAX_ATTEMPTS})`)
          if (attempt === MAX_ATTEMPTS) {
            return json({ error: 'Image generation timed out — please try again' }, 504)
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
      return json({ error: `fal.ai error: ${falText}` }, falRes!.status)
    }

    let falData: any
    try { falData = JSON.parse(falText) }
    catch { return json({ error: `fal.ai non-JSON response: ${falText}` }, 500) }

    // Extract image URL from response
    const images = falData.images ?? falData.data?.images
    if (!images || images.length === 0) {
      console.error('No images in response:', falText)
      return json({ error: 'fal.ai returned no images', raw: falData }, 500)
    }

    await incrementUsage(supabaseAdmin, userId, 'image')

    return json({ images })

  } catch (err) {
    console.error('fal-generate error:', err)
    return json({ error: err.message }, 500)
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  })
}

