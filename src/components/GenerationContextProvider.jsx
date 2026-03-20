import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import useGenerationQueueStore from '../lib/stores/generationQueueStore';

export function GenerationContextProvider({ children }) {
  const updateJob = useGenerationQueueStore(s => s.updateJob);
  const channelRef = useRef(null);

  useEffect(() => {
    let channel;

    async function setupRealtime() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel('generation_jobs_realtime')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'generation_jobs',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
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
          }
        )
        .subscribe();

      channelRef.current = channel;
    }

    setupRealtime();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [updateJob]);

  return children;
}
