// ─── ArtStyleSelector.jsx ──────────────────────────────────────────────────────
// Art style dropdown for sprite generation.
// Uses Nano Banana 2-optimized descriptions from ART_STYLES constant.
// ─────────────────────────────────────────────────────────────────────────────
import { Paintbrush } from 'lucide-react'
import { ART_STYLES } from '../../lib/constants/ART_STYLES'

export default function ArtStyleSelector({
  value,
  onChange,
  theme,
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Paintbrush className="w-4 h-4" style={{ color: theme.primary }} />
        <label
          className="text-sm font-medium"
          style={{ color: theme.textBody }}
        >
          Art Style
        </label>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="select select-bordered w-full text-sm"
        style={{
          background: theme.fieldBg,
          borderColor: theme.fieldBorder,
          color: theme.textBody,
        }}
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
    </div>
  )
}
