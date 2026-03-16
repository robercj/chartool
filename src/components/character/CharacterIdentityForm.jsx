import { useMemo } from 'react';
import { Storyline } from '../../lib/storage';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import PillTagInput from './PillTagInput';
import DerePresetSelector from './DerePresetSelector';
import {
  ARCHETYPES,
  MORAL_ALIGNMENTS,
  SOCIAL_CLASSES,
  SEX_OPTIONS,
  GENDER_EXPRESSION_OPTIONS,
  TONE_OPTIONS,
  ROLE_OPTIONS,
} from '../../lib/constants/DERE_PRESETS';
import { BookOpen, User, Heart, Brain, MessageSquare, History } from 'lucide-react';

export default function CharacterIdentityForm({
  formData,
  onChange,
  disabled = false,
}) {
  const { user } = useAuth();
  
  const { data: stories = [] } = useQuery({
    queryKey: ['stories', user?.id],
    queryFn: () => user ? Storyline.list(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const handleFieldChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  const personalityMode = useMemo(() => {
    const hasPresets = (formData.dere_presets || []).length > 0;
    const hasCustom = (formData.custom_personality_modifier || '').trim().length > 0;
    
    if (hasPresets && hasCustom) return 'preset_plus_modifier';
    if (hasPresets) return 'preset_only';
    if (hasCustom) return 'custom_only';
    return 'preset_only';
  }, [formData.dere_presets, formData.custom_personality_modifier]);

  return (
    <div className="space-y-8">
      {/* Story Assignment */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-400" />
          Story Assignment
        </h2>
        <div className="max-w-md">
          <label htmlFor="story-select" className="block text-sm font-medium text-gray-300 mb-1.5">
            Assign to Story
          </label>
          <select
            id="story-select"
            value={formData.assigned_story_id || ''}
            onChange={(e) => handleFieldChange('assigned_story_id', e.target.value || null)}
            disabled={disabled}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <option value="">Unassigned (Standalone Character)</option>
            {stories.map(story => (
              <option key={story.id} value={story.id}>{story.title || 'Untitled Story'}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Basic Identity */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-400" />
          Basic Identity
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="character-name" className="block text-sm font-medium text-gray-300 mb-1.5">
              Character Name
            </label>
            <input
              id="character-name"
              type="text"
              value={formData.character_name || ''}
              onChange={(e) => handleFieldChange('character_name', e.target.value)}
              placeholder="Enter character name"
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="character-role" className="block text-sm font-medium text-gray-300 mb-1.5">
              Role in Story
            </label>
            <select
              id="character-role"
              value={formData.character_role || ''}
              onChange={(e) => handleFieldChange('character_role', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">Select role...</option>
              {ROLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="archetype" className="block text-sm font-medium text-gray-300 mb-1.5">
              Archetype
            </label>
            <select
              id="archetype"
              value={formData.archetype || ''}
              onChange={(e) => handleFieldChange('archetype', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">Select archetype...</option>
              {ARCHETYPES.map(arch => (
                <option key={arch.id} value={arch.id}>{arch.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-300 mb-1.5">
              Age
            </label>
            <input
              id="age"
              type="text"
              value={formData.age || ''}
              onChange={(e) => handleFieldChange('age', e.target.value)}
              placeholder="e.g., 25 or mid-20s"
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="sex" className="block text-sm font-medium text-gray-300 mb-1.5">
              Sex
            </label>
            <select
              id="sex"
              value={formData.sex || ''}
              onChange={(e) => handleFieldChange('sex', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">Select...</option>
              {SEX_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="gender-expression" className="block text-sm font-medium text-gray-300 mb-1.5">
              Gender Expression
            </label>
            <select
              id="gender-expression"
              value={formData.gender_expression || ''}
              onChange={(e) => handleFieldChange('gender_expression', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">Select...</option>
              {GENDER_EXPRESSION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="species" className="block text-sm font-medium text-gray-300 mb-1.5">
              Species / Race
            </label>
            <input
              id="species"
              type="text"
              value={formData.species_or_race || ''}
              onChange={(e) => handleFieldChange('species_or_race', e.target.value)}
              placeholder="Human, Elf, Android..."
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="origin" className="block text-sm font-medium text-gray-300 mb-1.5">
              Nationality / Origin
            </label>
            <input
              id="origin"
              type="text"
              value={formData.nationality_or_origin || ''}
              onChange={(e) => handleFieldChange('nationality_or_origin', e.target.value)}
              placeholder="e.g., Japanese, American..."
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="social-class" className="block text-sm font-medium text-gray-300 mb-1.5">
              Social Class
            </label>
            <select
              id="social-class"
              value={formData.social_class || ''}
              onChange={(e) => handleFieldChange('social_class', e.target.value)}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              <option value="">Select...</option>
              {SOCIAL_CLASSES.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label htmlFor="occupation" className="block text-sm font-medium text-gray-300 mb-1.5">
              Occupation / Role
            </label>
            <input
              id="occupation"
              type="text"
              value={formData.occupation_or_role || ''}
              onChange={(e) => handleFieldChange('occupation_or_role', e.target.value)}
              placeholder="e.g., Knight, Software Engineer, Street Vendor..."
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label htmlFor="narrative-function" className="block text-sm font-medium text-gray-300 mb-1.5">
              Narrative Function
            </label>
            <textarea
              id="narrative-function"
              value={formData.narrative_function || ''}
              onChange={(e) => handleFieldChange('narrative_function', e.target.value)}
              placeholder="What purpose does this character serve in the narrative?"
              rows={2}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Personality Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Heart className="w-5 h-5 text-indigo-400" />
          Personality
        </h2>
        
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Dere Type Presets
            </label>
            <DerePresetSelector
              selected={formData.dere_presets || []}
              onChange={(presets) => handleFieldChange('dere_presets', presets)}
              disabled={disabled}
            />
          </div>

          <div>
            <label htmlFor="custom-personality" className="block text-sm font-medium text-gray-300 mb-1.5">
              Custom Personality Modifier
            </label>
            <textarea
              id="custom-personality"
              value={formData.custom_personality_modifier || ''}
              onChange={(e) => handleFieldChange('custom_personality_modifier', e.target.value)}
              placeholder="Add custom personality traits, quirks, or modify the preset behavior..."
              rows={3}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Mode: {personalityMode === 'preset_only' ? 'Preset Only' : 
                     personalityMode === 'custom_only' ? 'Custom Only' : 
                     'Preset + Modifier'}
            </p>
          </div>

          <input type="hidden" value={personalityMode} readOnly />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PillTagInput
              id="surface-traits"
              label="Surface Traits"
              value={formData.surface_traits || []}
              onChange={(traits) => handleFieldChange('surface_traits', traits)}
              placeholder="Type trait and press Enter..."
              disabled={disabled}
            />
            
            <PillTagInput
              id="hidden-traits"
              label="Hidden Traits"
              value={formData.hidden_traits || []}
              onChange={(traits) => handleFieldChange('hidden_traits', traits)}
              placeholder="Type trait and press Enter..."
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <PillTagInput
              id="positive-triggers"
              label="Positive Emotional Triggers"
              value={formData.emotional_triggers_positive || []}
              onChange={(triggers) => handleFieldChange('emotional_triggers_positive', triggers)}
              placeholder="What makes them open up?"
              disabled={disabled}
            />
            
            <PillTagInput
              id="negative-triggers"
              label="Negative Emotional Triggers"
              value={formData.emotional_triggers_negative || []}
              onChange={(triggers) => handleFieldChange('emotional_triggers_negative', triggers)}
              placeholder="What causes withdrawal or anger?"
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="surface-goal" className="block text-sm font-medium text-gray-300 mb-1.5">
                Surface Goal
              </label>
              <input
                id="surface-goal"
                type="text"
                value={formData.surface_goal || ''}
                onChange={(e) => handleFieldChange('surface_goal', e.target.value)}
                placeholder="What they say they want"
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="deep-desire" className="block text-sm font-medium text-gray-300 mb-1.5">
                Deep Desire
              </label>
              <input
                id="deep-desire"
                type="text"
                value={formData.deep_desire || ''}
                onChange={(e) => handleFieldChange('deep_desire', e.target.value)}
                placeholder="What they actually need"
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="moral-alignment" className="block text-sm font-medium text-gray-300 mb-1.5">
                Moral Alignment
              </label>
              <select
                id="moral-alignment"
                value={formData.moral_alignment || ''}
                onChange={(e) => handleFieldChange('moral_alignment', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">Select...</option>
                {MORAL_ALIGNMENTS.map(align => (
                  <option key={align} value={align}>{align}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="internal-conflict" className="block text-sm font-medium text-gray-300 mb-1.5">
              Internal Conflict
            </label>
            <textarea
              id="internal-conflict"
              value={formData.internal_conflict || ''}
              onChange={(e) => handleFieldChange('internal_conflict', e.target.value)}
              placeholder="The central tension driving their behavior..."
              rows={3}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
            />
          </div>
        </div>
      </section>

      {/* Psychology Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Brain className="w-5 h-5 text-indigo-400" />
          Psychology & Values
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PillTagInput
            id="values-beliefs"
            label="Values & Beliefs"
            value={formData.values_and_beliefs || []}
            onChange={(values) => handleFieldChange('values_and_beliefs', values)}
            placeholder="Type value and press Enter..."
            disabled={disabled}
          />
          
          <PillTagInput
            id="fears-insecurities"
            label="Fears & Insecurities"
            value={formData.fears_and_insecurities || []}
            onChange={(fears) => handleFieldChange('fears_and_insecurities', fears)}
            placeholder="Type fear and press Enter..."
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PillTagInput
            id="behavioral-tendencies"
            label="Behavioral Tendencies"
            value={formData.behavioral_tendencies || []}
            onChange={(tendencies) => handleFieldChange('behavioral_tendencies', tendencies)}
            placeholder="Type tendency and press Enter..."
            disabled={disabled}
          />
          
          <PillTagInput
            id="consistency-anchors"
            label="Consistency Anchors"
            value={formData.consistency_anchors || []}
            onChange={(anchors) => handleFieldChange('consistency_anchors', anchors)}
            placeholder="Facts that must NEVER change..."
            disabled={disabled}
          />
        </div>

        <PillTagInput
          id="contradiction-points"
          label="Contradiction Points"
          value={formData.contradiction_points || []}
          onChange={(points) => handleFieldChange('contradiction_points', points)}
          placeholder="Intentional paradoxes that add depth..."
          disabled={disabled}
        />
      </section>

      {/* Backstory Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-400" />
          Backstory & Context
        </h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="backstory" className="block text-sm font-medium text-gray-300 mb-1.5">
              Backstory Summary
            </label>
            <textarea
              id="backstory"
              value={formData.backstory_summary || ''}
              onChange={(e) => handleFieldChange('backstory_summary', e.target.value)}
              placeholder="The character&apos;s background narrative..."
              rows={4}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
            />
          </div>

          <div>
            <label htmlFor="formative-event" className="block text-sm font-medium text-gray-300 mb-1.5">
              Formative Event
            </label>
            <textarea
              id="formative-event"
              value={formData.formative_event || ''}
              onChange={(e) => handleFieldChange('formative_event', e.target.value)}
              placeholder="The most impactful event that shaped who they are..."
              rows={3}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="rel-protagonist" className="block text-sm font-medium text-gray-300 mb-1.5">
                Relationship to Protagonist
              </label>
              <input
                id="rel-protagonist"
                type="text"
                value={formData.relationship_to_protagonist || ''}
                onChange={(e) => handleFieldChange('relationship_to_protagonist', e.target.value)}
                placeholder="e.g., Ally, Rival, Mentor..."
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="rel-authority" className="block text-sm font-medium text-gray-300 mb-1.5">
                Relationship to Authority
              </label>
              <input
                id="rel-authority"
                type="text"
                value={formData.relationship_to_authority || ''}
                onChange={(e) => handleFieldChange('relationship_to_authority', e.target.value)}
                placeholder="e.g., Rebellious, Loyal..."
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>

            <div>
              <label htmlFor="rel-peers" className="block text-sm font-medium text-gray-300 mb-1.5">
                Relationship to Peers
              </label>
              <input
                id="rel-peers"
                type="text"
                value={formData.relationship_to_peers || ''}
                onChange={(e) => handleFieldChange('relationship_to_peers', e.target.value)}
                placeholder="e.g., Popular, Isolated..."
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="rel-love-interest" className="block text-sm font-medium text-gray-300 mb-1.5">
              Relationship to Love Interest
            </label>
            <input
              id="rel-love-interest"
              type="text"
              value={formData.relationship_to_love_interest || ''}
              onChange={(e) => handleFieldChange('relationship_to_love_interest', e.target.value)}
              placeholder="e.g., tsundere dynamics, enemies to lovers..."
              disabled={disabled}
              className="w-full max-w-md px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="world-context" className="block text-sm font-medium text-gray-300 mb-1.5">
              World Context
            </label>
            <textarea
              id="world-context"
              value={formData.world_context || ''}
              onChange={(e) => handleFieldChange('world_context', e.target.value)}
              placeholder="Setting, time period, rules of their world..."
              rows={3}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
            />
          </div>

          <PillTagInput
            id="knowledge-domain"
            label="Knowledge Domain"
            value={formData.knowledge_domain || []}
            onChange={(domains) => handleFieldChange('knowledge_domain', domains)}
            placeholder="Areas of expertise..."
            disabled={disabled}
          />
        </div>
      </section>

      {/* Voice Section */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-400" />
          Voice & Speech
        </h2>
        
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tone-of-voice" className="block text-sm font-medium text-gray-300 mb-1.5">
                Tone of Voice
              </label>
              <select
                id="tone-of-voice"
                value={formData.tone_of_voice || ''}
                onChange={(e) => handleFieldChange('tone_of_voice', e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <option value="">Select tone...</option>
                {TONE_OPTIONS.map(tone => (
                  <option key={tone.value} value={tone.value}>{tone.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="speech-pattern" className="block text-sm font-medium text-gray-300 mb-1.5">
              Speech Pattern
            </label>
            <textarea
              id="speech-pattern"
              value={formData.speech_pattern || ''}
              onChange={(e) => handleFieldChange('speech_pattern', e.target.value)}
              placeholder="Sentence structure, vocabulary level, rhythm, specific verbal tics..."
              rows={3}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
            />
          </div>

          <PillTagInput
            id="verbal-quirks"
            label="Verbal Quirks"
            value={formData.verbal_quirks || []}
            onChange={(quirks) => handleFieldChange('verbal_quirks', quirks)}
            placeholder="Catchphrases, tics, avoidance words..."
            disabled={disabled}
          />

          <div>
            <label htmlFor="internal-monologue" className="block text-sm font-medium text-gray-300 mb-1.5">
              Internal Monologue Style
            </label>
            <textarea
              id="internal-monologue"
              value={formData.internal_monologue_style || ''}
              onChange={(e) => handleFieldChange('internal_monologue_style', e.target.value)}
              placeholder="How they narrate their own thoughts..."
              rows={2}
              disabled={disabled}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
