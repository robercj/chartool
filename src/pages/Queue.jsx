import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { 
  ListOrdered, Clock, CheckCircle, XCircle, Loader2, 
  RefreshCw, Trash2, ArrowRight, Image as ImageIcon, X,
  AlertCircle
} from 'lucide-react';
import useGenerationQueueStore from '../lib/stores/generationQueueStore';

export default function QueuePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const sessions = useGenerationQueueStore(s => s.sessions);
  const clearSession = useGenerationQueueStore(s => s.clearSession);
  const clearAllSessions = useGenerationQueueStore(s => s.clearAllSessions);
  const retryJob = useGenerationQueueStore(s => s.retryJob);
  const retryAllFailedInSession = useGenerationQueueStore(s => s.retryAllFailedInSession);

  const [confirmClearSession, setConfirmClearSession] = useState(null);

  const sessionsByCharacter = useMemo(() => {
    const grouped = {};
    sessions.forEach(session => {
      session.jobs.forEach(job => {
        const charKey = job.contextId;
        if (!grouped[charKey]) {
          grouped[charKey] = {
            characterId: charKey,
            characterName: job.characterName,
            thumbnailUrl: job.thumbnailUrl,
            sessionId: session.sessionId,
            jobs: [],
          };
        }
        grouped[charKey].jobs.push(job);
      });
    });
    return Object.values(grouped);
  }, [sessions]);

  const totalPending = sessions.flatMap(s => s.jobs).filter(j => j.status === 'queued' || j.status === 'generating').length;
  const totalComplete = sessions.flatMap(s => s.jobs).filter(j => j.status === 'complete').length;
  const totalFailed = sessions.flatMap(s => s.jobs).filter(j => j.status === 'failed').length;

  const handleClearSession = (sessionId) => {
    if (confirmClearSession === sessionId) {
      clearSession(sessionId);
      setConfirmClearSession(null);
    } else {
      setConfirmClearSession(sessionId);
      setTimeout(() => setConfirmClearSession(null), 3000);
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Clear all sessions from the queue? This cannot be undone.')) {
      clearAllSessions();
      toast.success('Queue cleared');
    }
  };

  const handleRetry = async (sessionId, jobId) => {
    try {
      await retryJob(sessionId, jobId);
    } catch {
      toast.error('Failed to retry job');
    }
  };

  const handleRetryAllFailed = async (sessionId) => {
    try {
      await retryAllFailedInSession(sessionId);
    } catch {
      toast.error('Failed to retry jobs');
    }
  };

  const handleViewCharacter = (characterId) => {
    navigate(`/characters/${characterId}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <p className="text-base-content/50">Please sign in to view your queue.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-base-content flex items-center gap-3">
              <ListOrdered className="w-8 h-8 text-primary" />
              Generation Queue
            </h1>
            <p className="text-base-content/60 mt-1">
              Track your image generation progress across all characters
            </p>
          </div>
          {sessions.length > 0 && (
            <button
              onClick={handleClearAll}
              className="btn btn-ghost btn-sm gap-2 text-error"
              style={{ minHeight: '44px' }}
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>

        {/* Summary stats */}
        {sessions.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard 
              label="Sessions" 
              value={sessions.length} 
              icon={<ListOrdered className="w-5 h-5" />}
              color="primary"
            />
            <StatCard 
              label="Pending" 
              value={totalPending} 
              icon={<Loader2 className="w-5 h-5 animate-spin" />}
              color="warning"
            />
            <StatCard 
              label="Complete" 
              value={totalComplete} 
              icon={<CheckCircle className="w-5 h-5" />}
              color="success"
            />
            <StatCard 
              label="Failed" 
              value={totalFailed} 
              icon={<XCircle className="w-5 h-5" />}
              color="error"
            />
          </div>
        )}

        {/* Empty state */}
        {sessions.length === 0 && (
          <div className="text-center py-20">
            <ListOrdered className="w-20 h-20 text-base-content/10 mx-auto mb-4" />
            <h2 className="text-xl font-medium text-base-content mb-2">Queue is empty</h2>
            <p className="text-base-content/50 mb-6">
              Start generating images to see them appear here
            </p>
            <button
              onClick={() => navigate('/sprites/generate')}
              className="btn btn-primary gap-2"
              style={{ minHeight: '44px' }}
            >
              <ImageIcon className="w-5 h-5" />
              Generate Sprites
            </button>
          </div>
        )}

        {/* Session list */}
        <div className="space-y-4">
          {sessionsByCharacter.map((charGroup) => {
            const pending = charGroup.jobs.filter(j => j.status === 'queued' || j.status === 'generating').length;
            const complete = charGroup.jobs.filter(j => j.status === 'complete').length;
            const failed = charGroup.jobs.filter(j => j.status === 'failed').length;
            const total = charGroup.jobs.length;
            const percent = total > 0 ? Math.round(((complete + failed) / total) * 100) : 0;
            
            const statusText = pending > 0 
              ? `Generating ${pending}/${total}`
              : failed > 0 && complete === 0
              ? `Failed — ${failed} of ${total}`
              : failed > 0
              ? `${complete} ready, ${failed} failed`
              : 'Complete';

            const statusColor = pending > 0 
              ? 'text-warning' 
              : failed > 0 
              ? 'text-error' 
              : 'text-success';

            return (
              <div 
                key={charGroup.characterId}
                className="card bg-base-200 border border-base-300 overflow-hidden"
              >
                {/* Card header */}
                <div className="flex items-center gap-4 p-4 border-b border-base-300">
                  {/* Thumbnail */}
                  <div className="w-16 h-16 bg-base-300 rounded-xl flex-shrink-0 overflow-hidden">
                    {charGroup.thumbnailUrl ? (
                      <img 
                        src={charGroup.thumbnailUrl} 
                        alt={charGroup.characterName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-base-content/30" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base-content truncate">
                        {charGroup.characterName}
                      </h3>
                      <button
                        onClick={() => handleViewCharacter(charGroup.characterId)}
                        className="btn btn-ghost btn-xs btn-square"
                        title="View character"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div className={`text-sm ${statusColor} flex items-center gap-1.5 mt-0.5`}>
                      {pending > 0 && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {pending === 0 && failed > 0 && <AlertCircle className="w-3.5 h-3.5" />}
                      {pending === 0 && failed === 0 && <CheckCircle className="w-3.5 h-3.5" />}
                      {statusText}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-base-300 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percent}%`,
                            background: pending > 0 ? 'var(--p)' : (failed > 0 ? 'var(--er)' : 'var(--su)'),
                          }}
                        />
                      </div>
                      <span className="text-xs text-base-content/50 w-12 text-right">
                        {percent}%
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {failed > 0 && (
                      <button
                        onClick={() => handleRetryAllFailed(charGroup.sessionId)}
                        className="btn btn-warning btn-sm gap-1"
                        title="Retry all failed"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry All
                      </button>
                    )}
                    <button
                      onClick={() => handleClearSession(charGroup.sessionId)}
                      className={`btn btn-sm gap-1 ${confirmClearSession === charGroup.sessionId ? 'btn-error' : 'btn-ghost'}`}
                      title={confirmClearSession === charGroup.sessionId ? 'Click again to confirm' : 'Clear session'}
                    >
                      {confirmClearSession === charGroup.sessionId ? (
                        <>
                          <X className="w-3.5 h-3.5" />
                          Confirm
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5" />
                          Clear
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Job thumbnails */}
                <div className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {charGroup.jobs.map((job) => (
                      <JobThumbnail
                        key={job.jobId}
                        job={job}
                        onRetry={() => handleRetry(charGroup.sessionId, job.jobId)}
                        onClick={() => job.status === 'complete' && handleViewCharacter(charGroup.characterId)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    error: 'bg-error/10 text-error border-error/20',
  };

  return (
    <div className={`card p-4 border ${colorMap[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function JobThumbnail({ job, onRetry, onClick }) {
  const statusIcon = {
    queued: <Clock className="w-4 h-4 text-base-content/40" />,
    generating: <Loader2 className="w-4 h-4 text-warning animate-spin" />,
    complete: <CheckCircle className="w-4 h-4 text-success" />,
    failed: <XCircle className="w-4 h-4 text-error" />,
  };

  const borderColor = {
    queued: 'border-base-300',
    generating: 'border-warning/50',
    complete: 'border-success/50',
    failed: 'border-error/50',
  };

  return (
    <button
      onClick={job.status === 'complete' ? onClick : (job.status === 'failed' ? onRetry : undefined)}
      className={`relative w-20 h-20 rounded-lg border-2 overflow-hidden bg-base-300 transition-all
        ${job.status === 'complete' ? 'cursor-pointer hover:border-success hover:scale-105' : ''}
        ${job.status === 'failed' ? 'cursor-pointer hover:border-error hover:scale-105' : ''}
        ${borderColor[job.status] || 'border-base-300'}`}
      title={
        job.status === 'complete' ? 'Click to view in gallery' :
        job.status === 'failed' ? `Failed: ${job.errorMessage || 'Unknown error'} - Click to retry` :
        job.status === 'generating' ? 'Generating...' : 'Queued'
      }
    >
      {/* Image */}
      {job.imageUrl ? (
        <img 
          src={job.imageUrl} 
          alt={job.label || 'Generated image'}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-base-content/30" />
        </div>
      )}

      {/* Status overlay */}
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
        {statusIcon[job.status]}
      </div>

      {/* Retry indicator for failed */}
      {job.status === 'failed' && (
        <div className="absolute -top-1 -right-1 bg-error rounded-full p-0.5">
          <RefreshCw className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}
