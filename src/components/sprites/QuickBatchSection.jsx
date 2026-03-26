// ─── QuickBatchSection.jsx ───────────────────────────────────────────────────
// Quick Batch Sprites UI - two one-click batch presets for generating
// predefined emotional expression sets.
//
// Basic: 10 images (one per core emotion at average intensity)
// Comprehensive: 30 images (three intensities per emotion)
//
// Uses the same generation pipeline as manual sprite generation.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useCallback, useRef, useEffect } from 'react'
import { Loader2, AlertCircle, Check } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { compileSpritePrompt } from '../../lib/promptCompiler'
import { RANDOM_POSE_POOL } from '../../lib/constants/POSE_PRESETS'
import {
  QUICK_BATCH_BASIC,
  QUICK_BATCH_COMPREHENSIVE,
  QUICK_BATCH_BASIC_COUNT,
  QUICK_BATCH_COMPREHENSIVE_COUNT,
  QUICK_BATCH_ASPECT_RATIO,
  QUICK_BATCH_TOGGLES,
} from '../../lib/constants/QUICK_BATCH_PRESETS'
import useGenerationQueueStore from '../../lib/stores/generationQueueStore'

export default function QuickBatchSection({
  character,
  consistencyPrompt,
  identityLock,
  referenceImageBase64,
  referenceImageUrl,
  theme,
  enabled,
}) {
  const { usage } = useAuth()
  const { dispatchBatch } = useGenerationQueueStore()
  
  const [isRunning, setIsRunning] = useState(false)
  const [batchType, setBatchType] = useState(null)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState(null)
  
  const mountedRef = useRef(true)
  const sessionIdRef = useRef(null)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const remainingCredits = usage.image || 0
  
  const canRunBasic = enabled && remainingCredits >= QUICK_BATCH_BASIC_COUNT
  const canRunComprehensive = enabled && remainingCredits >= QUICK_BATCH_COMPREHENSIVE_COUNT

  const buildEmotionEntry = useCallback((item) => {
    const emotionLower = item.emotion.toLowerCase()
    let resolvedBase = emotionLower
    
    if (emotionLower === 'aversion') resolvedBase = 'disgust'
    else if (emotionLower === 'concern') resolvedBase = 'fear'
    else if (emotionLower === 'touched') resolvedBase = 'joy'

    return {
      emotion: item.emotion,
      rawInput: item.emotion,
      intensity: item.intensity,
      pose: 'random',
      modifiers: '',
      resolved: { base: resolvedBase, tier: item.intensity },
      isVerbatim: false,
      promptDirection: item.promptDirection,
    }
  }, [])

  const buildJobsForBatch = useCallback((batchConfig, batchSource) => {
    const charName = character.character_name || 'Character'
    const refImage = referenceImageBase64 || referenceImageUrl
    
    const randomPoses = [...RANDOM_POSE_POOL].sort(() => Math.random() - 0.5)
    
    return batchConfig.map((item, index) => {
      const emotionEntry = buildEmotionEntry(item)
      const poseId = randomPoses[index % randomPoses.length].id
      
      const finalPrompt = compileSpritePrompt({
        identityLock,
        consistencyPrompt,
        poseId,
        emotionEntry,
        allowPrompt: QUICK_BATCH_TOGGLES.allowPrompt,
        customPrompt: '',
        allowClothing: QUICK_BATCH_TOGGLES.allowClothing,
        allowProps: QUICK_BATCH_TOGGLES.allowProps,
        artStyle: null,
      })

      return {
        contextId: character.id,
        characterName: charName,
        thumbnailUrl: character.generated_image_url || character.reference_image_url || null,
        label: `${item.emotion} (${item.intensity})`,
        generationParams: {
          prompt: finalPrompt,
          referenceImageUrls: [refImage].filter(Boolean),
          aspectRatio: QUICK_BATCH_ASPECT_RATIO,
          seed: null,
          poseId,
          emotionEntry,
          artStyle: null,
          paramsSnapshot: {
            variationCount: batchConfig.length,
            aspectRatio: QUICK_BATCH_ASPECT_RATIO,
            poseId,
            emotionEntry,
            artStyle: null,
            toggles: QUICK_BATCH_TOGGLES,
            batch_source: batchSource,
            emotion: item.emotion,
            intensity: item.intensity,
            batch_index: index + 1,
          },
        },
      }
    })
  }, [character, identityLock, consistencyPrompt, referenceImageBase64, referenceImageUrl, buildEmotionEntry])

  const executeBatch = useCallback(async (batchConfig, batchSource, count) => {
    if (!mountedRef.current) return
    
    setIsRunning(true)
    setBatchType(batchSource)
    setProgress({ current: 0, total: count })
    setMessage(null)
    setMessageType(null)

    const jobs = buildJobsForBatch(batchConfig, batchSource)
    
    try {
      const newSessionId = await dispatchBatch({
        contextType: 'sprite',
        formSnapshot: {
          mode: 'quick_batch',
          batchType: batchSource,
          quickBatch: true,
          consistencyPrompt,
          identityLock,
          referenceImageBase64,
          referenceImageUrl,
        },
        returnRoute: '/sprites/generate',
        jobs,
      })
      
      sessionIdRef.current = newSessionId
      
      if (batchSource === 'quick_batch_comprehensive') {
        for (let i = 0; i < jobs.length; i++) {
          if (!mountedRef.current) break
          await new Promise(resolve => setTimeout(resolve, 500))
          setProgress({ current: i + 1, total: jobs.length })
        }
      }
      
      setMessage(`Batch complete — ${count} images added.`)
      setMessageType('success')
      
      setTimeout(() => {
        if (mountedRef.current) {
          setIsRunning(false)
          setBatchType(null)
          setMessage(null)
        }
      }, 4000)
      
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Quick Batch failed:', err)
      
      if (err instanceof Error && err.message.includes('limit')) {
        setMessage("Couldn't start batch — insufficient credits.")
      } else {
        setMessage("Couldn't start batch — please try again.")
      }
      setMessageType('error')
      
      setIsRunning(false)
      setBatchType(null)
    }
  }, [buildJobsForBatch, dispatchBatch, consistencyPrompt, identityLock, referenceImageBase64, referenceImageUrl])

  const handleBasicClick = () => {
    if (!canRunBasic) return
    executeBatch(QUICK_BATCH_BASIC, 'quick_batch_basic', QUICK_BATCH_BASIC_COUNT)
  }

  const handleComprehensiveClick = () => {
    if (!canRunComprehensive) return
    executeBatch(QUICK_BATCH_COMPREHENSIVE, 'quick_batch_comprehensive', QUICK_BATCH_COMPREHENSIVE_COUNT)
  }

  const getBasicLabel = () => {
    if (!enabled) return 'Analysis required'
    if (remainingCredits < QUICK_BATCH_BASIC_COUNT) {
      return `Requires ${QUICK_BATCH_BASIC_COUNT} credits — you have ${remainingCredits} remaining`
    }
    return `${QUICK_BATCH_BASIC_COUNT} images — core emotions, average intensity`
  }

  const getComprehensiveLabel = () => {
    if (!enabled) return 'Analysis required'
    if (remainingCredits < QUICK_BATCH_COMPREHENSIVE_COUNT) {
      return `Requires ${QUICK_BATCH_COMPREHENSIVE_COUNT} credits — you have ${remainingCredits} remaining`
    }
    return `${QUICK_BATCH_COMPREHENSIVE_COUNT} images — full range, three intensities`
  }

  return (
    <div className="space-y-4">
      {/* Section divider */}
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t" style={{ borderColor: theme.cardBorder }} />
        </div>
        <div className="relative flex justify-center">
          <span 
            className="px-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: theme.textMuted, background: theme.cardBg }}
          >
            Quick Batch
          </span>
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-sm -mt-2" style={{ color: theme.textMuted }}>
        Generate a predefined set of emotional expressions in one click.
      </p>

      {/* Progress / Message area */}
      {isRunning && (
        <div 
          className="rounded-xl p-4 space-y-3"
          style={{ background: `${theme.primary}10`, border: `1px solid ${theme.primary}30` }}
        >
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: theme.primary }} />
            <span className="text-sm font-medium" style={{ color: theme.primary }}>
              {batchType === 'quick_batch_basic' ? 'Basic' : 'Comprehensive'} Batch in progress
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: theme.fieldBg }}>
            <div 
              className="h-full rounded-full transition-all duration-300"
              style={{ 
                width: `${Math.round((progress.current / progress.total) * 100)}%`,
                background: theme.buttonGradient || theme.primary,
              }}
            />
          </div>
          
          <p className="text-xs" style={{ color: theme.textMuted }}>
            Generating sprite {progress.current} of {progress.total}…
          </p>
        </div>
      )}

      {/* Success/Error message */}
      {message && !isRunning && (
        <div 
          className="rounded-xl p-3 flex items-center gap-2"
          style={{ 
            background: messageType === 'success' ? '#10b98115' : '#ef444415',
            border: `1px solid ${messageType === 'success' ? '#10b98140' : '#ef444440'}`,
          }}
        >
          {messageType === 'success' ? (
            <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#10b981' }} />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#ef4444' }} />
          )}
          <p className="text-sm" style={{ color: messageType === 'success' ? '#10b981' : '#ef4444' }}>
            {message}
          </p>
        </div>
      )}

      {/* Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Basic Button */}
        <button
          onClick={handleBasicClick}
          disabled={!canRunBasic || isRunning}
          className="btn flex flex-col items-start justify-center h-auto py-3 px-4"
          style={{
            background: canRunBasic && !isRunning ? theme.cardBg : theme.fieldBg,
            borderColor: canRunBasic && !isRunning ? theme.cardBorder : theme.fieldBorder,
            opacity: (!canRunBasic || isRunning) ? 0.6 : 1,
            minHeight: '64px',
          }}
        >
          <span 
            className="font-semibold"
            style={{ color: canRunBasic && !isRunning ? theme.textBody : theme.textMuted }}
          >
            Basic
          </span>
          <span 
            className="text-xs mt-0.5"
            style={{ 
              color: !enabled 
                ? theme.textMuted 
                : remainingCredits < QUICK_BATCH_BASIC_COUNT 
                  ? '#ef4444' 
                  : theme.textMuted 
            }}
          >
            {getBasicLabel()}
          </span>
        </button>

        {/* Comprehensive Button */}
        <button
          onClick={handleComprehensiveClick}
          disabled={!canRunComprehensive || isRunning}
          className="btn flex flex-col items-start justify-center h-auto py-3 px-4"
          style={{
            background: canRunComprehensive && !isRunning ? theme.cardBg : theme.fieldBg,
            borderColor: canRunComprehensive && !isRunning ? theme.cardBorder : theme.fieldBorder,
            opacity: (!canRunComprehensive || isRunning) ? 0.6 : 1,
            minHeight: '64px',
          }}
        >
          <span 
            className="font-semibold"
            style={{ color: canRunComprehensive && !isRunning ? theme.textBody : theme.textMuted }}
          >
            Comprehensive
          </span>
          <span 
            className="text-xs mt-0.5"
            style={{ 
              color: !enabled 
                ? theme.textMuted 
                : remainingCredits < QUICK_BATCH_COMPREHENSIVE_COUNT 
                  ? '#ef4444' 
                  : theme.textMuted 
            }}
          >
            {getComprehensiveLabel()}
          </span>
        </button>
      </div>
    </div>
  )
}
