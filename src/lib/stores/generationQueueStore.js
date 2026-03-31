// ─── generationQueueStore.js ────────────────────────────────────────────────────
// Zustand store for managing the image generation job queue.
//
// Queue Architecture:
//   sessions[]       — batch sessions, each containing multiple jobs
//   activeSessionId  — currently focused session
//   _notifiedChars   — tracks which characters have been notified (prevents duplicate toasts)
//
// Job Lifecycle:
//   queued → generating → complete | failed
//
// Persistence:
//   On mount: restores active jobs from the generation_jobs DB table
//   On dispatch: inserts jobs to DB for crash recovery
//   Job state is dual-synced: Zustand (in-memory) + Supabase (persistent)
//
// Concurrency:
//   MAX_CONCURRENT_JOBS (10) limits simultaneous image generations
//   AUTO_RETRY_MAX (1) retries transient failures once after 2s delay
// ─────────────────────────────────────────────────────────────────────────────
import { create } from 'zustand';
import { supabase } from '../supabase';
import { generateImage } from '../anthropic';
import { CharacterImage } from '../storage';
import { toast } from 'sonner';

const AUTO_RETRY_MAX = 1;
const AUTO_RETRY_DELAY_MS = 2000;
const MAX_CONCURRENT_JOBS = 10;

function generateId() {
  return crypto.randomUUID();
}

const useGenerationQueueStore = create((set, get) => ({
  sessions: [],
  activeSessionId: null,
  _notifiedCharacters: {},
  _initialized: false,

  _getQueuedJobs: () => {
    const state = get();
    return state.sessions.flatMap(s => s.jobs).filter(j => j.status === 'queued');
  },

  _getActiveJobCount: () => {
    const state = get();
    return state.sessions.flatMap(s => s.jobs).filter(j => j.status === 'generating').length;
  },

  initialize: async () => {
    if (get()._initialized) return;
    
    let mounted = true;
    // Use getSession() instead of getUser() — reads from local session store
    // without a network roundtrip to /auth/v1/user. Avoids lock contention
    // with AuthContext's concurrent auth calls at startup.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!mounted || !user) {
      set({ _initialized: true });
      return;
    }

    // Only fetch the columns needed to reconstruct sessions — skip large
    // generation_params JSONB on initial restore (it's only needed when
    // actually firing a job, at which point we re-read it).
    const { data: activeJobs, error } = await supabase
      .from('generation_jobs')
      .select('id, session_id, context_type, context_id, character_name, thumbnail_url, status, image_url, error_message, generation_params, created_at, completed_at')
      .eq('user_id', user.id)
      .in('status', ['queued', 'generating'])
      .order('created_at');

    if (!mounted) {
      set({ _initialized: true });
      return;
    }

    if (error) {
      console.error('Failed to restore queue from DB:', error);
      set({ _initialized: true });
      return;
    }

    if (!activeJobs?.length) {
      set({ _initialized: true });
      return;
    }

    const sessionsMap = {};
    activeJobs.forEach(job => {
      if (!sessionsMap[job.session_id]) {
        sessionsMap[job.session_id] = {
          sessionId: job.session_id,
          contextType: job.context_type,
          contextId: job.context_id,
          characterName: job.character_name || 'Character',
          thumbnailUrl: job.thumbnail_url || null,
          returnRoute: '/queue',
          formSnapshot: {},
          jobs: [],
          dispatchedAt: new Date(job.created_at).getTime(),
        };
      }
      sessionsMap[job.session_id].jobs.push({
        jobId: job.id,
        sessionId: job.session_id,
        contextType: job.context_type,
        contextId: job.context_id,
        characterName: job.character_name || 'Character',
        thumbnailUrl: job.thumbnail_url || null,
        status: job.status,
        imageUrl: job.image_url,
        errorMessage: job.error_message,
        createdAt: new Date(job.created_at).getTime(),
        completedAt: job.completed_at ? new Date(job.completed_at).getTime() : null,
        generationParams: job.generation_params || {},
        label: null,
      });
    });

    const sessions = Object.values(sessionsMap).sort((a, b) => b.dispatchedAt - a.dispatchedAt);

    if (!mounted) {
      set({ _initialized: true });
      return;
    }

    set({
      sessions,
      activeSessionId: sessions[0]?.sessionId || null,
      _initialized: true,
      _notifiedCharacters: {},
    });

    get()._processQueue(user.id);
  },

  dispatchBatch: async ({ contextType, formSnapshot, returnRoute, jobs }) => {
    const sessionId = generateId();
    // Use getSession() — local session read, no network request
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const user = authSession?.user;
    if (!user) throw new Error('Not authenticated');

    const session = {
      sessionId,
      contextType,
      contextId: jobs[0]?.contextId,
      returnRoute: returnRoute || '/queue',
      formSnapshot,
      jobs: jobs.map(j => ({
        jobId: generateId(),
        sessionId,
        contextType,
        contextId: j.contextId,
        characterName: j.characterName || 'Character',
        thumbnailUrl: j.thumbnailUrl || null,
        status: 'queued',
        imageUrl: null,
        errorMessage: null,
        createdAt: Date.now(),
        completedAt: null,
        generationParams: j.generationParams,
        label: j.label || null,
      })),
      dispatchedAt: Date.now(),
    };

    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: state.activeSessionId || sessionId,
    }));

    const dbJobs = session.jobs.map(j => ({
      id: j.jobId,
      user_id: user.id,
      session_id: sessionId,
      context_type: contextType,
      context_id: j.contextId,
      character_name: j.characterName,
      thumbnail_url: j.thumbnailUrl,
      status: 'queued',
      generation_params: j.generationParams,
    }));
    
    const { error } = await supabase.from('generation_jobs').insert(dbJobs);
    if (error) {
      console.error('Failed to insert jobs to DB:', error);
      toast.error('Failed to save job to database');
    }

    get()._processQueue(user.id);

    return sessionId;
  },

  _processQueue: async (userId) => {
    const state = get();
    const slotsAvailable = MAX_CONCURRENT_JOBS - state._getActiveJobCount();
    
    if (slotsAvailable <= 0) return;

    const queuedJobs = state._getQueuedJobs();
    const jobsToFire = queuedJobs.slice(0, slotsAvailable);
    
    for (const job of jobsToFire) {
      get()._fireJob(job, userId);
    }
  },

  _fireJob: (job, userId, retryCount = 0) => {
    set(state => ({
      sessions: state.sessions.map(s => {
        if (s.sessionId !== job.sessionId) return s;
        return {
          ...s,
          jobs: s.jobs.map(j =>
            j.jobId === job.jobId ? { ...j, status: 'generating' } : j
          ),
        };
      }),
    }));

    supabase
      .from('generation_jobs')
      .update({ status: 'generating' })
      .eq('id', job.jobId)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) console.error('[fireJob] Failed to update job to generating:', error);
      });

    const { _signal, ...restParams } = job.generationParams || {};
    const signal = _signal || null;

    generateImage(restParams, signal)
      .then(async imageUrl => {
        if (job.contextType === 'sprite') {
          // REMBG DISABLED
          // try {
          //   imageUrl = await removeImageBackground(imageUrl, signal);
          // } catch (rembgErr) {
          //   console.warn('Background removal failed for sprite:', rembgErr);
          // }
        }

        await supabase
          .from('generation_jobs')
          .update({
            status: 'complete',
            image_url: imageUrl,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.jobId)
          .eq('user_id', userId);

        set(state => ({
          sessions: state.sessions.map(s => {
            if (s.sessionId !== job.sessionId) return s;
            return {
              ...s,
              jobs: s.jobs.map(j =>
                j.jobId === job.jobId
                  ? { ...j, status: 'complete', imageUrl, completedAt: Date.now() }
                  : j
              ),
            };
          }),
        }));

        // Insert the image record. If a duplicate already exists for this job
        // (e.g. from a Realtime replay or concurrent tab), the insert will
        // fail with a unique constraint violation — catch and ignore it.
        try {
          await CharacterImage.add(job.contextId, userId, {
            url: imageUrl,
            label: job.label || 'Sprite',
            seed: job.generationParams?.seed ?? null,
            poseId: job.generationParams?.poseId ?? null,
            emotionEntry: job.generationParams?.emotionEntry ?? null,
            paramsSnapshot: job.generationParams?.paramsSnapshot ?? null,
            generationType: 'sprite',
            jobId: job.jobId,
          });
        } catch (err) {
          // 23505 = unique_violation (duplicate job_id). Safe to ignore.
          if (err?.code !== '23505') {
            console.error('Failed to add image to character gallery:', err);
          }
        }

        toast.success('Image ready!', {
          id: `img-${job.jobId}`,
          description: job.characterName,
          duration: 4000,
        });

        get()._checkCharacterCompletion(job);
        get()._processQueue(userId);
      })
      .catch(async err => {
        const message = err?.message || 'Generation failed';

        if (retryCount < AUTO_RETRY_MAX) {
          console.log(`Auto-retry ${retryCount + 1}/${AUTO_RETRY_MAX} for job ${job.jobId}`);
          await new Promise(r => setTimeout(r, AUTO_RETRY_DELAY_MS));
          get()._fireJob(job, userId, retryCount + 1);
          return;
        }

        await supabase
          .from('generation_jobs')
          .update({
            status: 'failed',
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.jobId)
          .eq('user_id', userId);

        set(state => ({
          sessions: state.sessions.map(s => {
            if (s.sessionId !== job.sessionId) return s;
            return {
              ...s,
              jobs: s.jobs.map(j =>
                j.jobId === job.jobId
                  ? { ...j, status: 'failed', errorMessage: message, completedAt: Date.now() }
                  : j
              ),
            };
          }),
        }));

        toast.error(`Generation failed for ${job.characterName}`, {
          description: message,
          duration: 6000,
        });

        get()._checkCharacterCompletion(job);
        get()._processQueue(userId);
      });
  },

  _checkCharacterCompletion: (job) => {
    const state = get();
    const session = state.sessions.find(s => s.sessionId === job.sessionId);
    if (!session) return;

    const charKey = job.contextId;
    if (charKey in state._notifiedCharacters) return;

    const charJobs = session.jobs.filter(j => j.contextId === charKey);
    const allDone = charJobs.every(j => j.status === 'complete' || j.status === 'failed');

    if (allDone) {
      set(s => ({ _notifiedCharacters: { ...s._notifiedCharacters, [charKey]: true } }));
      
      const complete = charJobs.filter(j => j.status === 'complete').length;
      const failed = charJobs.filter(j => j.status === 'failed').length;

      if (failed > 0 && complete === 0) {
        toast.error(`All images failed for ${job.characterName}`, {
          duration: 5000,
        });
      } else if (failed > 0) {
        toast.warning(`${complete} images ready, ${failed} failed for ${job.characterName}`, {
          description: 'Check the character gallery',
          duration: 5000,
        });
      } else {
        toast.success(`All ${complete} images ready for ${job.characterName}!`, {
          description: 'Check the character gallery',
          duration: 5000,
        });
      }
    }
  },

  updateJob: (jobId, patch) => {
    set(state => ({
      sessions: state.sessions.map(s => ({
        ...s,
        jobs: s.jobs.map(j =>
          j.jobId === jobId ? { ...j, ...patch } : j
        ),
      })),
    }));
  },

  clearSession: (sessionId) => {
    set(state => ({
      sessions: state.sessions.filter(s => s.sessionId !== sessionId),
      activeSessionId: state.activeSessionId === sessionId 
        ? (state.sessions.find(s => s.sessionId !== sessionId)?.sessionId || null)
        : state.activeSessionId,
    }));
  },

  clearAllSessions: () => {
    set({ sessions: [], activeSessionId: null, _notifiedCharacters: {} });
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
  },

  retryJob: async (sessionId, jobId) => {
    const queueSession = get().sessions.find(s => s.sessionId === sessionId);
    if (!queueSession) return;

    const job = queueSession.jobs.find(j => j.jobId === jobId);
    if (!job) return;

    // Use getSession() — local session read, no network request
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const user = authSession?.user;
    if (!user) return;

    const newJobId = generateId();

    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId
          ? {
              ...s,
              jobs: s.jobs.map(j =>
                j.jobId === jobId
                  ? { ...j, jobId: newJobId, status: 'queued', imageUrl: null, errorMessage: null, completedAt: null }
                  : j
              ),
            }
          : s
      ),
    }));

    await supabase.from('generation_jobs').insert({
      id: newJobId,
      user_id: user.id,
      session_id: sessionId,
      context_type: job.contextType,
      context_id: job.contextId,
      character_name: job.characterName,
      thumbnail_url: job.thumbnailUrl,
      status: 'queued',
      generation_params: job.generationParams,
    });

    get()._fireJob({ ...job, jobId: newJobId }, user.id);
  },

  retryAllFailedInSession: async (sessionId) => {
    const session = get().sessions.find(s => s.sessionId === sessionId);
    if (!session) return;

    const failedJobs = session.jobs.filter(j => j.status === 'failed');
    for (const job of failedJobs) {
      await get().retryJob(sessionId, job.jobId);
    }
  },
}));

export const totalPending = (state) =>
  state.sessions.flatMap(s => s.jobs).filter(j => j.status === 'queued' || j.status === 'generating').length;

export const totalComplete = (state) =>
  state.sessions.flatMap(s => s.jobs).filter(j => j.status === 'complete').length;

export const totalFailed = (state) =>
  state.sessions.flatMap(s => s.jobs).filter(j => j.status === 'failed').length;

export const totalJobs = (state) =>
  state.sessions.flatMap(s => s.jobs).length;

export const sessionProgress = (state, sessionId) => {
  const session = state.sessions.find(s => s.sessionId === sessionId);
  if (!session) return { complete: 0, total: 0, percent: 0 };
  const complete = session.jobs.filter(j => j.status === 'complete' || j.status === 'failed').length;
  const total = session.jobs.length;
  return { complete, total, percent: total > 0 ? Math.round((complete / total) * 100) : 0 };
};

export const activeSession = (state) =>
  state.sessions.find(s => s.sessionId === state.activeSessionId) || null;

export const isGenerating = (state) =>
  state.sessions.flatMap(s => s.jobs).some(j => j.status === 'queued' || j.status === 'generating');

export default useGenerationQueueStore;
