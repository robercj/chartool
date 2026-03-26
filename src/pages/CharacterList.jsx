import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Sparkles, Plus, Clock, Check, ChevronRight, Trash2, Image, FileText, Copy, X, Lock, LockKeyhole } from 'lucide-react';
import { Character, CharacterDraft } from '../lib/storage';

export default function CharacterListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [characters, setCharacters] = useState([]);
  const [drafts,     setDrafts]     = useState([]);
  const [isLoading,  setIsLoading]  = useState(true);
  const [activeTab,  setActiveTab]  = useState('characters');

  // Prompt modal state
  const [promptModal, setPromptModal] = useState({
    isOpen: false,
    characterName: '',
    prompt: '',
    type: 'character', // 'character' or 'image'
  });
  const [promptCopied, setPromptCopied] = useState(false);

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

  // Open the prompt modal (works for both finalized chars and drafts)
  const openPromptModal = useCallback((characterName, prompt, e, type = 'character') => {
    e.preventDefault();
    e.stopPropagation();
    setPromptCopied(false);
    setPromptModal({ isOpen: true, characterName, prompt, type });
  }, []);

  const closePromptModal = useCallback(() => {
    setPromptModal(prev => ({ ...prev, isOpen: false }));
    setPromptCopied(false);
  }, []);

  // Open image prompt modal (character consistency prompt)
  const openImagePromptModal = useCallback((characterName, prompt, e) => {
    openPromptModal(characterName, prompt, e, 'image');
  }, [openPromptModal]);

  const handleCopyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(promptModal.prompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  }, [promptModal.prompt]);

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

        {/* Tabs */}
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
              {characters.map(char => {
                // Show Prompt button if character has a prompt (character_prompt or character_manifest)
                const promptText = char.character_prompt || char.character_manifest || null;
                const hasIdentityLock = !!char.character_identity_lock;
                return (
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
                      {/* Status badges - top row */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[70%]">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-base-content/20 text-base-content/70">
                          Complete
                        </span>
                        {hasIdentityLock && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/80 text-primary-content flex items-center gap-1">
                            <LockKeyhole className="w-3 h-3" />
                            <span className="hidden sm:inline">Locked</span>
                          </span>
                        )}
                        {char.character_consistency_prompt && !hasIdentityLock && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/60 text-primary-content flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            <span className="hidden sm:inline">Analyzed</span>
                          </span>
                        )}
                      </div>
                      {/* Action buttons - top right */}
                      <div className="absolute top-3 right-3 flex flex-col gap-1.5 sm:flex-row">
                        {promptText && (
                          <button
                            onClick={(e) => openPromptModal(char.character_name || 'Character', promptText, e, 'character')}
                            className="badge badge-neutral gap-1 cursor-pointer hover:badge-primary transition-colors"
                            aria-label="View character prompt"
                          >
                            <FileText className="w-3 h-3" />
                            <span className="hidden lg:inline text-xs">Roleplay</span>
                          </button>
                        )}
                        {char.character_consistency_prompt && (
                          <button
                            onClick={(e) => openImagePromptModal(char.character_name || 'Character', char.character_consistency_prompt, e)}
                            className="badge badge-secondary gap-1 cursor-pointer hover:badge-secondary-focus transition-colors"
                            aria-label="View image prompt"
                          >
                            <Image className="w-3 h-3" />
                            <span className="hidden lg:inline text-xs">Image</span>
                          </button>
                        )}
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
                );
              })}
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
                    {/* Image prompt button - only shown when character_consistency_prompt is available */}
                    {draft.character_consistency_prompt && (
                      <button
                        onClick={(e) => openImagePromptModal(draft.character_name || 'Draft', draft.character_consistency_prompt, e)}
                        className="btn btn-ghost btn-sm gap-1.5 text-base-content/50 hover:text-secondary"
                        aria-label="View image prompt"
                        title="Image Prompt"
                      >
                        <Image className="w-4 h-4" />
                      </button>
                    )}
                    {/* Character prompt button — only shown when character_prompt is available */}
                    {draft.character_prompt && (
                      <button
                        onClick={(e) => openPromptModal(draft.character_name || 'Draft', draft.character_prompt, e, 'character')}
                        className="btn btn-ghost btn-sm gap-1.5 text-base-content/50 hover:text-primary"
                        aria-label="View character prompt"
                      >
                        <FileText className="w-4 h-4" />
                        <span className="hidden sm:inline text-xs">Roleplay</span>
                      </button>
                    )}
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

      {/* ── Character Prompt Modal ─────────────────────────────────────────── */}
      {promptModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closePromptModal}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

          {/* Modal panel */}
          <div
            className="relative z-10 w-full max-w-2xl bg-base-100 rounded-2xl border border-base-300 shadow-2xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Character Prompt"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-base-content flex items-center gap-2">
                  {promptModal.type === 'image' ? (
                    <>
                      <Image className="w-5 h-5 text-secondary" />
                      Image Prompt
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5 text-primary" />
                      Character Prompt
                    </>
                  )}
                </h2>
                <p className="text-sm text-base-content/50 mt-0.5">
                  {promptModal.characterName}
                </p>
              </div>
              <button
                onClick={closePromptModal}
                className="btn btn-ghost btn-sm btn-square"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Prompt text — read-only, scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="text-sm text-base-content/80 whitespace-pre-wrap font-sans leading-relaxed">
                {promptModal.prompt}
              </pre>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-base-300 flex-shrink-0">
              <button
                onClick={handleCopyPrompt}
                className={`btn btn-sm gap-2 ${promptCopied ? 'btn-success' : promptModal.type === 'image' ? 'btn-secondary' : 'btn-primary'}`}
              >
                {promptCopied ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    {promptModal.type === 'image' ? 'Copy Image Prompt' : 'Copy Prompt'}
                  </>
                )}
              </button>
              <button onClick={closePromptModal} className="btn btn-ghost btn-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
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
