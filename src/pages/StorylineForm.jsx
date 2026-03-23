import { useState, useEffect, useRef, forwardRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Trash2, ArrowLeft, BookMarked, ChevronDown, ChevronUp,
  Loader2, FolderPlus, FolderOpen, X as XIcon,
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useProgress } from '../contexts/ProgressContext'
import { useAuth } from '../contexts/AuthContext'
import { StorylinePrompt, Storyline } from '../lib/storage'
import { callStorylineAPI } from '../lib/anthropic'

// ─── Constants ────────────────────────────────────────────────────────────────
const GENRES = [
  'Isekai', 'Shonen', 'Seinen', 'Fantasy', 'Sci-fi',
  'Urban fantasy', 'Dark fantasy', 'Romance', 'Political intrigue', 'Cultivation',
]

const STRUCTURAL_OVERLAYS = [
  'Underdog ascension', 'Fish out of water', 'Anti-hero', 'Tournament / gauntlet',
]

const GROWTH_MECHANISMS = [
  'Emotional catalysts', 'Combat / conflict', 'Bonds / relationships',
  'Accumulation / XP', 'Self-revelation', 'Other',
]

const FIRST_HOOK_TYPES = [
  'Confrontation', 'Revelation', 'Betrayal hint', 'Power horizon',
  'Countdown', 'Impossible choice',
]

const MORAL_COMPLEXITY_LABELS = {
  1: 'Minimal', 2: 'Low', 3: 'Moderate', 4: 'High', 5: 'Constant',
}

const BOND_TYPES = [
  'Loyal subordinate', 'Rival respect', 'Protective affection',
  'Fated connection', 'Reluctant alliance',
]

const TOKEN_TIERS = [
  { id: 'lite',     label: 'Lite',     subtitle: 'Quick reference, ~4,000 tokens or less', tokens: 4000  },
  { id: 'standard', label: 'Standard', subtitle: 'Balanced detail, 4,000–8,000 tokens',    tokens: 8000  },
  { id: 'rich',     label: 'Rich',     subtitle: 'Full depth, no practical limit',          tokens: 16000 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function createNPC() {
  return {
    id: crypto.randomUUID(),
    name: '', role: '', surface_vs_internal: '',
    relationship_vector: '', cross_connection: '', bond_type: null,
  }
}

function createFaction() {
  return {
    id: crypto.randomUUID(),
    name: '', purpose: '', stance_toward_protagonist: '', moral_complexity: '',
  }
}

function parseModelSections(text) {
  const sectionAStart = text.search(/SECTION A\s*[—–-]/i)
  const sectionBStart = text.search(/SECTION B\s*[—–-]/i)
  const sectionCStart = text.search(/SECTION C\s*[—–-]/i)

  if (sectionAStart === -1 && sectionBStart === -1) {
    return { sectionA: '', sectionB: '', sectionC: '', raw: text, parsed: false }
  }

  const lineEnd = (pos) => {
    const idx = text.indexOf('\n', pos)
    return idx === -1 ? pos : idx + 1
  }

  const aContentStart = sectionAStart !== -1 ? lineEnd(sectionAStart) : 0
  const bContentStart = sectionBStart !== -1 ? lineEnd(sectionBStart) : text.length
  const cContentStart = sectionCStart !== -1 ? lineEnd(sectionCStart) : text.length

  const sectionA = sectionAStart !== -1
    ? text.slice(aContentStart, sectionBStart !== -1 ? sectionBStart : text.length).trim()
    : ''
  const sectionB = sectionBStart !== -1
    ? text.slice(bContentStart, sectionCStart !== -1 ? sectionCStart : text.length).trim()
    : ''
  const sectionC = sectionCStart !== -1
    ? text.slice(cContentStart).trim()
    : ''

  const clean = (s) => s.replace(/^---\s*\n?/m, '').replace(/\n?---\s*$/m, '').trim()

  return {
    sectionA: clean(sectionA),
    sectionB: clean(sectionB),
    sectionC: clean(sectionC),
    raw: text,
    parsed: true,
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StorylineForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { theme } = useTheme()
  const { startProgress, setProgressLabel, clearProgress } = useProgress()
  const { user } = useAuth()
  const userId = user?.id

  // ── Folder assignment state ────────────────────────────────────────────────
  const [folderMode, setFolderMode] = useState('new')
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState('')

  // ── URL params ────────────────────────────────────────────────────────────
  const [searchParams] = useSearchParams()
  const preselectedFolderId = searchParams.get('folderId')

  // Query for preselected folder validation
  const { data: preselectedFolder } = useQuery({
    queryKey: ['storyline', preselectedFolderId],
    queryFn: () => Storyline.get(preselectedFolderId),
    enabled: !!preselectedFolderId,
  })

  // Pre-select folder when preselectedFolderId is provided and query completes
  useEffect(() => {
    if (preselectedFolderId && preselectedFolder) {
      setFolderMode('existing')
      setSelectedFolderId(preselectedFolderId)
    }
  }, [preselectedFolderId, preselectedFolder])

  // ── Section A state ────────────────────────────────────────────────────────
  const [genres, setGenres] = useState([])
  const [openingSituation, setOpeningSituation] = useState('')
  const [protagonistName, setProtagonistName] = useState('')
  const [protagonistStatus, setProtagonistStatus] = useState('')
  const [appearanceMask, setAppearanceMask] = useState('')
  const [appearanceTrueForm, setAppearanceTrueForm] = useState('')
  const [abilitiesCurrent, setAbilitiesCurrent] = useState('')
  const [growthMechanism, setGrowthMechanism] = useState('')
  const [growthOther, setGrowthOther] = useState('')
  const [unknownToSelf, setUnknownToSelf] = useState('')
  const [npcs, setNpcs] = useState([createNPC()])
  const [factions, setFactions] = useState([createFaction()])
  const [powerHierarchy, setPowerHierarchy] = useState('')
  const [forbiddenPower, setForbiddenPower] = useState('')
  const [worldEquilibrium, setWorldEquilibrium] = useState('')

  // ── Section B state ────────────────────────────────────────────────────────
  const [overlays, setOverlays] = useState([])
  const [powerFantasyRatio, setPowerFantasyRatio] = useState(60)
  const [firstHookType, setFirstHookType] = useState('')
  const [moralComplexityLevel, setMoralComplexityLevel] = useState(3)
  const [additionalProhibitions, setAdditionalProhibitions] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')

  // ── UI state ───────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState({})
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [tokenTier, setTokenTier] = useState('standard')
  const [generating, setGenerating] = useState(false)

  // Existing storylines for the picker
  const { data: storylines = [] } = useQuery({
    queryKey: ['storylines', userId],
    queryFn: () => Storyline.list(userId),
    enabled: !!userId,
  })

  // Validate preselected folder exists in user's storylines
  useEffect(() => {
    if (preselectedFolderId && storylines.length > 0) {
      const validFolder = storylines.find(s => s.id === preselectedFolderId)
      if (!validFolder) {
        toast.error('Storyline folder not found')
        navigate('/storyline/new', { replace: true })
      }
    }
  }, [preselectedFolderId, storylines, navigate])

  // Refs for scroll-to-error
  const fieldRefs = {
    folder:            useRef(null),
    genres:            useRef(null),
    openingSituation:  useRef(null),
    protagonistStatus: useRef(null),
    abilitiesCurrent:  useRef(null),
    npcs:              useRef(null),
    factions:          useRef(null),
  }

  // ─── NPC helpers ──────────────────────────────────────────────────────────
  const updateNPC   = (id, patch) => setNpcs(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
  const addNPC      = () => setNpcs(prev => [...prev, createNPC()])
  const removeNPC   = (id) => { if (npcs.length > 1) setNpcs(prev => prev.filter(n => n.id !== id)) }

  // ─── Faction helpers ──────────────────────────────────────────────────────
  const updateFaction = (id, patch) => setFactions(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  const addFaction    = () => setFactions(prev => [...prev, createFaction()])
  const removeFaction = (id) => { if (factions.length > 1) setFactions(prev => prev.filter(f => f.id !== id)) }

  // ─── Validation ───────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {}

    if (folderMode === 'new' && !newFolderName.trim()) {
      errs.folder = 'Enter a story name to create a folder.'
    } else if (folderMode === 'existing' && !selectedFolderId) {
      errs.folder = 'Select an existing storyline folder.'
    }

    if (genres.length === 0) errs.genres = 'Select at least one genre.'
    if (!openingSituation.trim()) errs.openingSituation = 'Opening situation is required.'

    return errs
  }

  const handleReviewGenerate = () => {
    const errs = validate()
    setErrors(errs)

    if (Object.keys(errs).length > 0) {
      const firstKey = Object.keys(errs)[0]
      const ref = fieldRefs[firstKey]
      if (ref?.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setShowConfirmModal(true)
  }

  // ─── Payload builder ──────────────────────────────────────────────────────
  const buildPayload = () => ({
    section_a: {
      opening_situation: openingSituation,
      protagonist: {
        name:                protagonistName || null,
        status:              protagonistStatus,
        appearance_mask:     appearanceMask || null,
        appearance_true_form: appearanceTrueForm || null,
        abilities_current:   abilitiesCurrent,
        growth_mechanism:    growthMechanism === 'Other' ? growthOther || 'Other' : growthMechanism || null,
        unknown_to_self:     unknownToSelf || null,
      },
      npcs: npcs.map(n => ({
        name:                n.name,
        role:                n.role,
        surface_vs_internal: n.surface_vs_internal,
        relationship_vector: n.relationship_vector || null,
        cross_connection:    n.cross_connection || null,
        bond_type:           n.bond_type || null,
      })),
      factions: factions.map(f => ({
        name:                      f.name,
        purpose:                   f.purpose,
        stance_toward_protagonist: f.stance_toward_protagonist || null,
        moral_complexity:          f.moral_complexity || null,
      })),
      power_hierarchy:  powerHierarchy || null,
      forbidden_power:  forbiddenPower || null,
      world_equilibrium: worldEquilibrium || null,
    },
    section_b: {
      genres,
      structural_overlays:    overlays,
      power_fantasy_ratio:    powerFantasyRatio,
      first_hook_type:        firstHookType || null,
      moral_complexity_level: MORAL_COMPLEXITY_LABELS[moralComplexityLevel],
      additional_prohibitions: additionalProhibitions || null,
      additional_context:     additionalContext || null,
    },
  })

  // ─── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setShowConfirmModal(false)
    setGenerating(true)

    const tier = TOKEN_TIERS.find(t => t.id === tokenTier)
    const payload = buildPayload()

    let folderDisplayName = ''
    if (folderMode === 'new') {
      folderDisplayName = newFolderName.trim()
    } else {
      folderDisplayName = storylines.find(sl => sl.id === selectedFolderId)?.name || 'Selected Folder'
    }

    startProgress('Analyzing form data…', null, '/storyline/new')

    try {
      setProgressLabel('Generating Prompt Plot…')
      const rawText = await callStorylineAPI({ formPayload: payload, maxTokens: tier.tokens })

      setProgressLabel('Generating Prompt Guidelines…')
      const parsed = parseModelSections(rawText)

      setProgressLabel('Generating AI Reminders…')
      const saved = await StorylinePrompt.create(userId, {
        raw_response: rawText,
        section_a:    parsed.sectionA,
        section_b:    parsed.sectionB,
        section_c:    parsed.sectionC,
        form_payload: payload,
        token_tier:   tokenTier,
      })

      setProgressLabel(`Saving to ${folderDisplayName} in Storyline Gallery…`)

      if (folderMode === 'new') {
        await Storyline.create(userId, {
          name:                  folderDisplayName,
          storyline_art_style:   null,
          storyline_prompt_id:   saved.id,
          storyline_metadata:    {
            genres,
            protagonist_status: protagonistStatus || null,
            overlays,
            token_tier:         tokenTier,
          },
        })
      } else {
        await Storyline.update(selectedFolderId, {
          storyline_prompt_id: saved.id,
          storyline_metadata: {
            genres,
            protagonist_status: protagonistStatus || null,
            overlays,
            token_tier:        tokenTier,
          },
        })
      }

      queryClient.invalidateQueries({ queryKey: ['storylines', userId] })

      setProgressLabel('Completed')
      await new Promise(r => setTimeout(r, 800))
      clearProgress()

      navigate(`/storyline/result/${saved.id}`)
    } catch (err) {
      clearProgress()
      toast.error(`Generation failed: ${err.message}`)
    } finally {
      setGenerating(false)
    }
  }

  // ─── Chip toggle helpers ──────────────────────────────────────────────────
  const toggleMulti = (setter, value) =>
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    /* Outer wrapper: responsive container, max-width 720px on desktop */
    <div className="w-full mx-auto py-6 md:py-8 px-4 md:px-6 min-w-0" style={{ maxWidth: '720px', overflowX: 'hidden' }}>

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 md:mb-8">
        <button
          onClick={() => navigate(-1)}
          className="btn btn-ghost btn-sm flex-shrink-0"
          aria-label="Go back"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <ArrowLeft className="w-5 h-5" style={{ color: theme.textMuted }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1
            className="font-bold mb-1"
            style={{
              fontSize:               'var(--font-size-page)',
              background:             theme.titleGradient,
              WebkitBackgroundClip:   'text',
              WebkitTextFillColor:    'transparent',
              backgroundClip:         'text',
            }}
          >
            Generate Storyline
          </h1>
          <p className="text-base-content/60" style={{ fontSize: 'var(--font-size-label)' }}>
            Build a structured roleplay prompt from your world premise, you can provide as much or as little information as you like and the generator will fill in any blanks, however, the more rich of a vision you provide the better the outcome will be and the more true to your vision.
          </p>
        </div>
        <BookMarked className="w-7 h-7 flex-shrink-0" style={{ color: theme.primary, opacity: 0.6 }} />
      </div>

      {/* ── Folder Assignment ── */}
      <SectionCard title="Story Folder" className="mb-6">
        <p className="text-sm -mt-1 mb-3 text-base-content/60">
          All outputs from this generation will be saved into this folder in your Storyline Gallery.
        </p>

        {/* Mode toggle */}
        <div
          ref={fieldRefs.folder}
          className="flex rounded-xl overflow-hidden mb-4 border border-base-300"
          role="group"
          aria-label="Folder mode"
        >
          <button
            type="button"
            onClick={() => setFolderMode('new')}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-all"
            style={{
              minHeight:   '44px',
              background:  folderMode === 'new' ? theme.primaryGlow : theme.fieldBg,
              color:       folderMode === 'new' ? theme.primary : theme.textMuted,
              borderRight: `1px solid ${theme.fieldBorder}`,
            }}
            aria-pressed={folderMode === 'new'}
          >
            <FolderPlus className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            New Folder
          </button>
          <button
            type="button"
            onClick={() => setFolderMode('existing')}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-medium transition-all"
            style={{
              minHeight:  '44px',
              background: folderMode === 'existing' ? theme.primaryGlow : theme.fieldBg,
              color:      folderMode === 'existing' ? theme.primary : theme.textMuted,
            }}
            aria-pressed={folderMode === 'existing'}
          >
            <FolderOpen className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            Existing Folder
          </button>
        </div>

        {folderMode === 'new' ? (
          <div>
            <FieldLabel theme={theme} required>Story Name</FieldLabel>
            <input
              type="text"
              value={newFolderName}
              onChange={e => {
                setNewFolderName(e.target.value)
                if (errors.folder) setErrors(ev => ({ ...ev, folder: undefined }))
              }}
              placeholder="e.g. The Ashen Crown Chronicles"
              className="input input-bordered bg-base-300 w-full text-sm"
              style={{
                height:      '44px',
                borderColor: errors.folder ? 'var(--fallback-er,oklch(var(--er)))' : undefined,
              }}
              aria-invalid={!!errors.folder}
              aria-describedby={errors.folder ? 'folder-error' : undefined}
            />
          </div>
        ) : (
          <div>
            <FieldLabel theme={theme} required>Story Name</FieldLabel>
            {preselectedFolderId && (
              <p className="text-xs mb-2 text-base-content/60">
                Adding story to: <span className="font-medium" style={{ color: theme.primary }}>{storylines.find(s => s.id === preselectedFolderId)?.name}</span>
              </p>
            )}
            {storylines.length === 0 ? (
              <p className="text-sm text-base-content/60">
                No storyline folders yet. Switch to "New Folder" to create one.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {storylines.map(sl => (
                  <button
                    key={sl.id}
                    type="button"
                    onClick={() => {
                      setSelectedFolderId(sl.id)
                      if (errors.folder) setErrors(ev => ({ ...ev, folder: undefined }))
                    }}
                    className="btn btn-ghost w-full justify-between text-left border border-base-300"
                    style={{
                      minHeight:   '44px',
                      background:  selectedFolderId === sl.id ? theme.primaryGlow : theme.fieldBg,
                      borderColor: selectedFolderId === sl.id ? theme.primary : undefined,
                    }}
                  >
                    <span className="text-sm font-medium text-base-content">
                      {sl.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {sl.storyline_prompt_id && (
                        <span className="badge badge-primary badge-sm">has prompt</span>
                      )}
                      <span className="text-xs text-base-content/60">
                        {sl.batch_ids?.length || 0} chars
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {errors.folder && (
          <p id="folder-error" className="text-xs mt-2 text-error" role="alert">
            {errors.folder}
          </p>
        )}
      </SectionCard>

      {/* ── SECTION A ── */}
      <SectionCard
        theme={theme}
        title="Section A — World & Protagonist Setup"
      >
        {/* Genre & tone */}
        <FieldGroup
          ref={fieldRefs.genres}
          label="Genre & Tone"
          required
          error={errors.genres}
          theme={theme}
        >
          <div className="flex flex-wrap gap-2 min-w-0" role="group" aria-label="Genre options">
            {GENRES.map(g => (
              <Chip
                key={g}
                label={g}
                selected={genres.includes(g)}
                onClick={() => {
                  toggleMulti(setGenres, g)
                  if (errors.genres) setErrors(e => ({ ...e, genres: undefined }))
                }}
                theme={theme}
                role="checkbox"
                aria-checked={genres.includes(g)}
              />
            ))}
          </div>
        </FieldGroup>

        {/* Opening situation */}
        <FieldGroup
          ref={fieldRefs.openingSituation}
          label="Opening Situation"
          required
          error={errors.openingSituation}
          theme={theme}
        >
          <Textarea
            value={openingSituation}
            onChange={e => {
              setOpeningSituation(e.target.value)
              if (errors.openingSituation) setErrors(ev => ({ ...ev, openingSituation: undefined }))
            }}
            placeholder="The frozen crisis moment — where does the story begin?"
            hint="Min 2 sentences recommended"
            rows={4}
            theme={theme}
            aria-invalid={!!errors.openingSituation}
            aria-describedby={errors.openingSituation ? 'openingSituation-error' : undefined}
          />
        </FieldGroup>

        {/* Protagonist name + status — single col on mobile, 2-col on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldGroup label="Protagonist Name / Title" theme={theme}>
            <TextInput
              value={protagonistName}
              onChange={e => setProtagonistName(e.target.value)}
              placeholder="Leave blank to let the AI generate one"
              theme={theme}
            />
          </FieldGroup>

          <FieldGroup
            ref={fieldRefs.protagonistStatus}
            label="Protagonist Status"
            theme={theme}
          >
            <TextInput
              value={protagonistStatus}
              onChange={e => setProtagonistStatus(e.target.value)}
              placeholder="Their role in the world hierarchy"
              theme={theme}
            />
          </FieldGroup>
        </div>

        {/* Appearance — 2-col on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldGroup label="Appearance — Default Form (Social Mask)" theme={theme}>
            <TextInput
              value={appearanceMask}
              onChange={e => setAppearanceMask(e.target.value)}
              placeholder="How they appear to others"
              theme={theme}
            />
          </FieldGroup>
          <FieldGroup label="Appearance — True Form" theme={theme}>
            <TextInput
              value={appearanceTrueForm}
              onChange={e => setAppearanceTrueForm(e.target.value)}
              placeholder="Their actual appearance"
              theme={theme}
            />
          </FieldGroup>
        </div>

        {/* Abilities */}
          <FieldGroup
            ref={fieldRefs.abilitiesCurrent}
            label="Abilities — Current State"
            theme={theme}
          >
            <Textarea
              value={abilitiesCurrent}
              onChange={e => setAbilitiesCurrent(e.target.value)}
              placeholder={`1. [Name] — [function] / [limitation or cost]\n2. [Name] — [function] / [limitation or cost]`}
              hint="One ability must be unique to origin; one must carry a cost or stigma"
              rows={5}
              theme={theme}
            />
          </FieldGroup>

        {/* Growth mechanism */}
        <FieldGroup label="Growth Mechanism" theme={theme}>
          {/* Mobile: vertical list of full-width tap targets; md+: flex-wrap chips */}
          <div className="grid grid-cols-2 md:flex md:flex-row md:flex-wrap gap-2" role="group" aria-label="Growth mechanism options">
            {GROWTH_MECHANISMS.map(g => (
              <RadioChip
                key={g}
                label={g}
                selected={growthMechanism === g}
                onClick={() => setGrowthMechanism(prev => prev === g ? '' : g)}
                theme={theme}
              />
            ))}
          </div>
          {growthMechanism === 'Other' && (
            <TextInput
              value={growthOther}
              onChange={e => setGrowthOther(e.target.value)}
              placeholder="Describe the growth mechanism"
              theme={theme}
              className="mt-2"
            />
          )}
        </FieldGroup>

        {/* Unknown to self */}
        <FieldGroup label="What the Protagonist Does NOT Know About Themselves" theme={theme}>
          <Textarea
            value={unknownToSelf}
            onChange={e => setUnknownToSelf(e.target.value)}
            placeholder="Gaps in self-knowledge are narrative fuel"
            rows={3}
            theme={theme}
          />
        </FieldGroup>

        {/* NPCs */}
        <FieldGroup
          ref={fieldRefs.npcs}
          label="NPCs"
          theme={theme}
        >
          {/* Mobile: single col; md+: 2-col grid when multiple cards */}
          <div className={`gap-3 ${npcs.length >= 2 ? 'grid grid-cols-1 md:grid-cols-2' : 'flex flex-col'}`}>
            {npcs.map((npc, idx) => (
              <NPCCard
                key={npc.id}
                npc={npc}
                index={idx}
                onUpdate={patch => updateNPC(npc.id, patch)}
                onRemove={npcs.length > 1 ? () => removeNPC(npc.id) : null}
                theme={theme}
              />
            ))}
          </div>
          <button
            onClick={addNPC}
            className="btn btn-ghost btn-sm mt-3 w-full border border-base-300"
            style={{ minHeight: '44px' }}
            aria-label="Add NPC"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add NPC
          </button>
        </FieldGroup>

        {/* Factions */}
        <FieldGroup
          ref={fieldRefs.factions}
          label="Factions"
          theme={theme}
        >
          <div className={`gap-3 ${factions.length >= 2 ? 'grid grid-cols-1 md:grid-cols-2' : 'flex flex-col'}`}>
            {factions.map((faction, idx) => (
              <FactionCard
                key={faction.id}
                faction={faction}
                index={idx}
                onUpdate={patch => updateFaction(faction.id, patch)}
                onRemove={factions.length > 1 ? () => removeFaction(faction.id) : null}
                theme={theme}
              />
            ))}
          </div>
          <button
            onClick={addFaction}
            className="btn btn-ghost btn-sm mt-3 w-full border border-base-300"
            style={{ minHeight: '44px' }}
            aria-label="Add Faction"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add Faction
          </button>
        </FieldGroup>

        {/* Power hierarchy */}
        <FieldGroup label="Power Hierarchy Description" theme={theme}>
          <Textarea
            value={powerHierarchy}
            onChange={e => setPowerHierarchy(e.target.value)}
            placeholder="Describe the ranking system, power levels, or social hierarchy"
            rows={3}
            theme={theme}
          />
        </FieldGroup>

        {/* Forbidden / lost power */}
        <FieldGroup label="Forbidden / Lost Power Type" theme={theme}>
          <TextInput
            value={forbiddenPower}
            onChange={e => setForbiddenPower(e.target.value)}
            placeholder="e.g. Void magic, soul manipulation, pre-cataclysm techniques"
            theme={theme}
          />
        </FieldGroup>

        {/* World equilibrium */}
        <FieldGroup label="Current World Equilibrium — Why It's Fragile" theme={theme}>
          <Textarea
            value={worldEquilibrium}
            onChange={e => setWorldEquilibrium(e.target.value)}
            placeholder="What's keeping the world from collapsing, and what threatens that balance?"
            rows={3}
            theme={theme}
          />
        </FieldGroup>
      </SectionCard>

      {/* ── SECTION B ── */}
      <SectionCard title="Section B — Narrative Physics Settings" className="mt-6">

        {/* Structural overlays */}
        <FieldGroup label="Structural Overlay(s)" theme={theme}>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Structural overlay options">
            {STRUCTURAL_OVERLAYS.map(o => (
              <Chip
                key={o}
                label={o}
                selected={overlays.includes(o)}
                onClick={() => toggleMulti(setOverlays, o)}
                theme={theme}
                role="checkbox"
                aria-checked={overlays.includes(o)}
              />
            ))}
          </div>
        </FieldGroup>

        {/* Power fantasy ratio */}
        <FieldGroup label="Power Fantasy Ratio" theme={theme}>
          <div className="space-y-3">
            {/* Value display — always visible, not just on hover */}
            <div className="flex justify-between items-center">
              <span className="text-base-content/60" style={{ fontSize: 'var(--font-size-label)' }}>More tension</span>
              <span
                className="font-bold px-3 py-1 rounded-lg"
                style={{
                  fontSize:   '1rem',
                  color:      theme.primary,
                  background: theme.primaryGlow,
                }}
                aria-live="polite"
                aria-atomic="true"
              >
                {powerFantasyRatio}%
              </span>
              <span className="text-base-content/60" style={{ fontSize: 'var(--font-size-label)' }}>More dominance</span>
            </div>
            <input
              type="range"
              min={40} max={80} step={5}
              value={powerFantasyRatio}
              onChange={e => setPowerFantasyRatio(Number(e.target.value))}
              className="range range-primary w-full"
              style={{ accentColor: theme.primary, color: theme.primary }}
              aria-label="Power Fantasy Ratio"
              aria-valuemin={40}
              aria-valuemax={80}
              aria-valuenow={powerFantasyRatio}
              aria-valuetext={`${powerFantasyRatio}%`}
            />
          </div>
        </FieldGroup>

        {/* First hook type */}
        <FieldGroup label="Preferred First Hook Type" theme={theme}>
          <div className="grid grid-cols-2 md:flex md:flex-row md:flex-wrap gap-2" role="group" aria-label="First hook type options">
            {FIRST_HOOK_TYPES.map(h => (
              <RadioChip
                key={h}
                label={h}
                selected={firstHookType === h}
                onClick={() => setFirstHookType(prev => prev === h ? '' : h)}
                theme={theme}
              />
            ))}
          </div>
        </FieldGroup>

        {/* Moral complexity level */}
        <FieldGroup label="Moral Complexity Level" theme={theme}>
          <div className="space-y-3">
            {/* Active label display */}
            <div className="flex justify-center">
              <span
                className="font-semibold px-3 py-1 rounded-lg"
                style={{
                  fontSize:   '0.9375rem',
                  color:      theme.primary,
                  background: theme.primaryGlow,
                }}
                aria-live="polite"
                aria-atomic="true"
              >
                {MORAL_COMPLEXITY_LABELS[moralComplexityLevel]}
              </span>
            </div>
            <input
              type="range"
              min={1} max={5} step={1}
              value={moralComplexityLevel}
              onChange={e => setMoralComplexityLevel(Number(e.target.value))}
              className="range range-primary w-full"
              style={{ accentColor: theme.primary, color: theme.primary }}
              aria-label="Moral Complexity Level"
              aria-valuemin={1}
              aria-valuemax={5}
              aria-valuenow={moralComplexityLevel}
              aria-valuetext={MORAL_COMPLEXITY_LABELS[moralComplexityLevel]}
            />
            {/* Tick labels — hide on very narrow screens to prevent overlap */}
            <div className="hidden xs:flex justify-between" aria-hidden="true">
              {Object.entries(MORAL_COMPLEXITY_LABELS).map(([k, v]) => (
                <span
                  key={k}
                  style={{
                    fontSize: 'var(--font-size-label)',
                    color:    Number(k) === moralComplexityLevel ? theme.primary : theme.textMuted,
                    fontWeight: Number(k) === moralComplexityLevel ? 600 : 400,
                    textAlign: 'center',
                    flex: 1,
                  }}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>
        </FieldGroup>

        {/* Additional prohibitions */}
        <FieldGroup label="Additional Prohibitions" theme={theme}>
          <Textarea
            value={additionalProhibitions}
            onChange={e => setAdditionalProhibitions(e.target.value)}
            placeholder="Content or tropes to exclude — appended to the prompt's forbidden list"
            rows={3}
            theme={theme}
          />
        </FieldGroup>

        {/* Additional context */}
        <FieldGroup label="Additional Context / Specific Requests" theme={theme}>
          <Textarea
            value={additionalContext}
            onChange={e => setAdditionalContext(e.target.value)}
            placeholder="Thematic inspirations, named influences, specific opening scene details"
            rows={3}
            theme={theme}
          />
        </FieldGroup>
      </SectionCard>

      {/*
        ── Sticky Submit Button (mobile) / Inline (tablet/desktop) ──
        On mobile: sticky bottom bar with safe-area-inset padding.
        On md+: regular inline button, right-aligned.
      */}
      {/* Desktop / tablet inline submit */}
      <div className="hidden md:flex justify-end mt-8 mb-4">
        <button
          onClick={handleReviewGenerate}
          disabled={generating}
          className="btn btn-primary"
          style={{ minHeight: '48px' }}
        >
          {generating ? (
            <><span className="loading loading-spinner loading-sm" aria-hidden="true" />Generating…</>
          ) : (
            <><BookMarked className="w-5 h-5" aria-hidden="true" />Review & Generate</>
          )}
        </button>
      </div>

      {/* Mobile sticky submit bar — fixed at bottom, full viewport width */}
      <div
        className="sticky-bottom-bar md:hidden fixed bottom-0 left-0 right-0 z-20 px-4"
        style={{
          background:    theme.navBg,
          backdropFilter:'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderTop:     `1px solid ${theme.navBorder}`,
          paddingTop:    '0.75rem',
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 0.75rem)`,
        }}
      >
        <button
          onClick={handleReviewGenerate}
          disabled={generating}
          className="btn btn-primary btn-block"
          style={{ minHeight: '48px' }}
        >
          {generating ? (
            <><span className="loading loading-spinner loading-sm" aria-hidden="true" />Generating…</>
          ) : (
            <><BookMarked className="w-5 h-5" aria-hidden="true" />Review & Generate</>
          )}
        </button>
      </div>

      {/* Spacer so the last card isn't hidden under the fixed submit bar on mobile */}
      <div className="md:hidden h-24" aria-hidden="true" />

      {/* Confirmation modal / bottom sheet */}
      {showConfirmModal && (
        <ConfirmationModal
          theme={theme}
          tokenTier={tokenTier}
          onTierChange={setTokenTier}
          onGenerate={handleGenerate}
          onBack={() => setShowConfirmModal(false)}
          folderName={
            folderMode === 'new'
              ? newFolderName.trim()
              : (storylines.find(sl => sl.id === selectedFolderId)?.name || 'Selected Folder')
          }
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ theme, required, children }) {
  return (
    <div
      className="uppercase tracking-widest font-medium mb-1.5 flex items-center gap-1"
      style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}
    >
      {children}
      {required && <span style={{ color: theme.primary }}>*</span>}
    </div>
  )
}

const FieldGroup = forwardRef(function FieldGroup(
  { label, required, error, hint, children, theme },
  ref
) {
  return (
    <div ref={ref} className="space-y-1.5 min-w-0">
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <span
          className="uppercase tracking-widest font-medium"
          style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}
        >
          {label}
        </span>
        {required && (
          <span style={{ fontSize: 'var(--font-size-label)', color: theme.primary }}>*</span>
        )}
        {hint && (
          <span className="text-base-content/60" style={{ fontSize: 'var(--font-size-label)' }}>— {hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p
          className="mt-1 text-error"
          style={{ fontSize: 'var(--font-size-label)' }}
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  )
})

function SectionCard({ title, children, className = '' }) {
  return (
    /*
      overflow-hidden is intentionally NOT applied to the outer wrapper —
      it would clip position:sticky children and cause layout bleed on mobile.
      Rounded corners are preserved via border-radius alone; inner elements
      that need clipping (e.g. image thumbnails) handle it themselves.
    */
    <div
      className={`card bg-base-200 border border-base-300 rounded-2xl ${className}`}
    >
      {/* Section heading — scrolls naturally; no sticky on mobile */}
      <div className="border-b border-base-300">
        <h2
          className="font-bold px-5 py-4 md:px-6 text-base-content"
          style={{ fontSize: 'var(--font-size-heading)' }}
        >
          {title}
        </h2>
      </div>
      <div className="card-body p-4 md:p-6 space-y-5">
        {children}
      </div>
    </div>
  )
}

function TextInput({ value, onChange, placeholder, className = '', 'aria-invalid': ariaInvalid }) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`input input-bordered bg-base-300 w-full text-sm transition-colors ${className}`}
      style={{ height: '44px' }}
      aria-invalid={ariaInvalid}
      autoCorrect="on"
      spellCheck="true"
    />
  )
}

function Textarea({ value, onChange, placeholder, hint, rows = 3, 'aria-invalid': ariaInvalid, 'aria-describedby': ariaDescribedBy }) {
  return (
    <div>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="textarea textarea-bordered bg-base-300 w-full text-sm resize-y transition-colors"
        style={{
          minHeight: '96px',   /* 96px mobile minimum per spec */
        }}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoCorrect="on"
        spellCheck="true"
      />
      {hint && (
        <p className="mt-1 text-base-content/60" style={{ fontSize: 'var(--font-size-label)' }}>
          {hint}
        </p>
      )}
    </div>
  )
}

function Chip({ label, selected, onClick, theme, role = 'checkbox', 'aria-checked': ariaChecked }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn btn-sm chip-btn rounded-full flex-shrink-0 ${selected ? 'btn-primary btn-active' : 'btn-ghost border border-base-300'}`}
      style={{
        minHeight: '44px',
        boxShadow: selected ? `0 0 8px ${theme.primaryGlow}` : 'none',
      }}
      role={role}
      aria-checked={ariaChecked ?? selected}
    >
      {label}
    </button>
  )
}

/*
  RadioChip on mobile renders as a full-width list item (flex-col context).
  On md+ it reverts to chip appearance inside a flex-wrap row.
  Both use the same component — layout is controlled by the parent flex direction.
*/
function RadioChip({ label, selected, onClick, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`btn btn-sm chip-btn rounded-xl md:rounded-full w-full md:w-auto text-left md:text-center flex items-center md:justify-center gap-2 ${selected ? 'btn-primary btn-active' : 'btn-ghost border border-base-300'}`}
      style={{
        minHeight: '44px',
        boxShadow: selected ? `0 0 8px ${theme.primaryGlow}` : 'none',
      }}
      role="radio"
      aria-checked={selected}
    >
      {/* Radio indicator dot — visible on mobile vertical layout */}
      <span
        className="md:hidden flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{ borderColor: selected ? 'white' : theme.fieldBorder }}
        aria-hidden="true"
      >
        {selected && <span className="w-2 h-2 rounded-full bg-white" />}
      </span>
      {label}
    </button>
  )
}

function NPCCard({ npc, index, onUpdate, onRemove, theme }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="collapse collapse-arrow bg-base-200 border border-base-300 rounded-xl">
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
        style={{
          minHeight:    '52px',
          borderBottom: expanded ? `1px solid ${theme.fieldBorder}` : 'none',
        }}
      >
        <span className="text-sm font-medium text-base-content">
          NPC {index + 1}{npc.name ? ` — ${npc.name}` : ''}
        </span>
        <div className="flex items-center gap-1">
          {onRemove && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="btn btn-ghost btn-sm btn-circle transition-colors"
              style={{
                minWidth:  '44px',
                minHeight: '44px',
              }}
              aria-label={`Remove NPC ${index + 1}`}
            >
              <XIcon className="w-4 h-4 text-base-content/60" aria-hidden="true" />
            </button>
          )}
          {expanded
            ? <ChevronUp   className="w-4 h-4 text-base-content/60" aria-hidden="true" />
            : <ChevronDown className="w-4 h-4 text-base-content/60" aria-hidden="true" />
          }
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          {/* Name + Role — single col (inner card fields always single-col per spec) */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <SubLabel theme={theme}>Name</SubLabel>
              <input
                type="text"
                value={npc.name}
                onChange={e => onUpdate({ name: e.target.value })}
                placeholder="NPC name"
                className="input input-bordered bg-base-300 w-full text-sm"
                style={{ height: '44px' }}
                autoCorrect="on"
              />
            </div>
            <div>
              <SubLabel theme={theme}>Role</SubLabel>
              <input
                type="text"
                value={npc.role}
                onChange={e => onUpdate({ role: e.target.value })}
                placeholder="e.g. rival general, reluctant healer"
                className="input input-bordered bg-base-300 w-full text-sm"
                style={{ height: '44px' }}
                autoCorrect="on"
              />
            </div>
          </div>

          <div>
            <SubLabel theme={theme}>Surface Presentation → Internal Hidden State</SubLabel>
            <textarea
              value={npc.surface_vs_internal}
              onChange={e => onUpdate({ surface_vs_internal: e.target.value })}
              placeholder="How they appear vs. what they truly feel or want"
              rows={2}
              className="textarea textarea-bordered bg-base-300 w-full text-sm resize-y"
              style={{ minHeight: '96px' }}
              autoCorrect="on"
              spellCheck="true"
            />
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <SubLabel theme={theme}>Relationship Vector (start → destination)</SubLabel>
              <input
                type="text"
                value={npc.relationship_vector}
                onChange={e => onUpdate({ relationship_vector: e.target.value })}
                placeholder="e.g. Antagonist → Reluctant ally"
                className="input input-bordered bg-base-300 w-full text-sm"
                style={{ height: '44px' }}
              />
            </div>
            <div>
              <SubLabel theme={theme}>Cross-Connection to Another NPC</SubLabel>
              <input
                type="text"
                value={npc.cross_connection}
                onChange={e => onUpdate({ cross_connection: e.target.value })}
                placeholder="e.g. Secretly loyal to Faction Leader"
                className="input input-bordered bg-base-300 w-full text-sm"
                style={{ height: '44px' }}
              />
            </div>
          </div>

          {/* Bond type — single-select chips per card, independent of other cards */}
          <div>
            <SubLabel theme={theme}>Bond Type</SubLabel>
            <div
              className="flex flex-wrap gap-1.5 mt-1"
              role="group"
              aria-label={`Bond type for NPC ${index + 1}`}
            >
              {BOND_TYPES.map(bt => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => onUpdate({ bond_type: npc.bond_type === bt ? null : bt })}
                  className={`btn btn-sm chip-btn rounded-full ${npc.bond_type === bt ? 'btn-primary btn-active' : 'btn-ghost border border-base-300'}`}
                  style={{ minHeight: '44px' }}
                  role="radio"
                  aria-checked={npc.bond_type === bt}
                >
                  {bt}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FactionCard({ faction, index, onUpdate, onRemove, theme }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="collapse collapse-arrow bg-base-200 border border-base-300 rounded-xl">
      <div
        className="flex items-center justify-between px-4 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
        style={{
          minHeight:    '52px',
          borderBottom: expanded ? `1px solid ${theme.fieldBorder}` : 'none',
        }}
      >
        <span className="text-sm font-medium text-base-content">
          Faction {index + 1}{faction.name ? ` — ${faction.name}` : ''}
        </span>
        <div className="flex items-center gap-1">
          {onRemove && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="btn btn-ghost btn-sm btn-circle transition-colors"
              style={{
                minWidth:  '44px',
                minHeight: '44px',
              }}
              aria-label={`Remove Faction ${index + 1}`}
            >
              <XIcon className="w-4 h-4 text-base-content/60" aria-hidden="true" />
            </button>
          )}
          {expanded
            ? <ChevronUp   className="w-4 h-4 text-base-content/60" aria-hidden="true" />
            : <ChevronDown className="w-4 h-4 text-base-content/60" aria-hidden="true" />
          }
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <SubLabel theme={theme}>Faction Name</SubLabel>
              <input
                type="text"
                value={faction.name}
                onChange={e => onUpdate({ name: e.target.value })}
                placeholder="Faction name"
                className="input input-bordered bg-base-300 w-full text-sm"
                style={{ height: '44px' }}
                autoCorrect="on"
              />
            </div>
            <div>
              <SubLabel theme={theme}>Purpose / Why They Exist</SubLabel>
              <input
                type="text"
                value={faction.purpose}
                onChange={e => onUpdate({ purpose: e.target.value })}
                placeholder="Their driving goal or reason for existing"
                className="input input-bordered bg-base-300 w-full text-sm"
                style={{ height: '44px' }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <SubLabel theme={theme}>Initial Stance Toward Protagonist</SubLabel>
              <input
                type="text"
                value={faction.stance_toward_protagonist}
                onChange={e => onUpdate({ stance_toward_protagonist: e.target.value })}
                placeholder="e.g. Hostile, Neutral, Cautiously interested"
                className="input input-bordered bg-base-300 w-full text-sm"
                style={{ height: '44px' }}
              />
            </div>
            <div>
              <SubLabel theme={theme}>What Makes Them Morally Complex</SubLabel>
              <input
                type="text"
                value={faction.moral_complexity}
                onChange={e => onUpdate({ moral_complexity: e.target.value })}
                placeholder="Their grey area — what makes them not purely good or evil"
                className="input input-bordered bg-base-300 w-full text-sm"
                style={{ height: '44px' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SubLabel({ theme, children }) {
  return (
    <div
      className="uppercase tracking-wider font-medium mb-1 text-base-content/70"
      style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}
    >
      {children}
    </div>
  )
}

// ─── Phase 4: Confirmation Modal / Bottom Sheet ───────────────────────────────
/*
  Mobile (< md = 768px): renders as a bottom sheet sliding up from the bottom.
  Desktop (md+):         centered dialog (original behaviour).

  NOTE: This modal contains no text inputs, so soft keyboard avoidance is not
  needed. If a text input is ever added here, the bottom sheet will need
  viewport/scroll adjustment (e.g. adding window.visualViewport resize listener).
*/
function ConfirmationModal({ theme, tokenTier, onTierChange, onGenerate, onBack, folderName }) {
  const sheetRef     = useRef(null)
  const firstFocusRef = useRef(null)

  // Focus the first interactive element when the modal opens
  useEffect(() => {
    const t = setTimeout(() => firstFocusRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [])

  // Touch drag-to-dismiss state
  const dragState = useRef({ startY: 0, dragging: false })
  const [dragOffset, setDragOffset] = useState(0)

  const handleTouchStart = (e) => {
    dragState.current = { startY: e.touches[0].clientY, dragging: true }
  }
  const handleTouchMove = (e) => {
    if (!dragState.current.dragging) return
    const dy = e.touches[0].clientY - dragState.current.startY
    if (dy > 0) setDragOffset(dy)  // only allow dragging DOWN
  }
  const handleTouchEnd = () => {
    dragState.current.dragging = false
    if (dragOffset > 80) {
      // Dragged down past threshold — dismiss
      setDragOffset(0)
      onBack()
    } else {
      setDragOffset(0)
    }
  }

  return (
    <dialog className="modal modal-bottom sm:modal-middle" open aria-modal="true" aria-labelledby="confirm-modal-title">
      {/* Backdrop */}
      <div className="modal-backdrop" onClick={onBack} />

      {/*
        MOBILE BOTTOM SHEET — shown below md breakpoint via CSS.
        Desktop CENTERED DIALOG — shown at md+ breakpoint via CSS.
        We render both and toggle visibility with CSS breakpoints.
      */}

      {/* ── Mobile Bottom Sheet ── */}
      <div
        ref={sheetRef}
        className="modal-box bg-base-200 border border-base-300 md:hidden rounded-t-2xl rounded-b-none w-full max-w-full"
        style={{
          transform:     `translateY(${dragOffset}px)`,
          transition:    dragOffset === 0 ? 'transform 0.3s cubic-bezier(0.32,0.72,0,1)' : 'none',
          paddingBottom: `calc(var(--safe-bottom) + 1rem)`,
          maxHeight:     '75vh',
          overflowY:     'auto',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-1 pb-2" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-base-300" />
        </div>

        <ConfirmModalContent
          theme={theme}
          tokenTier={tokenTier}
          onTierChange={onTierChange}
          onGenerate={onGenerate}
          onBack={onBack}
          folderName={folderName}
          firstFocusRef={firstFocusRef}
          mobile
        />
      </div>

      {/* ── Desktop Centered Dialog ── */}
      <div className="modal-box hidden md:block bg-base-200 border border-base-300 relative w-full max-w-md space-y-5">
        <ConfirmModalContent
          theme={theme}
          tokenTier={tokenTier}
          onTierChange={onTierChange}
          onGenerate={onGenerate}
          onBack={onBack}
          folderName={folderName}
          firstFocusRef={firstFocusRef}
          mobile={false}
        />
      </div>
    </dialog>
  )
}

function ConfirmModalContent({ theme, tokenTier, onTierChange, onGenerate, onBack, folderName, firstFocusRef, mobile }) {
  return (
    <div className={mobile ? 'px-5 pb-2 space-y-5' : 'space-y-5'}>
      <div>
        <h3
          id="confirm-modal-title"
          className="font-bold mb-1 text-base-content"
          style={{ fontSize: 'var(--font-size-heading)' }}
        >
          Choose output depth
        </h3>
        <p className="text-sm text-base-content/60">
          This controls how detailed the generated prompt will be.
          {folderName && (
            <> Result will be saved to <span style={{ color: theme.primary }}>"{folderName}"</span>.</>
          )}
        </p>
      </div>

      {/* Token tier options — full-width tappable rows, ≥52px tall */}
      <div className="space-y-2" role="radiogroup" aria-label="Output depth">
        {TOKEN_TIERS.map((tier, idx) => (
          <button
            key={tier.id}
            ref={idx === 0 ? firstFocusRef : undefined}
            type="button"
            onClick={() => onTierChange(tier.id)}
            className="btn btn-ghost w-full justify-start text-left border border-base-300"
            style={{
              minHeight:   '52px',
              background:  tokenTier === tier.id ? theme.primaryGlow : theme.fieldBg,
              borderColor: tokenTier === tier.id ? theme.primary : undefined,
            }}
            role="radio"
            aria-checked={tokenTier === tier.id}
          >
            {/* Radio indicator */}
            <div
              className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
              style={{ borderColor: tokenTier === tier.id ? theme.primary : theme.fieldBorder }}
              aria-hidden="true"
            >
              {tokenTier === tier.id && (
                <div className="w-2 h-2 rounded-full" style={{ background: theme.primary }} />
              )}
            </div>
            <div>
              <div className="text-sm font-semibold text-base-content">{tier.label}</div>
              <div className="text-base-content/60" style={{ fontSize: 'var(--font-size-label)' }}>{tier.subtitle}</div>
            </div>
          </button>
        ))}
      </div>

      {/*
        Buttons:
        - Mobile: stacked vertically, full-width. Generate first, Back below.
        - Desktop: side by side.
      */}
      <div className="flex flex-col md:flex-row gap-3 pt-1">
        <button
          onClick={onGenerate}
          className="btn btn-primary w-full md:flex-1"
          style={{ minHeight: '48px' }}
        >
          Generate
        </button>
        <button
          onClick={onBack}
          className="btn btn-ghost w-full md:flex-1 border border-base-300"
          style={{ minHeight: '48px' }}
        >
          Back
        </button>
      </div>
    </div>
  )
}
