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
    const mediaType = meta.match(/:(.*?);/)[1];
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

// ─── Character Prompt Synthesis: Claude ───────────────────────────────────────
// Synthesizes a fal.ai image prompt from the full character JSON
export async function synthesizeCharacterImagePrompt(characterData) {
  const systemPrompt = `You are a character visual design specialist. Your task is to create a detailed, vivid image generation prompt for an AI image generator (fal.ai nanoBanana2/FLUX model).

Based on the character description provided, create a single paragraph prompt that includes:
1. Subject description (full body or portrait as appropriate)
2. Pose or composition
3. Background/setting
4. Mood and lighting
5. Art style reference if specified

Requirements:
- The prompt should be in English, descriptive and detailed
- Include specific visual details: hair color/style, eye color, clothing, accessories, body type
- Specify pose and expression
- Include appropriate art style tags (anime, manga, etc.)
  - Do NOT include NSFW or inappropriate content
- Focus on creating a visually appealing character portrait
- Keep the prompt under 500 words

Output ONLY the prompt text, no explanations or additional content.`;

  const userMessage = `Create an image generation prompt for this character:

${JSON.stringify(characterData, null, 2)}`;

  const data = await callEdgeFunction('anthropic-proxy', {
    _generation_type: 'character_image_prompt',
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    temperature: 0.8,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return data.content?.[0]?.text || '';
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
    max_tokens: hasImage ? 2500 : 3200,
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
  } catch {
    // Claude returned plain text instead of JSON — treat the whole thing as the manifest
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
