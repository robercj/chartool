import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Sparkles, Plus, Clock, Check, ChevronRight, Trash2, Image } from 'lucide-react';
import { Character, CharacterDraft } from '../lib/storage';

export default function CharacterListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [drafts,     setDrafts]     = useState([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [activeTab,  setActiveTab]  = useState('characters');

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      try {
        const [chars, drfts] = await Promise.all([
          Character.list(user.id),
          CharacterDraft.list(user.id),
        ]);
        setCharacters(chars);
        setDrafts(drfts);
      } catch (error) {
        console.error('Failed to load characters:', error);
        toast.error('Failed to load characters');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [user]);

  const handleDeleteDraft = async (draftId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this draft?')) return;
    try {
      await CharacterDraft.delete(draftId);
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      toast.success('Draft deleted');
    } catch (error) {
      console.error('Failed to delete draft:', error);
      toast.error('Failed to delete draft');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-base-content flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              Characters
            </h1>
            <p className="text-base-content/60 mt-1">
              Manage your created characters and drafts
            </p>
          </div>
          <button
            onClick={() => navigate('/characters/generate')}
            className="btn btn-primary gap-2"
            style={{ minHeight: '44px' }}
          >
            <Plus className="w-5 h-5" />
            New Character
          </button>
        </div>

        {/* Tabs — DaisyUI tab component */}
        <div role="tablist" className="tabs tabs-bordered mb-6">
          <button
            role="tab"
            onClick={() => setActiveTab('characters')}
            className={`tab tab-bordered ${activeTab === 'characters' ? 'tab-active text-primary' : ''}`}
          >
            Finalized ({characters.length})
          </button>
          <button
            role="tab"
            onClick={() => setActiveTab('drafts')}
            className={`tab tab-bordered ${activeTab === 'drafts' ? 'tab-active text-primary' : ''}`}
          >
            Drafts ({drafts.length})
          </button>
        </div>

        {/* Finalized characters */}
        {activeTab === 'characters' && (
          characters.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="w-16 h-16 text-base-content/20 mx-auto mb-4" />}
              title="No characters yet"
              description="Create your first character to get started"
              onAction={() => navigate('/characters/generate')}
              actionLabel="Create Character"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {characters.map(char => (
                <Link
                  key={char.id}
                  to={`/characters/${char.id}`}
                  className="card bg-base-200 border border-base-300 overflow-hidden hover:border-primary/40 transition-colors group no-underline"
                >
                  <figure className="aspect-[3/4] bg-base-300 relative">
                    {char.generated_image_url ? (
                      <img
                        src={char.generated_image_url}
                        alt={char.character_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-12 h-12 text-base-content/20" />
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className="badge badge-success gap-1">
                        <Check className="w-3 h-3" />
                        Finalized
                      </span>
                    </div>
                  </figure>
                  <div className="card-body p-4 gap-1">
                    <h3 className="card-title text-base group-hover:text-primary transition-colors">
                      {char.character_name || 'Unnamed Character'}
                    </h3>
                    <p className="text-sm text-base-content/60">
                      {char.archetype || char.character_role || 'Character'}
                    </p>
                    <p className="text-xs text-base-content/40 mt-1">
                      Created {formatDistanceToNow(new Date(char.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Drafts */}
        {activeTab === 'drafts' && (
          drafts.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-16 h-16 text-base-content/20 mx-auto mb-4" />}
              title="No drafts"
              description="Start creating a character to save drafts"
              onAction={() => navigate('/characters/generate')}
              actionLabel="Create Character"
            />
          ) : (
            <div className="space-y-3">
              {drafts.map(draft => (
                <Link
                  key={draft.id}
                  to={`/characters/generate/${draft.id}`}
                  className="flex items-center gap-4 p-4 card bg-base-200 border border-base-300 hover:border-primary/40 transition-colors group no-underline"
                >
                  <div className="w-16 h-16 bg-base-300 rounded-xl flex-shrink-0 overflow-hidden">
                    {draft.generated_image_url ? (
                      <img
                        src={draft.generated_image_url}
                        alt={draft.character_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-base-content/20" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base-content group-hover:text-primary transition-colors truncate">
                      {draft.character_name || 'Untitled Draft'}
                    </h3>
                    <p className="text-sm text-base-content/60 truncate">
                      {draft.archetype || draft.character_role || 'Character in progress'}
                    </p>
                    <p className="text-xs text-base-content/40 mt-1">
                      Last modified {formatDistanceToNow(new Date(draft.last_modified_at), { addSuffix: true })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteDraft(draft.id, e)}
                      className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10"
                      aria-label="Delete draft"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-base-content/30 group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─── Empty state helper ───────────────────────────────────────────────────────
function EmptyState({ icon, title, description, onAction, actionLabel }) {
  return (
    <div className="text-center py-16">
      {icon}
      <h3 className="text-xl font-medium text-base-content mb-2">{title}</h3>
      <p className="text-base-content/50 mb-6">{description}</p>
      <button
        onClick={onAction}
        className="btn btn-primary gap-2"
        style={{ minHeight: '44px' }}
      >
        <Plus className="w-5 h-5" />
        {actionLabel}
      </button>
    </div>
  );
}
