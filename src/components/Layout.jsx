import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, ImagePlus, Images, Settings as SettingsIconLucide,
  BookMarked, LogOut, User, ChevronDown, Menu, X, ListOrdered,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useProgress } from '../contexts/ProgressContext';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import GenerationProgressBar from './GenerationProgressBar';
import { Toaster } from 'sonner';

// ─── Tier badge DaisyUI colour mapping ───────────────────────────────────────
const TIER_BADGE = {
  free:       'badge-ghost',
  pro:        'badge-info',
  enterprise: 'badge-warning',
};

// ─── Nav items definition ─────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/sprites/generate',    icon: ImagePlus,         label: 'Generate Sprites',   matchFn: (p) => p === '/sprites/generate' },
  { to: '/characters/generate', icon: Sparkles,          label: 'Generate Character', matchFn: (p) => p.startsWith('/characters') },
  { to: '/storyline/new',       icon: BookMarked,        label: 'Generate Storyline', matchFn: (p) => p.startsWith('/storyline/new') || p.startsWith('/storyline/result') },
  { to: '/queue',              icon: ListOrdered,        label: 'Queue',             matchFn: (p) => p === '/queue' },
  { to: '/gallery',             icon: Images,            label: 'Gallery',            matchFn: (p) => p === '/gallery' || p.startsWith('/storyline?') || p.startsWith('/batch?') },
  { to: '/settings',            icon: SettingsIconLucide, label: 'Settings',          matchFn: (p) => p === '/settings' },
];

export default function Layout({ children }) {
  const { theme } = useTheme();
  const { progress, stopProgress, clearProgress } = useProgress();
  const { user, profile, tier, usage, signOut, loading } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hamburgerRef = useRef(null);
  const mobileNavRef = useRef(null);
  const firstNavItem = useRef(null);

  // Close mobile menu on route change — runs after navigation completes
  useEffect(() => {
    const id = requestAnimationFrame(() => setMobileMenuOpen(false));
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') { setMobileMenuOpen(false); hamburgerRef.current?.focus(); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileMenuOpen]);

  // Focus first nav item when drawer opens
  useEffect(() => {
    if (mobileMenuOpen) {
      const t = setTimeout(() => firstNavItem.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [mobileMenuOpen]);

  // Trap focus inside mobile drawer when open
  useEffect(() => {
    if (!mobileMenuOpen || !mobileNavRef.current) return;
    const focusable = mobileNavRef.current.querySelectorAll(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];
    const handler = (e) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    hamburgerRef.current?.focus();
  };

  const tierId     = tier?.id || 'free';
  const tierBadge  = TIER_BADGE[tierId] || 'badge-ghost';

  const imageLimit     = tier?.monthly_image_limit;
  const storyLimit     = tier?.monthly_story_limit;
  const characterLimit = tier?.monthly_character_limit;
  const imageUsed      = usage?.image ?? 0;
  const storyUsed      = usage?.story ?? 0;
  const characterUsed  = usage?.character ?? 0;

  return (
    <div
      data-theme="chartool"
      style={{
        background: theme.bg,
        fontFamily: theme.fontFamily,
        minHeight:  '100vh',
        color:      theme.textBody,
      }}
    >
      <Toaster position="top-right" theme="dark" />

      {/* Ambient orbs — purely decorative */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        {theme.orbs.map((orb, i) => (
          <div
            key={i}
            style={{
              position:     'absolute',
              width:        orb.size,
              height:       orb.size,
              borderRadius: '50%',
              background:   `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
              opacity:      orb.opacity,
              top:          orb.top    ?? 'auto',
              bottom:       orb.bottom ?? 'auto',
              left:         orb.left   ?? 'auto',
              right:        orb.right  ?? 'auto',
            }}
          />
        ))}
      </div>

      {/* ── DaisyUI Navbar ─────────────────────────────────────────────────── */}
      <div
        className="navbar fixed top-0 left-0 right-0 z-50 px-4 h-16 min-h-[4rem]"
        style={{
          background:     theme.navBg,
          backdropFilter: 'blur(24px)',
          borderBottom:   `1px solid ${theme.navBorder}`,
        }}
      >
        {/* Hamburger — mobile only */}
        <div className="navbar-start gap-2">
          <button
            ref={hamburgerRef}
            onClick={() => setMobileMenuOpen(v => !v)}
            className="btn btn-ghost btn-square md:hidden"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-nav-drawer"
          >
            {mobileMenuOpen
              ? <X    className="w-5 h-5" aria-hidden="true" />
              : <Menu className="w-5 h-5" aria-hidden="true" />
            }
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 no-underline" style={{ color: theme.textBody }}>
            <Sparkles className="w-6 h-6 flex-shrink-0" style={{ color: theme.primary }} />
            <span
              className="hidden sm:block font-bold text-lg whitespace-nowrap"
              style={{
                background:           theme.logoGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor:  'transparent',
                backgroundClip:       'text',
              }}
            >
              Character Forge
            </span>
          </Link>
        </div>

        {/* Desktop nav links */}
        <div className="navbar-center hidden md:flex">
          <ul className="menu menu-horizontal gap-1 p-0">
            {NAV_ITEMS.map((item) => {
              const isActive = item.matchFn(location.pathname);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    state={item.to === '/sprites/generate' && location.pathname === '/sprites/generate' ? { reset: 'reset' } : undefined}
                    className="rounded-xl flex items-center gap-2 text-sm font-medium transition-all"
                    style={{
                      minHeight:  '44px',
                      background: isActive ? theme.primaryGlow : 'transparent',
                      color:      isActive ? theme.primary : theme.textMuted,
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="w-4 h-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right side: user / sign-in */}
        <div className="navbar-end gap-2">
          {!loading && (
            <>
              {user ? (
                <div className="dropdown dropdown-end">
                  <div
                    tabIndex={0}
                    role="button"
                    className="btn btn-ghost flex items-center gap-2 px-2 md:px-3"
                    style={{ minHeight: '44px', minWidth: '44px' }}
                    aria-label="User menu"
                  >
                    {/* Avatar */}
                    {profile?.avatar_url ? (
                      <div className="avatar">
                        <div className="w-7 rounded-full">
                          <img src={profile.avatar_url} alt="" />
                        </div>
                      </div>
                    ) : (
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: theme.primaryGlow, color: theme.primary }}
                      >
                        {(profile?.display_name || user.email || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <span className={`badge ${tierBadge} hidden md:inline-flex text-xs uppercase tracking-wide`}>
                      {tier?.display_name || 'Free'}
                    </span>
                    <ChevronDown className="hidden md:block w-3 h-3 flex-shrink-0 opacity-60" />
                  </div>

                  {/* DaisyUI dropdown menu */}
                  <div
                    tabIndex={0}
                    className="dropdown-content card card-compact z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] shadow-2xl"
                    style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
                  >
                    <div className="card-body gap-4">
                      {/* User info */}
                      <div className="flex items-center gap-3 pb-3" style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}>
                        {profile?.avatar_url ? (
                          <div className="avatar">
                            <div className="w-10 rounded-full">
                              <img src={profile.avatar_url} alt="" />
                            </div>
                          </div>
                        ) : (
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
                            style={{ background: theme.primaryGlow, color: theme.primary }}
                          >
                            {(profile?.display_name || user.email || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate" style={{ color: theme.textBody }}>
                            {profile?.display_name || 'User'}
                          </div>
                          <div className="text-xs truncate opacity-60" style={{ color: theme.textMuted }}>
                            {user.email}
                          </div>
                        </div>
                      </div>

                      {/* Usage bars */}
                      <div className="space-y-3 pb-3" style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}>
                        <UsageBar label="Images this month"     used={imageUsed}     limit={imageLimit}     theme={theme} />
                        <UsageBar label="Characters this month" used={characterUsed} limit={characterLimit} theme={theme} />
                        <UsageBar label="Storylines this month" used={storyUsed}     limit={storyLimit}     theme={theme} />
                      </div>

                      {/* Actions */}
                      <div className="space-y-1">
                        <button
                          onClick={() => navigate('/settings')}
                          className="btn btn-ghost btn-sm btn-block justify-start gap-2"
                          style={{ minHeight: '44px', color: theme.textBody }}
                        >
                          <User className="w-4 h-4" />
                          Account Settings
                        </button>
                        <button
                          onClick={handleSignOut}
                          className="btn btn-ghost btn-sm btn-block justify-start gap-2 text-error"
                          style={{ minHeight: '44px' }}
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="btn btn-primary btn-sm hidden md:inline-flex"
                  style={{ minHeight: '44px' }}
                >
                  Sign In
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Progress bar — sub-row below navbar ────────────────────────────── */}
      {progress && (
        <div
          onClick={progress.taskRoute ? () => navigate(progress.taskRoute) : undefined}
          className="fixed left-0 right-0 z-40"
          style={{
            top:        '64px',
            background: theme.cardBg,
            borderBottom: `1px solid ${theme.fieldBorder}`,
            padding:    '8px 16px',
            cursor:     progress.taskRoute ? 'pointer' : 'default',
          }}
        >
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <span className="text-xs flex-shrink-0 truncate opacity-70" style={{ maxWidth: '55%', color: theme.textMuted }}>
              {progress.total !== null
                ? `${progress.label}: ${progress.current}/${progress.total}`
                : progress.label
              }
            </span>
            <progress
              className="progress progress-primary flex-1 h-2"
              value={progress.total !== null ? (progress.current / progress.total) * 100 : undefined}
              max={100}
            />
            <button
              onClick={(e) => { e.stopPropagation(); stopProgress(clearProgress); }}
              className="btn btn-error btn-xs flex-shrink-0 touch-min"
              style={{ minHeight: '32px' }}
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* ── Generation queue progress bar ─────────────────────────────────────── */}
      <GenerationProgressBar />

      {/* ── Mobile Nav Drawer ──────────────────────────────────────────────── */}
      <div
        id="mobile-nav-drawer"
        ref={mobileNavRef}
        className="mobile-nav-drawer md:hidden fixed left-0 right-0 z-40 transition-transform duration-300"
        style={{
          top:          '64px',
          background:   theme.navBg,
          backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${theme.navBorder}`,
          transform:    mobileMenuOpen ? 'translateY(0)' : 'translateY(-110%)',
          paddingBottom: `calc(var(--safe-bottom) + 0.5rem)`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        aria-hidden={!mobileMenuOpen}
      >
        <div className="px-4 py-3">

          {/* User identity row */}
          {!loading && user && (
            <div
              className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl"
              style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
            >
              {profile?.avatar_url ? (
                <div className="avatar">
                  <div className="w-8 rounded-full">
                    <img src={profile.avatar_url} alt="" />
                  </div>
                </div>
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: theme.primaryGlow, color: theme.primary }}
                >
                  {(profile?.display_name || user.email || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: theme.textBody }}>
                  {profile?.display_name || 'User'}
                </div>
                <div className="text-xs truncate opacity-60" style={{ color: theme.textMuted }}>
                  {user.email}
                </div>
              </div>
              <span className={`badge ${tierBadge} text-xs uppercase tracking-wide flex-shrink-0`}>
                {tier?.display_name || 'Free'}
              </span>
            </div>
          )}

          {/* Nav links */}
          <ul className="menu w-full p-0 gap-1">
            {NAV_ITEMS.map((item, idx) => {
              const isActive = item.matchFn(location.pathname);
              const isGenerate = item.to === '/sprites/generate';
              return (
                <li key={item.to}>
                  <Link
                    ref={idx === 0 ? firstNavItem : undefined}
                    to={item.to}
                    state={isGenerate && location.pathname === '/sprites/generate' ? { reset: 'reset' } : undefined}
                    onClick={closeMobileMenu}
                    tabIndex={mobileMenuOpen ? 0 : -1}
                    className="rounded-xl flex items-center gap-3 font-medium transition-all"
                    style={{
                      minHeight:  '52px',
                      background: isActive ? theme.primaryGlow : 'transparent',
                      color:      isActive ? theme.primary : theme.textBody,
                    }}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Sign in — only when signed out */}
          {!loading && !user && (
            <button
              onClick={() => { closeMobileMenu(); setShowAuthModal(true); }}
              tabIndex={mobileMenuOpen ? 0 : -1}
              className="btn btn-primary btn-block mt-2"
              style={{ minHeight: '52px' }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          style={{ top: '64px' }}
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main
        className="relative z-10 scroll-anchor"
        style={{ paddingTop: '64px', minHeight: '100vh' }}
      >
        {children}
      </main>

      {/* Auth modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

// ─── UsageBar sub-component ───────────────────────────────────────────────────
function UsageBar({ label, used, limit, theme }) {
  const pct     = limit ? Math.min((used / limit) * 100, 100) : 0;
  const atLimit = limit !== null && limit !== undefined && used >= limit;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1 opacity-70" style={{ color: theme.textMuted }}>
        <span>{label}</span>
        <span className={atLimit ? 'text-error' : ''}>
          {used}{limit !== null && limit !== undefined ? ` / ${limit}` : ' (unlimited)'}
        </span>
      </div>
      {limit !== null && limit !== undefined && (
        <progress
          className={`progress w-full h-1.5 ${atLimit ? 'progress-error' : 'progress-primary'}`}
          value={pct}
          max={100}
        />
      )}
    </div>
  );
}
