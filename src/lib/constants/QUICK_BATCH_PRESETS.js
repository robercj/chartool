// ─── QUICK_BATCH_PRESETS.js ─────────────────────────────────────────────────
// Pre-defined emotion configurations for Quick Batch Sprites feature.
//
// Basic: 10 images (one per emotion at average intensity)
// Comprehensive: 30 images (three intensities per emotion)
//
// Each entry maps to the emotionEntry structure used by the generation pipeline.
// ─────────────────────────────────────────────────────────────────────────────

const FRAMING = 'Full body shot, centered with headroom above and space below'

export const QUICK_BATCH_BASIC = [
  { emotion: 'Happy', intensity: 'average', promptDirection: `${FRAMING}. Content, warm smile, relaxed positive expression` },
  { emotion: 'Aversion', intensity: 'average', promptDirection: `${FRAMING}. Moderate disgust, turned away, wrinkled nose` },
  { emotion: 'Concern', intensity: 'average', promptDirection: `${FRAMING}. Worried, furrowed brow, tense posture` },
  { emotion: 'Anger', intensity: 'average', promptDirection: `${FRAMING}. Clearly annoyed or angry, firm expression` },
  { emotion: 'Sad', intensity: 'average', promptDirection: `${FRAMING}. Downcast, quiet sorrow, slumped slightly` },
  { emotion: 'Surprise', intensity: 'average', promptDirection: `${FRAMING}. Eyes wide, mouth slightly open, caught off guard` },
  { emotion: 'Thinking', intensity: 'average', promptDirection: `${FRAMING}. Thoughtful, looking to the side, contemplative` },
  { emotion: 'Smug', intensity: 'average', promptDirection: `${FRAMING}. Self-satisfied, knowing half-smile` },
  { emotion: 'Tease', intensity: 'average', promptDirection: `${FRAMING}. Playful provocation, mischievous grin` },
  { emotion: 'Touched', intensity: 'average', promptDirection: `${FRAMING}. Visibly moved and grateful — "Oh wow! Thank you so much!"` },
]

export const QUICK_BATCH_COMPREHENSIVE = [
  // Happy (1-3)
  { emotion: 'Happy', intensity: 'subtle', promptDirection: `${FRAMING}. Faint, genuine smile; soft warmth in eyes` },
  { emotion: 'Happy', intensity: 'average', promptDirection: `${FRAMING}. Clear, comfortable happiness; open expression` },
  { emotion: 'Happy', intensity: 'high', promptDirection: `${FRAMING}. Broad beaming smile, bright eyes, visibly overjoyed` },
  // Aversion (4-6)
  { emotion: 'Aversion', intensity: 'subtle', promptDirection: `${FRAMING}. Slight nose wrinkle, mild discomfort` },
  { emotion: 'Aversion', intensity: 'average', promptDirection: `${FRAMING}. Visible disgust, leaning back, face turned` },
  { emotion: 'Aversion', intensity: 'high', promptDirection: `${FRAMING}. Full disgust reaction — grimacing, recoiling` },
  // Concern (7-9)
  { emotion: 'Concern', intensity: 'subtle', promptDirection: `${FRAMING}. Faint worry, a slight furrow of the brow` },
  { emotion: 'Concern', intensity: 'average', promptDirection: `${FRAMING}. Clearly worried, tense, visibly anxious` },
  { emotion: 'Concern', intensity: 'high', promptDirection: `${FRAMING}. Terrified — wide eyes, frozen, panic on face` },
  // Anger (10-12)
  { emotion: 'Anger', intensity: 'subtle', promptDirection: `${FRAMING}. Quietly irritated, controlled expression` },
  { emotion: 'Anger', intensity: 'average', promptDirection: `${FRAMING}. Noticeably angry, firm jaw, intense look` },
  { emotion: 'Anger', intensity: 'high', promptDirection: `${FRAMING}. Outraged — barely contained fury, flushed, shaking` },
  // Sad (13-15)
  { emotion: 'Sad', intensity: 'subtle', promptDirection: `${FRAMING}. Quiet melancholy, slightly downcast eyes` },
  { emotion: 'Sad', intensity: 'average', promptDirection: `${FRAMING}. Visibly sad, still expression, gentle sorrow` },
  { emotion: 'Sad', intensity: 'high', promptDirection: `${FRAMING}. Depressed and listless — hollow eyes, collapsed posture` },
  // Surprise (16-18)
  { emotion: 'Surprise', intensity: 'subtle', promptDirection: `${FRAMING}. Slight wonder, eyebrows raised gently` },
  { emotion: 'Surprise', intensity: 'average', promptDirection: `${FRAMING}. Caught off guard — eyes wide, mouth open` },
  { emotion: 'Surprise', intensity: 'high', promptDirection: `${FRAMING}. Completely floored — shocked, flabbergasted, speechless` },
  // Thinking (19-21)
  { emotion: 'Thinking', intensity: 'subtle', promptDirection: `${FRAMING}. Distant gaze, quiet consideration` },
  { emotion: 'Thinking', intensity: 'average', promptDirection: `${FRAMING}. Clearly thinking — focused, a hand near the face` },
  { emotion: 'Thinking', intensity: 'high', promptDirection: `${FRAMING}. Breakthrough moment — eyes lit up, sudden realization (Eureka!)` },
  // Smug (22-24)
  { emotion: 'Smug', intensity: 'subtle', promptDirection: `${FRAMING}. Barely-there knowing smirk` },
  { emotion: 'Smug', intensity: 'average', promptDirection: `${FRAMING}. Self-satisfied half-smile, confident lean` },
  { emotion: 'Smug', intensity: 'high', promptDirection: `${FRAMING}. Obnoxiously cocky — exaggerated confidence, over-the-top self-assurance` },
  // Tease (25-27)
  { emotion: 'Tease', intensity: 'subtle', promptDirection: `${FRAMING}. Gentle playful suggestion in the eyes` },
  { emotion: 'Tease', intensity: 'average', promptDirection: `${FRAMING}. Mischievous grin, deliberate provocation` },
  { emotion: 'Tease', intensity: 'high', promptDirection: `${FRAMING}. Overt playful body language — exaggerated, flirtatious, bold` },
  // Touched (28-30)
  { emotion: 'Touched', intensity: 'subtle', promptDirection: `${FRAMING}. Quietly moved — "Aw, that\'s sweet"` },
  { emotion: 'Touched', intensity: 'average', promptDirection: `${FRAMING}. Visibly grateful and touched — "Oh wow! Thank you so much!"` },
  { emotion: 'Touched', intensity: 'high', promptDirection: `${FRAMING}. Overwhelmed with gratitude — "I don\'t know how I can ever repay you!!!"` },
]

export const QUICK_BATCH_BASIC_COUNT = 10
export const QUICK_BATCH_COMPREHENSIVE_COUNT = 30

export const QUICK_BATCH_ASPECT_RATIO = '3:4'

export const QUICK_BATCH_TOGGLES = {
  allowPrompt: false,
  allowClothing: false,
  allowProps: false,
}
