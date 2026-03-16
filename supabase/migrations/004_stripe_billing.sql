-- ─── 004_stripe_billing.sql ───────────────────────────────────────────────────
-- Adds Stripe billing support: subscription tracking, customer IDs, and
-- price/product configuration per tier.
-- Run this after the initial schema migrations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Add Stripe customer ID to profiles ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE;

-- ── Add Stripe subscription details to profiles ──────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_subscription_id   text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status text,        -- active | trialing | canceled | past_due | unpaid
  ADD COLUMN IF NOT EXISTS subscription_period_end  timestamptz;   -- current period end (for access control)

-- ── Add Stripe price IDs to tiers ────────────────────────────────────────────
-- Each tier row gets a stripe_price_id for monthly recurring billing.
-- Populate these with actual Stripe Price IDs after creating products in Stripe Dashboard.
ALTER TABLE public.tiers
  ADD COLUMN IF NOT EXISTS stripe_price_id          text UNIQUE,    -- e.g. price_xxxxxxxxxxxxx
  ADD COLUMN IF NOT EXISTS stripe_product_id        text UNIQUE,    -- e.g. prod_xxxxxxxxxxxxx
  ADD COLUMN IF NOT EXISTS price_monthly_cents      integer,        -- display price in cents (e.g. 999 = $9.99)
  ADD COLUMN IF NOT EXISTS features                 text[];         -- marketing feature list for pricing page

-- ── Populate tier price display info (update price IDs after Stripe setup) ──
UPDATE public.tiers SET
  price_monthly_cents = 0,
  features = ARRAY[
    '15 image generations/month',
    '3 storyline prompts/month',
    'Basic character analysis',
    'Standard art styles'
  ]
WHERE id = 'free';

UPDATE public.tiers SET
  price_monthly_cents = 999,
  features = ARRAY[
    '100 image generations/month',
    '20 storyline prompts/month',
    'Advanced character analysis',
    'All art styles',
    'Priority generation queue',
    'Background removal included'
  ]
WHERE id = 'pro';

UPDATE public.tiers SET
  price_monthly_cents = 2999,
  features = ARRAY[
    'Unlimited monthly generations',
    '25+ storyline prompts/day',
    'Advanced character analysis',
    'All art styles',
    'Priority generation queue',
    'Background removal included',
    'Bulk export (ZIP)',
    'Dedicated support'
  ]
WHERE id = 'enterprise';

-- ── Subscription events log ───────────────────────────────────────────────────
-- Stores raw Stripe webhook events for idempotency and audit trail.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id              text        PRIMARY KEY, -- Stripe event ID (evt_xxxxx)
  type            text        NOT NULL,
  data            jsonb       NOT NULL,
  processed_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- RLS: stripe_events is only accessible server-side (service role).
-- No user-facing RLS needed since webhook handler uses service role key.
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No user policies — admin/service role only.

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription ON public.profiles(stripe_subscription_id);

-- ── Helper function: sync_tier_from_subscription ─────────────────────────────
-- Called by the webhook handler to update a user's tier based on subscription status.
CREATE OR REPLACE FUNCTION public.sync_tier_from_subscription(
  p_stripe_customer_id   text,
  p_stripe_price_id      text,
  p_subscription_id      text,
  p_subscription_status  text,
  p_period_end           timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tier_id text;
BEGIN
  -- Resolve tier from price ID
  SELECT id INTO v_tier_id
  FROM public.tiers
  WHERE stripe_price_id = p_stripe_price_id
  LIMIT 1;

  -- Default to 'free' if subscription is canceled/unpaid or price not found
  IF p_subscription_status IN ('canceled', 'unpaid') OR v_tier_id IS NULL THEN
    v_tier_id := 'free';
  END IF;

  -- Update profile
  UPDATE public.profiles SET
    tier_id                    = v_tier_id,
    stripe_subscription_id     = p_subscription_id,
    stripe_subscription_status = p_subscription_status,
    subscription_period_end    = p_period_end
  WHERE stripe_customer_id = p_stripe_customer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_tier_from_subscription TO service_role;
