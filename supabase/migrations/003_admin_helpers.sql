-- ============================================================
-- Admin Helpers — run these manually in Supabase SQL Editor
-- as needed. These are NOT part of the automatic migration.
-- ============================================================

-- ─── Promote a user to a different tier ───────────────────────────────────────
-- Replace the email and tier_id values as needed.
-- Tier IDs: 'free' | 'pro' | 'enterprise'

-- Example: upgrade user@example.com to Pro
-- UPDATE public.profiles
--   SET tier_id = 'pro'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

-- Example: upgrade to Enterprise
-- UPDATE public.profiles
--   SET tier_id = 'enterprise'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');

-- ─── View all users with their tiers and usage ────────────────────────────────
-- SELECT
--   u.email,
--   p.display_name,
--   p.tier_id,
--   t.display_name AS tier_name,
--   COALESCE(img.count, 0) AS images_this_month,
--   COALESCE(sty.count, 0) AS stories_this_month,
--   p.created_at
-- FROM auth.users u
-- JOIN public.profiles p ON p.id = u.id
-- JOIN public.tiers t ON t.id = p.tier_id
-- LEFT JOIN public.usage img ON img.user_id = u.id AND img.type = 'image'
--   AND img.period = date_trunc('month', now())::date
-- LEFT JOIN public.usage sty ON sty.user_id = u.id AND sty.type = 'story'
--   AND sty.period = date_trunc('month', now())::date
-- ORDER BY p.created_at DESC;

-- ─── Update tier limits (no code deploy needed) ────────────────────────────────
-- Example: increase Free tier to 20 images
-- UPDATE public.tiers SET monthly_image_limit = 20 WHERE id = 'free';

-- Example: add daily cap to Pro tier
-- UPDATE public.tiers SET daily_image_limit = 50 WHERE id = 'pro';
