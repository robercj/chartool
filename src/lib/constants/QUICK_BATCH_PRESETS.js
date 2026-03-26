// ─── QUICK_BATCH_PRESETS.js ─────────────────────────────────────────────────
// Pre-defined emotion configurations for Quick Batch Sprites feature.
//
// Basic: 10 images (one per emotion at average intensity)
// Comprehensive: 30 images (three intensities per emotion)
//
// Each entry maps to the emotionEntry structure used by the generation pipeline.
// ─────────────────────────────────────────────────────────────────────────────

export const QUICK_BATCH_BASIC = [
  { emotion: 'Happy', intensity: 'average', promptDirection: 'Content, warm smile, relaxed positive expression' },
  { emotion: 'Aversion', intensity: 'average', promptDirection: 'Moderate disgust, turned away, wrinkled nose' },
  { emotion: 'Concern', intensity: 'average', promptDirection: 'Worried, furrowed brow, tense posture' },
  { emotion: 'Anger', intensity: 'average', promptDirection: 'Clearly annoyed or angry, firm expression' },
  { emotion: 'Sad', intensity: 'average', promptDirection: 'Downcast, quiet sorrow, slumped slightly' },
  { emotion: 'Surprise', intensity: 'average', promptDirection: 'Eyes wide, mouth slightly open, caught off guard' },
  { emotion: 'Thinking', intensity: 'average', promptDirection: 'Thoughtful, looking to the side, contemplative' },
  { emotion: 'Smug', intensity: 'average', promptDirection: 'Self-satisfied, knowing half-smile' },
  { emotion: 'Tease', intensity: 'average', promptDirection: 'Playful provocation, mischievous grin' },
  { emotion: 'Touched', intensity: 'average', promptDirection: 'Visibly moved and grateful — "Oh wow! Thank you so much!"' },
]

export const QUICK_BATCH_COMPREHENSIVE = [
  // Happy (1-3)
  { emotion: 'Happy', intensity: 'subtle', promptDirection: 'Faint, genuine smile; soft warmth in eyes' },
  { emotion: 'Happy', intensity: 'average', promptDirection: 'Clear, comfortable happiness; open expression' },
  { emotion: 'Happy', intensity: 'high', promptDirection: 'Broad beaming smile, bright eyes, visibly overjoyed' },
  // Aversion (4-6)
  { emotion: 'Aversion', intensity: 'subtle', promptDirection: 'Slight nose wrinkle, mild discomfort' },
  { emotion: 'Aversion', intensity: 'average', promptDirection: 'Visible disgust, leaning back, face turned' },
  { emotion: 'Aversion', intensity: 'high', promptDirection: 'Full disgust reaction — grimacing, recoiling' },
  // Concern (7-9)
  { emotion: 'Concern', intensity: 'subtle', promptDirection: 'Faint worry, a slight furrow of the brow' },
  { emotion: 'Concern', intensity: 'average', promptDirection: 'Clearly worried, tense, visibly anxious' },
  { emotion: 'Concern', intensity: 'high', promptDirection: 'Terrified — wide eyes, frozen, panic on face' },
  // Anger (10-12)
  { emotion: 'Anger', intensity: 'subtle', promptDirection: 'Quietly irritated, controlled expression' },
  { emotion: 'Anger', intensity: 'average', promptDirection: 'Noticeably angry, firm jaw, intense look' },
  { emotion: 'Anger', intensity: 'high', promptDirection: 'Outraged — barely contained fury, flushed, shaking' },
  // Sad (13-15)
  { emotion: 'Sad', intensity: 'subtle', promptDirection: 'Quiet melancholy, slightly downcast eyes' },
  { emotion: 'Sad', intensity: 'average', promptDirection: 'Visibly sad, still expression, gentle sorrow' },
  { emotion: 'Sad', intensity: 'high', promptDirection: 'Depressed and listless — hollow eyes, collapsed posture' },
  // Surprise (16-18)
  { emotion: 'Surprise', intensity: 'subtle', promptDirection: 'Slight wonder, eyebrows raised gently' },
  { emotion: 'Surprise', intensity: 'average', promptDirection: 'Caught off guard — eyes wide, mouth open' },
  { emotion: 'Surprise', intensity: 'high', promptDirection: 'Completely floored — shocked, flabbergasted, speechless' },
  // Thinking (19-21)
  { emotion: 'Thinking', intensity: 'subtle', promptDirection: 'Distant gaze, quiet consideration' },
  { emotion: 'Thinking', intensity: 'average', promptDirection: 'Clearly thinking — focused, a hand near the face' },
  { emotion: 'Thinking', intensity: 'high', promptDirection: 'Breakthrough moment — eyes lit up, sudden realization (Eureka!)' },
  // Smug (22-24)
  { emotion: 'Smug', intensity: 'subtle', promptDirection: 'Barely-there knowing smirk' },
  { emotion: 'Smug', intensity: 'average', promptDirection: 'Self-satisfied half-smile, confident lean' },
  { emotion: 'Smug', intensity: 'high', promptDirection: 'Obnoxiously cocky — exaggerated confidence, over-the-top self-assurance' },
  // Tease (25-27)
  { emotion: 'Tease', intensity: 'subtle', promptDirection: 'Gentle playful suggestion in the eyes' },
  { emotion: 'Tease', intensity: 'average', promptDirection: 'Mischievous grin, deliberate provocation' },
  { emotion: 'Tease', intensity: 'high', promptDirection: 'Overt playful body language — exaggerated, flirtatious, bold' },
  // Touched (28-30)
  { emotion: 'Touched', intensity: 'subtle', promptDirection: 'Quietly moved — "Aw, that\'s sweet"' },
  { emotion: 'Touched', intensity: 'average', promptDirection: 'Visibly grateful and touched — "Oh wow! Thank you so much!"' },
  { emotion: 'Touched', intensity: 'high', promptDirection: 'Overwhelmed with gratitude — "I don\'t know how I can ever repay you!!!"' },
]

export const QUICK_BATCH_BASIC_COUNT = 10
export const QUICK_BATCH_COMPREHENSIVE_COUNT = 30

export const QUICK_BATCH_ASPECT_RATIO = '9:16'

export const QUICK_BATCH_TOGGLES = {
  allowPrompt: false,
  allowClothing: false,
  allowProps: false,
}
