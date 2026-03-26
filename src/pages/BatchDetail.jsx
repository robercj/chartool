import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Trash2, FolderInput, Download, RefreshCw, Plus,
  Loader2, Check, Square, X, ChevronDown, ChevronUp, Package, Upload, ZoomIn
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useProgress } from '../contexts/ProgressContext'
import { CharacterBatch, GeneratedImage, Storyline } from '../lib/storage'
import { generateImage, removeImageBackground } from '../lib/anthropic'

// Utility: resize a file to max 1024px JPEG
async function resizeImageFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxSize = 1024
        let { width, height } = img
        if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize }
        else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const mediaType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
        resolve(canvas.toDataURL(mediaType, mediaType === 'image/png' ? undefined : 0.8))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

const ART_STYLES = [
  { category: 'Anime & Manga', options: [
    { id: 'shonen', label: 'Shōnen Anime', desc: 'Bold lines, vibrant, energetic shading' },
    { id: 'shoujo', label: 'Shōjo Anime', desc: 'Soft pastels, sparkly eyes, delicate linework' },
    { id: 'seinen', label: 'Seinen Anime', desc: 'Detailed, mature, gritty realism' },
    { id: 'josei', label: 'Josei Anime', desc: 'Elegant, refined, subtle palette' },
    { id: 'dark_fantasy_anime', label: 'Dark Fantasy Anime', desc: 'High-contrast, dramatic lighting' },
    { id: 'retro_80s', label: 'Retro 80s Anime', desc: 'Cel-shading, limited palette, vintage' },
    { id: 'mecha', label: 'Mecha Anime', desc: 'Sharp geometry, metallic sheen, sci-fi proportions' },
  ]},
  { category: 'Manhwa & Light Novel', options: [
    { id: 'manhwa', label: 'Korean Manhwa', desc: 'Crisp linework, full color, elongated proportions' },
    { id: 'isekai_ln', label: 'Isekai Light Novel', desc: 'Soft gradients, glossy shading, fantasy palette' },
    { id: 'manhua', label: 'Chinese Manhua', desc: 'Flowing robes, wuxia aesthetic, ink-influenced' },
    { id: 'ln_cover', label: 'Light Novel Cover', desc: 'Polished anime CG, dynamic poses, vibrant cover art' },
    { id: 'graphic_noir', label: 'Graphic Novel Noir', desc: 'High contrast, deep shadows, muted palette' },
  ]},
  { category: 'Western Comics', options: [
    { id: 'western_comic', label: 'Western Comic Book', desc: 'Heavy inks, halftone dots, heroic proportions' },
    { id: 'indie_comic', label: 'Indie Comic', desc: 'Expressive loose inks, hand-crafted texture' },
    { id: 'bd', label: 'Bande Dessinée', desc: 'European album style, clean color fills' },
  ]},
  { category: 'Visual Novel & Game', options: [
    { id: 'vn_cg', label: 'Visual Novel CG', desc: 'Clean anime lineart, soft cell shading, glossy' },
    { id: 'pixel_16bit', label: 'Pixel Art 16-bit', desc: 'SNES-era pixels, limited palette, dithering' },
    { id: 'fantasy_card', label: 'Fantasy Card Art', desc: 'Hyper-detailed anime illustration, dramatic lighting' },
    { id: 'gacha', label: 'Gacha Game Art', desc: 'Sparkly over-designed outfits, high-saturation anime' },
  ]},
]

export default function BatchDetail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { theme } = useTheme()
  const { user } = useAuth()
  const { generating, setGenerating, getAbortSignal } = useProgress()
  const userId = user?.id
  const mountedRef = useRef(true)

  const batchId = searchParams.get('id')

  const [selectedImages, setSelectedImages] = useState(new Set())
  const [bulkMode, setBulkMode] = useState(false)
  const [showMovePanel, setShowMovePanel] = useState(false)
  const [showRestylePanel, setShowRestylePanel] = useState(false)
  const [showAddVariationPanel, setShowAddVariationPanel] = useState(false)
  const [showAddPropPanel, setShowAddPropPanel] = useState(false)
  const [showEditModal, setShowEditModal] = useState(null)
  const [restyleStyle, setRestyleStyle] = useState('')
  const [newPose, setNewPose] = useState('')
  const [newEmotion, setNewEmotion] = useState('')
  const [propDesc, setPropDesc] = useState('')
  const [propImageUrl, setPropImageUrl] = useState(null)

  const { data: batch } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => CharacterBatch.get(batchId),
    enabled: !!batchId,
  })

  const { data: images = [] } = useQuery({
    queryKey: ['images', batchId],
    queryFn: () => GeneratedImage.filter({ batch_id: batchId }, '-created_at', 100),
    enabled: !!batchId,
  })

  const { data: storylines = [] } = useQuery({
    queryKey: ['storylines', userId],
    queryFn: () => Storyline.list(userId),
    enabled: !!userId,
  })

  const currentStoryline = storylines.find(sl => sl.batch_ids?.includes(batchId))

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  if (batchId && !batch) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <p>Batch not found</p>
      </div>
    )
  }
  if (!batch) return null

  const handleDelete = async () => {
    if (confirm('Delete this character and all images?')) {
      await CharacterBatch.delete(batchId)
      queryClient.invalidateQueries({ queryKey: ['batches', userId] })
      navigate('/gallery')
      toast.success('Character deleted')
    }
  }

  const handleMove = async (storylineId) => {
    await CharacterBatch.assignStoryline(batchId, storylineId === 'unassign' ? null : storylineId)
    queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
    queryClient.invalidateQueries({ queryKey: ['batch', batchId] })
    setShowMovePanel(false)
    toast.success('Character moved')
  }

  const handleExportAll = async () => {
    await exportZip(images.map(i => ({ url: i.url, label: i.label })), `${batch.name}-export`)
  }

  const handleExportSelected = async () => {
    const selected = images.filter(i => selectedImages.has(i.id))
    await exportZip(selected.map(i => ({ url: i.url, label: i.label })), `${batch.name}-selected`)
  }

  const handleRestyle = async () => {
    const style = ART_STYLES.flatMap(c => c.options).find(s => s.id === restyleStyle)
    if (!style) return

    setGenerating(true)
    const signal = getAbortSignal()
    try {
      for (const img of images) {
        const prompt = `${batch.character_description}\n\nLabel: ${img.label}\n\nCOMPLETELY REIMAGINE in ${style.label} style. Keep the same pose but transform the art style entirely.`
        let newUrl = await generateImage({ prompt, referenceImageUrl: batch.reference_image_url, aspectRatio: batch.aspect_ratio || '3:4' }, signal)
        // Apply background removal — surface failure as a warning so user knows
        if (batch.remove_background !== false) {
          try {
            newUrl = await removeImageBackground(newUrl, signal)
          } catch (rembgErr) {
            console.warn('Background removal failed:', rembgErr)
            toast.warning(`Background removal failed for "${img.label}": ${rembgErr.message}`)
          }
        }
        if (!mountedRef.current) return
        // Create new image record instead of overwriting
        await GeneratedImage.create(userId, {
          batch_id: batchId,
          url: newUrl,
          label: `${img.label} (${style.label})`,
          category: img.category || 'restyle',
        })
      }
      if (!mountedRef.current) return
      await CharacterBatch.update(batchId, { image_count: images.length * 2 })
      queryClient.invalidateQueries({ queryKey: ['images', batchId] })
      toast.success('Restyled images added to gallery!')
      setShowRestylePanel(false)
    } catch (err) {
      if (!mountedRef.current) return
      toast.error(err.message)
    } finally {
      if (mountedRef.current) setGenerating(false)
    }
  }

  const handleAddVariation = async () => {
    if (!newPose && !newEmotion) return

    setGenerating(true)
    const signal = getAbortSignal()
    try {
      const prompt = `${batch.character_description}\n\nPOSE: ${newPose || 'Neutral'}\nEMOTION: ${newEmotion || 'Neutral'}`
      const refUrls = batch.reference_image_urls?.length ? batch.reference_image_urls : undefined
      let url = await generateImage({
        prompt,
        referenceImageUrls: refUrls,
        referenceImageUrl: batch.reference_image_url,
        aspectRatio: batch.aspect_ratio || '3:4'
      }, signal)
      if (batch.remove_background !== false) {
        try {
          url = await removeImageBackground(url, signal)
        } catch (rembgErr) {
          console.warn('Background removal failed:', rembgErr)
          toast.warning(`Background removal failed: ${rembgErr.message}`)
        }
      }
      if (!mountedRef.current) return
      await GeneratedImage.create(userId, {
        batch_id: batchId,
        url,
        label: `${newPose || 'Neutral'} / ${newEmotion || 'Neutral'}`,
        category: newPose || 'variation'
      })
      await CharacterBatch.update(batchId, { image_count: images.length + 1 })
      queryClient.invalidateQueries({ queryKey: ['images', batchId] })
      toast.success('Variation added!')
      setShowAddVariationPanel(false)
      setNewPose('')
      setNewEmotion('')
    } catch (err) {
      if (!mountedRef.current) return
      toast.error(err.message)
    } finally {
      if (mountedRef.current) setGenerating(false)
    }
  }

  const handleAddProp = async () => {
    if (!propDesc.trim() && !propImageUrl) return

    setGenerating(true)
    const signal = getAbortSignal()
    try {
      const propSection = propDesc.trim()
        ? `\n\nPROP ADDITION: The character is now holding/carrying the following item — replicate it faithfully in their hand:\n${propDesc.trim()}`
        : '\n\nPROP ADDITION: The character is now holding the prop shown in the provided reference image. Replicate it accurately in their hand.'
      const propImageNote = propImageUrl
        ? '\nThe prop reference image is provided alongside the character reference image.'
        : ''
      const prompt = `${batch.character_description}${propSection}${propImageNote}`

      const refUrls = batch.reference_image_urls?.length ? batch.reference_image_urls : undefined
      let url = await generateImage({
        prompt,
        referenceImageUrls: refUrls,
        referenceImageUrl: batch.reference_image_url,
        propImageUrl: propImageUrl || null,
        aspectRatio: batch.aspect_ratio || '3:4',
      }, signal)
      if (batch.remove_background !== false) {
        try {
          url = await removeImageBackground(url, signal)
        } catch (rembgErr) {
          console.warn('Background removal failed:', rembgErr)
          toast.warning(`Background removal failed: ${rembgErr.message}`)
        }
      }

      if (!mountedRef.current) return
      await GeneratedImage.create(userId, {
        batch_id: batchId,
        url,
        label: propDesc.trim() ? `Prop: ${propDesc.trim().slice(0, 40)}` : 'Prop variation',
        category: 'prop'
      })
      await CharacterBatch.update(batchId, { image_count: images.length + 1 })
      queryClient.invalidateQueries({ queryKey: ['images', batchId] })
      toast.success('Prop variation added!')
      setShowAddPropPanel(false)
      setPropDesc('')
      setPropImageUrl(null)
    } catch (err) {
      if (!mountedRef.current) return
      toast.error(err.message)
    } finally {
      if (mountedRef.current) setGenerating(false)
    }
  }

  const toggleSelection = (id) => {
    const newSet = new Set(selectedImages)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedImages(newSet)
  }

  const selectAll = () => {
    setSelectedImages(new Set(images.map(i => i.id)))
  }

  const deselectAll = () => {
    setSelectedImages(new Set())
  }

  const handleBulkDelete = async () => {
    if (confirm(`Delete ${selectedImages.size} selected images?`)) {
      for (const id of selectedImages) {
        await GeneratedImage.delete(id)
      }
      await CharacterBatch.update(batchId, { image_count: images.length - selectedImages.size })
      queryClient.invalidateQueries({ queryKey: ['images', batchId] })
      setSelectedImages(new Set())
      setBulkMode(false)
      toast.success('Images deleted')
    }
  }

  const statusColors = {
    analyzing: '#3b82f6',
    generating: '#f59e0b',
    completed: '#10b981',
    failed: '#ef4444',
  }

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-8 px-4" style={{ overflowX: 'hidden' }}>
      {/* ── Header — two rows on mobile ── */}
      <div className="mb-6">
        {/* Row 1: back + name */}
        <div className="flex items-start gap-3 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="btn btn-ghost btn-circle flex-shrink-0 mt-0.5"
            style={{ minHeight: '44px' }}
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: theme.textMuted }} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold truncate" style={{ fontSize: 'var(--font-size-page)', color: theme.textBody }}>{batch.name}</h1>
            <div className="flex items-center gap-3 text-sm flex-wrap" style={{ color: theme.textMuted }}>
              <span>{images.length} images</span>
              {batch.status && batch.status !== 'completed' && (
                <span style={{ color: statusColors[batch.status] }} className="flex items-center gap-1">
                  <span className="loading loading-spinner loading-xs" aria-hidden="true" />
                  {batch.status}
                </span>
              )}
              <span>• {new Date(batch.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        {/* Row 2: action buttons — wrap on mobile */}
        <div className="flex flex-wrap gap-2">
          {bulkMode ? (
            <>
              <Button onClick={selectAll} theme={theme} variant="outline" size="sm">Select All</Button>
              <Button onClick={deselectAll} theme={theme} variant="outline" size="sm">Deselect All</Button>
              {selectedImages.size > 0 && (
                <>
                  <Button onClick={handleExportSelected} theme={theme} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />Export ({selectedImages.size})
                  </Button>
                  <Button onClick={handleBulkDelete} theme={theme} variant="outline" size="sm" className="text-error">
                    Delete ({selectedImages.size})
                  </Button>
                </>
              )}
              <Button onClick={() => { setBulkMode(false); setSelectedImages(new Set()) }} theme={theme} variant="ghost" size="sm">
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button onClick={() => setBulkMode(true)} theme={theme} variant="outline" size="sm">Select</Button>
              <Button onClick={() => setShowMovePanel(!showMovePanel)} theme={theme} variant="outline" size="sm">
                <FolderInput className="w-4 h-4 mr-1.5" aria-hidden="true" />Move
              </Button>
              <Button onClick={handleExportAll} theme={theme} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />Export
              </Button>
              <Button onClick={() => setShowRestylePanel(!showRestylePanel)} theme={theme} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-1.5" aria-hidden="true" />Restyle
              </Button>
              <Button onClick={() => setShowAddVariationPanel(!showAddVariationPanel)} theme={theme} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1.5" aria-hidden="true" />Add
              </Button>
              <Button onClick={() => { setShowAddPropPanel(!showAddPropPanel); setShowAddVariationPanel(false) }} theme={theme} size="sm">
                <Package className="w-4 h-4 mr-1.5" aria-hidden="true" />Prop
              </Button>
              <Button onClick={handleDelete} theme={theme} variant="ghost" size="sm" className="text-error" aria-label="Delete character">
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Move panel */}
      {showMovePanel && (
        <div className="card bg-base-200 border border-base-300 mb-6 p-4 rounded-xl">
          <div className="flex flex-wrap gap-2">
            {storylines.map(sl => (
              <Button
                key={sl.id}
                onClick={() => handleMove(sl.id)}
                theme={theme}
                variant={currentStoryline?.id === sl.id ? 'primary' : 'outline'}
                size="sm"
              >
                {currentStoryline?.id === sl.id && <Check className="w-3 h-3 mr-1" />}
                {sl.name}
              </Button>
            ))}
            <Button onClick={() => handleMove('unassign')} theme={theme} variant="ghost" size="sm">
              Unassign
            </Button>
          </div>
        </div>
      )}

      {/* Restyle panel */}
      {showRestylePanel && (
        <div className="card bg-base-200 border border-base-300 mb-6 p-4 rounded-xl">
          <h3 className="font-medium mb-3" style={{ color: theme.textBody }}>Restyle All Images</h3>
          <div className="flex gap-3">
            <select
              value={restyleStyle}
              onChange={(e) => setRestyleStyle(e.target.value)}
              className="select select-bordered bg-base-300 flex-1 text-sm"
              style={{ color: theme.textBody, minHeight: '44px' }}
            >
              <option value="">Select art style...</option>
              {ART_STYLES.map(cat => (
                <optgroup key={cat.category} label={cat.category}>
                  {cat.options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Button onClick={handleRestyle} theme={theme} disabled={!restyleStyle || generating}>
              {generating ? <span className="loading loading-spinner loading-sm mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Restyle All
            </Button>
          </div>
        </div>
      )}

      {/* Add variation panel */}
      {showAddVariationPanel && (
        <div className="card bg-base-200 border border-base-300 mb-6 p-4 rounded-xl w-full min-w-0">
          <h3 className="font-medium mb-3" style={{ color: theme.textBody }}>Add Variation</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 min-w-0">
            <input
              type="text"
              value={newPose}
              onChange={(e) => setNewPose(e.target.value)}
              placeholder="Pose (e.g., arms crossed)"
              className="input input-bordered bg-base-300 w-full min-w-0 text-sm"
              style={{ color: theme.textBody, minHeight: '44px' }}
            />
            <input
              type="text"
              value={newEmotion}
              onChange={(e) => setNewEmotion(e.target.value)}
              placeholder="Emotion"
              className="input input-bordered bg-base-300 w-full min-w-0 text-sm"
              style={{ color: theme.textBody, minHeight: '44px' }}
            />
          </div>
          <Button onClick={handleAddVariation} theme={theme} disabled={generating}>
            {generating ? <span className="loading loading-spinner loading-sm mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            +Generate
          </Button>
        </div>
      )}

      {/* Add prop panel */}
      {showAddPropPanel && (
        <div className="card bg-base-200 border border-base-300 mb-6 p-4 rounded-xl space-y-3">
          <h3 className="font-medium" style={{ color: theme.textBody }}>Add Prop</h3>
          <p className="text-xs text-base-content/60">
            Generate a new variation showing the character holding a prop. Provide a text description, a reference image, or both.
          </p>

          {/* Text description */}
          <div>
            <Label theme={theme}>Prop Description</Label>
            <input
              type="text"
              value={propDesc}
              onChange={(e) => setPropDesc(e.target.value)}
              placeholder="e.g., a glowing blue sword, a leather-bound book..."
              className="input input-bordered bg-base-300 w-full text-sm"
              style={{ color: theme.textBody, minHeight: '44px' }}
            />
          </div>

          {/* Image upload */}
          <div>
            <Label theme={theme}>
              <div className="flex items-center gap-1.5">
                Prop Reference Image
                <span className="badge badge-ghost text-xs" style={{ color: theme.textMuted }}>optional</span>
              </div>
            </Label>
            <PropImageUpload theme={theme} value={propImageUrl} onChange={setPropImageUrl} />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              onClick={handleAddProp}
              theme={theme}
              disabled={generating || (!propDesc.trim() && !propImageUrl)}
            >
              {generating ? <span className="loading loading-spinner loading-sm mr-2" /> : <Package className="w-4 h-4 mr-2" />}
              Generate with Prop
            </Button>
            <Button onClick={() => { setShowAddPropPanel(false); setPropDesc(''); setPropImageUrl(null) }} theme={theme} variant="ghost">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Reference + Description */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="card bg-base-200 border border-base-300 rounded-xl overflow-hidden">
          <div className="aspect-square">
            {batch.reference_image_url ? (
              <img src={batch.reference_image_url} alt="Reference" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-base-300">
                <span className="text-base-content/50">No reference</span>
              </div>
            )}
          </div>
        </div>
        <AnalysisPanel batch={batch} theme={theme} />
      </div>

      {/* Image grid */}
      {images.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-base-content/50">No images generated yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {images.map(img => (
            <div
              key={img.id}
              className="relative group cursor-pointer rounded-xl overflow-hidden bg-base-300"
              onClick={() => bulkMode ? toggleSelection(img.id) : setShowEditModal(img)}
            >
              <img
                src={img.url}
                alt={img.label}
                loading="lazy"
                decoding="async"
                className="w-full h-auto block transition-transform duration-500 group-hover:scale-105"
                style={{ objectFit: 'contain' }}
              />

              {bulkMode && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                  {selectedImages.has(img.id) ? (
                    <div className="w-6 h-6 rounded bg-secondary flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded border-2 border-white flex items-center justify-center">
                    </div>
                  )}
                </div>
              )}

              {!bulkMode && (
                <>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                    <p className="text-xs text-white truncate">{img.label}</p>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {showEditModal && (
        <ImageEditModal
          image={showEditModal}
          theme={theme}
          onClose={() => setShowEditModal(null)}
          onUpdate={async (data) => {
            await GeneratedImage.update(showEditModal.id, data)
            queryClient.invalidateQueries({ queryKey: ['images', batchId] })
            setShowEditModal({ ...showEditModal, ...data })
          }}
          onRegenerate={async (changeDescription) => {
            const signal = getAbortSignal()
            const prompt = `${batch.character_description}\n\nLabel: ${showEditModal.label}\n\nModify: ${changeDescription}`
            const refUrls = batch.reference_image_urls?.length ? batch.reference_image_urls : undefined
            let newUrl = await generateImage({
              prompt,
              referenceImageUrls: refUrls,
              referenceImageUrl: batch.reference_image_url,
              aspectRatio: batch.aspect_ratio || '3:4'
            }, signal)
            if (batch.remove_background !== false) {
              try {
                newUrl = await removeImageBackground(newUrl, signal)
              } catch (rembgErr) {
                console.warn('Background removal failed:', rembgErr)
                toast.warning(`Background removal failed: ${rembgErr.message}`)
              }
            }
            if (!mountedRef.current) return
            // Create a new image record — preserve the original
            const newImg = await GeneratedImage.create(userId, {
              batch_id: batchId,
              url: newUrl,
              label: showEditModal.label,
              category: showEditModal.category,
            })
            await CharacterBatch.update(batchId, { image_count: images.length + 1 })
            queryClient.invalidateQueries({ queryKey: ['images', batchId] })
            // Switch modal to new image so user sees it immediately
            setShowEditModal({ ...showEditModal, ...newImg, url: newUrl })
          }}
          batch={batch}
        />
      )}
    </div>
  )
}

function AnalysisPanel({ batch, theme }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="card bg-base-200 border border-base-300 lg:col-span-2 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:opacity-80"
        onClick={() => setOpen(v => !v)}
        style={{ minHeight: '44px', borderBottom: open ? `1px solid ${theme.cardBorder}` : 'none' }}
      >
        <span className="text-xs uppercase tracking-widest font-medium" style={{ color: theme.labelColor }}>
          Analysis Results
        </span>
        <span className="flex items-center gap-2 text-xs" style={{ color: theme.textMuted }}>
          {batch.character_description
            ? (open ? 'Hide' : 'Show')
            : <span className="text-error">Not available</span>}
          {open
            ? <ChevronUp className="w-4 h-4" />
            : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      {open && (
        <div className="px-4 py-3">
          <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: theme.textBody }}>
            {batch.character_description || 'No analysis data stored for this character.'}
          </p>
        </div>
      )}
      {!open && (
        <div className="px-4 py-3">
          <p className="text-sm text-base-content/60">
            {batch.character_description
              ? 'Tap to view the full AI analysis used to generate this character\'s images.'
              : 'No analysis data stored for this character.'}
          </p>
        </div>
      )}
    </div>
  )
}

function ImageEditModal({ image, theme, onClose, onUpdate, onRegenerate }) {
  const [label, setLabel] = useState(image.label)
  const [category, setCategory] = useState(image.category)
  const [changeDesc, setChangeDesc] = useState('')
  const [lightboxOpen, setLightboxOpen] = useState(false)
  // Share the global generating lock — prevents concurrent generation from modal + parent
  const { generating, setGenerating } = useProgress()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const handleSave = () => {
    onUpdate({ label, category })
    onClose()
  }

  const handleRegenerate = async () => {
    if (!changeDesc.trim()) return
    setGenerating(true)
    try {
      await onRegenerate(changeDesc)
      if (!mountedRef.current) return
      toast.success('New image generated and added to gallery')
      setChangeDesc('')
    } catch (err) {
      if (!mountedRef.current) return
      toast.error(err.message)
    } finally {
      if (mountedRef.current) setGenerating(false)
    }
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = image.url
    a.download = `${label || 'image'}.png`
    a.click()
  }

  return (
    <>
      {/* Edit modal — DaisyUI dialog */}
      <dialog className="modal modal-bottom sm:modal-middle" open>
        <div
          className="modal-box relative w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto"
          style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
        >
          <button
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm absolute top-4 right-4"
            style={{ minHeight: '44px' }}
          >
            <X className="w-5 h-5" style={{ color: theme.textMuted }} />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative group/thumb">
              <img
                src={image.url}
                alt={image.label}
                className="w-full rounded-xl cursor-zoom-in"
                style={{ objectFit: 'contain' }}
                onClick={() => setLightboxOpen(true)}
              />
              <div
                className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 group-hover/thumb:bg-black/30 transition-colors cursor-zoom-in pointer-events-none"
              >
                <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="space-y-4">
              <Input label="Label" value={label} onChange={(e) => setLabel(e.target.value)} theme={theme} />
              <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} theme={theme} />

              <div>
                <Label theme={theme}>Describe changes</Label>
                <textarea
                  value={changeDesc}
                  onChange={(e) => setChangeDesc(e.target.value)}
                  placeholder="Make them smile, change pose to..."
                  rows={3}
                  className="textarea textarea-bordered bg-base-300 w-full text-sm resize-y"
                  style={{ color: theme.textBody, minHeight: '96px' }}
                  autoCorrect="on"
                  spellCheck="true"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleRegenerate} theme={theme} disabled={!changeDesc.trim() || generating} className="flex-1">
                  {generating ? <span className="loading loading-spinner loading-sm mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Regenerate
                </Button>
                <Button onClick={handleDownload} theme={theme} variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                </Button>
              </div>

              <Button onClick={handleSave} theme={theme} className="w-full">
                Save Changes
              </Button>
            </div>
          </div>
        </div>
        <div className="modal-backdrop bg-black/60" onClick={onClose} />
      </dialog>

      {/* Lightbox */}
      {lightboxOpen && (
        <dialog className="modal" open style={{ zIndex: 60 }}>
          <div
            className="modal-box bg-transparent shadow-none max-w-none w-full h-full flex items-center justify-center p-4 cursor-zoom-out"
            style={{ background: 'transparent', maxWidth: '100vw', maxHeight: '100vh' }}
            onClick={() => setLightboxOpen(false)}
          >
            <button
              className="btn btn-circle btn-sm bg-white/10 hover:bg-white/20 border-0 absolute top-4 right-4"
              style={{ minHeight: '44px' }}
              onClick={() => setLightboxOpen(false)}
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img
              src={image.url}
              alt={image.label}
              className="max-w-full max-h-full rounded-xl shadow-2xl"
              style={{ objectFit: 'contain', maxHeight: 'calc(100vh - 4rem)' }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <p className="text-sm text-white text-center">{image.label}</p>
            </div>
          </div>
          <div
            className="modal-backdrop"
            style={{ background: 'rgba(0,0,0,0.92)' }}
            onClick={() => setLightboxOpen(false)}
          />
        </dialog>
      )}
    </>
  )
}

function PropImageUpload({ theme, value, onChange }) {
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = await resizeImageFile(file)
    onChange(dataUrl)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:opacity-80 bg-base-300"
      style={{ borderColor: theme.fieldBorder }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="Prop reference" className="max-h-32 mx-auto rounded-lg" />
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            className="btn btn-circle btn-xs bg-black/60 border-0 absolute top-1 right-1"
          >
            <X className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      ) : (
        <div>
          <Package className="w-6 h-6 mx-auto mb-1 text-base-content/50" style={{ color: theme.textMuted }} />
          <p className="text-xs text-base-content/50">Drop prop image or click to upload</p>
        </div>
      )}
    </div>
  )
}

async function exportZip(files, prefix) {
  const JSZip = (await import('https://esm.sh/jszip@3.10.1')).default
  const zip = new JSZip()

  for (const file of files) {
    const label = file.label || 'image'
    const ext = file.url.startsWith('data:image/jpeg') ? 'jpg' : 'png'
    const cleanName = label.replace(/[^a-z0-9]/gi, '_').slice(0, 50)
    const response = await fetch(file.url)
    const blob = await response.blob()
    zip.file(`${cleanName}.${ext}`, blob)
  }

  const content = await zip.generateAsync({ type: 'blob' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(content)
  a.download = `${prefix}.zip`
  a.click()
}

function Button({ children, onClick, theme, variant = 'primary', className = '', disabled = false, size = 'md', 'aria-label': ariaLabel }) {
  let bg, color, border
  if (variant === 'primary')  { bg = theme.buttonGradient; color = 'white' }
  else if (variant === 'outline') { bg = 'transparent'; color = theme.textBody; border = `1px solid ${theme.fieldBorder}` }
  else if (variant === 'ghost')   { bg = 'transparent'; color = theme.textMuted }

  const h = size === 'sm' ? '36px' : '44px'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-3 rounded-xl font-medium transition-all ${className}`}
      style={{ minHeight: h, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: bg, color, border }}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}

function Input({ label, value, onChange, theme }) {
  return (
    <div className="space-y-1">
      {label && <Label theme={theme}>{label}</Label>}
      <input
        type="text"
        value={value}
        onChange={onChange}
        className="input input-bordered bg-base-300 w-full text-sm"
        style={{ color: theme.textBody, minHeight: '44px' }}
      />
    </div>
  )
}

function Label({ theme, children }) {
  return (
    <div className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: theme.labelColor }}>
      {children}
    </div>
  )
}
