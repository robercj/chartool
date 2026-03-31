// ─── GenerationProgressBar.jsx ────────────────────────────────────────────────
// Queue-aware aggregate progress bar displayed in the Layout navbar area.
// Reads all sessions from the Zustand queue store and shows a combined
// progress indicator (e.g. "3/10 images complete"). Clickable — navigates to
// the /queue page for detailed per-job controls.
//
// Auto-hides when no jobs are pending (all complete/failed or empty queue).
// ─────────────────────────────────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import useGenerationQueueStore from '../lib/stores/generationQueueStore';
import { Images } from 'lucide-react';

export default function GenerationProgressBar() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const sessions = useGenerationQueueStore(s => s.sessions);

  const allJobs = sessions.flatMap(s => s.jobs);
  const pending = allJobs.filter(j => j.status === 'queued' || j.status === 'generating').length;
  const complete = allJobs.filter(j => j.status === 'complete').length;
  const failed = allJobs.filter(j => j.status === 'failed').length;
  const total = allJobs.length;

  if (total === 0 || pending === 0) return null;

  const percent = total > 0 ? Math.round(((complete + failed) / total) * 100) : 0;

  const label = sessions.length === 1
    ? (pending === 0
      ? `${complete}/${total} images ready${failed > 0 ? ` (${failed} failed)` : ''}`
      : `${complete}/${total} images complete`)
    : `${sessions.length} sessions • ${complete}/${total} ready${failed > 0 ? ` (${failed} failed)` : ''}`;

  const handleClick = () => {
    navigate('/queue');
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
          className="flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1 transition-all"
          style={{
            background: theme.primaryGlow,
            color: theme.primary,
            cursor: 'pointer',
            border: `1px solid ${theme.primary}20`,
            minHeight: '28px',
          }}
          title="Click to view queue"
        >
          <Images className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="whitespace-nowrap">{label}</span>
        </button>

        <div className="flex-1 h-1.5 bg-base-300 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${percent}%`,
              background: pending === 0 && total > 0
                ? (failed > 0 ? theme.error || '#ef4444' : theme.success || theme.primary)
                : theme.primary,
            }}
          />
        </div>
      </div>
    </div>
  );
}
