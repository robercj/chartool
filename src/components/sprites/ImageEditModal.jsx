// ─── ImageEditModal.jsx ───────────────────────────────────────────────────────
// Dual-purpose modal: enlarged image view + sprite edit/regeneration.
//
// Features:
//   - Full image preview (full-screen on mobile, centered on desktop)
//   - Seed display: editable text field, locked by default
//   - Edit instructions textarea (freeform)
//   - Regenerate button: generates NEW image without overwriting the original
//   - Loading/error states inline
//   - Keyboard: Escape to close
//
// NOTE: Regeneration currently uses the same generateImage() flow as the
// original sprite generation (generation model, not edit/inpainting model).
// If edit quality is insufficient, switch to a dedicated edit endpoint
// (e.g. fal-ai/nano-banana-2/edit). The API call structure in generateImage()
// would need to be updated accordingly.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Lock, Unlock, RefreshCw, Download, Loader2, AlertCircle, Wand2 } from 'lucide-react'
import { generateImage, LimitError } from '../../lib/anthropic'
import { compileEditPrompt } from '../../lib/promptCompiler'

export default function ImageEditModal({
  image,           // { url, label, seed, poseId, emotionEntry, params_snapshot }
  identityLock,    // structured identity lock JSON
  consistencyPrompt, // fallback flat-text prompt
  referenceImageBase64, // base64 for generation
  referenceImageUrl,    // CDN URL fallback
  toggles,         // { allowClothing, allowProps }
  aspectRatio,
  onClose,
  onNewImageGenerated, // (newImageEntry) => void — called when a new variation is generated
  theme,
}) {
  const [editInstructions, setEditInstructions] = useState('')
  const [seed, setSeed] = useState(image?.seed ?? '')
  const [seedLocked, setSeedLocked] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [newImages, setNewImages] = useState([])  // images generated during this modal session
  const [viewingUrl, setViewingUrl] = useState(image?.url)
  const textareaRef = useRef(null)
  const abortRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  const handleRegenerate = useCallback(async () => {
    if (generating) return
    if (!editInstructions.trim()) {
      textareaRef.current?.focus()
      return
    }

    setGenerating(true)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      // Compile edit prompt: identity lock + original pose/emotion + edit instructions
      const finalPrompt = compileEditPrompt({
        identityLock,
        consistencyPrompt,
        originalPoseId: image?.poseId ?? null,
        originalEmotionEntry: image?.emotionEntry ?? null,
        editInstructions: editInstructions.trim(),
        allowClothing: toggles?.allowClothing ?? false,
        allowProps: toggles?.allowProps ?? false,
      })

      // NOTE: Using generation model. May need to switch to edit model
      // (e.g. fal-ai/nano-banana-2/edit) for better inpainting performance.
      const imageUrl = await generateImage({
        prompt: finalPrompt,
        referenceImageUrls: [referenceImageBase64 || referenceImageUrl].filter(Boolean),
        aspectRatio: aspectRatio || '3:4',
        ...(seedLocked && seed ? { seed: parseInt(seed, 10) } : {}),
      }, controller.signal)

      const newEntry = {
        url: imageUrl,
        label: `Edit of ${image?.label || 'Sprite'}`,
        generated_at: new Date().toISOString(),
        seed: seedLocked && seed ? parseInt(seed, 10) : null,
        editInstructions: editInstructions.trim(),
        parentUrl: image?.url,  // reference to source image
        params_snapshot: { aspectRatio, editInstructions: editInstructions.trim() },
        poseId: image?.poseId ?? null,
        emotionEntry: image?.emotionEntry ?? null,
      }

      setNewImages(prev => [newEntry, ...prev])
      setViewingUrl(imageUrl)
      onNewImageGenerated(newEntry)
    } catch (err) {
      if (err.message === 'Request cancelled') return
      if (err instanceof LimitError) {
        setError(err.message)
      } else {
        setError(err.message || 'Regeneration failed. Please try again.')
      }
    } finally {
      setGenerating(false)
    }
  }, [
    generating, editInstructions, identityLock, consistencyPrompt,
    image, toggles, referenceImageBase64, referenceImageUrl,
    aspectRatio, seedLocked, seed, onNewImageGenerated,
  ])

  const handleDownload = (url) => {
    const a = document.createElement('a')
    a.href = url
    a.download = `sprite-${Date.now()}.png`
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.click()
  }

  const allImages = [image, ...newImages].filter(Boolean)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* Modal panel — full-width bottom sheet on mobile, card on desktop */}
        <div
          className="relative w-full sm:max-w-2xl sm:rounded-2xl overflow-hidden flex flex-col"
          style={{
            background: theme.cardBg,
            border: `1px solid ${theme.cardBorder}`,
            maxHeight: '96vh',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}
          >
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4" style={{ color: theme.primary }} />
              <p className="text-sm font-semibold" style={{ color: theme.textBody }}>
                {image?.label || 'Sprite'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-square"
              style={{ color: theme.textMuted }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Image */}
            <div
              className="relative w-full bg-black flex items-center justify-center"
              style={{ minHeight: '200px', maxHeight: '55vh' }}
            >
              <img
                src={viewingUrl}
                alt={image?.label}
                className="w-full h-full object-contain"
                style={{ maxHeight: '55vh' }}
              />
              {/* Download button overlay */}
              <button
                onClick={() => handleDownload(viewingUrl)}
                className="absolute top-2 right-2 btn btn-ghost btn-sm btn-square"
                style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}
                aria-label="Download image"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Thumbnail strip (original + new generated variants) */}
            {allImages.length > 1 && (
              <div
                className="flex gap-2 px-4 py-2 overflow-x-auto"
                style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}
              >
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setViewingUrl(img.url)}
                    className="flex-shrink-0 rounded-lg overflow-hidden transition-all"
                    style={{
                      width: '52px',
                      height: '52px',
                      border: `2px solid ${viewingUrl === img.url ? theme.primary : theme.fieldBorder}`,
                    }}
                  >
                    <img
                      src={img.url}
                      alt={img.label}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Edit controls */}
            <div className="p-4 space-y-4">
              {/* Seed control */}
              <div className="space-y-1.5">
                <label
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: theme.labelColor }}
                >
                  Seed
                </label>
                <div
                  className="flex items-center gap-0 rounded-xl overflow-hidden"
                  style={{ border: `1px solid ${theme.fieldBorder}`, background: theme.fieldBg }}
                >
                  <input
                    type="number"
                    value={seed}
                    onChange={e => setSeed(e.target.value)}
                    placeholder="Auto"
                    disabled={seedLocked && !seed}
                    className="flex-1 px-3 py-2.5 text-sm bg-transparent border-none outline-none"
                    style={{ color: theme.textBody }}
                  />
                  <div style={{ width: '1px', background: theme.fieldBorder, alignSelf: 'stretch' }} />
                  <button
                    type="button"
                    onClick={() => setSeedLocked(s => !s)}
                    className="flex items-center gap-1.5 px-3 py-2.5 text-xs flex-shrink-0 transition-colors"
                    style={{
                      color: seedLocked ? theme.primary : theme.textMuted,
                      background: seedLocked ? `${theme.primary}10` : 'transparent',
                    }}
                  >
                    {seedLocked
                      ? <><Lock className="w-3.5 h-3.5" /> Locked</>
                      : <><Unlock className="w-3.5 h-3.5" /> Unlocked</>
                    }
                  </button>
                </div>
                <p className="text-xs px-0.5" style={{ color: theme.textMuted }}>
                  {seedLocked
                    ? 'Same seed = more consistent edits. Unlock to allow variation.'
                    : 'Unlocked — new seed each regeneration for more variation.'}
                </p>
              </div>

              {/* Edit instructions */}
              <div className="space-y-1.5">
                <label
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: theme.labelColor }}
                >
                  Edit Instructions
                </label>
                <textarea
                  ref={textareaRef}
                  value={editInstructions}
                  onChange={e => setEditInstructions(e.target.value)}
                  placeholder="Describe what to change, e.g. 'Remove the glasses, change hair color to blonde, character should be looking at the camera'"
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
                <p className="text-xs px-0.5" style={{ color: theme.textMuted }}>
                  Character identity (face, hair, eyes) remains locked. Focus edits on pose, expression, or permitted changes.
                </p>
              </div>

              {/* Error */}
              {error && (
                <div
                  className="flex items-start gap-2 p-3 rounded-xl text-sm"
                  style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444' }}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* New images generated count */}
              {newImages.length > 0 && (
                <div
                  className="flex items-center gap-2 p-2.5 rounded-xl text-sm"
                  style={{ background: '#10b98115', border: '1px solid #10b98130', color: '#10b981' }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {newImages.length} edit{newImages.length !== 1 ? 's' : ''} generated and saved — originals preserved.
                </div>
              )}
            </div>
          </div>

          {/* Footer — actions */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ borderTop: `1px solid ${theme.fieldBorder}` }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm flex-1"
              style={{ color: theme.textMuted }}
            >
              Done
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={generating || !editInstructions.trim()}
              className="btn btn-sm flex-1 gap-2 font-semibold"
              style={{
                background: (!generating && editInstructions.trim()) ? theme.buttonGradient : undefined,
                border: 'none',
                color: (!generating && editInstructions.trim()) ? 'white' : undefined,
              }}
            >
              {generating
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</>
                : <><Wand2 className="w-3.5 h-3.5" /> Regenerate</>
              }
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
