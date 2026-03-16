// ─── storage.js ───────────────────────────────────────────────────────────────
// All persistent data is now stored in Supabase Postgres with Row-Level Security.
// Each entity module mirrors the old localStorage API surface so call-sites in
// pages need only minimal changes:
//   • All methods are now async (return Promises)
//   • `create`, `update`, `delete`, `filter` require the authenticated user's id
//     which is passed in via the `userId` option parameter.
//
// The old useLocalStorage hook is kept for theme/genre preferences only.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
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

  useEffect(() => {
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
// Extra relation: character_batches.storyline_id (instead of embedded batch_ids[])
export const Storyline = {
  /** List all storylines for user, newest first */
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
    const { batch_ids, ...rest } = data; // batch_ids not a column; managed via batches
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
    const { batch_ids, ...rest } = data;
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

// ─── SavedPrompt (stub — not actively used) ───────────────────────────────────
// Kept for import compatibility. No DB table; was never actively persisted.
export const SavedPrompt = {
  async list() { return []; },
  async get() { return null; },
  async create(userId, data) { return { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() }; },
  async update() {},
  async delete() {},
};

// ─── Settings (localStorage only — not user data) ────────────────────────────
// Kept purely for the seedSettings.js legacy path during transition.
export const Settings = {
  get: () => JSON.parse(localStorage.getItem('cf_settings') || '{}'),
  set: (data) => localStorage.setItem('cf_settings', JSON.stringify(data)),
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
};
