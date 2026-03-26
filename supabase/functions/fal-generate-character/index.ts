// ─── fal-generate-character/index.ts ─────────────────────────────────────────
// Text-to-image generation via fal-ai/nano-banana-2 (no reference image needed).
// Used by the character creation wizard (GenerateCharacter.jsx).
//
// Required Supabase secrets:
//   CharacterForge  — Supabase admin key (sb_secret_...)
//   FAL_KEY         — fal.ai API key
//
// Deploy with: supabase functions deploy fal-generate-character --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { extractUserId } from '../_shared/auth.ts'
import { checkLimit, incrementUsage } from '../_shared/limits.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Uses nano-banana-2 (text-to-image) - no reference image required
const FAL_MODEL = 'fal-ai/nano-banana-2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseSecretKey = Deno.env.get('CharacterForge')!

    if (!supabaseSecretKey) {
      return json({ error: 'CharacterForge secret not configured in Edge Function secrets.' }, 500)
    }

    const auth = extractUserId(req)
    if (!auth.ok) return json({ error: auth.error }, auth.status)
    const { userId } = auth
    console.log('Authenticated user:', userId)

    const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey)

    // Check image generation limit
    const { allowed, reason } = await checkLimit(supabaseAdmin, userId, 'image')
    if (!allowed) return json({ error: reason }, 429)

    const falKey = Deno.env.get('FAL_KEY')
    if (!falKey) throw new Error('FAL_KEY secret not set')

    const { prompt, seed, aspect_ratio = '9:16', num_images = 1 } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return json({ error: 'Prompt is required' }, 400)
    }

    // Build fal.ai input - NO reference image required for nano-banana-2
    const falInput = {
      prompt,
      aspect_ratio,
      num_images,
      output_format: 'png',
      resolution: '1K',
      ...(seed !== null && seed !== undefined && { seed }),
    }

    console.log('Calling fal.ai nano-banana-2 for character generation, prompt:', prompt.slice(0, 80))

    // Retry up to 3 attempts with linear backoff + jitter
    const MAX_ATTEMPTS = 3
    const TIMEOUT_MS = 90_000
    let falRes!: Response
    let falText = ''

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => timeoutController.abort(), TIMEOUT_MS)

      try {
        falRes = await fetch(`https://fal.run/${FAL_MODEL}`, {
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

        if (falRes.ok) break
        if (falRes.status >= 400 && falRes.status < 500 && falRes.status !== 429) break

        if (attempt < MAX_ATTEMPTS) {
          let delay: number
          if (falRes.status === 429) {
            const retryAfter = falRes.headers.get('Retry-After')
            delay = retryAfter ? parseFloat(retryAfter) * 1000 : 1000 * attempt + Math.random() * 500
            console.log(`fal.ai rate limited (429), retrying in ${Math.round(delay)}ms…`)
          } else {
            delay = 1000 * attempt + Math.random() * 500
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

    const images = falData.images ?? falData.data?.images
    if (!images || images.length === 0) {
      console.error('No images in response:', falText)
      return json({ error: 'fal.ai returned no images', raw: falData }, 500)
    }

    await incrementUsage(supabaseAdmin, userId, 'image')

    // Return images with seed info
    return json({ 
      images: images.map((img: any) => ({
        url: img.url,
        seed: img.seed ?? seed,
      })),
      request_id: falData.request_id,
    })

  } catch (err) {
    console.error('fal-generate-character error:', err)
    return json({ error: err.message }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  })
}

