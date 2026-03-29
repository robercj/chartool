import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState(null);
  const [usage, setUsage] = useState({ image: 0, story: 0, character: 0 });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const mountedRef = useRef(true);
  // Tracks the in-flight loadProfile call; replaced on each new call so a
  // stale call can detect it has been superseded and bail out early.
  const loadTokenRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ─── Load profile + tier + current-month usage ──────────────────────────────
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      if (!mountedRef.current) return;
      setProfile(null);
      setTier(null);
      setUsage({ image: 0, story: 0, character: 0 });
      return;
    }

    // Create a cancellation token. If loadProfile is called again before this
    // one finishes (e.g. both getSession and onAuthStateChange fire at startup),
    // the earlier call will see its token replaced and bail out without updating
    // state, preventing a double-write and the duplicate network requests.
    const token = {};
    loadTokenRef.current = token;
    const isStale = () => loadTokenRef.current !== token || !mountedRef.current;

    setLoadingProfile(true);
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, tier:tiers(*)')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (isStale()) return;
      setProfile(profileData);
      setTier(profileData.tier);

      const period = currentPeriod();
      const { data: usageRows } = await supabase
        .from('usage')
        .select('type, count')
        .eq('user_id', userId)
        .eq('period', period);

      if (isStale()) return;
      const usageMap = { image: 0, story: 0, character: 0 };
      (usageRows || []).forEach(row => { usageMap[row.type] = row.count; });
      setUsage(usageMap);
    } catch (err) {
      if (!isStale()) console.error('loadProfile error:', err);
    } finally {
      if (!isStale()) setLoadingProfile(false);
    }
  }, []);

  // ─── Session listener ────────────────────────────────────────────────────────
  useEffect(() => {
    // getSession() restores any persisted session on first load. onAuthStateChange
    // will also fire INITIAL_SESSION for the same user immediately after, so both
    // paths call loadProfile — the cancellation token in loadProfile ensures only
    // the second (more recent) call actually commits its state.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;
      
      if (event === 'TOKEN_REFRESHED') {
        setSession(session);
        return;
      }

      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setTier(null);
        setUsage({ image: 0, story: 0, character: 0 });
      }
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // ─── Auth actions ────────────────────────────────────────────────────────────
  const signUp = async ({ email, password, displayName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async ({ email, password }) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/settings`,
    });
    if (error) throw error;
  };

  // ─── Generation limit check ──────────────────────────────────────────────────
  // type: 'image' | 'story' | 'character'
  // Returns { allowed: boolean, reason: string | null, current: number, limit: number | null }
  const checkLimit = useCallback((type) => {
    if (!tier) return { allowed: false, reason: 'Not authenticated', current: 0, limit: 0 };

    const current = usage[type] ?? 0;

    // Monthly cap (Free / Pro). Enterprise uses daily_image_limit / daily_story_limit
    // but those require a separate daily counter; not yet tracked client-side.
    const monthlyLimit =
      type === 'image'     ? tier.monthly_image_limit :
      type === 'story'     ? tier.monthly_story_limit :
      type === 'character' ? tier.monthly_character_limit :
      null;

    if (monthlyLimit !== null && current >= monthlyLimit) {
      return {
        allowed: false,
        reason: `You've reached your monthly ${type} limit (${monthlyLimit}) on the ${tier.display_name} plan.`,
        current,
        limit: monthlyLimit,
      };
    }

    // Note: daily cap for enterprise would require a separate daily counter.
    // For now we track monthly and expose daily limit info on the UI.
    return { allowed: true, reason: null, current, limit: monthlyLimit };
  }, [tier, usage]);

  // ─── Increment usage counter ─────────────────────────────────────────────────
  // Call this AFTER a successful generation, not before.
  const incrementUsage = useCallback(async (type, amount = 1) => {
    if (!session?.user) return;
    const period = currentPeriod();
    const userId = session.user.id;

    // Optimistic local update
    setUsage(prev => ({ ...prev, [type]: (prev[type] ?? 0) + amount }));

    // Upsert to Supabase
    const { error } = await supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_type: type,
      p_period: period,
      p_amount: amount,
    });

    if (error) {
      console.error('incrementUsage error:', error);
      // Revert optimistic update
      setUsage(prev => ({ ...prev, [type]: Math.max(0, (prev[type] ?? 0) - amount) }));
    }
  }, [session]);

  const refreshProfile = useCallback(() => {
    if (session?.user) loadProfile(session.user.id);
  }, [session, loadProfile]);

  const loading = session === undefined || loadingProfile;
  const user = session?.user ?? null;

  return (
    <AuthContext.Provider value={{
      session,
      user,
      profile,
      tier,
      usage,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
      resetPassword,
      checkLimit,
      incrementUsage,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

// Returns the first day of the current calendar month as 'YYYY-MM-DD'
function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}
