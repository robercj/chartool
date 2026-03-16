import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sparkles, ImagePlus, Images, Settings as SettingsIconLucide, BookMarked, LogOut, User, ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useProgress } from '../contexts/ProgressContext';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { Toaster } from 'sonner';

// Tier badge colours
const TIER_COLORS = {
  free:       { bg: 'rgba(100,116,139,0.25)', text: '#94a3b8', border: 'rgba(100,116,139,0.4)' },
  pro:        { bg: 'rgba(99,102,241,0.25)',  text: '#a5b4fc', border: 'rgba(99,102,241,0.4)' },
  enterprise: { bg: 'rgba(234,179,8,0.2)',    text: '#fde047', border: 'rgba(234,179,8,0.4)'  },
};

function solidOptionBg(cardBg) {
  const m = cardBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const [, r, g, b] = m.map(Number);
    const blend = (c) => Math.round(c * 0.85);
    return `rgb(${blend(r)}, ${blend(g)}, ${blend(b)})`;
  }
  return '#11121a';
}

export default function Layout({ children }) {
  const { theme, genreKey, setGenreKey, GENRES } = useTheme();
  const { progress, stopProgress, clearProgress } = useProgress();
  const { user, profile, tier, usage, signOut, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleGenerateClick = () => {
    if (location.pathname === '/generate') {
      navigate('/generate', { state: { reset: Date.now() } });
    } else {
      navigate('/generate');
    }
  };

  const handleSignOut = async () => {
    setShowUserMenu(false);
    await signOut();
  };

  const optionBg = solidOptionBg(theme.cardBg);
  const optionText = (() => {
    const m = theme.textBody.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? `rgb(${m[1]}, ${m[2]}, ${m[3]})` : '#ced0df';
  })();

  const tierId = tier?.id || 'free';
  const tierColors = TIER_COLORS[tierId] || TIER_COLORS.free;

  // Monthly limit display
  const imageLimit = tier?.monthly_image_limit;
  const storyLimit = tier?.monthly_story_limit;
  const imageUsed = usage?.image ?? 0;
  const storyUsed = usage?.story ?? 0;

  return (
    <div
      style={{
        background: theme.bg,
        fontFamily: theme.fontFamily,
        minHeight: '100vh',
        color: theme.textBody,
      }}
    >
      <Toaster position="top-right" theme="dark" />

      <style>{`
        select option, select optgroup {
          background-color: ${optionBg} !important;
          color: ${optionText} !important;
        }
      `}</style>

      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {theme.orbs.map((color, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: 500 + i * 200,
              height: 500 + i * 200,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
              opacity: 0.15 - i * 0.03,
              top: i === 0 ? '-10%' : i === 1 ? 'auto' : '30%',
              bottom: i === 1 ? '-10%' : 'auto',
              left: i === 2 ? '60%' : i === 0 ? '-5%' : 'auto',
              right: i === 2 ? '-10%' : 'auto',
            }}
          />
        ))}
      </div>

      {/* Navigation */}
      <nav
        style={{
          background: theme.navBg,
          backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${theme.navBorder}`,
        }}
        className="fixed top-0 left-0 right-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6" style={{ color: theme.primary }} />
            <span
              style={{
                background: theme.logoGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
              className="font-bold text-lg"
            >
              Character Forge
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Nav links */}
            <NavLink
              to="/generate"
              icon={ImagePlus}
              active={location.pathname === '/generate'}
              onClick={handleGenerateClick}
              theme={theme}
            >
              Generate Images
            </NavLink>
            <NavLink
              to="/storyline/new"
              icon={BookMarked}
              active={location.pathname.startsWith('/storyline/new') || location.pathname.startsWith('/storyline/result')}
              theme={theme}
            >
              Generate Storyline
            </NavLink>
            <NavLink
              to="/gallery"
              icon={Images}
              active={location.pathname === '/gallery'}
              theme={theme}
            >
              Gallery
            </NavLink>
            <NavLink
              to="/settings"
              icon={SettingsIconLucide}
              active={location.pathname === '/settings'}
              theme={theme}
            >
              Settings
            </NavLink>

            {/* Auth area */}
            {!loading && (
              <>
                {user ? (
                  /* ── User menu ──────────────────────────────────────── */
                  <div className="relative ml-2">
                    <button
                      onClick={() => setShowUserMenu(v => !v)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all"
                      style={{
                        background: theme.fieldBg,
                        border: `1px solid ${theme.fieldBorder}`,
                        color: theme.textBody,
                      }}
                    >
                      {/* Avatar or initials */}
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: theme.primaryGlow, color: theme.primary }}
                        >
                          {(profile?.display_name || user.email || '?')[0].toUpperCase()}
                        </div>
                      )}

                      {/* Tier badge */}
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wide"
                        style={{
                          background: tierColors.bg,
                          color: tierColors.text,
                          border: `1px solid ${tierColors.border}`,
                        }}
                      >
                        {tier?.display_name || 'Free'}
                      </span>

                      <ChevronDown className="w-3 h-3" style={{ color: theme.textMuted }} />
                    </button>

                    {showUserMenu && (
                      <>
                        {/* Backdrop */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />

                        {/* Dropdown */}
                        <div
                          className="absolute right-0 top-full mt-2 w-72 rounded-2xl p-4 z-50 shadow-2xl"
                          style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
                        >
                          {/* User info */}
                          <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}>
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                                style={{ background: theme.primaryGlow, color: theme.primary }}
                              >
                                {(profile?.display_name || user.email || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate" style={{ color: theme.textBody }}>
                                {profile?.display_name || 'User'}
                              </div>
                              <div className="text-xs truncate" style={{ color: theme.textMuted }}>
                                {user.email}
                              </div>
                            </div>
                          </div>

                          {/* Usage bars */}
                          <div className="space-y-3 mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}>
                            <UsageBar
                              label="Images this month"
                              used={imageUsed}
                              limit={imageLimit}
                              theme={theme}
                              tierColors={tierColors}
                            />
                            <UsageBar
                              label="Storylines this month"
                              used={storyUsed}
                              limit={storyLimit}
                              theme={theme}
                              tierColors={tierColors}
                            />
                          </div>

                          {/* Actions */}
                          <div className="space-y-1">
                            <MenuBtn
                              icon={<User className="w-4 h-4" />}
                              onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                              theme={theme}
                            >
                              Account Settings
                            </MenuBtn>
                            <MenuBtn
                              icon={<LogOut className="w-4 h-4" />}
                              onClick={handleSignOut}
                              theme={theme}
                              danger
                            >
                              Sign Out
                            </MenuBtn>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  /* ── Sign in button ─────────────────────────────────── */
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="ml-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                    style={{ background: theme.buttonGradient, color: 'white' }}
                  >
                    Sign In
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {progress && (
          <div
            onClick={progress.taskRoute ? () => navigate(progress.taskRoute) : undefined}
            style={{
              background: theme.cardBg,
              borderTop: `1px solid ${theme.fieldBorder}`,
              padding: '8px 16px',
              cursor: progress.taskRoute ? 'pointer' : 'default',
            }}
          >
            <div className="max-w-7xl mx-auto flex items-center gap-4">
              <span className="text-sm" style={{ color: theme.textMuted }}>
                {progress.total !== null
                  ? `${progress.label}: ${progress.current}/${progress.total}`
                  : progress.label
                }
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: theme.fieldBg }}>
                {progress.total !== null ? (
                  <div
                    style={{
                      background: theme.buttonGradient,
                      width: `${(progress.current / progress.total) * 100}%`,
                      height: '100%',
                      transition: 'width 0.3s ease',
                    }}
                  />
                ) : (
                  <div
                    className="h-full rounded-full"
                    style={{
                      background: theme.buttonGradient,
                      width: '40%',
                      animation: 'progressScan 1.6s ease-in-out infinite',
                    }}
                  />
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); stopProgress(clearProgress); }}
                className="px-3 py-1 text-xs rounded-lg hover:opacity-80 transition-opacity"
                style={{ background: '#d80032', color: 'white' }}
              >
                Stop
              </button>
            </div>
          </div>
        )}
      </nav>

      <main className="pt-16 min-h-screen relative z-10">
        {children}
      </main>

      {/* Auth modal (triggered from nav Sign In button) */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function NavLink({ to, icon: Icon, active, onClick, children, theme }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300"
      style={{
        background: active ? theme.primaryGlow : 'transparent',
        color: active ? theme.primary : theme.textMuted,
        boxShadow: active ? `0 0 20px ${theme.primaryGlow}` : 'none',
      }}
    >
      <Icon className="w-4 h-4" />
      <span className="text-sm">{children}</span>
    </Link>
  );
}

function UsageBar({ label, used, limit, theme, tierColors }) {
  const pct = limit ? Math.min((used / limit) * 100, 100) : 0;
  const atLimit = limit !== null && limit !== undefined && used >= limit;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: theme.textMuted }}>
        <span>{label}</span>
        <span style={{ color: atLimit ? '#f87171' : tierColors.text }}>
          {used}{limit !== null && limit !== undefined ? ` / ${limit}` : ' (unlimited)'}
        </span>
      </div>
      {limit !== null && limit !== undefined && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: theme.fieldBg }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: atLimit ? '#ef4444' : tierColors.text,
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuBtn({ icon, onClick, children, theme, danger = false }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:bg-white/5"
      style={{ color: danger ? '#f87171' : theme.textBody }}
    >
      {icon}
      {children}
    </button>
  );
}
