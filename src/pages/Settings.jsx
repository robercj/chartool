import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Shield, User, Crown, Mail, Eye, EyeOff, Lock, Check, Loader2, ExternalLink } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { redirectToCheckout, redirectToCustomerPortal } from '../lib/stripe'

// Tier badge DaisyUI class mapping
const TIER_BADGE = {
  free:       'badge-ghost',
  pro:        'badge-info',
  enterprise: 'badge-warning',
}

const TIER_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      '15 image generations/month',
      '3 storyline prompts/month',
      'Basic character analysis',
      'Standard art styles',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    popular: true,
    features: [
      '100 image generations/month',
      '20 storyline prompts/month',
      'Advanced character analysis',
      'All art styles',
      'Priority generation queue',
      'Background removal included',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 29.99,
    features: [
      'Unlimited monthly generations',
      '25+ storyline prompts/day',
      'Advanced character analysis',
      'All art styles',
      'Priority generation queue',
      'Background removal included',
      'Bulk export (ZIP)',
      'Dedicated support',
    ],
  },
]

export default function SettingsPage() {
  const { theme }       = useTheme()
  const { user, profile, tier, usage, refreshProfile } = useAuth()
  const [searchParams]  = useSearchParams()

  const [displayName,      setDisplayName]      = useState(profile?.display_name || '')
  const [savingName,       setSavingName]        = useState(false)
  const [newPassword,      setNewPassword]       = useState('')
  const [confirmPassword,  setConfirmPassword]   = useState('')
  const [showNew,          setShowNew]           = useState(false)
  const [showConfirm,      setShowConfirm]       = useState(false)
  const [savingPassword,   setSavingPassword]    = useState(false)
  const [checkoutLoading,  setCheckoutLoading]   = useState(null)

  useEffect(() => {
    const upgradeStatus = searchParams.get('upgrade')
    if (upgradeStatus === 'success') {
      toast.success('Subscription activated! Your plan has been upgraded.')
      refreshProfile()
    } else if (upgradeStatus === 'cancelled') {
      toast.info('Checkout cancelled — your plan was not changed.')
    }
  }, [searchParams, refreshProfile])

  const handleUpgrade = async (planId) => {
    const { data: tierData, error } = await supabase
      .from('tiers').select('stripe_price_id').eq('id', planId).single()
    if (error || !tierData?.stripe_price_id) {
      toast.error('This plan is not yet available for purchase. Please contact support.')
      return
    }
    setCheckoutLoading(planId)
    try { await redirectToCheckout(tierData.stripe_price_id) }
    catch (err) { toast.error(err.message || 'Failed to start checkout'); setCheckoutLoading(null) }
  }

  const handleManageBilling = async () => {
    setCheckoutLoading('portal')
    try { await redirectToCustomerPortal() }
    catch (err) { toast.error(err.message || 'Failed to open billing portal'); setCheckoutLoading(null) }
  }

  const tierId     = tier?.id || 'free'
  const tierBadge  = TIER_BADGE[tierId] || 'badge-ghost'

  const imageLimit      = tier?.monthly_image_limit
  const storyLimit      = tier?.monthly_story_limit
  const dailyImageLimit = tier?.daily_image_limit
  const dailyStoryLimit = tier?.daily_story_limit
  const imageUsed       = usage?.image ?? 0
  const storyUsed       = usage?.story ?? 0

  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) return
    setSavingName(true)
    try {
      const { error } = await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', user.id)
      if (error) throw error
      refreshProfile()
      toast.success('Display name updated')
    } catch (err) { toast.error(err.message || 'Failed to update name') }
    finally { setSavingName(false) }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (newPassword.length < 8)         { toast.error('Password must be at least 8 characters'); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword(''); setConfirmPassword('')
      toast.success('Password updated')
    } catch (err) { toast.error(err.message || 'Failed to update password') }
    finally { setSavingPassword(false) }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1
        className="text-3xl font-bold mb-2"
        style={{
          background:           theme.titleGradient,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor:  'transparent',
        }}
      >
        Account Settings
      </h1>
      <p className="text-sm mb-8 text-base-content/50">
        Manage your profile, plan, and usage
      </p>

      {/* ── Profile ─────────────────────────────────────────────────────── */}
      <SettingsSection title="Profile" icon={<User className="w-4 h-4" />} theme={theme}>
        <div className="space-y-4">
          {/* Email — read only */}
          <div>
            <label className="label label-text font-medium pb-1 uppercase tracking-widest text-xs">Email</label>
            <div className="input input-bordered flex items-center gap-2 bg-base-300 text-base-content/50 cursor-default">
              <Mail className="w-4 h-4 flex-shrink-0" />
              {user?.email}
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="label label-text font-medium pb-1 uppercase tracking-widest text-xs">Display Name</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="input input-bordered flex-1 bg-base-300"
                style={{ minHeight: '44px' }}
              />
              <button
                onClick={handleSaveDisplayName}
                disabled={savingName}
                className="btn btn-primary"
                style={{ minHeight: '44px' }}
              >
                {savingName ? <span className="loading loading-spinner loading-xs" /> : null}
                {savingName ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </SettingsSection>

      {/* ── Plan & Usage ─────────────────────────────────────────────────── */}
      <SettingsSection title="Plan & Usage" icon={<Crown className="w-4 h-4" />} theme={theme}>
        {/* Current plan */}
        <div className="flex items-center justify-between p-4 rounded-xl mb-5 bg-base-300 border border-base-300">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-sm text-base-content">{tier?.display_name || 'Free'} Plan</span>
              <span className={`badge badge-sm ${tierBadge} uppercase tracking-wide`}>
                {tier?.display_name || 'Free'}
              </span>
            </div>
            <div className="text-xs text-base-content/50">
              {tierId === 'enterprise'
                ? `No monthly limit · Daily cap: ${dailyImageLimit} images / ${dailyStoryLimit} storylines`
                : 'Resets on the 1st of each month'}
            </div>
          </div>
          {tierId !== 'free' && profile?.stripe_customer_id && (
            <button
              onClick={handleManageBilling}
              disabled={checkoutLoading === 'portal'}
              className="btn btn-sm btn-ghost gap-1.5"
            >
              {checkoutLoading === 'portal'
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <ExternalLink className="w-3 h-3" />}
              Manage Billing
            </button>
          )}
        </div>

        {/* Usage bars */}
        <div className="space-y-4 mb-6">
          <UsageRow label="Image Generations" used={imageUsed} limit={imageLimit} />
          <UsageRow label="Storyline Prompts" used={storyUsed} limit={storyLimit} />
        </div>

        {/* Pricing cards */}
        {tierId !== 'enterprise' && (
          <div>
            <div className="text-xs uppercase tracking-widest font-medium mb-3 text-base-content/50">
              Upgrade Your Plan
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIER_PLANS.map(plan => {
                const isCurrent = tierId === plan.id
                const isUpgrade = plan.id !== 'free' && !isCurrent
                return (
                  <div
                    key={plan.id}
                    className={`card relative ${isCurrent ? 'border-primary/60' : plan.popular ? 'border-primary/30' : 'border-base-300'} border bg-base-200`}
                  >
                    {plan.popular && !isCurrent && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <span className="badge badge-primary text-xs">Popular</span>
                      </div>
                    )}
                    <div className="card-body p-4 gap-3">
                      <div>
                        <div className="font-semibold text-sm text-base-content">{plan.name}</div>
                        <div className="text-lg font-bold text-base-content">
                          {plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}`}
                          {plan.price > 0 && <span className="text-xs font-normal ml-1 text-base-content/50">/mo</span>}
                        </div>
                      </div>
                      <ul className="space-y-1.5 flex-1">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-base-content/70">
                            <Check className="w-3 h-3 mt-0.5 flex-shrink-0 text-primary" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <div className="badge badge-outline w-full justify-center py-3 text-xs">
                          Current Plan
                        </div>
                      ) : isUpgrade ? (
                        <button
                          onClick={() => handleUpgrade(plan.id)}
                          disabled={!!checkoutLoading}
                          className="btn btn-primary btn-sm btn-block"
                          style={{ minHeight: '36px' }}
                        >
                          {checkoutLoading === plan.id
                            ? <><Loader2 className="w-3 h-3 animate-spin" /> Loading…</>
                            : `Upgrade to ${plan.name}`}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </SettingsSection>

      {/* ── Security ─────────────────────────────────────────────────────── */}
      <SettingsSection title="Security" icon={<Shield className="w-4 h-4" />} theme={theme}>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="label label-text font-medium pb-1 uppercase tracking-widest text-xs">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="input input-bordered w-full pr-11 bg-base-300"
                style={{ minHeight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="btn btn-ghost btn-sm btn-circle absolute right-2 top-1/2 -translate-y-1/2"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="label label-text font-medium pb-1 uppercase tracking-widest text-xs">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="input input-bordered w-full pr-11 bg-base-300"
                style={{ minHeight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="btn btn-ghost btn-sm btn-circle absolute right-2 top-1/2 -translate-y-1/2"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={savingPassword || !newPassword || !confirmPassword}
            className="btn btn-primary gap-2"
            style={{ minHeight: '44px' }}
          >
            <Lock className="w-4 h-4" />
            {savingPassword ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </SettingsSection>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function SettingsSection({ title, icon, theme, children }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color: theme.primary }}>{icon}</span>
        <h2 className="text-lg font-semibold text-base-content">{title}</h2>
      </div>
      <div
        className="card p-5"
        style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
      >
        {children}
      </div>
    </section>
  )
}

// ─── Usage row with DaisyUI progress ─────────────────────────────────────────
function UsageRow({ label, used, limit }) {
  const unlimited = limit === null || limit === undefined
  const pct       = unlimited ? 0 : Math.min((used / limit) * 100, 100)
  const atLimit   = !unlimited && used >= limit

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-base-content">{label}</span>
        <span className={`text-xs font-medium tabular-nums ${atLimit ? 'text-error' : 'text-base-content/60'}`}>
          {unlimited ? `${used} used (unlimited)` : `${used} / ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <>
          <progress
            className={`progress w-full h-2 ${atLimit ? 'progress-error' : 'progress-primary'}`}
            value={pct}
            max={100}
          />
          {atLimit && (
            <p className="text-xs mt-1 text-error">
              Monthly limit reached. Resets on the 1st.
            </p>
          )}
        </>
      )}
    </div>
  )
}
