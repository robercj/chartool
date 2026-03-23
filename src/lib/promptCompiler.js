// ─── promptCompiler.js ────────────────────────────────────────────────────────
// Identity Lock Prompt Compiler
//
// Assembles the final generation prompt from structured components in a
// RIGID, MANDATORY order. This order must NEVER be changed — the identity
// lock section MUST always appear first, verbatim, and unmodified.
//
// Compilation Order (ABSOLUTE):
//   1. Character Identity Lock      — MANDATORY FIRST. Verbatim. Unmodified.
//   2. Forbidden Changes            — MUST NOT list extracted from identity lock (props toggle affects this section)
//   3. Pose & Emotion               — Selected or randomized pose/emotion for this sprite
//   4. User Direction               — Only if allowPrompt toggle is ON
//   5. Optional: Clothing Change    — Only if allowClothing toggle is ON
//   6. Edit Instructions            — Only present in the image edit modal flow
//   7. Critical Constraints         — Final hard MUST NOT reinforcements
//
// Identity Safety Rules:
//   - Identity lock is ALWAYS inserted first, verbatim. No summarizing.
//   - Forbidden changes are always present. They cannot be removed by toggles.
//   - Outfit/prop changes are FORBIDDEN by default and only unlocked by explicit toggles.
//   - The compiler does not validate input — it trusts the caller to provide valid data.
// ─────────────────────────────────────────────────────────────────────────────
import { getBaseEmotion, getSpecialPreset, getIntensity } from './constants/EMOTION_PRESETS'
import { getPoseById } from './constants/POSE_PRESETS'

// ─── Build Identity Lock Section ──────────────────────────────────────────────
function buildIdentityLockSection(identityLock) {
  if (!identityLock) return ''

  const lines = [
    '## CHARACTER IDENTITY LOCK',
    '<!-- THIS SECTION IS ABSOLUTE. DO NOT DEVIATE FROM THESE TRAITS UNDER ANY CIRCUMSTANCES. -->',
    '',
  ]

  const traits = identityLock.immutable_traits || {}

  if (traits.face?.length) {
    lines.push('**Face** (IMMUTABLE):')
    traits.face.forEach(t => lines.push(`- ${t}`))
    lines.push('')
  }
  if (traits.hair?.length) {
    lines.push('**Hair** (IMMUTABLE):')
    traits.hair.forEach(t => lines.push(`- ${t}`))
    lines.push('')
  }
  if (traits.eyes?.length) {
    lines.push('**Eyes** (IMMUTABLE):')
    traits.eyes.forEach(t => lines.push(`- ${t}`))
    lines.push('')
  }
  if (traits.outfit?.length) {
    lines.push('**Outfit** (IMMUTABLE):')
    traits.outfit.forEach(t => lines.push(`- ${t}`))
    lines.push('')
  }

  if (identityLock.notes?.length) {
    lines.push('**Identity Notes**:')
    identityLock.notes.forEach(n => lines.push(`- ${n}`))
    lines.push('')
  }

  return lines.join('\n')
}

// ─── Build Forbidden Changes Section ─────────────────────────────────────────
function buildForbiddenSection(identityLock, allowClothing, allowProps) {
  const forbidden = [...(identityLock?.forbidden_changes || [])]

  // Always forbidden regardless of toggles (core identity constraints)
  const coreConstraints = [
    'DO NOT alter facial structure, proportions, or any identifying facial features',
    'DO NOT change hair color, style, or length',
    'DO NOT change eye color or shape',
    'DO NOT alter skin tone or complexion',
    'DO NOT add facial markings, tattoos, scars, or features not present in the reference',
    'DO NOT change age impression or body proportions',
  ]

  // Conditionally forbidden based on toggles
  if (!allowClothing) {
    coreConstraints.push(
      'DO NOT change, swap, or modify the outfit or clothing in any way — clothing is identity-locked',
      'DO NOT remove or alter accessories that are part of the established character design',
    )
  }

  if (!allowProps) {
    coreConstraints.push(
      'DO NOT add props, items, or objects not present in the reference image',
      'DO NOT add new accessories beyond what is established in the reference',
    )
  }

  const allForbidden = [...new Set([...coreConstraints, ...forbidden])]

  if (allForbidden.length === 0) return ''

  const lines = [
    '## FORBIDDEN CHANGES — ABSOLUTE CONSTRAINTS',
    '<!-- VIOLATION OF THESE RULES BREAKS CHARACTER IDENTITY -->',
    '',
  ]
  allForbidden.forEach(f => lines.push(`- ${f}`))

  return lines.join('\n')
}

// ─── Build Pose & Emotion Section ─────────────────────────────────────────────
function buildPoseEmotionSection(poseId, emotionEntry) {
  const lines = ['## POSE & EMOTION FOR THIS VARIATION', '']

  // Pose
  const pose = poseId ? getPoseById(poseId) : null
  if (pose) {
    lines.push(`**Pose**: ${pose.promptText}`)
    lines.push('- Pose must remain plausible with the character\'s established clothing and silhouette')
    lines.push('- Clothing behavior, draping, and fit must be consistent with how the outfit would behave in this pose')
    lines.push('')
  }

  // Emotion
  if (emotionEntry) {
    lines.push(...buildEmotionInstructions(emotionEntry))
  }

  return lines.join('\n')
}

// ─── Build Emotion Instructions ───────────────────────────────────────────────
function buildEmotionInstructions(emotionEntry) {
  const lines = []
  const { resolved, isVerbatim, rawInput, intensity, modifiers } = emotionEntry

  if (isVerbatim || !resolved) {
    // Verbatim passthrough — LLM interprets directly
    lines.push(`**Emotion**: ${rawInput}`)
    lines.push('- Express this emotion clearly while preserving all identity-locked facial features')
    lines.push('- Adjust only muscle tension and expression — never alter facial geometry or proportions')
    if (intensity) {
      const tier = getIntensity(intensity)
      lines.push(`- Intensity: ${tier.label} — ${tier.description}`)
      tier.promptAdjustments.forEach(a => lines.push(`  - ${a}`))
    }
    if (modifiers?.trim()) {
      lines.push(`- Additional modifier instructions: ${modifiers.trim()}`)
    }
    lines.push('')
    return lines
  }

  // Resolved emotion (from alias/fuzzy match)
  if (resolved.special) {
    const preset = getSpecialPreset(resolved.special)
    if (preset) {
      lines.push(`**Emotion**: ${preset.label}`)
      lines.push(`*${preset.description}*`)
      lines.push('')
      lines.push('Face cues (identity-safe adjustments only):')
      preset.face.forEach(f => lines.push(`- ${f}`))
      lines.push('')
      lines.push('Pose influence:')
      preset.pose.forEach(p => lines.push(`- ${p}`))
      lines.push('')

      // Intensity override
      if (intensity && intensity !== preset.baseTier) {
        const tier = getIntensity(intensity)
        lines.push(`**Intensity Override**: ${tier.label} — ${tier.description}`)
        tier.promptAdjustments.forEach(a => lines.push(`- ${a}`))
        lines.push('')
      }

      // Micro-rules always included
      lines.push('Identity safety rules for this emotion:')
      preset.microRules.forEach(r => lines.push(`- ${r}`))
      lines.push('')
    }
  } else if (resolved.base) {
    const base = getBaseEmotion(resolved.base)
    const tier = getIntensity(intensity || resolved.tier || 'average')

    if (base) {
      lines.push(`**Emotion**: ${base.label} (${tier.label} intensity)`)
      lines.push('')
      lines.push('Face cues (adjust expression only — never facial geometry):')
      base.cues.face.forEach(f => lines.push(`- ${f}`))
      lines.push('')
      lines.push('Pose influence (keep consistent with identity and clothing):')
      base.cues.pose.forEach(p => lines.push(`- ${p}`))
      lines.push('')
      lines.push(`Intensity — ${tier.label}: ${tier.description}`)
      tier.promptAdjustments.forEach(a => lines.push(`- ${a}`))
      lines.push('')
    }

    // Resolved modifiers (from alias definition)
    const resolvedMods = resolved.modifiers || []
    if (resolvedMods.length > 0) {
      lines.push('Modifier overlays:')
      resolvedMods.forEach(modId => {
        lines.push(`- ${modId.replace(/_/g, ' ')}: applied to expression and posture`)
      })
      lines.push('')
    }
  }

  // User-provided modifier text (freeform)
  if (modifiers?.trim()) {
    lines.push(`**Additional modifier instructions**: ${modifiers.trim()}`)
    lines.push('- Apply these as adjustments to expression/posture only')
    lines.push('- These instructions MUST NOT override identity-locked facial features')
    lines.push('')
  }

  // Always close with identity reminder
  lines.push('Identity priority: If any emotional expression risks distorting identity-locked features,')
  lines.push('REDUCE intensity before altering facial geometry. Identity consistency supersedes emotion intensity.')
  lines.push('')

  return lines
}

// ─── Build User Direction Section ─────────────────────────────────────────────
function buildUserDirectionSection(customPrompt) {
  if (!customPrompt?.trim()) return ''

  return [
    '## USER DIRECTION',
    '<!-- Apply these instructions while respecting ALL identity lock constraints above -->',
    '',
    customPrompt.trim(),
    '',
    '**Important**: User direction MUST NOT override the Character Identity Lock or Forbidden Changes sections.',
    'If there is conflict, the Identity Lock takes absolute precedence.',
    '',
  ].join('\n')
}

// ─── Build Edit Instructions Section ─────────────────────────────────────────
function buildEditInstructionsSection(editInstructions) {
  if (!editInstructions?.trim()) return ''

  return [
    '## EDIT INSTRUCTIONS',
    '<!-- These edits apply to the specific sprite being refined -->',
    '',
    editInstructions.trim(),
    '',
    '**Important**: Edit instructions MUST NOT override the Character Identity Lock or Forbidden Changes sections.',
    'If there is conflict, the Identity Lock takes absolute precedence.',
    '',
  ].join('\n')
}

// ─── Build Clothing Change Section ───────────────────────────────────────────
function buildClothingSection(clothingDescription) {
  if (!clothingDescription?.trim()) return ''

  return [
    '## CLOTHING VARIATION (EXPLICITLY PERMITTED)',
    '<!-- Outfit change has been explicitly permitted by the user for this variation -->',
    '',
    clothingDescription.trim(),
    '',
    '**Important**: Clothing change is permitted BUT all other identity-locked traits',
    '(face, hair, eyes, body proportions) remain ABSOLUTELY immutable.',
    '',
  ].join('\n')
}

// ─── Build Critical Constraints Footer ───────────────────────────────────────
function buildCriticalConstraintsSection() {
  const lines = [
    '## CRITICAL GENERATION CONSTRAINTS — READ BEFORE RENDERING',
    '',
    '- CHARACTER IDENTITY IS ABSOLUTE. Every listed immutable trait must be pixel-perfect consistent.',
    '- Only facial muscles and expression may change. Facial structure, proportions, and geometry are locked.',
    '- If emotional expression conflicts with identity lock, REDUCE intensity. Do not bend identity.',
    '- Pose must be physically plausible for this character\'s body type, height, and outfit.',
    '- Lighting, style, art direction, and color palette must remain consistent with the reference image.',
    '- No additional characters, no background story elements, no context-changing props.',
    '- Output must be immediately recognizable as the same character from the reference image.',
    '',
  ]

  return lines.join('\n')
}

// ─── Main Compile Function ────────────────────────────────────────────────────
/**
 * Compile the final generation prompt for a single sprite variation.
 *
 * @param {object} options
 * @param {object} options.identityLock          — Structured identity lock JSON from analysis
 * @param {string} options.consistencyPrompt     — Raw text consistency prompt (used as fallback if no lock)
 * @param {string} options.poseId                — Pose catalog ID (e.g. 'neutral', 'sitting')
 * @param {object} options.emotionEntry          — Resolved emotion entry from EmotionListInput
 * @param {boolean} options.allowPrompt          — Whether custom user prompt is permitted
 * @param {string}  options.customPrompt         — User's custom prompt text
 * @param {boolean} options.allowClothing        — Whether clothing changes are permitted
 * @param {string}  options.clothingDescription  — Clothing change description (if allowed)
 * @param {boolean} options.allowProps           — Whether prop additions are permitted
 * @param {string}  options.editInstructions     — Edit instructions (image edit modal only)
 * @returns {string}  Final compiled prompt ready for generation
 */
export function compileSpritePrompt({
  identityLock,
  consistencyPrompt,
  poseId,
  emotionEntry,
  allowPrompt = false,
  customPrompt = '',
  allowClothing = false,
  clothingDescription = '',
  allowProps = false,
  editInstructions = '',
}) {
  const sections = []

  // ── SECTION 1: Identity Lock (MANDATORY FIRST) ─────────────────────────
  if (identityLock) {
    sections.push(buildIdentityLockSection(identityLock))
  } else if (consistencyPrompt) {
    // Fallback: use the flat-text consistency prompt from older analysis
    sections.push([
      '## CHARACTER IDENTITY LOCK',
      '<!-- THIS SECTION IS ABSOLUTE. DO NOT DEVIATE FROM THESE TRAITS. -->',
      '',
      consistencyPrompt.trim(),
      '',
    ].join('\n'))
  }

  // ── SECTION 2: Forbidden Changes ───────────────────────────────────────
  sections.push(buildForbiddenSection(identityLock, allowClothing, allowProps))

  // ── SECTION 3: Pose & Emotion ───────────────────────────────────────────
  sections.push(buildPoseEmotionSection(poseId, emotionEntry))

  // ── SECTION 4: User Direction (only if enabled) ─────────────────────────
  if (allowPrompt && customPrompt?.trim()) {
    sections.push(buildUserDirectionSection(customPrompt))
  }

  // ── SECTION 5: Clothing Change (only if enabled and provided) ────────────
  if (allowClothing && clothingDescription?.trim()) {
    sections.push(buildClothingSection(clothingDescription))
  }

  // ── SECTION 6: Edit Instructions (image edit modal flow only) ────────────
  if (editInstructions?.trim()) {
    sections.push(buildEditInstructionsSection(editInstructions))
  }

  // ── SECTION 7: Critical Constraints Footer ──────────────────────────────
  sections.push(buildCriticalConstraintsSection())

  return sections.filter(Boolean).join('\n---\n\n')
}

// ─── Compile Edit Prompt ──────────────────────────────────────────────────────
/**
 * Compile a prompt specifically for the image edit modal.
 * Reuses the original pose/emotion context but appends edit instructions.
 *
 * NOTE: Currently using the same generation model as sprite generation.
 * This may need to be switched to a dedicated edit/inpainting model
 * (e.g. fal-ai/nano-banana-2/edit) depending on generation quality and
 * consistency of edits. The API call structure would need updating in
 * generateImage() if switching to an edit model.
 *
 * @param {object} options
 * @param {object} options.identityLock
 * @param {string} options.consistencyPrompt
 * @param {string} options.originalPoseId          — Pose from original generation
 * @param {object} options.originalEmotionEntry    — Emotion from original generation
 * @param {string} options.editInstructions         — User's edit instructions
 * @param {boolean} options.allowClothing
 * @param {boolean} options.allowProps
 * @returns {string}
 */
export function compileEditPrompt({
  identityLock,
  consistencyPrompt,
  originalPoseId,
  originalEmotionEntry,
  editInstructions,
  allowClothing = false,
  allowProps = false,
}) {
  return compileSpritePrompt({
    identityLock,
    consistencyPrompt,
    poseId: originalPoseId,
    emotionEntry: originalEmotionEntry,
    allowPrompt: false,
    customPrompt: '',
    allowClothing,
    clothingDescription: '',
    allowProps,
    editInstructions,
  })
}

// ─── Resolve Sprite Variations ────────────────────────────────────────────────
/**
 * Given user emotion entries and a total count N, resolve all N variations.
 * User-provided entries take priority. Remaining slots are filled randomly.
 *
 * @param {object[]} userEmotionEntries   — Array of EmotionEntry objects from UI
 * @param {string}   poseId              — Selected pose ID or 'random'
 * @param {number}   count               — Total sprite count N
 * @param {object[]} randomPool          — RANDOM_POOL from EMOTION_PRESETS
 * @param {object[]} randomPosePool      — RANDOM_POSE_POOL from POSE_PRESETS
 * @returns {{ emotionEntry, poseId }[]}  Array of N resolved variation specs
 */
export function resolveVariationSpecs(userEmotionEntries, poseId, count, randomPool, randomPosePool) {
  const specs = []

  // Fill user-provided entries first (up to count)
  for (let i = 0; i < Math.min(userEmotionEntries.length, count); i++) {
    const entry = userEmotionEntries[i]
    const resolvedPoseId = poseId === 'random'
      ? randomPosePool[Math.floor(Math.random() * randomPosePool.length)].id
      : poseId
    specs.push({ emotionEntry: entry, poseId: resolvedPoseId })
  }

  // Fill remaining slots with random selections
  const remaining = count - specs.length
  if (remaining > 0) {
    const shuffled = [...randomPool].sort(() => Math.random() - 0.5)
    const posesShuffled = [...randomPosePool].sort(() => Math.random() - 0.5)

    for (let i = 0; i < remaining; i++) {
      const poolItem = shuffled[i % shuffled.length]
      const randomPose = posesShuffled[i % posesShuffled.length]

      const randomEntry = {
        emotion: poolItem.base,
        rawInput: poolItem.base,
        intensity: poolItem.tier,
        modifiers: '',
        resolved: { base: poolItem.base, tier: poolItem.tier },
        isVerbatim: false,
      }

      const resolvedPoseId = poseId === 'random' ? randomPose.id : poseId
      specs.push({ emotionEntry: randomEntry, poseId: resolvedPoseId })
    }
  }

  return specs
}
