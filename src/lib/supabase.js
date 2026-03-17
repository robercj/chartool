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
    clockTolerance: 60, // tolerate up to 60 s of clock skew between client and server
  },
});
