import { create } from 'zustand';
import { supabase } from '../supabase';
import { generateImage } from '../anthropic';

function generateId() {
  return crypto.randomUUID();
}

const useGenerationQueueStore = create((set, get) => ({
  sessions: [],
  activeSessionId: null,

  dispatchBatch: async ({ contextType, contextId, formSnapshot, returnRoute, jobs }) => {
    const sessionId = generateId();
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const session = {
      sessionId,
      contextType,
      contextId,
      returnRoute,
      formSnapshot,
      jobs: jobs.map(j => ({
        jobId: generateId(),
        contextType,
        contextId,
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
      activeSessionId: sessionId,
    }));

    for (const job of session.jobs) {
      await supabase.from('generation_jobs').insert({
        id: job.jobId,
        user_id: user.id,
        session_id: sessionId,
        context_type: contextType,
        context_id: contextId,
        status: 'queued',
        generation_params: job.generationParams,
      });
    }

    session.jobs.forEach(job => {
      get()._fireJob(job, user.id);
    });

    return sessionId;
  },

  _fireJob: (job, userId) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === get().activeSessionId
          ? { ...s, jobs: s.jobs.map(j => j.jobId === job.jobId ? { ...j, status: 'generating' } : j) }
          : s
      ),
    }));

    supabase
      .from('generation_jobs')
      .update({ status: 'generating' })
      .eq('id', job.jobId)
      .eq('user_id', userId);

    const { signal } = job.generationParams._signal
      ? { signal: job.generationParams._signal }
      : {};

    const { _signal, ...restParams } = job.generationParams;

    generateImage(restParams, signal)
      .then(async imageUrl => {
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
          sessions: state.sessions.map(s => ({
            ...s,
            jobs: s.jobs.map(j =>
              j.jobId === job.jobId
                ? { ...j, status: 'complete', imageUrl, completedAt: Date.now() }
                : j
            ),
          })),
        }));
      })
      .catch(async err => {
        const message = err?.message || 'Generation failed';

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
          sessions: state.sessions.map(s => ({
            ...s,
            jobs: s.jobs.map(j =>
              j.jobId === job.jobId
                ? { ...j, status: 'failed', errorMessage: message, completedAt: Date.now() }
                : j
            ),
          })),
        }));
      });
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
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    }));
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId });
  },

  retryJob: async (sessionId, jobId) => {
    const session = get().sessions.find(s => s.sessionId === sessionId);
    if (!session) return;

    const job = session.jobs.find(j => j.jobId === jobId);
    if (!job) return;

    const user = (await supabase.auth.getUser()).data.user;
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
      context_type: session.contextType,
      context_id: session.contextId,
      status: 'queued',
      generation_params: job.generationParams,
    });

    get()._fireJob({ ...job, jobId: newJobId }, user.id);
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
