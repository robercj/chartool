import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Save, Sparkles, ChevronRight, FileText, AlertTriangle, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

import { useDraftPersistence } from '../lib/hooks/useDraftPersistence';
import { CharacterDraft, Character } from '../lib/storage';
import {
  generateCharacterImage,
  generateCharacterManifest,
  generateCharacterIdentityPrompt,
  generateAppearanceDescription,
} from '../lib/anthropic';

import CharacterIdentityForm from '../components/character/CharacterIdentityForm';
import AppearanceForm        from '../components/character/AppearanceForm';
import ImageEditContext      from '../components/character/ImageEditContext';
import ExitConfirmationModal from '../components/character/ExitConfirmationModal';

function sanitizeForStorage(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || typeof value === 'function') continue;
    sanitized[key] = typeof value === 'object' && value !== null && !Array.isArray(value)
      ? sanitizeForStorage(value)
      : value;
  }
  return sanitized;
}

const INITIAL_FORM_STATE = {
  character_name: '', character_role: '', archetype: '', narrative_function: '',
  assigned_story_id: null, age: '', sex: null, gender_expression: null,
  species_or_race: '', nationality_or_origin: '', social_class: null, occupation_or_role: '',
  dere_presets: [], custom_personality_modifier: '', personality_mode: 'preset_only',
  surface_traits: [], hidden_traits: [], emotional_triggers_positive: [], emotional_triggers_negative: [],
  speech_pattern: '', behavioral_tendencies: [], moral_alignment: '', values_and_beliefs: [],
  fears_and_insecurities: [], surface_goal: '', deep_desire: '', internal_conflict: '',
  backstory_summary: '', formative_event: '', knowledge_domain: [],
  relationships: [],       // v2: replaces the four static relationship_to_* fields
  tone_of_voice: '', verbal_quirks: [], consistency_anchors: [], contradiction_points: [],
  appearance: {}, image_prompt: {}, seed: null, seed_locked: false,
  creation_status: 'draft', generated_image_url: null, fal_job_id: null,
  character_prompt: null,        // v2: identity-step AI prompt, set on Step 1 "Continue"
  appearance_description: null,  // v2: appearance description for image generation
};

// Two-step architecture (v2)
const STEPS = [
  { id: 1, label: 'Identity' },
  { id: 2, label: 'Appearance' },
];

export default function GenerateCharacterPage() {
  const navigate      = useNavigate();
  const { draftId }   = useParams();
  const [searchParams]  = useSearchParams();
  const storyIdParam    = searchParams.get('storyId');
  const { user, checkLimit } = useAuth();

  const [formData,                     setFormData]                     = useState(INITIAL_FORM_STATE);
  const [imageHistory,                 setImageHistory]                 = useState([]);
  const [showExitModal,                setShowExitModal]                = useState(false);
  const [pendingNavigation,            setPendingNavigation]            = useState(null);
  const [phase,                        setPhase]                        = useState(1);

  // Identity step loading / error
  const [isGeneratingIdentityPrompt,   setIsGeneratingIdentityPrompt]   = useState(false);
  const [identityPromptError,          setIdentityPromptError]          = useState(null);

  // Appearance description loading / error
  const [isGeneratingDescription,      setIsGeneratingDescription]      = useState(false);
  const [appearanceDescriptionError,   setAppearanceDescriptionError]   = useState(null);
  const [appearanceChangedAfterDesc,   setAppearanceChangedAfterDesc]   = useState(false);

  // Image generation / finalization
  const [isGenerating,                 setIsGenerating]                 = useState(false);
  const [isFinalizing,                 setIsFinalizing]                 = useState(false);

  const abortControllerRef = useRef(null);

  const { draft, isDirty, lastSaved, updateState, saveNow, isInitialized, handleFieldBlur } = useDraftPersistence(draftId, user?.id);
  const [isNewDraft, setIsNewDraft] = useState(false);
  const [, setAppearanceExpanded] = useState(true);

  // Load draft into local state on mount / change
  useEffect(() => {
    if (draft) {
      setFormData(prev => ({ ...prev, ...draft }));
      if (draft.appearance && Object.keys(draft.appearance).length > 0) setAppearanceExpanded(true);
      if (draft.generated_image_url) {
        setImageHistory(prev => {
          const history = prev.filter(url => url !== draft.generated_image_url);
          return [draft.generated_image_url, ...history];
        });
      }
    }
  }, [draft]);

  // Pre-fill story assignment from query param
  useEffect(() => {
    if (storyIdParam && !formData.assigned_story_id) {
      setFormData(prev => ({ ...prev, assigned_story_id: storyIdParam }));
    }
  }, [storyIdParam, formData.assigned_story_id]);

  // Auto-create draft record if arriving without an id
  useEffect(() => {
    if (!draftId && user && !isNewDraft && isInitialized) {
      const createNewDraft = async () => {
        setIsNewDraft(true);
        try {
          const newDraft = await CharacterDraft.create(user.id, {
            ...INITIAL_FORM_STATE,
            draft_saved_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
          });
          navigate(`/characters/generate/${newDraft.id}`, { replace: true });
        } catch (error) {
          console.error('Failed to create draft:', error);
          toast.error('Failed to create character draft');
        }
      };
      createNewDraft();
    }
  }, [draftId, user, isNewDraft, isInitialized, navigate]);

  // ── Change handlers ────────────────────────────────────────────────────────
  const handleFormChange = useCallback((updates) => {
    setFormData(prev => { const n = { ...prev, ...updates }; updateState(n); return n; });
  }, [updateState]);

  const handleAppearanceChange = useCallback((a) => {
    // If a description was already generated, mark it as potentially stale
    if (formData.appearance_description) setAppearanceChangedAfterDesc(true);
    setFormData(prev => {
      const n = { ...prev, appearance: a };
      updateState(n);
      return n;
    });
  }, [formData.appearance_description, updateState]);

  const handleSeedChange       = useCallback((seed)   => setFormData(prev => { const n = { ...prev, seed };           updateState(n); return n; }), [updateState]);
  const handleSeedLockToggle   = useCallback((locked) => setFormData(prev => { const n = { ...prev, seed_locked: locked }; updateState(n); return n; }), [updateState]);
  const handleJsonChange       = useCallback((json)   => setFormData(prev => { const n = { ...prev, ...json };        updateState(n); return n; }), [updateState]);

  // ── Step 1 → Step 2: identity prompt trigger ──────────────────────────────
  const handleContinueFromIdentity = useCallback(async () => {
    if (!formData.character_name?.trim()) {
      toast.error('Character name is required to continue');
      return;
    }

    const limitCheck = checkLimit('character');
    if (!limitCheck.allowed) {
      toast.error(limitCheck.reason);
      return;
    }

    setIsGeneratingIdentityPrompt(true);
    setIdentityPromptError(null);

    try {
      const identityPrompt = await generateCharacterIdentityPrompt(formData);
      const updatedData = {
        ...formData,
        character_prompt: identityPrompt,
        creation_status: 'in_progress',
      };
      setFormData(updatedData);
      updateState(updatedData);
      setPhase(2);
      toast.success('Character prompt generated!');
    } catch (error) {
      const msg = error.message || 'Failed to generate character prompt';
      setIdentityPromptError(msg);
      toast.error("Couldn't generate character prompt. Please try again.");
    } finally {
      setIsGeneratingIdentityPrompt(false);
    }
  }, [formData, updateState, checkLimit]);

  // ── Appearance description generation ─────────────────────────────────────
  const handleGenerateAppearanceDescription = useCallback(async () => {
    const limitCheck = checkLimit('character');
    if (!limitCheck.allowed) {
      toast.error(limitCheck.reason);
      return;
    }

    setIsGeneratingDescription(true);
    setAppearanceDescriptionError(null);

    try {
      const description = await generateAppearanceDescription(formData.appearance || {});
      const updatedData = { ...formData, appearance_description: description };
      setFormData(updatedData);
      updateState(updatedData);
      setAppearanceChangedAfterDesc(false);
      toast.success('Appearance description generated!');
    } catch (error) {
      const msg = error.message || 'Failed to generate appearance description';
      setAppearanceDescriptionError(msg);
      toast.error('Failed to generate appearance description. Please try again.');
    } finally {
      setIsGeneratingDescription(false);
    }
  }, [formData, updateState, checkLimit]);

  // ── Image generation (uses stored appearance_description — no new Claude call) ──
  const handleGenerate = useCallback(async () => {
    if (!formData.appearance_description) {
      toast.error('Generate an appearance description first');
      return;
    }

    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      const result = await generateCharacterImage(
        { prompt: formData.appearance_description, seed: formData.seed_locked ? formData.seed : null },
        abortControllerRef.current.signal
      );
      const newHistory = [result.url, ...imageHistory.filter(u => u !== result.url)].slice(0, 10);
      setImageHistory(newHistory);
      const updatedData = {
        ...formData,
        generated_image_url: result.url,
        fal_job_id: result.jobId,
        seed: result.seed || formData.seed,
        creation_status: 'in_progress',
      };
      setFormData(updatedData);
      updateState(updatedData);
      toast.success('Character image generated!');
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Request cancelled') return;
      toast.error('Failed to generate character image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [formData, imageHistory, updateState]);

  // ── Regeneration (also uses stored appearance_description) ────────────────
  const handleRegenerate = useCallback(async (prompt) => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      const basePrompt  = formData.appearance_description || '';
      const finalPrompt = prompt ? `${basePrompt}. ${prompt}` : basePrompt;

      if (!finalPrompt.trim()) {
        toast.error('No appearance description available — generate one first');
        return;
      }

      const result = await generateCharacterImage(
        { prompt: finalPrompt, seed: formData.seed_locked ? formData.seed : null },
        abortControllerRef.current.signal
      );
      const newHistory = [result.url, ...imageHistory.filter(u => u !== result.url)].slice(0, 10);
      setImageHistory(newHistory);
      const updatedData = {
        ...formData,
        generated_image_url: result.url,
        fal_job_id: result.jobId,
        seed: result.seed || formData.seed,
      };
      setFormData(updatedData);
      updateState(updatedData);
      toast.success('Character regenerated!');
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Request cancelled') return;
      toast.error('Failed to regenerate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [formData, imageHistory, updateState]);

  const handleRegenerateWithoutInput = useCallback(async () => {
    await handleRegenerate('');
  }, [handleRegenerate]);

  // ── Finalization ──────────────────────────────────────────────────────────
  const handleFinalize = useCallback(async () => {
    if (!formData.character_name)      { toast.error('Character name is required for finalization'); return; }
    if (!formData.generated_image_url) { toast.error('Please generate an image before finalization'); return; }

    const required = [
      { key: 'character_role',         label: 'Role in Story' },
      { key: 'archetype',              label: 'Archetype' },
      { key: 'narrative_function',     label: 'Narrative Function' },
      { key: 'age',                    label: 'Age' },
      { key: 'sex',                    label: 'Sex' },
      { key: 'gender_expression',      label: 'Gender Expression' },
      { key: 'species_or_race',        label: 'Species/Race' },
      { key: 'nationality_or_origin',  label: 'Nationality/Origin' },
      { key: 'social_class',           label: 'Social Class' },
      { key: 'occupation_or_role',     label: 'Occupation/Role' },
      { key: 'backstory_summary',      label: 'Backstory Summary' },
      { key: 'formative_event',        label: 'Formative Event' },
      // relationship_to_protagonist removed in v2 — relationships array is optional
    ];
    const missing = required.filter(f => { const v = formData[f.key]; return !v || (Array.isArray(v) && v.length === 0); });
    if (missing.length > 0) { toast.error(`Please fill in: ${missing.map(f => f.label).join(', ')}`); return; }

    // Only need a character quota slot if we don't already have a manifest from Step 1
    if (!formData.character_prompt) {
      const limitCheck = checkLimit('character');
      if (!limitCheck.allowed) {
        toast.error(limitCheck.reason);
        return;
      }
    }

    setIsFinalizing(true);
    try {
      // Use character_prompt generated at identity step if available;
      // otherwise fall back to generating the manifest at finalization time.
      let manifest = formData.character_prompt || null;
      let finalImageUrl     = formData.generated_image_url;
      let finalImageHistory = imageHistory;
      let finalFalJobId     = formData.fal_job_id;
      let finalSeed         = formData.seed;

      if (!manifest) {
        const characterData = { ...formData, appearance: formData.appearance || {} };
        const manifestResult = await generateCharacterManifest(characterData);
        manifest = manifestResult.manifest;

        if (!finalImageUrl && manifestResult.imagePrompt) {
          const imgResult = await generateCharacterImage(
            { prompt: manifestResult.imagePrompt, seed: formData.seed_locked ? formData.seed : null },
            abortControllerRef.current?.signal
          );
          finalImageUrl     = imgResult.url;
          finalFalJobId     = imgResult.jobId;
          finalSeed         = imgResult.seed || formData.seed;
          finalImageHistory = [imgResult.url, ...imageHistory].slice(0, 10);
        }
      }

      // Transform emotional triggers to JSONB format
      const transformedData = {
        ...formData,
        emotional_triggers: {
          positive: formData.emotional_triggers_positive || [],
          negative: formData.emotional_triggers_negative || [],
        },
      };
      delete transformedData.emotional_triggers_positive;
      delete transformedData.emotional_triggers_negative;

      const characterRecord = sanitizeForStorage({
        ...transformedData,
        character_manifest: manifest,
        character_prompt: formData.character_prompt || manifest,
        appearance_description: formData.appearance_description || null,
        creation_status: 'finalized',
        generated_image_url: finalImageUrl,
        fal_job_id: finalFalJobId,
        seed: finalSeed,
        image_history: finalImageHistory,
      });

      const created = await Character.create(user.id, characterRecord);

      if (draftId) {
        await CharacterDraft.delete(draftId);
        localStorage.removeItem(`character_draft_${draftId}`);
      }

      toast.success('Character finalized!');
      navigate(`/characters/${created.id}`);
    } catch (error) {
      console.error('Finalization failed:', error);
      if (error?.code === '23505' || error?.message?.includes('duplicate key') || error?.message?.includes('idx_characters_user_id_character_name')) {
        toast.error(`A character named "${formData.character_name}" already exists. Please choose a different name.`);
      } else {
        toast.error('Failed to finalize character. Please try again.');
      }
    } finally {
      setIsFinalizing(false);
    }
  }, [formData, imageHistory, user, draftId, navigate, checkLimit]);

  // ── Navigation guard ──────────────────────────────────────────────────────
  const handleNavigate = useCallback((to) => {
    if (isDirty) { setPendingNavigation(to); setShowExitModal(true); }
    else         { navigate(to); }
  }, [isDirty, navigate]);

  const handleSaveAndLeave = useCallback(async () => {
    await saveNow();
    setShowExitModal(false);
    if (pendingNavigation) navigate(pendingNavigation);
  }, [saveNow, pendingNavigation, navigate]);

  const handleLeaveWithoutSaving = useCallback(() => {
    setShowExitModal(false);
    if (pendingNavigation) navigate(pendingNavigation);
  }, [pendingNavigation, navigate]);

  const showImageContext = formData.generated_image_url || imageHistory.length > 0;
  const anyBusy = isGenerating || isFinalizing || isGeneratingIdentityPrompt || isGeneratingDescription;

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Back to characters */}
          <button
            onClick={() => handleNavigate('/characters')}
            className="btn btn-ghost btn-sm flex-shrink-0 gap-1.5"
            aria-label="Back to characters"
            style={{ minHeight: '44px' }}
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Characters</span>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-base-content flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-primary" />
              Generate Character
            </h1>
            {draftId && lastSaved && (
              <p className="text-sm text-base-content/50 mt-1">
                Draft saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                {isDirty && ' (unsaved changes)'}
              </p>
            )}
          </div>

          <button
            onClick={saveNow}
            disabled={!isDirty}
            className="btn btn-neutral btn-sm gap-2 flex-shrink-0"
            style={{ minHeight: '40px' }}
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
        </div>

        {/* DaisyUI Steps — two-step architecture (v2) */}
        <ul className="steps steps-horizontal w-full mb-8">
          {STEPS.map(step => (
            <li
              key={step.id}
              className={`step ${phase >= step.id ? 'step-primary' : ''} cursor-pointer`}
              onClick={() => !anyBusy && setPhase(step.id)}
            >
              {step.label}
            </li>
          ))}
        </ul>

        {/* Phase content */}
        <div className="space-y-6">

          {/* ── Step 1: Identity ─────────────────────────────────────────── */}
          {phase === 1 && (
            <CharacterIdentityForm
              formData={formData}
              onChange={handleFormChange}
              onBlur={handleFieldBlur}
              disabled={anyBusy}
            />
          )}

          {/* ── Step 2: Appearance + generation controls ──────────────────── */}
          {phase === 2 && !showImageContext && (
            <>
              <AppearanceForm
                appearanceData={formData.appearance || {}}
                onChange={handleAppearanceChange}
                onBlur={handleFieldBlur}
                disabled={anyBusy}
                characterData={formData}
                onJsonChange={handleJsonChange}
                onSeedChange={handleSeedChange}
                onSeedLockToggle={handleSeedLockToggle}
              />

              {/* Appearance description error */}
              {appearanceDescriptionError && (
                <div className="alert alert-error">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-sm">{appearanceDescriptionError}</span>
                  <button
                    onClick={handleGenerateAppearanceDescription}
                    className="btn btn-sm btn-ghost gap-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry
                  </button>
                </div>
              )}

              {/* Stale appearance warning (non-blocking) */}
              {formData.appearance_description && appearanceChangedAfterDesc && (
                <div className="alert alert-warning">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm">
                    Appearance changed — regenerate description for best results.
                  </span>
                </div>
              )}

              {/* Appearance description preview (if generated) */}
              {formData.appearance_description && !appearanceChangedAfterDesc && (
                <div className="p-4 rounded-xl bg-base-200 border border-base-300 space-y-2">
                  <p className="text-xs font-medium text-base-content/60 uppercase tracking-wide">
                    Appearance Description
                  </p>
                  <p className="text-sm text-base-content/80 leading-relaxed">
                    {formData.appearance_description}
                  </p>
                </div>
              )}

              {/* ── Two action buttons (side-by-side) ────────────────────── */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleGenerateAppearanceDescription}
                  disabled={isGeneratingDescription || isGenerating || isFinalizing}
                  className="btn btn-secondary flex-1 gap-2"
                  style={{ minHeight: '48px' }}
                >
                  {isGeneratingDescription ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Generating Description...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      Generate Appearance Description
                    </>
                  )}
                </button>

                <button
                  onClick={handleGenerate}
                  disabled={!formData.appearance_description || isGenerating || isFinalizing || isGeneratingDescription}
                  className="btn btn-primary flex-1 gap-2"
                  style={{ minHeight: '48px' }}
                  aria-disabled={!formData.appearance_description}
                  title={!formData.appearance_description ? 'Generate an appearance description first' : undefined}
                >
                  {isGenerating ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Generating Image...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Character Image
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {/* ── Image edit context (renders over Step 2 once image exists) ── */}
          {showImageContext && (
            <ImageEditContext
              generatedImageUrl={formData.generated_image_url}
              imageHistory={imageHistory}
              seed={formData.seed}
              seedLocked={formData.seed_locked}
              onSeedChange={handleSeedChange}
              onSeedLockToggle={handleSeedLockToggle}
              onRegenerate={handleRegenerate}
              onRegenerateWithoutInput={handleRegenerateWithoutInput}
              onFinalize={handleFinalize}
              isGenerating={isGenerating}
              isFinalizing={isFinalizing}
              disabled={isFinalizing}
            />
          )}
        </div>

        {/* Step navigation */}
        {!showImageContext && (
          <div className="flex justify-between mt-8 pt-6 border-t border-base-300">
            {phase > 1 ? (
              <button
                onClick={() => setPhase(phase - 1)}
                disabled={anyBusy}
                className="btn btn-ghost"
                style={{ minHeight: '44px' }}
              >
                Back
              </button>
            ) : <div />}

            {/* Step 1 Continue — triggers identity prompt generation */}
            {phase === 1 && (
              <div className="flex flex-col items-end gap-2">
                {identityPromptError && (
                  <p className="text-sm text-error">{identityPromptError}</p>
                )}
                <button
                  onClick={handleContinueFromIdentity}
                  disabled={isGeneratingIdentityPrompt}
                  className="btn btn-primary gap-2"
                  style={{ minHeight: '44px' }}
                >
                  {isGeneratingIdentityPrompt ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Generating Prompt...
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ExitConfirmationModal
        isOpen={showExitModal}
        onClose={() => setShowExitModal(false)}
        onSaveAndLeave={handleSaveAndLeave}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        characterName={formData.character_name || 'Untitled Character'}
      />
    </div>
  );
}
