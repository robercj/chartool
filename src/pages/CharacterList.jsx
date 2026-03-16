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
  const [drafts, setDrafts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('characters');

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

  const handleNewCharacter = () => {
    navigate('/characters/generate');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-indigo-400" />
              Characters
            </h1>
            <p className="text-gray-400 mt-1">
              Manage your created characters and drafts
            </p>
          </div>
          
          <button
            onClick={handleNewCharacter}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Character
          </button>
        </div>

        <div className="flex gap-4 mb-6 border-b border-gray-800">
          <button
            onClick={() => setActiveTab('characters')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'characters'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Finalized ({characters.length})
          </button>
          <button
            onClick={() => setActiveTab('drafts')}
            className={`pb-3 px-1 font-medium transition-colors ${
              activeTab === 'drafts'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Drafts ({drafts.length})
          </button>
        </div>

        {activeTab === 'characters' && (
          <div>
            {characters.length === 0 ? (
              <div className="text-center py-16">
                <Sparkles className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-300 mb-2">No characters yet</h3>
                <p className="text-gray-500 mb-6">Create your first character to get started</p>
                <button
                  onClick={handleNewCharacter}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Character
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {characters.map(char => (
                  <Link
                    key={char.id}
                    to={`/characters/${char.id}`}
                    className="block bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-indigo-500/50 transition-colors group"
                  >
                    <div className="aspect-[3/4] bg-gray-800 relative">
                      {char.generated_image_url ? (
                        <img
                          src={char.generated_image_url}
                          alt={char.character_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="w-12 h-12 text-gray-700" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <span className="px-2 py-1 bg-green-900/80 text-green-300 text-xs rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Finalized
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">
                        {char.character_name || 'Unnamed Character'}
                      </h3>
                      <p className="text-sm text-gray-400 mt-1">
                        {char.archetype || char.character_role || 'Character'}
                      </p>
                      <p className="text-xs text-gray-500 mt-2">
                        Created {formatDistanceToNow(new Date(char.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'drafts' && (
          <div>
            {drafts.length === 0 ? (
              <div className="text-center py-16">
                <Clock className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-300 mb-2">No drafts</h3>
                <p className="text-gray-500 mb-6">Start creating a character to save drafts</p>
                <button
                  onClick={handleNewCharacter}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Character
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {drafts.map(draft => (
                  <Link
                    key={draft.id}
                    to={`/characters/generate/${draft.id}`}
                    className="flex items-center gap-4 p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-indigo-500/50 transition-colors group"
                  >
                    <div className="w-16 h-16 bg-gray-800 rounded-lg flex-shrink-0 overflow-hidden">
                      {draft.generated_image_url ? (
                        <img
                          src={draft.generated_image_url}
                          alt={draft.character_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Sparkles className="w-6 h-6 text-gray-700" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors truncate">
                        {draft.character_name || 'Untitled Draft'}
                      </h3>
                      <p className="text-sm text-gray-400 truncate">
                        {draft.archetype || draft.character_role || 'Character in progress'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Last modified {formatDistanceToNow(new Date(draft.last_modified_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteDraft(draft.id, e)}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                        aria-label="Delete draft"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-indigo-400 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
