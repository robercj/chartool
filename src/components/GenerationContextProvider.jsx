// ─── GenerationContextProvider.jsx ────────────────────────────────────────────
// Sets up Supabase Realtime WebSocket channels for two tables:
//   1. generation_jobs (UPDATE) — syncs job status changes into the Zustand queue store
//   2. character_images (INSERT) — invalidates React Query cache so galleries auto-refresh
//
// This component lives high in the provider tree (inside AuthProvider) so the
// channels stay alive across page navigations. Channels are created once per
// authenticated user and torn down on sign-out or unmount.
//
// Also initializes the generationQueueStore on mount (restores active sessions
// from the DB for crash recovery).
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { queryClient } from '../main';
import useGenerationQueueStore from '../lib/stores/generationQueueStore';
import { useAuth } from '../contexts/AuthContext';

export function GenerationContextProvider({ children }) {
  // Use the already-resolved user from AuthContext instead of calling
  // supabase.auth.getUser(), which makes a live network request to /auth/v1/user
  // and competes for the same auth lock that AuthContext's getSession() holds,
  // causing the "lock not released within 5000ms" warning, AbortError cascade,
  // and the apparent CORS errors on /auth/v1/user.
  const { user } = useAuth();
  const updateJob = useGenerationQueueStore(s => s.updateJob);
  const initialize = useGenerationQueueStore(s => s.initialize);
  const channelRef = useRef(null);
  const imagesChannelRef = useRef(null);

  // Initialize the queue store once on mount (reads persisted jobs from DB via RLS,
  // which works as soon as the Supabase client has a session in storage).
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Set up Realtime channels once the user is known. Re-runs if the user changes
  // (sign-in / sign-out), automatically cleaning up and recreating channels.
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('generation_jobs_realtime')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'generation_jobs',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const { id, status, image_url, error_message, completed_at } = payload.new;
        const patch = { status };
        if (status === 'complete') {
          patch.imageUrl = image_url;
          patch.completedAt = completed_at ? new Date(completed_at).getTime() : Date.now();
        } else if (status === 'failed') {
          patch.errorMessage = error_message;
          patch.completedAt = completed_at ? new Date(completed_at).getTime() : Date.now();
        }
        updateJob(id, patch);
      })
      .subscribe();

    const imagesChannel = supabase
      .channel('character_images_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'character_images',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const { character_id, job_id } = payload.new;
        if (job_id) {
          queryClient.invalidateQueries({ 
            queryKey: ['character-images', character_id] 
          });
        }
      })
      .subscribe();

    channelRef.current = channel;
    imagesChannelRef.current = imagesChannel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (imagesChannelRef.current) {
        supabase.removeChannel(imagesChannelRef.current);
        imagesChannelRef.current = null;
      }
    };
  }, [user, updateJob]);

  return children;
}
