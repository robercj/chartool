import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FolderOpen, Images, Plus, Trash2, FolderInput, ImagePlus,
  BookOpen, ChevronRight, BookMarked, X as XIcon,
  Sparkles, FileText, Copy, Check,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { Storyline, CharacterBatch, GeneratedImage, Character, CharacterDraft } from '../lib/storage'

export default function Gallery() {
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const { theme }     = useTheme()
  const { user }      = useAuth()
  const userId        = user?.id

  // ── Existing queries ────────────────────────────────────────────────────────
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

  // ── Wizard character queries (finalized + drafts) ────────────────────────────
  const { data: wizardCharacters = [] } = useQuery({
    queryKey: ['wizard-characters', userId],
    queryFn:  () => Character.list(userId),
    enabled:  !!userId,
  })
  const { data: wizardDrafts = [] } = useQuery({
    queryKey: ['wizard-drafts', userId],
    queryFn:  () => CharacterDraft.list(userId),
    enabled:  !!userId,
  })

  // Merge finalized + drafts into a unified list, grouped by assigned_story_id.
  // Finalized characters are linked to /characters/:id; drafts to /characters/generate/:id.
  const { assignedWizardChars, unassignedWizardChars } = useMemo(() => {
    const all = [
      ...wizardCharacters.map(c => ({ ...c, isDraft: false })),
      ...wizardDrafts.map(d => ({ ...d, isDraft: true })),
    ]
    const assignedMap = new Map()
    const unassigned  = []
    for (const char of all) {
      if (char.assigned_story_id) {
        const arr = assignedMap.get(char.assigned_story_id) || []
        assignedMap.set(char.assigned_story_id, [...arr, char])
      } else {
        unassigned.push(char)
      }
    }
    return { assignedWizardChars: assignedMap, unassignedWizardChars: unassigned }
  }, [wizardCharacters, wizardDrafts])

  const hasWizardChars = wizardCharacters.length > 0 || wizardDrafts.length > 0

  // ── Existing derived data ────────────────────────────────────────────────────
  const assignedBatchIds  = new Set(storylines.flatMap(sl => sl.batch_ids || []))
  const unassignedBatches = allBatches.filter(b => !assignedBatchIds.has(b.id))

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [showNewModal,    setShowNewModal]    = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(null)
  const [pendingDelete,   setPendingDelete]   = useState(null)

  // Prompt modal (wizard characters)
  const [promptModal,  setPromptModal]  = useState({ isOpen: false, name: '', prompt: '' })
  const [promptCopied, setPromptCopied] = useState(false)

  const openPrompt = (name, prompt) => {
    setPromptCopied(false)
    setPromptModal({ isOpen: true, name, prompt })
  }
  const closePrompt = () => setPromptModal(prev => ({ ...prev, isOpen: false }))
  const copyPrompt  = async () => {
    try {
      await navigator.clipboard.writeText(promptModal.prompt)
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    } catch { toast.error('Failed to copy') }
  }

  // ── Existing handlers ────────────────────────────────────────────────────────
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

  const hasAnyContent = storylines.length > 0 || unassignedBatches.length > 0 || hasWizardChars

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
            {storylines.length} storylines • {allBatches.length} batches •{' '}
            {wizardCharacters.length + wizardDrafts.length} characters
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

      {!hasAnyContent ? (
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
          {/* ── Storylines ────────────────────────────────────────────────── */}
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

          {/* ── Wizard Characters ─────────────────────────────────────────── */}
          {hasWizardChars && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest font-medium mb-4 text-base-content/50">
                Characters
              </h2>

              {/* Assigned characters — grouped by story */}
              {[...assignedWizardChars.entries()].map(([storyId, chars]) => {
                const story = storylines.find(s => s.id === storyId)
                return (
                  <div key={storyId} className="mb-6">
                    <h3 className="text-sm font-medium text-base-content/60 mb-3 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 flex-shrink-0" />
                      {story?.name || 'Unknown Story'}
                      <span className="text-xs text-base-content/30 font-normal">
                        ({chars.length} character{chars.length !== 1 ? 's' : ''})
                      </span>
                    </h3>
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))' }}
                    >
                      {chars.map(char => (
                        <CharacterWizardCard
                          key={`${char.isDraft ? 'draft' : 'char'}-${char.id}`}
                          character={char}
                          theme={theme}
                          onClick={() => navigate(char.isDraft ? `/characters/generate/${char.id}` : `/characters/${char.id}`)}
                          onPromptClick={() => openPrompt(char.character_name || 'Character', char.character_prompt)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Unassigned wizard characters */}
              {unassignedWizardChars.length > 0 && (
                <div>
                  {assignedWizardChars.size > 0 && (
                    <h3 className="text-sm font-medium text-base-content/60 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 flex-shrink-0" />
                      Standalone
                      <span className="text-xs text-base-content/30 font-normal">
                        ({unassignedWizardChars.length} character{unassignedWizardChars.length !== 1 ? 's' : ''})
                      </span>
                    </h3>
                  )}
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))' }}
                  >
                    {unassignedWizardChars.map(char => (
                      <CharacterWizardCard
                        key={`${char.isDraft ? 'draft' : 'char'}-${char.id}`}
                        character={char}
                        theme={theme}
                        onClick={() => navigate(char.isDraft ? `/characters/generate/${char.id}` : `/characters/${char.id}`)}
                        onPromptClick={() => openPrompt(char.character_name || 'Character', char.character_prompt)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Unassigned Character Batches (legacy generation flow) ─────── */}
          {unassignedBatches.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-widest font-medium mb-4 text-base-content/50">
                Character Batches
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

      {/* ── Modals ────────────────────────────────────────────────────────── */}
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

      {/* Character Prompt modal */}
      {promptModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closePrompt}>
          <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
          <div
            className="relative z-10 w-full max-w-2xl rounded-2xl border border-base-300 shadow-2xl flex flex-col max-h-[80vh]"
            style={{ background: theme.cardBg }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-base-content flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Character Prompt
                </h2>
                <p className="text-sm text-base-content/50 mt-0.5">{promptModal.name}</p>
              </div>
              <button onClick={closePrompt} className="btn btn-ghost btn-sm btn-square" aria-label="Close">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="text-sm text-base-content/80 whitespace-pre-wrap font-sans leading-relaxed">
                {promptModal.prompt}
              </pre>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-base-300 flex-shrink-0">
              <button
                onClick={copyPrompt}
                className={`btn btn-sm gap-2 ${promptCopied ? 'btn-success' : 'btn-primary'}`}
              >
                {promptCopied
                  ? <><Check className="w-4 h-4" />Copied!</>
                  : <><Copy className="w-4 h-4" />Copy Prompt</>
                }
              </button>
              <button onClick={closePrompt} className="btn btn-ghost btn-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Wizard Character Card ─────────────────────────────────────────────────────
// Displays a character from either the `characters` (finalized) or
// `character_drafts` (in-progress / draft) table.
function CharacterWizardCard({ character, theme, onClick, onPromptClick }) {
  const name = character.character_name?.trim() || 'Untitled Draft'

  const STATUS = {
    draft:       { label: 'Draft',       cls: 'badge-neutral' },
    in_progress: { label: 'In Progress', cls: 'badge-info'    },
    finalized:   { label: 'Finalized',   cls: 'badge-success' },
  }
  const status = STATUS[character.creation_status] || STATUS.draft

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, aspectRatio: '3 / 4' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-label={`Open character: ${name}`}
    >
      {/* Portrait image or placeholder */}
      {character.generated_image_url ? (
        <img
          src={character.generated_image_url}
          alt={name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-base-300">
          <Sparkles className="w-10 h-10 text-base-content/20" />
        </div>
      )}

      {/* Bottom gradient overlay */}
      <div
        className="absolute inset-x-0 bottom-0 p-3"
        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}
      >
        <div className="font-medium text-white truncate text-sm">{name}</div>
        <div className="mt-1">
          <span className={`badge badge-xs ${status.cls}`}>{status.label}</span>
        </div>
      </div>

      {/* Hover overlay arrow */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 pointer-events-none">
        <ChevronRight className="w-8 h-8 text-white" />
      </div>

      {/* Prompt button — only shown when character_prompt is available */}
      {character.character_prompt && (
        <button
          onClick={e => { e.stopPropagation(); onPromptClick() }}
          className="btn btn-square absolute top-2 right-2 z-10 bg-black/60 hover:bg-primary border-none text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          style={{ width: '36px', height: '36px' }}
          aria-label="View character prompt"
        >
          <FileText className="w-4 h-4" />
        </button>
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
