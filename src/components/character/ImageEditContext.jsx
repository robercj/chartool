import { useState, useCallback } from 'react';
import { 
  Download, RefreshCw, Lock, Unlock, Check, 
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
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [generatedImageUrl]);

  const handleRegenerate = useCallback(() => {
    onRegenerate(regenerationPrompt);
    setRegenerationPrompt('');
  }, [regenerationPrompt, onRegenerate]);

  const handleRegenerateWithoutInput = useCallback(() => {
    onRegenerateWithoutInput();
  }, [onRegenerateWithoutInput]);

  const goToPreviousImage = useCallback(() => {
    if (currentHistoryIndex > 0) {
      setCurrentHistoryIndex(currentHistoryIndex - 1);
    }
  }, [currentHistoryIndex]);

  const goToNextImage = useCallback(() => {
    if (currentHistoryIndex < imageHistory.length - 1) {
      setCurrentHistoryIndex(currentHistoryIndex + 1);
    }
  }, [currentHistoryIndex, imageHistory.length]);

  const currentImage = currentHistoryIndex >= 0 && currentHistoryIndex < imageHistory.length
    ? imageHistory[currentHistoryIndex]
    : generatedImageUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl">
        <Sparkles className="w-6 h-6 text-indigo-400" />
        <div>
          <h3 className="text-lg font-semibold text-white">Character Generated — Edit Mode</h3>
          <p className="text-sm text-indigo-300/70">
            Refine the image with targeted changes or finalize the character
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Image Display */}
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-700">
            {currentImage ? (
              <img
                src={currentImage}
                alt="Generated character"
                className="w-full h-auto max-h-[500px] object-contain"
              />
            ) : (
              <div className="w-full h-64 flex items-center justify-center text-gray-500">
                No image generated yet
              </div>
            )}
            
            {generatedImageUrl && (
              <button
                onClick={handleDownload}
                className="absolute top-3 right-3 p-2 bg-black/50 hover:bg-black/70 text-white rounded-lg transition-colors"
                aria-label="Download image"
              >
                <Download className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Image History Strip */}
          {imageHistory.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousImage}
                disabled={currentHistoryIndex <= 0}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
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
                        ? 'border-indigo-500'
                        : 'border-transparent hover:border-gray-600'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`Generation ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
              
              <button
                onClick={goToNextImage}
                disabled={currentHistoryIndex >= imageHistory.length - 1}
                className="p-1 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Next image"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {/* Edit Controls */}
        <div className="space-y-4">
          <div>
            <label htmlFor="regen-prompt" className="block text-sm font-medium text-gray-300 mb-1.5">
              Regeneration Prompt
            </label>
            <textarea
              id="regen-prompt"
              value={regenerationPrompt}
              onChange={(e) => setRegenerationPrompt(e.target.value)}
              placeholder="Describe changes you want: e.g., 'different hair color to red', 'more formal clothing', 'angry expression'..."
              rows={4}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleRegenerate}
              disabled={disabled || isGenerating || !regenerationPrompt.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Regenerate with Prompt
                </>
              )}
            </button>

            <button
              onClick={handleRegenerateWithoutInput}
              disabled={disabled || isGenerating}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              Regenerate without new input
            </button>
          </div>

          {/* Seed Control */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <div className="flex items-center gap-2">
              <label htmlFor="edit-seed" className="text-sm text-gray-300">
                Seed:
              </label>
              <input
                id="edit-seed"
                type="number"
                value={seed ?? ''}
                onChange={(e) => onSeedChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                placeholder="Random"
                disabled={disabled}
                className="w-24 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <button
              onClick={onSeedLockToggle}
              disabled={disabled}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
                seedLocked
                  ? 'bg-amber-600/20 border border-amber-500/50 text-amber-400'
                  : 'bg-gray-700 border border-gray-600 text-gray-300 hover:bg-gray-600'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {seedLocked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  Locked
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  Unlocked
                </>
              )}
            </button>

            <span className="text-xs text-gray-400 sm:ml-auto">
              {seedLocked
                ? 'Composition preserved — only prompt changes affect output'
                : 'Each regeneration creates a unique variation'}
            </span>
          </div>

          {/* Finalize Button */}
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={onFinalize}
              disabled={disabled || isFinalizing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed"
            >
              {isFinalizing ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Finalizing Character...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Save Final Character
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              This will create an immutable character record with all data and the AI-generated manifest
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
