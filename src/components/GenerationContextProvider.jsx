import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { queryClient } from '../main';
import useGenerationQueueStore from '../lib/stores/generationQueueStore';

export function GenerationContextProvider({ children }) {
  const updateJob = useGenerationQueueStore(s => s.updateJob);
  const initialize = useGenerationQueueStore(s => s.initialize);
  const channelRef = useRef(null);
  const imagesChannelRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let channel, imagesChannel;

    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;

      channel = supabase
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

      imagesChannel = supabase
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
    }

    initialize();
    setupRealtime();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (imagesChannelRef.current) supabase.removeChannel(imagesChannelRef.current);
    };
  }, [updateJob, initialize]);

  return children;
}
