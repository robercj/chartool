-- ─── 014_character_images_v2 ──────────────────────────────────────────────────
-- Simple image-to-character binding: one row per generated image.
-- Uses denormalized user_id for fast RLS (no subqueries).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE character_images (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id    UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url             TEXT        NOT NULL,
  label           TEXT,
  seed            INTEGER,
  pose_id         TEXT,
  emotion_entry   JSONB,
  params_snapshot JSONB,
  generation_type TEXT        NOT NULL DEFAULT 'sprite',
  job_id          UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_character_images_character ON character_images (character_id);
CREATE INDEX idx_character_images_user ON character_images (user_id);

ALTER TABLE character_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "character_images_select" ON character_images
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "character_images_insert" ON character_images
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "character_images_delete" ON character_images
  FOR DELETE USING (user_id = auth.uid());
