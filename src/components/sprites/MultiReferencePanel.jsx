// ─── MultiReferencePanel.jsx ──────────────────────────────────────────────────
// Multi-reference image management panel for sprite generation.
// Provides primary + additional character reference slots and art style override.
//
// Features:
//   - Primary reference image slot (required, visually distinguished)
//   - Additional reference slots (dynamic count based on model limits)
//   - Art style reference override section (independent from character refs)
//   - Analyze References button with states (analyze/re-analyze/complete)
//   - Model-switch image overflow handling
//   - User guidance tips panels
//   - Drag-and-drop reorder for additional references (desktop)
//
// Per-model image limits:
//   Nano Banana 2 Edit: 6 char refs (1 primary + 5 additional) + 1 art style = 7 total
//   Grok Imagine Edit:  2 char refs (1 primary + 1 additional) + 1 art style = 3 total
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload, X, Plus, Palette, Star, AlertCircle, Check,
  Loader2, RefreshCw, ChevronDown, ChevronUp, Info,
  GripVertical, ImageIcon,
} from 'lucide-react'

// ─── Model limits ─────────────────────────────────────────────────────────────
const MODEL_LIMITS = {
  'fal-ai/nano-banana-2/edit': { maxCharRefs: 6, maxArtStyleRef: 1, maxTotal: 7, label: 'Nano Banana 2' },
  'xai/grok-imagine-image/edit': { maxCharRefs: 2, maxArtStyleRef: 1, maxTotal: 3, label: 'Grok Imagine' },
}

function getModelLimits(model) {
  return MODEL_LIMITS[model] || MODEL_LIMITS['fal-ai/nano-banana-2/edit']
}

// ─── Allowed file types ───────────────────────────────────────────────────────
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

// ─── Main Panel Component ─────────────────────────────────────────────────────
export default function MultiReferencePanel({
  // Primary image (Mode A: user-uploaded, Mode B: pre-loaded)
  primaryImageBase64,
  primaryImageUrl,
  onPrimaryFileSelect,       // (file: File) => void — Mode A only
  onPrimaryClear,            // () => void — Mode A only
  isPrimaryFixed,            // boolean — true in Existing Character mode
  // Additional character references
  additionalRefs,            // Array<{ id: string, file: File, previewUrl: string }>
  onAdditionalRefsChange,    // (refs: Array) => void
  // Art style reference
  artStyleRef,               // { file: File, previewUrl: string } | null
  artStyleAnalysis,          // string | null — result from analyzeArtStyle
  artStyleAnalysisStatus,    // null | 'running' | 'done' | 'error'
  artStyleAnalysisError,     // string | null
  onArtStyleRefChange,       // (ref: { file: File, previewUrl: string } | null) => void
  onArtStyleRetry,           // () => void
  // Analysis
  analysisStatus,            // null | 'running' | 'done' | 'error'
  analysisError,             // string | null
  analysisStale,             // boolean
  onAnalyze,                 // () => void
  onRetryAnalysis,           // () => void
  // Model
  model,                     // string — current generation model ID
  // UI
  theme,
  mode,                      // 'new' | 'existing'
}) {
  const limits = getModelLimits(model)
  const hasArtStyle = !!artStyleRef
  const maxAdditionalSlots = limits.maxCharRefs - 1 - (hasArtStyle ? 0 : 0) // art style doesn't reduce char ref slots
  const additionalCount = additionalRefs?.length || 0
  const totalImages = 1 + additionalCount + (hasArtStyle ? 1 : 0) // primary + additional + art style
  const isOverLimit = totalImages > limits.maxTotal

  // Tips panel state — expanded on first visit
  const [tipsExpanded, setTipsExpanded] = useState(() => {
    try {
      return !localStorage.getItem('chartool_ref_tips_seen')
    } catch { return true }
  })

  const handleTipsToggle = () => {
    setTipsExpanded(e => !e)
    try {
      localStorage.setItem('chartool_ref_tips_seen', '1')
    } catch { /* ignore */ }
  }

  // ── File validation ────────────────────────────────────────────────────────
  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Please upload a PNG, JPG, or WEBP image.'
    }
    return null
  }

  // ── Add additional references ──────────────────────────────────────────────
  const handleAddAdditionalFiles = useCallback((files) => {
    const newRefs = []
    for (const file of files) {
      const err = validateFile(file)
      if (err) continue
      if (additionalCount + newRefs.length >= maxAdditionalSlots) break

      const id = `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const previewUrl = URL.createObjectURL(file)
      newRefs.push({ id, file, previewUrl })
    }
    if (newRefs.length > 0) {
      onAdditionalRefsChange([...(additionalRefs || []), ...newRefs])
    }
  }, [additionalRefs, additionalCount, maxAdditionalSlots, onAdditionalRefsChange])

  // ── Remove additional reference ────────────────────────────────────────────
  const handleRemoveAdditional = useCallback((id) => {
    const ref = additionalRefs?.find(r => r.id === id)
    if (ref?.previewUrl) URL.revokeObjectURL(ref.previewUrl)
    onAdditionalRefsChange((additionalRefs || []).filter(r => r.id !== id))
  }, [additionalRefs, onAdditionalRefsChange])

  // ── Drag-and-drop reorder for additional refs ──────────────────────────────
  const [dragIndex, setDragIndex] = useState(null)

  const handleDragStart = (index) => setDragIndex(index)
  const handleDragOver = (e) => e.preventDefault()
  const handleDrop = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) return
    const reordered = [...(additionalRefs || [])]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(targetIndex, 0, moved)
    onAdditionalRefsChange(reordered)
    setDragIndex(null)
  }

  // ── Determine analysis button state ────────────────────────────────────────
  const hasPrimary = !!(primaryImageBase64 || primaryImageUrl)
  const hasMultipleImages = additionalCount > 0

  let analyzeButtonLabel = 'Analyze References'
  let analyzeButtonEnabled = hasPrimary
  let analyzeButtonStyle = 'primary'

  if (analysisStatus === 'running') {
    analyzeButtonLabel = 'Analyzing...'
    analyzeButtonEnabled = false
  } else if (analysisStatus === 'done' && !analysisStale) {
    analyzeButtonLabel = 'Analysis Complete'
    analyzeButtonEnabled = false
    analyzeButtonStyle = 'success'
  } else if (analysisStatus === 'done' && analysisStale) {
    analyzeButtonLabel = 'Re-analyze References'
    analyzeButtonEnabled = hasPrimary
    analyzeButtonStyle = 'warning'
  } else if (analysisStatus === 'error') {
    analyzeButtonLabel = 'Analyze References'
    analyzeButtonEnabled = hasPrimary
  }

  // ── Excess images for model-switch warning ─────────────────────────────────
  const excessCount = isOverLimit ? totalImages - limits.maxTotal : 0

  return (
    <div className="space-y-4">
      {/* ── CHARACTER REFERENCES section ──────────────────────────────── */}
      <div className="space-y-3">
        <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
          Character References
        </label>

        {/* Image slots grid */}
        <div className="flex flex-wrap gap-3">
          {/* Primary Reference Slot */}
          <PrimarySlot
            imageBase64={primaryImageBase64}
            imageUrl={primaryImageUrl}
            isFixed={isPrimaryFixed}
            onFileSelect={onPrimaryFileSelect}
            onClear={onPrimaryClear}
            theme={theme}
          />

          {/* Additional Reference Slots — filled */}
          {(additionalRefs || []).map((ref, index) => (
            <AdditionalSlot
              key={ref.id}
              ref_={ref}
              index={index}
              isExcess={isOverLimit && index >= (maxAdditionalSlots - excessCount)}
              onRemove={() => handleRemoveAdditional(ref.id)}
              onDragStart={() => handleDragStart(index)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(index)}
              theme={theme}
            />
          ))}

          {/* Additional Reference Slots — empty "+" slots */}
          {hasPrimary && additionalCount < maxAdditionalSlots && (
            <AddSlot
              onFilesSelect={handleAddAdditionalFiles}
              theme={theme}
            />
          )}
        </div>

        {/* Tips panel */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${theme.fieldBorder}`, background: `${theme.fieldBg}80` }}
        >
          <button
            type="button"
            onClick={handleTipsToggle}
            className="w-full flex items-center gap-2 px-3 py-2 text-left"
          >
            <Info className="w-3.5 h-3.5 flex-shrink-0" style={{ color: theme.textMuted }} />
            <span className="text-xs font-medium flex-1" style={{ color: theme.textMuted }}>
              Tips for best character references
            </span>
            {tipsExpanded
              ? <ChevronUp className="w-3.5 h-3.5 flex-shrink-0" style={{ color: theme.textMuted }} />
              : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: theme.textMuted }} />
            }
          </button>
          {tipsExpanded && (
            <div className="px-3 pb-3 space-y-1.5" style={{ borderTop: `1px solid ${theme.fieldBorder}` }}>
              <p className="text-xs pt-2" style={{ color: theme.textMuted }}>
                <strong>Isolate the character.</strong> Use images with a plain, neutral, or transparent background.
              </p>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                <strong>Show varied angles.</strong> Front-facing, three-quarter view, and profile images together give the AI a complete understanding.
              </p>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                <strong>Include a full-body and a close-up.</strong> A full-body shot establishes proportions. A close-up locks in facial detail.
              </p>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                <strong>Keep art style consistent.</strong> If your references use different art styles, the AI may blend them unpredictably.
              </p>
              <p className="text-xs" style={{ color: theme.textMuted }}>
                <strong>Avoid heavy filters or partial crops.</strong> The AI needs clear, well-lit views of actual features.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── ART STYLE OVERRIDE section ───────────────────────────────── */}
      <ArtStyleOverrideSection
        artStyleRef={artStyleRef}
        artStyleAnalysis={artStyleAnalysis}
        artStyleAnalysisStatus={artStyleAnalysisStatus}
        artStyleAnalysisError={artStyleAnalysisError}
        onArtStyleRefChange={onArtStyleRefChange}
        onRetry={onArtStyleRetry}
        theme={theme}
      />

      {/* ── Model-switch overflow warning ─────────────────────────────── */}
      {isOverLimit && (
        <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
          <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
          <p className="text-xs text-error">
            {limits.label} supports up to {limits.maxTotal} reference images total. Please remove {excessCount} image{excessCount !== 1 ? 's' : ''} to continue.
          </p>
        </div>
      )}

      {/* ── Stale analysis warning ────────────────────────────────────── */}
      {analysisStale && analysisStatus === 'done' && (
        <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#f59e0b15', border: '1px solid #f59e0b40' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
          <p className="text-xs" style={{ color: '#f59e0b' }}>
            Reference images changed since last analysis. Re-analyze for best results.
          </p>
        </div>
      )}

      {/* ── Analysis error ────────────────────────────────────────────── */}
      {analysisStatus === 'error' && (
        <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-error" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-error">
              {analysisError || "Couldn't analyze references. Please try again."}
            </p>
          </div>
          <button onClick={onRetryAnalysis} className="btn btn-ghost btn-xs flex-shrink-0 gap-1" style={{ color: '#ef4444' }}>
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}

      {/* ── Analyze References button ─────────────────────────────────── */}
      {(hasMultipleImages || (mode === 'new' && hasPrimary && analysisStatus !== 'done')) && (
        <button
          onClick={analysisStale ? onAnalyze : (analysisStatus === 'error' ? onRetryAnalysis : onAnalyze)}
          disabled={!analyzeButtonEnabled}
          className="btn w-full text-sm font-semibold"
          style={{
            minHeight: '42px',
            background:
              analyzeButtonStyle === 'success' ? '#10b98120' :
              analyzeButtonStyle === 'warning' ? '#f59e0b20' :
              analyzeButtonEnabled ? theme.primaryGlow : undefined,
            borderColor:
              analyzeButtonStyle === 'success' ? '#10b98140' :
              analyzeButtonStyle === 'warning' ? '#f59e0b40' :
              theme.fieldBorder,
            color:
              analyzeButtonStyle === 'success' ? '#10b981' :
              analyzeButtonStyle === 'warning' ? '#f59e0b' :
              analyzeButtonEnabled ? theme.primary : theme.textMuted,
          }}
        >
          {analysisStatus === 'running' ? (
            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</>
          ) : analyzeButtonStyle === 'success' ? (
            <><Check className="w-4 h-4 mr-2" /> {analyzeButtonLabel}</>
          ) : analyzeButtonStyle === 'warning' ? (
            <><RefreshCw className="w-4 h-4 mr-2" /> {analyzeButtonLabel}</>
          ) : (
            <><Loader2 className="w-4 h-4 mr-2" /> {analyzeButtonLabel}</>
          )}
        </button>
      )}
    </div>
  )
}

// ─── PrimarySlot ──────────────────────────────────────────────────────────────
function PrimarySlot({ imageBase64, imageUrl, isFixed, onFileSelect, onClear, theme }) {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const imageSrc = imageBase64 || imageUrl

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && onFileSelect) onFileSelect(file)
  }

  if (imageSrc) {
    return (
      <div
        className="relative rounded-xl overflow-hidden flex-shrink-0"
        style={{
          width: '140px',
          height: '186px',
          border: `2px solid ${theme.primary}`,
          background: theme.fieldBg,
        }}
      >
        <img src={imageSrc} alt="Primary reference" className="w-full h-full object-cover" />
        {/* Star badge */}
        <div
          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: theme.primary, color: 'white' }}
        >
          <Star className="w-3.5 h-3.5" fill="white" />
        </div>
        {/* Label */}
        <div
          className="absolute bottom-0 left-0 right-0 px-2 py-1 text-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <span className="text-[10px] font-semibold text-white uppercase tracking-wider">Primary</span>
        </div>
        {/* Remove button (only in new mode) */}
        {!isFixed && onClear && (
          <button
            onClick={onClear}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center bg-error/80 hover:bg-error transition-colors"
            aria-label="Remove primary image"
          >
            <X className="w-3 h-3 text-white" />
          </button>
        )}
      </div>
    )
  }

  // Empty upload state
  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-all flex-shrink-0"
      style={{
        width: '140px',
        height: '186px',
        background: dragging ? `${theme.primary}10` : theme.fieldBg,
        borderColor: dragging ? theme.primary : theme.fieldBorder,
      }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: theme.primaryGlow }}>
        <Upload className="w-5 h-5" style={{ color: theme.primary }} />
      </div>
      <div className="text-center px-2">
        <p className="text-[10px] font-semibold" style={{ color: theme.textBody }}>Primary Reference</p>
        <p className="text-[9px] mt-0.5" style={{ color: theme.textMuted }}>Required</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => e.target.files?.[0] && onFileSelect(e.target.files[0])}
      />
    </div>
  )
}

// ─── AdditionalSlot ───────────────────────────────────────────────────────────
function AdditionalSlot({ ref_, index, isExcess, onRemove, onDragStart, onDragOver, onDrop, theme }) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      className="relative rounded-xl overflow-hidden flex-shrink-0 group cursor-grab active:cursor-grabbing"
      style={{
        width: '100px',
        height: '133px',
        border: isExcess ? '2px solid #ef4444' : `1px solid ${theme.fieldBorder}`,
        background: theme.fieldBg,
      }}
    >
      <img src={ref_.previewUrl} alt={`Reference ${index + 2}`} className="w-full h-full object-cover" />
      {/* Drag handle hint */}
      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-70 transition-opacity">
        <GripVertical className="w-3.5 h-3.5 text-white drop-shadow" />
      </div>
      {/* Index badge */}
      <div
        className="absolute bottom-0 left-0 right-0 px-1 py-0.5 text-center"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        <span className="text-[9px] text-white/80">Ref {index + 2}</span>
      </div>
      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: 'rgba(239,68,68,0.85)' }}
        aria-label={`Remove reference ${index + 2}`}
      >
        <X className="w-2.5 h-2.5 text-white" />
      </button>
    </div>
  )
}

// ─── AddSlot ──────────────────────────────────────────────────────────────────
function AddSlot({ onFilesSelect, theme }) {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files?.length) {
      onFilesSelect(Array.from(e.dataTransfer.files))
    }
  }

  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed cursor-pointer transition-all flex-shrink-0 hover:opacity-80"
      style={{
        width: '100px',
        height: '133px',
        background: dragging ? `${theme.primary}10` : theme.fieldBg,
        borderColor: dragging ? theme.primary : theme.fieldBorder,
      }}
    >
      <Plus className="w-5 h-5" style={{ color: theme.textMuted }} />
      <span className="text-[9px]" style={{ color: theme.textMuted }}>Add Ref</span>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files?.length) onFilesSelect(Array.from(e.target.files))
          e.target.value = '' // Reset for re-selection of same file
        }}
      />
    </div>
  )
}

// ─── ArtStyleOverrideSection ──────────────────────────────────────────────────
function ArtStyleOverrideSection({
  artStyleRef,
  artStyleAnalysis,
  artStyleAnalysisStatus,
  artStyleAnalysisError,
  onArtStyleRefChange,
  onRetry,
  theme,
}) {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleFileSelect = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) return
    const previewUrl = URL.createObjectURL(file)
    onArtStyleRefChange({ file, previewUrl })
  }

  const handleClear = () => {
    if (artStyleRef?.previewUrl) URL.revokeObjectURL(artStyleRef.previewUrl)
    onArtStyleRefChange(null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: `${theme.accent}08`,
        border: `1px solid ${theme.accent}25`,
      }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Palette className="w-4 h-4" style={{ color: theme.accent }} />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.accent }}>
          Art Style Override
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ color: theme.textMuted, background: `${theme.fieldBorder}60` }}>
          Optional
        </span>
      </div>

      <div className="flex items-start gap-3">
        {/* Art style image slot */}
        {artStyleRef ? (
          <div
            className="relative rounded-xl overflow-hidden flex-shrink-0"
            style={{ width: '100px', height: '100px', border: `1px solid ${theme.accent}40`, background: theme.fieldBg }}
          >
            <img src={artStyleRef.previewUrl} alt="Art style reference" className="w-full h-full object-cover" />
            {/* Analysis status overlay */}
            {artStyleAnalysisStatus === 'running' && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            )}
            {/* Remove button */}
            <button
              onClick={handleClear}
              className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center bg-error/80 hover:bg-error transition-colors"
              aria-label="Remove art style reference"
            >
              <X className="w-2.5 h-2.5 text-white" />
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className="flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed cursor-pointer transition-all flex-shrink-0"
            style={{
              width: '100px',
              height: '100px',
              background: dragging ? `${theme.accent}10` : theme.fieldBg,
              borderColor: dragging ? theme.accent : theme.fieldBorder,
            }}
          >
            <Palette className="w-5 h-5" style={{ color: theme.textMuted }} />
            <span className="text-[9px] text-center px-1" style={{ color: theme.textMuted }}>Add Style</span>
          </div>
        )}

        {/* Description and status */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs" style={{ color: theme.textMuted }}>
            Attach an image whose art style you want to adopt. Only the rendering style is used — the image's subject is ignored.
          </p>

          {/* Analysis status */}
          {artStyleAnalysisStatus === 'done' && artStyleAnalysis && (
            <div className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#10b981' }} />
              <span className="text-xs font-medium" style={{ color: '#10b981' }}>Style analyzed</span>
            </div>
          )}

          {artStyleAnalysisStatus === 'error' && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 text-error" />
              <span className="text-xs text-error">{artStyleAnalysisError || 'Analysis failed'}</span>
              <button onClick={onRetry} className="text-xs text-error underline ml-1">Retry</button>
            </div>
          )}

          {/* Guidance when no image is attached */}
          {!artStyleRef && (
            <div className="space-y-1 mt-1">
              <p className="text-[10px]" style={{ color: theme.textMuted, opacity: 0.7 }}>
                Best images: character illustrations with distinctive rendering. Avoid photos unless you want photorealism. Avoid images with heavy text or watermarks.
              </p>
            </div>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={e => {
          if (e.target.files?.[0]) handleFileSelect(e.target.files[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}

// Export model limits for use in parent
export { getModelLimits, MODEL_LIMITS }
