-- ─── Migration 011: Identity Lock Schema ─────────────────────────────────────
--
-- Adds structured identity lock column to the characters table.
-- This supports the identity-lock-v0 enhancement to the sprite generation
-- pipeline, which provides structured, machine-readable character identity
-- constraints for rigid prompt compilation.
--
-- New columns:
--   character_identity_lock  — JSONB structured identity lock from image analysis
--                              Schema: {
--                                immutable_traits: { face[], hair[], eyes[], outfit[] },
--                                forbidden_changes: string[],
--                                notes: string[]
--                              }
--
-- Notes:
--   • character_consistency_prompt (added in 010) is kept unchanged.
--     It remains the flat-text fallback used when character_identity_lock is null.
--   • character_identity_lock is populated by the updated analyzeReferenceImage()
--     function which now returns both formats in a single analysis pass.
--   • Existing characters with only character_consistency_prompt continue to
--     work — the prompt compiler falls back to the flat text automatically.
--   • No backfill is performed. Characters will gain the structured lock
--     the next time they are analyzed (re-analysis on existing character select).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. character_identity_lock ────────────────────────────────────────────────
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS character_identity_lock JSONB;

-- ── 2. Index for efficient JSONB queries (optional, for future filtering) ──────
CREATE INDEX IF NOT EXISTS idx_characters_identity_lock_not_null
  ON characters ((character_identity_lock IS NOT NULL))
  WHERE character_identity_lock IS NOT NULL;

-- ── 3. Comment for documentation ─────────────────────────────────────────────
COMMENT ON COLUMN characters.character_identity_lock IS
  'Structured identity lock JSON produced by Claude image analysis. '
  'Contains immutable_traits (face/hair/eyes/outfit), forbidden_changes, '
  'and notes. Used by the prompt compiler for rigid sprite generation. '
  'Null for characters analyzed before migration 011 — falls back to '
  'character_consistency_prompt (flat text) in that case.';
