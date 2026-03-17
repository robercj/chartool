import { useState, useCallback, useMemo } from 'react';
import { Check, AlertCircle, Lock, Unlock, RefreshCw } from 'lucide-react';

export default function PromptPreviewPanel({
  characterData,
  onJsonChange,
  onSeedChange,
  onSeedLockToggle,
  onGenerate = null,   // optional — omit to hide the generate button
  isGenerating = false,
  disabled = false,
}) {
  const [jsonString, setJsonString] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const seed       = characterData?.seed ?? null;
  const seedLocked = characterData?.seed_locked ?? false;

  const jsonPreview = useMemo(() => {
    try { return JSON.stringify(characterData, null, 2); }
    catch { return ''; }
  }, [characterData]);

  const handleJsonChange = useCallback((e) => {
    const newValue = e.target.value;
    setJsonString(newValue);
    try {
      const parsed = JSON.parse(newValue);
      setIsValid(true);
      setErrorMessage('');
      onJsonChange(parsed);
    } catch (err) {
      setIsValid(false);
      setErrorMessage(err.message);
    }
  }, [onJsonChange]);

  const handleSeedChange = useCallback((e) => {
    const value    = e.target.value;
    const numValue = value === '' ? null : parseInt(value, 10);
    onSeedChange(numValue);
  }, [onSeedChange]);

  const handleSeedLockToggle = useCallback(() => {
    onSeedLockToggle(!seedLocked);
  }, [seedLocked, onSeedLockToggle]);

  const displayJson = jsonString || jsonPreview;

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-base-content">Prompt Preview</h3>
        {isValid ? (
          <span className="badge badge-success gap-1">
            <Check className="w-3.5 h-3.5" />
            Valid JSON
          </span>
        ) : (
          <span className="badge badge-error gap-1 text-xs max-w-xs truncate">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {errorMessage}
          </span>
        )}
      </div>

      {/* JSON editor */}
      <textarea
        value={displayJson}
        onChange={handleJsonChange}
        disabled={disabled}
        className="textarea textarea-bordered w-full h-64 font-mono text-sm resize-y bg-base-300"
        aria-label="Character JSON prompt editor"
        spellCheck={false}
      />

      {/* Seed controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-xl bg-base-200 border border-base-300">
        <div className="flex items-center gap-3">
          <label htmlFor="seed-input" className="label-text font-medium text-sm whitespace-nowrap">
            Seed:
          </label>
          <input
            id="seed-input"
            type="number"
            value={seed ?? ''}
            onChange={handleSeedChange}
            placeholder="Random"
            disabled={disabled}
            className="input input-bordered input-sm w-32 bg-base-300"
          />
        </div>

        <button
          type="button"
          onClick={handleSeedLockToggle}
          disabled={disabled}
          className={`btn btn-sm gap-2 ${seedLocked ? 'btn-warning btn-soft' : 'btn-ghost border border-base-300'}`}
        >
          {seedLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          {seedLocked ? 'Locked' : 'Unlocked'}
        </button>

        <p className="text-xs opacity-60 sm:ml-auto">
          {seedLocked
            ? 'Seed locked — only prompt changes affect this image.'
            : 'Seed unlocked — each generation will be unique.'}
        </p>
      </div>

      {/* Generate button — only rendered when onGenerate is provided (Step 3 legacy path) */}
      {onGenerate && (
        <button
          onClick={onGenerate}
          disabled={disabled || !isValid || isGenerating}
          className="btn btn-primary btn-block gap-2"
          style={{ minHeight: '48px' }}
        >
          {isGenerating ? (
            <>
              <span className="loading loading-spinner loading-sm" />
              Generating Character...
            </>
          ) : (
            'Generate Character Image'
          )}
        </button>
      )}
    </div>
  );
}
