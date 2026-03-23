// ─── useDraftPersistence ──────────────────────────────────────────────────────
// Dual-layer character draft persistence: localStorage (immediate, no latency)
// + Supabase DB (debounced 2 s, requires auth).
//
// On mount: hydrates from localStorage first for instant UX, then overwrites
// with the DB record if one exists (DB is the source of truth).
//
// Auto-saves on:
//   - onBlur: instant localStorage (no DB) when user leaves a field
//   - debounced (2s): localStorage + DB if has meaningful data
//   - visibilitychange: localStorage + DB if has meaningful data
//   - navigation: saves on route change
//   - beforeunload: warns on tab close
//
// Exports: useDraftPersistence(draftId, userId) and useDraftList(userId)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useRef } from 'react';
import { CharacterDraft } from '../storage';

const LOCAL_STORAGE_KEY = 'character_draft_';
const DEBOUNCE_DELAY = 2000;

const MEANINGFUL_FIELDS = [
  'character_name', 'character_role', 'archetype', 'narrative_function',
  'age', 'sex', 'gender_expression', 'species_or_race', 'nationality_or_origin',
  'social_class', 'occupation_or_role', 'dere_presets', 'custom_personality_modifier',
  'surface_traits', 'hidden_traits', 'emotional_triggers_positive', 'emotional_triggers_negative',
  'speech_pattern', 'behavioral_tendencies', 'moral_alignment',
  'values_and_beliefs', 'fears_and_insecurities', 'surface_goal', 'deep_desire',
  'internal_conflict', 'backstory_summary', 'formative_event', 'knowledge_domain',
  'relationships', 'tone_of_voice', 'verbal_quirks', 'consistency_anchors', 'contradiction_points',
  'appearance', 'image_prompt', 'character_prompt', 'appearance_description',
  'generated_image_url'
];

function hasMeaningfulData(state) {
  if (!state) return false;
  
  for (const key of MEANINGFUL_FIELDS) {
    const val = state[key];
    if (val === undefined || val === null) continue;
    if (typeof val === 'string' && val.trim() !== '') return true;
    if (Array.isArray(val) && val.length > 0) return true;
    if (typeof val === 'object' && Object.keys(val).length > 0) return true;
    if (typeof val === 'number' && val !== 0) return true;
  }
  return false;
}

function sanitizeForStorage(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || typeof value === 'function') {
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeForStorage(value);
      }
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function useDraftPersistence(draftId, userId) {
  const [localState, setLocalState] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef(null);
  const hasHydratedRef = useRef(false);
  const previousNavigationRef = useRef(null);

  const getLocalStorageKey = useCallback(() => {
    return `${LOCAL_STORAGE_KEY}${draftId || 'new'}`;
  }, [draftId]);

  useEffect(() => {
    if (!draftId) {
      hasHydratedRef.current = true;
      setIsInitialized(true);
      return;
    }

    const loadInitialState = async () => {
      const storageKey = getLocalStorageKey();
      const localData = localStorage.getItem(storageKey);

      if (localData) {
        try {
          const parsed = JSON.parse(localData);
          setLocalState(parsed);
        } catch (e) {
          console.error('Failed to parse local draft:', e);
        }
      }

      if (userId) {
        try {
          const dbDraft = await CharacterDraft.get(draftId);
          if (dbDraft) {
            setLocalState(dbDraft);
            if (!localData) {
              localStorage.setItem(storageKey, JSON.stringify(dbDraft));
            }
          }
        } catch (e) {
          console.error('Failed to load draft from DB:', e);
        }
      }

      hasHydratedRef.current = true;
      setIsInitialized(true);
    };

    loadInitialState();
  }, [draftId, userId, getLocalStorageKey]);

  const saveToStorage = useCallback(async (state, saveToDb = true) => {
    if (!draftId || !hasHydratedRef.current) return;
    
    const sanitizedState = sanitizeForStorage(state);
    const storageKey = getLocalStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(sanitizedState));
    setLastSaved(new Date());
    setIsDirty(false);

    if (saveToDb && userId && hasMeaningfulData(state)) {
      setIsSaving(true);
      try {
        await CharacterDraft.upsert(draftId, userId, {
          ...sanitizedState,
          draft_saved_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error('Failed to save draft to DB:', e);
      } finally {
        setIsSaving(false);
      }
    }
  }, [draftId, userId, getLocalStorageKey]);

  const saveToLocalOnly = useCallback((state) => {
    saveToStorage(state, false);
  }, [saveToStorage]);

  const updateState = useCallback((updates) => {
    setLocalState(prev => {
      const newState = { ...prev, ...updates };
      setIsDirty(true);
      return newState;
    });

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setLocalState(current => {
        saveToStorage(current, true);
        return current;
      });
    }, DEBOUNCE_DELAY);
  }, [saveToStorage]);

  const saveNow = useCallback(async () => {
    if (!localState) return;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    await saveToStorage(localState, true);
  }, [localState, saveToStorage]);

  const clearDraft = useCallback(() => {
    const storageKey = getLocalStorageKey();
    localStorage.removeItem(storageKey);
    setLocalState(null);
    setIsDirty(false);
    setLastSaved(null);
  }, [getLocalStorageKey]);

  const handleFieldBlur = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (localState) {
      saveToLocalOnly(localState);
    }
  }, [localState, saveToLocalOnly]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && localState && hasMeaningfulData(localState)) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && isDirty && localState) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        saveToStorage(localState, true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isDirty, localState, saveToStorage]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isInitialized || !draftId) return;

    const currentPath = window.location.pathname;
    if (previousNavigationRef.current === null) {
      previousNavigationRef.current = currentPath;
      return;
    }

    if (currentPath !== previousNavigationRef.current) {
      previousNavigationRef.current = currentPath;
      if (localState && hasMeaningfulData(localState)) {
        saveToStorage(localState, true);
      }
    }

    const handlePopState = () => {
      if (localState && hasMeaningfulData(localState)) {
        saveToStorage(localState, true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isInitialized, draftId, localState, saveToStorage]);

  return {
    draft: localState,
    isDirty,
    lastSaved,
    isSaving,
    isInitialized,
    updateState,
    saveNow,
    clearDraft,
    handleFieldBlur,
  };
}

export function useDraftList(userId) {
  const [drafts, setDrafts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDrafts = useCallback(async () => {
    if (!userId) {
      const localDrafts = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(LOCAL_STORAGE_KEY)) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            localDrafts.push(data);
          } catch (e) {
            console.error('Failed to parse local draft:', e);
          }
        }
      }
      setDrafts(localDrafts.sort((a, b) => 
        new Date(b.last_modified_at || 0) - new Date(a.last_modified_at || 0)
      ));
      setIsLoading(false);
      return;
    }

    try {
      const dbDrafts = await CharacterDraft.list(userId);
      setDrafts(dbDrafts);
    } catch (e) {
      console.error('Failed to load drafts:', e);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  return { drafts, isLoading, reload: loadDrafts };
}
