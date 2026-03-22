-- ─── 015_queue_enhancements ─────────────────────────────────────────────────
-- Add character_name and thumbnail_url columns for better queue UI.
-- Add composite index for queue restoration query.
-- ─────────────────────────────────────────────────────────────────────────────

-- Add columns for queue display
ALTER TABLE generation_jobs 
  ADD COLUMN IF NOT EXISTS character_name TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Recreate active jobs index with session_id for better queue grouping
-- Note: Using regular CREATE INDEX (not CONCURRENTLY) for Supabase CLI compatibility
DROP INDEX IF EXISTS idx_gen_jobs_active;
CREATE INDEX IF NOT EXISTS idx_gen_jobs_user_active 
  ON generation_jobs (user_id, status, session_id) 
  WHERE status IN ('queued', 'generating');
