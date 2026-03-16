import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { useTheme } from '../contexts/ThemeContext';
import { Sparkles } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const [showAuth, setShowAuth] = useState(true);

  // Still resolving session from Supabase
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

  // Authenticated — render the protected content
  if (user) return children;

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

      {showAuth && <AuthModal onClose={null} />}
    </>
  );
}
