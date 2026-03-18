// ─── CustomPromptPanel.jsx ────────────────────────────────────────────────────
// Collapsible custom prompt textarea. Only rendered when allowPrompt toggle is ON.
// ─────────────────────────────────────────────────────────────────────────────
import { MessageSquarePlus } from 'lucide-react'

export default function CustomPromptPanel({ value, onChange, theme }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquarePlus className="w-3.5 h-3.5" style={{ color: '#6366f1' }} />
        <label
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: theme.labelColor }}
        >
          Custom Direction
        </label>
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Add extra generation direction, e.g. 'Studio lighting. Plain white background. Character facing forward.'"
        rows={3}
        className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
        style={{
          background: theme.fieldBg,
          border: `1px solid ${theme.fieldBorder}`,
          color: theme.textBody,
          outline: 'none',
        }}
        onFocus={e => { e.target.style.borderColor = theme.primary }}
        onBlur={e => { e.target.style.borderColor = theme.fieldBorder }}
      />
      <p className="text-xs px-1" style={{ color: theme.textMuted }}>
        Applied to all sprites. Will not override the character identity lock.
      </p>
    </div>
  )
}
