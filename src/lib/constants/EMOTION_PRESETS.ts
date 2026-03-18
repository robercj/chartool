// ─── EMOTION_PRESETS.ts ────────────────────────────────────────────────────────
// Comprehensive emotion library for the Identity Lock sprite generation system.
//
// Structure:
//   BASE_EMOTIONS       — 7 core emotional states with face/pose cues
//   INTENSITY_TIERS     — Subtle / Average / High (user-facing labels)
//   MODIFIER_OVERLAYS   — Optional behavioral overlays (e.g. suppressed, composed)
//   SPECIAL_PRESETS     — Complex pre-configured emotional states
//   EMOTION_ALIASES     — Alias map for fuzzy matching (100+ terms)
//   RANDOM_POOL         — Balanced pool used for randomization
//
// Identity Safety Rules:
//   - Intensity adjustments NEVER alter facial geometry or identity features
//   - All cues are additive over the base neutral state
//   - Conflict resolution: reduce intensity before changing facial structure
// ─────────────────────────────────────────────────────────────────────────────

export type IntensityTier = 'subtle' | 'average' | 'high'

export interface EmotionCues {
  face: string[]
  pose: string[]
}

export interface BaseEmotion {
  id: string
  label: string
  cues: EmotionCues
}

export interface IntensityDefinition {
  value: IntensityTier
  label: string
  description: string
  promptAdjustments: string[]
}

export interface ModifierOverlay {
  id: string
  label: string
  cues: string[]
}

export interface SpecialPreset {
  id: string
  label: string
  description: string
  baseEmotion: string
  baseTier: IntensityTier
  modifiers: string[]
  face: string[]
  pose: string[]
  microRules: string[]
}

export interface EmotionAlias {
  base?: string
  tier?: IntensityTier
  modifiers?: string[]
  special?: string
  verbatim?: boolean
}

export interface EmotionEntry {
  emotion: string          // display label (resolved or verbatim)
  rawInput: string         // exactly what the user typed
  intensity: IntensityTier // 'subtle' | 'average' | 'high'
  modifiers: string        // freeform modifier text (e.g. "no tears")
  resolved: EmotionAlias | null  // null if verbatim passthrough
  isVerbatim: boolean
}

// ─── Base Emotions ────────────────────────────────────────────────────────────
export const BASE_EMOTIONS: BaseEmotion[] = [
  {
    id: 'neutral',
    label: 'Neutral',
    cues: {
      face: ['Facial muscles at rest', 'Eyes steady and relaxed', 'Mouth neutral, no smile or frown'],
      pose: ['Balanced posture', 'Shoulders relaxed'],
    },
  },
  {
    id: 'joy',
    label: 'Joy',
    cues: {
      face: ['Mouth corners lifted naturally', 'Cheeks subtly raised', 'Eyes softened or slightly brightened'],
      pose: ['Open posture', 'Chest slightly lifted'],
    },
  },
  {
    id: 'sadness',
    label: 'Sadness',
    cues: {
      face: ['Brows gently angled upward toward center', 'Eyes slightly downcast or heavy-lidded', 'Mouth corners lowered or neutral-pressed'],
      pose: ['Slightly closed posture', 'Head subtly inclined downward'],
    },
  },
  {
    id: 'anger',
    label: 'Anger',
    cues: {
      face: ['Brows drawn inward or lowered', 'Eyes narrowed or intense', 'Jaw set or lips pressed'],
      pose: ['Squared shoulders', 'Tense but controlled stance'],
    },
  },
  {
    id: 'fear',
    label: 'Fear',
    cues: {
      face: ['Eyes widened moderately', 'Brows raised with tension', 'Mouth slightly parted or tight'],
      pose: ['Protective posture', 'Shoulders subtly raised or drawn inward'],
    },
  },
  {
    id: 'disgust',
    label: 'Disgust',
    cues: {
      face: ['Upper lip raised', 'Nose subtly wrinkled', 'Eyes narrowed'],
      pose: ['Slight recoil', 'Head angled slightly away'],
    },
  },
  {
    id: 'surprise',
    label: 'Surprise',
    cues: {
      face: ['Eyes widened', 'Brows lifted', 'Mouth slightly open or small O-shape'],
      pose: ['Brief recoil or lift', 'Hands may rise slightly if visible'],
    },
  },
]

// ─── Intensity Tiers ──────────────────────────────────────────────────────────
export const INTENSITY_TIERS: IntensityDefinition[] = [
  {
    value: 'subtle',
    label: 'Subtle',
    description: 'Emotion is present but restrained or mild.',
    promptAdjustments: [
      'Reduce facial muscle engagement to a minimum — barely perceptible.',
      'Minimize pose deviation from neutral; posture remains almost unchanged.',
    ],
  },
  {
    value: 'average',
    label: 'Average',
    description: 'Clear, readable emotional state without exaggeration.',
    promptAdjustments: [
      'Standard facial engagement — emotion is clearly readable.',
      'Clear but controlled pose cues; no dramatic deviation.',
    ],
  },
  {
    value: 'high',
    label: 'High',
    description: 'High emotional intensity — strong and undeniable without distorting identity.',
    promptAdjustments: [
      'Increase facial tension or openness to maximum identity-safe level.',
      'Strengthen pose cues meaningfully — avoid caricature or exaggeration.',
      'If distortion risk occurs, reduce intensity before altering facial geometry.',
    ],
  },
]

// ─── Modifier Overlays ────────────────────────────────────────────────────────
export const MODIFIER_OVERLAYS: ModifierOverlay[] = [
  {
    id: 'suppressed',
    label: 'Suppressed',
    cues: ['Emotion is partially held back', 'Reduced mouth movement', 'Tighter jaw or controlled breathing'],
  },
  {
    id: 'composed',
    label: 'Composed',
    cues: ['Emotion is controlled and deliberate', 'Even posture', 'Minimal facial asymmetry'],
  },
  {
    id: 'shaky',
    label: 'Shaky',
    cues: ['Emotion appears unstable', 'Slight asymmetry or tension', 'Micro-instability in posture'],
  },
  {
    id: 'guarded',
    label: 'Guarded',
    cues: ['Closed posture', 'Reduced eye contact', 'Protective body language'],
  },
  {
    id: 'exposed',
    label: 'Exposed',
    cues: ['Open posture', 'Increased vulnerability cues', 'Less defensive body language'],
  },
  {
    id: 'teary',
    label: 'Teary',
    cues: ['Eye moisture permitted if consistent with base emotion', 'No forced tears'],
  },
  {
    id: 'averted_gaze',
    label: 'Averted Gaze',
    cues: ['Eyes angled downward or away', 'Avoid direct eye contact'],
  },
  {
    id: 'jaw_clench',
    label: 'Jaw Clench',
    cues: ['Jaw tension increases', 'Lips pressed more firmly', 'No teeth-baring unless explicitly specified'],
  },
]

// ─── Special Case Presets ─────────────────────────────────────────────────────
// These are fully pre-configured emotional states with specific face/pose
// cues and micro-rules to prevent identity drift.
export const SPECIAL_PRESETS: SpecialPreset[] = [
  {
    id: 'confident',
    label: 'Confident',
    description: 'Assured self-confidence without smugness; steady gaze, open posture, controlled expression.',
    baseEmotion: 'neutral',
    baseTier: 'average',
    modifiers: ['composed'],
    face: [
      'Eyes steady and direct; lids relaxed (not narrowed like anger)',
      'Brows neutral-to-slightly lifted (minimal), no inward pinch',
      'Mouth neutral or faint controlled smile (not a smirk)',
    ],
    pose: [
      'Open posture; chest subtly lifted',
      'Shoulders relaxed but set; balanced stance',
      'Chin slightly elevated (minimal, sprite-safe)',
    ],
    microRules: [
      'Do NOT introduce smug asymmetry (no one-sided smirk)',
      'No heroic lighting, no effects, no props',
      'If risk of stylization occurs, reduce intensity before changing facial geometry',
    ],
  },
  {
    id: 'proud',
    label: 'Proud',
    description: 'Quiet pride: warmth + dignity; earned satisfaction without arrogance.',
    baseEmotion: 'joy',
    baseTier: 'subtle',
    modifiers: ['composed'],
    face: [
      'Soft, restrained smile (small and symmetric)',
      'Eyes brightened slightly; steady gaze (not shy or averted)',
      'Brows relaxed; forehead calm',
    ],
    pose: [
      'Upright posture; chest gently lifted',
      'Shoulders back slightly (minimal), not rigid',
      'Head held level or slightly raised (minimal)',
    ],
    microRules: [
      'No smug cues; no one-sided mouth lift',
      'Do NOT add blush or glow; preserve source coloration',
      'No props or background context',
    ],
  },
  {
    id: 'smug',
    label: 'Smug',
    description: 'Self-satisfied confidence with subtle asymmetry and composure.',
    baseEmotion: 'joy',
    baseTier: 'subtle',
    modifiers: ['composed'],
    face: [
      'Small one-sided smirk (subtle) without deforming mouth shape',
      'Eyes slightly narrowed with confidence; relaxed lids',
      'Brows relaxed or one brow slightly raised (very small)',
    ],
    pose: [
      'Relaxed posture; slight weight shift implied (minimal)',
      'Head angle slightly tilted if consistent with framing',
    ],
    microRules: [
      'Keep asymmetry minimal to avoid identity drift',
      'No cartoon swagger effects',
    ],
  },
  {
    id: 'determined',
    label: 'Determined',
    description: 'Focused resolve without anger; strong intent, controlled emotion.',
    baseEmotion: 'neutral',
    baseTier: 'average',
    modifiers: ['composed', 'jaw_clench'],
    face: [
      'Eyes focused; lids slightly narrowed (not angry)',
      'Brows set in a firm, level line (no deep furrow)',
      'Mouth neutral-to-pressed; jaw set',
    ],
    pose: [
      'Squared but calm posture',
      'Chin level; minimal head movement',
    ],
    microRules: [
      'Avoid anger cues (no inward brow pinch; no scowl)',
      'No heroic lighting or dramatic effects',
    ],
  },
  {
    id: 'flustered',
    label: 'Flustered',
    description: 'Socially overloaded, self-conscious, trying to keep composure.',
    baseEmotion: 'fear',
    baseTier: 'subtle',
    modifiers: ['shaky', 'averted_gaze'],
    face: [
      'Eyes dart slightly or avoid steady contact; brief side-glances',
      'Brows lifted with tension; more self-aware than fearful',
      'Mouth slightly parted or pressed into an uncertain line; micro-smile allowed but restrained',
    ],
    pose: [
      'Shoulders subtly drawn in; posture slightly closed',
      'Head angle slightly down or to the side, controlled',
    ],
    microRules: [
      'Do NOT add blush beyond what exists in the source image',
      'No hearts/sparkles/comedy icons',
      'Keep intensity subtle-to-average; do not distort face geometry',
    ],
  },
  {
    id: 'sad_smile',
    label: 'Sad Smile',
    description: 'Sadness with a forced or strained smile; emotion is sadness, smile is a mask.',
    baseEmotion: 'sadness',
    baseTier: 'average',
    modifiers: ['suppressed'],
    face: [
      'Brows show sadness cues (inner brow raise, gentle tension), not joy brows',
      'Eyes heavy or slightly downcast; smile does NOT brighten the eyes',
      'Mouth forms a small, restrained smile that looks held together (not a joyful grin)',
    ],
    pose: [
      'Posture slightly closed like sadness; avoid open-chest joy posture',
      'Head slightly inclined down or level; no bouncy energy',
    ],
    microRules: [
      'No tears unless modifiers explicitly permit',
      'If it risks reading as joy, reduce smile size and increase eye heaviness',
    ],
  },
  {
    id: 'embarrassed',
    label: 'Embarrassed',
    description: 'Shame and self-consciousness; avoidance and containment are key.',
    baseEmotion: 'fear',
    baseTier: 'subtle',
    modifiers: ['averted_gaze', 'guarded'],
    face: [
      'Gaze down/away; eyelids slightly lowered',
      'Brows pinched upward slightly toward center (small)',
      'Mouth tight, small, or pressed with restraint (no grin)',
    ],
    pose: [
      'Posture closed; shoulders in',
      'Head slightly dipped; chin tucked (minimal)',
    ],
    microRules: [
      'Do NOT add or intensify redness/blush beyond source image',
      'No props or hiding-behind-objects behaviors',
    ],
  },
  {
    id: 'despair',
    label: 'Despair',
    description: 'Sadness at high intensity with heaviness and reduced agency.',
    baseEmotion: 'sadness',
    baseTier: 'high',
    modifiers: ['exposed', 'averted_gaze'],
    face: [
      'Inner brows raised more than standard sadness; brow tension visible',
      'Eyes heavy and downcast; lids lowered',
      'Mouth corners lowered; lips slightly parted with slackness (controlled, not grotesque)',
    ],
    pose: [
      'Posture noticeably closed; shoulders slumped slightly (within sprite-safe limits)',
      'Head lowered slightly more than sadness (still minimal)',
    ],
    microRules: [
      'No tears unless modifier teary is present',
      'No desaturation shortcuts; keep source coloration',
    ],
  },
  {
    id: 'contempt',
    label: 'Contempt',
    description: 'Disgust + superiority; asymmetrical and composed. Needs explicit guardrails.',
    baseEmotion: 'disgust',
    baseTier: 'average',
    modifiers: ['composed'],
    face: [
      'One-sided mouth corner lift (subtle) or tight asymmetric mouth line',
      'One brow slightly raised; eyes narrowed with judgement',
      'Nose wrinkle minimal; keep readable without scrunch distortion',
    ],
    pose: [
      'Upright, composed posture; minimal recoil',
      'Head angle slightly back or slightly away (very small)',
    ],
    microRules: [
      'Avoid extreme asymmetry that changes facial identity',
      'No sneer that deforms mouth shape',
    ],
  },
  {
    id: 'panic',
    label: 'Panic',
    description: 'Fear at high intensity with loss of control cues; still identity-safe.',
    baseEmotion: 'fear',
    baseTier: 'high',
    modifiers: ['shaky'],
    face: [
      'Eyes widened more than standard fear; upper lids raised, avoid bulging',
      'Brows raised high with tension; forehead engaged',
      'Mouth open slightly more than fear (not a scream unless explicitly requested)',
    ],
    pose: [
      'Recoiled posture; shoulders lifted slightly',
    ],
    microRules: [
      'No horror lighting; no sweat drops or stylized panic marks',
      'If distortion risk occurs, reduce intensity before changing facial geometry',
    ],
  },
]

// ─── Emotion Aliases ──────────────────────────────────────────────────────────
// Maps common user-typed words → canonical emotion definitions.
// Used by emotionMatcher.js as the primary lookup table before fuzzy matching.
export const EMOTION_ALIASES: Record<string, EmotionAlias> = {
  // Neutral
  'neutral': { base: 'neutral', tier: 'average' },
  'calm': { base: 'neutral', tier: 'average' },
  'blank': { base: 'neutral', tier: 'subtle' },
  'fine': { base: 'neutral', tier: 'subtle' },
  'ok': { base: 'neutral', tier: 'subtle' },
  'stoic': { base: 'neutral', tier: 'average', modifiers: ['composed'] },
  'composed': { base: 'neutral', tier: 'average', modifiers: ['composed'] },
  'unbothered': { base: 'neutral', tier: 'subtle', modifiers: ['composed'] },
  'indifferent': { base: 'neutral', tier: 'subtle' },
  'passive': { base: 'neutral', tier: 'subtle' },

  // Joy
  'joy': { base: 'joy', tier: 'average' },
  'happy': { base: 'joy', tier: 'average' },
  'joyful': { base: 'joy', tier: 'average' },
  'joyous': { base: 'joy', tier: 'high' },
  'cheerful': { base: 'joy', tier: 'average' },
  'pleased': { base: 'joy', tier: 'average' },
  'amused': { base: 'joy', tier: 'average' },
  'content': { base: 'joy', tier: 'subtle' },
  'serene': { base: 'joy', tier: 'subtle', modifiers: ['composed'] },
  'warm': { base: 'joy', tier: 'subtle', modifiers: ['exposed'] },
  'delighted': { base: 'joy', tier: 'high' },
  'elated': { base: 'joy', tier: 'high' },
  'ecstatic': { base: 'joy', tier: 'high' },
  'overjoyed': { base: 'joy', tier: 'high', modifiers: ['exposed'] },
  'euphoric': { base: 'joy', tier: 'high', modifiers: ['exposed'] },
  'giddy': { base: 'joy', tier: 'high' },
  'manic': { base: 'joy', tier: 'high', modifiers: ['shaky'] },
  'laughing': { base: 'joy', tier: 'high' },
  'giggling': { base: 'joy', tier: 'average' },
  'chuckling': { base: 'joy', tier: 'subtle' },
  'smiling': { base: 'joy', tier: 'average' },

  // Sadness
  'sadness': { base: 'sadness', tier: 'average' },
  'sad': { base: 'sadness', tier: 'average' },
  'down': { base: 'sadness', tier: 'average' },
  'blue': { base: 'sadness', tier: 'average' },
  'hurt': { base: 'sadness', tier: 'average', modifiers: ['guarded'] },
  'lonely': { base: 'sadness', tier: 'average', modifiers: ['guarded'] },
  'disappointed': { base: 'sadness', tier: 'subtle' },
  'let down': { base: 'sadness', tier: 'subtle' },
  'crestfallen': { base: 'sadness', tier: 'average' },
  'melancholy': { base: 'sadness', tier: 'subtle' },
  'wistful': { base: 'sadness', tier: 'subtle', modifiers: ['averted_gaze'] },
  'depressed': { base: 'sadness', tier: 'average', modifiers: ['guarded'] },
  'miserable': { base: 'sadness', tier: 'high', modifiers: ['guarded'] },
  'heartbroken': { base: 'sadness', tier: 'high', modifiers: ['teary'] },
  'grieving': { base: 'sadness', tier: 'high', modifiers: ['exposed', 'teary'] },
  'anguished': { base: 'sadness', tier: 'high', modifiers: ['exposed', 'teary'] },
  'hopeless': { special: 'despair' },
  'despondent': { special: 'despair' },
  'forlorn': { base: 'sadness', tier: 'average', modifiers: ['averted_gaze'] },
  'tearful': { base: 'sadness', tier: 'average', modifiers: ['teary'] },
  'crying': { base: 'sadness', tier: 'high', modifiers: ['teary'] },
  'sobbing': { base: 'sadness', tier: 'high', modifiers: ['teary', 'exposed'] },

  // Anger
  'anger': { base: 'anger', tier: 'average' },
  'angry': { base: 'anger', tier: 'average' },
  'mad': { base: 'anger', tier: 'average' },
  'annoyed': { base: 'anger', tier: 'subtle' },
  'irritated': { base: 'anger', tier: 'subtle' },
  'frustrated': { base: 'anger', tier: 'average', modifiers: ['suppressed'] },
  'furious': { base: 'anger', tier: 'high' },
  'outraged': { base: 'anger', tier: 'high' },
  'seething': { base: 'anger', tier: 'high', modifiers: ['suppressed'] },
  'livid': { base: 'anger', tier: 'high' },
  'enraged': { base: 'anger', tier: 'high' },
  'fuming': { base: 'anger', tier: 'high' },
  'incensed': { base: 'anger', tier: 'high' },
  'cross': { base: 'anger', tier: 'subtle' },
  'bitter': { base: 'anger', tier: 'average', modifiers: ['guarded'] },
  'resentful': { base: 'anger', tier: 'average', modifiers: ['guarded'] },

  // Fear
  'fear': { base: 'fear', tier: 'average' },
  'scared': { base: 'fear', tier: 'average' },
  'afraid': { base: 'fear', tier: 'average' },
  'nervous': { base: 'fear', tier: 'subtle', modifiers: ['guarded'] },
  'anxious': { base: 'fear', tier: 'average' },
  'worried': { base: 'fear', tier: 'subtle', modifiers: ['averted_gaze'] },
  'uneasy': { base: 'fear', tier: 'subtle', modifiers: ['guarded'] },
  'panicked': { special: 'panic' },
  'panicking': { special: 'panic' },
  'terrified': { base: 'fear', tier: 'high', modifiers: ['guarded'] },
  'horrified': { base: 'fear', tier: 'high', modifiers: ['guarded'] },
  'petrified': { base: 'fear', tier: 'high', modifiers: ['guarded'] },
  'shaking': { base: 'fear', tier: 'average', modifiers: ['shaky'] },
  'trembling': { base: 'fear', tier: 'average', modifiers: ['shaky'] },
  'distressed': { base: 'fear', tier: 'average', modifiers: ['guarded'] },

  // Surprise
  'surprise': { base: 'surprise', tier: 'average' },
  'surprised': { base: 'surprise', tier: 'average' },
  'startled': { base: 'surprise', tier: 'average' },
  'shocked': { base: 'surprise', tier: 'high' },
  'astonished': { base: 'surprise', tier: 'high' },
  'awestruck': { base: 'surprise', tier: 'high', modifiers: ['exposed'] },

  // Disgust
  'disgust': { base: 'disgust', tier: 'average' },
  'disgusted': { base: 'disgust', tier: 'average' },
  'repulsed': { base: 'disgust', tier: 'high' },
  'revolted': { base: 'disgust', tier: 'high' },
  'nauseated': { base: 'disgust', tier: 'high' },
  'grossed out': { base: 'disgust', tier: 'average' },

  // Special Presets
  'confident': { special: 'confident' },
  'confidence': { special: 'confident' },
  'assured': { special: 'confident' },
  'bold': { special: 'confident' },
  'brave': { special: 'confident' },
  'proud': { special: 'proud' },
  'pride': { special: 'proud' },
  'accomplished': { special: 'proud' },
  'smug': { special: 'smug' },
  'cocky': { special: 'smug' },
  'arrogant': { special: 'smug' },
  'determined': { special: 'determined' },
  'resolute': { special: 'determined' },
  'focused': { special: 'determined' },
  'steadfast': { special: 'determined' },
  'flustered': { special: 'flustered' },
  'tongue tied': { special: 'flustered' },
  'embarrassed': { special: 'embarrassed' },
  'ashamed': { special: 'embarrassed' },
  'shy': { base: 'fear', tier: 'subtle', modifiers: ['averted_gaze'] },
  'awkward': { base: 'fear', tier: 'subtle', modifiers: ['guarded'] },
  'self conscious': { base: 'fear', tier: 'subtle', modifiers: ['averted_gaze', 'guarded'] },
  'sad smile': { special: 'sad_smile' },
  'bittersweet': { special: 'sad_smile' },
  'contempt': { special: 'contempt' },
  'contemptuous': { special: 'contempt' },
  'scornful': { special: 'contempt' },
  'despair': { special: 'despair' },
  'panic': { special: 'panic' },
}

// ─── Random Pool ──────────────────────────────────────────────────────────────
// A curated, balanced set of emotion+intensity combos used when randomizing
// unfilled slots. Excludes high-intensity extremes and special presets to
// ensure generated sprite sets feel coherent rather than jarring.
export const RANDOM_POOL: Array<{ base: string; tier: IntensityTier }> = [
  { base: 'neutral', tier: 'average' },
  { base: 'neutral', tier: 'subtle' },
  { base: 'joy', tier: 'subtle' },
  { base: 'joy', tier: 'average' },
  { base: 'joy', tier: 'high' },
  { base: 'sadness', tier: 'subtle' },
  { base: 'sadness', tier: 'average' },
  { base: 'anger', tier: 'subtle' },
  { base: 'anger', tier: 'average' },
  { base: 'fear', tier: 'subtle' },
  { base: 'fear', tier: 'average' },
  { base: 'surprise', tier: 'average' },
  { base: 'disgust', tier: 'subtle' },
  // Special presets safe for randomization
  { base: 'confident', tier: 'average' },
  { base: 'determined', tier: 'average' },
  { base: 'proud', tier: 'average' },
]

// ─── Suggestion Groups ────────────────────────────────────────────────────────
// Used in the emotion typeahead to display grouped suggestions.
export const SUGGESTION_GROUPS = [
  {
    label: 'Positive',
    emotions: ['Happy', 'Joyful', 'Delighted', 'Ecstatic', 'Cheerful', 'Content', 'Warm', 'Elated', 'Confident', 'Proud'],
  },
  {
    label: 'Negative',
    emotions: ['Sad', 'Angry', 'Scared', 'Anxious', 'Disgusted', 'Frustrated', 'Miserable', 'Furious', 'Heartbroken'],
  },
  {
    label: 'Complex',
    emotions: ['Flustered', 'Embarrassed', 'Determined', 'Smug', 'Contempt', 'Sad Smile', 'Bittersweet', 'Despair', 'Panic'],
  },
  {
    label: 'Neutral',
    emotions: ['Neutral', 'Calm', 'Stoic', 'Composed', 'Unbothered', 'Blank'],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getBaseEmotion(id: string): BaseEmotion | undefined {
  return BASE_EMOTIONS.find(e => e.id === id)
}

export function getSpecialPreset(id: string): SpecialPreset | undefined {
  return SPECIAL_PRESETS.find(p => p.id === id)
}

export function getIntensity(tier: IntensityTier): IntensityDefinition {
  return INTENSITY_TIERS.find(t => t.value === tier) ?? INTENSITY_TIERS[1]
}

export function getAllEmotionLabels(): string[] {
  const base = BASE_EMOTIONS.map(e => e.label)
  const special = SPECIAL_PRESETS.map(p => p.label)
  return [...new Set([...base, ...special])]
}
