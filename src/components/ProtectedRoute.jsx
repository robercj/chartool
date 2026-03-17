import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { useTheme } from '../contexts/ThemeContext';
import { Sparkles } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  // Already authenticated — always render children immediately, even if profile
  // is reloading in the background. This prevents in-flight work (image gen,
  // finalization) from being destroyed by a token refresh on tab focus.
  if (user) return children;

  // Still resolving session from Supabase on initial load
  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[60vh]"
        style={{ color: theme.textMuted }}
      >
        <div className="flex flex-col items-center gap-3">
          <Sparkles className="w-8 h-8 animate-pulse" style={{ color: theme.primary }} />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  // Not authenticated — show auth modal over a blurred placeholder
  return (
    <>
      {/* Blurred background placeholder */}
      <div className="min-h-[60vh] flex items-center justify-center" style={{ filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }}>
        <div className="text-center opacity-30">
          <Sparkles className="w-16 h-16 mx-auto mb-4" style={{ color: theme.primary }} />
          <p className="text-lg font-medium" style={{ color: theme.textBody }}>Character Forge</p>
        </div>
      </div>

      <AuthModal onClose={null} />
    </>
  );
}
