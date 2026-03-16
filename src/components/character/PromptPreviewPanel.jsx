import { useState, useCallback, useMemo } from 'react';
import { Check, AlertCircle, Lock, Unlock, RefreshCw } from 'lucide-react';

export default function PromptPreviewPanel({
  characterData,
  onJsonChange,
  onSeedChange,
  onSeedLockToggle,
  onGenerate,
  isGenerating = false,
  disabled = false,
}) {
  const [jsonString, setJsonString] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const seed = characterData?.seed ?? null;
  const seedLocked = characterData?.seed_locked ?? false;

  const jsonPreview = useMemo(() => {
    try {
      return JSON.stringify(characterData, null, 2);
    } catch {
      return '';
    }
  }, [characterData]);

  const handleJsonChange = useCallback((e) => {
    const newValue = e.target.value;
    setJsonString(newValue);
    
    try {
      const parsed = JSON.parse(newValue);
      setIsValid(true);
      setErrorMessage('');
      onJsonChange(parsed);
    } catch (e) {
      setIsValid(false);
      setErrorMessage(e.message);
    }
  }, [onJsonChange]);

  const handleSeedChange = useCallback((e) => {
    const value = e.target.value;
    const numValue = value === '' ? null : parseInt(value, 10);
    onSeedChange(numValue);
  }, [onSeedChange]);

  const handleSeedLockToggle = useCallback(() => {
    onSeedLockToggle(!seedLocked);
  }, [seedLocked, onSeedLockToggle]);

  const displayJson = jsonString || jsonPreview;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Prompt Preview</h3>
        <div className="flex items-center gap-2">
          {isValid ? (
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <Check className="w-4 h-4" />
              Valid JSON
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-red-400">
              <AlertCircle className="w-4 h-4" />
              Invalid: {errorMessage}
            </span>
          )}
        </div>
      </div>

      <div className="relative">
        <textarea
          value={displayJson}
          onChange={handleJsonChange}
          disabled={disabled}
          className="w-full h-64 p-4 font-mono text-sm bg-gray-900 border border-gray-700 rounded-lg text-gray-200 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
          aria-label="Character JSON prompt editor"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex items-center gap-3">
          <label htmlFor="seed-input" className="text-sm font-medium text-gray-300">
            Seed:
          </label>
          <input
            id="seed-input"
            type="number"
            value={seed ?? ''}
            onChange={handleSeedChange}
            placeholder="Random"
            disabled={disabled}
            className="w-32 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-md text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        
        <button
          type="button"
          onClick={handleSeedLockToggle}
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors ${
            seedLocked
              ? 'bg-amber-600/20 border-amber-500/50 text-amber-400'
              : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {seedLocked ? (
            <>
              <Lock className="w-4 h-4" />
              <span className="text-sm">Locked</span>
            </>
          ) : (
            <>
              <Unlock className="w-4 h-4" />
              <span className="text-sm">Unlocked</span>
            </>
          )}
        </button>
        
        <p className="text-xs text-gray-400 sm:ml-auto">
          {seedLocked 
            ? 'Seed locked — only your prompt changes will affect this image.'
            : 'Seed unlocked — each generation will be unique.'
          }
        </p>
      </div>

      <button
        onClick={onGenerate}
        disabled={disabled || !isValid || isGenerating}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Generating Character...
          </>
        ) : (
          <>
            Generate Character Image
          </>
        )}
      </button>
    </div>
  );
}
