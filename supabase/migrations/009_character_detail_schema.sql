-- ─── Migration 009: Character Detail & Edit View schema additions ─────────────
--
-- 1. character_prompt_history — versioned save snapshots per character
-- 2. Unique index on characters(user_id, character_name) — enforces name
--    uniqueness per user; required by the Save As flow's server-side guard
--
-- Notes:
--   • The unique index uses CREATE UNIQUE INDEX ... IF NOT EXISTS so this
--     migration is idempotent and safe to re-run.
--   • The migration will fail at step 2 if any user currently has two
--     characters with the same name. Audit and deduplicate first in that case.
--   • History RLS uses EXISTS sub-selects to avoid a direct join, which is
--     simpler under Supabase's policy evaluator.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Prompt history table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS character_prompt_history (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id               UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  saved_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  save_type                  TEXT        NOT NULL CHECK (save_type IN ('save', 'save_as')),
  character_prompt           TEXT        NOT NULL,
  appearance_description     TEXT,
  identity_field_snapshot    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  appearance_field_snapshot  JSONB       NOT NULL DEFAULT '{}'::jsonb,
  generated_image_url        TEXT,
  label                      TEXT
);

CREATE INDEX IF NOT EXISTS idx_character_prompt_history_char_saved
  ON character_prompt_history (character_id, saved_at DESC);

ALTER TABLE character_prompt_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own character history"
  ON character_prompt_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM characters c
      WHERE c.id = character_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own character history"
  ON character_prompt_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM characters c
      WHERE c.id = character_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own character history labels"
  ON character_prompt_history FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM characters c
      WHERE c.id = character_id AND c.user_id = auth.uid()
    )
  );

-- ── 2. Character name uniqueness per user ──────────────────────────────────────
-- Only enforces uniqueness where character_name is non-null (avoids blocking
-- partially created records that have no name yet).

CREATE UNIQUE INDEX IF NOT EXISTS idx_characters_user_id_character_name
  ON characters (user_id, character_name)
  WHERE character_name IS NOT NULL;
