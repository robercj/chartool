import { useState } from 'react';
import { Sparkles, Eye, EyeOff, X, Mail, Lock, User, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

// Modes: 'login' | 'register' | 'forgot'
export default function AuthModal({ onClose }) {
  const { theme } = useTheme();
  const { signIn, signUp, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName,     setDisplayName]     = useState('');
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);

  const clearMessages = () => { setError(''); setSuccess(''); };
  const switchMode    = (m) => { setMode(m); clearMessages(); };

  const handleLogin = async (e) => {
    e.preventDefault(); clearMessages(); setLoading(true);
    try { await signIn({ email, password }); onClose?.(); }
    catch (err) { setError(err.message || 'Login failed. Please check your credentials.'); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault(); clearMessages();
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (password.length < 8)          { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await signUp({ email, password, displayName });
      setSuccess('Account created! Check your email to confirm your address, then sign in.');
      setMode('login');
    } catch (err) { setError(err.message || 'Registration failed.'); }
    finally { setLoading(false); }
  };

  const handleForgot = async (e) => {
    e.preventDefault(); clearMessages(); setLoading(true);
    try { await resetPassword(email); setSuccess('Password reset email sent. Check your inbox.'); }
    catch (err) { setError(err.message || 'Failed to send reset email.'); }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    clearMessages(); setLoading(true);
    try { await signInWithGoogle(); }
    catch (err) { setError(err.message || 'Google sign-in failed.'); setLoading(false); }
  };

  return (
    /* DaisyUI modal — bottom on mobile, middle on sm+ */
    <dialog className="modal modal-bottom sm:modal-middle" open>
      {/* Backdrop */}
      <div className="modal-backdrop bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div
        className="modal-box w-full max-w-md p-5 md:p-8"
        style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
      >
        {/* Close button */}
        {onClose && (
          <form method="dialog">
            <button
              onClick={onClose}
              className="btn btn-sm btn-circle btn-ghost absolute right-3 top-3"
              aria-label="Close"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </form>
        )}

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5" style={{ color: theme.primary }} />
          <span
            className="font-bold text-lg"
            style={{
              background:           theme.logoGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}
          >
            Character Forge
          </span>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold mb-1" style={{ color: theme.textBody }}>
          {mode === 'login'    && 'Welcome back'}
          {mode === 'register' && 'Create account'}
          {mode === 'forgot'   && 'Reset password'}
        </h2>
        <p className="text-sm mb-6 opacity-70" style={{ color: theme.textMuted }}>
          {mode === 'login'    && 'Sign in to access your storylines and characters.'}
          {mode === 'register' && 'Start for free — no credit card required.'}
          {mode === 'forgot'   && "We'll send a reset link to your email."}
        </p>

        {/* Alerts */}
        {error && (
          <div role="alert" className="alert alert-error mb-4 text-sm py-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div role="alert" className="alert alert-success mb-4 text-sm py-3">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ── Login ─────────────────────────────────────────────────────────── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <InputField
              icon={<Mail className="w-4 h-4" />}
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              theme={theme}
            />
            <InputField
              icon={<Lock className="w-4 h-4" />}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              theme={theme}
              trailing={
                <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            <div className="text-right">
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="btn btn-link btn-xs p-0"
                style={{ color: theme.primary }}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ minHeight: '44px' }}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <div className="divider text-xs opacity-50">or</div>

            <GoogleBtn onClick={handleGoogle} disabled={loading} theme={theme} />

            <p className="text-center text-sm opacity-70" style={{ color: theme.textMuted }}>
              Don't have an account?{' '}
              <button type="button" onClick={() => switchMode('register')} className="btn btn-link btn-xs p-0 font-medium" style={{ color: theme.primary }}>
                Sign up free
              </button>
            </p>
          </form>
        )}

        {/* ── Register ──────────────────────────────────────────────────────── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <InputField
              icon={<User className="w-4 h-4" />}
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              autoComplete="name"
              theme={theme}
            />
            <InputField
              icon={<Mail className="w-4 h-4" />}
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              theme={theme}
            />
            <InputField
              icon={<Lock className="w-4 h-4" />}
              type={showPassword ? 'text' : 'password'}
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              theme={theme}
              trailing={
                <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
            <InputField
              icon={<Lock className="w-4 h-4" />}
              type={showConfirm ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              theme={theme}
              trailing={
                <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />

            {/* Free tier info */}
            <div className="text-xs p-3 rounded-xl opacity-80" style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textMuted }}>
              Free plan includes <strong style={{ color: theme.textBody }}>15 image generations</strong> and{' '}
              <strong style={{ color: theme.textBody }}>3 storyline prompts</strong> per month.
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ minHeight: '44px' }}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : null}
              {loading ? 'Creating account…' : 'Create Free Account'}
            </button>

            <div className="divider text-xs opacity-50">or</div>
            <GoogleBtn onClick={handleGoogle} disabled={loading} theme={theme} />

            <p className="text-center text-sm opacity-70" style={{ color: theme.textMuted }}>
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('login')} className="btn btn-link btn-xs p-0 font-medium" style={{ color: theme.primary }}>
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* ── Forgot password ────────────────────────────────────────────────── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <InputField
              icon={<Mail className="w-4 h-4" />}
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              theme={theme}
            />
            <button type="submit" disabled={loading} className="btn btn-primary btn-block" style={{ minHeight: '44px' }}>
              {loading ? <span className="loading loading-spinner loading-sm" /> : null}
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <p className="text-center text-sm">
              <button type="button" onClick={() => switchMode('login')} className="btn btn-link btn-xs p-0 font-medium" style={{ color: theme.primary }}>
                Back to Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </dialog>
  );
}

// ─── Shared input with leading icon ──────────────────────────────────────────
function InputField({ icon, trailing, theme, ...inputProps }) {
  return (
    <div className="relative">
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10"
        style={{ color: theme.textMuted }}
      >
        {icon}
      </span>
      <input
        {...inputProps}
        className="input input-bordered w-full pl-9 pr-10 text-sm"
        style={{
          background:  theme.fieldBg,
          borderColor: theme.fieldBorder,
          color:       theme.textBody,
          minHeight:   '44px',
        }}
      />
      {trailing && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
          {trailing}
        </span>
      )}
    </div>
  );
}

// ─── Google button ────────────────────────────────────────────────────────────
function GoogleBtn({ onClick, disabled, theme }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn btn-outline btn-block gap-2"
      style={{ borderColor: theme.fieldBorder, color: theme.textBody, minHeight: '44px' }}
    >
      <GoogleIcon />
      Continue with Google
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
