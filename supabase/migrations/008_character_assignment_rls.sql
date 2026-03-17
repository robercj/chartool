-- ─── Migration 008: Add UPDATE RLS policy to characters table ─────────────────
-- Required for Character Assignment Management (FDD v1.0.0).
-- Without this, any PATCH to `assigned_story_id` on a finalized character
-- is blocked by RLS and the assignment feature silently fails.
--
-- Scope: allows authenticated users to update only their own character records.
-- Character data immutability (FDD §1.1) is enforced at the application layer
-- (the UI only ever PATCHes `assigned_story_id`); this policy grants the
-- minimum necessary database permission.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE POLICY "Users can update their own characters"
  ON characters
  FOR UPDATE
  USING (auth.uid() = user_id);
