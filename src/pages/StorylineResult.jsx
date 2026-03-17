import { useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  ArrowLeft, Copy, Check, RefreshCw, FolderInput, BookMarked,
  AlertTriangle, Loader2, RotateCcw, X as XIcon,
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
      // navigator.clipboard may not be available on non-secure contexts — fallback gracefully
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        // Fallback for older mobile browsers
        const el = document.createElement('textarea')
        el.value = text
        el.style.position = 'fixed'
        el.style.opacity  = '0'
        document.body.appendChild(el)
        el.focus()
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      }
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
  const { id }        = useParams()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const { theme }     = useTheme()
  const { user }      = useAuth()
  const userId        = user?.id
  const { copy, copiedKey } = useCopy()

  const [retrying, setRetrying]           = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)

  // aria-live region for copy announcements
  const liveRegionRef = useRef(null)

  // Load the persisted snapshot
  const { data: prompt, isLoading } = useQuery({
    queryKey: ['storyline-prompt', id],
    queryFn:  () => StorylinePrompt.get(id),
    enabled:  !!id,
  })

  const { data: storylines = [] } = useQuery({
    queryKey: ['storylines', userId],
    queryFn:  () => Storyline.list(userId),
    enabled:  !!userId,
  })

  // Find which folder this prompt is currently linked to
  const linkedFolder = storylines.find(sl => sl.storyline_prompt_id === id) || null

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
        {/* Skeleton loader cards */}
        <div className="w-full" style={{ maxWidth: '800px' }}>
          <div className="flex flex-col items-center gap-3 mb-8">
            <span className="loading loading-spinner loading-lg text-primary" aria-hidden="true" />
            <p className="text-base font-medium text-base-content">
              Generating your storyline…
            </p>
            <p className="text-base-content/60" style={{ fontSize: 'var(--font-size-label)' }}>
              This may take 20–40 seconds for Rich tier
            </p>
          </div>
          {/* Pulsing skeleton blocks */}
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="card bg-base-200 border border-base-300 mb-4 overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-base-300">
                <div className="skeleton h-4 w-32 rounded" />
              </div>
              <div className="card-body py-4 space-y-2">
                <div className="skeleton h-3 w-full rounded" />
                <div className="skeleton h-3 w-4/5 rounded" />
                <div className="skeleton h-3 w-3/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!prompt) {
    return (
      <div className="w-full mx-auto py-8 px-4" style={{ maxWidth: '800px' }}>
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body items-center text-center">
            <AlertTriangle className="w-12 h-12 mb-4 text-base-content/50" />
            <h2 className="card-title text-base-content">Result not found</h2>
            <p className="text-sm text-base-content/60 mb-6">
              This storyline result may have been cleared from local storage.
            </p>
            <button
              onClick={() => navigate('/storyline/new')}
              className="btn btn-primary"
              style={{ minHeight: '44px' }}
            >
              Start Over
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Parse sections from stored raw response
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
    if (liveRegionRef.current) liveRegionRef.current.textContent = 'All sections copied'
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
      const parsed  = parseModelSections(rawText)
      await StorylinePrompt.update(id, {
        raw_response: rawText,
        section_a:    parsed.sectionA,
        section_b:    parsed.sectionB,
        section_c:    parsed.sectionC,
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
    const genres  = prompt.form_payload?.section_b?.genres || []
    const overlays = prompt.form_payload?.section_b?.structural_overlays || []
    const tier    = prompt.token_tier || 'standard'
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
    <div className="w-full mx-auto py-6 md:py-8 px-4" style={{ maxWidth: '800px' }}>

      {/* aria-live region for copy announcements (screen readers) */}
      <div
        ref={liveRegionRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />

      {/* ── Header ── */}
      <div className="flex items-start gap-3 mb-5 md:mb-6">
        <button
          onClick={() => navigate('/storyline/new')}
          className="btn btn-ghost btn-sm flex-shrink-0 mt-1"
          aria-label="Back to form"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <ArrowLeft className="w-5 h-5" style={{ color: theme.textMuted }} aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <h1
            className="font-bold mb-0.5"
            style={{
              fontSize:             'var(--font-size-page)',
              background:           theme.titleGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor:  'transparent',
              backgroundClip:       'text',
            }}
          >
            Your Generated Storyline Prompt
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base-content/60" style={{ fontSize: 'var(--font-size-body)' }}>{subTitle}</p>
            {linkedFolder && (
              <button
                className="flex items-center gap-1 px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  fontSize:   'var(--font-size-label)',
                  background: theme.primaryGlow,
                  color:      theme.primary,
                  border:     `1px solid ${theme.primary}`,
                  minHeight:  '28px',
                }}
                onClick={() => navigate(`/storyline?id=${linkedFolder.id}`)}
                title="View in Storyline Gallery"
              >
                <FolderInput className="w-3 h-3" aria-hidden="true" />
                {linkedFolder.name}
              </button>
            )}
          </div>
        </div>
        <BookMarked className="w-6 h-6 flex-shrink-0 mt-1" style={{ color: theme.primary, opacity: 0.6 }} aria-hidden="true" />
      </div>

      {/*
        ── Page-level actions ──
        Mobile:  full-width stacked buttons above content blocks
        Desktop: horizontal group, right-aligned
      */}
      <div className="mb-6">
        {/* Mobile: vertical stack, full width */}
        <div className="flex flex-col gap-2 md:hidden">
          <button
            onClick={handleCopyAll}
            className="btn btn-primary w-full"
            style={{ minHeight: '48px' }}
          >
            {copiedKey === 'all'
              ? <><Check className="w-4 h-4" aria-hidden="true" /> Copied All</>
              : <><Copy  className="w-4 h-4" aria-hidden="true" /> Copy All</>
            }
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="btn btn-outline w-full"
            style={{
              minHeight:  '48px',
              background: linkedFolder ? theme.primaryGlow : undefined,
              borderColor: linkedFolder ? theme.primary : undefined,
              color:      linkedFolder ? theme.primary : undefined,
            }}
          >
            <FolderInput className="w-4 h-4" aria-hidden="true" />
            {linkedFolder ? `In: ${linkedFolder.name}` : 'Save to Folder'}
          </button>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="btn btn-outline w-full"
            style={{ minHeight: '48px' }}
          >
            {retrying
              ? <><span className="loading loading-spinner loading-sm" aria-hidden="true" /> Retrying…</>
              : <><RefreshCw className="w-4 h-4" aria-hidden="true" /> Retry Generation</>
            }
          </button>
          <button
            onClick={() => navigate('/storyline/new')}
            className="btn btn-ghost w-full text-base-content/60"
            style={{ minHeight: '48px' }}
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Start Over
          </button>
        </div>

        {/* Desktop: horizontal row, right-aligned */}
        <div className="hidden md:flex flex-wrap justify-end gap-2">
          <button
            onClick={handleCopyAll}
            className="btn btn-primary"
            style={{ minHeight: '44px' }}
          >
            {copiedKey === 'all'
              ? <><Check className="w-4 h-4" aria-hidden="true" /> Copied All</>
              : <><Copy  className="w-4 h-4" aria-hidden="true" /> Copy All</>
            }
          </button>
          <button
            onClick={() => setShowSaveModal(true)}
            className="btn btn-outline"
            style={{
              minHeight:   '44px',
              background:  linkedFolder ? theme.primaryGlow : undefined,
              borderColor: linkedFolder ? theme.primary : undefined,
              color:       linkedFolder ? theme.primary : undefined,
            }}
          >
            <FolderInput className="w-4 h-4" aria-hidden="true" />
            {linkedFolder ? `In: ${linkedFolder.name}` : 'Save to Folder'}
          </button>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="btn btn-outline"
            style={{ minHeight: '44px' }}
          >
            {retrying
              ? <><span className="loading loading-spinner loading-sm" aria-hidden="true" /> Retrying…</>
              : <><RefreshCw className="w-4 h-4" aria-hidden="true" /> Retry Generation</>
            }
          </button>
          <button
            onClick={() => navigate('/storyline/new')}
            className="btn btn-ghost text-base-content/60"
            style={{ minHeight: '44px' }}
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Start Over
          </button>
        </div>
      </div>

      {/* ── Content blocks ── */}
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
              liveRegionRef={liveRegionRef}
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
              liveRegionRef={liveRegionRef}
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
              liveRegionRef={liveRegionRef}
            />
          )}
        </div>
      ) : (
        /* Malformed / unparseable response */
        <div className="card bg-base-200 border border-base-300">
          <div className="card-body">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-warning" aria-hidden="true" />
              <span className="text-sm font-medium text-warning">
                The output could not be parsed into sections. Full response shown below.
              </span>
            </div>
            <pre className="pre-block leading-relaxed text-base-content" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {prompt.raw_response}
            </pre>
          </div>
        </div>
      )}

      {/* Save to folder modal / bottom sheet */}
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
function ContentBlock({ title, content, blockKey, copy, copiedKey, theme, liveRegionRef }) {
  const isCopied = copiedKey === blockKey

  const handleCopy = () => {
    copy(content, blockKey)
    if (liveRegionRef?.current) {
      liveRegionRef.current.textContent = `${title} copied`
    }
  }

  return (
    <div className="card bg-base-200 border border-base-300 overflow-hidden">
      {/* Block header — space-between, heading truncates rather than wrapping under copy btn */}
      <div className="flex items-center justify-between px-4 md:px-5 py-3 gap-3 border-b border-base-300">
        <span
          className="font-semibold uppercase tracking-widest truncate"
          style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}
        >
          {title}
        </span>
        {/* Copy button — labeled at all widths, meets 44×44px touch target */}
        <button
          onClick={handleCopy}
          className={`btn btn-sm flex-shrink-0 ${isCopied ? 'btn-success' : 'btn-ghost border border-base-300'}`}
          style={{ minWidth: '44px', minHeight: '44px' }}
          aria-label={isCopied ? `${title} copied` : `Copy ${title}`}
        >
          {isCopied
            ? <><Check  className="w-3.5 h-3.5" aria-hidden="true" /> Copied</>
            : <><Copy   className="w-3.5 h-3.5" aria-hidden="true" /> Copy</>
          }
        </button>
      </div>

      {/* Block body — pre-wrap, word-break, no horizontal overflow */}
      <div className="px-4 md:px-5 py-4">
        <pre
          className="pre-block leading-relaxed text-base-content"
          style={{
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          {content}
        </pre>
      </div>
    </div>
  )
}

// ─── Save to folder modal / bottom sheet ─────────────────────────────────────
/*
  Mobile: bottom sheet (slides up).
  Desktop: centered dialog.
*/
function SaveToFolderModal({ theme, storylines, onClose, onSave }) {
  const [dragOffset, setDragOffset] = useState(0)
  const dragState = useRef({ startY: 0, dragging: false })

  const handleTouchStart = (e) => {
    dragState.current = { startY: e.touches[0].clientY, dragging: true }
  }
  const handleTouchMove = (e) => {
    if (!dragState.current.dragging) return
    const dy = e.touches[0].clientY - dragState.current.startY
    if (dy > 0) setDragOffset(dy)
  }
  const handleTouchEnd = () => {
    dragState.current.dragging = false
    if (dragOffset > 80) { setDragOffset(0); onClose() }
    else setDragOffset(0)
  }

  return (
    <dialog className="modal modal-bottom sm:modal-middle" open role="dialog" aria-modal="true" aria-label="Save to folder">
      <div className="modal-backdrop" onClick={onClose} />

      {/* Mobile bottom sheet */}
      <div
        className="modal-box bg-base-200 border border-base-300 md:hidden rounded-t-2xl rounded-b-none w-full max-w-full"
        style={{
          transform:     `translateY(${dragOffset}px)`,
          transition:    dragOffset === 0 ? 'transform 0.3s cubic-bezier(0.32,0.72,0,1)' : 'none',
          paddingBottom: `calc(var(--safe-bottom) + 1rem)`,
          maxHeight:     '70vh',
          overflowY:     'auto',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-1 pb-2" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-base-300" />
        </div>
        <SaveToFolderContent theme={theme} storylines={storylines} onSave={onSave} />
      </div>

      {/* Desktop centered dialog */}
      <div className="modal-box hidden md:block bg-base-200 border border-base-300 relative">
        <button
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-circle absolute right-2 top-2"
          aria-label="Close"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          <XIcon className="w-5 h-5 text-base-content/60" aria-hidden="true" />
        </button>
        <SaveToFolderContent theme={theme} storylines={storylines} onSave={onSave} />
      </div>
    </dialog>
  )
}

function SaveToFolderContent({ theme, storylines, onSave }) {
  return (
    <div className="px-1 pb-2">
      <h3 className="font-bold mb-1 text-base-content" style={{ fontSize: 'var(--font-size-heading)' }}>
        Save / Move to Folder
      </h3>
      <p className="text-sm mb-4 text-base-content/60">
        Attach this prompt to a storyline folder. Selecting a new folder will move it.
      </p>

      {storylines.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm text-base-content/60">
            No storyline folders yet. Create one in Gallery first.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {storylines.map(sl => (
            <button
              key={sl.id}
              onClick={() => onSave(sl.id)}
              className="btn btn-ghost w-full justify-between text-left border border-base-300 hover:border-primary"
              style={{
                minHeight:   '52px',
                borderColor: sl.storyline_prompt_id ? theme.primary : undefined,
              }}
            >
              <span className="text-sm font-medium text-base-content">
                {sl.name}
              </span>
              {sl.storyline_prompt_id && (
                <span className="badge badge-primary badge-sm flex-shrink-0">
                  Has prompt
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
