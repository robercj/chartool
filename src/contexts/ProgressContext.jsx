import { createContext, useContext, useState, useRef, useCallback } from 'react';

const ProgressContext = createContext();

export function ProgressProvider({ children }) {
  const [progress, setProgress] = useState(null);
  const [generating, setGenerating] = useState(false);
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef(null);

  // Start a new progress sequence.
  // total=null means indeterminate (animated pulse bar, no fraction shown).
  // Also creates a fresh AbortController for this generation run.
  const startProgress = useCallback((label, total = null, taskRoute = null) => {
    cancelledRef.current = false;
    abortControllerRef.current = new AbortController();
    setGenerating(true);
    setProgress({ label, current: 0, total, taskRoute });
  }, []);

  // Update the numeric step counter.
  const updateProgress = useCallback((current) => {
    setProgress(prev => prev ? { ...prev, current } : null);
  }, []);

  // Update just the label text without touching current/total.
  // Used for keyword stage indicators during long single-request operations.
  const setProgressLabel = useCallback((label) => {
    setProgress(prev => prev ? { ...prev, label } : null);
  }, []);

  const clearProgress = useCallback(() => {
    setProgress(null);
    setGenerating(false);
    abortControllerRef.current = null;
  }, []);

  const stopProgress = useCallback((onStop) => {
    cancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (onStop) onStop();
  }, []);

  const isCancelled = useCallback(() => cancelledRef.current, []);

  // Returns the AbortSignal for the current generation run, or null if none active.
  const getAbortSignal = useCallback(() => abortControllerRef.current?.signal ?? null, []);

  return (
    <ProgressContext.Provider value={{
      progress,
      generating,
      setGenerating,
      startProgress,
      updateProgress,
      setProgressLabel,
      clearProgress,
      stopProgress,
      isCancelled,
      getAbortSignal,
    }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used within ProgressProvider');
  return context;
}
