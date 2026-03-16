import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Shield, User, Crown, BarChart3, Mail, AlertCircle, CheckCircle, Eye, EyeOff, Lock, Check, Loader2, ExternalLink } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { redirectToCheckout, redirectToCustomerPortal } from '../lib/stripe'

const TIER_COLORS = {
  free:       { bg: 'rgba(100,116,139,0.2)',  text: '#94a3b8', border: 'rgba(100,116,139,0.35)' },
  pro:        { bg: 'rgba(99,102,241,0.2)',   text: '#a5b4fc', border: 'rgba(99,102,241,0.35)'  },
  enterprise: { bg: 'rgba(234,179,8,0.15)',   text: '#fde047', border: 'rgba(234,179,8,0.35)'   },
}

// Tier pricing config — stripe_price_id values should match what's stored in
// the tiers table after running migration 004_stripe_billing.sql
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
  const { theme } = useTheme()
  const { user, profile, tier, usage, refreshProfile } = useAuth()
  const [searchParams] = useSearchParams()

  const [displayName, setDisplayName] = useState(profile?.display_name || '')
  const [savingName, setSavingName] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(null)

  // Handle redirect back from Stripe checkout
  useEffect(() => {
    const upgradeStatus = searchParams.get('upgrade')
    if (upgradeStatus === 'success') {
      toast.success('Subscription activated! Your plan has been upgraded.')
      refreshProfile()
    } else if (upgradeStatus === 'cancelled') {
      toast.info('Checkout cancelled — your plan was not changed.')
    }
  }, [])

  const handleUpgrade = async (planId) => {
    // Fetch the stripe_price_id for this tier from Supabase
    const { data: tierData, error } = await supabase
      .from('tiers')
      .select('stripe_price_id')
      .eq('id', planId)
      .single()

    if (error || !tierData?.stripe_price_id) {
      toast.error('This plan is not yet available for purchase. Please contact support.')
      return
    }

    setCheckoutLoading(planId)
    try {
      await redirectToCheckout(tierData.stripe_price_id)
    } catch (err) {
      toast.error(err.message || 'Failed to start checkout')
      setCheckoutLoading(null)
    }
  }

  const handleManageBilling = async () => {
    setCheckoutLoading('portal')
    try {
      await redirectToCustomerPortal()
    } catch (err) {
      toast.error(err.message || 'Failed to open billing portal')
      setCheckoutLoading(null)
    }
  }

  const tierId = tier?.id || 'free'
  const tierColors = TIER_COLORS[tierId] || TIER_COLORS.free

  const imageLimit = tier?.monthly_image_limit
  const storyLimit = tier?.monthly_story_limit
  const dailyImageLimit = tier?.daily_image_limit
  const dailyStoryLimit = tier?.daily_story_limit
  const imageUsed = usage?.image ?? 0
  const storyUsed = usage?.story ?? 0

  const handleSaveDisplayName = async () => {
    if (!displayName.trim()) return
    setSavingName(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: displayName.trim() })
        .eq('id', user.id)
      if (error) throw error
      refreshProfile()
      toast.success('Display name updated')
    } catch (err) {
      toast.error(err.message || 'Failed to update name')
    } finally {
      setSavingName(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated')
    } catch (err) {
      toast.error(err.message || 'Failed to update password')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2" style={{
        background: theme.titleGradient,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>
        Account Settings
      </h1>
      <p className="text-sm mb-8" style={{ color: theme.textMuted }}>
        Manage your profile, plan, and usage
      </p>

      {/* ── Account info ──────────────────────────────────────────────────── */}
      <Section title="Profile" icon={<User className="w-4 h-4" />} theme={theme}>
        <div className="space-y-4">
          {/* Email (read-only) */}
          <div>
            <Label theme={theme}>Email</Label>
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textMuted }}
            >
              <Mail className="w-4 h-4 flex-shrink-0" />
              {user?.email}
            </div>
          </div>

          {/* Display name */}
          <div>
            <Label theme={theme}>Display Name</Label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl text-sm"
                style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
                placeholder="Your name"
              />
              <Button onClick={handleSaveDisplayName} disabled={savingName} theme={theme}>
                {savingName ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Plan & Usage ───────────────────────────────────────────────────── */}
      <Section title="Plan & Usage" icon={<Crown className="w-4 h-4" />} theme={theme}>
        {/* Current plan badge */}
        <div
          className="flex items-center justify-between p-4 rounded-xl mb-5"
          style={{ background: tierColors.bg, border: `1px solid ${tierColors.border}` }}
        >
          <div>
            <div className="font-semibold text-sm" style={{ color: tierColors.text }}>
              {tier?.display_name || 'Free'} Plan
            </div>
            <div className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
              {tierId === 'enterprise'
                ? `No monthly limit · Daily cap: ${dailyImageLimit} images / ${dailyStoryLimit} storylines`
                : `Resets on the 1st of each month`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-1 rounded-lg font-semibold uppercase tracking-wide"
              style={{ background: tierColors.bg, color: tierColors.text, border: `1px solid ${tierColors.border}` }}
            >
              {tier?.display_name || 'Free'}
            </span>
            {tierId !== 'free' && profile?.stripe_customer_id && (
              <button
                onClick={handleManageBilling}
                disabled={checkoutLoading === 'portal'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: theme.fieldBg, color: theme.textBody, border: `1px solid ${theme.fieldBorder}` }}
              >
                {checkoutLoading === 'portal'
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <ExternalLink className="w-3 h-3" />}
                Manage Billing
              </button>
            )}
          </div>
        </div>

        {/* Usage bars */}
        <div className="space-y-4 mb-6">
          <UsageRow
            label="Image Generations"
            used={imageUsed}
            limit={imageLimit}
            theme={theme}
            tierColors={tierColors}
          />
          <UsageRow
            label="Storyline Prompts"
            used={storyUsed}
            limit={storyLimit}
            theme={theme}
            tierColors={tierColors}
          />
        </div>

        {/* Pricing cards — shown when not on enterprise */}
        {tierId !== 'enterprise' && (
          <div>
            <div className="text-xs uppercase tracking-widest font-medium mb-3" style={{ color: theme.labelColor }}>
              Upgrade Your Plan
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIER_PLANS.map(plan => {
                const isCurrent = tierId === plan.id
                const isUpgrade = plan.id !== 'free' && !isCurrent
                return (
                  <div
                    key={plan.id}
                    className="relative rounded-xl p-4 flex flex-col"
                    style={{
                      background: isCurrent ? tierColors.bg : theme.fieldBg,
                      border: `1px solid ${isCurrent ? tierColors.border : plan.popular ? theme.primary + '60' : theme.fieldBorder}`,
                    }}
                  >
                    {plan.popular && !isCurrent && (
                      <div
                        className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: theme.buttonGradient, color: 'white' }}
                      >
                        Popular
                      </div>
                    )}
                    <div className="mb-3">
                      <div className="font-semibold text-sm mb-0.5" style={{ color: isCurrent ? tierColors.text : theme.textBody }}>
                        {plan.name}
                      </div>
                      <div className="text-lg font-bold" style={{ color: isCurrent ? tierColors.text : theme.textBody }}>
                        {plan.price === 0 ? 'Free' : `$${plan.price.toFixed(2)}`}
                        {plan.price > 0 && <span className="text-xs font-normal ml-1" style={{ color: theme.textMuted }}>/mo</span>}
                      </div>
                    </div>
                    <ul className="space-y-1 flex-1 mb-4">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs" style={{ color: theme.textMuted }}>
                          <Check className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: isCurrent ? tierColors.text : theme.primary }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <div
                        className="w-full py-2 rounded-lg text-xs font-medium text-center"
                        style={{ background: tierColors.bg, color: tierColors.text, border: `1px solid ${tierColors.border}` }}
                      >
                        Current Plan
                      </div>
                    ) : isUpgrade ? (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={!!checkoutLoading}
                        className="w-full py-2 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: checkoutLoading === plan.id ? theme.fieldBg : theme.buttonGradient,
                          color: 'white',
                          cursor: checkoutLoading ? 'not-allowed' : 'pointer',
                          opacity: checkoutLoading && checkoutLoading !== plan.id ? 0.5 : 1,
                        }}
                      >
                        {checkoutLoading === plan.id
                          ? <span className="flex items-center justify-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</span>
                          : `Upgrade to ${plan.name}`}
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Section>

      {/* ── Security ──────────────────────────────────────────────────────── */}
      <Section title="Security" icon={<Shield className="w-4 h-4" />} theme={theme}>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <Label theme={theme}>New Password</Label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm"
                style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
              >
                {showNew
                  ? <EyeOff className="w-4 h-4" style={{ color: theme.textMuted }} />
                  : <Eye className="w-4 h-4" style={{ color: theme.textMuted }} />
                }
              </button>
            </div>
          </div>
          <div>
            <Label theme={theme}>Confirm New Password</Label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm"
                style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textBody }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5"
              >
                {showCurrent
                  ? <EyeOff className="w-4 h-4" style={{ color: theme.textMuted }} />
                  : <Eye className="w-4 h-4" style={{ color: theme.textMuted }} />
                }
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={savingPassword || !newPassword || !confirmPassword}
            theme={theme}
          >
            <Lock className="w-4 h-4 mr-2" />
            {savingPassword ? 'Updating…' : 'Update Password'}
          </Button>
        </form>
      </Section>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function Section({ title, icon, theme, children }) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <span style={{ color: theme.primary }}>{icon}</span>
        <h2 className="text-lg font-semibold" style={{ color: theme.textBody }}>{title}</h2>
      </div>
      <div
        className="p-5 rounded-2xl"
        style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
      >
        {children}
      </div>
    </section>
  )
}

function UsageRow({ label, used, limit, theme, tierColors }) {
  const unlimited = limit === null || limit === undefined
  const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100)
  const atLimit = !unlimited && used >= limit
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm" style={{ color: theme.textBody }}>{label}</span>
        <span
          className="text-xs font-medium tabular-nums"
          style={{ color: atLimit ? '#f87171' : tierColors.text }}
        >
          {unlimited ? `${used} used (unlimited)` : `${used} / ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 rounded-full overflow-hidden" style={{ background: theme.fieldBg }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: atLimit
                ? 'linear-gradient(90deg, #b91c1c, #ef4444)'
                : tierColors.text,
            }}
          />
        </div>
      )}
      {atLimit && (
        <p className="text-xs mt-1" style={{ color: '#f87171' }}>
          Monthly limit reached. Resets on the 1st.
        </p>
      )}
    </div>
  )
}

function Button({ children, onClick, type = 'button', disabled = false, theme, className = '' }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${className}`}
      style={{
        background: disabled ? theme.fieldBg : theme.buttonGradient,
        color: disabled ? theme.textMuted : 'white',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: disabled ? `1px solid ${theme.fieldBorder}` : 'none',
      }}
    >
      {children}
    </button>
  )
}

function Label({ theme, children }) {
  return (
    <div className="text-xs uppercase tracking-widest font-medium mb-1.5" style={{ color: theme.labelColor }}>
      {children}
    </div>
  )
}
