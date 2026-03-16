import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FolderOpen, Images, Plus, Trash2, FolderInput, ImagePlus,
  BookOpen, ChevronRight, BookMarked, X as XIcon,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { Storyline, CharacterBatch, GeneratedImage } from '../lib/storage'

export default function Gallery() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { theme } = useTheme()
  const { user } = useAuth()
  const userId = user?.id

  const { data: storylines = [] } = useQuery({
    queryKey: ['storylines', userId],
    queryFn:  () => Storyline.list(userId),
    enabled:  !!userId,
  })

  const { data: allBatches = [] } = useQuery({
    queryKey: ['batches', userId],
    queryFn:  () => CharacterBatch.list(userId),
    enabled:  !!userId,
  })

  const assignedBatchIds  = new Set(storylines.flatMap(sl => sl.batch_ids || []))
  const unassignedBatches = allBatches.filter(b => !assignedBatchIds.has(b.id))

  const [showNewModal, setShowNewModal]       = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(null)
  const [pendingDelete, setPendingDelete]     = useState(null)

  const handleDeleteStoryline = async (id) => {
    await Storyline.delete(id)
    queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
    toast.success('Storyline deleted')
  }

  const handleDeleteBatch = async (id) => {
    await CharacterBatch.delete(id)
    queryClient.invalidateQueries({ queryKey: ['batches', userId] })
    toast.success('Character deleted')
  }

  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    if (pendingDelete.type === 'storyline') handleDeleteStoryline(pendingDelete.id)
    else handleDeleteBatch(pendingDelete.id)
    setPendingDelete(null)
  }

  const handleMoveBatch = async (batchId, storylineId) => {
    if (storylineId === 'unassign') {
      await CharacterBatch.assignStoryline(batchId, null)
    } else {
      await CharacterBatch.assignStoryline(batchId, storylineId)
    }
    queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
    queryClient.invalidateQueries({ queryKey: ['batches', userId] })
    setShowAssignModal(null)
    toast.success('Character moved')
  }

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-8 px-4">

      {/* ── Header — wraps gracefully on mobile ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1
            className="font-bold mb-1"
            style={{
              fontSize:             'var(--font-size-page)',
              background:           theme.titleGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
            }}
          >
            Storyline Gallery
          </h1>
          <p style={{ fontSize: 'var(--font-size-label)', color: theme.textMuted }}>
            {storylines.length} storylines • {allBatches.length} characters
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowNewModal(true)} theme={theme}>
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            New Storyline
          </Button>
          <Button onClick={() => navigate('/generate')} theme={theme} variant="outline">
            <ImagePlus className="w-4 h-4 mr-2" aria-hidden="true" />
            New Character
          </Button>
        </div>
      </div>

      {storylines.length === 0 && unassignedBatches.length === 0 ? (
        <EmptyState theme={theme} onCreateStoryline={() => setShowNewModal(true)} />
      ) : (
        <>
          {storylines.length > 0 && (
            <div className="mb-8">
              <h2
                className="uppercase tracking-widest mb-4"
                style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}
              >
                Storylines
              </h2>
              {/* CSS Grid auto-fill: 1 col mobile → 2 col sm → 3 col lg → 4 col xl */}
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}
              >
                {storylines.map(sl => (
                  <StorylineCard
                    key={sl.id}
                    storyline={sl}
                    theme={theme}
                    onClick={() => navigate(`/storyline?id=${sl.id}`)}
                    onDelete={() => setPendingDelete({ type: 'storyline', id: sl.id, name: sl.name })}
                  />
                ))}
              </div>
            </div>
          )}

          {unassignedBatches.length > 0 && (
            <div>
              <h2
                className="uppercase tracking-widest mb-4"
                style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}
              >
                Unassigned Characters
              </h2>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }}
              >
                {unassignedBatches.map(batch => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    theme={theme}
                    onClick={() => navigate(`/batch?id=${batch.id}`)}
                    onAssign={() => setShowAssignModal(batch.id)}
                    onDelete={() => setPendingDelete({ type: 'batch', id: batch.id, name: batch.name })}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showNewModal && (
        <NewStorylineModal
          theme={theme}
          onClose={() => setShowNewModal(false)}
          onCreate={async (name) => {
            await Storyline.create(userId, { name, storyline_art_style: null })
            queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
            setShowNewModal(false)
            toast.success('Storyline created')
          }}
        />
      )}

      {showAssignModal && (
        <AssignStorylineModal
          theme={theme}
          storylines={storylines}
          currentBatchId={showAssignModal}
          onClose={() => setShowAssignModal(null)}
          onAssign={handleMoveBatch}
        />
      )}

      {pendingDelete && (
        <ConfirmDeleteModal
          theme={theme}
          name={pendingDelete.name}
          type={pendingDelete.type}
          onClose={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

// ─── Storyline Card ───────────────────────────────────────────────────────────
function StorylineCard({ storyline, theme, onClick, onDelete }) {
  const { data: batches = [] } = useQuery({
    queryKey: ['storyline-batches', storyline.id],
    queryFn:  () => CharacterBatch.forStoryline(storyline.id),
  })

  const { data: previewImages = [] } = useQuery({
    queryKey: ['storyline-preview-images', storyline.id],
    queryFn: async () => {
      const allImgs = []
      for (const b of batches.slice(0, 4)) {
        const imgs = await GeneratedImage.filter({ batch_id: b.id }, '-created_at', 1)
        allImgs.push(...imgs)
        if (allImgs.length >= 4) break
      }
      return allImgs.slice(0, 4)
    },
    enabled: batches.length > 0,
  })

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background:  theme.cardBg,
        border:      `1px solid ${theme.cardBorder}`,
        aspectRatio: '1 / 1',
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-label={`Open storyline: ${storyline.name}`}
    >
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        {previewImages.length > 0 ? (
          previewImages.map((img, i) => (
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
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="w-full h-full flex items-center justify-center" style={{ background: theme.fieldBg }}>
              <BookOpen className="w-6 h-6 md:w-8 md:h-8" style={{ color: theme.textMuted, opacity: 0.3 }} aria-hidden="true" />
            </div>
          ))
        )}
      </div>

      <div
        className="absolute inset-x-0 bottom-0 p-3"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}
      >
        <div className="font-medium text-white truncate text-sm">{storyline.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <span>{batches.length} characters</span>
          {storyline.storyline_prompt_id && (
            <span className="flex items-center gap-0.5 text-white/80">
              <BookMarked className="w-3 h-3" aria-hidden="true" />
              prompt
            </span>
          )}
        </div>
      </div>

      {/* Hover arrow — desktop only */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 pointer-events-none">
        <ChevronRight className="w-10 h-10 text-white" aria-hidden="true" />
      </div>

      {/*
        Delete — always visible on mobile (top-left), hover-revealed on desktop.
        44×44px touch target.
      */}
      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="absolute top-2 left-2 z-10 flex items-center justify-center rounded-lg
                   transition-all bg-black/60 hover:bg-red-500/80
                   opacity-100 md:opacity-0 md:group-hover:opacity-100"
        style={{ width: '44px', height: '44px' }}
        aria-label={`Delete storyline: ${storyline.name}`}
      >
        <Trash2 className="w-4 h-4 text-white" aria-hidden="true" />
      </button>
    </div>
  )
}

// ─── Batch Card ───────────────────────────────────────────────────────────────
function BatchCard({ batch, theme, onClick, onAssign, onDelete }) {
  const { data: images = [] } = useQuery({
    queryKey: ['batch-images', batch.id],
    queryFn:  () => GeneratedImage.filter({ batch_id: batch.id }, '-created_at', 4),
  })

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background:  theme.cardBg,
        border:      `1px solid ${theme.cardBorder}`,
        aspectRatio: '1 / 1',
      }}
      onClick={onClick}
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
            <Images className="w-10 h-10 md:w-12 md:h-12" style={{ color: theme.textMuted, opacity: 0.3 }} aria-hidden="true" />
          </div>
        )}
      </div>

      {batch.reference_image_url && (
        <img
          src={batch.reference_image_url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute bottom-10 right-2 w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover border-2"
          style={{ borderColor: theme.cardBg }}
          aria-hidden="true"
        />
      )}

      <div
        className="absolute inset-x-0 bottom-0 p-3"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}
      >
        <div className="font-medium text-white truncate text-sm">{batch.name}</div>
        <div className="text-xs text-white/60">{batch.image_count || 0} images</div>
      </div>

      {/*
        Action buttons — always visible on mobile, hover on desktop.
        44×44px each.
      */}
      <div
        className="absolute top-2 right-2 flex gap-1
                   opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
      >
        <button
          onClick={e => { e.stopPropagation(); onAssign() }}
          className="flex items-center justify-center rounded-lg bg-blue-500/80 hover:bg-blue-500 transition-colors"
          style={{ width: '44px', height: '44px' }}
          aria-label={`Assign ${batch.name} to storyline`}
        >
          <FolderInput className="w-4 h-4 text-white" aria-hidden="true" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="flex items-center justify-center rounded-lg bg-black/60 hover:bg-red-500/80 transition-colors"
          style={{ width: '44px', height: '44px' }}
          aria-label={`Delete character: ${batch.name}`}
        >
          <Trash2 className="w-4 h-4 text-white" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ theme, onCreateStoryline }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 md:py-20 text-center px-4">
      <FolderOpen className="w-16 h-16 mb-4" style={{ color: theme.textMuted, opacity: 0.5 }} aria-hidden="true" />
      <h3 className="text-xl font-medium mb-2" style={{ color: theme.textBody }}>No storylines yet</h3>
      <p className="text-sm mb-4 max-w-xs" style={{ color: theme.textMuted }}>
        Create a storyline to organise your characters
      </p>
      <Button onClick={onCreateStoryline} theme={theme}>
        <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
        Create Storyline
      </Button>
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function NewStorylineModal({ theme, onClose, onCreate }) {
  const [name, setName] = useState('')
  return (
    <Modal theme={theme} onClose={onClose} title="New Storyline">
      <div className="space-y-4">
        <Input label="Storyline Name" value={name} onChange={e => setName(e.target.value)} placeholder="My Story" theme={theme} />
        <Button onClick={() => name.trim() && onCreate(name)} theme={theme} className="w-full" disabled={!name.trim()}>
          Create
        </Button>
      </div>
    </Modal>
  )
}

function AssignStorylineModal({ theme, storylines, currentBatchId, onClose, onAssign }) {
  return (
    <Modal theme={theme} onClose={onClose} title="Assign to Storyline">
      <div className="space-y-2">
        {storylines.map(sl => (
          <button
            key={sl.id}
            onClick={() => onAssign(currentBatchId, sl.id)}
            className="w-full p-3 rounded-lg text-left transition-all hover:opacity-80"
            style={{ minHeight: '52px', background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
          >
            {sl.name}
          </button>
        ))}
        <button
          onClick={() => onAssign(currentBatchId, 'unassign')}
          className="w-full p-3 rounded-lg text-left transition-all hover:opacity-80"
          style={{ minHeight: '52px', background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textMuted }}
        >
          Unassign (remove from folder)
        </button>
      </div>
    </Modal>
  )
}

function ConfirmDeleteModal({ theme, name, type, onClose, onConfirm }) {
  const label       = type === 'storyline' ? 'storyline' : 'character'
  const consequence = type === 'storyline'
    ? 'The storyline folder will be removed. Characters inside will not be deleted.'
    : 'All generated images for this character will be permanently lost.'

  return (
    <Modal theme={theme} onClose={onClose} title="Confirm Delete">
      <div className="space-y-5">
        <div>
          <p className="text-sm mb-1" style={{ color: theme.textBody }}>
            Are you sure you want to delete the {label}{' '}
            <span className="font-semibold" style={{ color: theme.primary }}>"{name}"</span>?
          </p>
          <p className="text-xs" style={{ color: theme.textMuted }}>{consequence}</p>
        </div>
        <div className="flex flex-col md:flex-row-reverse gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center rounded-xl text-sm font-medium hover:opacity-80 transition-all"
            style={{ minHeight: '48px', background: 'linear-gradient(135deg, #9a0c1c, #d80032)', color: 'white' }}
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="flex-1 flex items-center justify-center rounded-xl text-sm hover:opacity-80 transition-all"
            style={{ minHeight: '48px', background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Shared Modal wrapper (bottom sheet on mobile, centered on desktop) ───────
function Modal({ children, theme, onClose, title }) {
  const [dragOffset, setDragOffset] = useState(0)
  const dragStart = { current: 0 }

  const handleTouchStart = e => { dragStart.current = e.touches[0].clientY }
  const handleTouchMove  = e => {
    const dy = e.touches[0].clientY - dragStart.current
    if (dy > 0) setDragOffset(dy)
  }
  const handleTouchEnd = () => {
    if (dragOffset > 80) { setDragOffset(0); onClose() }
    else setDragOffset(0)
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Mobile bottom sheet */}
      <div
        className="bottom-sheet md:hidden absolute bottom-0 left-0 right-0 rounded-t-2xl"
        style={{
          background:    theme.cardBg,
          border:        `1px solid ${theme.cardBorder}`,
          borderBottom:  'none',
          transform:     `translateY(${dragOffset}px)`,
          transition:    dragOffset === 0 ? 'transform 0.3s cubic-bezier(0.32,0.72,0,1)' : 'none',
          paddingBottom: `calc(var(--safe-bottom) + 1rem)`,
          maxHeight:     '80vh',
          overflowY:     'auto',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-2" aria-hidden="true">
          <div className="w-10 h-1 rounded-full" style={{ background: theme.fieldBorder }} />
        </div>
        <div className="px-5 pb-2">
          <h3 className="font-bold mb-4" style={{ fontSize: 'var(--font-size-heading)', color: theme.textBody }}>{title}</h3>
          {children}
        </div>
      </div>

      {/* Desktop centered dialog */}
      <div className="hidden md:flex absolute inset-0 items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl p-6" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex items-center justify-center rounded-lg hover:bg-white/10"
            style={{ minWidth: '44px', minHeight: '44px' }}
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" style={{ color: theme.textMuted }} aria-hidden="true" />
          </button>
          <h3 className="font-bold mb-4" style={{ fontSize: 'var(--font-size-heading)', color: theme.textBody }}>{title}</h3>
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────
function Button({ children, onClick, theme, variant = 'primary', className = '', disabled = false }) {
  let bg, color, border
  if (variant === 'primary') { bg = theme.buttonGradient; color = 'white' }
  else if (variant === 'outline') { bg = 'transparent'; color = theme.textBody; border = `1px solid ${theme.fieldBorder}` }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-4 rounded-xl font-medium transition-all ${className}`}
      style={{ minHeight: '44px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, background: bg, color, border }}
    >
      {children}
    </button>
  )
}

function Input({ label, value, onChange, placeholder, theme }) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="uppercase tracking-widest font-medium mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
          {label}
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 rounded-xl text-sm"
        style={{ height: '44px', background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
      />
    </div>
  )
}
