import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Trash2, ImagePlus, Loader2, FolderInput, Images, BookOpen, BookMarked
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { Storyline, CharacterBatch, GeneratedImage } from '../lib/storage'
import { generateImage } from '../lib/anthropic'

export default function StorylineDetail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { theme } = useTheme()
  const { user } = useAuth()
  const userId = user?.id
  const { startProgress, updateProgress, clearProgress, isCancelled } = useProgress()

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
    for (let i = 0; i < groupShotCount; i++) {
      if (isCancelled()) break
      startProgress(`Generating group shot ${i + 1}/${groupShotCount}`, groupShotCount, `/storyline?id=${storylineId}`)
      const url = await generateImage({ prompt, referenceImageUrl: batches[0].reference_image_url })
      images.push(url)
      updateProgress(i + 1)
    }

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

    queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
    queryClient.invalidateQueries({ queryKey: ['batches', userId] })
    queryClient.invalidateQueries({ queryKey: ['storyline-batches', storylineId] })
    clearProgress()
    setShowGroupShotModal(false)
    toast.success('Group shot created!')
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate('/gallery')}
          className="p-2 rounded-lg hover:bg-white/10"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: theme.textMuted }} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: theme.textBody }}>{storyline.name}</h1>
          <p className="text-sm" style={{ color: theme.textMuted }}>
            {batches.length} character{batches.length !== 1 ? 's' : ''} • Created {new Date(storyline.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          {storyline.storyline_prompt_id && (
            <Button
              onClick={() => navigate(`/storyline/result/${storyline.storyline_prompt_id}`)}
              theme={theme}
              variant="outline"
            >
              <BookMarked className="w-4 h-4 mr-2" />
              View Generated Prompt
            </Button>
          )}
          {batches.length >= 2 && (
            <Button onClick={() => setShowGroupShotModal(true)} theme={theme} variant="outline">
              Group Shot
            </Button>
          )}
          <Button onClick={() => navigate(`/generate?storylineId=${storylineId}`)} theme={theme}>
            <ImagePlus className="w-4 h-4 mr-2" />
            Add Characters
          </Button>
          <Button onClick={handleDelete} theme={theme} variant="ghost" className="text-red-400">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Batches */}
      {batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <BookOpen className="w-16 h-16 mb-4" style={{ color: theme.textMuted, opacity: 0.5 }} />
          <h3 className="text-xl font-medium mb-2" style={{ color: theme.textBody }}>No characters yet</h3>
          <p className="text-sm mb-4" style={{ color: theme.textMuted }}>Add characters to this storyline</p>
          <Button onClick={() => navigate(`/generate?storylineId=${storylineId}`)} theme={theme}>
            <ImagePlus className="w-4 h-4 mr-2" />
            Add Characters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
              <input
                type="range"
                min="1"
                max="5"
                value={groupShotCount}
                onChange={(e) => setGroupShotCount(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: theme.primary }}
              />
              <div className="text-center text-sm" style={{ color: theme.textMuted }}>{groupShotCount}</div>
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
      className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group"
      style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
    >
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        {images.length > 0 ? (
          images.map((img, i) => (
            <img key={i} src={img.url} alt="" className="w-full h-full object-cover" />
          ))
        ) : (
          <div className="col-span-2 w-full h-full flex items-center justify-center" style={{ background: theme.fieldBg }}>
            {batch.status === 'generating' || batch.status === 'analyzing' ? (
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.primary }} />
            ) : (
              <Images className="w-8 h-8" style={{ color: theme.textMuted, opacity: 0.3 }} />
            )}
          </div>
        )}
      </div>

      {batch.reference_image_url && (
        <img
          src={batch.reference_image_url}
          alt=""
          className="absolute bottom-2 right-2 w-10 h-10 rounded-lg object-cover border-2"
          style={{ borderColor: theme.cardBg }}
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

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
        <ArrowRight className="w-12 h-12 text-white" />
      </div>
    </div>
  )
}

function Button({ children, onClick, theme, variant = 'primary', className = '', disabled = false }) {
  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem 1.5rem',
    borderRadius: '0.75rem',
    fontWeight: 500,
    transition: 'all 0.3s',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }

  let bg, color, border
  if (variant === 'primary') {
    bg = theme.buttonGradient
    color = 'white'
  } else if (variant === 'outline') {
    bg = 'transparent'
    color = theme.textBody
    border = `1px solid ${theme.fieldBorder}`
  } else if (variant === 'ghost') {
    bg = 'transparent'
    color = theme.textMuted
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={{ ...baseStyle, background: bg, color, border }}
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

import { useProgress } from '../contexts/ProgressContext'
import { ArrowRight } from 'lucide-react'
