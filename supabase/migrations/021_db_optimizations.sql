-- ─── Migration 021: DB Optimizations ─────────────────────────────────────────
--
-- 1. character_images UPDATE RLS policy (was missing — only SELECT/INSERT/DELETE existed)
-- 2. Unique partial index on character_images(job_id) for dedup-safe inserts
-- 3. generation_jobs cleanup function for old completed/failed jobs
-- 4. Index on generation_jobs(user_id, created_at) for faster session restore
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Allow users to update their own character images (e.g. label edits)
CREATE POLICY "character_images_update" ON character_images
  FOR UPDATE USING (user_id = auth.uid());

-- 2. Unique partial index on job_id (only for non-null job_ids) so that
--    duplicate INSERT attempts for the same generation job are rejected by
--    the DB rather than requiring a pre-check SELECT.
CREATE UNIQUE INDEX IF NOT EXISTS idx_character_images_job_id_unique
  ON character_images (job_id)
  WHERE job_id IS NOT NULL;

-- 3. Cleanup function: removes generation_jobs older than a given age.
--    Call periodically (e.g. from a cron edge function or manual maintenance)
--    to prevent unbounded table growth from completed/failed jobs.
--
--    Usage: SELECT cleanup_old_generation_jobs(interval '30 days');
CREATE OR REPLACE FUNCTION cleanup_old_generation_jobs(retention_interval INTERVAL DEFAULT '30 days')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM generation_jobs
  WHERE status IN ('complete', 'failed')
    AND completed_at < now() - retention_interval;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_generation_jobs IS
  'Removes completed/failed generation jobs older than the given retention interval. '
  'Default: 30 days. Does not touch queued or generating jobs.';

-- 4. Composite index for the initialize() query that restores active jobs.
--    The existing partial index (idx_gen_jobs_active) covers (user_id, status, session_id)
--    but only for WHERE status IN ('queued', 'generating'). This additional index
--    supports the ORDER BY created_at clause for faster session restoration.
CREATE INDEX IF NOT EXISTS idx_gen_jobs_user_created
  ON generation_jobs (user_id, created_at)
  WHERE status IN ('queued', 'generating');
