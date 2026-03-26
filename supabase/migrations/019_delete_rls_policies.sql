-- ── 019_delete_rls_policies.sql ───────────────────────────────────────────────
-- Adds DELETE RLS policies for tables that were created without them.
-- Without these policies, any attempt to DELETE a row is silently blocked by
-- Postgres (returns 0 rows affected) or throws a policy violation error,
-- causing the UI to show "failed to delete" even though nothing was deleted.
--
-- Tables covered:
--   • characters        — users can delete their own characters
--   • character_drafts  — users can delete their own drafts
-- ─────────────────────────────────────────────────────────────────────────────

-- ── characters ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'characters'
      AND policyname = 'Users can delete their own characters'
  ) THEN
    CREATE POLICY "Users can delete their own characters"
      ON public.characters
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── character_drafts ──────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'character_drafts'
      AND policyname = 'Users can delete their own character drafts'
  ) THEN
    CREATE POLICY "Users can delete their own character drafts"
      ON public.character_drafts
      FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
