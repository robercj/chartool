// ─── PoseSelector.jsx ─────────────────────────────────────────────────────────
// Single-selection pose picker for sprite generation.
// Includes a 'Random' option that randomizes pose per sprite.
// Mobile-first: 2-col grid on mobile, 3-col on sm+
// ─────────────────────────────────────────────────────────────────────────────
import { Shuffle } from 'lucide-react'
import { POSE_CATALOG } from '../../lib/constants/POSE_PRESETS'

const RANDOM_OPTION = {
  id: 'random',
  label: 'Random',
  description: 'Each sprite gets a randomly assigned pose',
  icon: '🎲',
}

export default function PoseSelector({ selectedPoseId, onChange, theme }) {
  const allOptions = [RANDOM_OPTION, ...POSE_CATALOG]

  return (
    <div className="space-y-2">
      <label
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: theme.labelColor }}
      >
        Pose
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {allOptions.map(pose => {
          const isSelected = selectedPoseId === pose.id
          return (
            <button
              key={pose.id}
              type="button"
              onClick={() => onChange(pose.id)}
              className="relative flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all text-sm"
              style={{
                background: isSelected ? `${theme.primary}20` : theme.fieldBg,
                border: `1.5px solid ${isSelected ? theme.primary : theme.fieldBorder}`,
                color: isSelected ? theme.primary : theme.textBody,
              }}
              onMouseEnter={e => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = theme.primary
                  e.currentTarget.style.color = theme.primary
                }
              }}
              onMouseLeave={e => {
                if (!isSelected) {
                  e.currentTarget.style.borderColor = theme.fieldBorder
                  e.currentTarget.style.color = theme.textBody
                }
              }}
              title={pose.description}
            >
              {pose.id === 'random'
                ? <Shuffle className="w-4 h-4 flex-shrink-0" />
                : <span className="text-base leading-none flex-shrink-0">{pose.icon}</span>
              }
              <span className="font-medium truncate leading-tight">{pose.label}</span>
            </button>
          )
        })}
      </div>
      {/* Description of selected pose */}
      {selectedPoseId && selectedPoseId !== 'random' && (
        <p className="text-xs px-1" style={{ color: theme.textMuted }}>
          {POSE_CATALOG.find(p => p.id === selectedPoseId)?.description}
        </p>
      )}
      {selectedPoseId === 'random' && (
        <p className="text-xs px-1" style={{ color: theme.textMuted }}>
          Each sprite will be assigned a different pose automatically.
        </p>
      )}
    </div>
  )
}
