import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Save, Sparkles, ChevronRight } from 'lucide-react';

import { useDraftPersistence } from '../lib/hooks/useDraftPersistence';
import { CharacterDraft, Character } from '../lib/storage';
import { synthesizeCharacterImagePrompt, generateCharacterImage, generateCharacterManifest } from '../lib/anthropic';

import CharacterIdentityForm from '../components/character/CharacterIdentityForm';
import AppearanceForm        from '../components/character/AppearanceForm';
import PromptPreviewPanel    from '../components/character/PromptPreviewPanel';
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
  backstory_summary: '', formative_event: '', relationship_to_protagonist: '',
  relationship_to_authority: '', relationship_to_peers: '', relationship_to_love_interest: '',
  world_context: '', knowledge_domain: [], tone_of_voice: '', verbal_quirks: [],
  internal_monologue_style: '', consistency_anchors: [], contradiction_points: [],
  appearance: {}, image_prompt: {}, seed: null, seed_locked: false,
  creation_status: 'draft', generated_image_url: null, fal_job_id: null,
};

const STEPS = [
  { id: 1, label: 'Identity' },
  { id: 2, label: 'Appearance' },
  { id: 3, label: 'Generate' },
];

export default function GenerateCharacterPage() {
  const navigate      = useNavigate();
  const { draftId }   = useParams();
  const [searchParams]  = useSearchParams();
  const storyIdParam    = searchParams.get('storyId');
  const { user }        = useAuth();

  const [formData,           setFormData]           = useState(INITIAL_FORM_STATE);
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [imageHistory,       setImageHistory]       = useState([]);
  const [showExitModal,      setShowExitModal]      = useState(false);
  const [pendingNavigation,  setPendingNavigation]  = useState(null);
  const [isGenerating,       setIsGenerating]       = useState(false);
  const [isFinalizing,       setIsFinalizing]       = useState(false);
  const [phase,              setPhase]              = useState(1);

  const abortControllerRef = useRef(null);

  const { draft, isDirty, lastSaved, updateState, saveNow, isInitialized } = useDraftPersistence(draftId, user?.id);
  const [isNewDraft, setIsNewDraft] = useState(false);

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

  useEffect(() => {
    if (storyIdParam && !formData.assigned_story_id) {
      setFormData(prev => ({ ...prev, assigned_story_id: storyIdParam }));
    }
  }, [storyIdParam, formData.assigned_story_id]);

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

  const handleFormChange        = useCallback((updates) => setFormData(prev => { const n = { ...prev, ...updates }; updateState(n); return n; }), [updateState]);
  const handleAppearanceChange  = useCallback((a)       => setFormData(prev => { const n = { ...prev, appearance: a }; updateState(n); return n; }), [updateState]);
  const handleSeedChange        = useCallback((seed)    => setFormData(prev => { const n = { ...prev, seed }; updateState(n); return n; }), [updateState]);
  const handleSeedLockToggle    = useCallback((locked)  => setFormData(prev => { const n = { ...prev, seed_locked: locked }; updateState(n); return n; }), [updateState]);
  const handleJsonChange        = useCallback((json)    => setFormData(prev => { const n = { ...prev, ...json }; updateState(n); return n; }), [updateState]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();
    try {
      const characterData = { ...formData, appearance: formData.appearance || {} };
      const imagePrompt   = await synthesizeCharacterImagePrompt(characterData);
      const result        = await generateCharacterImage(
        { prompt: imagePrompt, seed: formData.seed_locked ? formData.seed : null },
        abortControllerRef.current.signal
      );
      const newHistory    = [result.url, ...imageHistory.filter(u => u !== result.url)].slice(0, 10);
      setImageHistory(newHistory);
      const updatedData   = { ...formData, generated_image_url: result.url, fal_job_id: result.jobId, seed: result.seed || formData.seed, image_prompt: { ...formData.image_prompt, synthesized_prompt: imagePrompt }, creation_status: 'in_progress' };
      setFormData(updatedData); updateState(updatedData);
      toast.success('Character image generated!');
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Request cancelled') return;
      toast.error('Failed to generate character image. Please try again.');
    } finally { setIsGenerating(false); }
  }, [formData, imageHistory, updateState]);

  const handleRegenerate = useCallback(async (prompt) => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();
    try {
      const characterData = { ...formData, appearance: formData.appearance || {} };
      const basePrompt    = await synthesizeCharacterImagePrompt(characterData);
      const finalPrompt   = prompt ? `${basePrompt}. ${prompt}` : basePrompt;
      const result        = await generateCharacterImage(
        { prompt: finalPrompt, seed: formData.seed_locked ? formData.seed : null },
        abortControllerRef.current.signal
      );
      const newHistory = [result.url, ...imageHistory.filter(u => u !== result.url)].slice(0, 10);
      setImageHistory(newHistory);
      const updatedData = { ...formData, generated_image_url: result.url, fal_job_id: result.jobId, seed: result.seed || formData.seed };
      setFormData(updatedData); updateState(updatedData);
      toast.success('Character regenerated!');
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Request cancelled') return;
      toast.error('Failed to regenerate. Please try again.');
    } finally { setIsGenerating(false); }
  }, [formData, imageHistory, updateState]);

  const handleRegenerateWithoutInput = useCallback(async () => { await handleRegenerate(''); }, [handleRegenerate]);

  const handleFinalize = useCallback(async () => {
    if (!formData.character_name)       { toast.error('Character name is required for finalization'); return; }
    if (!formData.generated_image_url)  { toast.error('Please generate an image before finalization'); return; }

    const required = [
      { key: 'character_role', label: 'Role in Story' }, { key: 'archetype', label: 'Archetype' },
      { key: 'narrative_function', label: 'Narrative Function' }, { key: 'age', label: 'Age' },
      { key: 'sex', label: 'Sex' }, { key: 'gender_expression', label: 'Gender Expression' },
      { key: 'species_or_race', label: 'Species/Race' }, { key: 'nationality_or_origin', label: 'Nationality/Origin' },
      { key: 'social_class', label: 'Social Class' }, { key: 'occupation_or_role', label: 'Occupation/Role' },
      { key: 'backstory_summary', label: 'Backstory Summary' }, { key: 'formative_event', label: 'Formative Event' },
      { key: 'relationship_to_protagonist', label: 'Relationship to Protagonist' },
    ];
    const missing = required.filter(f => { const v = formData[f.key]; return !v || (Array.isArray(v) && v.length === 0); });
    if (missing.length > 0) { toast.error(`Please fill in: ${missing.map(f => f.label).join(', ')}`); return; }

    setIsFinalizing(true);
    try {
      const characterData    = { ...formData, appearance: formData.appearance || {} };
      const manifestResult   = await generateCharacterManifest(characterData);
      let finalImageUrl      = formData.generated_image_url;
      let finalImageHistory  = imageHistory;
      let finalFalJobId      = formData.fal_job_id;
      let finalSeed          = formData.seed;

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

      const transformedData = { ...formData, emotional_triggers: { positive: formData.emotional_triggers_positive || [], negative: formData.emotional_triggers_negative || [] } };
      delete transformedData.emotional_triggers_positive;
      delete transformedData.emotional_triggers_negative;

      const characterRecord = sanitizeForStorage({ ...transformedData, character_manifest: manifestResult.manifest, creation_status: 'finalized', generated_image_url: finalImageUrl, fal_job_id: finalFalJobId, seed: finalSeed, image_history: finalImageHistory });
      const created = await Character.create(user.id, characterRecord);

      if (draftId) {
        await CharacterDraft.delete(draftId);
        localStorage.removeItem(`character_draft_${draftId}`);
      }

      toast.success('Character finalized!');
      navigate(`/characters/${created.id}`);
    } catch (error) {
      console.error('Finalization failed:', error);
      toast.error('Failed to finalize character. Please try again.');
    } finally { setIsFinalizing(false); }
  }, [formData, imageHistory, user, draftId, navigate]);

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

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-5xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavigate('/characters')}
              className="btn btn-ghost btn-sm"
            >
              View Characters
            </button>
            <button
              onClick={saveNow}
              disabled={!isDirty}
              className="btn btn-neutral btn-sm gap-2"
              style={{ minHeight: '40px' }}
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>
          </div>
        </div>

        {/* DaisyUI Steps */}
        <ul className="steps steps-horizontal w-full mb-8">
          {STEPS.map(step => (
            <li
              key={step.id}
              className={`step ${phase >= step.id ? 'step-primary' : ''} cursor-pointer`}
              onClick={() => setPhase(step.id)}
            >
              {step.label}
            </li>
          ))}
        </ul>

        {/* Phase content */}
        <div className="space-y-6">
          {phase === 1 && (
            <CharacterIdentityForm
              formData={formData}
              onChange={handleFormChange}
              disabled={isGenerating || isFinalizing}
            />
          )}

          {phase === 2 && (
            <AppearanceForm
              isExpanded={appearanceExpanded}
              onToggle={() => setAppearanceExpanded(!appearanceExpanded)}
              appearanceData={formData.appearance || {}}
              onChange={handleAppearanceChange}
              disabled={isGenerating || isFinalizing}
            />
          )}

          {phase === 3 && !showImageContext && (
            <PromptPreviewPanel
              characterData={formData}
              onJsonChange={handleJsonChange}
              onSeedChange={handleSeedChange}
              onSeedLockToggle={handleSeedLockToggle}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              disabled={isFinalizing}
            />
          )}

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
                className="btn btn-ghost"
                style={{ minHeight: '44px' }}
              >
                Back
              </button>
            ) : <div />}

            {phase < 3 && (
              <button
                onClick={() => setPhase(phase + 1)}
                className="btn btn-primary gap-2"
                style={{ minHeight: '44px' }}
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
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
