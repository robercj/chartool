// ─── POSE_PRESETS.ts ──────────────────────────────────────────────────────────
// Pose catalog for the Identity Lock sprite generation system.
//
// Each pose entry contains:
//   id          — unique key used internally
//   label       — user-facing display name
//   description — brief descriptor for tooltips
//   promptText  — exact text injected into the generation prompt
//   icon        — emoji representation for compact UI display
//
// Identity Safety:
//   All poses are designed to be plausible with the character's established
//   clothing and silhouette. The prompt compiler will include a reminder that
//   pose must remain consistent with outfit and body constraints.
//
// Randomization:
//   When pose is set to 'random' or not specified, the compiler will select
//   from RANDOM_POSE_POOL which excludes poses that risk outfit/silhouette
//   violations (e.g. lying down risks obscuring character identity).
// ─────────────────────────────────────────────────────────────────────────────

export interface PosePreset {
  id: string
  label: string
  description: string
  promptText: string
  icon: string
  safeForRandom: boolean  // false = excluded from auto-randomization pool
}

// ─── Pose Catalog ─────────────────────────────────────────────────────────────
export const POSE_CATALOG: PosePreset[] = [
  {
    id: 'neutral',
    label: 'Neutral Stance',
    description: 'Standing naturally in a relaxed, balanced position',
    promptText: 'standing in a neutral, relaxed stance; weight evenly distributed; arms at sides or loosely held',
    icon: '🧍',
    safeForRandom: true,
  },
  {
    id: 'confident',
    label: 'Confident Stance',
    description: 'Standing with assured, powerful body language',
    promptText: 'standing in a confident, composed power stance; chest slightly lifted; weight balanced; open posture',
    icon: '💪',
    safeForRandom: true,
  },
  {
    id: 'sitting',
    label: 'Sitting',
    description: 'Seated in a natural position',
    promptText: 'sitting down in a natural, relaxed seated position; posture consistent with character personality',
    icon: '🪑',
    safeForRandom: true,
  },
  {
    id: 'leaning',
    label: 'Leaning',
    description: 'Leaning casually against a surface',
    promptText: 'leaning casually against a surface or wall; relaxed, informal stance; weight shifted to one side',
    icon: '🫷',
    safeForRandom: true,
  },
  {
    id: 'walking',
    label: 'Walking',
    description: 'Mid-stride walking forward',
    promptText: 'mid-stride walking forward; natural gait; arms in natural swing; confident or casual depending on emotion',
    icon: '🚶',
    safeForRandom: true,
  },
  {
    id: 'reaching',
    label: 'Reaching',
    description: 'Reaching or extending toward something',
    promptText: 'reaching outward or upward; arm extended with purpose; body naturally shifted with the gesture',
    icon: '🙌',
    safeForRandom: true,
  },
  {
    id: 'arms_crossed',
    label: 'Arms Crossed',
    description: 'Standing with arms folded across the chest',
    promptText: 'standing with arms crossed or folded; closed but composed posture; feet planted steadily',
    icon: '🤐',
    safeForRandom: true,
  },
  {
    id: 'dynamic',
    label: 'Dynamic',
    description: 'Active, energetic pose suggesting motion or action',
    promptText: 'in a dynamic active pose suggesting motion or energy; body angled with intent; clothing and hair react naturally to movement',
    icon: '⚡',
    safeForRandom: true,
  },
  {
    id: 'kneeling',
    label: 'Kneeling',
    description: 'Kneeling on one or both knees',
    promptText: 'kneeling on one or both knees; posture upright and intentional; clothing drapes naturally in kneeling position',
    icon: '🧎',
    safeForRandom: false,  // can obscure outfit silhouette
  },
  {
    id: 'crouching',
    label: 'Crouching',
    description: 'Low crouching position, ready or thoughtful',
    promptText: 'crouching low; compact posture; weight on balls of feet; clothing and silhouette remain identifiable',
    icon: '🦆',
    safeForRandom: false,  // can change silhouette significantly
  },
  {
    id: 'lying',
    label: 'Lying Down',
    description: 'Reclining or lying on a surface',
    promptText: 'lying down on a surface; body relaxed and horizontal; face and key identifying features clearly visible',
    icon: '😴',
    safeForRandom: false,  // significant silhouette change
  },
  {
    id: 'back_turned',
    label: 'Back Turned',
    description: 'Facing away, looking over shoulder',
    promptText: 'turned away from viewer; looking back over one shoulder; face partially visible; outfit back details visible',
    icon: '↩️',
    safeForRandom: false,  // obscures face identity
  },
]

// ─── Random Pose Pool ─────────────────────────────────────────────────────────
// Only poses with safeForRandom: true are included here.
export const RANDOM_POSE_POOL: PosePreset[] = POSE_CATALOG.filter(p => p.safeForRandom)

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getPoseById(id: string): PosePreset | undefined {
  return POSE_CATALOG.find(p => p.id === id)
}

export function getRandomPose(exclude: string[] = []): PosePreset {
  const pool = RANDOM_POSE_POOL.filter(p => !exclude.includes(p.id))
  if (pool.length === 0) return RANDOM_POSE_POOL[0]
  return pool[Math.floor(Math.random() * pool.length)]
}
