// ─── GenerateSprites.jsx ───────────────────────────────────────────────────────
// Route: /sprites/generate
// Builds sprite image variations from a character reference image.
//
// Two modes:
//   Mode A — New Character: name + upload → analysis → auto-fill appearance
//            → create record → variation controls → generate
//   Mode B — Existing Character: select → pre-load image → analysis (if needed)
//            → variation controls → generate
//
// Identity Lock Enhancement:
//   After analysis, structured identity lock data is stored alongside the flat
//   consistency prompt. The prompt compiler uses the structured data to produce
//   rigidly ordered generation prompts. Emotion, pose, and optional modifiers
//   are selected per-session and compiled into each sprite's prompt.
//
// Auto-fill (Mode A only):
//   On analysis complete, parsed appearance data is pre-populated into the
//   character record's appearance field. User can review before confirming.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Upload, X, Sparkles, User, Search, Check,
  AlertCircle, RefreshCw, Loader2, Lock, ChevronDown, ChevronUp,
  Wand2, Eye, ZoomIn,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useProgress } from '../contexts/ProgressContext'
import { useAuth } from '../contexts/AuthContext'
import { Character } from '../lib/storage'
import { analyzeReferenceImage, generateImage, LimitError, parseAppearanceFromIdentityLock } from '../lib/anthropic'
import { supabase } from '../lib/supabase'
import { compileSpritePrompt, resolveVariationSpecs } from '../lib/promptCompiler'
import { RANDOM_POOL } from '../lib/constants/EMOTION_PRESETS'
import { RANDOM_POSE_POOL } from '../lib/constants/POSE_PRESETS'
import VariationControls from '../components/sprites/VariationControls'
import ImageEditModal from '../components/sprites/ImageEditModal'

// ─── Aspect ratio options ─────────────────────────────────────────────────────
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

// Default toggle state: all optional permissions OFF
const DEFAULT_TOGGLES = { allowPrompt: false, allowClothing: false, allowProps: false }

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

  // ── Mode: null (selection) | 'new' | 'existing' ───────────────────────────
  const [mode, setMode] = useState(null)

  // ── New character form ────────────────────────────────────────────────────
  const [newCharName, setNewCharName] = useState('')
  const [nameError, setNameError] = useState(null)
  const [nameChecking, setNameChecking] = useState(false)
  const [readyToAnalyze, setReadyToAnalyze] = useState(false)

  // ── Shared image state ────────────────────────────────────────────────────
  const [referenceImageBase64, setReferenceImageBase64] = useState(null)
  const [referenceImageUrl, setReferenceImageUrl] = useState(null)
  const [referenceImageFile, setReferenceImageFile] = useState(null)

  // ── Analysis state ─────────────────────────────────────────────────────────
  const [analysisStatus, setAnalysisStatus] = useState(null)
  const [analysisError, setAnalysisError] = useState(null)
  const [consistencyPrompt, setConsistencyPrompt] = useState(null)
  const [identityLock, setIdentityLock] = useState(null)  // structured JSON

  // ── Auto-fill appearance (Mode A only) ────────────────────────────────────
  const [suggestedAppearance, setSuggestedAppearance] = useState(null)
  const [autoFillConfirmed, setAutoFillConfirmed] = useState(false)

  // ── Existing character mode ───────────────────────────────────────────────
  const [selectedCharacter, setSelectedCharacter] = useState(null)
  const [charSearch, setCharSearch] = useState('')

  // ── Character record ──────────────────────────────────────────────────────
  const [createdCharacter, setCreatedCharacter] = useState(null)

  // ── Generation controls ───────────────────────────────────────────────────
  const [variationCount, setVariationCount] = useState(DEFAULT_VARIATION_COUNT)
  const [aspectRatio, setAspectRatio] = useState('3:4')
  const [seedValue, setSeedValue] = useState('')
  const [liveImages, setLiveImages] = useState([])
  const [generationError, setGenerationError] = useState(null)

  // ── Variation controls (identity lock UI) ─────────────────────────────────
  const [emotionEntries, setEmotionEntries] = useState([])
  const [selectedPoseId, setSelectedPoseId] = useState('random')
  const [toggles, setToggles] = useState(DEFAULT_TOGGLES)
  const [customPrompt, setCustomPrompt] = useState('')

  // ── Image edit modal ──────────────────────────────────────────────────────
  const [editModalImage, setEditModalImage] = useState(null)

  // ── Reset key (from nav same-route) ──────────────────────────────────────
  const resetKey = location.state?.reset

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (resetKey) resetAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // ── Fetch all characters for Mode B ──────────────────────────────────────
  const { data: allCharacters = [] } = useQuery({
    queryKey: ['characters', userId],
    queryFn: () => Character.list(userId),
    enabled: !!userId,
  })

  const filteredCharacters = allCharacters.filter(c =>
    !charSearch.trim() ||
    (c.character_name || '').toLowerCase().includes(charSearch.toLowerCase())
  )

  // ── Debounced name check (Mode A) ─────────────────────────────────────────
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
          setReadyToAnalyze(true)
        }
      } finally {
        setNameChecking(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [newCharName, userId, mode])

  // ── Gate: fire analysis only when BOTH name valid AND image uploaded ───────
  useEffect(() => {
    if (!readyToAnalyze) return
    if (mode !== 'new') return
    if (!referenceImageBase64) return
    if (!newCharName.trim() || nameError || nameChecking) return
    if (analysisStatus === 'running' || analysisStatus === 'done') return
    setReadyToAnalyze(false)
    runAnalysis(referenceImageBase64, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToAnalyze, referenceImageBase64, newCharName, nameError, nameChecking, analysisStatus, mode])

  // ── Reset all state ────────────────────────────────────────────────────────
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
    setIdentityLock(null)
    setSuggestedAppearance(null)
    setAutoFillConfirmed(false)
    setSelectedCharacter(null)
    setCharSearch('')
    setCreatedCharacter(null)
    setVariationCount(DEFAULT_VARIATION_COUNT)
    setAspectRatio('3:4')
    setSeedValue('')
    setLiveImages([])
    setGenerationError(null)
    setEmotionEntries([])
    setSelectedPoseId('random')
    setToggles(DEFAULT_TOGGLES)
    setCustomPrompt('')
    setEditModalImage(null)
  }, [])

  // ── Upload reference image ─────────────────────────────────────────────────
  const uploadReferenceImage = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase() || 'png'
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { data, error } = await supabase.storage
      .from('reference-images')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error(`Image upload failed: ${error.message}`)
    const { data: signed, error: signErr } = await supabase.storage
      .from('reference-images')
      .createSignedUrl(data.path, 60 * 60 * 24 * 7)
    if (signErr) {
      const { data: urlData } = supabase.storage.from('reference-images').getPublicUrl(data.path)
      return urlData?.publicUrl || null
    }
    return signed.signedUrl
  }

  // ── Handle file select (Mode A) ────────────────────────────────────────────
  const handleFileSelect = (file) => {
    if (!file) return
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PNG, JPG, or WEBP image.')
      return
    }
    setReferenceImageFile(file)
    setAnalysisStatus(null)
    setAnalysisError(null)
    setConsistencyPrompt(null)
    setIdentityLock(null)
    setSuggestedAppearance(null)
    setAutoFillConfirmed(false)
    setCreatedCharacter(null)
    setReadyToAnalyze(false)

    const reader = new FileReader()
    reader.onload = (e) => {
      setReferenceImageBase64(e.target.result)
      setReadyToAnalyze(true)
    }
    reader.readAsDataURL(file)
  }

  // ── Run analysis ───────────────────────────────────────────────────────────
  const runAnalysis = async (imageBase64, existingCharacter) => {
    setAnalysisStatus('running')
    setAnalysisError(null)
    try {
      const result = await analyzeReferenceImage(imageBase64)
      if (!mountedRef.current) return

      const { consistencyPrompt: cp, identityLock: il } = result
      setConsistencyPrompt(cp)
      setIdentityLock(il)
      setAnalysisStatus('done')

      if (existingCharacter) {
        // Mode B: persist on existing character
        await Character.update(existingCharacter.id, {
          character_consistency_prompt: cp,
          character_identity_lock: il || null,
        })
        queryClient.invalidateQueries({ queryKey: ['characters', userId] })
        queryClient.invalidateQueries({ queryKey: ['character', existingCharacter.id] })
        setSelectedCharacter(prev => ({
          ...prev,
          character_consistency_prompt: cp,
          character_identity_lock: il || null,
        }))
      } else {
        // Mode A: parse appearance for auto-fill, then create character record
        if (il) {
          const parsed = parseAppearanceFromIdentityLock(il)
          if (Object.keys(parsed).length > 0) {
            setSuggestedAppearance(parsed)
          }
        }
        await createCharacterRecord(cp, il, imageBase64)
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
    setIdentityLock(null)
    setLiveImages([])

    const primaryImageUrl = char.generated_image_url
    if (!primaryImageUrl) {
      setReferenceImageBase64(null)
      setReferenceImageUrl(null)
      return
    }
    setReferenceImageUrl(primaryImageUrl)

    // If character already has both prompt and lock, use them
    if (char.character_consistency_prompt) {
      setConsistencyPrompt(char.character_consistency_prompt)
      setIdentityLock(char.character_identity_lock || null)
      setAnalysisStatus('done')
      return
    }

    // Re-analyze
    setAnalysisStatus('running')
    try {
      const base64 = await fetchImageAsBase64(primaryImageUrl)
      if (!mountedRef.current) return
      setReferenceImageBase64(base64)
      await runAnalysis(base64, char)
    } catch (err) {
      if (!mountedRef.current) return
      setAnalysisStatus('error')
      setAnalysisError(`Could not load ${char.character_name}'s image for analysis: ${err.message}`)
    }
  }

  // ── Fetch remote image as base64 ──────────────────────────────────────────
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

  // ── Readiness checks ───────────────────────────────────────────────────────
  const canGenerateNew = mode === 'new' && createdCharacter !== null && analysisStatus === 'done'
  const canGenerateExisting = (
    mode === 'existing' &&
    selectedCharacter !== null &&
    selectedCharacter.generated_image_url &&
    analysisStatus === 'done'
  )
  const canGenerate = canGenerateNew || canGenerateExisting

  // ── Create character record (Mode A) ──────────────────────────────────────
  const createCharacterRecord = async (prompt, lockData, imageBase64) => {
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
      generated_image_url:          storedUrl,
      character_consistency_prompt: prompt,
      character_identity_lock:      lockData || null,
      character_prompt:             null,
      appearance_description:       null,
      appearance:                   suggestedAppearance || null,
      sprite_images:                null,
    })

    if (!mountedRef.current) return
    setCreatedCharacter(record)
    queryClient.invalidateQueries({ queryKey: ['characters', userId] })
    toast.success(`Character "${record.character_name}" added to your Gallery.`)
    return record
  }

  // ── Resolve character for generation ──────────────────────────────────────
  const resolveCharacterForGeneration = () => {
    if (mode === 'existing') return selectedCharacter
    if (createdCharacter) return createdCharacter
    throw new Error('Character record not yet created. Please wait for analysis to complete.')
  }

  // ── Add a sprite image generated during the edit modal ────────────────────
  const handleEditModalNewImage = useCallback(async (newEntry) => {
    const character = resolveCharacterForGeneration()
    const spriteEntry = {
      url: newEntry.url,
      generated_at: newEntry.generated_at,
      seed: newEntry.seed ?? null,
      editInstructions: newEntry.editInstructions,
      parentUrl: newEntry.parentUrl,
      params_snapshot: newEntry.params_snapshot,
      poseId: newEntry.poseId ?? null,
      emotionEntry: newEntry.emotionEntry ?? null,
    }
    try {
      await Character.addSpriteImage(character.id, spriteEntry)
      setLiveImages(prev => [...prev, { url: newEntry.url, label: newEntry.label, seed: newEntry.seed }])
      queryClient.invalidateQueries({ queryKey: ['character', character.id] })
      queryClient.invalidateQueries({ queryKey: ['characters', userId] })
    } catch (err) {
      console.error('Failed to save edited sprite:', err)
      toast.error('Edit saved to view but could not persist to character record.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, createdCharacter, selectedCharacter, userId, queryClient])

  // ── Main generation handler ────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!canGenerate || generating) return
    setGenerationError(null)
    setLiveImages([])
    setGenerating(true)

    const signal = getAbortSignal()
    let errors = []
    let successCount = 0

    try {
      const character = resolveCharacterForGeneration()
      const charName = character.character_name || 'Character'
      const refImageBase64 = referenceImageBase64
      const refImageUrl = mode === 'existing'
        ? character.generated_image_url
        : (character.reference_image_url || referenceImageBase64)
      const lock = identityLock || character.character_identity_lock || null
      const prompt = consistencyPrompt || character.character_consistency_prompt || ''

      // Resolve all N variation specs (emotion + pose per sprite)
      const specs = resolveVariationSpecs(emotionEntries, selectedPoseId, variationCount, RANDOM_POOL, RANDOM_POSE_POOL)

      startProgress(`Generating sprites for ${charName}`, variationCount, '/sprites/generate')

      for (let i = 0; i < variationCount; i++) {
        if (isCancelled()) break

        const spec = specs[i]
        try {
          // Compile the full structured prompt for this variation
          const finalPrompt = compileSpritePrompt({
            identityLock: lock,
            consistencyPrompt: prompt,
            poseId: spec.poseId,
            emotionEntry: spec.emotionEntry,
            allowPrompt: toggles.allowPrompt,
            customPrompt,
            allowClothing: toggles.allowClothing,
            allowProps: toggles.allowProps,
          })

          const imageUrl = await generateImage({
            prompt: finalPrompt,
            referenceImageUrls: [refImageBase64 || refImageUrl].filter(Boolean),
            aspectRatio,
          }, signal)

          if (!mountedRef.current) break

          const spriteEntry = {
            url: imageUrl,
            generated_at: new Date().toISOString(),
            seed: seedValue ? parseInt(seedValue, 10) : null,
            poseId: spec.poseId,
            emotionEntry: spec.emotionEntry,
            params_snapshot: {
              variationCount, aspectRatio,
              poseId: spec.poseId,
              emotionEntry: spec.emotionEntry,
              toggles,
            },
          }

          await Character.addSpriteImage(character.id, spriteEntry)

          setLiveImages(prev => [
            ...prev,
            {
              url: imageUrl,
              label: `Sprite ${prev.length + 1}`,
              seed: spriteEntry.seed,
              poseId: spec.poseId,
              emotionEntry: spec.emotionEntry,
              params_snapshot: spriteEntry.params_snapshot,
            },
          ])
          successCount++
          updateProgress(i + 1)

          queryClient.invalidateQueries({ queryKey: ['character', character.id] })
          queryClient.invalidateQueries({ queryKey: ['characters', userId] })
        } catch (err) {
          console.error(`Sprite ${i + 1} generation failed:`, err)
          if (err instanceof LimitError) { toast.error(err.message); break }
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

  const activeCharacter = createdCharacter || selectedCharacter

  // ─── Image Edit Modal (global, accessible from preview) ───────────────────
  const editModal = editModalImage ? (
    <ImageEditModal
      image={editModalImage}
      identityLock={identityLock || activeCharacter?.character_identity_lock || null}
      consistencyPrompt={consistencyPrompt || activeCharacter?.character_consistency_prompt || ''}
      referenceImageBase64={referenceImageBase64}
      referenceImageUrl={mode === 'existing' ? activeCharacter?.generated_image_url : activeCharacter?.reference_image_url}
      toggles={toggles}
      aspectRatio={aspectRatio}
      onClose={() => setEditModalImage(null)}
      onNewImageGenerated={handleEditModalNewImage}
      theme={theme}
    />
  ) : null

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Mode Selection
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === null) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4">
        {editModal}
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
          <button
            onClick={() => setMode('new')}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 transition-all text-left cursor-pointer"
            style={{ background: theme.cardBg, borderColor: theme.cardBorder, backdropFilter: 'blur(12px)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.primary }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.cardBorder }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: theme.primaryGlow }}>
              <Upload className="w-8 h-8" style={{ color: theme.primary }} />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold mb-1" style={{ color: theme.textBody }}>New Character</div>
              <div className="text-sm" style={{ color: theme.textMuted }}>
                Upload a reference image and create a new character entry
              </div>
            </div>
          </button>

          <button
            onClick={() => setMode('existing')}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-8 rounded-2xl border-2 transition-all text-left cursor-pointer"
            style={{ background: theme.cardBg, borderColor: theme.cardBorder, backdropFilter: 'blur(12px)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = theme.primary }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = theme.cardBorder }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${theme.accent}20` }}>
              <User className="w-8 h-8" style={{ color: theme.accent }} />
            </div>
            <div className="text-center">
              <div className="text-lg font-bold mb-1" style={{ color: theme.textBody }}>Existing Character</div>
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
  // SHARED: Generation controls + sprites preview (used in both modes)
  // ─────────────────────────────────────────────────────────────────────────
  const generationSection = (
    <>
      {/* Generation settings */}
      <GenerationControls
        variationCount={variationCount}
        onVariationCountChange={(n) => {
          setVariationCount(n)
          // Soft-trim emotion list if it now exceeds the new sprite count
          if (emotionEntries.length > n) {
            toast(`Sprite count reduced to ${n}. Last ${emotionEntries.length - n} emotion${emotionEntries.length - n !== 1 ? 's' : ''} removed.`)
            setEmotionEntries(emotionEntries.slice(0, n))
          }
        }}
        aspectRatio={aspectRatio}
        onAspectRatioChange={setAspectRatio}
        seedValue={seedValue}
        onSeedChange={setSeedValue}
        theme={theme}
      />

      {/* Variation controls (identity lock UI) */}
      <VariationControls
        spriteCount={variationCount}
        emotionEntries={emotionEntries}
        onEmotionEntriesChange={setEmotionEntries}
        selectedPoseId={selectedPoseId}
        onPoseChange={setSelectedPoseId}
        toggles={toggles}
        onTogglesChange={setToggles}
        customPrompt={customPrompt}
        onCustomPromptChange={setCustomPrompt}
        theme={theme}
      />

      {/* Sprites preview */}
      {liveImages.length > 0 && (
        <SpritesPreview
          images={liveImages}
          theme={theme}
          generating={generating}
          expectedTotal={variationCount}
          onImageClick={(img) => setEditModalImage(img)}
        />
      )}

      {/* Generation error */}
      {generationError && (
        <div className="flex items-start gap-2 p-3 rounded-xl" style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
          <AlertCircle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
          <p className="text-xs text-error">{generationError}</p>
        </div>
      )}
    </>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Mode A — New Character
  // ─────────────────────────────────────────────────────────────────────────
  if (mode === 'new') {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        {editModal}
        <PageHeader theme={theme} onBack={resetAll} />

        <div
          className="rounded-2xl border p-6 space-y-6"
          style={{ background: theme.cardBg, borderColor: theme.cardBorder, backdropFilter: 'blur(12px)' }}
        >
          {/* Character Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
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
                Checking availability…
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
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
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
                setIdentityLock(null)
                setSuggestedAppearance(null)
                setAutoFillConfirmed(false)
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

          {/* Identity lock summary (shown after analysis) */}
          {analysisStatus === 'done' && identityLock && (
            <IdentityLockSummary identityLock={identityLock} theme={theme} />
          )}

          {/* Auto-fill appearance prompt (Mode A, after analysis) */}
          {analysisStatus === 'done' && suggestedAppearance && !autoFillConfirmed && (
            <AutoFillPrompt
              suggestedAppearance={suggestedAppearance}
              onAccept={async () => {
                setAutoFillConfirmed(true)
                if (createdCharacter) {
                  try {
                    await Character.update(createdCharacter.id, { appearance: suggestedAppearance })
                    queryClient.invalidateQueries({ queryKey: ['character', createdCharacter.id] })
                    toast.success('Appearance pre-filled from image analysis.')
                  } catch {
                    toast.error('Could not save appearance data.')
                  }
                }
              }}
              onSkip={() => setAutoFillConfirmed(true)}
              theme={theme}
            />
          )}

          {/* Generation controls + variation controls */}
          {analysisStatus === 'done' && generationSection}

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
            <div
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: `${theme.primary}15`, border: `1px solid ${theme.primary}30` }}
            >
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
      {editModal}
      <PageHeader theme={theme} onBack={resetAll} />

      <div
        className="rounded-2xl border p-6 space-y-6"
        style={{ background: theme.cardBg, borderColor: theme.cardBorder, backdropFilter: 'blur(12px)' }}
      >
        {!selectedCharacter ? (
          /* Character selector */
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
              Select Character
            </label>
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

            {allCharacters.length === 0 ? (
              <div className="text-center py-10 space-y-3">
                <User className="w-12 h-12 mx-auto" style={{ color: theme.textMuted, opacity: 0.4 }} />
                <p className="text-sm" style={{ color: theme.textMuted }}>
                  No characters found. Use "New Character" to get started.
                </p>
                <button onClick={resetAll} className="btn btn-primary btn-sm" style={{ background: theme.buttonGradient, border: 'none' }}>
                  ← Back to selection
                </button>
              </div>
            ) : filteredCharacters.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: theme.textMuted }}>
                No characters match "{charSearch}"
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {filteredCharacters.map(char => (
                  <button
                    key={char.id}
                    onClick={() => handleSelectCharacter(char)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all hover:opacity-80"
                    style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
                  >
                    {char.generated_image_url ? (
                      <img src={char.generated_image_url} alt={char.character_name}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: theme.cardBg }}>
                        <User className="w-6 h-6" style={{ color: theme.textMuted }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" style={{ color: theme.textBody }}>
                        {char.character_name || 'Unnamed Character'}
                      </div>
                      <div className="text-xs truncate" style={{ color: theme.textMuted }}>
                        {char.creation_source === 'sprites' ? 'Sprites' : 'Character Forge'}
                        {char.character_consistency_prompt ? ' · Analyzed' : ''}
                        {char.character_identity_lock ? ' · Identity Locked' : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selected character header */}
            <div className="flex items-center gap-3">
              {selectedCharacter.generated_image_url ? (
                <img src={selectedCharacter.generated_image_url} alt={selectedCharacter.character_name}
                  className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: theme.fieldBg }}>
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
                    setIdentityLock(null)
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

            {/* Reference image */}
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
              <div className="flex items-start gap-3 p-4 rounded-xl" style={{ background: '#f59e0b15', border: '1px solid #f59e0b40' }}>
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
                if (referenceImageBase64) runAnalysis(referenceImageBase64, selectedCharacter)
                else if (selectedCharacter.generated_image_url) handleSelectCharacter(selectedCharacter)
              }}
              theme={theme}
            />

            {/* Identity lock summary */}
            {analysisStatus === 'done' && identityLock && (
              <IdentityLockSummary identityLock={identityLock} theme={theme} />
            )}

            {/* Generation controls + variation controls */}
            {analysisStatus === 'done' && selectedCharacter.generated_image_url && generationSection}

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
              <div
                className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: `${theme.primary}15`, border: `1px solid ${theme.primary}30` }}
              >
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
      <button onClick={onBack} className="btn btn-ghost btn-sm gap-2" style={{ color: theme.textMuted }}>
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
        <img src={imageBase64} alt="Reference preview" className="w-full max-h-64 object-contain" style={{ background: theme.fieldBg }} />
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
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: theme.primaryGlow }}>
        <Upload className="w-6 h-6" style={{ color: theme.primary }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: theme.textBody }}>Drop an image here or click to upload</p>
        <p className="text-xs mt-1" style={{ color: theme.textMuted }}>PNG, JPG, or WEBP</p>
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
          {characterName ? `Analyzing ${characterName}'s reference image…` : 'Analyzing reference image…'}
        </p>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#10b98115', border: '1px solid #10b98140' }}>
        <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
        <p className="text-sm font-medium" style={{ color: '#10b981' }}>Image analyzed — identity lock applied</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-error" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-error">Analysis failed: {error || 'Unknown error'}</p>
        </div>
        <button onClick={onRetry} className="btn btn-ghost btn-xs flex-shrink-0 gap-1" style={{ color: '#ef4444' }}>
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    )
  }

  return null
}

// ─── IdentityLockSummary ──────────────────────────────────────────────────────
// Read-only summary of the extracted identity lock. Never editable.
function IdentityLockSummary({ identityLock, theme }) {
  const [expanded, setExpanded] = useState(false)
  const traits = identityLock?.immutable_traits || {}
  const traitCount = Object.values(traits).flat().length

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1px solid ${theme.primary}30`, background: `${theme.primary}08` }}
    >
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <Lock className="w-4 h-4 flex-shrink-0" style={{ color: theme.primary }} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.primary }}>
            Identity Lock Active
          </p>
          <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
            {traitCount} immutable trait{traitCount !== 1 ? 's' : ''} locked — will be enforced in every sprite
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
          : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: theme.textMuted }} />
        }
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ borderTop: `1px solid ${theme.primary}20` }}>
          {Object.entries(traits).map(([category, items]) => (
            items?.length > 0 ? (
              <div key={category}>
                <p className="text-xs font-semibold capitalize mb-1" style={{ color: theme.textMuted }}>
                  {category}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: theme.textBody }}>
                      <span className="mt-1 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: theme.primary }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          ))}
          {identityLock?.forbidden_changes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: '#ef4444' }}>Forbidden Changes</p>
              <ul className="space-y-0.5">
                {identityLock.forbidden_changes.slice(0, 4).map((f, i) => (
                  <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: theme.textBody }}>
                    <span className="mt-1 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: '#ef4444' }} />
                    {f}
                  </li>
                ))}
                {identityLock.forbidden_changes.length > 4 && (
                  <li className="text-xs" style={{ color: theme.textMuted }}>
                    +{identityLock.forbidden_changes.length - 4} more constraints…
                  </li>
                )}
              </ul>
            </div>
          )}
          <p className="text-xs italic pt-1" style={{ color: theme.textMuted }}>
            Identity lock is read-only. Re-upload a new reference image to re-analyze.
          </p>
        </div>
      )}
    </div>
  )
}

// ─── AutoFillPrompt ───────────────────────────────────────────────────────────
// Shown once in Mode A after analysis. Allows user to accept or skip
// auto-population of the appearance fields from the identity lock.
function AutoFillPrompt({ suggestedAppearance, onAccept, onSkip, theme }) {
  const fieldCount = Object.keys(suggestedAppearance).length
  const preview = [
    suggestedAppearance.hair_color?.join(', '),
    suggestedAppearance.eye_color?.join(', '),
    suggestedAppearance.hair_style,
    suggestedAppearance.skin_tone,
  ].filter(Boolean).slice(0, 3).join(' · ')

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}30` }}
    >
      <div className="flex items-start gap-3">
        <Wand2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: theme.accent }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: theme.textBody }}>
            Auto-fill appearance detected
          </p>
          <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
            {fieldCount} appearance field{fieldCount !== 1 ? 's' : ''} extracted from image analysis.
            {preview && <> Detected: {preview}.</>}
          </p>
          <p className="text-xs mt-1" style={{ color: theme.textMuted }}>
            These will be saved to the Appearance section of your character. You can edit them later in the Character Detail view.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAccept}
          className="btn btn-sm flex-1 font-medium"
          style={{ background: theme.accent, border: 'none', color: 'white' }}
        >
          <Check className="w-3.5 h-3.5" />
          Apply to Character
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="btn btn-ghost btn-sm"
          style={{ color: theme.textMuted }}
        >
          Skip
        </button>
      </div>
    </div>
  )
}

// ─── GenerationControls ───────────────────────────────────────────────────────
function GenerationControls({ variationCount, onVariationCountChange, aspectRatio, onAspectRatioChange, seedValue, onSeedChange, theme }) {
  return (
    <div className="space-y-4 pt-2" style={{ borderTop: `1px solid ${theme.fieldBorder}` }}>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
        Generation Settings
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: theme.textMuted }}>Number of Sprites</label>
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
        <div className="space-y-1">
          <label className="text-xs font-medium" style={{ color: theme.textMuted }}>Aspect Ratio</label>
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
      <div className="space-y-1">
        <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: theme.textMuted }}>
          <Lock className="w-3 h-3" />
          Seed
          <span className="text-xs opacity-60">(optional)</span>
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
function SpritesPreview({ images, theme, generating, expectedTotal, onImageClick }) {
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
          <button
            key={i}
            type="button"
            onClick={() => onImageClick(img)}
            className="group relative rounded-xl overflow-hidden transition-all focus:outline-none"
            style={{ aspectRatio: '3/4', background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
            aria-label={`View and edit ${img.label}`}
          >
            <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
            {/* Hover overlay with zoom hint */}
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.45)' }}
            >
              <ZoomIn className="w-5 h-5 text-white drop-shadow" />
            </div>
          </button>
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
