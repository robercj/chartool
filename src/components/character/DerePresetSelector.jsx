import { useState } from 'react';
import { Check, Info } from 'lucide-react';
import { DERE_PRESETS } from '../../lib/constants/DERE_PRESETS';

export default function DerePresetSelector({
  selected = [],
  onChange,
  disabled = false,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  const togglePreset = (presetId) => {
    if (disabled) return;
    
    if (selected.includes(presetId)) {
      onChange(selected.filter(id => id !== presetId));
    } else {
      onChange([...selected, presetId]);
    }
  };

  const getPresetById = (id) => DERE_PRESETS.find(p => p.id === id);

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {DERE_PRESETS.map((preset) => {
          const isSelected = selected.includes(preset.id);
          const isHovered = hoveredId === preset.id;
          
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => togglePreset(preset.id)}
              onMouseEnter={() => setHoveredId(preset.id)}
              onMouseLeave={() => setHoveredId(null)}
              disabled={disabled}
              className={`relative flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all duration-200 ${
                isSelected
                  ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                  : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              aria-pressed={isSelected}
            >
              <span className="text-sm font-medium">{preset.label}</span>
              {isSelected && (
                <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              )}
              
              {(isHovered || isSelected) && (
                <div 
                  className={`absolute z-10 left-0 right-0 bottom-full mb-2 p-3 rounded-lg border shadow-xl ${
                    isSelected 
                      ? 'bg-indigo-900/95 border-indigo-500/50' 
                      : 'bg-gray-900/95 border-gray-600'
                  }`}
                  role="tooltip"
                >
                  <div className="text-xs space-y-2">
                    <div>
                      <span className="text-gray-400">Surface: </span>
                      <span className="text-gray-200">{preset.surfaceBehavior}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Hidden: </span>
                      <span className="text-gray-200">{preset.hiddenNature}</span>
                    </div>
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {selected.length > 0 && (
        <div className="mt-4 p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-indigo-200">
              <p className="font-medium mb-1">Selected: {selected.map(id => getPresetById(id)?.label).join(' + ')}</p>
              {selected.length > 1 && (
                <p className="text-indigo-300/70 text-xs">
                  Multiple dere types will be composited. The primary type is your first selection.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
