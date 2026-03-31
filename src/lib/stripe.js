// ─── stripe.js ────────────────────────────────────────────────────────────────
// Client-side Stripe utilities.
// Actual Stripe API calls go through Supabase Edge Functions to keep secret
// keys server-side only.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase'

/**
 * Creates a Stripe Checkout Session and redirects the user to the hosted
 * checkout page for the given price ID.
 *
 * @param {string} priceId — Stripe Price ID (price_xxx) from the tiers table
 * @throws {Error} if the checkout session could not be created
 */
export async function redirectToCheckout(priceId) {
  const { data, error } = await supabase.functions.invoke('stripe-checkout', {
    body: { priceId },
  })

  if (error) throw new Error(error.message || 'Failed to create checkout session')
  if (!data?.url) throw new Error('No checkout URL returned')

  window.location.href = data.url
}

/**
 * Opens the Stripe Customer Portal for managing subscriptions and billing.
 *
 * NOTE: The `stripe-portal` edge function has NOT been implemented yet.
 * This function will fail until the edge function is created and deployed.
 * See: supabase/functions/stripe-portal/ (does not exist yet)
 *
 * Requires the portal to be configured in the Stripe Dashboard:
 * https://dashboard.stripe.com/settings/billing/portal
 *
 * @throws {Error} if the portal session could not be created
 */
export async function redirectToCustomerPortal() {
  const { data, error } = await supabase.functions.invoke('stripe-portal', {
    body: {},
  })

  if (error) throw new Error(error.message || 'Failed to open billing portal')
  if (!data?.url) throw new Error('No portal URL returned')

  window.location.href = data.url
}
