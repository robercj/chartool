import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import useGenerationQueueStore from '../lib/stores/generationQueueStore';
import { Images } from 'lucide-react';

export default function GenerationProgressBar() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const sessions = useGenerationQueueStore(s => s.sessions);
  const activeSessionId = useGenerationQueueStore(s => s.activeSessionId);

  const generating = sessions.some(s => s.jobs.some(j => j.status === 'queued' || j.status === 'generating'));
  const pending = sessions.flatMap(s => s.jobs).filter(j => j.status === 'queued' || j.status === 'generating').length;
  const complete = sessions.flatMap(s => s.jobs).filter(j => j.status === 'complete').length;
  const total = sessions.flatMap(s => s.jobs).length;
  const session = sessions.find(s => s.sessionId === activeSessionId) || null;

  const progress = session
    ? (() => {
        const done = session.jobs.filter(j => j.status === 'complete' || j.status === 'failed').length;
        const tot = session.jobs.length;
        return { complete: done, total: tot, percent: tot > 0 ? Math.round((done / tot) * 100) : 0 };
      })()
    : { complete: 0, total: 0, percent: 0 };

  if (!generating && complete === 0) return null;

  const isOnSessionPage = session && location.pathname === session.returnRoute;

  const label = complete === total && total > 0
    ? 'All images ready'
    : pending === 0 && complete > 0
    ? `${complete} of ${total} images ready`
    : `${complete} of ${total} images complete`;

  const handleClick = () => {
    if (!isOnSessionPage && session?.returnRoute) {
      navigate(session.returnRoute);
    }
  };

  return (
    <div
      className="fixed left-0 right-0 z-40 transition-all duration-300"
      style={{
        top: '64px',
        background: theme.cardBg,
        borderBottom: `1px solid ${theme.fieldBorder}`,
        padding: '6px 16px',
        opacity: 1,
      }}
    >
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <button
          onClick={handleClick}
          disabled={isOnSessionPage}
          className="flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1 transition-all"
          style={{
            background: isOnSessionPage ? theme.fieldBg : theme.primaryGlow,
            color: isOnSessionPage ? theme.textMuted : theme.primary,
            cursor: isOnSessionPage ? 'default' : 'pointer',
            border: `1px solid ${isOnSessionPage ? theme.fieldBorder : theme.primary}20`,
            minHeight: '28px',
          }}
          title={isOnSessionPage ? 'Already on this page' : `Click to view: ${session?.returnRoute}`}
        >
          <Images className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="whitespace-nowrap">{label}</span>
        </button>

        <div className="flex-1 h-1.5 bg-base-300 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress.percent}%`,
              background: complete === total && total > 0 ? theme.success || theme.primary : theme.primary,
            }}
          />
        </div>
      </div>
    </div>
  );
}
