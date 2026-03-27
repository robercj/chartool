# Database Utilities

> Maintenance queries and scripts for Supabase database operations.

**Warning:** Always backup your database before running destructive queries.

---

## Table of Contents

1. [Generation Queue Management](#generation-queue-management)
2. [Egress Optimization](#egress-optimization)
3. [User Data Management](#user-data-management)
4. [Troubleshooting](#troubleshooting)

---

## Generation Queue Management

### Clear All Pending Generations

Removes all queued and in-progress generation jobs. Use when the queue is stuck or overloaded.

```sql
-- Mark all pending jobs as failed
UPDATE generation_jobs 
SET status = 'failed', 
    error_message = 'Cleared by admin',
    completed_at = NOW()
WHERE status IN ('queued', 'generating');
```

**When to use:** Queue is stuck, jobs not processing, or clearing a backlog.

---

### Delete Pending Generations

Permanently removes pending jobs without marking them as failed.

```sql
DELETE FROM generation_jobs 
WHERE status IN ('queued', 'generating');
```

**When to use:** Cleanup after migration or when you don't need the failed job records.

---

### Clear Pending Jobs for Specific User

```sql
DELETE FROM generation_jobs 
WHERE user_id = 'USER-UUID-HERE' 
AND status IN ('queued', 'generating');
```

**When to use:** A specific user's jobs are stuck and blocking the queue.

---

### View Queue Status

Check how many jobs are pending, generating, complete, or failed.

```sql
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM generation_jobs
GROUP BY status
ORDER BY status;
```

---

### View User's Active Jobs

```sql
SELECT 
  id,
  context_type,
  status,
  created_at,
  generation_params->>'prompt' as prompt_preview
FROM generation_jobs
WHERE user_id = 'USER-UUID-HERE'
AND status IN ('queued', 'generating')
ORDER BY created_at DESC;
```

---

## Egress Optimization

### Check Large Tables

Identify which tables are consuming the most storage (affects egress when queried).

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  pg_total_relation_size(schemaname||'.'||tablename) as bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

### View Existing Database Views

Lists all views created for optimized queries.

```sql
SELECT 
  viewname, 
  definition
FROM pg_views 
WHERE schemaname = 'public'
AND viewname LIKE '%cards%';
```

---

### Recreate Character Cards Views

If views were not applied via migration, run manually:

```sql
-- View for finalized characters (gallery cards)
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

-- View for character drafts
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
```

---

## User Data Management

### Delete User's All Data

**Warning:** This is destructive. Use with caution.

```sql
-- Get user's IDs first (run SELECT to verify)
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Then delete (in order due to foreign keys)
-- 1. Delete generation jobs
DELETE FROM generation_jobs WHERE user_id = 'USER-UUID';
-- 2. Delete character images
DELETE FROM character_images WHERE user_id = 'USER-UUID';
-- 3. Delete prompt history (via characters)
DELETE FROM character_prompt_history 
WHERE character_id IN (SELECT id FROM characters WHERE user_id = 'USER-UUID');
-- 4. Delete characters
DELETE FROM characters WHERE user_id = 'USER-UUID';
-- 5. Delete character drafts
DELETE FROM character_drafts WHERE user_id = 'USER-UUID';
-- 6. Delete storylines (via batches)
DELETE FROM storylines WHERE user_id = 'USER-UUID';
-- 7. Delete auth user
DELETE FROM auth.users WHERE id = 'USER-UUID';
```

---

### Check User's Storage Usage

```sql
SELECT 
  (SELECT COUNT(*) FROM characters WHERE user_id = 'USER-UUID') as characters,
  (SELECT COUNT(*) FROM character_drafts WHERE user_id = 'USER-UUID') as drafts,
  (SELECT COUNT(*) FROM character_images WHERE user_id = 'USER-UUID') as images,
  (SELECT COUNT(*) FROM generation_jobs WHERE user_id = 'USER-UUID') as jobs;
```

---

## Troubleshooting

### Check for Missing Indexes

```sql
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

---

### Check RLS Policies

```sql
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

### Check Recent Errors in Logs

```sql
-- Requires supabase admin access
SELECT 
  payload->>'timestamp' as time,
  payload->>'error' as error,
  payload->>'schema_name' as schema
FROM supabase_functions.invocations
WHERE payload->>'status' = 'error'
ORDER BY payload->>'timestamp' DESC
LIMIT 20;
```

---

### Kill Long-Running Queries

```sql
-- Find long-running queries
SELECT 
  pid,
  now() - pg_stat_activity.query_start AS duration,
  query,
  state
FROM pg_stat_activity
WHERE state = 'active' 
AND now() - pg_stat_activity.query_start > interval '5 minutes'
AND query NOT LIKE '%pg_%';
```

To cancel a specific query (replace PID):

```sql
SELECT pg_cancel_backend(PID_HERE);
```

To forcefully terminate:

```sql
SELECT pg_terminate_backend(PID_HERE);
```

---

## Notes

- **Egress** = data transferred out of Supabase (every SELECT response counts)
- **Storage** = actual database disk usage
- Character cards view reduces egress by ~80% by selecting only 8 columns vs 20+
- All queries should use explicit column selection, not `SELECT *`

---

## Migration History

| Date | Migration | Description |
|------|-----------|-------------|
| 2026-03-27 | 020 | Add character_cards and character_draft_cards views |
| 2026-03-27 | 019 | Add DELETE RLS policies for characters and drafts |
