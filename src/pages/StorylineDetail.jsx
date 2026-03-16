import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Trash2, ImagePlus, Loader2, FolderInput, Images, BookOpen, BookMarked
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { useProgress } from '../contexts/ProgressContext'
import { Storyline, CharacterBatch, GeneratedImage } from '../lib/storage'
import { generateImage } from '../lib/anthropic'

export default function StorylineDetail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { theme } = useTheme()
  const { user } = useAuth()
  const userId = user?.id
  const { startProgress, updateProgress, clearProgress, isCancelled, getAbortSignal } = useProgress()
  const mountedRef = useRef(true)

  const storylineId = searchParams.get('id')

  const { data: storyline } = useQuery({
    queryKey: ['storyline', storylineId],
    queryFn: () => Storyline.get(storylineId),
    enabled: !!storylineId,
  })

  const { data: batches = [] } = useQuery({
    queryKey: ['storyline-batches', storylineId],
    queryFn: () => CharacterBatch.forStoryline(storylineId),
    enabled: !!storylineId,
  })

  const [showMovePanel, setShowMovePanel] = useState(false)
  const [showGroupShotModal, setShowGroupShotModal] = useState(false)
  const [groupShotCount, setGroupShotCount] = useState(3)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  if (!storyline && storylineId) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <p>Storyline not found</p>
      </div>
    )
  }
  if (!storyline) return null

  const handleDelete = async () => {
    if (confirm('Delete this storyline? Characters will be unassigned but not deleted.')) {
      await Storyline.delete(storylineId)
      queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
      navigate('/gallery')
      toast.success('Storyline deleted')
    }
  }

  const handleGroupShot = async () => {
    // [API-KEYS DISABLED] Key presence check removed — keys come from .env, not user input.
    // const settings = Settings.get()
    // if (!settings.anthropic_key) {
    //   toast.error('Please add your Anthropic API key in Settings')
    //   navigate('/settings')
    //   return
    // }

    if (batches.length < 2) {
      toast.error('Need at least 2 characters for a group shot')
      return
    }

    const characterSummaries = batches.map((b, i) => 
      `Character ${i + 1} — ${b.name}: ${b.character_description?.slice(0, 200)}`
    ).join('\n\n')

    const prompt = `Generate a group shot scene featuring ALL of the following characters together in a single cohesive composition. Each character must be clearly recognizable from their descriptions.

CHARACTERS:
${characterSummaries}

COMPOSITION RULES:
- All characters must appear in the same image, arranged naturally together
- Characters standing freely as foreground sprites — NO leaning or sitting
- NO holding or interacting with environmental props
- CHROMAKEY GREEN (#00b140) background
- The overall image should feel like a visual novel character lineup or ensemble pose
- Maintain each character's distinct appearance, clothing, and art style as described`

    const images = []
    const signal = getAbortSignal()
    for (let i = 0; i < groupShotCount; i++) {
      if (isCancelled()) break
      startProgress(`Generating group shot ${i + 1}/${groupShotCount}`, groupShotCount, `/storyline?id=${storylineId}`)
      const url = await generateImage({ prompt, referenceImageUrl: batches[0].reference_image_url }, signal)
      images.push(url)
      updateProgress(i + 1)
    }

    if (!mountedRef.current) return

    const batch = await CharacterBatch.create(userId, {
      name: `Group Shot — ${storyline.name}`,
      storyline_id: storylineId,
      reference_image_url: batches[0].reference_image_url,
      character_description: `Group shot with ${batches.length} characters`,
      status: 'completed',
      image_count: images.length
    })

    for (let i = 0; i < images.length; i++) {
      await GeneratedImage.create(userId, {
        batch_id: batch.id,
        url: images[i],
        label: `Group Shot ${i + 1}`,
        category: 'group'
      })
    }

    if (!mountedRef.current) return
    queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
    queryClient.invalidateQueries({ queryKey: ['batches', userId] })
    queryClient.invalidateQueries({ queryKey: ['storyline-batches', storylineId] })
    clearProgress()
    setShowGroupShotModal(false)
    toast.success('Group shot created!')
  }

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-8 px-4">

      {/* ── Header — two rows on mobile, one row on desktop ── */}
      <div className="mb-6 md:mb-8">
        {/* Top row: back + title */}
        <div className="flex items-start gap-3 mb-3">
          <button
            onClick={() => navigate('/gallery')}
            className="flex items-center justify-center rounded-lg hover:bg-white/10 flex-shrink-0 mt-0.5"
            style={{ minWidth: '44px', minHeight: '44px' }}
            aria-label="Back to gallery"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: theme.textMuted }} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <h1
              className="font-bold truncate"
              style={{ fontSize: 'var(--font-size-page)', color: theme.textBody }}
            >
              {storyline.name}
            </h1>
            <p style={{ fontSize: 'var(--font-size-label)', color: theme.textMuted }}>
              {batches.length} character{batches.length !== 1 ? 's' : ''} • Created {new Date(storyline.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Actions row — wraps on mobile */}
        <div className="flex flex-wrap gap-2 pl-0 md:pl-14">
          {storyline.storyline_prompt_id && (
            <Button
              onClick={() => navigate(`/storyline/result/${storyline.storyline_prompt_id}`)}
              theme={theme}
              variant="outline"
            >
              <BookMarked className="w-4 h-4 mr-2" aria-hidden="true" />
              View Generated Prompt
            </Button>
          )}
          {batches.length >= 2 && (
            <Button onClick={() => setShowGroupShotModal(true)} theme={theme} variant="outline">
              Group Shot
            </Button>
          )}
          <Button onClick={() => navigate(`/generate?storylineId=${storylineId}`)} theme={theme}>
            <ImagePlus className="w-4 h-4 mr-2" aria-hidden="true" />
            Add Characters
          </Button>
          <Button
            onClick={handleDelete}
            theme={theme}
            variant="ghost"
            className="text-red-400"
            aria-label="Delete storyline"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/*
        "View Generated Prompt" — distinct full-width card on mobile,
        shown above the character grid when a prompt exists.
        On desktop it's already visible in the header button row.
      */}
      {storyline.storyline_prompt_id && (
        <div
          className="md:hidden mb-4 rounded-2xl p-4 cursor-pointer transition-all hover:opacity-90"
          style={{
            background: theme.primaryGlow,
            border:     `1px solid ${theme.primary}`,
          }}
          onClick={() => navigate(`/storyline/result/${storyline.storyline_prompt_id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && navigate(`/storyline/result/${storyline.storyline_prompt_id}`)}
          aria-label="View generated storyline prompt"
        >
          <div className="flex items-center gap-3">
            <BookMarked className="w-5 h-5 flex-shrink-0" style={{ color: theme.primary }} aria-hidden="true" />
            <div>
              <div className="font-semibold text-sm" style={{ color: theme.primary }}>
                View Generated Prompt
              </div>
              <div style={{ fontSize: 'var(--font-size-label)', color: theme.primary, opacity: 0.8 }}>
                Storyline prompt is attached to this folder
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Character Grid ── */}
      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center">
          <BookOpen className="w-16 h-16 mb-4" style={{ color: theme.textMuted, opacity: 0.5 }} aria-hidden="true" />
          <h3 className="text-xl font-medium mb-2" style={{ color: theme.textBody }}>No characters yet</h3>
          <p className="text-sm mb-4" style={{ color: theme.textMuted }}>Add characters to this storyline</p>
          <Button onClick={() => navigate(`/generate?storylineId=${storylineId}`)} theme={theme}>
            <ImagePlus className="w-4 h-4 mr-2" aria-hidden="true" />
            Add Characters
          </Button>
        </div>
      ) : (
        /* CSS Grid auto-fill — 1 col mobile → 2 col sm → 3+ on wider */
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}
        >
          {batches.map(batch => (
            <BatchCard
              key={batch.id}
              batch={batch}
              theme={theme}
              onClick={() => navigate(`/batch?id=${batch.id}`)}
            />
          ))}
        </div>
      )}

      {showGroupShotModal && (
        <Modal theme={theme} onClose={() => setShowGroupShotModal(false)} title="Group Shot">
          <div className="space-y-4">
            <div>
              <Label theme={theme}>Number of shots</Label>
              {/* Value display above slider */}
              <div className="text-center mb-2">
                <span
                  className="font-bold px-3 py-1 rounded-lg"
                  style={{ color: theme.primary, background: theme.primaryGlow }}
                >
                  {groupShotCount}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={groupShotCount}
                onChange={e => setGroupShotCount(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: theme.primary, color: theme.primary }}
                aria-label="Number of group shots"
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={groupShotCount}
              />
            </div>
            <Button onClick={handleGroupShot} theme={theme} className="w-full">
              Generate Group Shot{groupShotCount > 1 ? 's' : ''}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function BatchCard({ batch, theme, onClick }) {
  const { data: images = [] } = useQuery({
    queryKey: ['batch-images-preview', batch.id],
    queryFn: () => GeneratedImage.filter({ batch_id: batch.id }, '-created_at', 4),
  })

  const statusColors = {
    analyzing: '#3b82f6',
    generating: '#f59e0b',
    completed: '#10b981',
    failed: '#ef4444',
  }

  return (
    <div
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, aspectRatio: '1 / 1' }}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-label={`Open character: ${batch.name}`}
    >
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        {images.length > 0 ? (
          images.map((img, i) => (
            <img
              key={i}
              src={img.url}
              alt=""
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover"
            />
          ))
        ) : (
          <div className="col-span-2 w-full h-full flex items-center justify-center" style={{ background: theme.fieldBg }}>
            {batch.status === 'generating' || batch.status === 'analyzing' ? (
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.primary }} aria-hidden="true" />
            ) : (
              <Images className="w-8 h-8" style={{ color: theme.textMuted, opacity: 0.3 }} aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {batch.reference_image_url && (
        <img
          src={batch.reference_image_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute bottom-2 right-2 w-10 h-10 rounded-lg object-cover border-2"
          style={{ borderColor: theme.cardBg }}
          aria-hidden="true"
        />
      )}

      <div
        className="absolute inset-x-0 bottom-0 p-3"
        style={{
          background: 'linear-gradient(transparent, rgba(0,0,0,0.8))',
        }}
      >
        <div className="font-medium text-white truncate">{batch.name}</div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <span>{batch.image_count || 0} images</span>
          {batch.status && batch.status !== 'completed' && (
            <span style={{ color: statusColors[batch.status] }}>
              {batch.status}
            </span>
          )}
        </div>
      </div>

      {/* Hover arrow — desktop only */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 pointer-events-none">
        <ArrowRight className="w-10 h-10 text-white" aria-hidden="true" />
      </div>
    </div>
  )
}

function Button({ children, onClick, theme, variant = 'primary', className = '', disabled = false, 'aria-label': ariaLabel }) {
  let bg, color, border
  if (variant === 'primary') { bg = theme.buttonGradient; color = 'white' }
  else if (variant === 'outline') { bg = 'transparent'; color = theme.textBody; border = `1px solid ${theme.fieldBorder}` }
  else if (variant === 'ghost')   { bg = 'transparent'; color = theme.textMuted }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-4 rounded-xl font-medium transition-all ${className}`}
      style={{ minHeight: '44px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: bg, color, border }}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}

function Label({ theme, children }) {
  return (
    <div className="text-xs uppercase tracking-widest font-medium mb-1" style={{ color: theme.labelColor }}>
      {children}
    </div>
  )
}

function Modal({ children, theme, onClose, title }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-6"
        style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10">
          <svg className="w-5 h-5" style={{ color: theme.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h3 className="text-lg font-bold mb-4" style={{ color: theme.textBody }}>{title}</h3>
        {children}
      </div>
    </div>
  )
}
import { ArrowRight } from 'lucide-react'
