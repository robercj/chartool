// ─── _shared/limits.ts ────────────────────────────────────────────────────────
// Shared usage-limit helpers used by all generation edge functions.
//
// checkLimit  — reads the user's tier and current-month usage, returns
//               { allowed, reason } without mutating anything.
// incrementUsage — increments the usage counter via the increment_usage RPC.
// currentPeriod  — returns the current month as 'YYYY-MM-01' (the key used in
//                  the usage table to scope counters to a calendar month).
//
// Quota types: 'image' | 'story' | 'character'
// NULL limit → unlimited (Enterprise tier).
// ─────────────────────────────────────────────────────────────────────────────

export function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export async function checkLimit(
  supabase: any,
  userId: string,
  type: string,
): Promise<{ allowed: boolean; reason: string | null }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier_id, tier:tiers(monthly_image_limit, monthly_story_limit, monthly_character_limit)')
    .eq('id', userId)
    .single()

  if (!profile) return { allowed: false, reason: 'Profile not found' }

  const tier = profile.tier
  const limit: number | null =
    type === 'image'     ? tier.monthly_image_limit :
    type === 'story'     ? tier.monthly_story_limit :
    type === 'character' ? tier.monthly_character_limit :
    null // unknown types pass through (allowed)

  if (limit === null) return { allowed: true, reason: null }

  const period = currentPeriod()
  const { data: usageRow } = await supabase
    .from('usage')
    .select('count')
    .eq('user_id', userId)
    .eq('type', type)
    .eq('period', period)
    .single()

  const current: number = usageRow?.count ?? 0
  if (current >= limit) {
    return { allowed: false, reason: `Monthly ${type} limit (${limit}) reached. Resets on the 1st.` }
  }
  return { allowed: true, reason: null }
}

export async function incrementUsage(
  supabase: any,
  userId: string,
  type: string,
): Promise<void> {
  await supabase.rpc('increment_usage', {
    p_user_id: userId,
    p_type: type,
    p_period: currentPeriod(),
    p_amount: 1,
  })
}
