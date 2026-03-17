// ─── seedSettings.js ──────────────────────────────────────────────────────────
// DEPRECATED — this file is no longer imported or used.
//
// Previously: seeded VITE_ANTHROPIC_KEY and VITE_FAL_KEY from .env into
// localStorage under `cf_settings` on every app load.
//
// Current architecture: all AI API keys (Anthropic, fal.ai) are stored
// exclusively as Supabase Edge Function secrets and are never exposed to the
// browser bundle or localStorage. This file can be safely deleted.
// ─────────────────────────────────────────────────────────────────────────────
