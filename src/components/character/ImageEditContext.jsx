import { useState, useCallback } from 'react';
import {
  Download, RefreshCw, Lock, Unlock,
  ChevronLeft, ChevronRight, Sparkles, Save
} from 'lucide-react';

export default function ImageEditContext({
  generatedImageUrl,
  imageHistory = [],
  seed,
  seedLocked,
  onSeedChange,
  onSeedLockToggle,
  onRegenerate,
  onRegenerateWithoutInput,
  onFinalize,
  isGenerating = false,
  isFinalizing = false,
  disabled = false,
}) {
  const [regenerationPrompt, setRegenerationPrompt] = useState('');
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(
    imageHistory.length > 0 ? imageHistory.length - 1 : -1
  );

  const handleDownload = useCallback(async () => {
    if (!generatedImageUrl) return;
    try {
      const response = await fetch(generatedImageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `character-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) { console.error('Download failed:', error); }
  }, [generatedImageUrl]);

  const handleRegenerate = useCallback(() => {
    onRegenerate(regenerationPrompt);
    setRegenerationPrompt('');
  }, [regenerationPrompt, onRegenerate]);

  const goToPreviousImage = useCallback(() => {
    if (currentHistoryIndex > 0) setCurrentHistoryIndex(currentHistoryIndex - 1);
  }, [currentHistoryIndex]);

  const goToNextImage = useCallback(() => {
    if (currentHistoryIndex < imageHistory.length - 1) setCurrentHistoryIndex(currentHistoryIndex + 1);
  }, [currentHistoryIndex, imageHistory.length]);

  const currentImage = currentHistoryIndex >= 0 && currentHistoryIndex < imageHistory.length
    ? imageHistory[currentHistoryIndex]
    : generatedImageUrl;

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className="alert alert-info">
        <Sparkles className="w-5 h-5 flex-shrink-0" />
        <div>
          <h3 className="font-semibold">Character Generated — Edit Mode</h3>
          <p className="text-sm opacity-80">
            Refine the image with targeted changes or finalize the character
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Image display ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="card bg-base-300 border border-base-300 overflow-hidden">
            {currentImage ? (
              <figure className="relative">
                <img
                  src={currentImage}
                  alt="Generated character"
                  className="w-full h-auto max-h-[500px] object-contain"
                />
                {generatedImageUrl && (
                  <button
                    onClick={handleDownload}
                    className="btn btn-sm btn-circle absolute top-3 right-3 bg-black/50 border-none text-white hover:bg-black/70"
                    aria-label="Download image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </figure>
            ) : (
              <div className="card-body items-center justify-center h-64 opacity-40">
                No image generated yet
              </div>
            )}
          </div>

          {/* Image history strip */}
          {imageHistory.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousImage}
                disabled={currentHistoryIndex <= 0}
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 flex gap-2 overflow-x-auto py-1">
                {imageHistory.map((url, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentHistoryIndex(index)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      index === currentHistoryIndex
                        ? 'border-primary'
                        : 'border-transparent hover:border-base-content/30'
                    }`}
                  >
                    <img src={url} alt={`Generation ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
              <button
                onClick={goToNextImage}
                disabled={currentHistoryIndex >= imageHistory.length - 1}
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* ── Edit controls ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Regen prompt */}
          <div>
            <label htmlFor="regen-prompt" className="label label-text font-medium pb-1">
              Regeneration Prompt
            </label>
            <textarea
              id="regen-prompt"
              value={regenerationPrompt}
              onChange={(e) => setRegenerationPrompt(e.target.value)}
              placeholder="Describe changes: e.g., 'different hair color to red', 'more formal clothing', 'angry expression'..."
              rows={4}
              disabled={disabled}
              className="textarea textarea-bordered w-full bg-base-300 resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleRegenerate}
              disabled={disabled || isGenerating || !regenerationPrompt.trim()}
              className="btn btn-primary btn-block gap-2"
              style={{ minHeight: '44px' }}
            >
              {isGenerating ? (
                <><span className="loading loading-spinner loading-sm" />Regenerating...</>
              ) : (
                <><RefreshCw className="w-4 h-4" />Regenerate with Prompt</>
              )}
            </button>

            <button
              onClick={onRegenerateWithoutInput}
              disabled={disabled || isGenerating}
              className="btn btn-neutral btn-block gap-2"
              style={{ minHeight: '44px' }}
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate without new input
            </button>
          </div>

          {/* Seed control */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl bg-base-200 border border-base-300">
            <div className="flex items-center gap-2">
              <label htmlFor="edit-seed" className="label-text text-sm">Seed:</label>
              <input
                id="edit-seed"
                type="number"
                value={seed ?? ''}
                onChange={(e) => onSeedChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                placeholder="Random"
                disabled={disabled}
                className="input input-bordered input-sm w-24 bg-base-300"
              />
            </div>
            <button
              onClick={onSeedLockToggle}
              disabled={disabled}
              className={`btn btn-sm gap-1.5 ${seedLocked ? 'btn-warning btn-soft' : 'btn-ghost border border-base-300'}`}
            >
              {seedLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {seedLocked ? 'Locked' : 'Unlocked'}
            </button>
            <span className="text-xs opacity-60 sm:ml-auto">
              {seedLocked
                ? 'Composition preserved — only prompt changes affect output'
                : 'Each regeneration creates a unique variation'}
            </span>
          </div>

          {/* Finalize */}
          <div className="pt-4 border-t border-base-300">
            <button
              onClick={onFinalize}
              disabled={disabled || isFinalizing}
              className="btn btn-success btn-block gap-2"
              style={{ minHeight: '48px' }}
            >
              {isFinalizing ? (
                <><span className="loading loading-spinner loading-sm" />Finalizing Character...</>
              ) : (
                <><Save className="w-5 h-5" />Save Final Character</>
              )}
            </button>
            <p className="text-xs opacity-50 text-center mt-2">
              This will create an immutable character record with all data and the AI-generated manifest
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
