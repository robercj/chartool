-- ─── 012_generation_jobs_queue ───────────────────────────────────────────────
-- Tracks image generation jobs for navigation-safe, background generation.
-- Allows users to navigate away mid-generation and return to see results.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generation_jobs (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id          UUID        NOT NULL,
  context_type        TEXT        NOT NULL CHECK (context_type IN ('sprite', 'character_appearance', 'storyline')),
  context_id          UUID        NOT NULL,
  status              TEXT        NOT NULL CHECK (status IN ('queued', 'generating', 'complete', 'failed')) DEFAULT 'queued',
  image_url           TEXT,
  error_message       TEXT,
  generation_params   JSONB       NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

-- Index for active jobs lookup (navbar progress bar)
CREATE INDEX idx_gen_jobs_active ON generation_jobs (user_id, status)
  WHERE status IN ('queued', 'generating');

-- Index for session grouping (in-progress viewer)
CREATE INDEX idx_gen_jobs_session ON generation_jobs (session_id);

-- Index for context lookup (attach images to parent records)
CREATE INDEX idx_gen_jobs_context ON generation_jobs (context_id, context_type);

-- RLS: users only see/modify their own jobs
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
  ON generation_jobs FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own jobs"
  ON generation_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own jobs"
  ON generation_jobs FOR UPDATE
  USING (user_id = auth.uid());
