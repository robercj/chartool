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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const clearMessages = () => { setError(''); setSuccess(''); };

  const switchMode = (m) => { setMode(m); clearMessages(); };

  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      await signIn({ email, password });
      onClose?.();
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    clearMessages();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp({ email, password, displayName });
      setSuccess('Account created! Check your email to confirm your address, then sign in.');
      setMode('login');
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);
    try {
      await resetPassword(email);
      setSuccess('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    clearMessages();
    setLoading(true);
    try {
      await signInWithGoogle();
      // Page will redirect; no need to close modal
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem 0.75rem 2.5rem',
    borderRadius: '0.75rem',
    fontSize: '0.875rem',
    background: theme.fieldBg,
    border: `1px solid ${theme.fieldBorder}`,
    color: theme.textBody,
    outline: 'none',
  };

  const btnPrimary = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.75rem',
    fontWeight: 600,
    background: theme.buttonGradient,
    color: 'white',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    transition: 'all 0.2s',
    fontSize: '0.875rem',
  };

  const btnGoogle = {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.75rem',
    fontWeight: 500,
    background: 'transparent',
    color: theme.textBody,
    border: `1px solid ${theme.fieldBorder}`,
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — responsive padding: tighter on mobile */}
      <div
        className="relative w-full max-w-md rounded-2xl p-5 md:p-8 shadow-2xl"
        style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
      >
        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            style={{ minWidth: '44px', minHeight: '44px' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" style={{ color: theme.textMuted }} aria-hidden="true" />
          </button>
        )}

        {/* Logo */}
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-5 h-5" style={{ color: theme.primary }} />
          <span
            style={{
              background: theme.logoGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              fontWeight: 700,
              fontSize: '1.125rem',
            }}
          >
            Character Forge
          </span>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold mb-1" style={{ color: theme.textBody }}>
          {mode === 'login' && 'Welcome back'}
          {mode === 'register' && 'Create account'}
          {mode === 'forgot' && 'Reset password'}
        </h2>
        <p className="text-sm mb-6" style={{ color: theme.textMuted }}>
          {mode === 'login' && 'Sign in to access your storylines and characters.'}
          {mode === 'register' && 'Start for free — no credit card required.'}
          {mode === 'forgot' && "We'll send a reset link to your email."}
        </p>

        {/* Error / Success messages */}
        {error && (
          <div
            className="flex items-start gap-2 p-3 rounded-xl mb-4 text-sm"
            style={{ background: 'rgba(216,0,50,0.12)', border: '1px solid rgba(216,0,50,0.3)', color: '#f87171' }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div
            className="flex items-start gap-2 p-3 rounded-xl mb-4 text-sm"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}
          >
            <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* ── Login form ──────────────────────────────────────────────────── */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <Field icon={<Mail className="w-4 h-4" />} theme={theme}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
              />
            </Field>

            <Field
              icon={<Lock className="w-4 h-4" />}
              theme={theme}
              trailing={
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword
                    ? <EyeOff className="w-4 h-4" style={{ color: theme.textMuted }} />
                    : <Eye className="w-4 h-4" style={{ color: theme.textMuted }} />
                  }
                </button>
              }
            >
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ ...inputStyle, paddingRight: '2.5rem' }}
              />
            </Field>

            <div className="text-right">
              <button
                type="button"
                onClick={() => switchMode('forgot')}
                className="text-xs hover:underline"
                style={{ color: theme.accent }}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" disabled={loading} style={btnPrimary}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>

            <Divider theme={theme} />

            <button type="button" onClick={handleGoogle} disabled={loading} style={btnGoogle}>
              <GoogleIcon />
              Continue with Google
            </button>

            <p className="text-center text-sm" style={{ color: theme.textMuted }}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="font-medium hover:underline"
                style={{ color: theme.primary }}
              >
                Sign up free
              </button>
            </p>
          </form>
        )}

        {/* ── Register form ────────────────────────────────────────────────── */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <Field icon={<User className="w-4 h-4" />} theme={theme}>
              <input
                type="text"
                placeholder="Display name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name"
                style={inputStyle}
              />
            </Field>

            <Field icon={<Mail className="w-4 h-4" />} theme={theme}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
              />
            </Field>

            <Field
              icon={<Lock className="w-4 h-4" />}
              theme={theme}
              trailing={
                <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                  {showPassword
                    ? <EyeOff className="w-4 h-4" style={{ color: theme.textMuted }} />
                    : <Eye className="w-4 h-4" style={{ color: theme.textMuted }} />
                  }
                </button>
              }
            >
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ ...inputStyle, paddingRight: '2.5rem' }}
              />
            </Field>

            <Field
              icon={<Lock className="w-4 h-4" />}
              theme={theme}
              trailing={
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}>
                  {showConfirm
                    ? <EyeOff className="w-4 h-4" style={{ color: theme.textMuted }} />
                    : <Eye className="w-4 h-4" style={{ color: theme.textMuted }} />
                  }
                </button>
              }
            >
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ ...inputStyle, paddingRight: '2.5rem' }}
              />
            </Field>

            {/* Free tier blurb */}
            <div
              className="text-xs p-3 rounded-xl"
              style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}`, color: theme.textMuted }}
            >
              Free plan includes <strong style={{ color: theme.textBody }}>15 image generations</strong> and{' '}
              <strong style={{ color: theme.textBody }}>3 storyline prompts</strong> per month.
            </div>

            <button type="submit" disabled={loading} style={btnPrimary}>
              {loading ? 'Creating account…' : 'Create Free Account'}
            </button>

            <Divider theme={theme} />

            <button type="button" onClick={handleGoogle} disabled={loading} style={btnGoogle}>
              <GoogleIcon />
              Continue with Google
            </button>

            <p className="text-center text-sm" style={{ color: theme.textMuted }}>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-medium hover:underline"
                style={{ color: theme.primary }}
              >
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* ── Forgot password form ─────────────────────────────────────────── */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgot} className="space-y-4">
            <Field icon={<Mail className="w-4 h-4" />} theme={theme}>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
              />
            </Field>

            <button type="submit" disabled={loading} style={btnPrimary}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>

            <p className="text-center text-sm" style={{ color: theme.textMuted }}>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="font-medium hover:underline"
                style={{ color: theme.primary }}
              >
                Back to Sign In
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────
function Field({ icon, trailing, theme, children }) {
  return (
    <div className="relative">
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
        style={{ color: theme.textMuted }}
      >
        {icon}
      </span>
      {children}
      {trailing && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer">
          {trailing}
        </span>
      )}
    </div>
  );
}

function Divider({ theme }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px" style={{ background: theme.fieldBorder }} />
      <span className="text-xs" style={{ color: theme.textMuted }}>or</span>
      <div className="flex-1 h-px" style={{ background: theme.fieldBorder }} />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
