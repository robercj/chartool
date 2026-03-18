// ─── emotionMatcher.js ────────────────────────────────────────────────────────
// Fuzzy matching engine for user-typed emotion input.
//
// Resolution pipeline:
//   1. Normalize input (lowercase, trim, collapse whitespace)
//   2. Exact match in EMOTION_ALIASES
//   3. Levenshtein distance ≤ 2 fuzzy match against alias keys
//   4. Substring containment check (e.g. "joyfully" contains "joy")
//   5. No match → verbatim passthrough (LLM interprets directly)
//
// Return shape:
//   {
//     resolved: EmotionAlias | null,   // null = verbatim
//     isVerbatim: boolean,
//     matchedKey: string | null,       // what alias key was matched
//     confidence: 'exact' | 'fuzzy' | 'substring' | 'verbatim'
//   }
// ─────────────────────────────────────────────────────────────────────────────
import { EMOTION_ALIASES, BASE_EMOTIONS, SPECIAL_PRESETS } from './constants/EMOTION_PRESETS'

// ─── Levenshtein Distance ─────────────────────────────────────────────────────
function levenshtein(a, b) {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = 1 + Math.min(
          matrix[i - 1][j],      // deletion
          matrix[i][j - 1],      // insertion
          matrix[i - 1][j - 1],  // substitution
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

// ─── Normalize Input ──────────────────────────────────────────────────────────
function normalize(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')    // collapse whitespace
    .replace(/[^a-z0-9 ]/g, '') // strip punctuation
}

// ─── Main Resolver ────────────────────────────────────────────────────────────
/**
 * Resolve a user-typed emotion string to a canonical emotion definition.
 *
 * @param {string} input  Raw user input (e.g. "Joyous", "sad smile", "melancholic")
 * @returns {{
 *   resolved: object|null,
 *   isVerbatim: boolean,
 *   matchedKey: string|null,
 *   displayLabel: string,
 *   confidence: 'exact'|'fuzzy'|'substring'|'verbatim'
 * }}
 */
export function resolveEmotion(input) {
  if (!input || !input.trim()) {
    return {
      resolved: null,
      isVerbatim: true,
      matchedKey: null,
      displayLabel: '',
      confidence: 'verbatim',
    }
  }

  const normalized = normalize(input)

  // ── Step 1: Exact match ──────────────────────────────────────────────────
  if (EMOTION_ALIASES[normalized]) {
    const resolved = EMOTION_ALIASES[normalized]
    const displayLabel = getDisplayLabel(resolved, normalized)
    return {
      resolved,
      isVerbatim: false,
      matchedKey: normalized,
      displayLabel,
      confidence: 'exact',
    }
  }

  // ── Step 2: Levenshtein fuzzy match (distance ≤ 2) ───────────────────────
  // Only attempt if input is >= 3 chars to avoid false positives on very short strings
  if (normalized.length >= 3) {
    let bestMatch = null
    let bestDistance = Infinity

    for (const key of Object.keys(EMOTION_ALIASES)) {
      // Only fuzzy match against keys of similar length (within ±3 chars)
      if (Math.abs(key.length - normalized.length) > 3) continue
      const dist = levenshtein(normalized, key)
      if (dist < bestDistance && dist <= 2) {
        bestDistance = dist
        bestMatch = key
      }
    }

    if (bestMatch) {
      const resolved = EMOTION_ALIASES[bestMatch]
      const displayLabel = getDisplayLabel(resolved, bestMatch)
      return {
        resolved,
        isVerbatim: false,
        matchedKey: bestMatch,
        displayLabel,
        confidence: 'fuzzy',
      }
    }
  }

  // ── Step 3: Substring containment ────────────────────────────────────────
  // e.g. "joyfully" contains "joy", "happiness" contains "happy"
  for (const key of Object.keys(EMOTION_ALIASES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      if (key.length >= 3) { // avoid single-char matches
        const resolved = EMOTION_ALIASES[key]
        const displayLabel = getDisplayLabel(resolved, key)
        return {
          resolved,
          isVerbatim: false,
          matchedKey: key,
          displayLabel,
          confidence: 'substring',
        }
      }
    }
  }

  // ── Step 4: Direct base emotion id check ─────────────────────────────────
  const baseMatch = BASE_EMOTIONS.find(e => e.id === normalized || e.label.toLowerCase() === normalized)
  if (baseMatch) {
    return {
      resolved: { base: baseMatch.id, tier: 'average' },
      isVerbatim: false,
      matchedKey: baseMatch.id,
      displayLabel: baseMatch.label,
      confidence: 'exact',
    }
  }

  // ── Step 5: Direct special preset check ──────────────────────────────────
  const specialMatch = SPECIAL_PRESETS.find(p => p.id === normalized || p.label.toLowerCase() === normalized)
  if (specialMatch) {
    return {
      resolved: { special: specialMatch.id },
      isVerbatim: false,
      matchedKey: specialMatch.id,
      displayLabel: specialMatch.label,
      confidence: 'exact',
    }
  }

  // ── Step 6: Verbatim passthrough ─────────────────────────────────────────
  // No match found. Return as-is for the LLM to interpret directly.
  return {
    resolved: null,
    isVerbatim: true,
    matchedKey: null,
    displayLabel: input.trim(),
    confidence: 'verbatim',
  }
}

// ─── Get Display Label ────────────────────────────────────────────────────────
function getDisplayLabel(resolved, fallbackKey) {
  if (resolved.special) {
    const preset = SPECIAL_PRESETS.find(p => p.id === resolved.special)
    return preset?.label ?? resolved.special
  }
  if (resolved.base) {
    const base = BASE_EMOTIONS.find(e => e.id === resolved.base)
    return base?.label ?? resolved.base
  }
  return fallbackKey
}

// ─── Get Suggestions ─────────────────────────────────────────────────────────
/**
 * Get typeahead suggestions for a partial input string.
 * Returns up to `limit` suggestions sorted by match quality.
 *
 * @param {string} partial  Partial input string
 * @param {number} limit    Max suggestions to return (default 8)
 * @returns {string[]}      Sorted suggestion display labels
 */
export function getEmotionSuggestions(partial, limit = 8) {
  if (!partial || partial.trim().length < 1) return []

  const norm = normalize(partial)
  const seen = new Set()
  const results = []

  // Build a flat list of all searchable labels from base emotions + special presets
  const searchable = [
    ...BASE_EMOTIONS.map(e => ({ label: e.label, key: e.id })),
    ...SPECIAL_PRESETS.map(p => ({ label: p.label, key: p.id })),
    ...Object.keys(EMOTION_ALIASES).map(k => ({
      label: k.charAt(0).toUpperCase() + k.slice(1),
      key: k,
    })),
  ]

  for (const item of searchable) {
    const itemNorm = normalize(item.label)
    if (seen.has(itemNorm)) continue

    // Prefix match gets priority
    if (itemNorm.startsWith(norm)) {
      seen.add(itemNorm)
      results.unshift(item.label)
    } else if (itemNorm.includes(norm)) {
      seen.add(itemNorm)
      results.push(item.label)
    }

    if (results.length >= limit * 2) break
  }

  // Deduplicate and trim
  return [...new Set(results)].slice(0, limit)
}

// ─── Match Confidence Label ───────────────────────────────────────────────────
/**
 * Returns a human-readable description of the match confidence for UI hints.
 */
export function getConfidenceHint(confidence, matchedKey) {
  switch (confidence) {
    case 'exact':
      return null // No hint needed for exact matches
    case 'fuzzy':
      return `Matched as "${matchedKey}" — adjust if incorrect`
    case 'substring':
      return `Interpreted as "${matchedKey}" — adjust if incorrect`
    case 'verbatim':
      return 'No preset match — will be passed directly to the AI for interpretation'
    default:
      return null
  }
}
