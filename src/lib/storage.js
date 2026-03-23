// ─── storage.js ───────────────────────────────────────────────────────────────
// Supabase Postgres data layer. All tables have Row-Level Security enabled —
// every query is automatically scoped to the authenticated user.
//
// Entity modules: Storyline, CharacterBatch, GeneratedImage, StorylinePrompt,
//                 CharacterDraft, Character
//
// All methods are async. `create` methods require the authenticated userId
// so the user_id column is populated server-side before insert.
//
// useLocalStorage: thin hook kept for client-side theme/genre preference only.
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
  /** List all storylines for user, newest first, with batch_ids */
  async list(userId) {
    const { data, error } = await supabase
      .from('storylines')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    // Attach batch_ids array by querying character_batches
    const ids = (data || []).map(s => s.id);
    if (ids.length === 0) return data || [];
    const { data: batches } = await supabase
      .from('character_batches')
      .select('id, storyline_id')
      .in('storyline_id', ids);
    const batchMap = {};
    (batches || []).forEach(b => {
      if (!batchMap[b.storyline_id]) batchMap[b.storyline_id] = [];
      batchMap[b.storyline_id].push(b.id);
    });
    return (data || []).map(s => ({ ...s, batch_ids: batchMap[s.id] || [] }));
  },

  /** Get a single storyline by id */
  async get(id) {
    const { data, error } = await supabase
      .from('storylines')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    // Attach batch_ids
    const { data: batches } = await supabase
      .from('character_batches')
      .select('id')
      .eq('storyline_id', id);
    return { ...data, batch_ids: (batches || []).map(b => b.id) };
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

  /** Get images for a specific batch, newest first, optional limit */
  async filter({ batch_id }, orderBy = '-created_at', limit = 100) {
    const desc = orderBy.startsWith('-');
    const field = orderBy.replace('-', '').replace('created_date', 'created_at');
    let q = supabase
      .from('generated_images')
      .select('*')
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
      .select('id')
      .eq('user_id', userId)
      .eq('character_name', name.trim());
    if (excludeId) q = q.neq('id', excludeId);
    const { data } = await q;
    return (data || []).length > 0;
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

  /** Delete a character and all related data (images, prompt history).
   *  Uses a database function if available, otherwise deletes manually.
   *  @param {string} id Character UUID
   */
  async deleteWithRelated(id) {
    await Character.delete(id);
    const { error: imgError } = await supabase
      .from('character_images')
      .delete()
      .eq('character_id', id);
    if (imgError) console.warn('Failed to delete character_images:', imgError);
    const { error: histError } = await supabase
      .from('character_prompt_history')
      .delete()
      .eq('character_id', id);
    if (histError) console.warn('Failed to delete character_prompt_history:', histError);
  },
};

// ─── CharacterImage ──────────────────────────────────────────────────────────
// Direct image-to-character binding: one row per generated image.
// Uses denormalized user_id for fast RLS checks.
// ─────────────────────────────────────────────────────────────────────────────
export const CharacterImage = {
  async forCharacter(characterId) {
    const { data, error } = await supabase
      .from('character_images')
      .select('*')
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
