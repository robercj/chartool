-- ─── 022_multi_reference_art_style.sql ────────────────────────────────────────
-- Multi-Reference Images & Art Style Override
-- Adds columns to support multiple character reference images and tracks
-- how many images were used in the analysis that produced the current
-- character_consistency_prompt.
--
-- Art style analysis is session-only (React state) and is NOT persisted.
-- ─────────────────────────────────────────────────────────────────────────────

-- Array of URLs for additional character reference images (beyond the primary).
-- Each entry: { "url": "<string>", "upload_order": <number> }
-- Nullable — null means single-image (legacy) or no additional refs.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS additional_reference_urls JSONB DEFAULT NULL;

-- Number of images included in the analysis that produced the current
-- character_consistency_prompt. 1 = single-image (legacy), 2–6 = multi-reference.
-- Nullable — null is interpreted as 1 by the UI for backward compatibility.
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS analysis_image_count INTEGER DEFAULT NULL;

-- Add the same columns to character_drafts for parity
ALTER TABLE character_drafts
  ADD COLUMN IF NOT EXISTS additional_reference_urls JSONB DEFAULT NULL;

ALTER TABLE character_drafts
  ADD COLUMN IF NOT EXISTS analysis_image_count INTEGER DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN characters.additional_reference_urls IS 'JSONB array of {url, upload_order} for additional character reference images used in multi-reference analysis';
COMMENT ON COLUMN characters.analysis_image_count IS 'Number of images used in the analysis that produced character_consistency_prompt. NULL = 1 (legacy single-image).';
