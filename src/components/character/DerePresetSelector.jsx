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
          const isHovered  = hoveredId === preset.id;

          return (
            <div key={preset.id} className="relative">
              <button
                type="button"
                onClick={() => togglePreset(preset.id)}
                onMouseEnter={() => setHoveredId(preset.id)}
                onMouseLeave={() => setHoveredId(null)}
                disabled={disabled}
                className={`btn btn-sm w-full justify-between gap-1 ${
                  isSelected ? 'btn-primary' : 'btn-ghost border border-base-300'
                } ${disabled ? 'btn-disabled' : ''}`}
                style={{ minHeight: '40px' }}
                aria-pressed={isSelected}
              >
                <span className="text-sm font-medium truncate">{preset.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>

              {/* Hover/selected tooltip */}
              {(isHovered || isSelected) && (
                <div
                  className={`absolute z-20 left-0 right-0 bottom-full mb-2 p-3 rounded-xl border shadow-xl text-xs space-y-1.5 ${
                    isSelected
                      ? 'bg-primary/10 border-primary/40 text-primary-content'
                      : 'bg-base-200 border-base-300 text-base-content'
                  }`}
                  role="tooltip"
                >
                  <div>
                    <span className="opacity-60">Surface: </span>
                    <span>{preset.surfaceBehavior}</span>
                  </div>
                  <div>
                    <span className="opacity-60">Hidden: </span>
                    <span>{preset.hiddenNature}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected.length > 0 && (
        <div className="mt-4 alert alert-info">
          <Info className="w-4 h-4 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium">
              Selected: {selected.map(id => getPresetById(id)?.label).join(' + ')}
            </p>
            {selected.length > 1 && (
              <p className="opacity-70 text-xs mt-0.5">
                Multiple dere types will be composited. The primary type is your first selection.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
