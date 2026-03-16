import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Copy, Check, RefreshCw, FolderInput, BookMarked,
  AlertTriangle, Loader2, RotateCcw
} from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { StorylinePrompt, Storyline } from '../lib/storage'
import { callStorylineAPI } from '../lib/anthropic'

// ─── Section parser (mirrors the one in StorylineForm.jsx) ────────────────────
function parseModelSections(text) {
  const sectionAStart = text.search(/SECTION A\s*[—–-]/i)
  const sectionBStart = text.search(/SECTION B\s*[—–-]/i)
  const sectionCStart = text.search(/SECTION C\s*[—–-]/i)

  if (sectionAStart === -1 && sectionBStart === -1) {
    return { sectionA: '', sectionB: '', sectionC: '', raw: text, parsed: false }
  }

  const lineEnd = (pos) => {
    const idx = text.indexOf('\n', pos)
    return idx === -1 ? pos : idx + 1
  }

  const aContentStart = sectionAStart !== -1 ? lineEnd(sectionAStart) : 0
  const bContentStart = sectionBStart !== -1 ? lineEnd(sectionBStart) : text.length
  const cContentStart = sectionCStart !== -1 ? lineEnd(sectionCStart) : text.length

  const sectionA = sectionAStart !== -1
    ? text.slice(aContentStart, sectionBStart !== -1 ? sectionBStart : text.length).trim()
    : ''
  const sectionB = sectionBStart !== -1
    ? text.slice(bContentStart, sectionCStart !== -1 ? sectionCStart : text.length).trim()
    : ''
  const sectionC = sectionCStart !== -1
    ? text.slice(cContentStart).trim()
    : ''

  const clean = (s) => s.replace(/^---\s*\n?/m, '').replace(/\n?---\s*$/m, '').trim()

  return {
    sectionA: clean(sectionA),
    sectionB: clean(sectionB),
    sectionC: clean(sectionC),
    raw: text,
    parsed: true,
  }
}

// ─── Copy hook ────────────────────────────────────────────────────────────────
function useCopy() {
  const [copiedKey, setCopiedKey] = useState(null)

  const copy = useCallback(async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }, [])

  return { copy, copiedKey }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StorylineResult() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { theme } = useTheme()
  const { user } = useAuth()
  const userId = user?.id
  const { copy, copiedKey } = useCopy()

  const [retrying, setRetrying] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)

  // Load the persisted snapshot
  const { data: prompt, isLoading } = useQuery({
    queryKey: ['storyline-prompt', id],
    queryFn: () => StorylinePrompt.get(id),
    enabled: !!id,
  })

  const { data: storylines = [] } = useQuery({
    queryKey: ['storylines', userId],
    queryFn: () => Storyline.list(userId),
    enabled: !!userId,
  })

  // Find which folder this prompt is currently linked to
  const linkedFolder = storylines.find(sl => sl.storyline_prompt_id === id) || null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.primary }} />
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div
          className="rounded-2xl p-8 text-center"
          style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
        >
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: theme.textMuted }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: theme.textBody }}>
            Result not found
          </h2>
          <p className="text-sm mb-6" style={{ color: theme.textMuted }}>
            This storyline result may have been cleared from local storage.
          </p>
          <button
            onClick={() => navigate('/storyline/new')}
            className="px-6 py-2.5 rounded-xl font-medium text-sm"
            style={{ background: theme.buttonGradient, color: 'white' }}
          >
            Start Over
          </button>
        </div>
      </div>
    )
  }

  // Parse sections from the stored raw response
  const sections = prompt.section_a || prompt.section_b
    ? { sectionA: prompt.section_a, sectionB: prompt.section_b, sectionC: prompt.section_c, parsed: true }
    : parseModelSections(prompt.raw_response || '')

  // Derive page subtitle from form payload if available
  const protagonist = prompt.form_payload?.section_a?.protagonist
  const subTitle = protagonist?.name
    ? `${protagonist.name}${protagonist.status ? ` — ${protagonist.status}` : ''}`
    : protagonist?.status
      ? protagonist.status
      : 'Untitled Storyline'

  const handleCopyAll = () => {
    const allText = [
      sections.sectionA ? `SECTION A — PROMPT PLOT\n\n${sections.sectionA}` : '',
      sections.sectionB ? `\n\nSECTION B — PROMPT GUIDELINES\n\n${sections.sectionB}` : '',
      sections.sectionC ? `\n\nSECTION C — AI REMINDERS\n\n${sections.sectionC}` : '',
      !sections.parsed ? prompt.raw_response : '',
    ].filter(Boolean).join('')
    copy(allText, 'all')
  }

  const handleRetry = async () => {
    if (!prompt.form_payload) {
      toast.error('No form payload stored — cannot retry.')
      return
    }
    setRetrying(true)
    const TOKEN_MAP = { lite: 4000, standard: 8000, rich: 16000 }
    const maxTokens = TOKEN_MAP[prompt.token_tier] || 8000
    try {
      const rawText = await callStorylineAPI({ formPayload: prompt.form_payload, maxTokens })
      const parsed = parseModelSections(rawText)
      await StorylinePrompt.update(id, {
        raw_response: rawText,
        section_a: parsed.sectionA,
        section_b: parsed.sectionB,
        section_c: parsed.sectionC,
      })
      queryClient.invalidateQueries({ queryKey: ['storyline-prompt', id] })
      toast.success('Regenerated successfully')
    } catch (err) {
      toast.error(`Retry failed: ${err.message}`)
    } finally {
      setRetrying(false)
    }
  }

  const handleSaveToFolder = async (storylineId) => {
    const genres = prompt.form_payload?.section_b?.genres || []
    const overlays = prompt.form_payload?.section_b?.structural_overlays || []
    const tier = prompt.token_tier || 'standard'
    await Storyline.update(storylineId, {
      storyline_prompt_id: id,
      storyline_metadata: {
        genres,
        protagonist_status: prompt.form_payload?.section_a?.protagonist?.status || null,
        overlays,
        token_tier: tier,
      },
    })
    queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
    setShowSaveModal(false)
    toast.success('Saved to storyline folder')
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/storyline/new')}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" style={{ color: theme.textMuted }} />
        </button>
        <div className="flex-1">
          <h1
            className="text-2xl font-bold mb-0.5"
            style={{
              background: theme.titleGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            Your Generated Storyline Prompt
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm" style={{ color: theme.textMuted }}>{subTitle}</p>
            {linkedFolder && (
              <span
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                style={{ background: theme.primaryGlow, color: theme.primary, border: `1px solid ${theme.primary}` }}
                onClick={() => navigate(`/storyline?id=${linkedFolder.id}`)}
                title="View in Storyline Gallery"
              >
                <FolderInput className="w-3 h-3" />
                {linkedFolder.name}
              </span>
            )}
          </div>
        </div>
        <BookMarked className="w-6 h-6" style={{ color: theme.primary, opacity: 0.6 }} />
      </div>

      {/* Page-level actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={handleCopyAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{ background: theme.buttonGradient, color: 'white' }}
        >
          {copiedKey === 'all'
            ? <><Check className="w-4 h-4" /> Copied All</>
            : <><Copy className="w-4 h-4" /> Copy All</>
          }
        </button>
        <button
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{
            background: linkedFolder ? theme.primaryGlow : theme.fieldBg,
            border: `1px solid ${linkedFolder ? theme.primary : theme.fieldBorder}`,
            color: linkedFolder ? theme.primary : theme.textBody,
          }}
        >
          <FolderInput className="w-4 h-4" />
          {linkedFolder ? `In: ${linkedFolder.name}` : 'Save to Folder'}
        </button>
        <button
          onClick={handleRetry}
          disabled={retrying}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
          style={{
            background: theme.fieldBg,
            border: `1px solid ${theme.fieldBorder}`,
            color: theme.textBody,
          }}
        >
          {retrying
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Retrying…</>
            : <><RefreshCw className="w-4 h-4" /> Retry Generation</>
          }
        </button>
        <button
          onClick={() => navigate('/storyline/new')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80"
          style={{
            background: theme.fieldBg,
            border: `1px solid ${theme.fieldBorder}`,
            color: theme.textMuted,
          }}
        >
          <RotateCcw className="w-4 h-4" />
          Start Over
        </button>
      </div>

      {/* Content */}
      {sections.parsed ? (
        <div className="space-y-4">
          {sections.sectionA && (
            <ContentBlock
              title="Prompt Plot"
              content={sections.sectionA}
              blockKey="sectionA"
              copy={copy}
              copiedKey={copiedKey}
              theme={theme}
            />
          )}
          {sections.sectionB && (
            <ContentBlock
              title="Prompt Guidelines"
              content={sections.sectionB}
              blockKey="sectionB"
              copy={copy}
              copiedKey={copiedKey}
              theme={theme}
            />
          )}
          {sections.sectionC && (
            <ContentBlock
              title="AI Reminders"
              content={sections.sectionC}
              blockKey="sectionC"
              copy={copy}
              copiedKey={copiedKey}
              theme={theme}
            />
          )}
        </div>
      ) : (
        // Malformed / unparseable response
        <div
          className="rounded-2xl p-5"
          style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" style={{ color: '#f59e0b' }} />
            <span className="text-sm font-medium" style={{ color: '#f59e0b' }}>
              The output could not be parsed into sections. Full response shown below.
            </span>
          </div>
          <pre
            className="whitespace-pre-wrap text-sm leading-relaxed"
            style={{
              color: theme.textBody,
              fontFamily: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, monospace',
            }}
          >
            {prompt.raw_response}
          </pre>
        </div>
      )}

      {/* Save to folder modal */}
      {showSaveModal && (
        <SaveToFolderModal
          theme={theme}
          storylines={storylines}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveToFolder}
        />
      )}
    </div>
  )
}

// ─── Content block ────────────────────────────────────────────────────────────
function ContentBlock({ title, content, blockKey, copy, copiedKey, theme }) {
  const isCopied = copiedKey === blockKey

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
    >
      {/* Block header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}
      >
        <span className="text-sm font-semibold uppercase tracking-widest" style={{ color: theme.labelColor }}>
          {title}
        </span>
        <button
          onClick={() => copy(content, blockKey)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{
            background: isCopied ? '#10b981' : theme.fieldBg,
            border: `1px solid ${isCopied ? '#10b981' : theme.fieldBorder}`,
            color: isCopied ? 'white' : theme.textBody,
          }}
        >
          {isCopied ? (
            <><Check className="w-3.5 h-3.5" /> Copied</>
          ) : (
            <><Copy className="w-3.5 h-3.5" /> Copy</>
          )}
        </button>
      </div>

      {/* Block body */}
      <div className="px-5 py-4">
        <pre
          className="whitespace-pre-wrap text-sm leading-relaxed"
          style={{
            color: theme.textBody,
            fontFamily: '"Georgia", "Times New Roman", serif',
          }}
        >
          {content}
        </pre>
      </div>
    </div>
  )
}

// ─── Save to folder modal ─────────────────────────────────────────────────────
function SaveToFolderModal({ theme, storylines, onClose, onSave }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl p-6"
        style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10"
        >
          <svg className="w-5 h-5" style={{ color: theme.textMuted }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="text-lg font-bold mb-1" style={{ color: theme.textBody }}>
          Save / Move to Folder
        </h3>
        <p className="text-sm mb-4" style={{ color: theme.textMuted }}>
          Attach this prompt to a storyline folder. Selecting a new folder will move it.
        </p>

        {storylines.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm" style={{ color: theme.textMuted }}>
              No storyline folders yet. Create one in Gallery first.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {storylines.map(sl => (
              <button
                key={sl.id}
                onClick={() => onSave(sl.id)}
                className="w-full p-3 rounded-xl text-left transition-all hover:opacity-80"
                style={{
                  background: theme.fieldBg,
                  border: `1px solid ${sl.storyline_prompt_id ? theme.primary : theme.fieldBorder}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: theme.textBody }}>
                    {sl.name}
                  </span>
                  {sl.storyline_prompt_id && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: theme.primaryGlow, color: theme.primary }}>
                      Has prompt
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
