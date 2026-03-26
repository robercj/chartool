-- ─── Migration 020: Character Cards View ───────────────────────────────────────
--
-- Creates Postgres views for optimized gallery card queries.
-- This enforces OPT-01 at the database level, preventing accidental
-- full-row selects even if client-side code changes.
--
-- The views expose only columns needed for gallery card rendering.
-- RLS is handled via the base table policies - views inherit RLS from
-- the underlying table when querying through PostgREST.
-- ─────────────────────────────────────────────────────────────────────────────

-- View for finalized characters
CREATE OR REPLACE VIEW character_cards AS
SELECT
  id,
  character_name,
  generated_image_url,
  creation_status,
  creation_source,
  archetype,
  assigned_story_id,
  created_at,
  user_id
FROM characters;

COMMENT ON VIEW character_cards IS
  'Optimized view for gallery card rendering. '
  'Exposes only minimal columns needed for character thumbnails. '
  'Use this view instead of the base characters table for list/gallery queries.';

-- View for character drafts
-- Note: character_drafts has fewer columns than characters table
CREATE OR REPLACE VIEW character_draft_cards AS
SELECT
  id,
  character_name,
  generated_image_url,
  creation_status,
  assigned_story_id,
  last_modified_at,
  user_id
FROM character_drafts;

COMMENT ON VIEW character_draft_cards IS
  'Optimized view for draft card rendering. '
  'Exposes only minimal columns needed for draft thumbnails. '
  'Use this view instead of the base character_drafts table for list/gallery queries.';
