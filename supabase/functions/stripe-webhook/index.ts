// ─── stripe-webhook/index.ts ──────────────────────────────────────────────────
// Handles Stripe webhook events for subscription lifecycle management.
//
// Stripe Dashboard → Webhooks → Add endpoint:
//   URL: https://<project-ref>.supabase.co/functions/v1/stripe-webhook
//   Events to listen for:
//     - customer.subscription.created
//     - customer.subscription.updated
//     - customer.subscription.deleted
//     - invoice.payment_succeeded
//     - invoice.payment_failed
//     - checkout.session.completed
//
// Required secrets:
//   STRIPE_SECRET_KEY      — Stripe secret key
//   STRIPE_WEBHOOK_SECRET  — Webhook signing secret (whsec_...)
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req: Request) => {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), { status: 400 })
  }

  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

  if (!webhookSecret || !stripeKey) {
    console.error('[stripe-webhook] Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY')
    return new Response(JSON.stringify({ error: 'Webhook not configured' }), { status: 500 })
  }

  // ── Verify Stripe signature ─────────────────────────────────────────────
  // Manual HMAC verification since we can't use the Stripe Node SDK in Deno
  const signatureParts = signature.split(',')
  const timestampPart = signatureParts.find(p => p.startsWith('t='))?.replace('t=', '')
  const v1Signatures = signatureParts.filter(p => p.startsWith('v1=')).map(p => p.replace('v1=', ''))

  if (!timestampPart || v1Signatures.length === 0) {
    return new Response(JSON.stringify({ error: 'Invalid signature format' }), { status: 400 })
  }

  // Verify timestamp is recent (within 5 minutes)
  const timestamp = parseInt(timestampPart, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > 300) {
    return new Response(JSON.stringify({ error: 'Webhook timestamp too old' }), { status: 400 })
  }

  // Compute expected signature
  const payload = `${timestampPart}.${body}`
  const encoder = new TextEncoder()
  const keyData = encoder.encode(webhookSecret)
  const msgData = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const computedSig = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (!v1Signatures.some(sig => sig === computedSig)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 400 })
  }

  // ── Parse event ─────────────────────────────────────────────────────────
  let event: { id: string; type: string; data: { object: Record<string, unknown> } }
  try {
    event = JSON.parse(body)
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── Idempotency check ────────────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('stripe_events')
    .select('id')
    .eq('id', event.id)
    .maybeSingle()

  if (existing) {
    // Already processed — return 200 to acknowledge
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
  }

  // ── Log event ────────────────────────────────────────────────────────────
  await supabaseAdmin.from('stripe_events').insert({
    id: event.id,
    type: event.type,
    data: event.data,
  })

  // ── Handle event types ───────────────────────────────────────────────────
  const obj = event.data.object as Record<string, unknown>

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode === 'subscription' && obj.subscription) {
          // Fetch full subscription to get price ID
          const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${obj.subscription}`, {
            headers: { 'Authorization': `Bearer ${stripeKey}` }
          })
          const sub = await subRes.json()
          const priceId = sub.items?.data?.[0]?.price?.id
          const periodEnd = new Date(sub.current_period_end * 1000).toISOString()

          await supabaseAdmin.rpc('sync_tier_from_subscription', {
            p_stripe_customer_id: obj.customer,
            p_stripe_price_id: priceId,
            p_subscription_id: sub.id,
            p_subscription_status: sub.status,
            p_period_end: periodEnd,
          })
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const priceId = (obj.items as { data: Array<{ price: { id: string } }> })?.data?.[0]?.price?.id
        const periodEnd = new Date((obj.current_period_end as number) * 1000).toISOString()

        await supabaseAdmin.rpc('sync_tier_from_subscription', {
          p_stripe_customer_id: obj.customer,
          p_stripe_price_id: priceId ?? null,
          p_subscription_id: obj.id,
          p_subscription_status: obj.status,
          p_period_end: periodEnd,
        })
        break
      }

      case 'customer.subscription.deleted': {
        // Downgrade to free on cancellation — RPC handles tier resolution consistently
        await supabaseAdmin.rpc('sync_tier_from_subscription', {
          p_stripe_customer_id: obj.customer,
          p_stripe_price_id: null,
          p_subscription_id: obj.id,
          p_subscription_status: 'canceled',
          p_period_end: null,
        })
        break
      }

      case 'invoice.payment_failed': {
        // Mark subscription as past_due — access remains until period ends
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_subscription_status: 'past_due' })
          .eq('stripe_customer_id', obj.customer)
        break
      }

      case 'invoice.payment_succeeded': {
        // Ensure status is active after successful payment
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_subscription_status: 'active' })
          .eq('stripe_customer_id', obj.customer)
        break
      }

      default:
        // Unhandled event type — log and acknowledge
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`)
    }
  } catch (handlerErr) {
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, handlerErr)
    // Return 500 so Stripe retries
    return new Response(JSON.stringify({ error: 'Handler error' }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
