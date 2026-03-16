import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Wand2, Save, Loader2, AlertTriangle, Sparkles, ChevronRight } from 'lucide-react';

import { useDraftPersistence } from '../lib/hooks/useDraftPersistence';
import { CharacterDraft, Character } from '../lib/storage';
import { synthesizeCharacterImagePrompt, generateCharacterImage, generateCharacterManifest } from '../lib/anthropic';

import CharacterIdentityForm from '../components/character/CharacterIdentityForm';
import AppearanceForm from '../components/character/AppearanceForm';
import PromptPreviewPanel from '../components/character/PromptPreviewPanel';
import ImageEditContext from '../components/character/ImageEditContext';
import ExitConfirmationModal from '../components/character/ExitConfirmationModal';

const INITIAL_FORM_STATE = {
  character_name: '',
  character_role: '',
  archetype: '',
  narrative_function: '',
  assigned_story_id: null,
  age: '',
  sex: null,
  gender_expression: null,
  species_or_race: '',
  nationality_or_origin: '',
  social_class: null,
  occupation_or_role: '',
  dere_presets: [],
  custom_personality_modifier: '',
  personality_mode: 'preset_only',
  surface_traits: [],
  hidden_traits: [],
  emotional_triggers_positive: [],
  emotional_triggers_negative: [],
  speech_pattern: '',
  behavioral_tendencies: [],
  moral_alignment: '',
  values_and_beliefs: [],
  fears_and_insecurities: [],
  surface_goal: '',
  deep_desire: '',
  internal_conflict: '',
  backstory_summary: '',
  formative_event: '',
  relationship_to_protagonist: '',
  relationship_to_authority: '',
  relationship_to_peers: '',
  relationship_to_love_interest: '',
  world_context: '',
  knowledge_domain: [],
  tone_of_voice: '',
  verbal_quirks: [],
  internal_monologue_style: '',
  consistency_anchors: [],
  contradiction_points: [],
  appearance: {},
  image_prompt: {},
  seed: null,
  seed_locked: false,
  creation_status: 'draft',
  generated_image_url: null,
  fal_job_id: null,
};

export default function GenerateCharacterPage() {
  const navigate = useNavigate();
  const { draftId } = useParams();
  const [searchParams] = useSearchParams();
  const storyIdParam = searchParams.get('storyId');
  const { user } = useAuth();
  
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [imageHistory, setImageHistory] = useState([]);
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [phase, setPhase] = useState(1);
  
  const abortControllerRef = useRef(null);
  const navigateRef = useRef(navigate);

  const { draft, isDirty, lastSaved, updateState, saveNow } = useDraftPersistence(
    draftId,
    user?.id
  );

  useEffect(() => {
    if (draft) {
      setFormData(prev => ({ ...prev, ...draft }));
      if (draft.appearance) {
        setAppearanceExpanded(true);
      }
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
    if (!draftId && user) {
      const createNewDraft = async () => {
        try {
          const newDraft = await CharacterDraft.create(user.id, {
            ...INITIAL_FORM_STATE,
            draft_saved_at: new Date().toISOString(),
            last_modified_at: new Date().toISOString(),
          });
          navigateRef.current.replace(`/characters/generate/${newDraft.id}`);
        } catch (error) {
          console.error('Failed to create draft:', error);
          toast.error('Failed to create character draft');
        }
      };
      createNewDraft();
    }
  }, [draftId, user]);

  const handleFormChange = useCallback((updates) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates };
      updateState(newData);
      return newData;
    });
  }, [updateState]);

  const handleAppearanceChange = useCallback((appearanceData) => {
    setFormData(prev => {
      const newData = { ...prev, appearance: appearanceData };
      updateState(newData);
      return newData;
    });
  }, [updateState]);

  const handleSeedChange = useCallback((seed) => {
    setFormData(prev => {
      const newData = { ...prev, seed };
      updateState(newData);
      return newData;
    });
  }, [updateState]);

  const handleSeedLockToggle = useCallback((locked) => {
    setFormData(prev => {
      const newData = { ...prev, seed_locked: locked };
      updateState(newData);
      return newData;
    });
  }, [updateState]);

  const handleJsonChange = useCallback((json) => {
    setFormData(prev => {
      const newData = { ...prev, ...json };
      updateState(newData);
      return newData;
    });
  }, [updateState]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      const characterData = {
        ...formData,
        appearance: formData.appearance || {},
      };

      const imagePrompt = await synthesizeCharacterImagePrompt(characterData);
      
      const result = await generateCharacterImage(
        { prompt: imagePrompt, seed: formData.seed_locked ? formData.seed : null },
        abortControllerRef.current.signal
      );

      const newImageHistory = [
        result.url,
        ...imageHistory.filter(url => url !== result.url),
      ].slice(0, 10);

      setImageHistory(newImageHistory);
      
      const updatedData = {
        ...formData,
        generated_image_url: result.url,
        fal_job_id: result.jobId,
        seed: result.seed || formData.seed,
        image_prompt: {
          ...formData.image_prompt,
          synthesized_prompt: imagePrompt,
        },
        creation_status: 'in_progress',
      };

      setFormData(updatedData);
      updateState(updatedData);
      
      toast.success('Character image generated!');
    } catch (error) {
      if (error.name === 'AbortError' || error.message === 'Request cancelled') {
        return;
      }
      console.error('Generation failed:', error);
      toast.error('Failed to generate character image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [formData, imageHistory, updateState]);

  const handleRegenerate = useCallback(async (prompt) => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    try {
      const characterData = {
        ...formData,
        appearance: formData.appearance || {},
      };

      const basePrompt = await synthesizeCharacterImagePrompt(characterData);
      const finalPrompt = `${basePrompt}. ${prompt}`;

      const result = await generateCharacterImage(
        { prompt: finalPrompt, seed: formData.seed_locked ? formData.seed : null },
        abortControllerRef.current.signal
      );

      const newImageHistory = [
        result.url,
        ...imageHistory.filter(url => url !== result.url),
      ].slice(0, 10);

      setImageHistory(newImageHistory);

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
      if (error.name === 'AbortError' || error.message === 'Request cancelled') {
        return;
      }
      console.error('Regeneration failed:', error);
      toast.error('Failed to regenerate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [formData, imageHistory, updateState]);

  const handleRegenerateWithoutInput = useCallback(async () => {
    await handleRegenerate('');
  }, [handleRegenerate]);

  const handleFinalize = useCallback(async () => {
    if (!formData.character_name) {
      toast.error('Character name is required for finalization');
      return;
    }

    if (!formData.generated_image_url) {
      toast.error('Please generate an image before finalizing');
      return;
    }

    setIsFinalizing(true);

    try {
      const characterData = {
        ...formData,
        appearance: formData.appearance || {},
      };

      const manifest = await generateCharacterManifest(characterData);

      const characterRecord = {
        ...formData,
        character_manifest: manifest,
        creation_status: 'finalized',
        image_history: imageHistory,
      };

      const created = await Character.create(user.id, characterRecord);

      if (draftId) {
        await CharacterDraft.delete(draftId);
        const storageKey = `character_draft_${draftId}`;
        localStorage.removeItem(storageKey);
      }

      toast.success('Character finalized!');
      navigate(`/characters/${created.id}`);
    } catch (error) {
      console.error('Finalization failed:', error);
      toast.error('Failed to finalize character. Please try again.');
    } finally {
      setIsFinalizing(false);
    }
  }, [formData, imageHistory, user, draftId, navigate]);

  const handleNavigate = useCallback((to) => {
    if (isDirty) {
      setPendingNavigation(to);
      setShowExitModal(true);
    } else {
      navigate(to);
    }
  }, [isDirty, navigate]);

  const handleSaveAndLeave = useCallback(async () => {
    await saveNow();
    setShowExitModal(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
    }
  }, [saveNow, pendingNavigation, navigate]);

  const handleLeaveWithoutSaving = useCallback(() => {
    setShowExitModal(false);
    if (pendingNavigation) {
      navigate(pendingNavigation);
    }
  }, [pendingNavigation, navigate]);

  const showImageContext = formData.generated_image_url || imageHistory.length > 0;

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-indigo-400" />
              Generate Character
            </h1>
            {draftId && lastSaved && (
              <p className="text-sm text-gray-400 mt-1">
                Draft saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                {isDirty && ' (unsaved changes)'}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavigate('/characters')}
              className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            >
              View Characters
            </button>
            <button
              onClick={saveNow}
              disabled={!isDirty}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Draft
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setPhase(1)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                phase === 1 ? 'bg-indigo-600 text-white' : 'text-gray-400'
              }`}
            >
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-indigo-600 text-white text-sm">
                1
              </span>
              Identity
            </button>
            <ChevronRight className="w-5 h-5 text-gray-600" />
            <button
              onClick={() => setPhase(2)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                phase === 2 ? 'bg-indigo-600 text-white' : 'text-gray-400'
              }`}
            >
              <span className={`w-6 h-6 flex items-center justify-center rounded-full ${
                phase === 2 ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
              } text-sm`}>
                2
              </span>
              Appearance
            </button>
            <ChevronRight className="w-5 h-5 text-gray-600" />
            <button
              onClick={() => setPhase(3)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                phase === 3 ? 'bg-indigo-600 text-white' : 'text-gray-400'
              }`}
            >
              <span className={`w-6 h-6 flex items-center justify-center rounded-full ${
                phase === 3 ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
              } text-sm`}>
                3
              </span>
              Generate
            </button>
          </div>
          <div className="h-1 bg-gray-800 rounded-full mt-2">
            <div 
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${(phase / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Main Content */}
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

        {/* Navigation Buttons */}
        {(!showImageContext) && (
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-800">
            {phase > 1 && (
              <button
                onClick={() => setPhase(phase - 1)}
                className="px-6 py-2.5 text-gray-300 hover:text-white transition-colors"
              >
                Back
              </button>
            )}
            {phase < 3 && (
              <button
                onClick={() => setPhase(phase + 1)}
                className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Exit Confirmation Modal */}
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
