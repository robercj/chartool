-- Character Generate Feature Database Schema
-- Created: March 16, 2026

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLE: character_drafts
-- Stores in-progress character creation drafts
-- =====================================================
CREATE TABLE IF NOT EXISTS character_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- SECTION 1: IDENTITY & ROLE
    character_name TEXT,
    character_role TEXT,
    archetype TEXT,
    narrative_function TEXT,
    assigned_story_id UUID REFERENCES storylines(id) ON DELETE SET NULL,
    
    -- SECTION 2: DEMOGRAPHICS & IDENTITY
    age TEXT,
    sex TEXT CHECK (sex IN ('male', 'female', 'intersex', 'unspecified')),
    gender_expression TEXT,
    species_or_race TEXT,
    nationality_or_origin TEXT,
    social_class TEXT,
    occupation_or_role TEXT,
    
    -- SECTION 3: PERSONALITY CORE
    dere_presets TEXT[] DEFAULT '{}',
    custom_personality_modifier TEXT,
    personality_mode TEXT DEFAULT 'preset_only',
    surface_traits TEXT[] DEFAULT '{}',
    hidden_traits TEXT[] DEFAULT '{}',
    emotional_triggers_positive TEXT[] DEFAULT '{}',
    emotional_triggers_negative TEXT[] DEFAULT '{}',
    speech_pattern TEXT,
    behavioral_tendencies TEXT[] DEFAULT '{}',
    moral_alignment TEXT,
    values_and_beliefs TEXT[] DEFAULT '{}',
    fears_and_insecurities TEXT[] DEFAULT '{}',
    surface_goal TEXT,
    deep_desire TEXT,
    internal_conflict TEXT,
    
    -- SECTION 4: BACKSTORY & CONTEXT
    backstory_summary TEXT,
    formative_event TEXT,
    relationship_to_protagonist TEXT,
    relationship_to_authority TEXT,
    relationship_to_peers TEXT,
    relationship_to_love_interest TEXT,
    world_context TEXT,
    knowledge_domain TEXT[] DEFAULT '{}',
    
    -- SECTION 5: VOICE & CONSISTENCY
    tone_of_voice TEXT,
    verbal_quirks TEXT[] DEFAULT '{}',
    internal_monologue_style TEXT,
    consistency_anchors TEXT[] DEFAULT '{}',
    contradiction_points TEXT[] DEFAULT '{}',
    
    -- SECTION 6: APPEARANCE (JSONB for flexible structure)
    appearance JSONB DEFAULT '{}'::jsonb,
    
    -- SECTION 7: IMAGE GENERATION PARAMETERS
    image_prompt JSONB DEFAULT '{}'::jsonb,
    seed INTEGER,
    seed_locked BOOLEAN DEFAULT false,
    
    -- SECTION 8: GENERATION METADATA
    creation_status TEXT DEFAULT 'draft' CHECK (creation_status IN ('draft', 'in_progress', 'generated', 'finalized')),
    generated_image_url TEXT,
    fal_job_id TEXT,
    
    -- Timestamps
    draft_saved_at TIMESTAMPTZ DEFAULT NOW(),
    last_modified_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure user can only see their own drafts
    CONSTRAINT user_drafts UNIQUE (user_id, id)
);

-- RLS for character_drafts
ALTER TABLE character_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own drafts" 
    ON character_drafts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts" 
    ON character_drafts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts" 
    ON character_drafts FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts" 
    ON character_drafts FOR DELETE 
    USING (auth.uid() = user_id);

-- Index for faster listing
CREATE INDEX idx_character_drafts_user_id ON character_drafts(user_id);
CREATE INDEX idx_character_drafts_assigned_story ON character_drafts(assigned_story_id);

-- =====================================================
-- TABLE: characters
-- Stores finalized, immutable character records
-- =====================================================
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- SECTION 1: IDENTITY & ROLE
    character_name TEXT NOT NULL,
    character_role TEXT,
    archetype TEXT,
    narrative_function TEXT,
    assigned_story_id UUID REFERENCES storylines(id) ON DELETE SET NULL,
    
    -- SECTION 2: DEMOGRAPHICS & IDENTITY
    age TEXT,
    sex TEXT CHECK (sex IN ('male', 'female', 'intersex', 'unspecified')),
    gender_expression TEXT,
    species_or_race TEXT,
    nationality_or_origin TEXT,
    social_class TEXT,
    occupation_or_role TEXT,
    
    -- SECTION 3: PERSONALITY CORE
    dere_presets TEXT[] DEFAULT '{}',
    custom_personality_modifier TEXT,
    personality_mode TEXT,
    surface_traits TEXT[] DEFAULT '{}',
    hidden_traits TEXT[] DEFAULT '{}',
    emotional_triggers JSONB DEFAULT '{}'::jsonb,
    speech_pattern TEXT,
    behavioral_tendencies TEXT[] DEFAULT '{}',
    moral_alignment TEXT,
    values_and_beliefs TEXT[] DEFAULT '{}',
    fears_and_insecurities TEXT[] DEFAULT '{}',
    desires_and_goals JSONB DEFAULT '{}'::jsonb,
    internal_conflict TEXT,
    
    -- SECTION 4: BACKSTORY & CONTEXT
    backstory_summary TEXT,
    formative_event TEXT,
    relationship_dynamics JSONB DEFAULT '{}'::jsonb,
    world_context TEXT,
    knowledge_domain TEXT[] DEFAULT '{}',
    
    -- SECTION 5: VOICE & CONSISTENCY
    tone_of_voice TEXT,
    verbal_quirks TEXT[] DEFAULT '{}',
    internal_monologue_style TEXT,
    consistency_anchors TEXT[] DEFAULT '{}',
    contradiction_points TEXT[] DEFAULT '{}',
    
    -- SECTION 6: APPEARANCE
    appearance JSONB DEFAULT '{}'::jsonb,
    
    -- SECTION 7: IMAGE GENERATION
    image_prompt JSONB DEFAULT '{}'::jsonb,
    generated_image_url TEXT,
    seed INTEGER,
    seed_locked BOOLEAN DEFAULT false,
    fal_job_id TEXT,
    image_history JSONB DEFAULT '[]'::jsonb,
    
    -- SECTION 8: AI GENERATED CONTENT
    character_manifest TEXT,
    
    -- Metadata
    creation_status TEXT DEFAULT 'finalized' CHECK (creation_status IN ('draft', 'in_progress', 'generated', 'finalized')),
    draft_id UUID REFERENCES character_drafts(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT user_characters UNIQUE (user_id, id)
);

-- RLS for characters
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own characters" 
    ON characters FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own characters" 
    ON characters FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Characters are immutable after finalization, so no UPDATE or DELETE policy
-- unless draft status (which shouldn't happen after finalization)

CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_assigned_story ON characters(assigned_story_id);
CREATE INDEX idx_characters_draft_id ON characters(draft_id);

-- =====================================================
-- Helper function to update updated_at timestamp
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for characters
CREATE TRIGGER update_characters_updated_at 
    BEFORE UPDATE ON characters
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
