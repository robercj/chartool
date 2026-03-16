import { useState, useEffect, useCallback, useRef } from 'react';
import { CharacterDraft } from '../lib/storage';

const LOCAL_STORAGE_KEY = 'character_draft_';
const DEBOUNCE_DELAY = 2000;

export function useDraftPersistence(draftId, userId) {
  const [localState, setLocalState] = useState(null);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const debounceTimerRef = useRef(null);
  const hasHydratedRef = useRef(false);

  const getLocalStorageKey = useCallback(() => {
    return `${LOCAL_STORAGE_KEY}${draftId || 'new'}`;
  }, [draftId]);

  useEffect(() => {
    if (!draftId) return;
    
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
    };

    loadInitialState();
  }, [draftId, userId, getLocalStorageKey]);

  const saveToStorage = useCallback(async (state) => {
    if (!draftId || !hasHydratedRef.current) return;
    
    const storageKey = getLocalStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(state));
    setLastSaved(new Date());
    setIsDirty(false);

    if (userId) {
      setIsSaving(true);
      try {
        const existingDraft = await CharacterDraft.get(draftId);
        if (existingDraft) {
          await CharacterDraft.update(draftId, {
            ...state,
            last_modified_at: new Date().toISOString(),
          });
        } else {
          await CharacterDraft.create(userId, {
            ...state,
            draft_saved_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error('Failed to save draft to DB:', e);
      } finally {
        setIsSaving(false);
      }
    }
  }, [draftId, userId, getLocalStorageKey]);

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
        saveToStorage(current);
        return current;
      });
    }, DEBOUNCE_DELAY);
  }, [saveToStorage]);

  const saveNow = useCallback(async () => {
    if (!localState) return;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    await saveToStorage(localState);
  }, [localState, saveToStorage]);

  const clearDraft = useCallback(() => {
    const storageKey = getLocalStorageKey();
    localStorage.removeItem(storageKey);
    setLocalState(null);
    setIsDirty(false);
    setLastSaved(null);
  }, [getLocalStorageKey]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty && localState) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, localState]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    draft: localState,
    isDirty,
    lastSaved,
    isSaving,
    updateState,
    saveNow,
    clearDraft,
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
