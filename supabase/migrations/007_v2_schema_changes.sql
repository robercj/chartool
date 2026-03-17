-- ─── Migration 007: Generate Character v2.0 Schema Changes ────────────────────
-- Adds new columns required by the v2.0 FDD enhancement spec.
--
-- Changes:
--   character_drafts: + relationships JSONB, + character_prompt TEXT, + appearance_description TEXT
--   characters:       + relationships JSONB, + character_prompt TEXT, + appearance_description TEXT
--
-- Removed/deprecated fields (world_context, internal_monologue_style,
-- relationship_to_protagonist/authority/peers/love_interest, relationship_dynamics)
-- are LEFT IN PLACE as nullable columns for backward compatibility with
-- existing draft data. They are no longer populated by the UI after v2.0.
-- Prune after confirming no active draft data depends on them.
-- ─────────────────────────────────────────────────────────────────────────────

-- character_drafts: new v2 fields
ALTER TABLE character_drafts
  ADD COLUMN IF NOT EXISTS relationships         JSONB    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS character_prompt      TEXT,
  ADD COLUMN IF NOT EXISTS appearance_description TEXT;

-- characters: new v2 fields
ALTER TABLE characters
  ADD COLUMN IF NOT EXISTS relationships         JSONB    DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS character_prompt      TEXT,
  ADD COLUMN IF NOT EXISTS appearance_description TEXT;

-- Helpful comment: the following columns are deprecated in v2.0 but retained
-- for backward compatibility. Do not remove until draft data has been audited:
--   character_drafts.relationship_to_protagonist
--   character_drafts.relationship_to_authority
--   character_drafts.relationship_to_peers
--   character_drafts.relationship_to_love_interest
--   character_drafts.world_context
--   character_drafts.internal_monologue_style
--   characters.relationship_dynamics
--   characters.world_context
--   characters.internal_monologue_style
