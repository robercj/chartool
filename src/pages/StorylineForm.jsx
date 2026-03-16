import { useState, useRef, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Plus, Trash2, ArrowLeft, BookMarked, ChevronDown, ChevronUp,
  Loader2, FolderPlus, FolderOpen
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
  // 'new' = user types a folder name; 'existing' = user picks from list
  const [folderMode, setFolderMode] = useState('new')
  const [newFolderName, setNewFolderName] = useState('')
  const [selectedFolderId, setSelectedFolderId] = useState('')

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
  const [npcs, setNpcs] = useState([createNPC(), createNPC(), createNPC()])
  const [factions, setFactions] = useState([createFaction(), createFaction()])
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

  // Refs for scroll-to-error
  const fieldRefs = {
    folder: useRef(null),
    genres: useRef(null),
    openingSituation: useRef(null),
    protagonistStatus: useRef(null),
    abilitiesCurrent: useRef(null),
    npcs: useRef(null),
    factions: useRef(null),
  }

  // ─── NPC helpers ──────────────────────────────────────────────────────────
  const updateNPC = (id, patch) =>
    setNpcs(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
  const addNPC = () => setNpcs(prev => [...prev, createNPC()])
  const removeNPC = (id) => {
    if (npcs.length <= 1) return
    setNpcs(prev => prev.filter(n => n.id !== id))
  }

  // ─── Faction helpers ──────────────────────────────────────────────────────
  const updateFaction = (id, patch) =>
    setFactions(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  const addFaction = () => setFactions(prev => [...prev, createFaction()])
  const removeFaction = (id) => {
    if (factions.length <= 1) return
    setFactions(prev => prev.filter(f => f.id !== id))
  }

  // ─── Validation ───────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {}

    // Folder
    if (folderMode === 'new' && !newFolderName.trim()) {
      errs.folder = 'Enter a story name to create a folder.'
    } else if (folderMode === 'existing' && !selectedFolderId) {
      errs.folder = 'Select an existing storyline folder.'
    }

    if (genres.length === 0) errs.genres = 'Select at least one genre.'
    if (!openingSituation.trim()) errs.openingSituation = 'Opening situation is required.'
    if (!protagonistStatus.trim()) errs.protagonistStatus = 'Protagonist status is required.'
    if (!abilitiesCurrent.trim()) errs.abilitiesCurrent = 'Abilities — current state is required.'

    const npcErrors = []
    if (npcs.length < 3) {
      errs.npcs = 'At least 3 NPCs are required.'
    } else {
      npcs.forEach((npc, i) => {
        const e = {}
        if (!npc.name.trim()) e.name = 'Name required'
        if (!npc.role.trim()) e.role = 'Role required'
        if (Object.keys(e).length > 0) npcErrors[i] = e
      })
      if (npcErrors.length > 0) errs.npcFields = npcErrors
    }

    const factionErrors = []
    if (factions.length < 2) {
      errs.factions = 'At least 2 factions are required.'
    } else {
      factions.forEach((faction, i) => {
        const e = {}
        if (!faction.name.trim()) e.name = 'Faction name required'
        if (Object.keys(e).length > 0) factionErrors[i] = e
      })
      if (factionErrors.length > 0) errs.factionFields = factionErrors
    }

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
        name: protagonistName || null,
        status: protagonistStatus,
        appearance_mask: appearanceMask || null,
        appearance_true_form: appearanceTrueForm || null,
        abilities_current: abilitiesCurrent,
        growth_mechanism: growthMechanism === 'Other' ? growthOther || 'Other' : growthMechanism || null,
        unknown_to_self: unknownToSelf || null,
      },
      npcs: npcs.map(n => ({
        name: n.name,
        role: n.role,
        surface_vs_internal: n.surface_vs_internal,
        relationship_vector: n.relationship_vector || null,
        cross_connection: n.cross_connection || null,
        bond_type: n.bond_type || null,
      })),
      factions: factions.map(f => ({
        name: f.name,
        purpose: f.purpose,
        stance_toward_protagonist: f.stance_toward_protagonist || null,
        moral_complexity: f.moral_complexity || null,
      })),
      power_hierarchy: powerHierarchy || null,
      forbidden_power: forbiddenPower || null,
      world_equilibrium: worldEquilibrium || null,
    },
    section_b: {
      genres,
      structural_overlays: overlays,
      power_fantasy_ratio: powerFantasyRatio,
      first_hook_type: firstHookType || null,
      moral_complexity_level: MORAL_COMPLEXITY_LABELS[moralComplexityLevel],
      additional_prohibitions: additionalProhibitions || null,
      additional_context: additionalContext || null,
    },
  })

  // ─── Generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setShowConfirmModal(false)
    setGenerating(true)

    const tier = TOKEN_TIERS.find(t => t.id === tokenTier)
    const payload = buildPayload()

    // Resolve folder name for display in progress bar
    let folderDisplayName = ''
    if (folderMode === 'new') {
      folderDisplayName = newFolderName.trim()
    } else {
      folderDisplayName = storylines.find(sl => sl.id === selectedFolderId)?.name || 'Selected Folder'
    }

    // Start indeterminate progress bar
    startProgress('Analyzing form data…', null, '/storyline/new')

    try {
      // Stage 1 — kick off the API call
      setProgressLabel('Generating Prompt Plot…')
      const rawText = await callStorylineAPI({ formPayload: payload, maxTokens: tier.tokens })

      // Stage 2 — parse
      setProgressLabel('Generating Prompt Guidelines…')
      const parsed = parseModelSections(rawText)

      // Stage 3 — save the prompt record
      setProgressLabel('Generating AI Reminders…')
      const saved = await StorylinePrompt.create(userId, {
        raw_response: rawText,
        section_a: parsed.sectionA,
        section_b: parsed.sectionB,
        section_c: parsed.sectionC,
        form_payload: payload,
        token_tier: tokenTier,
      })

      // Stage 4 — resolve or create folder, then link
      setProgressLabel(`Saving to ${folderDisplayName} in Storyline Gallery…`)

      let storylineId
      if (folderMode === 'new') {
        const newSl = await Storyline.create(userId, {
          name: folderDisplayName,
          storyline_art_style: null,
          storyline_prompt_id: saved.id,
          storyline_metadata: {
            genres,
            protagonist_status: protagonistStatus || null,
            overlays,
            token_tier: tokenTier,
          },
        })
        storylineId = newSl.id
      } else {
        // Link prompt to the existing folder
        await Storyline.update(selectedFolderId, {
          storyline_prompt_id: saved.id,
          storyline_metadata: {
            genres,
            protagonist_status: protagonistStatus || null,
            overlays,
            token_tier: tokenTier,
          },
        })
        storylineId = selectedFolderId
      }

      queryClient.invalidateQueries({ queryKey: ['storylines', userId] })

      // Stage 5 — done
      setProgressLabel(`Completed`)

      // Brief pause so the user sees "Completed" before the bar vanishes
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
    <div className="max-w-4xl mx-auto py-8 px-4">

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: theme.textMuted }} />
        </button>
        <div className="flex-1">
          <h1
            className="text-3xl font-bold mb-1"
            style={{
              background: theme.titleGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Generate Storyline
          </h1>
          <p className="text-sm" style={{ color: theme.textMuted }}>
            Build a structured roleplay prompt from your world premise
          </p>
        </div>
        <BookMarked className="w-8 h-8" style={{ color: theme.primary, opacity: 0.6 }} />
      </div>

      {/* ── Folder Assignment ── */}
      <SectionCard theme={theme} title="Story Folder" className="mb-6">
        <p className="text-sm -mt-1 mb-3" style={{ color: theme.textMuted }}>
          All outputs from this generation will be saved into this folder in your Storyline Gallery.
        </p>

        {/* Mode toggle */}
        <div
          ref={fieldRefs.folder}
          className="flex rounded-xl overflow-hidden mb-4"
          style={{ border: `1px solid ${theme.fieldBorder}` }}
        >
          <button
            type="button"
            onClick={() => setFolderMode('new')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all"
            style={{
              background: folderMode === 'new' ? theme.primaryGlow : theme.fieldBg,
              color: folderMode === 'new' ? theme.primary : theme.textMuted,
              borderRight: `1px solid ${theme.fieldBorder}`,
            }}
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
          <button
            type="button"
            onClick={() => setFolderMode('existing')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all"
            style={{
              background: folderMode === 'existing' ? theme.primaryGlow : theme.fieldBg,
              color: folderMode === 'existing' ? theme.primary : theme.textMuted,
            }}
          >
            <FolderOpen className="w-4 h-4" />
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
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{
                background: theme.fieldBg,
                border: `1px solid ${errors.folder ? '#ef4444' : theme.fieldBorder}`,
                color: theme.textBody,
              }}
            />
          </div>
        ) : (
          <div>
            <FieldLabel theme={theme} required>Select Folder</FieldLabel>
            {storylines.length === 0 ? (
              <p className="text-sm" style={{ color: theme.textMuted }}>
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
                    className="w-full flex items-center justify-between p-3 rounded-xl text-left transition-all"
                    style={{
                      background: selectedFolderId === sl.id ? theme.primaryGlow : theme.fieldBg,
                      border: `1px solid ${selectedFolderId === sl.id ? theme.primary : theme.fieldBorder}`,
                    }}
                  >
                    <span className="text-sm font-medium" style={{ color: theme.textBody }}>
                      {sl.name}
                    </span>
                    <div className="flex items-center gap-2">
                      {sl.storyline_prompt_id && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: theme.primaryGlow, color: theme.primary }}>
                          has prompt
                        </span>
                      )}
                      <span className="text-xs" style={{ color: theme.textMuted }}>
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
          <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{errors.folder}</p>
        )}
      </SectionCard>

      {/* ── SECTION A ── */}
      <SectionCard theme={theme} title="Section A — World & Protagonist Setup">

        {/* Genre & tone */}
        <FieldGroup
          ref={fieldRefs.genres}
          label="Genre & Tone"
          required
          error={errors.genres}
          theme={theme}
        >
          <div className="flex flex-wrap gap-2">
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
          />
        </FieldGroup>

        {/* Protagonist name */}
        <FieldGroup label="Protagonist Name / Title" theme={theme}>
          <TextInput
            value={protagonistName}
            onChange={e => setProtagonistName(e.target.value)}
            placeholder="Leave blank to let the AI generate one"
            theme={theme}
          />
        </FieldGroup>

        {/* Protagonist status */}
        <FieldGroup
          ref={fieldRefs.protagonistStatus}
          label="Protagonist Status"
          required
          error={errors.protagonistStatus}
          theme={theme}
        >
          <TextInput
            value={protagonistStatus}
            onChange={e => {
              setProtagonistStatus(e.target.value)
              if (errors.protagonistStatus) setErrors(ev => ({ ...ev, protagonistStatus: undefined }))
            }}
            placeholder="Their role in the world hierarchy — hidden, contested, or feared"
            theme={theme}
          />
        </FieldGroup>

        {/* Appearance */}
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
          required
          error={errors.abilitiesCurrent}
          theme={theme}
        >
          <Textarea
            value={abilitiesCurrent}
            onChange={e => {
              setAbilitiesCurrent(e.target.value)
              if (errors.abilitiesCurrent) setErrors(ev => ({ ...ev, abilitiesCurrent: undefined }))
            }}
            placeholder={`1. [Name] — [function] / [limitation or cost]\n2. [Name] — [function] / [limitation or cost]`}
            hint="One ability must be unique to origin; one must carry a cost or stigma"
            rows={5}
            theme={theme}
          />
        </FieldGroup>

        {/* Growth mechanism */}
        <FieldGroup label="Growth Mechanism" theme={theme}>
          <div className="flex flex-wrap gap-2">
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
          required
          error={errors.npcs}
          theme={theme}
          hint="Minimum 3 required"
        >
          <div className="space-y-3">
            {npcs.map((npc, idx) => (
              <NPCCard
                key={npc.id}
                npc={npc}
                index={idx}
                fieldErrors={errors.npcFields?.[idx]}
                onUpdate={patch => updateNPC(npc.id, patch)}
                onRemove={npcs.length > 1 ? () => removeNPC(npc.id) : null}
                theme={theme}
              />
            ))}
          </div>
          <button
            onClick={addNPC}
            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all hover:opacity-80"
            style={{
              background: theme.fieldBg,
              border: `1px solid ${theme.fieldBorder}`,
              color: theme.textBody,
            }}
          >
            <Plus className="w-4 h-4" />
            Add NPC
          </button>
        </FieldGroup>

        {/* Factions */}
        <FieldGroup
          ref={fieldRefs.factions}
          label="Factions"
          required
          error={errors.factions}
          theme={theme}
          hint="Minimum 2 required"
        >
          <div className="space-y-3">
            {factions.map((faction, idx) => (
              <FactionCard
                key={faction.id}
                faction={faction}
                index={idx}
                fieldErrors={errors.factionFields?.[idx]}
                onUpdate={patch => updateFaction(faction.id, patch)}
                onRemove={factions.length > 1 ? () => removeFaction(faction.id) : null}
                theme={theme}
              />
            ))}
          </div>
          <button
            onClick={addFaction}
            className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all hover:opacity-80"
            style={{
              background: theme.fieldBg,
              border: `1px solid ${theme.fieldBorder}`,
              color: theme.textBody,
            }}
          >
            <Plus className="w-4 h-4" />
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
      <SectionCard theme={theme} title="Section B — Narrative Physics Settings" className="mt-6">

        {/* Structural overlays */}
        <FieldGroup label="Structural Overlay(s)" theme={theme}>
          <div className="flex flex-wrap gap-2">
            {STRUCTURAL_OVERLAYS.map(o => (
              <Chip
                key={o}
                label={o}
                selected={overlays.includes(o)}
                onClick={() => toggleMulti(setOverlays, o)}
                theme={theme}
              />
            ))}
          </div>
        </FieldGroup>

        {/* Power fantasy ratio */}
        <FieldGroup label="Power Fantasy Ratio" theme={theme}>
          <div className="space-y-2">
            <div className="flex justify-between text-xs" style={{ color: theme.textMuted }}>
              <span>More tension</span>
              <span className="font-semibold text-sm" style={{ color: theme.primary }}>
                {powerFantasyRatio}%
              </span>
              <span>More dominance</span>
            </div>
            <input
              type="range" min={40} max={80} step={5}
              value={powerFantasyRatio}
              onChange={e => setPowerFantasyRatio(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: theme.primary }}
            />
          </div>
        </FieldGroup>

        {/* First hook type */}
        <FieldGroup label="Preferred First Hook Type" theme={theme}>
          <div className="flex flex-wrap gap-2">
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
          <div className="space-y-2">
            <div className="flex justify-between text-xs" style={{ color: theme.textMuted }}>
              {Object.entries(MORAL_COMPLEXITY_LABELS).map(([k, v]) => (
                <span
                  key={k}
                  className={Number(k) === moralComplexityLevel ? 'font-semibold' : ''}
                  style={{ color: Number(k) === moralComplexityLevel ? theme.primary : theme.textMuted }}
                >
                  {v}
                </span>
              ))}
            </div>
            <input
              type="range" min={1} max={5} step={1}
              value={moralComplexityLevel}
              onChange={e => setMoralComplexityLevel(Number(e.target.value))}
              className="w-full"
              style={{ accentColor: theme.primary }}
            />
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

      {/* Submit */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleReviewGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-8 py-3 rounded-xl font-semibold text-base transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: theme.buttonGradient, color: 'white' }}
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <BookMarked className="w-5 h-5" />
              Review & Generate
            </>
          )}
        </button>
      </div>

      {/* Confirmation modal */}
      {showConfirmModal && (
        <ConfirmationModal
          theme={theme}
          tokenTier={tokenTier}
          onTierChange={setTokenTier}
          onGenerate={handleGenerate}
          onBack={() => setShowConfirmModal(false)}
          folderName={folderMode === 'new' ? newFolderName.trim() : (storylines.find(sl => sl.id === selectedFolderId)?.name || 'Selected Folder')}
        />
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Small label used inside sub-cards
function FieldLabel({ theme, required, children }) {
  return (
    <div className="text-xs uppercase tracking-widest font-medium mb-1.5 flex items-center gap-1" style={{ color: theme.labelColor }}>
      {children}
      {required && <span style={{ color: theme.primary }}>*</span>}
    </div>
  )
}

const FieldGroup = forwardRef(function FieldGroup({ label, required, error, hint, children, theme }, ref) {
  return (
    <div ref={ref} className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs uppercase tracking-widest font-medium" style={{ color: theme.labelColor }}>
          {label}
        </span>
        {required && (
          <span className="text-xs" style={{ color: theme.primary }}>*</span>
        )}
        {hint && (
          <span className="text-xs" style={{ color: theme.textMuted }}>— {hint}</span>
        )}
      </div>
      {children}
      {error && (
        <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{error}</p>
      )}
    </div>
  )
})

function SectionCard({ theme, title, children, className = '' }) {
  return (
    <div
      className={`rounded-2xl p-6 space-y-5 ${className}`}
      style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
    >
      <h2
        className="text-lg font-bold pb-3 mb-1"
        style={{ color: theme.textBody, borderBottom: `1px solid ${theme.fieldBorder}` }}
      >
        {title}
      </h2>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, theme, className = '' }) {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`w-full px-3 py-2 rounded-xl text-sm transition-colors ${className}`}
      style={{
        background: theme.fieldBg,
        border: `1px solid ${theme.fieldBorder}`,
        color: theme.textBody,
      }}
    />
  )
}

function Textarea({ value, onChange, placeholder, hint, rows = 3, theme }) {
  return (
    <div>
      <textarea
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 rounded-xl text-sm resize-y transition-colors"
        style={{
          background: theme.fieldBg,
          border: `1px solid ${theme.fieldBorder}`,
          color: theme.textBody,
          minHeight: `${rows * 1.6}rem`,
        }}
      />
      {hint && (
        <p className="text-xs mt-1" style={{ color: theme.textMuted }}>{hint}</p>
      )}
    </div>
  )
}

function Chip({ label, selected, onClick, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{
        background: selected ? theme.primary : theme.fieldBg,
        color: selected ? 'white' : theme.textBody,
        border: `1px solid ${selected ? theme.primary : theme.fieldBorder}`,
        boxShadow: selected ? `0 0 8px ${theme.primaryGlow}` : 'none',
      }}
    >
      {label}
    </button>
  )
}

function RadioChip({ label, selected, onClick, theme }) {
  return <Chip label={label} selected={selected} onClick={onClick} theme={theme} />
}

function NPCCard({ npc, index, fieldErrors = {}, onUpdate, onRemove, theme }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
        style={{ borderBottom: expanded ? `1px solid ${theme.fieldBorder}` : 'none' }}
      >
        <span className="text-sm font-medium" style={{ color: theme.textBody }}>
          NPC {index + 1}{npc.name ? ` — ${npc.name}` : ''}
        </span>
        <div className="flex items-center gap-2">
          {onRemove && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="p-1 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
            </button>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4" style={{ color: theme.textMuted }} />
            : <ChevronDown className="w-4 h-4" style={{ color: theme.textMuted }} />
          }
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <SubLabel theme={theme}>Name <span style={{ color: theme.primary }}>*</span></SubLabel>
              <input
                type="text"
                value={npc.name}
                onChange={e => onUpdate({ name: e.target.value })}
                placeholder="NPC name"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: theme.cardBg,
                  border: `1px solid ${fieldErrors.name ? '#ef4444' : theme.fieldBorder}`,
                  color: theme.textBody,
                }}
              />
              {fieldErrors.name && <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>{fieldErrors.name}</p>}
            </div>
            <div>
              <SubLabel theme={theme}>Role <span style={{ color: theme.primary }}>*</span></SubLabel>
              <input
                type="text"
                value={npc.role}
                onChange={e => onUpdate({ role: e.target.value })}
                placeholder="e.g. rival general, reluctant healer"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: theme.cardBg,
                  border: `1px solid ${fieldErrors.role ? '#ef4444' : theme.fieldBorder}`,
                  color: theme.textBody,
                }}
              />
              {fieldErrors.role && <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>{fieldErrors.role}</p>}
            </div>
          </div>

          <div>
            <SubLabel theme={theme}>Surface Presentation → Internal Hidden State</SubLabel>
            <textarea
              value={npc.surface_vs_internal}
              onChange={e => onUpdate({ surface_vs_internal: e.target.value })}
              placeholder="How they appear vs. what they truly feel or want"
              rows={2}
              className="w-full px-3 py-2 rounded-lg text-sm resize-y"
              style={{ background: theme.cardBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <SubLabel theme={theme}>Relationship Vector (start → destination)</SubLabel>
              <input
                type="text"
                value={npc.relationship_vector}
                onChange={e => onUpdate({ relationship_vector: e.target.value })}
                placeholder="e.g. Antagonist → Reluctant ally"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: theme.cardBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
              />
            </div>
            <div>
              <SubLabel theme={theme}>Cross-Connection to Another NPC</SubLabel>
              <input
                type="text"
                value={npc.cross_connection}
                onChange={e => onUpdate({ cross_connection: e.target.value })}
                placeholder="e.g. Secretly loyal to Faction Leader"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: theme.cardBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
              />
            </div>
          </div>

          <div>
            <SubLabel theme={theme}>Bond Type</SubLabel>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {BOND_TYPES.map(bt => (
                <button
                  key={bt}
                  type="button"
                  onClick={() => onUpdate({ bond_type: npc.bond_type === bt ? null : bt })}
                  className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                  style={{
                    background: npc.bond_type === bt ? theme.primary : theme.cardBg,
                    color: npc.bond_type === bt ? 'white' : theme.textBody,
                    border: `1px solid ${npc.bond_type === bt ? theme.primary : theme.fieldBorder}`,
                  }}
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

function FactionCard({ faction, index, fieldErrors = {}, onUpdate, onRemove, theme }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
        style={{ borderBottom: expanded ? `1px solid ${theme.fieldBorder}` : 'none' }}
      >
        <span className="text-sm font-medium" style={{ color: theme.textBody }}>
          Faction {index + 1}{faction.name ? ` — ${faction.name}` : ''}
        </span>
        <div className="flex items-center gap-2">
          {onRemove && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onRemove() }}
              className="p-1 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
            </button>
          )}
          {expanded
            ? <ChevronUp className="w-4 h-4" style={{ color: theme.textMuted }} />
            : <ChevronDown className="w-4 h-4" style={{ color: theme.textMuted }} />
          }
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <SubLabel theme={theme}>Faction Name <span style={{ color: theme.primary }}>*</span></SubLabel>
              <input
                type="text"
                value={faction.name}
                onChange={e => onUpdate({ name: e.target.value })}
                placeholder="Faction name"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: theme.cardBg,
                  border: `1px solid ${fieldErrors.name ? '#ef4444' : theme.fieldBorder}`,
                  color: theme.textBody,
                }}
              />
              {fieldErrors.name && <p className="text-xs mt-0.5" style={{ color: '#ef4444' }}>{fieldErrors.name}</p>}
            </div>
            <div>
              <SubLabel theme={theme}>Purpose / Why They Exist</SubLabel>
              <input
                type="text"
                value={faction.purpose}
                onChange={e => onUpdate({ purpose: e.target.value })}
                placeholder="Their driving goal or reason for existing"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: theme.cardBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <SubLabel theme={theme}>Initial Stance Toward Protagonist</SubLabel>
              <input
                type="text"
                value={faction.stance_toward_protagonist}
                onChange={e => onUpdate({ stance_toward_protagonist: e.target.value })}
                placeholder="e.g. Hostile, Neutral, Cautiously interested"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: theme.cardBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
              />
            </div>
            <div>
              <SubLabel theme={theme}>What Makes Them Morally Complex</SubLabel>
              <input
                type="text"
                value={faction.moral_complexity}
                onChange={e => onUpdate({ moral_complexity: e.target.value })}
                placeholder="Their grey area — what makes them not purely good or evil"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: theme.cardBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
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
    <div className="text-xs uppercase tracking-wider font-medium mb-1" style={{ color: theme.labelColor }}>
      {children}
    </div>
  )
}

function ConfirmationModal({ theme, tokenTier, onTierChange, onGenerate, onBack, folderName }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onBack} />
      <div
        className="relative w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
      >
        <div>
          <h3 className="text-lg font-bold mb-1" style={{ color: theme.textBody }}>
            Choose output depth
          </h3>
          <p className="text-sm" style={{ color: theme.textMuted }}>
            This controls how detailed the generated prompt will be.
            {folderName && (
              <> Result will be saved to <span style={{ color: theme.primary }}>"{folderName}"</span>.</>
            )}
          </p>
        </div>

        <div className="space-y-2">
          {TOKEN_TIERS.map(tier => (
            <button
              key={tier.id}
              type="button"
              onClick={() => onTierChange(tier.id)}
              className="w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all"
              style={{
                background: tokenTier === tier.id ? theme.primaryGlow : theme.fieldBg,
                border: `1px solid ${tokenTier === tier.id ? theme.primary : theme.fieldBorder}`,
              }}
            >
              <div
                className="mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
                style={{ borderColor: tokenTier === tier.id ? theme.primary : theme.fieldBorder }}
              >
                {tokenTier === tier.id && (
                  <div className="w-2 h-2 rounded-full" style={{ background: theme.primary }} />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold" style={{ color: theme.textBody }}>{tier.label}</div>
                <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>{tier.subtitle}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onBack}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
            style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
          >
            Back
          </button>
          <button
            onClick={onGenerate}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ background: theme.buttonGradient, color: 'white' }}
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  )
}
