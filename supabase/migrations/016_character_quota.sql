-- ── 016_character_quota.sql ──────────────────────────────────────────────────
-- Adds monthly_character_limit to the tiers table and updates all tier limits
-- to the new quota structure agreed in the code review:
--
--   Free        — 10 images/mo, 5 characters/mo, 5 storylines/mo
--   Pro         — 50 images/mo, 20 characters/mo, 20 storylines/mo
--   Enterprise  — unlimited (NULL) for all three; daily image cap (100/day)
--                 enforced separately via daily_image_limit column (existing)
--
-- Note: free-tier image limit drops from 15 → 10 and pro from 100 → 50.
--       Existing users are unaffected until the next billing period reset
--       (usage counters are monthly, so the lower cap applies immediately
--       only if current-month usage already exceeds the new limit).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tiers
  ADD COLUMN IF NOT EXISTS monthly_character_limit integer DEFAULT NULL;

-- ── Free tier ─────────────────────────────────────────────────────────────────
UPDATE public.tiers SET
  monthly_image_limit     = 10,
  monthly_story_limit     = 5,
  monthly_character_limit = 5,
  features = ARRAY[
    '10 image generations/month',
    '5 character creations/month',
    '5 storyline prompts/month',
    'Basic character analysis',
    'Standard art styles'
  ]
WHERE id = 'free';

-- ── Pro tier ──────────────────────────────────────────────────────────────────
UPDATE public.tiers SET
  monthly_image_limit     = 50,
  monthly_story_limit     = 20,
  monthly_character_limit = 20,
  features = ARRAY[
    '50 image generations/month',
    '20 character creations/month',
    '20 storyline prompts/month',
    'Advanced character analysis',
    'All art styles',
    'Priority generation queue',
    'Background removal included'
  ]
WHERE id = 'pro';

-- ── Enterprise tier ───────────────────────────────────────────────────────────
-- monthly limits stay NULL (unlimited); daily_image_limit = 100 stays as-is
UPDATE public.tiers SET
  monthly_image_limit     = NULL,
  monthly_story_limit     = NULL,
  monthly_character_limit = NULL,
  features = ARRAY[
    'Unlimited monthly generations',
    'Unlimited character creations',
    '100 image generations/day',
    '25+ storyline prompts/day',
    'Advanced character analysis',
    'All art styles',
    'Priority generation queue',
    'Background removal included',
    'Bulk export (ZIP)',
    'Dedicated support'
  ]
WHERE id = 'enterprise';
