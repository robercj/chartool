// ─── ArtStyleSelector.jsx ──────────────────────────────────────────────────────
// Art style dropdown for sprite generation.
// Uses Nano Banana 2-optimized descriptions from ART_STYLES constant.
//
// When artStyleOverrideActive is true (art style reference image attached),
// the selector is visually muted/disabled with an explanation tooltip.
// ─────────────────────────────────────────────────────────────────────────────
import { Paintbrush, ImageIcon, Palette } from 'lucide-react'
import { ART_STYLES } from '../../lib/constants/ART_STYLES'

export default function ArtStyleSelector({
  value,
  onChange,
  theme,
  artStyleOverrideActive = false,
  onScrollToArtStyle,         // () => void — scrolls to the art style section in reference panel
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Paintbrush className="w-4 h-4" style={{ color: artStyleOverrideActive ? theme.textMuted : theme.primary }} />
        <label
          className="text-sm font-medium"
          style={{ color: artStyleOverrideActive ? theme.textMuted : theme.textBody }}
        >
          Art Style
        </label>
        {/* Attach Reference entry point */}
        {onScrollToArtStyle && !artStyleOverrideActive && (
          <button
            type="button"
            onClick={onScrollToArtStyle}
            className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
            style={{ color: theme.accent, background: `${theme.accent}15` }}
            title="Attach an art style reference image"
          >
            <Palette className="w-3 h-3" />
            Attach Reference
          </button>
        )}
      </div>

      {artStyleOverrideActive ? (
        <div className="relative">
          <select
            value=""
            disabled
            className="select select-bordered w-full text-sm opacity-50 cursor-not-allowed"
          >
            <option value="">Overridden by art style reference</option>
          </select>
          <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
            Art style reference image overrides preset selection.
          </p>
        </div>
      ) : (
        <>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="select select-bordered w-full text-sm"
          >
            <option value="">Same as reference (no style change)</option>
            {ART_STYLES.map((cat) => (
              <optgroup key={cat.category} label={cat.category}>
                {cat.options.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {value && (
            <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
              {ART_STYLES.flatMap(c => c.options).find(o => o.id === value)?.desc || ''}
            </p>
          )}
        </>
      )}
    </div>
  )
}
