// ─── VariationControls.jsx ────────────────────────────────────────────────────
// Combined panel for all sprite variation controls.
// Shown after identity lock analysis completes, before generation.
//
// Contains:
//   - EmotionListInput  (emotion + intensity + modifiers per sprite)
//   - PoseSelector      (single or random pose)
//   - ModifierToggles   (optional permissions: prompt, clothing, props)
//   - CustomPromptPanel (shown only when allowPrompt is ON)
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react'
import { Wand2 } from 'lucide-react'
import EmotionListInput from './EmotionListInput'
import PoseSelector from './PoseSelector'
import ModifierToggles from './ModifierToggles'
import CustomPromptPanel from './CustomPromptPanel'

export default function VariationControls({
  spriteCount,
  emotionEntries,
  onEmotionEntriesChange,
  selectedPoseId,
  onPoseChange,
  toggles,
  onTogglesChange,
  customPrompt,
  onCustomPromptChange,
  theme,
}) {
  return (
    <div
      className="rounded-2xl border p-4 space-y-5"
      style={{ background: theme.cardBg, borderColor: theme.cardBorder, backdropFilter: 'blur(12px)' }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${theme.primary}20` }}
        >
          <Wand2 className="w-4 h-4" style={{ color: theme.primary }} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: theme.textBody }}>
            Variation Controls
          </p>
          <p className="text-xs" style={{ color: theme.textMuted }}>
            Set emotion and pose for each sprite, or leave empty to randomize
          </p>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${theme.fieldBorder}` }} />

      {/* Emotion list */}
      <EmotionListInput
        entries={emotionEntries}
        onChange={onEmotionEntriesChange}
        spriteCount={spriteCount}
        theme={theme}
      />

      {/* Pose selector */}
      <PoseSelector
        selectedPoseId={selectedPoseId}
        onChange={onPoseChange}
        theme={theme}
      />

      {/* Optional permissions */}
      <ModifierToggles
        toggles={toggles}
        onChange={onTogglesChange}
        theme={theme}
      />

      {/* Custom prompt (only shown when allowPrompt is ON) */}
      {toggles.allowPrompt && (
        <CustomPromptPanel
          value={customPrompt}
          onChange={onCustomPromptChange}
          theme={theme}
        />
      )}
    </div>
  )
}
