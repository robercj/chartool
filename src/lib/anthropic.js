// ─── anthropic.js ─────────────────────────────────────────────────────────────
// All AI calls are proxied through Supabase Edge Functions. API keys
// (Anthropic, fal.ai) live exclusively in Supabase secrets and are never
// present in the browser bundle.
//
// Call flow:
//   Browser → supabase.functions.invoke()
//          → Edge Function (JWT auth + usage-limit check)
//          → Anthropic API / fal.ai
//
// NOTE: This project uses Supabase's new publishable-key format (sb_publishable_).
// Legacy anon keys (eyJ...) are not used.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from './supabase';

// ─── Storyline Generation: Narrative Architecture Agent ───────────────────────
export const STORYLINE_SYSTEM_PROMPT = `You are the Narrative Architecture Agent — a master story architect specializing in structured roleplay prompt construction. Your role is to transform raw premise data into a precisely formatted two-section roleplay prompt.

## OUTPUT FORMAT

You must output exactly three labeled sections in this order:

---
SECTION A — PROMPT PLOT
---
[Full narrative setup: world context, protagonist identity, NPC web, faction landscape, power hierarchy, and the opening situation. Written in second-person present tense ("You are...", "The world is..."). This section is the complete IC (in-character) setup the narrator will use to begin the roleplay. It should be immersive, dense with specific detail, and leave the reader fully oriented in the world.]

---
SECTION B — PROMPT GUIDELINES
---
[Mechanical and structural rules for the narrator. Cover: genre tone requirements, power fantasy calibration, structural overlay instructions (underdog arc, fish-out-of-water, etc.), preferred hook execution, moral complexity handling, growth mechanism triggers, content prohibitions, and any specific thematic/stylistic directives from the user. Written in second-person imperative ("Maintain...", "Ensure...", "When X occurs..."). This is the OOC (out-of-character) narrator instruction manual.]

---
SECTION C — AI REMINDERS
---
[A concise bullet-point list (8–15 bullets) of the most critical mechanical rules the narrator must actively remember during play. Focus on the items most likely to be forgotten or violated: power limits, relationship vectors, forbidden content, growth triggers, NPC hidden states, faction stances. Each bullet is one sentence, direct, no elaboration.]

## CONSTRUCTION RULES

**Section A requirements:**
- Open with a 2–3 sentence world-context paragraph establishing the setting's power structure and current equilibrium state
- Protagonist block: name/title, status in world hierarchy, physical description (social mask vs true form if different), current abilities with explicit limitations/costs, what they don't know about themselves
- NPC web: each NPC introduced with their surface presentation, hidden internal state, relationship vector to protagonist, and cross-connections to other NPCs
- Faction landscape: each faction with their purpose, current stance toward protagonist, and moral complexity
- Close with the opening scene: the frozen crisis moment from the premise, rendered in vivid second-person present tense

**Section B requirements:**
- Genre & tone: translate the selected genres into specific atmospheric and stylistic directives
- Power fantasy ratio: if ratio is 40–55, emphasize tension, close calls, and earned victories; if 60–70, balance dominance with meaningful resistance; if 75–80, lean into power fantasy with strong opposition maintaining pressure
- Structural overlays: if underdog ascension is active, the narrator must ensure the protagonist starts from a position of disadvantage and growth milestones are visible; if fish-out-of-water, culture shock and learning curve must be maintained; if anti-hero, moral greyness must be preserved; if tournament/gauntlet, escalating challenge structure must be respected
- Hook type: give specific execution guidance for the chosen first hook
- Growth mechanism: give specific triggers and conditions
- Prohibitions: list all forbidden content including any user-specified additions
- Additional context: incorporate any thematic inspirations or specific requests

**Section C requirements:**
- Extract the 8–15 most mechanically critical rules from A and B
- Prioritize: ability costs/limitations, relationship states that must not be skipped, forbidden content, growth triggers, NPC hidden states that must be maintained
- Write each as a single direct imperative sentence

## QUALITY STANDARDS

- Never invent facts that contradict the premise data
- If a field was left null/empty, do not fabricate content for it — simply omit that element
- Protagonist abilities must preserve both the function AND the limitation/cost as specified
- NPC relationship vectors must appear in Section A exactly as specified — do not resolve or advance them in the opening
- The opening situation must match the premise's "frozen crisis moment" — do not start the story before or after this point
- Maintain the firewall between Section A (world/character facts) and Section B (narrator instructions) — no mechanical rules in A, no in-world lore in B`;

// ─── callEdgeFunction ─────────────────────────────────────────────────────────
// Internal helper — invokes a Supabase Edge Function with the authenticated
// session attached automatically by the Supabase client.
//
// @param {string}      functionName  Name of the edge function (e.g. 'anthropic-proxy')
// @param {object}      body          Request payload
// @param {AbortSignal} [signal]      Optional cancellation signal
// @throws {LimitError}  On HTTP 429 (usage limit reached)
// @throws {Error}       On all other non-OK responses
async function callEdgeFunction(functionName, body, signal = null) {
  await supabase.auth.initialize();
  const invokeOptions = { body };
  if (signal) invokeOptions.signal = signal;

  const { data, error } = await supabase.functions.invoke(functionName, invokeOptions);

  if (error) {
    // Detect abort/cancellation — don't treat as a user-visible error
    if (
      error.name === 'AbortError' ||
      error.message?.includes('aborted') ||
      error.message?.includes('cancelled') ||
      signal?.aborted
    ) {
      throw new Error('Request cancelled');
    }

    // supabase.functions.invoke wraps the real HTTP response in error.context
    let message = null;
    let status = null;

    try {
      const ctx = error.context;
      if (ctx instanceof Response) {
        status = ctx.status;
        const text = await ctx.clone().text();
        console.error(`[${functionName}] HTTP ${status}:`, text);
        try {
          const json = JSON.parse(text);
          message = json.error ?? json.message ?? text;
        } catch {
          message = text;
        }
      } else if (ctx) {
        status = ctx.status;
        message = ctx.body ?? error.message;
        console.error(`[${functionName}] error context:`, ctx);
      }
    } catch (parseErr) {
      console.error(`[${functionName}] could not parse error:`, parseErr);
    }

    message = message || error.message || 'Edge function error';
    console.error(`[${functionName}] final error:`, message, '| status:', status);

    if (status === 429) throw new LimitError(message);
    throw new Error(message);
  }

  return data;
}

// Custom error class so callers can distinguish limit errors from other errors
export class LimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LimitError';
  }
}

// ─── Storyline API Call ────────────────────────────────────────────────────────
export async function callStorylineAPI({ formPayload, maxTokens }) {
  const userMessage = `Using the story premise data below, construct a complete two-section roleplay prompt following the Narrative Architecture Agent schema exactly. Output SECTION A (PROMPT PLOT) and SECTION B (PROMPT GUIDELINES) as defined in your instructions. Then output a third section labeled SECTION C (AI REMINDERS) containing a concise bullet-point summary of the most critical mechanical rules the narrator must remember during play.

Premise data:
${JSON.stringify(formPayload, null, 2)}`;

  const data = await callEdgeFunction('anthropic-proxy', {
    _generation_type: 'story',
    model: 'claude-opus-4-5',
    max_tokens: maxTokens,
    temperature: 1.0,
    system: STORYLINE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  return data.content?.[0]?.text || '';
}

// ─── LLM: Anthropic Claude (general + image analysis) ────────────────────────
export async function callLLM({ prompt, imageUrls = [], responseSchema = null, generationType = 'image' }) {
  const content = [];
  for (const url of imageUrls) {
    const [meta, imageData] = url.split(',');
    const match = meta.match(/:(.*?);/);
    const mediaType = match?.[1] ?? 'image/jpeg';
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } });
  }
  content.push({ type: 'text', text: prompt });

  const systemPrompt = responseSchema
    ? 'Respond ONLY with valid JSON matching the schema. No markdown, no explanation, no backticks.'
    : 'You are a helpful assistant.';

  const data = await callEdgeFunction('anthropic-proxy', {
    _generation_type: generationType,
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  });

  const text = data.content?.[0]?.text || '';

  if (responseSchema) {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  }
  return text;
}

// ─── generateImage ────────────────────────────────────────────────────────────
// Reference-image-guided generation via fal-ai/nano-banana-2/edit.
// Requires at least one reference image (referenceImageUrls or referenceImageUrl).
// Uses sync_mode — result returns in a single HTTP response (no polling).
// The edge function enforces a 90 s per-attempt timeout with up to 3 retries.
//
// @param {string}   prompt
// @param {string}   [referenceImageUrl]   Legacy single-image path
// @param {string[]} [referenceImageUrls]  Preferred: multiple source angles
// @param {string}   [propImageUrl]        Appended after reference images
// @param {string}   [aspectRatio='3:4']
// @param {AbortSignal} [signal]
// @returns {Promise<string>} CDN URL of the generated image
export async function generateImage({ prompt, referenceImageUrl, referenceImageUrls, propImageUrl, aspectRatio = '3:4' }, signal = null) {
  const sourceImages = [];
  if (referenceImageUrls && referenceImageUrls.length > 0) {
    sourceImages.push(...referenceImageUrls.filter(Boolean));
  } else if (referenceImageUrl) {
    sourceImages.push(referenceImageUrl);
  }
  if (propImageUrl) sourceImages.push(propImageUrl);

  const input = {
    prompt,
    aspect_ratio: aspectRatio,
    num_images: 1,
    output_format: 'png',
    resolution: '1K',
    image_urls: sourceImages,
  };

  const result = await callEdgeFunction('fal-generate', { input }, signal);

  const images = result?.images;
  if (!images?.[0]) throw new Error('fal.ai returned no image');
  return images[0].url;
}

// ─── removeImageBackground ───────────────────────────────────────────────────
// Background removal via fal-ai/imageutils/rembg.
// Throws on failure — callers must decide whether to surface the error or fall
// back to the original image. Do NOT swallow this in a silent catch block.
//
// @param {string}      imageUrl  URL of the image to process
// @param {AbortSignal} [signal]
// @returns {Promise<string>} CDN URL of the processed image (PNG with alpha)
export async function removeImageBackground(imageUrl, signal = null) {
  const result = await callEdgeFunction('fal-rembg', { image_url: imageUrl }, signal);
  const outputUrl = result?.image?.url;
  if (!outputUrl) throw new Error('Background removal returned no image');
  return outputUrl;
}

// ─── Character Manifest Generation: Claude ──────────────────────────────────
// Generates a prose character manifest (AI roleplay system prompt).
//
// Two modes:
//   hasImage=true  → returns { manifest } only (image already exists)
//   hasImage=false → returns { manifest, imagePrompt } so the caller can pass
//                    imagePrompt straight to fal.ai without a second round-trip
//
// In both modes Claude fills in any gaps the user left empty, using context
// clues from the fields that ARE filled.
export async function generateCharacterManifest(characterData) {
  const hasImage = !!characterData.generated_image_url;

  // Build a compact summary of the character — only non-empty fields — to keep
  // the token count small and focused.
  const summary = {};
  for (const [k, v] of Object.entries(characterData)) {
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    // Skip internal/storage fields that aren't meaningful to Claude
    if (['id', 'user_id', 'draft_id', 'fal_job_id', 'creation_status',
         'draft_saved_at', 'last_modified_at', 'created_at', 'updated_at',
         'image_history', 'generated_image_url', 'image_prompt'].includes(k)) continue;
    summary[k] = v;
  }

  const imagePromptSection = hasImage ? '' : `
3. "image_prompt": A single vivid paragraph for an AI image generator (fal.ai/FLUX). Include: full-body or portrait framing, pose, expression, hair colour/style, eye colour, clothing, accessories, background/setting, mood, lighting, and art-style tags (e.g. "anime illustration", "manga style"). Under 300 words. Output the raw prompt string only — no JSON nesting inside this field.`;

  const systemPrompt = `You are a character profile writer. Your task is to produce a high-fidelity character manifest from the provided data.

## TOKEN LIMIT ENFORCEMENT

Your output is subject to a HARD CEILING of 2,000 tokens. This is a critical constraint.

TOKEN THRESHOLD GUIDELINES:
- BELOW 1,500 tokens: Business as usual — write rich, detailed content
- 1,501 - 1,650 tokens: Buffer zone — only for finishing complete thoughts, sentences, or including critically important details that would otherwise be missing
- 1,651 - 1,850 tokens: HIGH SCRUTINY — every element must be justified. Only include if the detail is essential to the character's core identity, personality, or roleplay quality.
- 1,851 - 1,999 tokens: FINAL BUFFER — reserve for finishing critical refinements from the 1,651-1,850 range only
- 2,000 tokens: HARD CEILING — you MUST strategically refactor the prompt to fit at 2,000 tokens or fewer

QUALITY STANDARD: Every token should push toward a more powerful and premium character AI roleplaying experience. Fluff, prose without functional value, or redundant details should be eliminated.

The manifest is a ready-to-use AI roleplay system prompt. It must cover:
1. Core identity (name, role, archetype)
2. Personality breakdown (surface traits, hidden traits, dere type if applicable)
3. Psychological profile (desires, fears, internal conflict)
4. Speech and voice patterns
5. Backstory summary
6. Relationships
7. Behavioural guidelines with concrete examples

Fill in any missing or empty fields using context clues and creativity. Infer plausible, internally consistent details from the fields that are provided. Do not leave blanks.

Write in third person, past tense for backstory, present tense for behavioural instructions.

Respond in JSON with these fields:
1. "manifest": The prose character manifest${imagePromptSection}`;

  const userMessage = `Create a character manifest from this data. Fill gaps with creative, consistent choices:

${JSON.stringify(summary, null, 2)}`;

  const data = await callEdgeFunction('anthropic-proxy', {
    _generation_type: 'character_manifest',
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const responseText = data.content?.[0]?.text || '';

  try {
    const parsed = JSON.parse(responseText);
    return {
      manifest: parsed.manifest || responseText,
      imagePrompt: parsed.image_prompt || null,
    };
  } catch (parseErr) {
    console.warn('[generateCharacterManifest] JSON parse failed — imagePrompt will be null:', parseErr.message);
    return {
      manifest: responseText,
      imagePrompt: null,
    };
  }
}

// ─── Character Image Generation: fal.ai nanoBanana2 (text-to-image) ──────────────
export async function generateCharacterImage({ prompt, seed = null }, signal = null) {
  const result = await callEdgeFunction('fal-generate-character', { prompt, seed }, signal);

  const images = result?.images;
  if (!images?.[0]) throw new Error('fal.ai returned no image');
  return {
    url: images[0].url,
    seed: images[0].seed || seed,
    jobId: result?.request_id,
  };
}

// ─── Identity Prompt Generation: Claude ───────────────────────────────────────
// Generates the AI roleplay system prompt from identity fields ONLY.
// Fires at Identity step completion (Step 1 "Continue") — before any image exists.
// Excludes all appearance fields, world_context, and internal_monologue_style.
//
// @param {object} identityData  Full formData object; appearance fields are stripped internally
// @returns {Promise<string>}    Prose character roleplay prompt (system-prompt-ready)
export async function generateCharacterIdentityPrompt(identityData) {
  // Whitelist: only identity-relevant keys are sent to Claude
  const IDENTITY_KEYS = new Set([
    'character_name', 'character_role', 'archetype', 'narrative_function',
    'age', 'sex', 'gender_expression', 'species_or_race', 'nationality_or_origin',
    'social_class', 'occupation_or_role', 'dere_presets', 'custom_personality_modifier',
    'personality_mode', 'surface_traits', 'hidden_traits',
    'emotional_triggers_positive', 'emotional_triggers_negative',
    'speech_pattern', 'behavioral_tendencies', 'moral_alignment',
    'values_and_beliefs', 'fears_and_insecurities',
    'surface_goal', 'deep_desire', 'internal_conflict',
    'backstory_summary', 'knowledge_domain', 'formative_event',
    'relationships',
    'tone_of_voice', 'verbal_quirks', 'consistency_anchors', 'contradiction_points',
  ]);

  const summary = {};
  for (const key of IDENTITY_KEYS) {
    const v = identityData[key];
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;
    summary[key] = v;
  }

  const systemPrompt = `You are a character profile writer specializing in AI roleplay system prompts. Your task is to generate a high-fidelity character roleplay prompt — a ready-to-use system prompt for an AI language model — from the provided character identity data.

## TOKEN LIMIT ENFORCEMENT

Your output is subject to a HARD CEILING of 2,000 tokens. This is a critical constraint.

TOKEN THRESHOLD GUIDELINES:
- BELOW 1,500 tokens: Business as usual — write rich, detailed content
- 1,501 - 1,650 tokens: Buffer zone — only for finishing complete thoughts, sentences, or including critically important details that would otherwise be missing
- 1,651 - 1,850 tokens: HIGH SCRUTINY — every element must be justified. Only include if the detail is essential to the character's core identity, personality, or roleplay quality.
- 1,851 - 1,999 tokens: FINAL BUFFER — reserve for finishing critical refinements from the 1,651-1,850 range only
- 2,000 tokens: HARD CEILING — you MUST strategically refactor the prompt to fit at 2,000 tokens or fewer

QUALITY STANDARD: Every token should push toward a more powerful and premium character AI roleplaying experience. Fluff, prose without functional value, or redundant details should be eliminated.

The prompt must cover all of the following in rich, immersive prose:
1. Core identity (name, role, archetype, narrative function)
2. Personality breakdown (surface traits, hidden traits, dere type behaviors if applicable — describe specific surface mannerisms AND the hidden emotional truth beneath them)
3. Psychological profile (desires, fears, internal conflict, moral alignment, values)
4. Speech and voice patterns (tone, verbal quirks, sentence structure, specific language habits)
5. Backstory and context (backstory summary, formative event, knowledge domains)
6. Social relationships (how they relate to others based on the relationships array)
7. Behavioral guidelines with concrete response examples

Rules:
- Write in third person for background facts; present tense for behavioral instructions
- Do NOT leave any provided field unused — every data point must appear somewhere
- Where fields are empty, infer plausible, internally consistent details from context
- Do NOT use headers, bullet lists, or markdown — output continuous, immersive prose only
- Output ONLY the roleplay system prompt text. No preamble, no explanation.`;

  const userMessage = `Generate a character roleplay system prompt from this identity data:

${JSON.stringify(summary, null, 2)}`;

  const data = await callEdgeFunction('anthropic-proxy', {
    _generation_type: 'character_identity_prompt',
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    temperature: 1.0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return data.content?.[0]?.text || '';
}

// ─── compressBase64Image ──────────────────────────────────────────────────────
// Client-side compression to stay under Anthropic's 5 MB base64 limit.
//
// Approach: Canvas API resize + JPEG encode. Original image is never modified —
//
// the compressed copy is used only for the API call.
//
// Compression threshold: 3.5 MB base64 string (~5 MB decoded). Below threshold,
// returns original unchanged. Above threshold: resize to 1200px longest edge,
// output as JPEG at 0.85 quality.
//
// Alternative (not implemented): upload to fal CDN first, pass URL to Anthropic.
// Anthropic fetches server-side, bypassing base64 entirely. Trade-off: adds
// upload latency (~1-2s) but eliminates compression artifacts. Consider revisiting
// if compression quality issues arise or Anthropic raises base64 limits.
//
// @param {string} dataUrl  base64 data URL (data:image/...;base64,...)
// @returns {Promise<string>} compressed base64 data URL
// ─────────────────────────────────────────────────────────────────────────────
async function compressBase64Image(dataUrl) {
  const byteLength = (dataUrl.length - 'data:image/xxx;base64,'.length) * 0.75;
  if (byteLength < 3_500_000) return dataUrl;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 1200;
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      } else if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const isPng = dataUrl.startsWith('data:image/png');
      const isWebp = dataUrl.startsWith('data:image/webp');
      const mediaType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
      resolve(canvas.toDataURL(mediaType, mediaType === 'image/png' ? undefined : 0.85));
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}

// ─── analyzeReferenceImage ────────────────────────────────────────────────────
// Runs Claude vision analysis on a reference image.
//
// Returns BOTH:
//   consistencyPrompt  — flat text description (legacy, backward-compatible)
//   identityLock       — structured JSON { immutable_traits, forbidden_changes, notes }
//
// The structured identityLock is used by the prompt compiler for rigid,
// section-by-section prompt assembly. The flat text is kept for display
// and as a fallback for characters analyzed before this version.
//
// Accepts:
//   imageInput — base64 data URL (data:image/...;base64,...) for uploads
//              — OR a plain CDN/HTTP URL (fetched server-side via URL source)
//
// @param {string} imageInput  base64 data URL or HTTP(S) URL
// @returns {Promise<{ consistencyPrompt: string, identityLock: object|null }>}
export async function analyzeReferenceImage(imageInput) {
  let imageDataUrl = imageInput;

  if (imageInput.startsWith('data:')) {
    imageDataUrl = await compressBase64Image(imageInput);
  }

  const content = [];

  if (imageDataUrl.startsWith('data:')) {
    const [meta, imageData] = imageDataUrl.split(',');
    const metaMatch = meta.match(/:(.*?);/);
    const mediaType = metaMatch?.[1] ?? 'image/jpeg';
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: imageData } });
  } else {
    content.push({ type: 'image', source: { type: 'url', url: imageDataUrl } });
  }

  // ── Structured identity lock analysis prompt ──────────────────────────────
  // Requests BOTH a flat consistency prompt AND structured JSON in one call.
  content.push({
    type: 'text',
    text: `Analyze this character image in thorough detail. You must produce TWO outputs in your response, clearly labeled:

--- CONSISTENCY_PROMPT ---
Write a detailed, specific character consistency description for use as an image generation reference prompt. Include:
- Physical appearance: body type, height/build, skin tone, distinctive features
- Hair: exact color(s), style, length, texture
- Eyes: exact color, shape
- Clothing: exact colors, patterns, style, layers, any insignia or details
- Accessories: jewelry, bags, weapons, tools, hats, glasses, etc.
- Art style: anime/manga style, line weight, shading technique, color palette
- Any unique design elements, motifs, or identifiers
Be extremely specific and detailed. Write in direct descriptive style for an image generation prompt.

--- IDENTITY_LOCK_JSON ---
Return ONLY valid JSON (no extra text, no markdown fences) with this exact schema:
{
  "immutable_traits": {
    "face": ["list each immutable facial feature as a separate string — face shape, age impression, skin tone, distinguishing marks, nose shape, jaw, etc."],
    "hair": ["list each hair trait separately — color, style, length, texture, any distinctive elements"],
    "eyes": ["list each eye trait separately — color, shape, expression quality, any distinctive features"],
    "outfit": ["list each outfit element separately — every garment, color, pattern, layer; list each accessory separately"]
  },
  "art_style": "the art style of the reference image (e.g. 'anime', 'manga', 'manhwa', 'western comic', 'etc.) - leave as null if unclear",
  "forbidden_changes": [
    "list each forbidden change as a specific actionable constraint",
    "e.g. 'wardrobe swap or outfit change of any kind'",
    "e.g. 'adding accessories not present in reference'",
    "e.g. 'altering hair color or style'"
  ],
  "notes": [
    "list any important constraints about how this character must be drawn",
    "e.g. pose plausibility with clothing",
    "e.g. any art style consistency requirements"
  ]
}`,
  })

  const systemPrompt = `You are a character visual identity analyst specializing in AI image generation consistency.
Your task is to extract immutable character traits with maximum specificity.
Every trait you list becomes an absolute constraint for future image generation.
Be exhaustive — omitting a trait means it can change between generations.
Produce both outputs exactly as requested: the CONSISTENCY_PROMPT section first, then IDENTITY_LOCK_JSON second.`

  const data = await callEdgeFunction('anthropic-proxy', {
    _generation_type: 'image',
    model: 'claude-sonnet-4-5',
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content }],
  })

  const rawText = data.content?.[0]?.text || ''

  // ── Parse the two-section response ────────────────────────────────────────
  let consistencyPrompt = rawText
  let identityLock = null

  try {
    // Extract CONSISTENCY_PROMPT section
    const cpMatch = rawText.match(/---\s*CONSISTENCY_PROMPT\s*---\s*([\s\S]*?)(?=---\s*IDENTITY_LOCK_JSON\s*---|$)/i)
    if (cpMatch) {
      consistencyPrompt = cpMatch[1].trim()
    }

    // Extract IDENTITY_LOCK_JSON section
    const ilMatch = rawText.match(/---\s*IDENTITY_LOCK_JSON\s*---\s*([\s\S]*?)$/i)
    if (ilMatch) {
      const jsonText = ilMatch[1].trim()
      // Strip any accidental markdown fences
      const cleaned = jsonText.replace(/^```(?:json)?\n?|\n?```$/g, '').trim()
      identityLock = JSON.parse(cleaned)
    }
  } catch (parseErr) {
    // If parsing fails, identityLock stays null. The flat consistencyPrompt
    // is used as a fallback by the prompt compiler. This is non-fatal.
    console.warn('[analyzeReferenceImage] Could not parse identity lock JSON:', parseErr)
    identityLock = null
  }

  return { consistencyPrompt, identityLock }
}

// ─── parseAppearanceFromIdentityLock ─────────────────────────────────────────
// Extracts structured appearance fields from an identity lock JSON.
// Used in Mode A (New Character) to auto-populate the character appearance form.
//
// Only populates appearance-related fields. Identity/personality fields
// (name, role, backstory, etc.) are left for the user to fill manually.
//
// @param {object} identityLock  Structured identity lock from analyzeReferenceImage
// @returns {object}             Partial appearance object matching the character schema
export function parseAppearanceFromIdentityLock(identityLock) {
  if (!identityLock?.immutable_traits) return {}

  const traits = identityLock.immutable_traits
  const appearance = {}

  // ── Hair ──────────────────────────────────────────────────────────────────
  if (traits.hair?.length) {
    const hairText = traits.hair.join(' ').toLowerCase()

    // Extract colors (common color words)
    const colorWords = [
      'black', 'white', 'brown', 'blonde', 'blond', 'red', 'auburn', 'chestnut',
      'silver', 'grey', 'gray', 'blue', 'green', 'purple', 'pink', 'orange',
      'golden', 'platinum', 'dark', 'light', 'ash',
    ]
    const foundColors = colorWords.filter(c => hairText.includes(c))
    if (foundColors.length > 0) {
      appearance.hair_color = foundColors.map(c => c.charAt(0).toUpperCase() + c.slice(1))
    }

    // Hair style from descriptors
    const styleWords = [
      'short', 'long', 'medium', 'shoulder-length', 'wavy', 'curly', 'straight',
      'braided', 'ponytail', 'bun', 'twin tails', 'twintails', 'bob', 'pixie',
      'layered', 'flowing', 'spiky', 'messy', 'neat', 'tied', 'loose',
    ]
    const foundStyles = styleWords.filter(s => hairText.includes(s))
    if (foundStyles.length > 0) {
      appearance.hair_style = foundStyles.slice(0, 3).join(', ')
    }
  }

  // ── Eyes ──────────────────────────────────────────────────────────────────
  if (traits.eyes?.length) {
    const eyeText = traits.eyes.join(' ').toLowerCase()

    const eyeColors = [
      'blue', 'green', 'brown', 'hazel', 'gray', 'grey', 'amber', 'gold', 'golden',
      'purple', 'violet', 'red', 'pink', 'black', 'silver', 'teal', 'heterochromia',
    ]
    const foundEyeColors = eyeColors.filter(c => eyeText.includes(c))
    if (foundEyeColors.length > 0) {
      appearance.eye_color = foundEyeColors.map(c => c.charAt(0).toUpperCase() + c.slice(1))
    }
  }

  // ── Face / Skin ───────────────────────────────────────────────────────────
  if (traits.face?.length) {
    const faceText = traits.face.join(' ').toLowerCase()

    const skinWords = [
      'fair', 'pale', 'light', 'medium', 'olive', 'tan', 'dark', 'brown', 'ebony',
      'ivory', 'porcelain', 'caramel', 'golden', 'warm', 'cool', 'neutral',
    ]
    const foundSkin = skinWords.filter(s => faceText.includes(s))
    if (foundSkin.length > 0) {
      appearance.skin_tone = foundSkin[0].charAt(0).toUpperCase() + foundSkin[0].slice(1)
    }

    // Facial features from face traits (non-color, non-skin entries)
    const faceFeatures = traits.face
      .filter(f => {
        const lower = f.toLowerCase()
        return !skinWords.some(s => lower === s || lower.startsWith(s + ' '))
      })
      .slice(0, 5)
    if (faceFeatures.length > 0) {
      appearance.facial_features = faceFeatures
    }
  }

  // ── Outfit / Accessories ──────────────────────────────────────────────────
  if (traits.outfit?.length) {
    // Separate accessories from main outfit items
    const accessoryKeywords = [
      'earring', 'necklace', 'bracelet', 'ring', 'watch', 'glasses', 'hat', 'cap',
      'scarf', 'glove', 'belt', 'bag', 'backpack', 'ribbon', 'bow', 'pin', 'badge',
      'choker', 'anklet', 'headband', 'hairpin', 'clip',
    ]
    const accessories = traits.outfit.filter(item =>
      accessoryKeywords.some(k => item.toLowerCase().includes(k))
    )
    const outfitItems = traits.outfit.filter(item =>
      !accessoryKeywords.some(k => item.toLowerCase().includes(k))
    )

    if (accessories.length > 0) {
      appearance.accessories = accessories
    }

    // Store outfit description as visual_motifs since there's no direct outfit field
    if (outfitItems.length > 0) {
      appearance.visual_motifs = outfitItems.slice(0, 5)
    }
  }

  // ── Art style notes ───────────────────────────────────────────────────────
  // Prefer explicit art_style field from identity lock, fallback to notes parsing
  if (identityLock?.art_style) {
    appearance.art_style = identityLock.art_style
  } else if (identityLock.notes?.length) {
    const artStyleNote = identityLock.notes.find(n =>
      ['anime', 'manga', 'style', 'art', 'illustration', 'render'].some(k =>
        n.toLowerCase().includes(k)
      )
    )
    if (artStyleNote) {
      appearance.art_style = artStyleNote
    }
  }

  return appearance
}

// ─── Appearance Description Generation: Claude ────────────────────────────────
// Generates a prose appearance description suitable as an image generation prompt.
// Fires when the user clicks "Generate Appearance Description" in Step 2.
// Uses appearance form values ONLY — no identity fields.
//
// @param {object} appearanceData  The formData.appearance object
// @returns {Promise<string>}      Prose appearance description for fal.ai image generation
export async function generateAppearanceDescription(appearanceData) {
  /* ORIGINAL PROMPT - COMMENTED OUT FOR EXPERIMENTATION
  const systemPrompt = `You are a character visual design specialist. Your task is to write a vivid, detailed prose description of a character's physical appearance for use as an AI image generation prompt (fal.ai / FLUX model).

From the provided appearance data, write a single cohesive paragraph that includes:
1. Body type, height, and build
2. Hair color, style, and texture
3. Eye color and shape
4. Facial features and skin tone
5. Clothing style and signature outfit details
6. Accessories and props
7. Visual motifs and distinctive elements
8. Art style reference if specified (e.g. "anime illustration", "manga style", "painterly")

Rules:
- Write in vivid, descriptive prose — specific and evocative
- Include art-style tags naturally (e.g. "rendered in a manga illustration style")
- Do NOT include NSFW or inappropriate content
- Keep under 200 words — image prompts must be concise
- Output ONLY the description text. No headers, no JSON, no explanation.`;
  */

  const systemPrompt = `You are a character visual design specialist. Your task is to write a vivid, detailed prose description of a character's physical appearance for use as an AI image generation prompt (fal.ai / Nano Banana 2 model).

From the provided appearance data, write a single cohesive paragraph that includes:
1. Body type, height, and build
2. Hair color, style, and texture
3. Eye color and shape
4. Facial features and skin tone
5. Clothing style and signature outfit details
6. Accessories and props
7. Visual motifs and distinctive elements

CRITICAL MANDATORY CONSTRAINTS - You MUST include these exact elements in every description:
- POSE: Character standing straight in a neutral standing pose, arms relaxed at sides or slightly relaxed, facing directly forward toward the camera
- EXPRESSION: Calm, neutral facial expression with mouth closed or a slight neutral smile — no extreme emotions
- CAMERA VIEW: Full frontal view, character visible from head to toe (full body shot)
- ART STYLE: Anime / visual novel character sprite style, clean illustration look
- ASPECT RATIO: 9:16 vertical portrait orientation

Rules:
- Write in vivid, descriptive prose — specific and evocative
- Include the mandatory pose and expression constraints naturally in the description
- Do NOT include NSFW or inappropriate content
- Keep under 200 words — image prompts must be concise
- Output ONLY the description text. No headers, no JSON, no explanation.`;

  const userMessage = `Create an appearance description for image generation from these appearance details:

${JSON.stringify(appearanceData, null, 2)}`;

  const data = await callEdgeFunction('anthropic-proxy', {
    _generation_type: 'character_appearance_description',
    model: 'claude-sonnet-4-5',
    max_tokens: 1000,
    temperature: 0.8,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return data.content?.[0]?.text || '';
}
