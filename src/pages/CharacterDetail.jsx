// ─── CharacterDetail.jsx ──────────────────────────────────────────────────────
// Route: /characters/:characterId
// Accessible only for finalized characters. Draft / in_progress characters
// are silently redirected to the creation flow (/characters/generate/:id).
// ─────────────────────────────────────────────────────────────────────────────
import { Component, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Copy, RefreshCw, Save, History, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Sparkles, X, Plus, RotateCcw,
  Pencil, Clock, Loader2, Image as ImageIcon, Lock, Unlock,
  Download, Trash2, ZoomIn, LockKeyhole, ArrowLeft, Eye, Image,
  MoreVertical,
} from 'lucide-react';
import { useAuth }  from '../contexts/AuthContext';
import { Character, PromptHistory, CharacterImage } from '../lib/storage';
import {
  generateCharacterIdentityPrompt,
  generateAppearanceDescription,
  generateCharacterImage,
  generateImage,
  removeImageBackground,
  LimitError,
} from '../lib/anthropic';
import { compileEditPrompt } from '../lib/promptCompiler';
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

// ─── Ensure a value is always an array (guards against DB returning strings/nulls) ──
function toArr(v) { return Array.isArray(v) ? v : v ? [v] : []; }

// ─── Transform DB record → edit-form state ────────────────────────────────────
function buildEditData(char) {
  const app = char.appearance && typeof char.appearance === 'object' ? char.appearance : {};
  return {
    ...char,
    // Scalar arrays — coerce to Array in case DB stored a string
    dere_presets:                 toArr(char.dere_presets),
    surface_traits:               toArr(char.surface_traits),
    hidden_traits:                toArr(char.hidden_traits),
    values_and_beliefs:           toArr(char.values_and_beliefs),
    fears_and_insecurities:       toArr(char.fears_and_insecurities),
    behavioral_tendencies:        toArr(char.behavioral_tendencies),
    consistency_anchors:          toArr(char.consistency_anchors),
    contradiction_points:         toArr(char.contradiction_points),
    knowledge_domain:             toArr(char.knowledge_domain),
    verbal_quirks:                toArr(char.verbal_quirks),
    relationships:                toArr(char.relationships),
    emotional_triggers_positive:  toArr(char.emotional_triggers?.positive),
    emotional_triggers_negative:  toArr(char.emotional_triggers?.negative),
    // Appearance object — ensure sub-arrays are arrays too
    appearance: {
      ...app,
      hair_color:       toArr(app.hair_color),
      eye_color:        toArr(app.eye_color),
      facial_features:  toArr(app.facial_features),
      accessories:      toArr(app.accessories),
      props:            toArr(app.props),
      visual_motifs:    toArr(app.visual_motifs),
    },
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

// ─── Error Boundary ───────────────────────────────────────────────────────────
// Catches render errors so the page shows a useful message instead of going blank.
class CharacterDetailErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[CharacterDetail] render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
          <AlertTriangle className="w-12 h-12 text-error" />
          <h2 className="text-lg font-semibold text-base-content">Something went wrong loading this character.</h2>
          <p className="text-sm text-base-content/60 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <p className="text-xs text-base-content/40">Check the browser console for the full stack trace.</p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Exported wrapper ─────────────────────────────────────────────────────────
export default function CharacterDetail() {
  return (
    <CharacterDetailErrorBoundary>
      <CharacterDetailInner />
    </CharacterDetailErrorBoundary>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function CharacterDetailInner() {
  const { characterId } = useParams();
  const navigate        = useNavigate();
  const queryClient     = useQueryClient();
  const { user, checkLimit } = useAuth();

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

  const { data: characterImages = [] } = useQuery({
    queryKey: ['character-images', characterId],
    queryFn:  () => CharacterImage.forCharacter(characterId),
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
  const [showPromptModal,  setShowPromptModal]  = useState(false);
  const [showImagePromptModal, setShowImagePromptModal] = useState(false);
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
      try { localStorage.setItem(`char-sections-${characterId}`, JSON.stringify(next)); } catch { /* ignore storage errors */ }
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
    const limitCheck = checkLimit('character');
    if (!limitCheck.allowed) { toast.error(limitCheck.reason); return; }

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
      
      // Apply background removal BEFORE showing to user
      let imageUrl = result.url;
      try {
        imageUrl = await removeImageBackground(imageUrl);
      } catch (rembgErr) {
        console.warn('Background removal failed:', rembgErr);
        toast.warning('Background removal failed - image saved with background');
      }
      
      // Update session state so user sees the processed image immediately
      setSessionCurrentImage(imageUrl);
      setSeed(result.seed ?? seed);
      setImageRegenerated(true);
      setSessionImgHistory(prev => [imageUrl, ...prev.filter(u => u !== imageUrl)].slice(0, 10));
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
    <div className="flex bg-base-100" style={{ height: 'calc(100vh - 64px)' }}>

      {/* ── LEFT PANEL — saved snapshot ─────────────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[22%] flex-shrink-0 border-r border-base-300 bg-base-200 overflow-hidden">
        <div className="flex-1 overflow-y-auto">

          {/* Back to characters (desktop) */}
          <div className="px-3 pt-3 pb-1">
            <button
              onClick={() => navigate('/characters')}
              className="btn btn-ghost btn-sm gap-1.5 w-full justify-start text-base-content/60 hover:text-base-content"
              aria-label="Back to characters"
            >
              <ArrowLeft className="w-4 h-4" />
              Characters
            </button>
          </div>

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
            <div className="flex gap-2">
              <button
                onClick={() => setShowPromptModal(true)}
                className="btn btn-ghost btn-sm flex-1 gap-2"
              >
                <Eye className="w-3.5 h-3.5" />
                View Prompt
              </button>
              <button
                onClick={() => copyPrompt(displayPrompt)}
                className="btn btn-ghost btn-sm flex-1 gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                Copy Prompt
              </button>
            </div>
            {/* Image Prompt button - shown when character has any image prompt */}
            {(savedChar.character_consistency_prompt || savedChar.character_identity_lock || savedChar.appearance_description || sessionAppearanceDesc) && (
              <button
                onClick={() => setShowImagePromptModal(true)}
                className="btn btn-ghost btn-sm flex-1 gap-2 text-secondary hover:text-secondary"
              >
                <Image className="w-3.5 h-3.5" />
                View Image Prompt
              </button>
            )}
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
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile sticky header */}
        <div className="lg:hidden sticky top-0 z-10 bg-base-100 border-b border-base-300 px-4 py-3 flex items-center gap-2">
          {/* Back to character list */}
          <button
            onClick={() => navigate('/characters')}
            className="btn btn-ghost btn-sm btn-square flex-shrink-0"
            aria-label="Back to characters"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-9 h-9 rounded-lg overflow-hidden bg-base-300 flex-shrink-0">
            {displayImage
              ? <img src={displayImage} alt="" className="w-full h-full object-cover" />
              : <ImageIcon className="w-5 h-5 text-base-content/20 m-2" />
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
        <div className="flex-1 overflow-y-auto p-4 pb-44 lg:p-6">

          {/* ── §9: Primary image display — cosmetic, all characters ─────── */}
          {savedChar.generated_image_url && (
            <PrimaryImageDisplay
              url={savedChar.generated_image_url}
              name={savedChar.character_name}
            />
          )}

          <h1 className="text-xl font-bold text-base-content mb-6">Edit Character</h1>

          {/* ── §8: Identity Lock — sprites flow ─────────────────────────── */}
          {savedChar.character_identity_lock && (
            <IdentityLockSection
              identityLock={savedChar.character_identity_lock}
              sectionExpanded={sectionExpanded}
              onToggle={toggleSection}
            />
          )}

          {/* ── §8b: Character Consistency Prompt (flat text fallback) ──── */}
          {savedChar.character_consistency_prompt && !savedChar.character_identity_lock && (
            <ConsistencyPromptSection
              prompt={savedChar.character_consistency_prompt}
              sectionExpanded={sectionExpanded}
              onToggle={toggleSection}
            />
          )}

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

          {/* ── §7: Sprite Images section — bottom of detail page ────────── */}
        </div>

        {/* ── STICKY ACTION BAR ────────────────────────────────────────── */}
        {/*
          Mobile (< lg): fixed to bottom of viewport — bypasses iOS Safari 100vh bug
          where calc(100vh - 64px) overshoots the visible area, hiding the bar.
          Desktop (lg+): static flex-shrink-0 inside the flex column as normal.
        */}
        <div
          className="fixed bottom-0 left-0 right-0 z-30 lg:static lg:flex-shrink-0 border-t border-base-300 bg-base-100 px-4 pt-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
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

          {/* Row 1 — Identity + Appearance regen */}
          <div className="flex items-center gap-2 mb-2">
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
          </div>

          {/* Row 2 — Image regen + Seed + Save */}
          <div className="flex items-center gap-2">
            {/* Regenerate Image */}
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

            {/* Seed input + lock toggle */}
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

      {/* ── RIGHT PANEL — sprite gallery ───────────────────────────── */}
      <div className="hidden lg:flex flex-col w-[28%] flex-shrink-0 border-l border-base-300 bg-base-200 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* All Images: primary + sprites */}
          {(uniqueImages.length > 0 || characterImages.length > 0) && (
            <AllImagesSection
              characterId={characterId}
              primaryImages={uniqueImages}
              spriteImages={characterImages}
              currentPrimaryUrl={savedChar?.generated_image_url}
              sessionCurrentImage={sessionCurrentImage}
              onSetPrimary={setPendingPrimaryImage}
              queryClient={queryClient}
            />
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

      {/* View Prompt Modal */}
      {showPromptModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowPromptModal(false)}
        >
          <div 
            className="w-full max-w-2xl max-h-[80vh] bg-base-100 rounded-2xl border border-base-300 shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-base-300">
              <h2 className="text-lg font-bold text-base-content">Character Prompt</h2>
              <button 
                onClick={() => setShowPromptModal(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-sm text-base-content/80 whitespace-pre-wrap font-sans leading-relaxed">
                {displayPrompt || <span className="opacity-40 italic">No prompt generated yet.</span>}
              </pre>
            </div>
            <div className="p-4 border-t border-base-300 flex justify-end">
              <button 
                onClick={() => copyPrompt(displayPrompt)}
                className="btn btn-outline btn-sm gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Prompt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Image Prompt Modal */}
      {showImagePromptModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => setShowImagePromptModal(false)}
        >
          <div 
            className="w-full max-w-2xl max-h-[80vh] bg-base-100 rounded-2xl border border-base-300 shadow-2xl flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-base-300">
              <h2 className="text-lg font-bold text-base-content flex items-center gap-2">
                <Image className="w-5 h-5 text-secondary" />
                Image Prompt
              </h2>
              <button 
                onClick={() => setShowImagePromptModal(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {(savedChar.character_consistency_prompt || sessionAppearanceDesc || savedChar.appearance_description) ? (
                <div className="space-y-4">
                  {/* Current generation prompt (appearance_description) */}
                  {(sessionAppearanceDesc || savedChar.appearance_description) && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-secondary" />
                        <span className="text-sm font-medium text-secondary">Current Generation Prompt</span>
                        {sessionAppearanceDesc && <span className="badge badge-secondary badge-xs">Unsaved</span>}
                      </div>
                      <pre className="text-sm text-base-content/80 whitespace-pre-wrap font-sans leading-relaxed bg-base-200 p-3 rounded-lg">
                        {sessionAppearanceDesc || savedChar.appearance_description}
                      </pre>
                    </div>
                  )}
                  
                  {/* Legacy consistency prompt from image analysis */}
                  {savedChar.character_consistency_prompt && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <LockKeyhole className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">Image Analysis Prompt</span>
                        <span className="text-xs text-base-content/50">(from reference image)</span>
                      </div>
                      <pre className="text-sm text-base-content/60 whitespace-pre-wrap font-sans leading-relaxed">
                        {savedChar.character_consistency_prompt}
                      </pre>
                    </div>
                  )}
                </div>
              ) : savedChar.character_identity_lock ? (
                <div className="space-y-3">
                  <p className="text-sm text-base-content/60 mb-4">
                    This character has an Identity Lock with structured traits. Use the Identity Lock section below to view the full details.
                  </p>
                  <div className="text-sm text-base-content/80">
                    <div className="font-medium mb-2">Locked Traits:</div>
                    {savedChar.character_identity_lock.immutable_traits && Object.entries(savedChar.character_identity_lock.immutable_traits).map(([category, traits]) => (
                      <div key={category} className="mb-2">
                        <span className="capitalize font-medium">{category}:</span>
                        <ul className="ml-4 text-base-content/70">
                          {traits.map((trait, i) => (
                            <li key={i}>{trait}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <span className="opacity-40 italic">No image prompt available.</span>
              )}
            </div>
            <div className="p-4 border-t border-base-300 flex justify-end gap-2">
              {(sessionAppearanceDesc || savedChar.appearance_description) && (
                <button 
                  onClick={() => copyPrompt(sessionAppearanceDesc || savedChar.appearance_description)}
                  className="btn btn-secondary btn-sm gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Current
                </button>
              )}
              {savedChar.character_consistency_prompt && (
                <button 
                  onClick={() => copyPrompt(savedChar.character_consistency_prompt)}
                  className="btn btn-outline btn-sm gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Analysis
                </button>
              )}
            </div>
          </div>
        </div>
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

// ─── §9: PrimaryImageDisplay ─────────────────────────────────────────────────
// Cosmetic-only large image display above Edit Character. Applies to ALL
// characters regardless of creation_source. Clicking opens a lightbox modal.
function PrimaryImageDisplay({ url, name }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div className="mb-6">
        <button
          onClick={() => setLightboxOpen(true)}
          className="w-full relative rounded-2xl overflow-hidden block group"
          aria-label={`View ${name} full size`}
          style={{ maxHeight: '360px' }}
        >
          <img
            src={url}
            alt={name}
            className="w-full object-contain"
            style={{ maxHeight: '360px', display: 'block' }}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute -top-10 right-0 btn btn-ghost btn-sm text-white gap-1"
            >
              <X className="w-4 h-4" /> Close
            </button>
            <img
              src={url}
              alt={name}
              className="w-full rounded-2xl"
              style={{ objectFit: 'contain', maxHeight: '80vh' }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ─── §8: ConsistencyPromptSection ────────────────────────────────────────────
// Collapsible read-only section displaying the character_consistency_prompt.
// Shown only when the field is non-null. Applies to all characters.
function ConsistencyPromptSection({ prompt, sectionExpanded, onToggle }) {
  const id = 'consistency-prompt';
  const isExpanded = sectionExpanded[id] ?? false;

  return (
    <div className="border border-base-300 rounded-xl overflow-hidden mb-4">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-base-200 hover:bg-base-300 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <LockKeyhole className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="flex-1 font-semibold text-sm text-base-content">Character Consistency Prompt</span>
        <span className="badge badge-ghost badge-sm mr-1">Read only</span>
        {isExpanded
          ? <ChevronUp  className="w-4 h-4 opacity-50 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        }
      </button>
      {isExpanded && (
        <div className="p-5 bg-base-100">
          <p className="text-xs text-base-content/50 mb-3 flex items-center gap-1.5">
            <LockKeyhole className="w-3 h-3" />
            This prompt is immutable — it was generated once from your reference image and cannot be changed.
          </p>
          <textarea
            readOnly
            value={prompt}
            className="textarea textarea-bordered w-full bg-base-200 text-base-content/70 text-xs leading-relaxed resize-none cursor-text"
            rows={8}
            style={{ userSelect: 'text' }}
          />
        </div>
      )}
    </div>
  );
}

// ─── IdentityLockSection ──────────────────────────────────────────────────────
// Read-only display of the structured identity lock. Never editable.
// Shown in CharacterDetail when character_identity_lock is present.
function IdentityLockSection({ identityLock, sectionExpanded, onToggle }) {
  const id = 'identity-lock';
  const isExpanded = sectionExpanded[id] ?? false;
  const traits = identityLock?.immutable_traits || {};
  const traitCount = Object.values(traits).flat().length;

  return (
    <div className="border border-primary/30 rounded-xl overflow-hidden mb-4 bg-primary/5">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-primary/10 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <LockKeyhole className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-base-content">Identity Lock</span>
          <span className="ml-2 text-xs text-base-content/50">
            {traitCount} trait{traitCount !== 1 ? 's' : ''} locked
          </span>
        </div>
        <span className="badge badge-primary badge-sm mr-1">Active</span>
        {isExpanded
          ? <ChevronUp  className="w-4 h-4 opacity-50 flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" />
        }
      </button>
      {isExpanded && (
        <div className="p-5 space-y-4 bg-base-100 border-t border-primary/20">
          <p className="text-xs text-base-content/50 flex items-center gap-1.5">
            <LockKeyhole className="w-3 h-3" />
            These traits are immutable and enforced in every sprite generation. They cannot be edited.
          </p>

          {/* Immutable traits */}
          {Object.entries(traits).map(([category, items]) =>
            items?.length > 0 ? (
              <div key={category}>
                <p className="text-xs font-semibold uppercase tracking-wider text-base-content/60 mb-1.5 capitalize">
                  {category}
                </p>
                <ul className="space-y-1">
                  {items.map((item, i) => (
                    <li key={i} className="text-xs text-base-content/80 flex items-start gap-1.5">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-primary flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          )}

          {/* Forbidden changes */}
          {identityLock?.forbidden_changes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-error/70 mb-1.5">
                Forbidden Changes
              </p>
              <ul className="space-y-1">
                {identityLock.forbidden_changes.map((f, i) => (
                  <li key={i} className="text-xs text-base-content/70 flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-error flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {identityLock?.notes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-base-content/60 mb-1.5">
                Notes
              </p>
              <ul className="space-y-1">
                {identityLock.notes.map((n, i) => (
                  <li key={i} className="text-xs text-base-content/70 flex items-start gap-1.5">
                    <span className="mt-1.5 w-1 h-1 rounded-full bg-base-content/40 flex-shrink-0" />
                    {n}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-xs italic text-base-content/40 pt-1">
            To update the identity lock, re-generate sprites with a new reference image.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── AllImagesSection ─────────────────────────────────────────────────
// Combined image gallery showing primary images + sprites in right panel.
// Each image has an ellipsis menu (⋮) with actions.
function AllImagesSection({ 
  characterId, 
  primaryImages, 
  spriteImages, 
  currentPrimaryUrl, 
  sessionCurrentImage,
  onSetPrimary,
  queryClient
}) {
  const [ctxOpenImg, setCtxOpenImg] = useState(null);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Combine and dedupe all images
  const allImages = useMemo(() => {
    const combined = [
      ...(primaryImages || []).map(url => ({ type: 'primary', url })),
      ...(spriteImages || []).map(img => ({ type: 'sprite', id: img.id, url: img.url, label: img.label })),
    ];
    // Dedupe by URL
    const seen = new Set();
    return combined.filter(img => {
      if (seen.has(img.url)) return false;
      seen.add(img.url);
      return true;
    });
  }, [primaryImages, spriteImages]);

  const handleDownload = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `character-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Download failed. Try right-clicking the image to save.');
    }
  };

  const handleSetPrimary = (url) => {
    onSetPrimary(url);
    setCtxOpenImg(null);
    toast('Image staged as primary — save to commit');
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await CharacterImage.delete(deleteTargetId);
      queryClient.invalidateQueries({ queryKey: ['character-images', characterId] });
      if (ctxOpenImg === deleteTargetId) setCtxOpenImg(null);
      setDeleteTargetId(null);
      toast.success('Image deleted.');
    } catch (err) {
      console.error('Delete sprite image failed:', err);
      setDeleteError("Couldn't delete image. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-base-content">All Images</span>
            </div>
            <span className="badge badge-sm">{allImages.length}</span>
          </div>
          <div
            className="grid gap-3 mt-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}
          >
            {allImages.map((img, i) => {
              const isPrimary = img.url === currentPrimaryUrl;
              const isCurrent = img.url === sessionCurrentImage;
              const isSprite = img.type === 'sprite';
              const imgId = isSprite ? img.id : `primary-${i}`;

              return (
                <div key={imgId} className="relative group">
                  <div className="aspect-[3/4] rounded-lg overflow-hidden bg-base-300">
                    <img
                      src={img.url}
                      alt={img.label || `Image ${i + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Badges */}
                  {(isPrimary || isCurrent) && (
                    <div className="absolute top-1 left-1 flex gap-1">
                      {isPrimary && <span className="badge badge-primary badge-xs">Primary</span>}
                      {isCurrent && <span className="badge badge-secondary badge-xs">Current</span>}
                    </div>
                  )}
                  {/* ⋮ Menu button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setCtxOpenImg(ctxOpenImg === imgId ? null : imgId); }}
                    className="absolute top-1 right-1 z-10 flex items-center justify-center rounded-lg bg-black/60 hover:bg-primary border-none text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ width: '24px', height: '24px' }}
                    aria-label={`Options for image ${i + 1}`}
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>
                  {/* Context menu dropdown */}
                  {ctxOpenImg === imgId && (
                    <div
                      className="absolute top-7 right-1 z-50 min-w-[140px] rounded-xl border shadow-lg overflow-hidden"
                      style={{ background: 'var(--fallback-b2, oklch(var(--b2)))' }}
                    >
                      <button
                        onClick={() => { handleDownload(img.url); setCtxOpenImg(null); }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-base-300 flex items-center gap-2"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      {!isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(img.url)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-base-300 flex items-center gap-2"
                        >
                          <ImageIcon className="w-3.5 h-3.5" />
                          Set as Primary
                        </button>
                      )}
                      {isSprite && (
                        <button
                          onClick={() => { setDeleteTargetId(img.id); setCtxOpenImg(null); }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-error/10 text-error flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTargetId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => { if (!isDeleting) setDeleteTargetId(null); }}
        >
          <div
            className="w-full max-w-sm bg-base-100 rounded-2xl border border-base-300 shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-base-content">Delete this image?</h2>
            <p className="text-sm text-base-content/60">
              This action cannot be undone. Deleted images will not restore any used image credits.
            </p>
            {deleteError && <p className="text-sm text-error">{deleteError}</p>}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteTargetId(null)} disabled={isDeleting} className="btn btn-ghost flex-1">
                Cancel
              </button>
              <button onClick={handleDeleteConfirm} disabled={isDeleting} className="btn btn-error flex-1 gap-2">
                {isDeleting && <span className="loading loading-spinner loading-sm" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── §7: SpriteImagesSection ─────────────────────────────────────────────────
// Responsive image grid of generated sprite images. Shown at bottom of detail
// page only when sprite_images is non-empty. Each thumbnail has download +
// delete buttons, and clicking the image opens an enhanced modal with prompt,
// seed editing, and edit-to-regenerate functionality.
function SpriteImagesSection({ characterId, spriteImages, queryClient, character }) {
  const [enlargedImg, setEnlargedImg]           = useState(null);
  const [deleteTargetId, setDeleteTargetId]     = useState(null);
  const [isDeleting, setIsDeleting]             = useState(false);
  const [deleteError, setDeleteError]           = useState(null);

  const handleDownload = async (url) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `sprite-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Download failed. Try right-clicking the image to save.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await CharacterImage.delete(deleteTargetId);
      queryClient.invalidateQueries({ queryKey: ['character-images', characterId] });
      if (enlargedImg?.id === deleteTargetId) setEnlargedImg(null);
      setDeleteTargetId(null);
      toast.success('Image deleted.');
    } catch (err) {
      console.error('Delete sprite image failed:', err);
      setDeleteError("Couldn't delete image. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="card bg-base-200 border border-base-300">
        <div className="card-body p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm text-base-content">Images</span>
            </div>
            <span className="badge badge-sm">{spriteImages.length}</span>
          </div>
          <div
            className="grid gap-3 mt-2"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))' }}
          >
            {spriteImages.map((img, i) => (
              <SpriteImageThumbnail
                key={img.id || img.url || i}
                img={img}
                onDownload={() => handleDownload(img.url)}
                onDelete={() => setDeleteTargetId(img.id)}
                onEnlarge={() => setEnlargedImg(img)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Enhanced image modal */}
      {enlargedImg && (
        <SpriteImageModal
          img={enlargedImg}
          character={character}
          onClose={() => setEnlargedImg(null)}
          onDelete={() => { setDeleteTargetId(enlargedImg.id); }}
          onDownload={() => handleDownload(enlargedImg.url)}
          onNewImageGenerated={(newImg) => {
            setEnlargedImg(newImg);
            queryClient.invalidateQueries({ queryKey: ['character-images', characterId] });
          }}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTargetId && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onClick={() => { if (!isDeleting) setDeleteTargetId(null); }}
        >
          <div
            className="w-full max-w-sm bg-base-100 rounded-2xl border border-base-300 shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-base-content">Delete this image?</h2>
            <p className="text-sm text-base-content/60">
              This action cannot be undone. Deleted images will not restore any used image credits.
            </p>
            {deleteError && (
              <p className="text-sm text-error flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {deleteError}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setDeleteTargetId(null); setDeleteError(null); }}
                disabled={isDeleting}
                className="btn btn-ghost flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="btn btn-error flex-1 gap-2"
              >
                {isDeleting && <span className="loading loading-spinner loading-sm" />}
                Delete Image
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── SpriteImageModal ─────────────────────────────────────────────────────────
// Enhanced modal for viewing and editing sprite images with:
// - Prominent image display
// - Collapsible prompt view (collapsed by default)
// - Seed display and editing (locked by default)
// - Edit-to-regenerate functionality
// - Updates modal image when new images are generated
function SpriteImageModal({ img, character, onClose, onDelete, onDownload, onNewImageGenerated }) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [editInstructions, setEditInstructions] = useState('');
  const [seed, setSeed] = useState(img?.seed ?? '');
  const [seedLocked, setSeedLocked] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [viewingImg, setViewingImg] = useState(img);
  const abortRef = useRef(null);

  useEffect(() => {
    if (img) {
      setViewingImg(img);
      setSeed(img?.seed ?? '');
      setSeedLocked(true);
      setEditInstructions('');
      setError(null);
    }
  }, [img]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (generating || !editInstructions.trim()) return;

    setGenerating(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const identityLock = character?.character_identity_lock || null;
      const consistencyPrompt = character?.character_consistency_prompt || '';
      const referenceImageUrl = viewingImg?.url || character?.generated_image_url || character?.reference_image_url || null;

      if (!referenceImageUrl) {
        setError('No reference image available. Please ensure the character has a reference image.');
        setGenerating(false);
        return;
      }

      const finalPrompt = compileEditPrompt({
        identityLock,
        consistencyPrompt,
        originalPoseId: viewingImg?.pose_id || viewingImg?.params_snapshot?.poseId || null,
        originalEmotionEntry: viewingImg?.emotion_entry || viewingImg?.params_snapshot?.emotionEntry || null,
        editInstructions: editInstructions.trim(),
        allowClothing: viewingImg?.params_snapshot?.allowClothing ?? false,
        allowProps: viewingImg?.params_snapshot?.allowProps ?? false,
      });

      const imageUrl = await generateImage({
        prompt: finalPrompt,
        referenceImageUrls: [referenceImageUrl].filter(Boolean),
        aspectRatio: viewingImg?.params_snapshot?.aspectRatio || '3:4',
        ...(seedLocked && seed ? { seed: parseInt(seed, 10) } : {}),
      }, controller.signal);

      const { data: { user } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser());
      const newEntry = await CharacterImage.add(character?.id, user?.id, {
        url: imageUrl,
        label: `Edit of ${viewingImg?.label || 'Sprite'}`,
        seed: seedLocked && seed ? parseInt(seed, 10) : null,
        poseId: viewingImg?.pose_id || viewingImg?.params_snapshot?.poseId || null,
        emotionEntry: viewingImg?.emotion_entry || viewingImg?.params_snapshot?.emotionEntry || null,
        paramsSnapshot: viewingImg?.params_snapshot || null,
        generationType: 'sprite-edit',
      });

      setViewingImg(newEntry);
      onNewImageGenerated(newEntry);
      toast.success('Image regenerated!');
    } catch (err) {
      if (err.name === 'AbortError' || err.message === 'Request cancelled') return;
      if (err instanceof LimitError) {
        setError(err.message);
      } else {
        setError(err.message || 'Regeneration failed. Please try again.');
      }
    } finally {
      setGenerating(false);
    }
  }, [generating, editInstructions, viewingImg, character, seedLocked, seed, onNewImageGenerated]);

  const displayPrompt = viewingImg?.params_snapshot?.prompt || 
                        viewingImg?.params_snapshot?.consistencyPrompt || 
                        viewingImg?.params_snapshot?.editInstructions ||
                        'Prompt not available';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-2xl sm:rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--fallback-b1, oklch(var(--b1)))',
          border: '1px solid var(--fallback-b3, oklch(var(--b3)))',
          maxHeight: '96vh',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--fallback-b3, oklch(var(--b3)))' }}
        >
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold text-base-content">
              {viewingImg?.label || 'Sprite'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onDownload}
              className="btn btn-ghost btn-sm btn-square"
              style={{ color: 'var(--fallback-bc, oklch(var(--bc))/0.6)' }}
              aria-label="Download image"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-square"
              style={{ color: 'var(--fallback-bc, oklch(var(--bc))/0.6)' }}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Image */}
          <div
            className="relative w-full bg-black flex items-center justify-center"
            style={{ minHeight: '200px', maxHeight: '50vh' }}
          >
            <img
              src={viewingImg?.url}
              alt={viewingImg?.label}
              className="w-full h-full object-contain"
              style={{ maxHeight: '50vh' }}
            />
            {generating && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <span className="loading loading-spinner loading-lg text-primary" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-4 space-y-4">
            {/* Seed */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--fallback-bc, oklch(var(--bc))/0.5)' }}
                >
                  Seed
                </label>
                <button
                  type="button"
                  onClick={() => setSeedLocked(s => !s)}
                  className="flex items-center gap-1.5 text-xs transition-colors"
                  style={{
                    color: seedLocked ? 'var(--fallback-p, oklch(var(--p)))' : 'var(--fallback-bc, oklch(var(--bc))/0.5)',
                  }}
                >
                  {seedLocked
                    ? <><Lock className="w-3 h-3" /> Locked</>
                    : <><Unlock className="w-3 h-3" /> Unlocked</>
                  }
                </button>
              </div>
              <input
                type="number"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="Auto-generated"
                disabled={seedLocked && !seed}
                className="w-full px-3 py-2 text-sm rounded-lg"
                style={{
                  background: 'var(--fallback-b2, oklch(var(--b2)))',
                  border: '1px solid var(--fallback-b3, oklch(var(--b3)))',
                  color: 'var(--fallback-bc, oklch(var(--bc)))',
                }}
              />
            </div>

            {/* Collapsible Prompt */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setPromptExpanded(e => !e)}
                className="flex items-center justify-between w-full text-left"
              >
                <label
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--fallback-bc, oklch(var(--bc))/0.5)' }}
                >
                  Prompt
                </label>
                {promptExpanded ? (
                  <ChevronUp className="w-4 h-4" style={{ color: 'var(--fallback-bc, oklch(var(--bc))/0.5)' }} />
                ) : (
                  <ChevronDown className="w-4 h-4" style={{ color: 'var(--fallback-bc, oklch(var(--bc))/0.5)' }} />
                )}
              </button>
              {promptExpanded && (
                <div
                  className="p-3 rounded-lg text-sm whitespace-pre-wrap"
                  style={{
                    background: 'var(--fallback-b2, oklch(var(--b2)))',
                    border: '1px solid var(--fallback-b3, oklch(var(--b3)))',
                    color: 'var(--fallback-bc, oklch(var(--bc)))',
                  }}
                >
                  {displayPrompt}
                </div>
              )}
            </div>

            {/* Edit Instructions */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--fallback-bc, oklch(var(--bc))/0.5)' }}
              >
                Edit Instructions
              </label>
              <textarea
                value={editInstructions}
                onChange={e => setEditInstructions(e.target.value)}
                placeholder="Describe what to change (e.g. 'face the camera', 'change hair color to blonde', 'have them kneeling')"
                rows={3}
                className="w-full px-3 py-2.5 text-sm rounded-xl resize-none"
                style={{
                  background: 'var(--fallback-b2, oklch(var(--b2)))',
                  border: '1px solid var(--fallback-b3, oklch(var(--b3)))',
                  color: 'var(--fallback-bc, oklch(var(--bc)))',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--fallback-p, oklch(var(--p)))'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--fallback-b3, oklch(var(--b3)))'; }}
              />
              <p className="text-xs" style={{ color: 'var(--fallback-bc, oklch(var(--bc))/0.5)' }}>
                Character identity remains locked. Focus edits on pose, expression, or allowed changes.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl text-sm"
                style={{ background: '#ef444415', border: '1px solid #ef444440', color: '#ef4444' }}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onDelete}
                className="btn btn-ghost btn-sm gap-1.5"
                style={{ color: '#ef4444' }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
              <div className="flex-1" />
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--fallback-bc, oklch(var(--bc))/0.6)' }}
              >
                Done
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                disabled={generating || !editInstructions.trim()}
                className="btn btn-sm gap-2"
                style={{
                  background: (!generating && editInstructions.trim()) 
                    ? 'linear-gradient(135deg, var(--fallback-p, oklch(var(--p))), var(--fallback-p2, oklch(var(--p2))))' 
                    : undefined,
                  border: 'none',
                  color: (!generating && editInstructions.trim()) ? 'white' : undefined,
                }}
              >
                {generating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerating…</>
                  : <><Sparkles className="w-3.5 h-3.5" /> Regenerate</>
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SpriteImageThumbnail ────────────────────────────────────────────────────
// Single image card within the sprite images grid.
function SpriteImageThumbnail({ img, onDownload, onDelete, onEnlarge }) {
  return (
    <div
      className="relative rounded-xl overflow-hidden group"
      style={{ aspectRatio: 'auto' }}
    >
      {/* Clickable image area */}
      <button
        onClick={onEnlarge}
        className="w-full block"
        aria-label="View enlarged"
      >
        <img
          src={img.url}
          alt="Sprite"
          className="w-full object-cover rounded-xl"
        />
      </button>

      {/* Download — top left */}
      <button
        onClick={e => { e.stopPropagation(); onDownload(); }}
        className="absolute top-2 left-2 btn btn-xs btn-ghost bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-lg
          md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        aria-label="Download image"
        style={{ minWidth: '28px', minHeight: '28px' }}
      >
        <Download className="w-3.5 h-3.5" />
      </button>

      {/* Delete — top right */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-2 right-2 btn btn-xs btn-error btn-soft p-1.5 rounded-lg
          md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        aria-label="Delete image"
        style={{ minWidth: '28px', minHeight: '28px' }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
