import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const { theme }     = useTheme()
  const { user }      = useAuth()
  const userId        = user?.id

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

  const [showNewModal,    setShowNewModal]    = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(null)
  const [pendingDelete,   setPendingDelete]   = useState(null)

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
    if (storylineId === 'unassign') await CharacterBatch.assignStoryline(batchId, null)
    else await CharacterBatch.assignStoryline(batchId, storylineId)
    queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
    queryClient.invalidateQueries({ queryKey: ['batches', userId] })
    setShowAssignModal(null)
    toast.success('Character moved')
  }

  return (
    <div className="max-w-6xl mx-auto py-6 md:py-8 px-4">

      {/* Header */}
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
          <p className="text-sm text-base-content/50">
            {storylines.length} storylines • {allBatches.length} characters
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="btn btn-primary btn-sm gap-2"
            style={{ minHeight: '44px' }}
          >
            <Plus className="w-4 h-4" />
            New Storyline
          </button>
          <button
            onClick={() => navigate('/generate')}
            className="btn btn-outline btn-sm gap-2"
            style={{ minHeight: '44px', borderColor: theme.fieldBorder, color: theme.textBody }}
          >
            <ImagePlus className="w-4 h-4" />
            New Character
          </button>
        </div>
      </div>

      {storylines.length === 0 && unassignedBatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <FolderOpen className="w-16 h-16 mb-4 text-base-content/20" />
          <h3 className="text-xl font-medium text-base-content mb-2">No storylines yet</h3>
          <p className="text-sm text-base-content/50 mb-4 max-w-xs">
            Create a storyline to organise your characters
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            className="btn btn-primary gap-2"
            style={{ minHeight: '44px' }}
          >
            <Plus className="w-4 h-4" />
            Create Storyline
          </button>
        </div>
      ) : (
        <>
          {storylines.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest font-medium mb-4 text-base-content/50">
                Storylines
              </h2>
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
              <h2 className="text-xs uppercase tracking-widest font-medium mb-4 text-base-content/50">
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

      {/* Modals */}
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
      style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, aspectRatio: '1 / 1' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-label={`Open storyline: ${storyline.name}`}
    >
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        {previewImages.length > 0 ? (
          previewImages.map((img, i) => (
            <img key={i} src={img.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ))
        ) : (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="w-full h-full flex items-center justify-center bg-base-300">
              <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-base-content/20" />
            </div>
          ))
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
        <div className="font-medium text-white truncate text-sm">{storyline.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <span>{batches.length} characters</span>
          {storyline.storyline_prompt_id && (
            <span className="flex items-center gap-0.5 text-white/80">
              <BookMarked className="w-3 h-3" />
              prompt
            </span>
          )}
        </div>
      </div>

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 pointer-events-none">
        <ChevronRight className="w-10 h-10 text-white" />
      </div>

      <button
        onClick={e => { e.stopPropagation(); onDelete() }}
        className="btn btn-square absolute top-2 left-2 z-10 bg-black/60 hover:bg-error border-none text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        style={{ width: '44px', height: '44px' }}
        aria-label={`Delete storyline: ${storyline.name}`}
      >
        <Trash2 className="w-4 h-4" />
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
      style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, aspectRatio: '1 / 1' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-label={`Open character: ${batch.name}`}
    >
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        {images.length > 0 ? (
          images.map((img, i) => (
            <img key={i} src={img.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ))
        ) : (
          <div className="col-span-2 w-full h-full flex items-center justify-center bg-base-300">
            <Images className="w-10 h-10 md:w-12 md:h-12 text-base-content/20" />
          </div>
        )}
      </div>

      {batch.reference_image_url && (
        <img
          src={batch.reference_image_url} alt="" loading="lazy" decoding="async"
          className="absolute bottom-10 right-2 w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover border-2"
          style={{ borderColor: theme.cardBg }}
        />
      )}

      <div className="absolute inset-x-0 bottom-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
        <div className="font-medium text-white truncate text-sm">{batch.name}</div>
        <div className="text-xs text-white/60">{batch.image_count || 0} images</div>
      </div>

      <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <button
          onClick={e => { e.stopPropagation(); onAssign() }}
          className="btn btn-square btn-info border-none text-white"
          style={{ width: '44px', height: '44px' }}
          aria-label={`Assign ${batch.name} to storyline`}
        >
          <FolderInput className="w-4 h-4" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="btn btn-square bg-black/60 hover:bg-error border-none text-white"
          style={{ width: '44px', height: '44px' }}
          aria-label={`Delete character: ${batch.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function NewStorylineModal({ theme, onClose, onCreate }) {
  const [name, setName] = useState('')
  return (
    <GalleryModal theme={theme} onClose={onClose} title="New Storyline">
      <div className="space-y-4">
        <div>
          <label className="label label-text font-medium pb-1">Storyline Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="My Story"
            className="input input-bordered w-full bg-base-300"
            style={{ minHeight: '44px' }}
            autoFocus
          />
        </div>
        <button
          onClick={() => name.trim() && onCreate(name)}
          disabled={!name.trim()}
          className="btn btn-primary btn-block"
          style={{ minHeight: '44px' }}
        >
          Create
        </button>
      </div>
    </GalleryModal>
  )
}

function AssignStorylineModal({ theme, storylines, currentBatchId, onClose, onAssign }) {
  return (
    <GalleryModal theme={theme} onClose={onClose} title="Assign to Storyline">
      <div className="space-y-2">
        {storylines.map(sl => (
          <button
            key={sl.id}
            onClick={() => onAssign(currentBatchId, sl.id)}
            className="btn btn-ghost w-full justify-start text-left"
            style={{ minHeight: '52px', background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
          >
            {sl.name}
          </button>
        ))}
        <button
          onClick={() => onAssign(currentBatchId, 'unassign')}
          className="btn btn-ghost w-full justify-start text-left text-base-content/50"
          style={{ minHeight: '52px', background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
        >
          Unassign (remove from folder)
        </button>
      </div>
    </GalleryModal>
  )
}

function ConfirmDeleteModal({ theme, name, type, onClose, onConfirm }) {
  const label       = type === 'storyline' ? 'storyline' : 'character'
  const consequence = type === 'storyline'
    ? 'The storyline folder will be removed. Characters inside will not be deleted.'
    : 'All generated images for this character will be permanently lost.'

  return (
    <GalleryModal theme={theme} onClose={onClose} title="Confirm Delete">
      <div className="space-y-5">
        <div>
          <p className="text-sm mb-1 text-base-content">
            Are you sure you want to delete the {label}{' '}
            <span className="font-semibold text-primary">"{name}"</span>?
          </p>
          <p className="text-xs text-base-content/50">{consequence}</p>
        </div>
        <div className="flex flex-col-reverse md:flex-row gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1" style={{ minHeight: '48px' }}>
            Cancel
          </button>
          <button onClick={onConfirm} className="btn btn-error flex-1" style={{ minHeight: '48px' }}>
            Delete
          </button>
        </div>
      </div>
    </GalleryModal>
  )
}

// ─── DaisyUI-based modal (bottom sheet mobile, centered desktop) ──────────────
function GalleryModal({ children, theme, onClose, title }) {
  return (
    <dialog className="modal modal-bottom sm:modal-middle" open>
      <div className="modal-backdrop bg-black/60" onClick={onClose} />
      <div
        className="modal-box"
        style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
      >
        <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3" aria-label="Close">
          <XIcon className="w-4 h-4" />
        </button>
        <h3 className="font-bold text-lg mb-4 text-base-content">{title}</h3>
        {children}
      </div>
    </dialog>
  )
}
