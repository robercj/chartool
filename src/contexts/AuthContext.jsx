import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = loading, null = no session
  const [profile, setProfile] = useState(null);
  const [tier, setTier] = useState(null);
  const [usage, setUsage] = useState({ image: 0, story: 0 });
  const [loadingProfile, setLoadingProfile] = useState(false);

  // ─── Load profile + tier + current-month usage ──────────────────────────────
  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setTier(null);
      setUsage({ image: 0, story: 0 });
      return;
    }
    setLoadingProfile(true);
    try {
      // Profile + tier in one query via join
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, tier:tiers(*)')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      setTier(profileData.tier);

      // Current month usage
      const period = currentPeriod();
      const { data: usageRows } = await supabase
        .from('usage')
        .select('type, count')
        .eq('user_id', userId)
        .eq('period', period);

      const usageMap = { image: 0, story: 0 };
      (usageRows || []).forEach(row => { usageMap[row.type] = row.count; });
      setUsage(usageMap);
    } catch (err) {
      console.error('loadProfile error:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, []);

  // ─── Session listener ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setTier(null);
        setUsage({ image: 0, story: 0 });
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
      options: { redirectTo: window.location.origin },
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
  // type: 'image' | 'story'
  // Returns { allowed: boolean, reason: string | null, current: number, limit: number | null }
  const checkLimit = useCallback((type) => {
    if (!tier) return { allowed: false, reason: 'Not authenticated', current: 0, limit: 0 };

    const current = usage[type] ?? 0;
    const today = new Date();

    // Daily cap (Enterprise)
    const dailyLimit = type === 'image' ? tier.daily_image_limit : tier.daily_story_limit;
    // Monthly cap (Free / Pro)
    const monthlyLimit = type === 'image' ? tier.monthly_image_limit : tier.monthly_story_limit;

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
