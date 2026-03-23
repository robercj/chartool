-- ── 018_fix_usage_type_constraint.sql ────────────────────────────────────────
-- Migration 016 added the 'character' quota type to tiers and anthropic-proxy
-- but forgot to extend the usage.type CHECK constraint. Any call to
-- increment_usage(..., 'character', ...) throws a constraint violation,
-- causing all character LLM steps to return 500 after a successful AI call.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.usage
  DROP CONSTRAINT IF EXISTS usage_type_check;

ALTER TABLE public.usage
  ADD CONSTRAINT usage_type_check
  CHECK (type IN ('image', 'story', 'character'));
