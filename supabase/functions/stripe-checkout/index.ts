// ─── stripe-checkout/index.ts ─────────────────────────────────────────────────
// Creates a Stripe Checkout Session for subscription upgrades.
//
// Required Stripe environment secrets (set via `supabase secrets set`):
//   STRIPE_SECRET_KEY      — Stripe secret key (sk_live_... or sk_test_...)
//   STRIPE_WEBHOOK_SECRET  — Stripe webhook signing secret (whsec_...)
//   APP_URL                — The base URL of the deployed app (for redirect URLs)
//
// Request body: { priceId: string }
// Returns:      { url: string }  — Stripe-hosted checkout URL
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const jwt = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Parse request ───────────────────────────────────────────────────────
    const { priceId } = await req.json()
    if (!priceId) {
      return new Response(JSON.stringify({ error: 'priceId is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Retrieve or create Stripe customer ──────────────────────────────────
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single()

    let customerId: string | undefined = profile?.stripe_customer_id ?? undefined

    if (!customerId) {
      // Create new Stripe customer
      const customerRes = await fetch('https://api.stripe.com/v1/customers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          email: user.email ?? profile?.email ?? '',
          metadata: JSON.stringify({ supabase_user_id: user.id }),
        }),
      })
      const customer = await customerRes.json()
      if (customer.error) throw new Error(`Stripe customer creation failed: ${customer.error.message}`)
      customerId = customer.id

      // Persist customer ID
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173'

    // ── Create Checkout Session ─────────────────────────────────────────────
    const sessionRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        mode: 'subscription',
        customer: customerId,
        'line_items[0][price]': priceId,
        'line_items[0][quantity]': '1',
        success_url: `${appUrl}/settings?upgrade=success`,
        cancel_url: `${appUrl}/settings?upgrade=cancelled`,
        'subscription_data[metadata][supabase_user_id]': user.id,
        // Allow promotional codes
        allow_promotion_codes: 'true',
        // Collect billing address
        billing_address_collection: 'auto',
      }),
    })

    const session = await sessionRes.json()
    if (session.error) {
      throw new Error(`Stripe checkout session failed: ${session.error.message}`)
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[stripe-checkout] Error:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
