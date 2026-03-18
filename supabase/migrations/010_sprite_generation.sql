-- ─── Migration 010: Sprite Generation Feature ────────────────────────────────
--
-- Adds new columns to the characters table to support the /sprites/generate
-- flow. All new columns are nullable with null defaults to ensure full backward
-- compatibility with all existing character records.
--
-- New columns:
--   creation_source             — 'sprites' | 'characters' (defaults to 'characters')
--   reference_image_url         — URL of the uploaded/pre-loaded reference image
--   character_consistency_prompt — Immutable Claude vision analysis result
--   sprite_images               — JSONB array of generated sprite image objects
--
-- Notes:
--   • creation_source has a DEFAULT so existing records get 'characters'
--     automatically. No backfill needed.
--   • character_consistency_prompt is intentionally NOT linked to character_prompt.
--     They are semantically distinct:
--       character_prompt            = roleplay identity system prompt (wizard flow)
--       character_consistency_prompt = visual consistency descriptor (sprites flow)
--   • sprite_images entries: { url, generated_at, seed, params_snapshot }
--   • reference_image_base64 is intentionally NOT stored in the DB to avoid
--     bloating Postgres TEXT columns with multi-MB payloads. Base64 is only
--     used transiently in the browser for the analysis call.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. creation_source ────────────────────────────────────────────────────────
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS creation_source TEXT NOT NULL DEFAULT 'characters';

-- ── 2. reference_image_url ────────────────────────────────────────────────────
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS reference_image_url TEXT;

-- ── 3. character_consistency_prompt ──────────────────────────────────────────
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS character_consistency_prompt TEXT;

-- ── 4. sprite_images ─────────────────────────────────────────────────────────
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS sprite_images JSONB;

-- ── 5. Supabase Storage bucket for reference images ──────────────────────────
-- Creates a private bucket for reference image uploads. Access is controlled
-- via RLS policies on the storage.objects table.
-- Note: Run this in the Supabase dashboard SQL editor or via CLI.
-- The INSERT is idempotent — if the bucket already exists, nothing happens.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reference-images',
  'reference-images',
  false,
  10485760,  -- 10 MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── 6. Storage RLS — authenticated users can upload/read their own images ─────
-- CREATE POLICY does not support IF NOT EXISTS, so we guard each policy
-- creation with a DO block that checks pg_policies first.

DO $$
BEGIN
  -- Upload policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Users can upload their own reference images'
  ) THEN
    CREATE POLICY "Users can upload their own reference images"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'reference-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Read policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Users can read their own reference images'
  ) THEN
    CREATE POLICY "Users can read their own reference images"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'reference-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  -- Delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Users can delete their own reference images'
  ) THEN
    CREATE POLICY "Users can delete their own reference images"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'reference-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
