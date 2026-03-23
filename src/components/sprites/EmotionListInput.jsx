// ─── EmotionListInput.jsx ─────────────────────────────────────────────────────
// Manages a list of emotion entries for sprite variation generation.
//
// Each entry is a unified inline row:
//   [ Emotion: text input ] [ Intensity: select ] [ Modifiers: text input ] [×]
//
// Behavior:
//   - User can add up to N entries (N = spriteCount)
//   - Attempting to add beyond N shows a soft inline warning
//   - Empty list = all N sprites get randomized emotion + intensity
//   - Partial list = user entries used first, remainder randomized
//   - Fuzzy matching runs on emotion input (with confidence hint)
//   - Typeahead suggestions appear as user types
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, X, Shuffle, AlertCircle, ChevronDown } from 'lucide-react'
import { resolveEmotion, getEmotionSuggestions, getConfidenceHint } from '../../lib/emotionMatcher'
import { SUGGESTION_GROUPS } from '../../lib/constants/EMOTION_PRESETS'

const INTENSITY_OPTIONS = [
  { value: 'subtle', label: 'Subtle' },
  { value: 'average', label: 'Average' },
  { value: 'high', label: 'High' },
]

// ─── Empty entry factory ──────────────────────────────────────────────────────
function createEmptyEntry() {
  return {
    id: Math.random().toString(36).slice(2),
    emotion: '',
    intensity: 'average',
    modifiers: '',
    resolved: null,
    isVerbatim: false,
    matchedKey: null,
    displayLabel: '',
    confidence: null,
    suggestionOpen: false,
  }
}

// ─── EmotionListInput ─────────────────────────────────────────────────────────
export default function EmotionListInput({ entries, onChange, spriteCount, theme }) {
  const atLimit = entries.length >= spriteCount

  const handleAdd = () => {
    if (atLimit) return
    onChange([...entries, createEmptyEntry()])
  }

  const handleRemove = (id) => {
    onChange(entries.filter(e => e.id !== id))
  }

  const handleEntryChange = useCallback((id, updates) => {
    onChange(entries.map(e => e.id === id ? { ...e, ...updates } : e))
  }, [entries, onChange])

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: theme.labelColor }}
          >
            Emotions
          </label>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: entries.length > 0 ? `${theme.primary}20` : `${theme.textMuted}15`,
              color: entries.length > 0 ? theme.primary : theme.textMuted,
            }}
          >
            {entries.length}/{spriteCount}
          </span>
        </div>
        {entries.length === 0 && (
          <div className="flex items-center gap-1.5">
            <Shuffle className="w-3 h-3" style={{ color: theme.textMuted }} />
            <span className="text-xs" style={{ color: theme.textMuted }}>
              All {spriteCount} will be randomized
            </span>
          </div>
        )}
        {entries.length > 0 && entries.length < spriteCount && (
          <div className="flex items-center gap-1.5">
            <Shuffle className="w-3 h-3" style={{ color: theme.textMuted }} />
            <span className="text-xs" style={{ color: theme.textMuted }}>
              {spriteCount - entries.length} will be randomized
            </span>
          </div>
        )}
      </div>

      {/* Entry list */}
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <EmotionEntryRow
            key={entry.id}
            entry={entry}
            index={index}
            onChange={(updates) => handleEntryChange(entry.id, updates)}
            onRemove={() => handleRemove(entry.id)}
            theme={theme}
          />
        ))}
      </div>

      {/* Add button or limit warning */}
      {atLimit ? (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: `${theme.primary}10`, border: `1px solid ${theme.primary}25`, color: theme.primary }}
        >
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {spriteCount} emotion{spriteCount !== 1 ? 's' : ''} set — matches your sprite count.
          Increase sprite count to add more.
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs w-full transition-all"
          style={{
            background: theme.fieldBg,
            border: `1px dashed ${theme.fieldBorder}`,
            color: theme.textMuted,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = theme.primary
            e.currentTarget.style.color = theme.primary
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = theme.fieldBorder
            e.currentTarget.style.color = theme.textMuted
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Emotion
          {entries.length > 0 && (
            <span className="ml-auto opacity-60">
              {spriteCount - entries.length} slot{spriteCount - entries.length !== 1 ? 's' : ''} remaining
            </span>
          )}
        </button>
      )}
    </div>
  )
}

// ─── EmotionEntryRow ──────────────────────────────────────────────────────────
function EmotionEntryRow({ entry, index, onChange, onRemove, theme }) {
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false)
  const emotionInputRef = useRef(null)
  const suggestionRef = useRef(null)
  const wrapperRef = useRef(null)

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false)
        setShowGroupSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleEmotionChange = (value) => {
    const result = value.trim() ? resolveEmotion(value) : {
      resolved: null, isVerbatim: false, matchedKey: null,
      displayLabel: '', confidence: null,
    }

    onChange({
      emotion: value,
      displayLabel: result.displayLabel || value,
      resolved: result.resolved,
      isVerbatim: result.isVerbatim,
      matchedKey: result.matchedKey,
      confidence: result.confidence,
    })

    // Update typeahead suggestions
    if (value.trim().length >= 1) {
      const suggs = getEmotionSuggestions(value, 6)
      setSuggestions(suggs)
      setShowSuggestions(suggs.length > 0)
      setShowGroupSuggestions(false)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
    }
  }

  const handleSuggestionSelect = (label) => {
    handleEmotionChange(label)
    setShowSuggestions(false)
    setShowGroupSuggestions(false)
    emotionInputRef.current?.blur()
  }

  const handleEmotionFocus = () => {
    // Show group suggestions when field is empty on focus
    if (!entry.emotion?.trim()) {
      setShowGroupSuggestions(true)
      setShowSuggestions(false)
    }
  }

  const confidenceHint = entry.confidence
    ? getConfidenceHint(entry.confidence, entry.matchedKey)
    : null

  return (
    <div ref={wrapperRef} className="relative">
      {/* Unified bar */}
      <div
        className="flex items-stretch gap-0 rounded-xl overflow-hidden"
        style={{ border: `1px solid ${theme.fieldBorder}`, background: theme.fieldBg }}
      >
        {/* Index badge */}
        <div
          className="flex items-center justify-center px-2.5 text-xs font-bold flex-shrink-0"
          style={{
            background: `${theme.primary}15`,
            color: theme.primary,
            borderRight: `1px solid ${theme.fieldBorder}`,
            minWidth: '28px',
          }}
        >
          {index + 1}
        </div>

        {/* Emotion input */}
        <div className="relative flex-1 min-w-0">
          <input
            ref={emotionInputRef}
            type="text"
            value={entry.emotion}
            onChange={e => handleEmotionChange(e.target.value)}
            onFocus={handleEmotionFocus}
            placeholder="Emotion"
            className="w-full h-full px-3 py-2.5 text-sm bg-transparent border-none outline-none"
            style={{ color: theme.textBody, minHeight: '44px' }}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />

          {/* Typeahead suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionRef}
              className="absolute left-0 right-0 top-full mt-1 rounded-xl shadow-xl z-30 overflow-hidden"
              style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
            >
              {suggestions.map(s => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSuggestionSelect(s) }}
                  className="w-full text-left px-3 py-2 text-sm transition-colors"
                  style={{ color: theme.textBody }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${theme.primary}15` }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Group suggestions (shown on empty focus) */}
          {showGroupSuggestions && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-xl shadow-xl z-30 overflow-hidden"
              style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
            >
              <div className="p-2 space-y-2 max-h-64 overflow-y-auto">
                {SUGGESTION_GROUPS.map(group => (
                  <div key={group.label}>
                    <p
                      className="text-xs font-semibold uppercase tracking-wider px-2 py-1"
                      style={{ color: theme.textMuted }}
                    >
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-1 px-1">
                      {group.emotions.map(e => (
                        <button
                          key={e}
                          type="button"
                          onMouseDown={ev => { ev.preventDefault(); handleSuggestionSelect(e) }}
                          className="text-xs px-2 py-1 rounded-lg transition-colors"
                          style={{
                            background: `${theme.primary}10`,
                            color: theme.primary,
                            border: `1px solid ${theme.primary}20`,
                          }}
                          onMouseEnter={ev => { ev.currentTarget.style.background = `${theme.primary}25` }}
                          onMouseLeave={ev => { ev.currentTarget.style.background = `${theme.primary}10` }}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: theme.fieldBorder, flexShrink: 0 }} />

        {/* Intensity select */}
        <div className="relative flex-shrink-0" style={{ minWidth: '100px' }}>
          <select
            value={entry.intensity}
            onChange={e => onChange({ intensity: e.target.value })}
            className="w-full h-full pl-3 pr-7 py-2.5 text-sm bg-transparent border-none outline-none appearance-none cursor-pointer"
            style={{ color: theme.textBody, minHeight: '44px' }}
          >
            {INTENSITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: theme.textMuted }}
          />
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: theme.fieldBorder, flexShrink: 0 }} />

        {/* Modifiers input */}
        <div className="flex-1 min-w-0" style={{ minWidth: '80px', maxWidth: '160px' }}>
          <input
            type="text"
            value={entry.modifiers}
            onChange={e => onChange({ modifiers: e.target.value })}
            placeholder="Add modifiers, e.g. 'no tears'"
            className="w-full h-full px-3 py-2.5 text-sm bg-transparent border-none outline-none"
            style={{ color: theme.textBody, minHeight: '44px' }}
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* Divider */}
        <div style={{ width: '1px', background: theme.fieldBorder, flexShrink: 0 }} />

        {/* Remove button */}
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center justify-center px-3 transition-colors flex-shrink-0"
          style={{ color: theme.textMuted }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#ef444415' }}
          onMouseLeave={e => { e.currentTarget.style.color = theme.textMuted; e.currentTarget.style.background = 'transparent' }}
          aria-label="Remove emotion"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Confidence hint (fuzzy/substring/verbatim) */}
      {confidenceHint && (
        <p
          className="text-xs mt-1 px-1 flex items-center gap-1"
          style={{ color: entry.confidence === 'verbatim' ? theme.primary : theme.textMuted }}
        >
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          {confidenceHint}
        </p>
      )}
    </div>
  )
}
