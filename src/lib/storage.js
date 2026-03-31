// ─── storage.js ───────────────────────────────────────────────────────────────
// Supabase Postgres data layer. All tables have Row-Level Security enabled —
// every query is automatically scoped to the authenticated user.
//
// Entity modules (8 total):
//   Storyline, CharacterBatch, GeneratedImage, StorylinePrompt,
//   CharacterDraft, Character, CharacterImage, PromptHistory
//
// All methods are async. `create` methods require the authenticated userId
// so the user_id column is populated server-side before insert.
//
// useLocalStorage: thin hook kept for client-side theme/genre preference only.
//
// NOTE: Generated images are stored on fal.ai's CDN — the URL string is
// saved in the database, not the binary image data. No Supabase Storage
// buckets are used for generated images.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';

// ─── useLocalStorage (theme/genre prefs only) ────────────────────────────────
export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.error(err);
    }
  }, [key, value]);

  return [value, setValue];
}

// ─── Storyline ────────────────────────────────────────────────────────────────
// DB table: public.storylines
// Extra relation: character_batches.storyline_id populates the batch_ids[] field
export const Storyline = {
  /** List all storylines for user, newest first, with batch_ids.
   *  Uses an embedded select to fetch batch IDs in a single query
   *  (eliminates the previous N+1 pattern of querying character_batches separately). */
  async list(userId) {
    const { data, error } = await supabase
      .from('storylines')
      .select('*, character_batches(id)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Reshape embedded character_batches rows into a flat batch_ids[] array
    return (data || []).map(s => {
      const { character_batches, ...rest } = s;
      return { ...rest, batch_ids: (character_batches || []).map(b => b.id) };
    });
  },

  /** Light query for folder list rendering - only needed columns */
  async listForFolders(userId) {
    const { data, error } = await supabase
      .from('storylines')
      .select('id, name, storyline_prompt_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Get a single storyline by id (single query with embedded batch IDs). */
  async get(id) {
    const { data, error } = await supabase
      .from('storylines')
      .select('*, character_batches(id)')
      .eq('id', id)
      .single();
    if (error) throw error;
    const { character_batches, ...rest } = data;
    return { ...rest, batch_ids: (character_batches || []).map(b => b.id) };
  },

  /** Create a new storyline */
  async create(userId, data) {
    // batch_ids is not a DB column — strip it before insert (managed via character_batches.storyline_id)
    const { batch_ids: _batch_ids, ...rest } = data;
    const { data: created, error } = await supabase
      .from('storylines')
      .insert({ ...rest, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return { ...created, batch_ids: [] };
  },

  /** Update fields on an existing storyline */
  async update(id, data) {
    const { batch_ids: _batch_ids, ...rest } = data;
    const { error } = await supabase
      .from('storylines')
      .update(rest)
      .eq('id', id);
    if (error) throw error;
  },

  /** Delete a storyline */
  async delete(id) {
    const { error } = await supabase
      .from('storylines')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ─── CharacterBatch ───────────────────────────────────────────────────────────
// DB table: public.character_batches
export const CharacterBatch = {
  async list(userId) {
    const { data, error } = await supabase
      .from('character_batches')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Light query for legacy batch list rendering */
  async listForGallery(userId) {
    const { data, error } = await supabase
      .from('character_batches')
      .select('id, name, reference_image_url, image_count, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { data, error } = await supabase
      .from('character_batches')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(userId, data) {
    const { data: created, error } = await supabase
      .from('character_batches')
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { error } = await supabase
      .from('character_batches')
      .update(data)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await supabase
      .from('character_batches')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /** List batches for a specific storyline */
  async forStoryline(storylineId) {
    const { data, error } = await supabase
      .from('character_batches')
      .select('*')
      .eq('storyline_id', storylineId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Assign/unassign a batch to a storyline */
  async assignStoryline(batchId, storylineId) {
    const { error } = await supabase
      .from('character_batches')
      .update({ storyline_id: storylineId })
      .eq('id', batchId);
    if (error) throw error;
  },
};

// ─── GeneratedImage ───────────────────────────────────────────────────────────
// DB table: public.generated_images
export const GeneratedImage = {
  async list(userId) {
    const { data, error } = await supabase
      .from('generated_images')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { data, error } = await supabase
      .from('generated_images')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(userId, data) {
    const { data: created, error } = await supabase
      .from('generated_images')
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { error } = await supabase
      .from('generated_images')
      .update(data)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await supabase
      .from('generated_images')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /** Get images for a specific batch, newest first, optional limit.
   *  Selects only the columns used by the batch detail image grid. */
  async filter({ batch_id }, orderBy = '-created_at', limit = 100) {
    const desc = orderBy.startsWith('-');
    const field = orderBy.replace('-', '').replace('created_date', 'created_at');
    let q = supabase
      .from('generated_images')
      .select('id, batch_id, user_id, url, label, category, created_at')
      .eq('batch_id', batch_id)
      .order(field, { ascending: !desc });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  },
};

// ─── StorylinePrompt ──────────────────────────────────────────────────────────
// DB table: public.storyline_prompts
export const StorylinePrompt = {
  async get(id) {
    const { data, error } = await supabase
      .from('storyline_prompts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(userId, data) {
    const { data: created, error } = await supabase
      .from('storyline_prompts')
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { error } = await supabase
      .from('storyline_prompts')
      .update(data)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await supabase
      .from('storyline_prompts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ─── PromptHistory ────────────────────────────────────────────────────────────
// DB table: public.character_prompt_history
// Written only on confirmed Save or Save As — never on regeneration alone.
export const PromptHistory = {
  /** Fetch all history entries for a character, newest first. */
  async list(characterId) {
    const { data, error } = await supabase
      .from('character_prompt_history')
      .select('*')
      .eq('character_id', characterId)
      .order('saved_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Light query for history drawer - only summary columns */
  async listSummaries(characterId) {
    const { data, error } = await supabase
      .from('character_prompt_history')
      .select('id, saved_at, save_type, label')
      .eq('character_id', characterId)
      .order('saved_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Fetch a single history entry by ID (for restore action) */
  async get(id) {
    const { data, error } = await supabase
      .from('character_prompt_history')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  /** Write a new history entry on Save or Save As. */
  async create(characterId, entry) {
    const { data: created, error } = await supabase
      .from('character_prompt_history')
      .insert({ ...entry, character_id: characterId })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  /** Update the optional user-supplied label on an entry. */
  async updateLabel(id, label) {
    const { error } = await supabase
      .from('character_prompt_history')
      .update({ label })
      .eq('id', id);
    if (error) throw error;
  },
};

// ─── CharacterDraft ──────────────────────────────────────────────────────────
// DB table: public.character_drafts
export const CharacterDraft = {
  async list(userId) {
    const { data, error } = await supabase
      .from('character_drafts')
      .select('*')
      .eq('user_id', userId)
      .order('last_modified_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Light query for gallery card rendering - only needed columns */
  async listForGallery(userId) {
    const { data, error } = await supabase
      .from('character_drafts')
      .select('id, character_name, generated_image_url, creation_status, assigned_story_id, last_modified_at')
      .eq('user_id', userId)
      .order('last_modified_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Paginated gallery query */
  async listForGalleryPaginated(userId, page = 0, pageSize = 20) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('character_drafts')
      .select('id, character_name, generated_image_url, creation_status, assigned_story_id, last_modified_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('last_modified_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { data: data || [], count };
  },

  async get(id) {
    const { data, error } = await supabase
      .from('character_drafts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(userId, data) {
    const { data: created, error } = await supabase
      .from('character_drafts')
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { error } = await supabase
      .from('character_drafts')
      .update({ ...data, last_modified_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async upsert(id, userId, data) {
    console.log('[CharacterDraft.upsert] id:', id, 'userId:', userId, 'data keys:', Object.keys(data));
    const { error } = await supabase
      .from('character_drafts')
      .upsert(
        { id, user_id: userId, ...data, last_modified_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await supabase
      .from('character_drafts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async forStoryline(storylineId) {
    const { data, error } = await supabase
      .from('character_drafts')
      .select('*')
      .eq('assigned_story_id', storylineId)
      .order('last_modified_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Bulk-update assigned_story_id for a set of draft IDs.
   *  @param {string[]} ids
   *  @param {string|null} assigned_story_id  null = unassign
   */
  async assignBulk(ids, assigned_story_id) {
    if (!ids || ids.length === 0) return;
    const { error } = await supabase
      .from('character_drafts')
      .update({ assigned_story_id, last_modified_at: new Date().toISOString() })
      .in('id', ids);
    if (error) throw error;
  },
};

// ─── Character ───────────────────────────────────────────────────────────────
// DB table: public.characters (finalized, immutable records)
export const Character = {
  async list(userId) {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Light query for gallery card rendering - only needed columns */
  async listForGallery(userId) {
    const { data, error } = await supabase
      .from('characters')
      .select('id, character_name, generated_image_url, creation_status, creation_source, archetype, assigned_story_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Paginated gallery query */
  async listForGalleryPaginated(userId, page = 0, pageSize = 20) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await supabase
      .from('characters')
      .select('id, character_name, generated_image_url, creation_status, creation_source, archetype, assigned_story_id, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { data: data || [], count };
  },

  /** Light query for character selection dropdown (Mode B) - minimal columns */
  async listForSelection(userId) {
    const { data, error } = await supabase
      .from('characters')
      .select('id, character_name, generated_image_url, creation_status, character_consistency_prompt, character_identity_lock, additional_reference_urls, analysis_image_count')
      .eq('user_id', userId)
      .eq('creation_status', 'finalized')
      .order('character_name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async get(id) {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(userId, data) {
    const { data: created, error } = await supabase
      .from('characters')
      .insert({ ...data, user_id: userId })
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  async update(id, data) {
    const { error } = await supabase
      .from('characters')
      .update(data)
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id) {
    const { error } = await supabase
      .from('characters')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async forStoryline(storylineId) {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('assigned_story_id', storylineId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Bulk-update assigned_story_id for a set of character IDs.
   *  Requires the "Users can update their own characters" RLS policy (migration 008).
   *  @param {string[]} ids
   *  @param {string|null} assigned_story_id  null = unassign
   */
  async assignBulk(ids, assigned_story_id) {
    if (!ids || ids.length === 0) return;
    const { error } = await supabase
      .from('characters')
      .update({ assigned_story_id })
      .in('id', ids);
    if (error) throw error;
  },

  async unassigned(userId) {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('user_id', userId)
      .is('assigned_story_id', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /** Check whether a character name already exists for this user.
   *  Used by the Save As flow for client-side uniqueness validation.
   *  @param {string}      userId
   *  @param {string}      name         The candidate name (case-sensitive exact match)
   *  @param {string|null} excludeId    The current character's own ID — excluded so
   *                                    a user can "Save As" with the same name they
   *                                    already have without a false collision.
   *  @returns {Promise<boolean>}        true if the name is already taken
   */
  async nameExists(userId, name, excludeId = null) {
    if (!name?.trim()) return false;
    let q = supabase
      .from('characters')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('character_name', name.trim());
    if (excludeId) q = q.neq('id', excludeId);
    const { count } = await q;
    return (count ?? 0) > 0;
  },

  /** Atomically append a sprite image entry to the character's sprite_images JSONB array.
   *  Uses a Postgres RPC to avoid read-modify-write race conditions when multiple
   *  jobs complete simultaneously for the same character.
   *  @param {string} id     Character UUID
   *  @param {object} entry  Sprite image entry object { url, generated_at, seed, params_snapshot }
   */
  async addSpriteImage(id, entry) {
    const { error } = await supabase.rpc('append_sprite_image', { p_id: id, p_entry: entry });
    if (error) throw error;
  },

  /** Atomically remove a sprite image entry from the character's sprite_images array by URL.
   *  @param {string} id   Character UUID
   *  @param {string} url  URL of the image to remove
   */
  async deleteSpriteImage(id, url) {
    const { error } = await supabase.rpc('delete_sprite_image', { p_id: id, p_url: url });
    if (error) throw error;
  },

  /** Delete a character and all related data.
   *  Both character_images and character_prompt_history have ON DELETE CASCADE
   *  FKs to characters(id), so a single delete triggers automatic cleanup.
   *  @param {string} id Character UUID
   */
  async deleteWithRelated(id) {
    await Character.delete(id);
    // No manual cleanup needed — ON DELETE CASCADE (migrations 009, 014)
    // handles character_images and character_prompt_history automatically.
  },
};

// ─── CharacterImage ──────────────────────────────────────────────────────────
// Direct image-to-character binding: one row per generated image.
// Uses denormalized user_id for fast RLS checks.
// ─────────────────────────────────────────────────────────────────────────────
export const CharacterImage = {
  /** Fetch all images for a character, newest first.
   *  Selects only the columns needed for gallery rendering — avoids pulling
   *  the large params_snapshot JSONB column which is only needed for
   *  regeneration workflows. */
  async forCharacter(characterId) {
    const { data, error } = await supabase
      .from('character_images')
      .select('id, character_id, user_id, url, label, seed, pose_id, emotion_entry, generation_type, job_id, created_at')
      .eq('character_id', characterId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async add(characterId, userId, { url, label, seed, poseId, emotionEntry, paramsSnapshot, generationType = 'sprite', jobId }) {
    const { data, error } = await supabase
      .from('character_images')
      .insert({
        character_id: characterId,
        user_id: userId,
        url,
        label,
        seed,
        pose_id: poseId,
        emotion_entry: emotionEntry,
        params_snapshot: paramsSnapshot,
        generation_type: generationType,
        job_id: jobId,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(imageId) {
    const { error } = await supabase
      .from('character_images')
      .delete()
      .eq('id', imageId);
    if (error) throw error;
  },

  async deleteByUrl(characterId, url) {
    const { error } = await supabase
      .from('character_images')
      .delete()
      .eq('character_id', characterId)
      .eq('url', url);
    if (error) throw error;
  },
};
