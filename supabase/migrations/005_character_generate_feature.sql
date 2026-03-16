-- Quick fix: Add missing columns to characters table
-- These columns are required but were missing

ALTER TABLE characters ADD COLUMN IF NOT EXISTS surface_goal TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS deep_desire TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS surface_traits TEXT[] DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS hidden_traits TEXT[] DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS speech_pattern TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS behavioral_tendencies TEXT[] DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS formative_event TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS relationship_to_protagonist TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS relationship_to_authority TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS relationship_to_peers TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS relationship_to_love_interest TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS relationship_dynamics JSONB DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS image_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS draft_id UUID REFERENCES character_drafts(id) ON DELETE SET NULL;
