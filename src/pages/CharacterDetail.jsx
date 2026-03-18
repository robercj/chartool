// ─── CharacterDetail.jsx ──────────────────────────────────────────────────────
// Route: /characters/:characterId
// Accessible only for finalized characters. Draft / in_progress characters
// are silently redirected to the creation flow (/characters/generate/:id).
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useBlocker } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Copy, RefreshCw, Save, History, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Sparkles, X, Plus, RotateCcw,
  Pencil, Clock, Loader2, Image as ImageIcon, Lock, Unlock,
} from 'lucide-react';
import { useAuth }  from '../contexts/AuthContext';
import { Character, PromptHistory } from '../lib/storage';
import {
  generateCharacterIdentityPrompt,
  generateAppearanceDescription,
  generateCharacterImage,
} from '../lib/anthropic';
import DerePresetSelector from '../components/character/DerePresetSelector';
import PillTagInput       from '../components/character/PillTagInput';
import {
  ARCHETYPES, MORAL_ALIGNMENTS, SOCIAL_CLASSES, SEX_OPTIONS,
  GENDER_EXPRESSION_OPTIONS, TONE_OPTIONS, ROLE_OPTIONS, BODY_TYPES,
} from '../lib/constants/DERE_PRESETS';

// ─── Field class helpers (match create flow styling) ──────────────────────────
const IC = 'input input-bordered w-full bg-base-300 text-base-content';
const SC = 'select select-bordered w-full bg-base-300 text-base-content';
const TC = 'textarea textarea-bordered w-full bg-base-300 text-base-content resize-none';
const LC = 'label label-text font-medium pb-1';

// ─── Field groups for dirty-dot computation ───────────────────────────────────
const SECTION_FIELDS = {
  'identity-role':  ['character_name','character_role','archetype','narrative_function'],
  'demographics':   ['age','sex','gender_expression','species_or_race','nationality_or_origin','social_class','occupation_or_role'],
  'personality':    ['dere_presets','custom_personality_modifier'],
  'psychology':     ['surface_traits','hidden_traits','emotional_triggers_positive','emotional_triggers_negative',
                     'surface_goal','deep_desire','internal_conflict','moral_alignment',
                     'values_and_beliefs','fears_and_insecurities','consistency_anchors','contradiction_points','behavioral_tendencies'],
  'backstory':      ['backstory_summary','knowledge_domain','formative_event'],
  'social-web':     ['relationships'],
  'voice-speech':   ['tone_of_voice','speech_pattern','verbal_quirks'],
};
const ALL_IDENTITY_FIELDS = Object.values(SECTION_FIELDS).flat();

// ─── Transform DB record → edit-form state ────────────────────────────────────
function buildEditData(char) {
  return {
    ...char,
    emotional_triggers_positive: char.emotional_triggers?.positive || [],
    emotional_triggers_negative: char.emotional_triggers?.negative || [],
    relationships: char.relationships || [],
    appearance: char.appearance || {},
  };
}

// ─── Build partial PATCH payload from dirty state ─────────────────────────────
function buildSavePayload({ editData, identityDirty, appearanceDirty,
  identityPromptRegenerated, appearanceDescRegenerated,
  imageRegenerated, imageDirty, pendingPrimaryImage,
  sessionPrompt, sessionAppearanceDesc, sessionCurrentImage, savedImageHistory }) {
  const p = {};
  if (identityDirty) {
    ALL_IDENTITY_FIELDS.forEach(f => { p[f] = editData[f] ?? null; });
    p.emotional_triggers = {
      positive: editData.emotional_triggers_positive || [],
      negative: editData.emotional_triggers_negative || [],
    };
    delete p.emotional_triggers_positive;
    delete p.emotional_triggers_negative;
    // Computed personality_mode
    const hasPresets = (editData.dere_presets || []).length > 0;
    const hasCustom  = (editData.custom_personality_modifier || '').trim().length > 0;
    p.personality_mode = hasPresets && hasCustom ? 'preset_plus_modifier'
      : hasPresets ? 'preset_only' : hasCustom ? 'custom_only' : 'preset_only';
  }
  if (appearanceDirty)                p.appearance             = editData.appearance || {};
  if (identityPromptRegenerated)      p.character_prompt       = sessionPrompt;
  if (appearanceDescRegenerated)      p.appearance_description = sessionAppearanceDesc;
  if (imageRegenerated && sessionCurrentImage) {
    p.generated_image_url = sessionCurrentImage;
    p.image_history = [sessionCurrentImage, ...(savedImageHistory || [])].filter(Boolean).slice(0, 20);
  } else if (imageDirty && pendingPrimaryImage) {
    p.generated_image_url = pendingPrimaryImage;
  }
  return p;
}

// ─── Build identity snapshot for history entry ───────────────────────────────
function buildIdentitySnapshot(data) {
  const snap = {};
  ALL_IDENTITY_FIELDS.forEach(f => { snap[f] = data[f] ?? null; });
  return snap;
}

// ─── CollapsibleSection ────────────────────────────────────────────────────────
function CollapsibleSection({ id, title, icon: Icon, isDirty, isExpanded, onToggle, children }) {
  return (
    <div className="border border-base-300 rounded-xl overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-base-200 hover:bg-base-300 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        {Icon && <Icon className="w-4 h-4 text-primary flex-shrink-0" />}
        <span className="flex-1 font-semibold text-sm text-base-content">{title}</span>
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" title="Unsaved changes in this section" />
        )}
        {isExpanded
          ? <ChevronUp  className="w-4 h-4 opacity-50 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        }
      </button>
      {isExpanded && (
        <div className="p-5 space-y-4 bg-base-100">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={htmlFor} className={LC}>{label}</label>
      {children}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CharacterDetail() {
  const { characterId } = useParams();
  const navigate        = useNavigate();
  const queryClient     = useQueryClient();
  const { user }        = useAuth();

  // ── Load character ──────────────────────────────────────────────────────────
  const { data: savedChar, isLoading, error: loadError } = useQuery({
    queryKey: ['character', characterId],
    queryFn:  () => Character.get(characterId),
    enabled:  !!characterId,
  });

  const { data: promptHistory = [] } = useQuery({
    queryKey: ['character-history', characterId],
    queryFn:  () => PromptHistory.list(characterId),
    enabled:  !!characterId,
  });

  // ── Redirect non-finalized characters ──────────────────────────────────────
  useEffect(() => {
    if (!savedChar) return;
    if (savedChar.creation_status !== 'finalized') {
      navigate(`/characters/generate/${characterId}`, { replace: true });
    }
  }, [savedChar, characterId, navigate]);

  // ── Edit state (initialized from savedChar) ─────────────────────────────────
  const [editData,     setEditData]     = useState(null);
  const [initialized,  setInitialized]  = useState(false);

  useEffect(() => {
    if (savedChar && !initialized) {
      setEditData(buildEditData(savedChar));
      setSeed(savedChar.seed ?? null);
      setSeedLocked(savedChar.seed_locked ?? false);
      setInitialized(true);
    }
  }, [savedChar, initialized]);

  // ── Session regeneration state ───────────────────────────────────────────────
  const [sessionPrompt,       setSessionPrompt]       = useState(null);
  const [sessionAppearanceDesc, setSessionAppearanceDesc] = useState(null);
  const [sessionCurrentImage, setSessionCurrentImage] = useState(null);
  const [sessionImgHistory,   setSessionImgHistory]   = useState([]);
  const [pendingPrimaryImage, setPendingPrimaryImage] = useState(null);
  const [seed,       setSeed]       = useState(null);
  const [seedLocked, setSeedLocked] = useState(false);

  // ── Session regeneration flags ───────────────────────────────────────────────
  const [identityPromptRegenerated,    setIdentityPromptRegenerated]    = useState(false);
  const [appearanceDescRegenerated,    setAppearanceDescRegenerated]    = useState(false);
  const [imageRegenerated,             setImageRegenerated]             = useState(false);

  // ── Loading / error states ───────────────────────────────────────────────────
  const [isRegeneratingIdentity,  setIsRegeneratingIdentity]  = useState(false);
  const [isRegeneratingAppearance,setIsRegeneratingAppearance]= useState(false);
  const [isRegeneratingImage,     setIsRegeneratingImage]     = useState(false);
  const [isSaving,                setIsSaving]                = useState(false);
  const [identityError,           setIdentityError]           = useState(null);
  const [appearanceError,         setAppearanceError]         = useState(null);

  // ── Modal state ──────────────────────────────────────────────────────────────
  const [showSaveConfirm,  setShowSaveConfirm]  = useState(false);
  const [showSaveAs,       setShowSaveAs]       = useState(false);
  const [showHistory,      setShowHistory]      = useState(false);
  const [selectedHistImg,  setSelectedHistImg]  = useState(null); // from strip

  // ── Section collapse state (localStorage-persisted) ─────────────────────────
  const defaultExpanded = { 'identity-role': true, demographics: true, personality: true,
    psychology: true, backstory: true, 'social-web': true, 'voice-speech': true, appearance: true };
  const [sectionExpanded, setSectionExpanded] = useState(() => {
    try {
      const stored = localStorage.getItem(`char-sections-${characterId}`);
      return stored ? JSON.parse(stored) : defaultExpanded;
    } catch { return defaultExpanded; }
  });
  const toggleSection = useCallback((id) => {
    setSectionExpanded(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(`char-sections-${characterId}`, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [characterId]);

  // ── Dirty state (computed, not stored) ──────────────────────────────────────
  // Compare editData to savedChar field by field using JSON.stringify for deep equality
  const savedExpanded = useMemo(() => savedChar ? buildEditData(savedChar) : null, [savedChar]);

  const identityDirty = useMemo(() => {
    if (!editData || !savedExpanded) return false;
    return ALL_IDENTITY_FIELDS.some(f =>
      JSON.stringify(editData[f]) !== JSON.stringify(savedExpanded[f])
    );
  }, [editData, savedExpanded]);

  const appearanceDirty = useMemo(() => {
    if (!editData || !savedExpanded) return false;
    return JSON.stringify(editData.appearance) !== JSON.stringify(savedExpanded.appearance);
  }, [editData, savedExpanded]);

  const imageDirty = imageRegenerated || !!pendingPrimaryImage;

  const isDirtyOverall = identityDirty || appearanceDirty || imageDirty
    || identityPromptRegenerated || appearanceDescRegenerated;

  // Per-section dirty dots
  const sectionDirty = useMemo(() => {
    if (!editData || !savedExpanded) return {};
    const result = {};
    Object.entries(SECTION_FIELDS).forEach(([secId, fields]) => {
      result[secId] = fields.some(f =>
        JSON.stringify(editData[f]) !== JSON.stringify(savedExpanded[f])
      );
    });
    result.appearance = JSON.stringify(editData.appearance) !== JSON.stringify(savedExpanded.appearance);
    return result;
  }, [editData, savedExpanded]);

  // ── Navigation blocker (unsaved changes warning) ────────────────────────────
  const afterSaveRef = useRef(null);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirtyOverall && currentLocation.pathname !== nextLocation.pathname
  );

  // beforeunload for hard navigation
  useEffect(() => {
    const handler = (e) => {
      if (isDirtyOverall) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirtyOverall]);

  // ── Field change handlers ────────────────────────────────────────────────────
  const handleFieldChange = useCallback((field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAppearanceChange = useCallback((field, value) => {
    setEditData(prev => ({ ...prev, appearance: { ...prev.appearance, [field]: value } }));
  }, []);

  // Relationship builder
  const addRelationship = () => handleFieldChange('relationships',
    [...(editData.relationships || []), { entity: '', relationship: '', notes: '' }]);
  const removeRelationship = (i) => handleFieldChange('relationships',
    (editData.relationships || []).filter((_, idx) => idx !== i));
  const updateRelationship = (i, field, value) => handleFieldChange('relationships',
    (editData.relationships || []).map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  // ── Regeneration handlers ────────────────────────────────────────────────────
  const handleRegenerateIdentityPrompt = async () => {
    setIsRegeneratingIdentity(true);
    setIdentityError(null);
    try {
      const newPrompt = await generateCharacterIdentityPrompt(editData);
      setSessionPrompt(newPrompt);
      setIdentityPromptRegenerated(true);
      toast.success('Identity prompt regenerated!');
    } catch (err) {
      setIdentityError(err.message || 'Failed to regenerate');
    } finally { setIsRegeneratingIdentity(false); }
  };

  const handleRegenerateAppearanceDesc = async () => {
    setIsRegeneratingAppearance(true);
    setAppearanceError(null);
    try {
      const newDesc = await generateAppearanceDescription(editData.appearance || {});
      setSessionAppearanceDesc(newDesc);
      setAppearanceDescRegenerated(true);
      toast.success('Appearance description regenerated!');
    } catch (err) {
      setAppearanceError(err.message || 'Failed to regenerate');
    } finally { setIsRegeneratingAppearance(false); }
  };

  const handleRegenerateImage = async () => {
    const promptToUse = sessionAppearanceDesc || savedChar?.appearance_description || '';
    if (!promptToUse) { toast.error('No appearance description available.'); return; }
    setIsRegeneratingImage(true);
    try {
      const result = await generateCharacterImage({
        prompt: promptToUse,
        seed: seedLocked ? seed : null,
      });
      setSessionCurrentImage(result.url);
      setSeed(result.seed ?? seed);
      setImageRegenerated(true);
      setSessionImgHistory(prev => [result.url, ...prev.filter(u => u !== result.url)].slice(0, 10));
      toast.success('Image regenerated!');
    } catch { toast.error('Failed to regenerate image. Please try again.'); }
    finally { setIsRegeneratingImage(false); }
  };

  // ── Copy prompt to clipboard ─────────────────────────────────────────────────
  const copyPrompt = async (text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      toast.success('Prompt copied!');
    } catch { toast.error('Failed to copy'); }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const performSave = async () => {
    setIsSaving(true);
    try {
      const savedImgHistory = Array.isArray(savedChar.image_history) ? savedChar.image_history : [];
      const payload = buildSavePayload({
        editData, identityDirty, appearanceDirty,
        identityPromptRegenerated, appearanceDescRegenerated,
        imageRegenerated, imageDirty, pendingPrimaryImage,
        sessionPrompt, sessionAppearanceDesc,
        sessionCurrentImage, savedImageHistory: savedImgHistory,
      });

      await Character.update(characterId, payload);

      // Write history entry
      try {
        await PromptHistory.create(characterId, {
          save_type:                'save',
          character_prompt:         sessionPrompt || savedChar.character_prompt || '',
          appearance_description:   sessionAppearanceDesc || savedChar.appearance_description || null,
          identity_field_snapshot:  buildIdentitySnapshot(editData),
          appearance_field_snapshot: editData.appearance || {},
          generated_image_url:      payload.generated_image_url || savedChar.generated_image_url || null,
          label: null,
        });
      } catch { /* history write failure is non-blocking */ }

      // Refresh saved state
      queryClient.invalidateQueries({ queryKey: ['character', characterId] });
      queryClient.invalidateQueries({ queryKey: ['character-history', characterId] });

      // Reset session state
      setSessionPrompt(null);
      setSessionAppearanceDesc(null);
      setSessionCurrentImage(null);
      setSessionImgHistory([]);
      setPendingPrimaryImage(null);
      setIdentityPromptRegenerated(false);
      setAppearanceDescRegenerated(false);
      setImageRegenerated(false);
      setShowSaveConfirm(false);

      toast.success('Character saved!');

      if (afterSaveRef.current) { afterSaveRef.current(); afterSaveRef.current = null; }
    } catch {
      toast.error("Save failed — your changes are still here. Please try again.");
    } finally { setIsSaving(false); }
  };

  // ── Save As ──────────────────────────────────────────────────────────────────
  const performSaveAs = async (newName) => {
    setIsSaving(true);
    try {
      const savedImgHistory = Array.isArray(savedChar.image_history) ? savedChar.image_history : [];
      const mergedData = {
        ...buildSavePayload({
          editData, identityDirty: true, appearanceDirty: true,
          identityPromptRegenerated, appearanceDescRegenerated,
          imageRegenerated, imageDirty, pendingPrimaryImage,
          sessionPrompt, sessionAppearanceDesc,
          sessionCurrentImage, savedImageHistory: savedImgHistory,
        }),
        character_name: newName.trim(),
        creation_status: 'finalized',
        character_prompt: sessionPrompt || savedChar.character_prompt || null,
        appearance_description: sessionAppearanceDesc || savedChar.appearance_description || null,
        generated_image_url: sessionCurrentImage || savedChar.generated_image_url || null,
        appearance: editData.appearance || {},
      };
      // Ensure emotional_triggers is packed
      if (!mergedData.emotional_triggers) {
        mergedData.emotional_triggers = {
          positive: editData.emotional_triggers_positive || [],
          negative: editData.emotional_triggers_negative || [],
        };
      }
      delete mergedData.id;
      delete mergedData.user_id;
      delete mergedData.created_at;
      delete mergedData.updated_at;
      delete mergedData.draft_id;

      const created = await Character.create(user.id, mergedData);

      // Write history entry to new record
      try {
        await PromptHistory.create(created.id, {
          save_type:                'save_as',
          character_prompt:         created.character_prompt || '',
          appearance_description:   created.appearance_description || null,
          identity_field_snapshot:  buildIdentitySnapshot(editData),
          appearance_field_snapshot: editData.appearance || {},
          generated_image_url:      created.generated_image_url || null,
          label: null,
        });
      } catch { /* non-blocking */ }

      setShowSaveAs(false);
      toast.success(`Character "${newName}" created!`);
      navigate(`/characters/${created.id}`);
    } catch (err) {
      // Check for uniqueness constraint violation (Postgres code 23505)
      const isDuplicate = err.message?.includes('23505') || err.message?.includes('unique');
      if (isDuplicate) {
        return { error: `You already have a character named "${newName}". Please choose a different name.` };
      }
      toast.error("Couldn't create copy — please try again.");
    } finally { setIsSaving(false); }
    return {};
  };

  // ── Restore from history ─────────────────────────────────────────────────────
  const handleRestoreHistory = (entry) => {
    setEditData(prev => ({
      ...prev,
      ...(entry.identity_field_snapshot || {}),
      appearance: entry.appearance_field_snapshot || {},
    }));
    setSessionPrompt(entry.character_prompt);
    setSessionAppearanceDesc(entry.appearance_description);
    setIdentityPromptRegenerated(true);
    setShowHistory(false);
    toast.success('History restored. Save to commit these changes.');
  };

  // ── Current display image ─────────────────────────────────────────────────────
  const displayImage = selectedHistImg || sessionCurrentImage || savedChar?.generated_image_url;
  const displayPrompt = sessionPrompt || savedChar?.character_prompt || '';

  // ── Loading / error states ────────────────────────────────────────────────────
  if (isLoading || !editData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-error">Couldn't load this character.</p>
        <button className="btn btn-primary btn-sm" onClick={() => queryClient.invalidateQueries(['character', characterId])}>
          Retry
        </button>
      </div>
    );
  }

  const allImages = [...sessionImgHistory, ...(savedChar?.image_history || [])].filter(Boolean);
  const uniqueImages = [...new Set(allImages)];

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row bg-base-100" style={{ minHeight: 'calc(100vh - 64px)' }}>

      {/* ── LEFT PANEL — saved snapshot ─────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[22%] flex-shrink-0 border-r border-base-300 bg-base-200 overflow-hidden" style={{ height: 'calc(100vh - 64px)', position: 'sticky', top: '64px' }}>
        <div className="flex-1 overflow-y-auto">

          {/* Portrait */}
          <div className="aspect-[3/4] bg-base-300 relative">
            {displayImage ? (
              <img src={displayImage} alt={savedChar.character_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ImageIcon className="w-16 h-16 text-base-content/20" />
              </div>
            )}
          </div>

          {/* Image history strip */}
          {uniqueImages.length > 1 && (
            <div className="flex gap-2 p-3 overflow-x-auto border-b border-base-300">
              {uniqueImages.map((url, i) => (
                <div key={i} className="relative group/thumb flex-shrink-0">
                  <button
                    onClick={() => setSelectedHistImg(url === selectedHistImg ? null : url)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                      url === (selectedHistImg || savedChar?.generated_image_url)
                        ? 'border-primary' : 'border-transparent hover:border-base-content/30'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                  {url !== savedChar?.generated_image_url && (
                    <button
                      onClick={() => { setPendingPrimaryImage(url); setSelectedHistImg(url); toast('Image staged as primary — save to commit.'); }}
                      className="absolute bottom-0 left-0 right-0 text-[10px] bg-primary text-primary-content text-center py-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded-b-lg"
                    >
                      Use
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Character summary */}
          <div className="p-4 space-y-2 border-b border-base-300">
            <h2 className="font-bold text-base-content text-base truncate">{savedChar.character_name}</h2>
            {savedChar.archetype && <p className="text-xs text-base-content/60">{savedChar.archetype}</p>}
            {savedChar.moral_alignment && <p className="text-xs text-base-content/50">{savedChar.moral_alignment}</p>}
            {savedChar.assigned_story_id && (
              <p className="text-xs text-primary/80 truncate">Story assigned</p>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 space-y-2">
            <button
              onClick={() => copyPrompt(displayPrompt)}
              className="btn btn-outline btn-sm btn-block gap-2"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Prompt
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="text-xs text-base-content/40 hover:text-base-content/60 transition-colors w-full text-left flex items-center gap-1.5 py-1"
            >
              <History className="w-3.5 h-3.5" />
              History ({promptHistory.length})
            </button>
          </div>
        </div>
      </div>

      {/* ── CENTER PANEL — edit surface ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col lg:overflow-hidden" style={{ minHeight: 'calc(100vh - 64px)' }}>

        {/* Mobile sticky header */}
        <div className="lg:hidden sticky top-0 z-10 bg-base-100 border-b border-base-300 px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden bg-base-300 flex-shrink-0">
            {displayImage
              ? <img src={displayImage} alt="" className="w-full h-full object-cover" />
              : <ImageIcon className="w-6 h-6 text-base-content/20 m-2" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{savedChar.character_name}</p>
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-base-content/20 text-base-content/60">Complete</span>
          </div>
          <button onClick={() => copyPrompt(displayPrompt)} className="btn btn-ghost btn-sm btn-square">
            <Copy className="w-4 h-4" />
          </button>
          <button onClick={() => setShowHistory(true)} className="btn btn-ghost btn-sm btn-square">
            <History className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 lg:overflow-y-auto p-4 lg:p-6">
          <h1 className="text-xl font-bold text-base-content mb-6">Edit Character</h1>

          {/* ── Section 1: Identity & Role ─────────────────────────────── */}
          <CollapsibleSection id="identity-role" title="Identity & Role" isDirty={sectionDirty['identity-role']}
            isExpanded={sectionExpanded['identity-role']} onToggle={toggleSection}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Character Name" htmlFor="cd-name">
                <input id="cd-name" type="text" className={IC}
                  value={editData.character_name || ''}
                  onChange={e => handleFieldChange('character_name', e.target.value)} />
              </Field>
              <Field label="Role in Story" htmlFor="cd-role">
                <select id="cd-role" className={SC} value={editData.character_role || ''}
                  onChange={e => handleFieldChange('character_role', e.target.value)}>
                  <option value="">Select role...</option>
                  {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Archetype" htmlFor="cd-arch">
                <select id="cd-arch" className={SC} value={editData.archetype || ''}
                  onChange={e => handleFieldChange('archetype', e.target.value)}>
                  <option value="">Select archetype...</option>
                  {ARCHETYPES.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Narrative Function" htmlFor="cd-narr">
                  <textarea id="cd-narr" className={TC} rows={2}
                    value={editData.narrative_function || ''}
                    onChange={e => handleFieldChange('narrative_function', e.target.value)} />
                </Field>
              </div>
            </div>
          </CollapsibleSection>

          {/* ── Section 2: Demographics ────────────────────────────────── */}
          <CollapsibleSection id="demographics" title="Demographics" isDirty={sectionDirty['demographics']}
            isExpanded={sectionExpanded['demographics']} onToggle={toggleSection}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Field label="Age" htmlFor="cd-age">
                <input id="cd-age" type="text" className={IC}
                  value={editData.age || ''} placeholder="e.g., 25 or mid-20s"
                  onChange={e => handleFieldChange('age', e.target.value)} />
              </Field>
              <Field label="Sex" htmlFor="cd-sex">
                <select id="cd-sex" className={SC} value={editData.sex || ''}
                  onChange={e => handleFieldChange('sex', e.target.value)}>
                  <option value="">Select...</option>
                  {SEX_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Gender Expression" htmlFor="cd-gen">
                <select id="cd-gen" className={SC} value={editData.gender_expression || ''}
                  onChange={e => handleFieldChange('gender_expression', e.target.value)}>
                  <option value="">Select...</option>
                  {GENDER_EXPRESSION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Species / Race" htmlFor="cd-spec">
                <input id="cd-spec" type="text" className={IC}
                  value={editData.species_or_race || ''}
                  onChange={e => handleFieldChange('species_or_race', e.target.value)} />
              </Field>
              <Field label="Nationality / Origin" htmlFor="cd-nat">
                <input id="cd-nat" type="text" className={IC}
                  value={editData.nationality_or_origin || ''}
                  onChange={e => handleFieldChange('nationality_or_origin', e.target.value)} />
              </Field>
              <Field label="Social Class" htmlFor="cd-class">
                <select id="cd-class" className={SC} value={editData.social_class || ''}
                  onChange={e => handleFieldChange('social_class', e.target.value)}>
                  <option value="">Select...</option>
                  {SOCIAL_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2 lg:col-span-3">
                <Field label="Occupation / Role" htmlFor="cd-occ">
                  <input id="cd-occ" type="text" className={IC}
                    value={editData.occupation_or_role || ''}
                    onChange={e => handleFieldChange('occupation_or_role', e.target.value)} />
                </Field>
              </div>
            </div>
          </CollapsibleSection>

          {/* ── Section 3: Personality ─────────────────────────────────── */}
          <CollapsibleSection id="personality" title="Personality" isDirty={sectionDirty['personality']}
            isExpanded={sectionExpanded['personality']} onToggle={toggleSection}>
            <div className="mb-2">
              <label className={LC}>Dere Type Presets</label>
              <DerePresetSelector
                selected={editData.dere_presets || []}
                onChange={v => handleFieldChange('dere_presets', v)}
              />
            </div>
            <Field label="Custom Personality Modifier" htmlFor="cd-cpmod">
              <textarea id="cd-cpmod" className={TC} rows={3}
                value={editData.custom_personality_modifier || ''}
                onChange={e => handleFieldChange('custom_personality_modifier', e.target.value)} />
            </Field>
          </CollapsibleSection>

          {/* ── Section 4: Psychology ──────────────────────────────────── */}
          <CollapsibleSection id="psychology" title="Psychology & Values" isDirty={sectionDirty['psychology']}
            isExpanded={sectionExpanded['psychology']} onToggle={toggleSection}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PillTagInput id="cd-st" label="Surface Traits"
                value={editData.surface_traits || []}
                onChange={v => handleFieldChange('surface_traits', v)}
                placeholder="Type and press Enter..." />
              <PillTagInput id="cd-ht" label="Hidden Traits"
                value={editData.hidden_traits || []}
                onChange={v => handleFieldChange('hidden_traits', v)}
                placeholder="Type and press Enter..." />
              <PillTagInput id="cd-etp" label="Positive Emotional Triggers"
                value={editData.emotional_triggers_positive || []}
                onChange={v => handleFieldChange('emotional_triggers_positive', v)}
                placeholder="What makes them open up?" />
              <PillTagInput id="cd-etn" label="Negative Emotional Triggers"
                value={editData.emotional_triggers_negative || []}
                onChange={v => handleFieldChange('emotional_triggers_negative', v)}
                placeholder="What causes withdrawal or anger?" />
              <PillTagInput id="cd-vb" label="Values & Beliefs"
                value={editData.values_and_beliefs || []}
                onChange={v => handleFieldChange('values_and_beliefs', v)} />
              <PillTagInput id="cd-fi" label="Fears & Insecurities"
                value={editData.fears_and_insecurities || []}
                onChange={v => handleFieldChange('fears_and_insecurities', v)} />
              <PillTagInput id="cd-bt" label="Behavioral Tendencies"
                value={editData.behavioral_tendencies || []}
                onChange={v => handleFieldChange('behavioral_tendencies', v)} />
              <PillTagInput id="cd-ca" label="Consistency Anchors"
                value={editData.consistency_anchors || []}
                onChange={v => handleFieldChange('consistency_anchors', v)}
                placeholder="Facts that must NEVER change..." />
            </div>
            <PillTagInput id="cd-cp" label="Contradiction Points"
              value={editData.contradiction_points || []}
              onChange={v => handleFieldChange('contradiction_points', v)} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Surface Goal" htmlFor="cd-sg">
                <input id="cd-sg" type="text" className={IC}
                  value={editData.surface_goal || ''}
                  onChange={e => handleFieldChange('surface_goal', e.target.value)} />
              </Field>
              <Field label="Deep Desire" htmlFor="cd-dd">
                <input id="cd-dd" type="text" className={IC}
                  value={editData.deep_desire || ''}
                  onChange={e => handleFieldChange('deep_desire', e.target.value)} />
              </Field>
              <Field label="Moral Alignment" htmlFor="cd-ma">
                <select id="cd-ma" className={SC} value={editData.moral_alignment || ''}
                  onChange={e => handleFieldChange('moral_alignment', e.target.value)}>
                  <option value="">Select...</option>
                  {MORAL_ALIGNMENTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Internal Conflict" htmlFor="cd-ic">
              <textarea id="cd-ic" className={TC} rows={3}
                value={editData.internal_conflict || ''}
                onChange={e => handleFieldChange('internal_conflict', e.target.value)} />
            </Field>
          </CollapsibleSection>

          {/* ── Section 5: Backstory & Context ───────────────────────── */}
          <CollapsibleSection id="backstory" title="Backstory & Context" isDirty={sectionDirty['backstory']}
            isExpanded={sectionExpanded['backstory']} onToggle={toggleSection}>
            <Field label="Backstory Summary" htmlFor="cd-bs">
              <textarea id="cd-bs" className={TC} rows={4}
                value={editData.backstory_summary || ''}
                onChange={e => handleFieldChange('backstory_summary', e.target.value)} />
            </Field>
            <PillTagInput id="cd-kd" label="Knowledge Domain"
              value={editData.knowledge_domain || []}
              onChange={v => handleFieldChange('knowledge_domain', v)}
              placeholder="Areas of expertise..." />
            <Field label="Formative Event" htmlFor="cd-fe">
              <textarea id="cd-fe" className={TC} rows={3}
                value={editData.formative_event || ''}
                onChange={e => handleFieldChange('formative_event', e.target.value)} />
            </Field>
          </CollapsibleSection>

          {/* ── Section 6: Social Web ──────────────────────────────────── */}
          <CollapsibleSection id="social-web" title="Social Web" isDirty={sectionDirty['social-web']}
            isExpanded={sectionExpanded['social-web']} onToggle={toggleSection}>
            <p className="text-sm text-base-content/50 -mt-1">Key relationships with people, groups, or factions.</p>
            {(editData.relationships || []).length > 0 && (
              <div className={`space-y-2 ${(editData.relationships || []).length > 5 ? 'max-h-96 overflow-y-auto pr-1' : ''}`}>
                {(editData.relationships || []).map((rel, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 bg-base-200 rounded-xl border border-base-300">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {['entity','relationship','notes'].map(f => (
                        <input key={f} type="text" placeholder={{ entity:'Entity / Faction', relationship:'Relationship', notes:'Notes / Backstory' }[f]}
                          value={rel[f] || ''} onChange={e => updateRelationship(i, f, e.target.value)}
                          className={IC + ' input-sm'} />
                      ))}
                    </div>
                    <button type="button" onClick={() => removeRelationship(i)}
                      className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-error mt-0.5">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={addRelationship}
              className="btn btn-ghost btn-sm gap-2 border border-dashed border-base-content/30 hover:border-primary hover:text-primary">
              <Plus className="w-4 h-4" />
              Relationship
            </button>
          </CollapsibleSection>

          {/* ── Section 7: Voice & Speech ─────────────────────────────── */}
          <CollapsibleSection id="voice-speech" title="Voice & Speech" isDirty={sectionDirty['voice-speech']}
            isExpanded={sectionExpanded['voice-speech']} onToggle={toggleSection}>
            <div className="max-w-xs">
              <Field label="Tone of Voice" htmlFor="cd-tov">
                <select id="cd-tov" className={SC} value={editData.tone_of_voice || ''}
                  onChange={e => handleFieldChange('tone_of_voice', e.target.value)}>
                  <option value="">Select tone...</option>
                  {TONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Speech Pattern" htmlFor="cd-sp">
              <textarea id="cd-sp" className={TC} rows={3}
                value={editData.speech_pattern || ''}
                onChange={e => handleFieldChange('speech_pattern', e.target.value)} />
            </Field>
            <PillTagInput id="cd-vq" label="Verbal Quirks"
              value={editData.verbal_quirks || []}
              onChange={v => handleFieldChange('verbal_quirks', v)}
              placeholder="Catchphrases, tics, avoidance words..." />
          </CollapsibleSection>

          {/* ── Section 8: Appearance ─────────────────────────────────── */}
          <CollapsibleSection id="appearance" title="Appearance" isDirty={sectionDirty['appearance']}
            isExpanded={sectionExpanded['appearance']} onToggle={toggleSection}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Body Type" htmlFor="cd-body">
                <select id="cd-body" className={SC} value={editData.appearance?.body_type || ''}
                  onChange={e => handleAppearanceChange('body_type', e.target.value)}>
                  <option value="">Select...</option>
                  {BODY_TYPES.map(t => <option key={t} value={t.toLowerCase()}>{t}</option>)}
                </select>
              </Field>
              <Field label="Height Descriptor" htmlFor="cd-ht">
                <input id="cd-ht" type="text" className={IC}
                  value={editData.appearance?.height_descriptor || ''}
                  onChange={e => handleAppearanceChange('height_descriptor', e.target.value)} />
              </Field>
              <Field label="Skin Tone" htmlFor="cd-skin">
                <input id="cd-skin" type="text" className={IC}
                  value={editData.appearance?.skin_tone || ''}
                  onChange={e => handleAppearanceChange('skin_tone', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PillTagInput id="cd-hc" label="Hair Color"
                value={editData.appearance?.hair_color || []}
                onChange={v => handleAppearanceChange('hair_color', v)} />
              <Field label="Hair Style" htmlFor="cd-hs">
                <input id="cd-hs" type="text" className={IC}
                  value={editData.appearance?.hair_style || ''}
                  onChange={e => handleAppearanceChange('hair_style', e.target.value)} />
              </Field>
              <PillTagInput id="cd-ec" label="Eye Color"
                value={editData.appearance?.eye_color || []}
                onChange={v => handleAppearanceChange('eye_color', v)} />
              <Field label="Eye Shape" htmlFor="cd-es">
                <input id="cd-es" type="text" className={IC}
                  value={editData.appearance?.eye_shape || ''}
                  onChange={e => handleAppearanceChange('eye_shape', e.target.value)} />
              </Field>
            </div>
            <PillTagInput id="cd-ff" label="Facial Features"
              value={editData.appearance?.facial_features || []}
              onChange={v => handleAppearanceChange('facial_features', v)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Clothing Style" htmlFor="cd-cs">
                <input id="cd-cs" type="text" className={IC}
                  value={editData.appearance?.clothing_style || ''}
                  onChange={e => handleAppearanceChange('clothing_style', e.target.value)} />
              </Field>
              <Field label="Art Style Reference" htmlFor="cd-as">
                <input id="cd-as" type="text" className={IC}
                  value={editData.appearance?.art_style_reference || ''}
                  onChange={e => handleAppearanceChange('art_style_reference', e.target.value)} />
              </Field>
            </div>
            <Field label="Signature Outfit" htmlFor="cd-so">
              <textarea id="cd-so" className={TC} rows={3}
                value={editData.appearance?.signature_outfit || ''}
                onChange={e => handleAppearanceChange('signature_outfit', e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PillTagInput id="cd-acc" label="Accessories"
                value={editData.appearance?.accessories || []}
                onChange={v => handleAppearanceChange('accessories', v)} />
              <PillTagInput id="cd-props" label="Props"
                value={editData.appearance?.props || []}
                onChange={v => handleAppearanceChange('props', v)} />
            </div>
            <PillTagInput id="cd-vm" label="Visual Motifs"
              value={editData.appearance?.visual_motifs || []}
              onChange={v => handleAppearanceChange('visual_motifs', v)} />
          </CollapsibleSection>
        </div>

        {/* ── STICKY ACTION BAR ────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-base-300 bg-base-100 px-4 py-3">
          {/* Errors */}
          {identityError && (
            <div className="flex items-center gap-2 mb-2 text-sm text-error">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {identityError}
              <button onClick={handleRegenerateIdentityPrompt} className="btn btn-ghost btn-xs ml-auto">Retry</button>
            </div>
          )}
          {appearanceError && (
            <div className="flex items-center gap-2 mb-2 text-sm text-error">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {appearanceError}
              <button onClick={handleRegenerateAppearanceDesc} className="btn btn-ghost btn-xs ml-auto">Retry</button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Regenerate Identity Prompt */}
            <button
              onClick={handleRegenerateIdentityPrompt}
              disabled={isRegeneratingIdentity || isRegeneratingAppearance || isRegeneratingImage}
              className={`btn btn-sm gap-1.5 ${identityDirty && !identityPromptRegenerated ? 'btn-warning btn-soft animate-pulse' : 'btn-ghost border border-base-300'}`}
              title={identityDirty ? 'Identity fields changed — regenerate prompt' : 'Regenerate Identity Prompt'}
            >
              {isRegeneratingIdentity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Identity Prompt</span>
            </button>

            {/* Regenerate Appearance Description */}
            <button
              onClick={handleRegenerateAppearanceDesc}
              disabled={isRegeneratingIdentity || isRegeneratingAppearance || isRegeneratingImage}
              className={`btn btn-sm gap-1.5 ${appearanceDirty && !appearanceDescRegenerated ? 'btn-warning btn-soft' : 'btn-ghost border border-base-300'}`}
              title={appearanceDirty ? 'Appearance fields changed' : 'Regenerate Appearance Description'}
            >
              {isRegeneratingAppearance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Appearance Desc.</span>
              {appearanceDirty && !appearanceDescRegenerated && (
                <span className="badge badge-warning badge-xs">!</span>
              )}
            </button>

            {/* Seed + Regenerate Image */}
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={seed ?? ''}
                onChange={e => setSeed(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                placeholder="Seed"
                className="input input-bordered input-sm w-20 bg-base-300"
              />
              <button
                type="button"
                onClick={() => setSeedLocked(!seedLocked)}
                className={`btn btn-sm btn-square ${seedLocked ? 'btn-warning btn-soft' : 'btn-ghost border border-base-300'}`}
                title={seedLocked ? 'Seed locked' : 'Seed unlocked'}
              >
                {seedLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              onClick={handleRegenerateImage}
              disabled={isRegeneratingImage || isRegeneratingIdentity || isRegeneratingAppearance}
              className={`btn btn-sm gap-1.5 ${
                appearanceDescRegenerated && !imageRegenerated
                  ? 'btn-warning btn-soft animate-pulse'
                  : 'btn-ghost border border-base-300'
              }`}
              title={appearanceDescRegenerated && !imageRegenerated ? 'Description updated — regenerate image to reflect.' : 'Regenerate Image'}
            >
              {isRegeneratingImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Image</span>
            </button>

            {/* Save + Save As */}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowSaveAs(true)}
                className="btn btn-ghost btn-sm border border-base-300 gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                Save As
              </button>
              <button
                onClick={() => setShowSaveConfirm(true)}
                disabled={!isDirtyOverall}
                className="btn btn-primary btn-sm gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL — live prompt view ───────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[28%] flex-shrink-0 border-l border-base-300 bg-base-200 overflow-hidden" style={{ height: 'calc(100vh - 64px)', position: 'sticky', top: '64px' }}>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-base-content">Character Prompt</h3>
            <div className="flex items-center gap-2">
              {identityPromptRegenerated && (
                <span className="badge badge-success badge-sm gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Unsaved
                </span>
              )}
              <button onClick={() => copyPrompt(displayPrompt)} className="btn btn-ghost btn-xs gap-1">
                <Copy className="w-3.5 h-3.5" />
                Copy
              </button>
            </div>
          </div>

          {/* §8 stale identity banner */}
          {identityDirty && !identityPromptRegenerated && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              Identity fields have changed since this prompt was generated.
            </div>
          )}

          {/* Prompt text */}
          <pre className="text-xs text-base-content/80 whitespace-pre-wrap font-sans leading-relaxed">
            {displayPrompt || <span className="opacity-40 italic">No prompt generated yet.</span>}
          </pre>

          {/* Appearance description */}
          {(sessionAppearanceDesc || savedChar.appearance_description) && (
            <div className="border-t border-base-300 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-base-content/60 uppercase tracking-wide">Appearance Description</p>
                {appearanceDescRegenerated && (
                  <span className="text-xs text-success">● Unsaved</span>
                )}
              </div>
              <p className="text-xs text-base-content/70 leading-relaxed">
                {sessionAppearanceDesc || savedChar.appearance_description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── MODALS & DRAWERS ─────────────────────────────────────────────── */}

      {/* Save Confirmation */}
      {showSaveConfirm && (
        <SaveConfirmModal
          characterName={savedChar.character_name}
          identityDirty={identityDirty}
          appearanceDirty={appearanceDirty}
          identityPromptRegenerated={identityPromptRegenerated}
          appearanceDescRegenerated={appearanceDescRegenerated}
          imageDirty={imageDirty}
          isSaving={isSaving}
          onConfirm={performSave}
          onCancel={() => setShowSaveConfirm(false)}
        />
      )}

      {/* Save As */}
      {showSaveAs && (
        <SaveAsModal
          currentName={savedChar.character_name}
          characterId={characterId}
          userId={user?.id}
          isSaving={isSaving}
          onConfirm={performSaveAs}
          onCancel={() => setShowSaveAs(false)}
        />
      )}

      {/* Unsaved Changes Warning (from useBlocker) */}
      {blocker.state === 'blocked' && (
        <UnsavedChangesModal
          characterName={savedChar.character_name}
          onSave={() => {
            afterSaveRef.current = () => blocker.proceed();
            setShowSaveConfirm(true);
          }}
          onLeave={() => blocker.proceed()}
          onStay={() => blocker.reset()}
        />
      )}

      {/* History Drawer */}
      {showHistory && (
        <HistoryDrawer
          entries={promptHistory}
          onClose={() => setShowHistory(false)}
          onCopy={text => copyPrompt(text)}
          onRestore={handleRestoreHistory}
          characterId={characterId}
        />
      )}
    </div>
  );
}

// ─── Save Confirmation Modal ──────────────────────────────────────────────────
function SaveConfirmModal({ characterName, identityDirty, appearanceDirty,
  identityPromptRegenerated, appearanceDescRegenerated, imageDirty, isSaving, onConfirm, onCancel }) {
  const changes = [
    identityDirty              && 'Identity fields updated',
    appearanceDirty            && 'Appearance fields updated',
    identityPromptRegenerated  && 'Identity Prompt replaced',
    appearanceDescRegenerated  && 'Appearance Description replaced',
    imageDirty                 && 'Character Image updated',
  ].filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-base-100 rounded-2xl border border-base-300 shadow-2xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-base-content">Save changes to {characterName}?</h2>
        <p className="text-sm text-base-content/60">This will permanently update this character with the following changes:</p>
        <ul className="space-y-1.5">
          {changes.map(c => (
            <li key={c} className="flex items-center gap-2 text-sm text-base-content">
              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
              {c}
            </li>
          ))}
        </ul>
        <p className="text-xs text-base-content/40">This cannot be undone. Use "Save As" to keep the current version as a separate copy.</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} disabled={isSaving} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={isSaving} className="btn btn-primary flex-1 gap-2">
            {isSaving && <span className="loading loading-spinner loading-sm" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Save As Modal ────────────────────────────────────────────────────────────
function SaveAsModal({ currentName, characterId, userId, isSaving, onConfirm, onCancel }) {
  const [name, setName]         = useState(currentName || '');
  const [nameError, setNameError] = useState(null);
  const [checking, setChecking]   = useState(false);
  const [serverError, setServerError] = useState(null);

  // Debounced uniqueness check
  useEffect(() => {
    if (!name.trim()) { setNameError(null); return; }
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const taken = await Character.nameExists(userId, name.trim(), characterId);
        setNameError(taken ? `You already have a character named "${name.trim()}". Please choose a different name.` : null);
      } finally { setChecking(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [name, userId, characterId]);

  const handleConfirm = async () => {
    setServerError(null);
    const result = await onConfirm(name.trim());
    if (result?.error) setServerError(result.error);
  };

  const canSave = name.trim().length > 0 && !nameError && !checking && !isSaving;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-base-100 rounded-2xl border border-base-300 shadow-2xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-base-content">Save as a new character</h2>
        <p className="text-sm text-base-content/60">
          A copy of <strong>{currentName}</strong> will be created with all current settings and prompt artifacts.
        </p>
        <div>
          <label className={LC} htmlFor="save-as-name">Name</label>
          <input
            id="save-as-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={`${IC} ${nameError ? 'input-error' : ''}`}
            autoFocus
          />
          {checking && <p className="text-xs text-base-content/40 mt-1">Checking...</p>}
          {nameError && <p className="text-xs text-error mt-1">{nameError}</p>}
          {serverError && <p className="text-xs text-error mt-1">{serverError}</p>}
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isSaving} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={handleConfirm} disabled={!canSave} className="btn btn-primary flex-1 gap-2">
            {isSaving && <span className="loading loading-spinner loading-sm" />}
            Save Copy
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Unsaved Changes Warning Modal ───────────────────────────────────────────
function UnsavedChangesModal({ characterName, onSave, onLeave, onStay }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-base-100 rounded-2xl border border-base-300 shadow-2xl p-6 space-y-5">
        <h2 className="text-lg font-bold text-base-content">You have unsaved changes</h2>
        <p className="text-sm text-base-content/60">
          Your changes to <strong>{characterName}</strong> haven't been saved. If you leave, they'll be lost.
        </p>
        <div className="flex flex-col gap-2">
          <button onClick={onSave}  className="btn btn-primary btn-block">Save Changes</button>
          <button onClick={onLeave} className="btn btn-error btn-outline btn-block">Leave Without Saving</button>
          <button onClick={onStay}  className="btn btn-ghost btn-block">Stay</button>
        </div>
      </div>
    </div>
  );
}

// ─── History Drawer ───────────────────────────────────────────────────────────
function HistoryDrawer({ entries, onClose, onCopy, onRestore, characterId }) {
  const queryClient         = useQueryClient();
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [labelDraft,     setLabelDraft]     = useState('');

  const saveLabel = async (id) => {
    try {
      await PromptHistory.updateLabel(id, labelDraft.trim() || null);
      queryClient.invalidateQueries({ queryKey: ['character-history', characterId] });
    } catch { toast.error('Failed to save label'); }
    setEditingLabelId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50" onClick={onClose} />
      <div className="w-full max-w-md bg-base-100 border-l border-base-300 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 flex-shrink-0">
          <h2 className="font-bold text-base-content flex items-center gap-2">
            <History className="w-4 h-4 text-primary" />
            Prompt History
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-square">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Clock className="w-12 h-12 text-base-content/20 mb-3" />
              <p className="text-sm text-base-content/50">No history yet.</p>
              <p className="text-xs text-base-content/30 mt-1">History entries are written on every Save.</p>
            </div>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="px-6 py-4 border-b border-base-300 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`badge badge-xs ${entry.save_type === 'save_as' ? 'badge-secondary' : 'badge-primary'}`}>
                        {entry.save_type === 'save_as' ? 'Copy' : 'Saved'}
                      </span>
                      <span className="text-xs text-base-content/50" title={entry.saved_at}>
                        {formatDistanceToNow(new Date(entry.saved_at), { addSuffix: true })}
                      </span>
                    </div>
                    {/* Optional label */}
                    {editingLabelId === entry.id ? (
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          autoFocus
                          type="text"
                          value={labelDraft}
                          onChange={e => setLabelDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveLabel(entry.id); if (e.key === 'Escape') setEditingLabelId(null); }}
                          className="input input-bordered input-xs flex-1 bg-base-300"
                          placeholder="Label (optional)"
                          maxLength={60}
                        />
                        <button onClick={() => saveLabel(entry.id)} className="btn btn-primary btn-xs">✓</button>
                        <button onClick={() => setEditingLabelId(null)} className="btn btn-ghost btn-xs">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingLabelId(entry.id); setLabelDraft(entry.label || ''); }}
                        className="flex items-center gap-1 mt-1 text-xs text-base-content/40 hover:text-base-content/60"
                      >
                        <Pencil className="w-3 h-3" />
                        {entry.label || 'Add label...'}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-base-content/60 line-clamp-3 leading-relaxed">
                  {entry.character_prompt?.slice(0, 180)}{entry.character_prompt?.length > 180 ? '…' : ''}
                </p>

                <div className="flex gap-2">
                  <button onClick={() => onCopy(entry.character_prompt)} className="btn btn-ghost btn-xs gap-1">
                    <Copy className="w-3 h-3" />Copy
                  </button>
                  <button onClick={() => onRestore(entry)} className="btn btn-outline btn-xs gap-1 ml-auto">
                    <RotateCcw className="w-3 h-3" />Restore
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
