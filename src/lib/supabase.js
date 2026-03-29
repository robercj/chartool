// ─── supabase.js ─────────────────────────────────────────────────────────────
// Singleton Supabase client. Import this everywhere DB access is needed.
//
// VITE_SUPABASE_ANON_KEY accepts both:
//   • New publishable-key format: sb_publishable_...
//   • Legacy JWT anon key:        eyJ...
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    clockTolerance: 60,
  },
  global: {
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30 * 60 * 1000);

      // Respect any signal the caller already provides (e.g. gotrue-js lock cancellation).
      // Without this, aborting the caller's signal has no effect and the lock-steal
      // recovery path throws unhandled AbortErrors.
      const callerSignal = options.signal;
      if (callerSignal) {
        if (callerSignal.aborted) {
          clearTimeout(timeout);
          controller.abort();
        } else {
          callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
      }

      return fetch(url, { ...options, signal: controller.signal }).finally(() =>
        clearTimeout(timeout)
      );
    },
  },
});
