-- ─── 013_character_images ────────────────────────────────────────────────────
-- Simple image-to-character binding: one row per generated image.
-- Replaces complex session/queue state with direct DB persistence.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS character_images (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id    UUID        NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
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
CREATE INDEX idx_character_images_job ON character_images (job_id);

ALTER TABLE character_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own character images"
  ON character_images FOR SELECT
  USING (
    character_id IN (
      SELECT id FROM characters WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert character images"
  ON character_images FOR INSERT
  WITH CHECK (
    character_id IN (
      SELECT id FROM characters WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own character images"
  ON character_images FOR DELETE
  USING (
    character_id IN (
      SELECT id FROM characters WHERE user_id = auth.uid()
    )
  );
