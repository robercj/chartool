import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  FolderOpen, Images, Plus, Trash2, FolderInput, ImagePlus,
  BookOpen, ChevronRight, BookMarked, X as XIcon,
  Sparkles, FileText, Copy, Check,
  MoreVertical, FolderMinus, CheckSquare,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { Storyline, CharacterBatch, GeneratedImage, Character, CharacterDraft } from '../lib/storage'

// ─── Grid column helper (shared across sections) ──────────────────────────────
const CHAR_GRID = { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 140px), 1fr))' }
const STORY_GRID = { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))' }

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

  // ── Wizard character queries ─────────────────────────────────────────────────
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

  // Merge finalized + drafts; group by assigned_story_id
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

  // ── Legacy batch derived data ────────────────────────────────────────────────
  const assignedBatchIds  = new Set(storylines.flatMap(sl => sl.batch_ids || []))
  const unassignedBatches = allBatches.filter(b => !assignedBatchIds.has(b.id))

  // ── Selection state ──────────────────────────────────────────────────────────
  // selMode: null | 'unassigned' | <storyId>
  const [selMode, setSelMode]   = useState(null)
  const [selIds,  setSelIds]    = useState(new Set())

  // ── Context menu ─────────────────────────────────────────────────────────────
  // Tracks which character card's ⋮ menu is open by character ID
  const [ctxCharId, setCtxCharId] = useState(null)

  // ── Drag and drop ─────────────────────────────────────────────────────────────
  // dragging: { chars: CharObject[] } | null
  const [dragging,        setDragging]        = useState(null)
  const [dragOverStoryId, setDragOverStoryId] = useState(null)

  // ── Story picker ──────────────────────────────────────────────────────────────
  const [showStoryPicker,      setShowStoryPicker]      = useState(false)
  const [pickerChars,          setPickerChars]          = useState([])
  const [pickerSearch,         setPickerSearch]         = useState('')
  const [pickerSelectedStory,  setPickerSelectedStory]  = useState(null)

  // ── Undo ──────────────────────────────────────────────────────────────────────
  // Stored in a ref to avoid stale closures inside toast action callbacks
  const undoRef        = useRef(null)   // { chars, targetStoryId, targetStoryName }
  const undoToastId    = useRef(null)

  // ── Legacy modals ─────────────────────────────────────────────────────────────
  const [showNewModal,    setShowNewModal]    = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(null)  // legacy batch assign
  const [pendingDelete,   setPendingDelete]   = useState(null)

  // ── Prompt modal ──────────────────────────────────────────────────────────────
  const [promptModal,  setPromptModal]  = useState({ isOpen: false, name: '', prompt: '' })
  const [promptCopied, setPromptCopied] = useState(false)

  // ── Keyboard: Escape for modal/menu/selection dismissal ──────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return
      if (showStoryPicker)  { setShowStoryPicker(false); return }
      if (ctxCharId)        { setCtxCharId(null);        return }
      if (selMode)          { exitSelectionMode();        return }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showStoryPicker, ctxCharId, selMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Close context menu on outside click ──────────────────────────────────────
  useEffect(() => {
    if (!ctxCharId) return
    const handler = () => setCtxCharId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [ctxCharId])

  // ── Selection helpers ─────────────────────────────────────────────────────────
  const enterSelectionMode = useCallback((mode) => {
    setSelMode(mode)   // 'unassigned' | storyId
    setSelIds(new Set())
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelMode(null)
    setSelIds(new Set())
  }, [])

  const toggleSel = useCallback((id) => {
    setSelIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        if (next.size === 0) setSelMode(null)   // auto-exit when last deselected
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (!selMode) return
    const chars = selMode === 'unassigned'
      ? unassignedWizardChars
      : (assignedWizardChars.get(selMode) || [])
    setSelIds(new Set(chars.map(c => c.id)))
  }, [selMode, unassignedWizardChars, assignedWizardChars])

  const deselectAll = useCallback(() => setSelIds(new Set()), [])

  // ── Core move operation (assignment AND unassignment) ─────────────────────────
  // targetStoryId = null → move to Standalone (unassign)
  const doMoveChars = useCallback(async (chars, targetStoryId, targetStoryName) => {
    if (!chars || chars.length === 0) return
    const charIds = chars.map(c => c.id)

    // Snapshot pre-action state for undo
    undoRef.current = { chars: chars.map(c => ({ ...c })), targetStoryId, targetStoryName }

    // Optimistic update — update both query caches (safe to touch both; IDs are unique across tables)
    const patch = old => (old || []).map(c =>
      charIds.includes(c.id) ? { ...c, assigned_story_id: targetStoryId } : c
    )
    queryClient.setQueryData(['wizard-characters', userId], patch)
    queryClient.setQueryData(['wizard-drafts',     userId], patch)

    // Exit selection mode immediately
    exitSelectionMode()

    // Toast with 8-second Undo window
    const n   = chars.length
    const msg = targetStoryId
      ? `${n} character${n !== 1 ? 's' : ''} assigned to ${targetStoryName}.`
      : `${n} character${n !== 1 ? 's' : ''} moved to Standalone.`

    if (undoToastId.current) toast.dismiss(undoToastId.current)
    undoToastId.current = toast(msg, {
      duration: 8000,
      action: {
        label: 'Undo',
        // Use ref so the callback always reads current undo state, avoiding stale closures
        onClick: () => {
          const undo = undoRef.current
          if (!undo) return
          undoRef.current = null
          toast.dismiss(undoToastId.current)
          doUndoAction(undo)
        },
      },
    })

    // API calls
    try {
      const draftIds    = chars.filter(c =>  c.isDraft).map(c => c.id)
      const finalIds    = chars.filter(c => !c.isDraft).map(c => c.id)
      await Promise.all([
        draftIds.length ? CharacterDraft.assignBulk(draftIds, targetStoryId) : Promise.resolve(),
        finalIds.length ? Character.assignBulk(finalIds,      targetStoryId) : Promise.resolve(),
      ])
    } catch {
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: ['wizard-characters', userId] })
      queryClient.invalidateQueries({ queryKey: ['wizard-drafts',     userId] })
      if (undoToastId.current) toast.dismiss(undoToastId.current)
      undoRef.current = null
      toast.error('Assignment failed. Please try again.')
    }
  }, [userId, queryClient, exitSelectionMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Defined outside useCallback to avoid dep-cycle with doMoveChars ref trick
  const doUndoAction = async (undo) => {
    const { chars } = undo
    const charIds   = chars.map(c => c.id)

    // Revert each char to its pre-action assigned_story_id (captured in snapshot)
    const revert = old => (old || []).map(c => {
      if (!charIds.includes(c.id)) return c
      const before = chars.find(b => b.id === c.id)
      return { ...c, assigned_story_id: before.assigned_story_id }
    })
    queryClient.setQueryData(['wizard-characters', userId], revert)
    queryClient.setQueryData(['wizard-drafts',     userId], revert)

    try {
      // All chars in a single batch share the same previous state (cross-section multiselect is OOS)
      const prevStoryId = chars[0]?.assigned_story_id ?? null
      const draftIds    = chars.filter(c =>  c.isDraft).map(c => c.id)
      const finalIds    = chars.filter(c => !c.isDraft).map(c => c.id)
      await Promise.all([
        draftIds.length ? CharacterDraft.assignBulk(draftIds, prevStoryId) : Promise.resolve(),
        finalIds.length ? Character.assignBulk(finalIds,      prevStoryId) : Promise.resolve(),
      ])
      toast.success('Undo successful.')
    } catch {
      queryClient.invalidateQueries({ queryKey: ['wizard-characters', userId] })
      queryClient.invalidateQueries({ queryKey: ['wizard-drafts',     userId] })
      toast.error('Undo failed. Please try again.')
    }
  }

  // ── Drag and drop ─────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e, char) => {
    // Drag all selected unassigned chars if the dragged card is part of the selection
    const charsToDrag = (selMode === 'unassigned' && selIds.has(char.id))
      ? unassignedWizardChars.filter(c => selIds.has(c.id))
      : [char]

    setDragging({ chars: charsToDrag, fromSelection: selMode === 'unassigned' && selIds.has(char.id) })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', 'wizard-char-drag')

    // Custom drag ghost for multi-char drag
    if (charsToDrag.length > 1) {
      const ghost = document.createElement('div')
      ghost.style.cssText = `position:fixed;top:-200px;left:-200px;background:#1a1a2e;
        color:white;padding:5px 12px;border-radius:20px;font-size:13px;font-weight:600;
        border:1px solid #E94560;pointer-events:none;white-space:nowrap;`
      ghost.textContent = `${charsToDrag.length} characters`
      document.body.appendChild(ghost)
      e.dataTransfer.setDragImage(ghost, 60, 20)
      setTimeout(() => ghost.parentNode?.removeChild(ghost), 0)
    }
  }, [selMode, selIds, unassignedWizardChars])

  const handleDragEnd = useCallback(() => {
    setDragging(null)
    setDragOverStoryId(null)
  }, [])

  const handleStoryDragOver = useCallback((e, storyId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverStoryId !== storyId) setDragOverStoryId(storyId)
  }, [dragOverStoryId])

  const handleStoryDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverStoryId(null)
  }, [])

  const handleStoryDrop = useCallback((e, storyline) => {
    e.preventDefault()
    setDragOverStoryId(null)
    if (!dragging?.chars?.length) return
    const chars = dragging.chars
    const fromSel = dragging.fromSelection
    setDragging(null)
    if (fromSel) exitSelectionMode()
    doMoveChars(chars, storyline.id, storyline.name)
  }, [dragging, doMoveChars, exitSelectionMode])

  // ── Story Picker ──────────────────────────────────────────────────────────────
  const openStoryPicker = useCallback((chars) => {
    setPickerChars(chars)
    setPickerSearch('')
    setPickerSelectedStory(null)
    setShowStoryPicker(true)
  }, [])

  const confirmPickerAssign = useCallback(() => {
    if (!pickerSelectedStory || !pickerChars.length) return
    const story = storylines.find(s => s.id === pickerSelectedStory)
    doMoveChars(pickerChars, pickerSelectedStory, story?.name || 'Story')
    setShowStoryPicker(false)
  }, [pickerSelectedStory, pickerChars, storylines, doMoveChars])

  // ── Context menu action dispatch ──────────────────────────────────────────────
  const handleCtxAction = useCallback((action, char) => {
    setCtxCharId(null)
    switch (action) {
      case 'assign':
        openStoryPicker([char])
        break
      case 'remove':
        doMoveChars([char], null, 'Standalone')
        break
      case 'select':
        setSelMode(char.assigned_story_id || 'unassigned')
        setSelIds(new Set([char.id]))
        break
      case 'view':
        navigate(char.isDraft ? `/characters/generate/${char.id}` : `/characters/${char.id}`)
        break
      case 'prompt':
        openPrompt(char.character_name || 'Character', char.character_prompt)
        break
      case 'delete':
        setPendingDelete({ type: 'character', id: char.id, isDraft: char.isDraft, name: char.character_name || 'Untitled Draft' })
        break
      default: break
    }
  }, [openStoryPicker, doMoveChars, navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Legacy handlers (unchanged) ───────────────────────────────────────────────
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
  const handleDeleteCharacter = async (id) => {
    try {
      await CharacterDraft.delete(id)
      queryClient.invalidateQueries({ queryKey: ['wizard-drafts', userId] })
      toast.success('Character deleted')
    } catch {
      toast.error('Failed to delete character')
    }
  }
  const handleConfirmDelete = () => {
    if (!pendingDelete) return
    if      (pendingDelete.type === 'storyline')  handleDeleteStoryline(pendingDelete.id)
    else if (pendingDelete.type === 'batch')      handleDeleteBatch(pendingDelete.id)
    else if (pendingDelete.type === 'character')  handleDeleteCharacter(pendingDelete.id)
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

  // ── Prompt modal helpers ──────────────────────────────────────────────────────
  const openPrompt  = (name, prompt) => { setPromptCopied(false); setPromptModal({ isOpen: true, name, prompt }) }
  const closePrompt = () => setPromptModal(prev => ({ ...prev, isOpen: false }))
  const copyPrompt  = async () => {
    try {
      await navigator.clipboard.writeText(promptModal.prompt)
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    } catch { toast.error('Failed to copy') }
  }

  const hasAnyContent = storylines.length > 0 || unassignedBatches.length > 0 || hasWizardChars

  // ── Derived selection helpers ─────────────────────────────────────────────────
  const selCount = selIds.size
  const getSelChars = (mode) => {
    if (mode === 'unassigned') return unassignedWizardChars.filter(c => selIds.has(c.id))
    return (assignedWizardChars.get(mode) || []).filter(c => selIds.has(c.id))
  }

  // ── Context menu items per section ────────────────────────────────────────────
  const unassignedCtxItems = (char) => [
    { key: 'assign',  label: 'Assign to Story',  icon: FolderInput  },
    { key: 'select',  label: 'Select',           icon: CheckSquare  },
    { key: 'view',    label: 'View Character',   icon: ChevronRight },
    ...(char.character_prompt  ? [{ key: 'prompt', label: 'View Prompt', icon: FileText }] : []),
    ...(char.isDraft            ? [{ key: 'delete', label: 'Delete',      icon: Trash2, danger: true }] : []),
  ]
  // Filtered stories for picker search
  const filteredStoriesForPicker = storylines.filter(s =>
    !pickerSearch || s.name.toLowerCase().includes(pickerSearch.toLowerCase())
  )

  // ── Render ────────────────────────────────────────────────────────────────────
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
          {/* ── Storylines ─────────────────────────────────────────────── */}
          {storylines.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest font-medium mb-4 text-base-content/50">
                Storylines
              </h2>
              <div className="grid gap-4" style={STORY_GRID}>
                {storylines.map(sl => (
                  <StorylineCard
                    key={sl.id}
                    storyline={sl}
                    theme={theme}
                    dragActive={!!dragging}
                    isDragOver={dragOverStoryId === sl.id}
                    onDragOver={e => handleStoryDragOver(e, sl.id)}
                    onDragLeave={handleStoryDragLeave}
                    onDrop={e => handleStoryDrop(e, sl)}
                    onClick={() => navigate(`/storyline?id=${sl.id}`)}
                    onDelete={() => setPendingDelete({ type: 'storyline', id: sl.id, name: sl.name })}
                    assignedChars={assignedWizardChars.get(sl.id) || []}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Standalone Characters (unassigned only) ─────────────────── */}
          {hasWizardChars && (
            <div className="mb-8">
              <h2 className="text-xs uppercase tracking-widest font-medium mb-4 text-base-content/50">
                Standalone Characters
              </h2>

              {/* Standalone (unassigned wizard characters) */}
              <div>
                {/* Section sub-header */}
                {selMode === 'unassigned' ? (
                  <SelectionToolbar
                    count={selCount}
                    total={unassignedWizardChars.length}
                    actionLabel="Assign to Story"
                    actionIcon={FolderInput}
                    onSelectAll={selectAll}
                    onDeselectAll={deselectAll}
                    onAction={() => openStoryPicker(getSelChars('unassigned'))}
                    onCancel={exitSelectionMode}
                  />
                ) : (
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-base-content/60 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 flex-shrink-0" />
                      <span className="text-xs text-base-content/30 font-normal">
                        {unassignedWizardChars.length} character{unassignedWizardChars.length !== 1 ? 's' : ''}
                      </span>
                    </h3>
                    {unassignedWizardChars.length > 0 && (
                      <button
                        onClick={() => enterSelectionMode('unassigned')}
                        className="btn btn-ghost btn-xs gap-1.5 text-base-content/50 hover:text-base-content"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Select
                      </button>
                    )}
                  </div>
                )}

                {/* Empty state when all characters are assigned */}
                {unassignedWizardChars.length === 0 && assignedWizardChars.size > 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-base-300">
                    <Check className="w-8 h-8 mb-3 text-success/60" />
                    <p className="text-sm font-medium text-base-content/60">All characters are assigned to a story.</p>
                    <p className="text-xs text-base-content/40 mt-1">Create a new character or use "Remove from Story" to unassign one.</p>
                  </div>
                ) : (
                  <div className="grid gap-3" style={CHAR_GRID}>
                    {unassignedWizardChars.map(char => (
                      <CharacterWizardCard
                        key={`${char.isDraft ? 'draft' : 'char'}-${char.id}`}
                        character={char}
                        theme={theme}
                        selectable={selMode === 'unassigned'}
                        isSelected={selMode === 'unassigned' && selIds.has(char.id)}
                        onSelect={() => toggleSel(char.id)}
                        ctxOpen={ctxCharId === char.id}
                        onCtxOpen={e => { e.stopPropagation(); setCtxCharId(ctxCharId === char.id ? null : char.id) }}
                        ctxItems={unassignedCtxItems(char)}
                        onCtxAction={action => handleCtxAction(action, char)}
                        onPromptClick={() => openPrompt(char.character_name || 'Character', char.character_prompt)}
                        draggable={true}
                        isBeingDragged={!!dragging?.chars.some(c => c.id === char.id)}
                        onDragStart={e => handleDragStart(e, char)}
                        onDragEnd={handleDragEnd}
                        onClick={() => navigate(char.isDraft ? `/characters/generate/${char.id}` : `/characters/${char.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Character Batches (legacy generation flow) ──────────────── */}
          {unassignedBatches.length > 0 && (
            <div>
              <h2 className="text-xs uppercase tracking-widest font-medium mb-4 text-base-content/50">
                Character Batches
              </h2>
              <div className="grid gap-4" style={STORY_GRID}>
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

      {/* ── Modals ─────────────────────────────────────────────────────── */}
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
      {showStoryPicker && (
        <StoryPickerModal
          theme={theme}
          storylines={storylines}
          assignedWizardChars={assignedWizardChars}
          pickerChars={pickerChars}
          search={pickerSearch}
          onSearchChange={setPickerSearch}
          filteredStories={filteredStoriesForPicker}
          selectedStoryId={pickerSelectedStory}
          onSelectStory={setPickerSelectedStory}
          onConfirm={confirmPickerAssign}
          onClose={() => setShowStoryPicker(false)}
          onCreateStory={() => { setShowStoryPicker(false); setShowNewModal(true) }}
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

// ─── Selection Toolbar ────────────────────────────────────────────────────────
// Renders at the top of a character section when selection mode is active.
function SelectionToolbar({ count, total, actionLabel, actionIcon: ActionIcon, onSelectAll, onDeselectAll, onAction, onCancel }) {
  return (
    <div
      className="flex flex-wrap items-center gap-2 mb-3 p-3 rounded-xl border border-primary/30 bg-primary/5"
      aria-live="polite"
    >
      <span className="text-sm font-medium text-base-content min-w-[80px]">
        {count} selected
      </span>
      <button onClick={onSelectAll}   className="btn btn-ghost btn-xs">Select All ({total})</button>
      <button onClick={onDeselectAll} className="btn btn-ghost btn-xs" disabled={count === 0}>Deselect All</button>
      <button
        onClick={onAction}
        disabled={count === 0}
        className="btn btn-primary btn-xs gap-1.5 ml-auto"
      >
        {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
        {actionLabel}
      </button>
      <button onClick={onCancel} className="btn btn-ghost btn-xs">Cancel</button>
    </div>
  )
}

// ─── Wizard Character Card ────────────────────────────────────────────────────
// Outer wrapper has no overflow:hidden so context menu and checkbox
// can escape card boundaries. Inner card clips image to rounded corners.
function CharacterWizardCard({
  character, theme, onClick, onPromptClick,
  selectable, isSelected, onSelect,
  ctxOpen, onCtxOpen, ctxItems, onCtxAction,
  draggable: isDraggable, isBeingDragged, onDragStart, onDragEnd,
}) {
  const name   = character.character_name?.trim() || 'Untitled Draft'
  // §3.1 — amber "Draft" for incomplete, muted "Complete" for finalized
  const STATUS = {
    draft:       { label: 'Draft',    cls: 'bg-amber-500 text-black'            },
    in_progress: { label: 'Draft',    cls: 'bg-amber-500 text-black'            },
    finalized:   { label: 'Complete', cls: 'bg-base-content/20 text-base-content/70' },
  }
  const status = STATUS[character.creation_status] || STATUS.draft

  return (
    // Outer wrapper: provides positioning context for checkbox + context menu
    // group class here so both inner card and outer buttons react to hover
    <div className="relative group" style={{ aspectRatio: '3 / 4' }}>

      {/* Checkbox — top-left, outside overflow-hidden */}
      {selectable && (
        <div
          className="absolute top-2 left-2 z-30"
          onClick={e => { e.stopPropagation(); onSelect?.() }}
        >
          <input
            type="checkbox"
            readOnly
            checked={isSelected}
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`${name} — select for assignment`}
            className="checkbox checkbox-primary checkbox-sm shadow-md cursor-pointer"
            onClick={e => { e.stopPropagation(); onSelect?.() }}
          />
        </div>
      )}

      {/* Inner card — overflow hidden for image clipping */}
      <div
        className="absolute inset-0 rounded-2xl overflow-hidden cursor-pointer"
        style={{
          background:    theme.cardBg,
          border:        isSelected ? '2px solid oklch(var(--p))' : `1px solid ${theme.cardBorder}`,
          opacity:       isBeingDragged ? 0.4 : 1,
          transition:    'opacity 0.2s, border-color 0.15s',
        }}
        onClick={selectable ? (e => { e.stopPropagation(); onSelect?.() }) : onClick}
        onKeyDown={e => {
          if (e.key === 'Enter') onClick?.()
          if (e.key === ' ' && selectable) { e.preventDefault(); onSelect?.() }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open character: ${name}`}
        draggable={isDraggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
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
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
        </div>
        </div>

        {/* Hover arrow */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
          <ChevronRight className="w-8 h-8 text-white" />
        </div>
      </div>

      {/* ⋮ Context menu button — outside overflow-hidden, top-right */}
      <button
        onClick={onCtxOpen}
        className="absolute top-2 right-2 z-30 flex items-center justify-center rounded-lg bg-black/60 hover:bg-primary border-none text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        style={{ width: '32px', height: '32px' }}
        aria-label={`Options for ${name}`}
        aria-haspopup="menu"
        aria-expanded={ctxOpen}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Context menu dropdown — outside overflow-hidden, below ⋮ button */}
      {ctxOpen && ctxItems && (
        <div
          className="absolute top-10 right-2 z-50 min-w-[168px] rounded-xl border shadow-2xl overflow-hidden"
          style={{ background: theme.cardBg, borderColor: theme.cardBorder }}
          role="menu"
          onClick={e => e.stopPropagation()}
        >
          {ctxItems.map(item => (
            <button
              key={item.key}
              role="menuitem"
              onClick={() => onCtxAction(item.key)}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-left transition-colors ${
                item.danger
                  ? 'text-error hover:bg-error/10'
                  : 'text-base-content hover:bg-base-200'
              }`}
            >
              {item.icon && <item.icon className="w-4 h-4 flex-shrink-0 opacity-70" />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Storyline Card ────────────────────────────────────────────────────────────
function StorylineCard({ storyline, theme, onClick, onDelete, dragActive, isDragOver, onDragOver, onDragLeave, onDrop, assignedChars }) {
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

  // Live character count derived from assigned wizard characters
  const charCount = assignedChars.length

  // Portrait thumbnails: prefer legacy batch previews, fall back to wizard char images
  const charPortraits = assignedChars
    .filter(c => c.generated_image_url)
    .slice(0, 4)
    .map(c => c.generated_image_url)

  // Drop zone border styling during an active drag
  const dropBorderStyle = dragActive
    ? isDragOver
      ? { border: `2px solid #E94560`, boxShadow: '0 0 0 4px rgba(233,69,96,0.2)' }
      : { border: `1px solid rgba(233,69,96,0.4)`, animation: 'pulse 2s infinite' }
    : {}

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}`, aspectRatio: '1 / 1', ...dropBorderStyle, transition: 'border 0.15s, box-shadow 0.15s' }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onClick()}
      aria-label={`Open storyline: ${storyline.name}`}
      aria-dropeffect={dragActive ? 'move' : undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
        {previewImages.length > 0 ? (
          // Legacy batch images
          previewImages.map((img, i) => (
            <img key={i} src={img.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
          ))
        ) : charPortraits.length > 0 ? (
          // Wizard character portrait thumbnails
          Array(4).fill(0).map((_, i) => (
            charPortraits[i] ? (
              <img key={i} src={charPortraits[i]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <div key={i} className="w-full h-full flex items-center justify-center bg-base-300">
                <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-base-content/20" />
              </div>
            )
          ))
        ) : (
          // No images at all — placeholder grid
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="w-full h-full flex items-center justify-center bg-base-300">
              <BookOpen className="w-6 h-6 md:w-8 md:h-8 text-base-content/20" />
            </div>
          ))
        )}
      </div>

      {/* "Drop to assign" overlay — shown when hovering during drag */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/20 z-10">
          <div className="bg-primary text-primary-content text-sm font-semibold px-4 py-2 rounded-xl shadow-lg">
            Drop to assign
          </div>
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-3" style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>
        <div className="font-medium text-white truncate text-sm">{storyline.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <span>{charCount} character{charCount !== 1 ? 's' : ''}</span>
          {storyline.storyline_prompt_id && (
            <span className="flex items-center gap-0.5 text-white/80">
              <BookMarked className="w-3 h-3" />
              prompt
            </span>
          )}
        </div>
      </div>

      {!isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 pointer-events-none">
          <ChevronRight className="w-10 h-10 text-white" />
        </div>
      )}

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

// ─── Story Picker Modal ───────────────────────────────────────────────────────
function StoryPickerModal({
  theme, storylines, assignedWizardChars, pickerChars,
  search, onSearchChange, filteredStories,
  selectedStoryId, onSelectStory, onConfirm, onClose, onCreateStory,
}) {
  const n = pickerChars.length
  // Auto-focus search on open
  const searchRef = useRef(null)
  useEffect(() => { searchRef.current?.focus() }, [])

  return (
    <GalleryModal theme={theme} onClose={onClose} title="Assign to Story">
      <p className="text-sm text-base-content/50 -mt-2 mb-4">
        {n} character{n !== 1 ? 's' : ''} selected
      </p>

      {/* Search */}
      <input
        ref={searchRef}
        type="text"
        value={search}
        onChange={e => onSearchChange(e.target.value)}
        placeholder="Search stories..."
        className="input input-bordered w-full bg-base-300 mb-3"
        style={{ minHeight: '44px' }}
        aria-label="Filter stories by name"
      />

      {/* Story list */}
      <div
        className="space-y-1 overflow-y-auto"
        style={{ maxHeight: '280px' }}
        role="listbox"
        aria-label="Available stories"
      >
        {storylines.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-base-content/50 mb-3">
              No stories yet. Create a story first, then return to assign your characters.
            </p>
            <button onClick={onCreateStory} className="btn btn-primary btn-sm">
              <Plus className="w-4 h-4 mr-1" />
              Create Story
            </button>
          </div>
        ) : filteredStories.length === 0 ? (
          <p className="text-sm text-base-content/40 text-center py-6">
            No stories match &ldquo;{search}&rdquo;.
          </p>
        ) : (
          filteredStories.map(story => {
            const count     = assignedWizardChars.get(story.id)?.length || 0
            const isSelected = selectedStoryId === story.id
            return (
              <button
                key={story.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelectStory(story.id)}
                className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-colors ${
                  isSelected ? 'bg-primary/20 border border-primary/50' : 'hover:bg-base-200 border border-transparent'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-base-300 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-base-content/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-base-content truncate">{story.name}</p>
                  <p className="text-xs text-base-content/40">
                    {count === 0 ? 'Empty' : `${count} character${count !== 1 ? 's' : ''}`}
                  </p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </button>
            )
          })
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-4">
        <button onClick={onClose} className="btn btn-ghost flex-1" style={{ minHeight: '44px' }}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!selectedStoryId}
          className="btn btn-primary flex-1 gap-2"
          style={{ minHeight: '44px' }}
        >
          <FolderInput className="w-4 h-4" />
          Assign
        </button>
      </div>
    </GalleryModal>
  )
}

// ─── Legacy modals (unchanged) ────────────────────────────────────────────────
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
  const label = type === 'storyline' ? 'storyline' : type === 'character' ? 'character' : 'character'
  const consequence =
    type === 'storyline'
      ? 'The storyline folder will be removed. Characters inside will not be deleted.'
      : type === 'character'
      ? 'The character draft and all associated data will be permanently removed.'
      : 'All generated images for this character will be permanently lost.'

  return (
    <GalleryModal theme={theme} onClose={onClose} title="Confirm Delete">
      <div className="space-y-5">
        <div>
          <p className="text-sm mb-1 text-base-content">
            Are you sure you want to delete the {label}{' '}
            <span className="font-semibold text-primary">&ldquo;{name}&rdquo;</span>?
          </p>
          <p className="text-xs text-base-content/50">{consequence}</p>
        </div>
        <div className="flex flex-col-reverse md:flex-row gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1" style={{ minHeight: '48px' }}>Cancel</button>
          <button onClick={onConfirm} className="btn btn-error flex-1" style={{ minHeight: '48px' }}>Delete</button>
        </div>
      </div>
    </GalleryModal>
  )
}

function GalleryModal({ children, theme, onClose, title }) {
  return (
    <dialog className="modal modal-bottom sm:modal-middle" open>
      <div className="modal-backdrop bg-black/60" onClick={onClose} />
      <div
        className="modal-box"
        style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
        role="dialog"
        aria-modal="true"
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
