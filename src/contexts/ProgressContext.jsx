import { createContext, useContext, useState, useRef, useCallback } from 'react';

const ProgressContext = createContext();

export function ProgressProvider({ children }) {
  const [progress, setProgress] = useState(null);
  const cancelledRef = useRef(false);

  // Start a new progress sequence.
  // total=null means indeterminate (animated pulse bar, no fraction shown).
  const startProgress = useCallback((label, total = null, taskRoute = null) => {
    cancelledRef.current = false;
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
  }, []);

  const stopProgress = useCallback((onStop) => {
    cancelledRef.current = true;
    if (onStop) onStop();
  }, []);

  const isCancelled = useCallback(() => cancelledRef.current, []);

  return (
    <ProgressContext.Provider value={{
      progress,
      startProgress,
      updateProgress,
      setProgressLabel,
      clearProgress,
      stopProgress,
      isCancelled
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
