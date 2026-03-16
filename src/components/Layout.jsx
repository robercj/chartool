import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, ImagePlus, Images, Settings as SettingsIconLucide,
  BookMarked, LogOut, User, ChevronDown, Menu, X,
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useProgress } from '../contexts/ProgressContext';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { Toaster } from 'sonner';

// ─── Tier badge colours ───────────────────────────────────────────────────────
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

// ─── Nav items definition ─────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/generate',      icon: ImagePlus,          label: 'Generate Images',   matchFn: (p) => p === '/generate' },
  { to: '/storyline/new', icon: BookMarked,          label: 'Generate Storyline',matchFn: (p) => p.startsWith('/storyline/new') || p.startsWith('/storyline/result') },
  { to: '/gallery',       icon: Images,              label: 'Gallery',           matchFn: (p) => p === '/gallery' || p.startsWith('/storyline?') || p.startsWith('/batch?') },
  { to: '/settings',      icon: SettingsIconLucide,  label: 'Settings',          matchFn: (p) => p === '/settings' },
];

export default function Layout({ children }) {
  const { theme, genreKey, setGenreKey, GENRES } = useTheme();
  const { progress, stopProgress, clearProgress } = useProgress();
  const { user, profile, tier, usage, signOut, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [showAuthModal, setShowAuthModal]   = useState(false);
  const [showUserMenu, setShowUserMenu]     = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const hamburgerRef  = useRef(null);
  const mobileNavRef  = useRef(null);
  const firstNavItem  = useRef(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileMenuOpen]);

  // Focus first nav item when drawer opens
  useEffect(() => {
    if (mobileMenuOpen) {
      // Small delay lets the drawer animate into view
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

  const handleGenerateClick = () => {
    setMobileMenuOpen(false);
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

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    hamburgerRef.current?.focus();
  };

  const optionBg = solidOptionBg(theme.cardBg);
  const optionText = (() => {
    const m = theme.textBody.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? `rgb(${m[1]}, ${m[2]}, ${m[3]})` : '#ced0df';
  })();

  const tierId      = tier?.id || 'free';
  const tierColors  = TIER_COLORS[tierId] || TIER_COLORS.free;

  const imageLimit  = tier?.monthly_image_limit;
  const storyLimit  = tier?.monthly_story_limit;
  const imageUsed   = usage?.image ?? 0;
  const storyUsed   = usage?.story ?? 0;

  return (
    <div
      style={{
        background:  theme.bg,
        fontFamily:  theme.fontFamily,
        minHeight:   '100vh',
        color:       theme.textBody,
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
              position:     'absolute',
              width:        500 + i * 200,
              height:       500 + i * 200,
              borderRadius: '50%',
              background:   `radial-gradient(circle, ${color} 0%, transparent 70%)`,
              opacity:      0.15 - i * 0.03,
              top:    i === 0 ? '-10%' : i === 1 ? 'auto' : '30%',
              bottom: i === 1 ? '-10%' : 'auto',
              left:   i === 2 ? '60%'  : i === 0 ? '-5%'  : 'auto',
              right:  i === 2 ? '-10%' : 'auto',
            }}
          />
        ))}
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav
        style={{
          background:      theme.navBg,
          backdropFilter:  'blur(24px)',
          borderBottom:    `1px solid ${theme.navBorder}`,
        }}
        className="fixed top-0 left-0 right-0 z-50"
        aria-label="Main navigation"
      >
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <Sparkles className="w-6 h-6 flex-shrink-0" style={{ color: theme.primary }} />
            <span
              style={{
                background:             theme.logoGradient,
                WebkitBackgroundClip:   'text',
                WebkitTextFillColor:    'transparent',
                backgroundClip:         'text',
              }}
              className="hidden sm:block font-bold text-lg whitespace-nowrap"
            >
              Character Forge
            </span>
          </div>

          {/* ── Desktop nav links (hidden on mobile) ── */}
          <div className="hidden md:flex items-center gap-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                icon={item.icon}
                active={item.matchFn(location.pathname)}
                onClick={item.to === '/generate' ? handleGenerateClick : undefined}
                theme={theme}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* ── Right side: user area + hamburger ── */}
          <div className="flex items-center gap-2">

            {/* Auth area — desktop always, mobile only when signed in (show avatar) */}
            {!loading && (
              <>
                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setShowUserMenu(v => !v)}
                      className="flex items-center gap-2 p-1.5 md:px-3 md:py-2 rounded-xl transition-all touch-min"
                      style={{
                        background: theme.fieldBg,
                        border:     `1px solid ${theme.fieldBorder}`,
                        color:      theme.textBody,
                        minHeight:  '44px',
                        minWidth:   '44px',
                      }}
                      aria-label="User menu"
                      aria-expanded={showUserMenu}
                      aria-haspopup="true"
                    >
                      {/* Avatar or initials */}
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: theme.primaryGlow, color: theme.primary }}
                        >
                          {(profile?.display_name || user.email || '?')[0].toUpperCase()}
                        </div>
                      )}

                      {/* Tier badge + chevron — desktop only */}
                      <span
                        className="hidden md:inline-block text-xs px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wide"
                        style={{
                          background: tierColors.bg,
                          color:      tierColors.text,
                          border:     `1px solid ${tierColors.border}`,
                        }}
                      >
                        {tier?.display_name || 'Free'}
                      </span>

                      <ChevronDown className="hidden md:block w-3 h-3 flex-shrink-0" style={{ color: theme.textMuted }} />
                    </button>

                    {showUserMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                        <div
                          className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl p-4 z-50 shadow-2xl"
                          style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
                        >
                          {/* User info */}
                          <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}>
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                              <div
                                className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
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
                            <UsageBar label="Images this month"    used={imageUsed} limit={imageLimit} theme={theme} tierColors={tierColors} />
                            <UsageBar label="Storylines this month" used={storyUsed} limit={storyLimit} theme={theme} tierColors={tierColors} />
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
                  /* Sign in — hidden on mobile (accessible via hamburger menu) */
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="hidden md:inline-flex items-center ml-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-90 touch-min"
                    style={{ background: theme.buttonGradient, color: 'white', minHeight: '44px' }}
                  >
                    Sign In
                  </button>
                )}
              </>
            )}

            {/* ── Hamburger button — mobile only ── */}
            <button
              ref={hamburgerRef}
              onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden flex items-center justify-center rounded-xl transition-all touch-min"
              style={{
                minWidth:   '44px',
                minHeight:  '44px',
                background: mobileMenuOpen ? theme.primaryGlow : 'transparent',
                color:      mobileMenuOpen ? theme.primary : theme.textMuted,
                border:     `1px solid ${mobileMenuOpen ? theme.primary : 'transparent'}`,
              }}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav-drawer"
            >
              {mobileMenuOpen
                ? <X    className="w-5 h-5" aria-hidden="true" />
                : <Menu className="w-5 h-5" aria-hidden="true" />
              }
            </button>
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
        {progress && (
          <div
            onClick={progress.taskRoute ? () => navigate(progress.taskRoute) : undefined}
            style={{
              background: theme.cardBg,
              borderTop:  `1px solid ${theme.fieldBorder}`,
              padding:    '8px 16px',
              cursor:     progress.taskRoute ? 'pointer' : 'default',
            }}
          >
            <div className="max-w-7xl mx-auto flex items-center gap-3">
              <span className="text-xs flex-shrink-0 min-w-0 truncate" style={{ color: theme.textMuted, maxWidth: '60%' }}>
                {progress.total !== null
                  ? `${progress.label}: ${progress.current}/${progress.total}`
                  : progress.label
                }
              </span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: theme.fieldBg }}>
                {progress.total !== null ? (
                  <div
                    style={{
                      background:  theme.buttonGradient,
                      width:       `${(progress.current / progress.total) * 100}%`,
                      height:      '100%',
                      transition:  'width 0.3s ease',
                    }}
                  />
                ) : (
                  <div
                    className="h-full rounded-full"
                    style={{
                      background:  theme.buttonGradient,
                      width:       '40%',
                      animation:   'progressScan 1.6s ease-in-out infinite',
                    }}
                  />
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); stopProgress(clearProgress); }}
                className="flex-shrink-0 px-3 py-1 text-xs rounded-lg hover:opacity-80 transition-opacity touch-min"
                style={{ background: '#d80032', color: 'white', minHeight: '32px' }}
              >
                Stop
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Mobile Nav Drawer ────────────────────────────────────────────────── */}
      {/*
        Slides down from below the nav bar on mobile.
        Covers full width, z-index below the nav so the nav stays on top.
        will-change: transform applied via .mobile-nav-drawer CSS class.
      */}
      <div
        id="mobile-nav-drawer"
        ref={mobileNavRef}
        className="mobile-nav-drawer md:hidden fixed left-0 right-0 z-40 transition-transform duration-300"
        style={{
          top:        '64px',   /* nav height */
          background: theme.navBg,
          backdropFilter: 'blur(24px)',
          borderBottom: `1px solid ${theme.navBorder}`,
          transform:  mobileMenuOpen ? 'translateY(0)' : 'translateY(-110%)',
          paddingBottom: `calc(var(--safe-bottom) + 0.5rem)`,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Main navigation"
        aria-hidden={!mobileMenuOpen}
      >
        <div className="px-4 py-3 space-y-1">

          {/* User identity row — shown in drawer when signed in (replaces hidden top-bar info) */}
          {!loading && user && (
            <div
              className="flex items-center gap-3 px-4 py-3 mb-1 rounded-xl"
              style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
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
                <div className="text-xs truncate" style={{ color: theme.textMuted }}>
                  {user.email}
                </div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-md font-medium uppercase tracking-wide flex-shrink-0"
                style={{
                  background: tierColors.bg,
                  color:      tierColors.text,
                  border:     `1px solid ${tierColors.border}`,
                }}
              >
                {tier?.display_name || 'Free'}
              </span>
            </div>
          )}

          {NAV_ITEMS.map((item, idx) => {
            const isActive = item.matchFn(location.pathname);
            const isGenerate = item.to === '/generate';
            return (
              <Link
                key={item.to}
                ref={idx === 0 ? firstNavItem : undefined}
                to={item.to}
                onClick={isGenerate ? handleGenerateClick : closeMobileMenu}
                tabIndex={mobileMenuOpen ? 0 : -1}
                className="flex items-center gap-3 px-4 rounded-xl transition-all duration-200 touch-min"
                style={{
                  minHeight:  '52px',
                  background: isActive ? theme.primaryGlow : 'transparent',
                  color:      isActive ? theme.primary : theme.textBody,
                  boxShadow:  isActive ? `0 0 16px ${theme.primaryGlow}` : 'none',
                }}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* Sign in — only shown in mobile drawer when not logged in */}
          {!loading && !user && (
            <button
              onClick={() => { closeMobileMenu(); setShowAuthModal(true); }}
              tabIndex={mobileMenuOpen ? 0 : -1}
              className="w-full flex items-center justify-center gap-2 px-4 rounded-xl font-medium transition-all touch-min mt-2"
              style={{
                minHeight:  '52px',
                background: theme.buttonGradient,
                color:      'white',
              }}
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* ── Backdrop for mobile menu ──────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          style={{ top: '64px' }}
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      {/* ── Page content ──────────────────────────────────────────────────── */}
      <main className="pt-16 min-h-screen relative z-10 scroll-anchor">
        {children}
      </main>

      {/* Auth modal */}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavLink({ to, icon: Icon, active, onClick, children, theme }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 touch-min"
      style={{
        minHeight:  '44px',
        background: active ? theme.primaryGlow : 'transparent',
        color:      active ? theme.primary : theme.textMuted,
        boxShadow:  active ? `0 0 20px ${theme.primaryGlow}` : 'none',
      }}
      aria-current={active ? 'page' : undefined}
    >
      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm whitespace-nowrap">{children}</span>
    </Link>
  );
}

function UsageBar({ label, used, limit, theme, tierColors }) {
  const pct     = limit ? Math.min((used / limit) * 100, 100) : 0;
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
              width:      `${pct}%`,
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
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all hover:bg-white/5 touch-min"
      style={{ color: danger ? '#f87171' : theme.textBody, minHeight: '44px' }}
    >
      {icon}
      {children}
    </button>
  );
}
