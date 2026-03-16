// ─── anthropic.js ─────────────────────────────────────────────────────────────
// All AI calls are now routed through Supabase Edge Functions.
// API keys (Anthropic + fal.ai) live exclusively in Supabase secrets — never
// in the browser bundle.
//
// Call flow:
//   Browser → Supabase Edge Function (auth + limit check) → Anthropic / fal.ai
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

// ─── Helper: call an edge function via the Supabase client ───────────────────
async function callEdgeFunction(functionName, body) {
  const { data, error } = await supabase.functions.invoke(functionName, { body });

  if (error) {
    // supabase.functions.invoke wraps the real HTTP response in error.context
    // Try every known way to extract the actual error message from the body
    let message = null;
    let status = null;

    try {
      // FunctionsHttpError: the raw Response is at error.context
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
        // Some versions expose it differently
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

// ─── Image Generation: fal.ai ─────────────────────────────────────────────────
// Uses sync_mode on fal.run (not queue.fal.run) — result comes back in one
// HTTP response, no polling, no CORS issues, no timeout risk.
export async function generateImage({ prompt, referenceImageUrl, referenceImageUrls, propImageUrl, aspectRatio = '3:4' }) {
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

  const result = await callEdgeFunction('fal-generate', { input });

  const images = result?.images;
  if (!images?.[0]) throw new Error('fal.ai returned no image');
  return images[0].url;
}

// ─── Background Removal: fal.ai (rembg) ──────────────────────────────────────
export async function removeImageBackground(imageUrl) {
  try {
    const result = await callEdgeFunction('fal-rembg', { image_url: imageUrl });
    const outputUrl = result?.image?.url;
    if (!outputUrl) throw new Error('rembg returned no image');
    return outputUrl;
  } catch (err) {
    console.error('rembg error:', err);
    throw new Error(`Background removal failed: ${err.message}`);
  }
}
