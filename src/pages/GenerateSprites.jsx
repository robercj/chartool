// ─── GenerateSprites.jsx ───────────────────────────────────────────────────────
// Route: /sprites/generate
// Replaces the old /generate page. Builds sprite image variations from a
// character reference image, linked to a character record.
//
// Two modes:
//   Mode A — New Character: name + upload → analysis → create record → generate
//   Mode B — Existing Character: select → pre-load image → analysis (if needed) → generate
//
// The image variation generation pipeline (callLLM analysis + generateImage)
// is preserved unchanged from the legacy flow.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Upload, X, Sparkles, User, Search, Check,
  AlertCircle, RefreshCw, Loader2, Download, Trash2, Lock,
  ChevronDown, ChevronUp, Image as ImageIcon, ZoomIn,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useProgress } from '../contexts/ProgressContext'
import { useAuth } from '../contexts/AuthContext'
import { Character } from '../lib/storage'
import { analyzeReferenceImage, generateImage, LimitError } from '../lib/anthropic'
import { supabase } from '../lib/supabase'

// ─── Aspect ratio options (carried from legacy flow) ─────────────────────────
const ASPECT_RATIOS = [
  { value: '21:9', label: '21:9 — Cinematic Wide' },
  { value: '16:9', label: '16:9 — Widescreen' },
  { value: '3:2',  label: '3:2 — Landscape' },
  { value: '4:3',  label: '4:3 — Standard' },
  { value: '5:4',  label: '5:4 — Classic' },
  { value: '1:1',  label: '1:1 — Square' },
  { value: '4:5',  label: '4:5 — Tall' },
  { value: '3:4',  label: '3:4 — Portrait' },
  { value: '2:3',  label: '2:3 — Slim Portrait' },
  { value: '9:16', label: '9:16 — Vertical' },
]

const DEFAULT_VARIATION_COUNT = 5

// ─── Main exported page ───────────────────────────────────────────────────────
export default function GenerateSprites() {
  const { theme } = useTheme()
  const { startProgress, updateProgress, clearProgress, isCancelled, generating, setGenerating, getAbortSignal } = useProgress()
  const { user } = useAuth()
  const userId = user?.id
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const mountedRef = useRef(true)

  // ── Mode state: null (selection screen) | 'new' | 'existing' ──────────────
  const [mode, setMode] = useState(null)

  // ── New character form state ───────────────────────────────────────────────
  const [newCharName, setNewCharName] = useState('')
  const [nameError, setNameError] = useState(null)
  const [nameChecking, setNameChecking] = useState(false)
  // readyToAnalyze: set true when BOTH name is valid AND image is uploaded.
  // The analysis effect watches this flag to fire exactly once per valid pair.
  const [readyToAnalyze, setReadyToAnalyze] = useState(false)

  // ── Shared image state ────────────────────────────────────────────────────
  // referenceImageBase64: data URL (data:image/...;base64,...) for the analysis call
  // referenceImageUrl: persistent CDN/storage URL stored on the character record
  const [referenceImageBase64, setReferenceImageBase64] = useState(null)
  const [referenceImageUrl, setReferenceImageUrl] = useState(null)
  const [referenceImageFile, setReferenceImageFile] = useState(null)

  // ── Analysis state ─────────────────────────────────────────────────────────
  const [analysisStatus, setAnalysisStatus] = useState(null) // null | 'running' | 'done' | 'error'
  const [analysisError, setAnalysisError] = useState(null)
  const [consistencyPrompt, setConsistencyPrompt] = useState(null)

  // ── Existing character mode ────────────────────────────────────────────────
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [charSearch, setCharSearch] = useState('')

  // ── Character record (created before generation in Mode A) ─────────────────
  const [createdCharacter, setCreatedCharacter] = useState(null)

  // ── Generation controls state ──────────────────────────────────────────────
  const [variationCount, setVariationCount] = useState(DEFAULT_VARIATION_COUNT)
  const [aspectRatio, setAspectRatio] = useState('3:4')
  const [seedValue, setSeedValue] = useState('')
  const [liveImages, setLiveImages] = useState([])
  const [generationError, setGenerationError] = useState(null)

  // ── Reset trigger (from nav same-route) ───────────────────────────────────
  const resetKey = location.state?.reset

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // Reset all state when user navigates to the same route (reset state trigger)
  useEffect(() => {
    if (resetKey) {
      resetAll()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // ── Fetch all characters for Mode B ──────────────────────────────────────
  const { data: allCharacters = [] } = useQuery({
    queryKey: ['characters', userId],
    queryFn: () => Character.list(userId),
    enabled: !!userId,
  })

  // ── Filtered character list for Mode B search ─────────────────────────────
  const filteredCharacters = allCharacters.filter(c =>
    !charSearch.trim() ||
    (c.character_name || '').toLowerCase().includes(charSearch.toLowerCase())
  )

  // ── Debounced name uniqueness check for Mode A ────────────────────────────
  // After the check resolves, if the name is now valid AND an image is already
  // uploaded but analysis hasn't started yet, trigger analysis immediately.
  useEffect(() => {
    if (mode !== 'new' || !newCharName.trim()) {
      setNameError(null)
      return
    }
    const timer = setTimeout(async () => {
      setNameChecking(true)
      try {
        const taken = await Character.nameExists(userId, newCharName.trim())
        if (taken) {
          setNameError(`You already have a character named "${newCharName.trim()}". Please choose a different name.`)
        } else {
          setNameError(null)
          // Name is now valid — if image is ready and analysis hasn't run yet, start it
          setReadyToAnalyze(true)
        }
      } finally {
        setNameChecking(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [newCharName, userId, mode])

  // ── Reset all state (back to mode selection) ──────────────────────────────
  const resetAll = useCallback(() => {
    setMode(null)
    setNewCharName('')
    setNameError(null)
    setNameChecking(false)
    setReadyToAnalyze(false)
    setReferenceImageBase64(null)
    setReferenceImageUrl(null)
    setReferenceImageFile(null)
    setAnalysisStatus(null)
    setAnalysisError(null)
    setConsistencyPrompt(null)
    setSelectedCharacter(null)
    setCharSearch('')
    setCreatedCharacter(null)
    setVariationCount(DEFAULT_VARIATION_COUNT)
    setAspectRatio('3:4')
    setSeedValue('')
    setLiveImages([])
    setGenerationError(null)
  }, [])

  // ── Gate: fire analysis only when BOTH name is valid AND image is uploaded ──
  // This effect watches readyToAnalyze (flipped true by the name check or by
  // image upload, whichever completes last) and starts analysis exactly once.
  useEffect(() => {
    if (!readyToAnalyze) return
    if (mode !== 'new') return
    // Re-check both conditions synchronously before firing
    if (!referenceImageBase64) return
    if (!newCharName.trim() || nameError || nameChecking) return
    if (analysisStatus === 'running' || analysisStatus === 'done') return

    // All conditions met — reset the flag and fire analysis
    setReadyToAnalyze(false)
    runAnalysis(referenceImageBase64, null)
  // runAnalysis is stable (no deps change it); including it would cause re-runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToAnalyze, referenceImageBase64, newCharName, nameError, nameChecking, analysisStatus, mode])

  // ── Upload reference image to Supabase Storage ────────────────────────────
  const uploadReferenceImage = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase() || 'png'
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage
      .from('reference-images')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error(`Image upload failed: ${error.message}`)
    const { data: urlData } = supabase.storage
      .from('reference-images')
      .getPublicUrl(data.path)
    // If bucket is private, use createSignedUrl instead
    // For a private bucket, we'll generate a long-lived signed URL (7 days)
    const { data: signed, error: signErr } = await supabase.storage
      .from('reference-images')
      .createSignedUrl(data.path, 60 * 60 * 24 * 7) // 7 days
    if (signErr) {
      // Fallback: use public URL if available
      return urlData?.publicUrl || null
    }
    return signed.signedUrl
  }

  // ── Handle file input for Mode A ──────────────────────────────────────────
  // Stores the file and base64 preview. Does NOT start analysis here — analysis
  // is gated on BOTH a valid name AND a valid image being present simultaneously.
  const handleFileSelect = (file) => {
    if (!file) return
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPG, or WEBP image.')
      return
    }

    // Reset analysis state for this new image
    setReferenceImageFile(file)
    setAnalysisStatus(null)
    setAnalysisError(null)
    setConsistencyPrompt(null)
    setCreatedCharacter(null)
    setReadyToAnalyze(false)

    // Convert to base64 (for preview + analysis call)
    const reader = new FileReader()
    reader.onload = (e) => {
      setReferenceImageBase64(e.target.result)
      // Signal that the image side is ready — the gate effect will check the
      // name side and fire analysis if both conditions are now satisfied.
      setReadyToAnalyze(true)
    }
    reader.readAsDataURL(file)
  }

  // ── Run Claude image analysis ─────────────────────────────────────────────
  // Mode A: after analysis succeeds, immediately create the character record
  //         so it is visible in the Gallery before generation runs.
  // Mode B: persist the consistency prompt on the existing character record.
  const runAnalysis = async (imageBase64, existingCharacter) => {
    setAnalysisStatus('running')
    setAnalysisError(null)
    try {
      const result = await analyzeReferenceImage(imageBase64)
      if (!mountedRef.current) return
      setConsistencyPrompt(result)
      setAnalysisStatus('done')

      if (existingCharacter) {
        // ── Mode B: persist prompt on existing character ──────────────────
        await Character.update(existingCharacter.id, {
          character_consistency_prompt: result,
        })
        queryClient.invalidateQueries({ queryKey: ['characters', userId] })
        queryClient.invalidateQueries({ queryKey: ['character', existingCharacter.id] })
        setSelectedCharacter(prev => ({ ...prev, character_consistency_prompt: result }))
      } else {
        // ── Mode A: create character record immediately after analysis ─────
        // Use the current name + file from state at the time analysis finishes.
        // referenceImageFile is captured via closure from the enclosing scope.
        await createCharacterRecord(result, imageBase64)
      }
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Image analysis failed:', err)
      setAnalysisStatus('error')
      setAnalysisError(err.message || 'Analysis failed')
    }
  }

  // ── Select existing character (Mode B) ────────────────────────────────────
  const handleSelectCharacter = async (char) => {
    setSelectedCharacter(char)
    setAnalysisStatus(null)
    setAnalysisError(null)
    setConsistencyPrompt(null)
    setLiveImages([])

    // Check for primary image
    const primaryImageUrl = char.generated_image_url
    if (!primaryImageUrl) {
      // No primary image — show warning, do not proceed with analysis
      setReferenceImageBase64(null)
      setReferenceImageUrl(null)
      return
    }

    setReferenceImageUrl(primaryImageUrl)

    // If character already has a consistency prompt, use it directly
    if (char.character_consistency_prompt) {
      setConsistencyPrompt(char.character_consistency_prompt)
      setAnalysisStatus('done')
      return
    }

    // No consistency prompt yet — fetch image, convert to base64, run analysis
    setAnalysisStatus('running')
    try {
      const base64 = await fetchImageAsBase64(primaryImageUrl)
      if (!mountedRef.current) return
      setReferenceImageBase64(base64)
      await runAnalysis(base64, char)
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Failed to load character image:', err)
      setAnalysisStatus('error')
      setAnalysisError(`Could not load ${char.character_name}'s image for analysis: ${err.message}`)
    }
  }

  // ── Fetch a remote image and convert to base64 data URL ───────────────────
  const fetchImageAsBase64 = async (url) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // ── Readiness checks ──────────────────────────────────────────────────────
  // canGenerateNew requires the character record to already exist in the DB
  // (createdCharacter non-null), which happens after analysis completes.
  const canGenerateNew = (
    mode === 'new' &&
    createdCharacter !== null &&
    analysisStatus === 'done'
  )

  const canGenerateExisting = (
    mode === 'existing' &&
    selectedCharacter !== null &&
    selectedCharacter.generated_image_url &&
    analysisStatus === 'done'
  )

  const canGenerate = canGenerateNew || canGenerateExisting

  // ── Create character record immediately after analysis (Mode A) ──────────
  // Called directly from runAnalysis on success. Uploads the reference image to
  // storage first so the record has a persistent URL for the Gallery thumbnail.
  // The record is created BEFORE any sprite generation occurs.
  const createCharacterRecord = async (prompt, imageBase64) => {
    // Upload the reference image file to Supabase Storage for a persistent URL.
    // Fall back to the base64 data URL only if storage upload fails.
    let storedUrl = imageBase64
    if (referenceImageFile) {
      try {
        storedUrl = await uploadReferenceImage(referenceImageFile) || imageBase64
      } catch (uploadErr) {
        console.warn('Storage upload failed, using base64 fallback:', uploadErr)
        storedUrl = imageBase64
      }
    }

    const record = await Character.create(userId, {
      character_name:               newCharName.trim(),
      creation_source:              'sprites',
      creation_status:              'finalized',
      reference_image_url:          storedUrl,
      generated_image_url:          storedUrl, // reference image is the primary Gallery thumbnail
      character_consistency_prompt: prompt,
      character_prompt:             null,
      appearance_description:       null,
      sprite_images:                null,
    })

    if (!mountedRef.current) return
    setCreatedCharacter(record)
    // Immediately refresh the characters list so the Gallery shows this record
    queryClient.invalidateQueries({ queryKey: ['characters', userId] })
    toast.success(`Character "${record.character_name}" added to your Gallery.`)
    return record
  }

  // ── Resolve the active character record for generation ────────────────────
  // By the time the user clicks Generate, the record must already exist (Mode A)
  // or be the selected character (Mode B). This is now just a guard/lookup.
  const resolveCharacterForGeneration = () => {
    if (mode === 'existing') return selectedCharacter
    if (createdCharacter) return createdCharacter
    // Should not reach here — Generate button is disabled until createdCharacter exists
    throw new Error('Character record not yet created. Please wait for analysis to complete.')
  }

  // ── Main generation handler ───────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!canGenerate || generating) return
    setGenerationError(null)
    setLiveImages([])
    setGenerating(true)

    const signal = getAbortSignal()
    let errors = []
    let successCount = 0

    try {
      // Step 1: Resolve the character record (already created before generation)
      const character = resolveCharacterForGeneration()

      const charName = character.character_name || 'Character'
      const refImageBase64 = referenceImageBase64
      const refImageUrl = mode === 'existing'
        ? character.generated_image_url
        : (character.reference_image_url || referenceImageBase64)
      const prompt = consistencyPrompt || character.character_consistency_prompt || ''

      startProgress(`Generating sprites for ${charName}`, variationCount, '/sprites/generate')

      for (let i = 0; i < variationCount; i++) {
        if (isCancelled()) break

        try {
          const imageUrl = await generateImage({
            prompt: `Character sprite variation. ${prompt}`,
            referenceImageUrls: [refImageBase64 || refImageUrl].filter(Boolean),
            aspectRatio,
          }, signal)

          if (!mountedRef.current) break

          // Append to sprite_images on the character record
          const spriteEntry = {
            url: imageUrl,
            generated_at: new Date().toISOString(),
            seed: seedValue ? parseInt(seedValue, 10) : null,
            params_snapshot: { variationCount, aspectRatio },
          }

          await Character.addSpriteImage(character.id, spriteEntry)

          setLiveImages(prev => [...prev, { url: imageUrl, label: `Sprite ${prev.length + 1}` }])
          successCount++
          updateProgress(i + 1)

          // Invalidate character queries so detail page stays fresh
          queryClient.invalidateQueries({ queryKey: ['character', character.id] })
          queryClient.invalidateQueries({ queryKey: ['characters', userId] })
        } catch (err) {
          console.error(`Sprite ${i + 1} generation failed:`, err)
          if (err instanceof LimitError) {
            toast.error(err.message)
            break
          }
          errors.push(`Sprite ${i + 1}: ${err.message || 'Generation failed'}`)
        }
      }

      clearProgress()

      if (successCount > 0) {
        toast.success(`Generated ${successCount} sprite${successCount !== 1 ? 's' : ''} successfully!`)
      }
      if (errors.length > 0) {
        toast.error(`${errors.length} sprite${errors.length !== 1 ? 's' : ''} failed to generate.`)
        setGenerationError(errors.join('\n'))
      }
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Generation error:', err)
      if (err instanceof LimitError) {
        toast.error(err.message)
      } else {
        toast.error(err.message || 'Generation failed')
        setGenerationError(err.message)
      }
      clearProgress()
    } finally {
      if (mountedRef.current) setGenerating(false)
    }
  }

  // ── Character record for display after creation ───────────────────────────
  const activeCharacter = createdCharacter || selectedCharacter

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Mode Selection Screen
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === null) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        <div className="text-center mb-10">
          <h1
            className="text-3xl font-bold mb-2"
            style={{
              background: theme.titleGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Generate Sprites
          </h1>
          <p className="text-base" style={{ color: theme.textMuted }}>
            Create image variations from a character reference.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          {/* New Character card */}
          <button
            onClick={() => setMode('new')}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 transition-all text-left cursor-pointer"
            style={{
              background: theme.cardBg,
              borderColor: theme.cardBorder,
              backdropFilter: 'blur(12px)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.primary }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.cardBorder }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: theme.primaryGlow }}
            >
              <Upload className="w-8 h-8" style={{ color: theme.primary }} />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold mb-1" style={{ color: theme.textBody }}>
                New Character
              </div>
              <div className="text-sm" style={{ color: theme.textMuted }}>
                Upload a reference image and create a new character entry
              </div>
            </div>
          </button>

          {/* Existing Character card */}
          <button
            onClick={() => setMode('existing')}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 transition-all text-left cursor-pointer"
            style={{
              background: theme.cardBg,
              borderColor: theme.cardBorder,
              backdropFilter: 'blur(12px)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.primary }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.cardBorder }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: `${theme.accent}20` }}
            >
              <User className="w-8 h-8" style={{ color: theme.accent }} />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold mb-1" style={{ color: theme.textBody }}>
                Existing Character
              </div>
              <div className="text-sm" style={{ color: theme.textMuted }}>
                Select an existing character — reference image pre-loaded automatically
              </div>
            </div>
          </button>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Mode A — New Character
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === 'new') {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <PageHeader theme={theme} onBack={resetAll} />

        <div
          className="rounded-2xl border p-6 space-y-6"
          style={{ background: theme.cardBg, borderColor: theme.cardBorder, backdropFilter: 'blur(12px)' }}
        >
          {/* Character Name */}
          <div className="space-y-1">
            <label
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: theme.labelColor }}
            >
              Character Name
            </label>
            <input
              type="text"
              value={newCharName}
              onChange={e => setNewCharName(e.target.value)}
              placeholder="Enter character name..."
              className="input input-bordered w-full"
              style={{
                height: '44px',
                background: theme.fieldBg,
                borderColor: nameError ? '#ef4444' : theme.fieldBorder,
                color: theme.textBody,
              }}
              autoFocus
              autoCorrect="on"
            />
            {nameChecking && (
              <p className="text-xs flex items-center gap-1" style={{ color: theme.textMuted }}>
                <Loader2 className="w-3 h-3 animate-spin" />
                Checking availability...
              </p>
            )}
            {nameError && (
              <p className="text-xs text-error flex items-center gap-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                {nameError}
              </p>
            )}
          </div>

          {/* Reference Image Upload */}
          <div className="space-y-2">
            <label
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: theme.labelColor }}
            >
              Reference Image
            </label>
            <ImageUploadZone
              theme={theme}
              imageBase64={referenceImageBase64}
              onFileSelect={handleFileSelect}
              onClear={() => {
                setReferenceImageBase64(null)
                setReferenceImageUrl(null)
                setReferenceImageFile(null)
                setAnalysisStatus(null)
                setAnalysisError(null)
                setConsistencyPrompt(null)
                setCreatedCharacter(null)
              }}
            />
          </div>

          {/* Analysis status */}
          <AnalysisStatus
            status={analysisStatus}
            error={analysisError}
            onRetry={() => referenceImageBase64 && runAnalysis(referenceImageBase64, null)}
            theme={theme}
          />

          {/* Generation controls (shown only when ready) */}
          {analysisStatus === 'done' && (
            <GenerationControls
              variationCount={variationCount}
              onVariationCountChange={setVariationCount}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              seedValue={seedValue}
              onSeedChange={setSeedValue}
              theme={theme}
            />
          )}

          {/* Generated sprites preview */}
          {liveImages.length > 0 && (
            <SpritesPreview images={liveImages} theme={theme} generating={generating} expectedTotal={variationCount} />
          )}

          {/* Generation error */}
          {generationError && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
              <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
              <p className="text-xs text-error">{generationError}</p>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerateNew || generating}
            className="btn btn-primary w-full text-base font-semibold"
            style={{
              minHeight: '48px',
              background: canGenerateNew && !generating ? theme.buttonGradient : undefined,
              border: 'none',
            }}
          >
            {generating
              ? <><span className="loading loading-spinner loading-sm mr-2" /> Generating sprites…</>
              : <><Sparkles className="w-5 h-5 mr-2" /> Generate Sprites</>
            }
          </button>

          {/* Link to created character */}
          {createdCharacter && (
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: `${theme.primary}15`, border: `1px solid ${theme.primary}30` }}>
              <p className="text-sm" style={{ color: theme.primary }}>
                Character "{createdCharacter.character_name}" created
              </p>
              <button
                onClick={() => navigate(`/characters/${createdCharacter.id}`)}
                className="btn btn-ghost btn-xs"
                style={{ color: theme.primary }}
              >
                View →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Mode B — Existing Character
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <PageHeader theme={theme} onBack={resetAll} />

      <div
        className="rounded-2xl border p-6 space-y-6"
        style={{ background: theme.cardBg, borderColor: theme.cardBorder, backdropFilter: 'blur(12px)' }}
      >
        {/* Character selector */}
        {!selectedCharacter ? (
          <div className="space-y-3">
            <label
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: theme.labelColor }}
            >
              Select Character
            </label>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: theme.textMuted }} />
              <input
                type="text"
                value={charSearch}
                onChange={e => setCharSearch(e.target.value)}
                placeholder="Search characters..."
                className="input input-bordered w-full pl-9"
                style={{ height: '44px', background: theme.fieldBg, borderColor: theme.fieldBorder, color: theme.textBody }}
              />
            </div>

            {/* Character list */}
            {allCharacters.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <User className="w-12 h-12 mx-auto" style={{ color: theme.textMuted, opacity: 0.4 }} />
                <p className="text-sm" style={{ color: theme.textMuted }}>
                  No characters found. Use "New Character" to get started.
                </p>
                <button
                  onClick={resetAll}
                  className="btn btn-primary btn-sm"
                  style={{ background: theme.buttonGradient, border: 'none' }}
                >
                  ← Back to selection
                </button>
              </div>
            ) : filteredCharacters.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: theme.textMuted }}>
                No characters match "{charSearch}"
              </p>
            ) : (
              <div
                className="space-y-2 max-h-80 overflow-y-auto pr-1"
              >
                {filteredCharacters.map(char => (
                  <button
                    key={char.id}
                    onClick={() => handleSelectCharacter(char)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:opacity-80"
                    style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
                  >
                    {char.generated_image_url ? (
                      <img
                        src={char.generated_image_url}
                        alt={char.character_name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: theme.cardBg }}
                      >
                        <User className="w-6 h-6" style={{ color: theme.textMuted }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" style={{ color: theme.textBody }}>
                        {char.character_name || 'Unnamed Character'}
                      </div>
                      {char.creation_source && (
                        <div className="text-xs truncate" style={{ color: theme.textMuted }}>
                          {char.creation_source === 'sprites' ? 'Sprites' : 'Character Forge'}
                          {char.character_consistency_prompt ? ' · Analyzed' : ''}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Character selected — show reference + analysis + controls */
          <div className="space-y-6">
            {/* Selected character header */}
            <div className="flex items-center gap-3">
              {selectedCharacter.generated_image_url ? (
                <img
                  src={selectedCharacter.generated_image_url}
                  alt={selectedCharacter.character_name}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: theme.fieldBg }}
                >
                  <User className="w-7 h-7" style={{ color: theme.textMuted }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate" style={{ color: theme.textBody }}>
                  {selectedCharacter.character_name}
                </div>
                <button
                  onClick={() => {
                    setSelectedCharacter(null)
                    setReferenceImageBase64(null)
                    setReferenceImageUrl(null)
                    setAnalysisStatus(null)
                    setAnalysisError(null)
                    setConsistencyPrompt(null)
                    setLiveImages([])
                    setGenerationError(null)
                  }}
                  className="text-xs hover:underline"
                  style={{ color: theme.textMuted }}
                >
                  Change character
                </button>
              </div>
            </div>

            {/* Reference image display */}
            {selectedCharacter.generated_image_url ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
                  Reference: {selectedCharacter.character_name}'s primary image
                </p>
                <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.fieldBorder}` }}>
                  <img
                    src={selectedCharacter.generated_image_url}
                    alt="Reference"
                    className="w-full max-h-64 object-contain"
                    style={{ background: theme.fieldBg }}
                  />
                </div>
                <p className="text-xs" style={{ color: theme.textMuted }}>
                  Reference image is fixed to this character's primary image.
                </p>
              </div>
            ) : (
              /* No primary image warning */
              <div
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: '#f59e0b15', border: '1px solid #f59e0b40' }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
                <p className="text-sm" style={{ color: '#f59e0b' }}>
                  This character doesn't have a primary image yet. Please generate one via the character creation flow first.
                </p>
              </div>
            )}

            {/* Analysis status */}
            <AnalysisStatus
              status={analysisStatus}
              error={analysisError}
              characterName={selectedCharacter.character_name}
              onRetry={() => {
                if (referenceImageBase64) {
                  runAnalysis(referenceImageBase64, selectedCharacter)
                } else if (selectedCharacter.generated_image_url) {
                  handleSelectCharacter(selectedCharacter)
                }
              }}
              theme={theme}
            />

            {/* Generation controls */}
            {analysisStatus === 'done' && selectedCharacter.generated_image_url && (
              <GenerationControls
                variationCount={variationCount}
                onVariationCountChange={setVariationCount}
                aspectRatio={aspectRatio}
                onAspectRatioChange={setAspectRatio}
                seedValue={seedValue}
                onSeedChange={setSeedValue}
                theme={theme}
              />
            )}

            {/* Generated sprites preview */}
            {liveImages.length > 0 && (
              <SpritesPreview images={liveImages} theme={theme} generating={generating} expectedTotal={variationCount} />
            )}

            {/* Generation error */}
            {generationError && (
              <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
                <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                <p className="text-xs text-error">{generationError}</p>
              </div>
            )}

            {/* Generate button */}
            {selectedCharacter.generated_image_url && (
              <button
                onClick={handleGenerate}
                disabled={!canGenerateExisting || generating}
                className="btn btn-primary w-full text-base font-semibold"
                style={{
                  minHeight: '48px',
                  background: canGenerateExisting && !generating ? theme.buttonGradient : undefined,
                  border: 'none',
                }}
              >
                {generating
                  ? <><span className="loading loading-spinner loading-sm mr-2" /> Generating sprites…</>
                  : <><Sparkles className="w-5 h-5 mr-2" /> Generate Sprites</>
                }
              </button>
            )}

            {/* Link to character */}
            {activeCharacter && liveImages.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: `${theme.primary}15`, border: `1px solid ${theme.primary}30` }}>
                <p className="text-sm" style={{ color: theme.primary }}>
                  Sprites saved to {activeCharacter.character_name}
                </p>
                <button
                  onClick={() => navigate(`/characters/${activeCharacter.id}`)}
                  className="btn btn-ghost btn-xs"
                  style={{ color: theme.primary }}
                >
                  View character →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PageHeader ───────────────────────────────────────────────────────────────
function PageHeader({ theme, onBack }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={onBack}
        className="btn btn-ghost btn-sm gap-2"
        style={{ color: theme.textMuted }}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
      <div>
        <h1
          className="text-2xl font-bold"
          style={{
            background: theme.titleGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Generate Sprites
        </h1>
        <p className="text-xs" style={{ color: theme.textMuted }}>
          Create image variations from a character reference.
        </p>
      </div>
    </div>
  )
}

// ─── ImageUploadZone ──────────────────────────────────────────────────────────
function ImageUploadZone({ theme, imageBase64, onFileSelect, onClear }) {
  const fileRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) onFileSelect(file)
  }

  if (imageBase64) {
    return (
      <div className="relative rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.fieldBorder}` }}>
        <img
          src={imageBase64}
          alt="Reference preview"
          className="w-full max-h-64 object-contain"
          style={{ background: theme.fieldBg }}
        />
        <button
          onClick={onClear}
          className="absolute top-2 right-2 btn btn-circle btn-sm btn-error btn-soft"
          aria-label="Remove image"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div
      onClick={() => fileRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer transition-all py-12"
      style={{
        background: dragging ? `${theme.primary}10` : theme.fieldBg,
        borderColor: dragging ? theme.primary : theme.fieldBorder,
      }}
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: theme.primaryGlow }}
      >
        <Upload className="w-6 h-6" style={{ color: theme.primary }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: theme.textBody }}>
          Drop an image here or click to upload
        </p>
        <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
          PNG, JPG, or WEBP
        </p>
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

// ─── AnalysisStatus ───────────────────────────────────────────────────────────
function AnalysisStatus({ status, error, characterName, onRetry, theme }) {
  if (!status) return null

  if (status === 'running') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: `${theme.primary}10`, border: `1px solid ${theme.primary}30` }}>
        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: theme.primary }} />
        <p className="text-sm" style={{ color: theme.primary }}>
          {characterName
            ? `Analyzing ${characterName}'s reference image…`
            : 'Analyzing reference image…'}
        </p>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#10b98115', border: '1px solid #10b98140' }}>
        <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
        <p className="text-sm font-medium" style={{ color: '#10b981' }}>
          Image analyzed ✓
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-error" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-error">
            Analysis failed: {error || 'Unknown error'}
          </p>
        </div>
        <button
          onClick={onRetry}
          className="btn btn-ghost btn-xs flex-shrink-0 gap-1"
          style={{ color: '#ef4444' }}
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    )
  }

  return null
}

// ─── GenerationControls ───────────────────────────────────────────────────────
function GenerationControls({
  variationCount, onVariationCountChange,
  aspectRatio, onAspectRatioChange,
  seedValue, onSeedChange,
  theme,
}) {
  return (
    <div className="space-y-4 pt-2" style={{ borderTop: `1px solid ${theme.fieldBorder}` }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
        Generation Settings
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Variation count */}
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: theme.textMuted }}>
            Number of Sprites
          </label>
          <select
            value={variationCount}
            onChange={e => onVariationCountChange(Number(e.target.value))}
            className="select select-bordered w-full"
            style={{ height: '44px', background: theme.fieldBg, borderColor: theme.fieldBorder, color: theme.textBody }}
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
              <option key={n} value={n}>{n} sprite{n !== 1 ? 's' : ''}</option>
            ))}
          </select>
        </div>

        {/* Aspect ratio */}
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: theme.textMuted }}>
            Aspect Ratio
          </label>
          <select
            value={aspectRatio}
            onChange={e => onAspectRatioChange(e.target.value)}
            className="select select-bordered w-full"
            style={{ height: '44px', background: theme.fieldBg, borderColor: theme.fieldBorder, color: theme.textBody }}
          >
            {ASPECT_RATIOS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Seed */}
      <div className="space-y-1">
        <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: theme.textMuted }}>
          <Lock className="w-3 h-3" />
          Seed
          <span className="text-xs" style={{ color: theme.textMuted, opacity: 0.6 }}>(optional)</span>
        </label>
        <input
          type="number"
          value={seedValue}
          onChange={e => onSeedChange(e.target.value)}
          placeholder="Leave empty for random"
          className="input input-bordered w-full"
          style={{ height: '44px', background: theme.fieldBg, borderColor: theme.fieldBorder, color: theme.textBody }}
        />
      </div>
    </div>
  )
}

// ─── SpritesPreview ───────────────────────────────────────────────────────────
function SpritesPreview({ images, theme, generating, expectedTotal }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {generating && <span className="loading loading-spinner loading-xs" style={{ color: theme.primary }} />}
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
          {generating
            ? `Generating… ${images.length} ready`
            : `${images.length} sprite${images.length !== 1 ? 's' : ''} generated`}
        </p>
      </div>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}
      >
        {images.map((img, i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden"
            style={{ aspectRatio: '3/4', background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
          >
            <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
          </div>
        ))}
        {/* Placeholder cells for pending images */}
        {generating && Array(Math.max(0, expectedTotal - images.length)).fill(0).map((_, i) => (
          <div
            key={`pending-${i}`}
            className="rounded-xl flex items-center justify-center"
            style={{ aspectRatio: '3/4', background: theme.fieldBg, border: `1px dashed ${theme.fieldBorder}` }}
          >
            <span className="loading loading-spinner loading-xs" style={{ color: theme.textMuted, opacity: 0.4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
