// Runs once on app load — seeds API keys from .env into localStorage.
// [API-KEYS DISABLED] User-provided keys are no longer respected.
// Keys are always sourced from VITE_ANTHROPIC_KEY / VITE_FAL_KEY in .env.
// To use the app locally, copy .env.example to .env and fill in your keys.

// [API-KEYS DISABLED] Old behaviour (only seed if not already set — letting user override) commented out:
// const existing = JSON.parse(localStorage.getItem('cf_settings') || '{}')
// if (!existing.anthropic_key || !existing.fal_key) {
//   localStorage.setItem('cf_settings', JSON.stringify({
//     anthropic_key: existing.anthropic_key || import.meta.env.VITE_ANTHROPIC_KEY || '',
//     fal_key: existing.fal_key || import.meta.env.VITE_FAL_KEY || '',
//   }))
// }

// Always overwrite with .env values so manually-entered keys cannot persist.
const existing = JSON.parse(localStorage.getItem('cf_settings') || '{}')
localStorage.setItem('cf_settings', JSON.stringify({
  ...existing,
  anthropic_key: import.meta.env.VITE_ANTHROPIC_KEY || '',
  fal_key: import.meta.env.VITE_FAL_KEY || '',
}))
