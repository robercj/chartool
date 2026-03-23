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
import { BookOpen, User, Heart, Brain, MessageSquare, History, Users, X, Plus } from 'lucide-react';

// Shared DaisyUI class strings
const INPUT_CLS    = 'input input-bordered w-full bg-base-300 text-base-content';
const SELECT_CLS   = 'select select-bordered w-full bg-base-300 text-base-content';
const TEXTAREA_CLS = 'textarea textarea-bordered w-full bg-base-300 text-base-content resize-none';
const LABEL_CLS    = 'label label-text font-medium pb-1';

export default function CharacterIdentityForm({
  formData,
  onChange,
  onBlur,
  disabled = false,
}) {
  const { user } = useAuth();

  const { data: stories = [] } = useQuery({
    queryKey: ['stories', user?.id],
    queryFn: () => user ? Storyline.list(user.id) : Promise.resolve([]),
    enabled: !!user,
  });

  const handleFieldChange = (field, value, triggerBlur = true) => {
    const updatedData = { ...formData, [field]: value };
    onChange(updatedData);
    if (triggerBlur && onBlur) {
      onBlur(updatedData);
    }
  };

  // ── Relationship (Social Web) helpers ─────────────────────────────────────
  const relationships = formData.relationships || [];

  const addRelationship = () => {
    handleFieldChange('relationships', [...relationships, { entity: '', relationship: '', notes: '' }]);
  };

  const removeRelationship = (index) => {
    handleFieldChange('relationships', relationships.filter((_, i) => i !== index));
  };

  const updateRelationship = (index, field, value) => {
    handleFieldChange(
      'relationships',
      relationships.map((rel, i) => i === index ? { ...rel, [field]: value } : rel)
    );
  };

  const personalityMode = useMemo(() => {
    const hasPresets = (formData.dere_presets || []).length > 0;
    const hasCustom  = (formData.custom_personality_modifier || '').trim().length > 0;
    if (hasPresets && hasCustom) return 'preset_plus_modifier';
    if (hasPresets)  return 'preset_only';
    if (hasCustom)   return 'custom_only';
    return 'preset_only';
  }, [formData.dere_presets, formData.custom_personality_modifier]);

  return (
    <div className="space-y-8">

      {/* ── Story Assignment ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Story Assignment
        </h2>
        <div className="max-w-md">
          <label htmlFor="story-select" className={LABEL_CLS}>Assign to Story</label>
          <select
            id="story-select"
            value={formData.assigned_story_id || ''}
            onChange={(e) => handleFieldChange('assigned_story_id', e.target.value || null)}
            disabled={disabled}
            className={SELECT_CLS}
          >
            <option value="">Unassigned (Standalone Character)</option>
            {stories.map(story => (
              <option key={story.id} value={story.id}>{story.name || 'Untitled Story'}</option>
            ))}
          </select>
        </div>
      </section>

      {/* ── Basic Identity ───────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          Basic Identity
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field id="character-name" label="Character Name">
            <input id="character-name" type="text" className={INPUT_CLS} disabled={disabled}
              value={formData.character_name || ''} placeholder="Enter character name"
              onChange={(e) => handleFieldChange('character_name', e.target.value)}
              onBlur={onBlur} />
          </Field>

          <Field id="character-role" label="Role in Story">
            <select id="character-role" className={SELECT_CLS} disabled={disabled}
              value={formData.character_role || ''}
              onChange={(e) => handleFieldChange('character_role', e.target.value)}>
              <option value="">Select role...</option>
              {ROLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>

          <Field id="archetype" label="Archetype">
            <select id="archetype" className={SELECT_CLS} disabled={disabled}
              value={formData.archetype || ''}
              onChange={(e) => handleFieldChange('archetype', e.target.value)}>
              <option value="">Select archetype...</option>
              {ARCHETYPES.map(arch => <option key={arch.id} value={arch.id}>{arch.label}</option>)}
            </select>
          </Field>

          <Field id="age" label="Age">
            <input id="age" type="text" className={INPUT_CLS} disabled={disabled}
              value={formData.age || ''} placeholder="e.g., 25 or mid-20s"
              onChange={(e) => handleFieldChange('age', e.target.value)} />
          </Field>

          <Field id="sex" label="Sex">
            <select id="sex" className={SELECT_CLS} disabled={disabled}
              value={formData.sex || ''}
              onChange={(e) => handleFieldChange('sex', e.target.value)}>
              <option value="">Select...</option>
              {SEX_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>

          <Field id="gender-expression" label="Gender Expression">
            <select id="gender-expression" className={SELECT_CLS} disabled={disabled}
              value={formData.gender_expression || ''}
              onChange={(e) => handleFieldChange('gender_expression', e.target.value)}>
              <option value="">Select...</option>
              {GENDER_EXPRESSION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </Field>

          <Field id="species" label="Species / Race">
            <input id="species" type="text" className={INPUT_CLS} disabled={disabled}
              value={formData.species_or_race || ''} placeholder="Human, Elf, Android..."
              onChange={(e) => handleFieldChange('species_or_race', e.target.value)} />
          </Field>

          <Field id="origin" label="Nationality / Origin">
            <input id="origin" type="text" className={INPUT_CLS} disabled={disabled}
              value={formData.nationality_or_origin || ''} placeholder="e.g., Japanese, American..."
              onChange={(e) => handleFieldChange('nationality_or_origin', e.target.value)} />
          </Field>

          <Field id="social-class" label="Social Class">
            <select id="social-class" className={SELECT_CLS} disabled={disabled}
              value={formData.social_class || ''}
              onChange={(e) => handleFieldChange('social_class', e.target.value)}>
              <option value="">Select...</option>
              {SOCIAL_CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
            </select>
          </Field>

          <div className="md:col-span-2 lg:col-span-3">
            <Field id="occupation" label="Occupation / Role">
              <input id="occupation" type="text" className={INPUT_CLS} disabled={disabled}
                value={formData.occupation_or_role || ''} placeholder="e.g., Knight, Software Engineer, Street Vendor..."
                onChange={(e) => handleFieldChange('occupation_or_role', e.target.value)} />
            </Field>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <Field id="narrative-function" label="Narrative Function">
              <textarea id="narrative-function" className={TEXTAREA_CLS} rows={2} disabled={disabled}
                value={formData.narrative_function || ''}
                placeholder="What purpose does this character serve in the narrative?"
                onChange={(e) => handleFieldChange('narrative_function', e.target.value)} />
            </Field>
          </div>
        </div>
      </section>

      {/* ── Personality ──────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
          <Heart className="w-5 h-5 text-primary" />
          Personality
        </h2>

        <div>
          <label className="label label-text font-medium pb-2">Dere Type Presets</label>
          <DerePresetSelector
            selected={formData.dere_presets || []}
            onChange={(presets) => handleFieldChange('dere_presets', presets)}
            disabled={disabled}
          />
        </div>

        <div>
          <label htmlFor="custom-personality" className={LABEL_CLS}>Custom Personality Modifier</label>
          <textarea id="custom-personality" className={TEXTAREA_CLS} rows={3} disabled={disabled}
            value={formData.custom_personality_modifier || ''}
            placeholder="Add custom personality traits, quirks, or modify the preset behavior..."
            onChange={(e) => handleFieldChange('custom_personality_modifier', e.target.value)} />
          <span className="text-xs opacity-50 mt-1 block">
            Mode: {personalityMode === 'preset_only' ? 'Preset Only' :
                   personalityMode === 'custom_only' ? 'Custom Only' :
                   'Preset + Modifier'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PillTagInput id="surface-traits" label="Surface Traits" disabled={disabled}
            value={formData.surface_traits || []}
            onChange={(traits) => handleFieldChange('surface_traits', traits)}
            placeholder="Type trait and press Enter..." />
          <PillTagInput id="hidden-traits" label="Hidden Traits" disabled={disabled}
            value={formData.hidden_traits || []}
            onChange={(traits) => handleFieldChange('hidden_traits', traits)}
            placeholder="Type trait and press Enter..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PillTagInput id="positive-triggers" label="Positive Emotional Triggers" disabled={disabled}
            value={formData.emotional_triggers_positive || []}
            onChange={(t) => handleFieldChange('emotional_triggers_positive', t)}
            placeholder="What makes them open up?" />
          <PillTagInput id="negative-triggers" label="Negative Emotional Triggers" disabled={disabled}
            value={formData.emotional_triggers_negative || []}
            onChange={(t) => handleFieldChange('emotional_triggers_negative', t)}
            placeholder="What causes withdrawal or anger?" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field id="surface-goal" label="Surface Goal">
            <input id="surface-goal" type="text" className={INPUT_CLS} disabled={disabled}
              value={formData.surface_goal || ''} placeholder="What they say they want"
              onChange={(e) => handleFieldChange('surface_goal', e.target.value)} />
          </Field>
          <Field id="deep-desire" label="Deep Desire">
            <input id="deep-desire" type="text" className={INPUT_CLS} disabled={disabled}
              value={formData.deep_desire || ''} placeholder="What they actually need"
              onChange={(e) => handleFieldChange('deep_desire', e.target.value)} />
          </Field>
          <Field id="moral-alignment" label="Moral Alignment">
            <select id="moral-alignment" className={SELECT_CLS} disabled={disabled}
              value={formData.moral_alignment || ''}
              onChange={(e) => handleFieldChange('moral_alignment', e.target.value)}>
              <option value="">Select...</option>
              {MORAL_ALIGNMENTS.map(align => <option key={align} value={align}>{align}</option>)}
            </select>
          </Field>
        </div>

        <Field id="internal-conflict" label="Internal Conflict">
          <textarea id="internal-conflict" className={TEXTAREA_CLS} rows={3} disabled={disabled}
            value={formData.internal_conflict || ''}
            placeholder="The central tension driving their behavior..."
            onChange={(e) => handleFieldChange('internal_conflict', e.target.value)} />
        </Field>
      </section>

      {/* ── Psychology ───────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Psychology &amp; Values
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PillTagInput id="values-beliefs" label="Values & Beliefs" disabled={disabled}
            value={formData.values_and_beliefs || []}
            onChange={(values) => handleFieldChange('values_and_beliefs', values)}
            placeholder="Type value and press Enter..." />
          <PillTagInput id="fears-insecurities" label="Fears & Insecurities" disabled={disabled}
            value={formData.fears_and_insecurities || []}
            onChange={(fears) => handleFieldChange('fears_and_insecurities', fears)}
            placeholder="Type fear and press Enter..." />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PillTagInput id="behavioral-tendencies" label="Behavioral Tendencies" disabled={disabled}
            value={formData.behavioral_tendencies || []}
            onChange={(t) => handleFieldChange('behavioral_tendencies', t)}
            placeholder="Type tendency and press Enter..." />
          <PillTagInput id="consistency-anchors" label="Consistency Anchors" disabled={disabled}
            value={formData.consistency_anchors || []}
            onChange={(anchors) => handleFieldChange('consistency_anchors', anchors)}
            placeholder="Facts that must NEVER change..." />
        </div>

        <PillTagInput id="contradiction-points" label="Contradiction Points" disabled={disabled}
          value={formData.contradiction_points || []}
          onChange={(points) => handleFieldChange('contradiction_points', points)}
          placeholder="Intentional paradoxes that add depth..." />
      </section>

      {/* ── Backstory & Context ──────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          Backstory &amp; Context
        </h2>

        {/* Order: Backstory Summary → Knowledge Domain → Formative Event */}
        <Field id="backstory" label="Backstory Summary">
          <textarea id="backstory" className={TEXTAREA_CLS} rows={4} disabled={disabled}
            value={formData.backstory_summary || ''}
            placeholder="The character's background narrative..."
            onChange={(e) => handleFieldChange('backstory_summary', e.target.value)} />
        </Field>

        <PillTagInput id="knowledge-domain" label="Knowledge Domain" disabled={disabled}
          value={formData.knowledge_domain || []}
          onChange={(domains) => handleFieldChange('knowledge_domain', domains)}
          placeholder="Areas of expertise..." />

        <Field id="formative-event" label="Formative Event">
          <textarea id="formative-event" className={TEXTAREA_CLS} rows={3} disabled={disabled}
            value={formData.formative_event || ''}
            placeholder="The most impactful event that shaped who they are..."
            onChange={(e) => handleFieldChange('formative_event', e.target.value)} />
        </Field>

        {/* World Context removed (v2.0) */}
      </section>

      {/* ── Social Web ──────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Social Web
        </h2>
        <p className="text-sm text-base-content/50">
          Define the character's key relationships. Each entry describes their connection to a person, faction, or group.
        </p>

        {/* Relationship list — scrollable if > 5 items */}
        {relationships.length > 0 && (
          <div className={`space-y-3 ${relationships.length > 5 ? 'max-h-96 overflow-y-auto pr-1' : ''}`}>
            {relationships.map((rel, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 bg-base-200 rounded-xl border border-base-300"
              >
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={rel.entity || ''}
                    onChange={(e) => updateRelationship(index, 'entity', e.target.value)}
                    placeholder="Entity / Faction"
                    disabled={disabled}
                    className={INPUT_CLS + ' input-sm'}
                  />
                  <input
                    type="text"
                    value={rel.relationship || ''}
                    onChange={(e) => updateRelationship(index, 'relationship', e.target.value)}
                    placeholder="Relationship"
                    disabled={disabled}
                    className={INPUT_CLS + ' input-sm'}
                  />
                  <input
                    type="text"
                    value={rel.notes || ''}
                    onChange={(e) => updateRelationship(index, 'notes', e.target.value)}
                    placeholder="Notes / Backstory"
                    disabled={disabled}
                    className={INPUT_CLS + ' input-sm'}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeRelationship(index)}
                  disabled={disabled}
                  className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-error flex-shrink-0 mt-0.5"
                  aria-label="Remove relationship"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addRelationship}
          disabled={disabled}
          className="btn btn-ghost btn-sm gap-2 border border-dashed border-base-content/30 hover:border-primary hover:text-primary"
        >
          <Plus className="w-4 h-4" />
          Relationship
        </button>
      </section>

      {/* ── Voice ────────────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-base-content flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Voice &amp; Speech
        </h2>

        <div className="max-w-xs">
          <Field id="tone-of-voice" label="Tone of Voice">
            <select id="tone-of-voice" className={SELECT_CLS} disabled={disabled}
              value={formData.tone_of_voice || ''}
              onChange={(e) => handleFieldChange('tone_of_voice', e.target.value)}>
              <option value="">Select tone...</option>
              {TONE_OPTIONS.map(tone => <option key={tone.value} value={tone.value}>{tone.label}</option>)}
            </select>
          </Field>
        </div>

        <Field id="speech-pattern" label="Speech Pattern">
          <textarea id="speech-pattern" className={TEXTAREA_CLS} rows={3} disabled={disabled}
            value={formData.speech_pattern || ''}
            placeholder="Sentence structure, vocabulary level, rhythm, specific verbal tics..."
            onChange={(e) => handleFieldChange('speech_pattern', e.target.value)} />
        </Field>

        <PillTagInput id="verbal-quirks" label="Verbal Quirks" disabled={disabled}
          value={formData.verbal_quirks || []}
          onChange={(quirks) => handleFieldChange('verbal_quirks', quirks)}
          placeholder="Catchphrases, tics, avoidance words..." />

        {/* Internal Monologue Style removed (v2.0) */}
      </section>
    </div>
  );
}

// ─── Tiny label+field wrapper ─────────────────────────────────────────────────
function Field({ id, label, children }) {
  return (
    <div>
      <label htmlFor={id} className="label label-text font-medium pb-1">{label}</label>
      {children}
    </div>
  );
}
