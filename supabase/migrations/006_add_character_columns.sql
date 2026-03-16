-- Add all missing columns to characters table

-- Identity & Role
ALTER TABLE characters ADD COLUMN IF NOT EXISTS character_name TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS character_role TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS archetype TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS narrative_function TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS assigned_story_id UUID;

-- Demographics & Identity  
ALTER TABLE characters ADD COLUMN IF NOT EXISTS age TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS gender_expression TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS species_or_race TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS nationality_or_origin TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS social_class TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS occupation_or_role TEXT;

-- Personality Core
ALTER TABLE characters ADD COLUMN IF NOT EXISTS dere_presets TEXT[] DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS custom_personality_modifier TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS personality_mode TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS emotional_triggers JSONB DEFAULT '{}'::jsonb;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS moral_alignment TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS values_and_beliefs TEXT[] DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS fears_and_insecurities TEXT[] DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS internal_conflict TEXT;

-- Backstory & Context
ALTER TABLE characters ADD COLUMN IF NOT EXISTS backstory_summary TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS world_context TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS knowledge_domain TEXT[] DEFAULT '{}';

-- Voice & Consistency
ALTER TABLE characters ADD COLUMN IF NOT EXISTS tone_of_voice TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS internal_monologue_style TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS consistency_anchors TEXT[] DEFAULT '{}';
ALTER TABLE characters ADD COLUMN IF NOT EXISTS contradiction_points TEXT[] DEFAULT '{}';

-- Image Generation
ALTER TABLE characters ADD COLUMN IF NOT EXISTS generated_image_url TEXT;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS seed INTEGER;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS seed_locked BOOLEAN DEFAULT false;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS fal_job_id TEXT;

-- AI Generated Content
ALTER TABLE characters ADD COLUMN IF NOT EXISTS character_manifest TEXT;

-- Metadata
ALTER TABLE characters ADD COLUMN IF NOT EXISTS creation_status TEXT DEFAULT 'finalized';

-- Draft timestamps
ALTER TABLE characters ADD COLUMN IF NOT EXISTS draft_saved_at TIMESTAMPTZ;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_modified_at TIMESTAMPTZ;

-- Ensure image_history is array
ALTER TABLE characters ALTER COLUMN image_history TYPE JSONB USING image_history::jsonb;
