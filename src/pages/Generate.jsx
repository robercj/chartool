import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Upload, X, Plus, Loader2, Sparkles, User,
  BookOpen, FolderOpen, ChevronDown, ChevronUp,
  Save, Trash2, Check, AlertCircle, RefreshCw, ImagePlus, Package
} from 'lucide-react'
import { useTheme, GENRES } from '../contexts/ThemeContext'
import { useProgress } from '../contexts/ProgressContext'
import { useAuth } from '../contexts/AuthContext'
import { Storyline, CharacterBatch, GeneratedImage } from '../lib/storage'
import { callLLM, generateImage, removeImageBackground, LimitError } from '../lib/anthropic'

const ARCHETYPES = [
  { id: 'the_antihero', label: 'Anti-Hero', desc: 'Morally grey, conflicted, pragmatic' },
  { id: 'bakadere', label: 'Bakadere', desc: 'Clumsy, naive, adorably dim but pure-hearted' },
  { id: 'the_caregiver', label: 'Caregiver', desc: 'Nurturing, empathetic, self-sacrificing' },
  { id: 'the_coward', label: 'Coward', desc: 'Fearful, self-preserving, reluctant' },
  { id: 'dandere', label: 'Dandere', desc: 'Quiet, shy, introverted; opens up slowly' },
  { id: 'deredere', label: 'Deredere', desc: 'Endlessly sweet, cheerful, openly affectionate' },
  { id: 'the_everyman', label: 'Everyman', desc: 'Relatable, humble, grounded' },
  { id: 'the_explorer', label: 'Explorer', desc: 'Adventurous, restless, free-spirited' },
  { id: 'the_hero', label: 'Hero', desc: 'Brave, determined, selfless' },
  { id: 'himedere', label: 'Himedere', desc: 'Regal, demanding, wants to be treated like royalty' },
  { id: 'the_innocent', label: 'Innocent', desc: 'Pure, naive, optimistic' },
  { id: 'the_jester', label: 'Jester', desc: 'Playful, humorous, carefree' },
  { id: 'kamidere', label: 'Kamidere', desc: 'God complex, arrogant, commands absolute respect' },
  { id: 'kuudere', label: 'Kuudere', desc: 'Cool, emotionless facade, deeply caring within' },
  { id: 'the_loner', label: 'Loner', desc: 'Detached, independent, mysterious' },
  { id: 'the_lover', label: 'Lover', desc: 'Passionate, romantic, emotionally driven' },
  { id: 'the_outcast', label: 'Outcast', desc: 'Misunderstood, bitter, longing for belonging' },
  { id: 'the_prodigy', label: 'Prodigy', desc: 'Gifted, intense, driven by purpose' },
  { id: 'the_protector', label: 'Protector', desc: 'Loyal, defensive, self-sacrificing' },
  { id: 'the_rebel', label: 'Rebel', desc: 'Defiant, passionate, anti-authority' },
  { id: 'the_ruler', label: 'Ruler', desc: 'Authoritative, composed, commanding' },
  { id: 'the_sage', label: 'Sage', desc: 'Wise, calm, introspective' },
  { id: 'the_scholar', label: 'Scholar', desc: 'Intellectual, curious, socially awkward' },
  { id: 'the_trickster', label: 'Trickster', desc: 'Witty, unpredictable, mischievous' },
  { id: 'tsundere', label: 'Tsundere', desc: 'Cold/hostile outside, warm & loving inside' },
  { id: 'the_villain', label: 'Villain', desc: 'Cunning, menacing, power-hungry' },
  { id: 'the_warrior', label: 'Warrior', desc: 'Stoic, fierce, battle-hardened' },
  { id: 'yandere', label: 'Yandere', desc: 'Sweet & loving, dangerously obsessive' },
]

const ASPECT_RATIOS = [
  { value: '21:9', label: '21:9 — Cinematic Wide' },
  { value: '16:9', label: '16:9 — Widescreen' },
  { value: '3:2',  label: '3:2 — Landscape' },
  { value: '4:3',  label: '4:3 — Standard' },
  { value: '5:4',  label: '5:4 — Classic' },
  { value: '1:1',  label: '1:1 — Square' },
  { value: '4:5',  label: '4:5 — Tall' },
  { value: '3:4',  label: '3:4 — Portrait' },
  { value: '2:3',  label: '2:3 — Slim Portrait' },
  { value: '9:16', label: '9:16 — Vertical' },
]

const POSE_PRESETS = [
  'Standing straight neutral', 'Arms crossed', 'One hand on hip',
  'Leaning forward', 'Hands behind back', 'Pointing forward',
  'Waving', 'Arms relaxed'
]

const EXPRESSION_PRESETS = [
  'Neutral', 'Happy/smiling', 'Sad/downcast', 'Angry/scowling',
  'Surprised/wide-eyed', 'Shy/blushing', 'Determined/focused',
  'Laughing', 'Worried/anxious', 'Smirking/confident', 'Crying', 'Confused'
]

const OUTFIT_PRESETS = [
  'Default/reference outfit', 'Casual everyday', 'Formal/dressed up',
  'Battle/combat gear', 'Sleepwear', 'School uniform', 'Traditional attire'
]

const ART_STYLES = [
  { category: 'Anime & Manga', options: [
    { id: 'shonen', label: 'Shōnen Anime', desc: 'Bold lines, vibrant, energetic shading' },
    { id: 'shoujo', label: 'Shōjo Anime', desc: 'Soft pastels, sparkly eyes, delicate linework' },
    { id: 'seinen', label: 'Seinen Anime', desc: 'Detailed, mature, gritty realism' },
    { id: 'josei', label: 'Josei Anime', desc: 'Elegant, refined, subtle palette' },
    { id: 'dark_fantasy_anime', label: 'Dark Fantasy Anime', desc: 'High-contrast, dramatic lighting' },
    { id: 'retro_80s', label: 'Retro 80s Anime', desc: 'Cel-shading, limited palette, vintage' },
    { id: 'mecha', label: 'Mecha Anime', desc: 'Sharp geometry, metallic sheen, sci-fi proportions' },
  ]},
  { category: 'Manhwa & Light Novel', options: [
    { id: 'manhwa', label: 'Korean Manhwa', desc: 'Crisp linework, full color, elongated proportions' },
    { id: 'isekai_ln', label: 'Isekai Light Novel', desc: 'Soft gradients, glossy shading, fantasy palette' },
    { id: 'manhua', label: 'Chinese Manhua', desc: 'Flowing robes, wuxia aesthetic, ink-influenced' },
    { id: 'ln_cover', label: 'Light Novel Cover', desc: 'Polished anime CG, dynamic poses, vibrant cover art' },
    { id: 'graphic_noir', label: 'Graphic Novel Noir', desc: 'High contrast, deep shadows, muted palette' },
  ]},
  { category: 'Western Comics', options: [
    { id: 'western_comic', label: 'Western Comic Book', desc: 'Heavy inks, halftone dots, heroic proportions' },
    { id: 'indie_comic', label: 'Indie Comic', desc: 'Expressive loose inks, hand-crafted texture' },
    { id: 'bd', label: 'Bande Dessinée', desc: 'European album style, clean color fills' },
  ]},
  { category: 'Visual Novel & Game', options: [
    { id: 'vn_cg', label: 'Visual Novel CG', desc: 'Clean anime lineart, soft cell shading, glossy' },
    { id: 'pixel_16bit', label: 'Pixel Art 16-bit', desc: 'SNES-era pixels, limited palette, dithering' },
    { id: 'fantasy_card', label: 'Fantasy Card Art', desc: 'Hyper-detailed anime illustration, dramatic lighting' },
    { id: 'gacha', label: 'Gacha Game Art', desc: 'Sparkly over-designed outfits, high-saturation anime' },
  ]},
]

// Maps storyline form genre strings → ThemeContext genre keys.
// Used to pre-fill the visual theme when navigating from a storyline with an attached prompt.
const STORYLINE_GENRE_TO_THEME_KEY = {
  'Isekai': 'anime',
  'Shonen': 'anime',
  'Seinen': 'anime',
  'Fantasy': 'fantasy',
  'Sci-fi': 'cyberpunk',
  'Urban fantasy': 'default',
  'Dark fantasy': 'horror',
  'Romance': 'romance',
  'Political intrigue': 'noir',
  'Cultivation': 'fantasy',
}

const GENRE_VIBES = {
  action: 'powerful dynamic stances, intense battle-ready postures, determined expressions, cinematic energy',
  comedy: 'exaggerated comedic reactions, light-hearted casual poses, big expressive smiles, playful energy',
  drama: 'emotionally raw theatrical expressions, tense body language, tearful eyes, vulnerable open poses',
  fantasy: 'grand heroic stances, ethereal magical gestures, mythic gravitas, otherworldly composure',
  historical: 'dignified formal postures, era-appropriate restraint, composed noble bearing',
  horror: 'terrified wide eyes, trembling fearful hunching, tense cornered stances, haunted hollow gazes',
  isekai: 'wide wonder-struck eyes, fish-out-of-water confusion, sudden realization expressions, nervous excited energy',
  mystery: 'guarded calculating stares, arms crossed suspicious tension, sharp observant sidelong glances',
  noir: 'brooding world-weary slouch, shadowed downcast eyes, cynical half-smirk, cigarette-smoke melancholy',
  romance: 'tender blushing shy glances, longing dreamy expressions, soft open-hearted vulnerability, gentle warm smiles',
  sci_fi: 'stoic tactical composure, cool detached futuristic stances, precise mechanical gestures',
  supernatural: 'ethereal eerie stillness, otherworldly vacant stare, unsettling calm presence, uncanny tilted poses',
}

export default function Generate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { theme, setGenreKey } = useTheme()
  const { startProgress, updateProgress, clearProgress, isCancelled, generating, setGenerating, getAbortSignal } = useProgress()
  const { user } = useAuth()
  const userId = user?.id
  const mountedRef = useRef(true)

  const [step, setStep] = useState(1)
  const [storylineConfig, setStorylineConfig] = useState(null)
  const [characters, setCharacters] = useState([createEmptyCharacter()])
  const [showNewStorylineModal, setShowNewStorylineModal] = useState(false)
  const [showExistingModal, setShowExistingModal] = useState(false)
  // Map<charId, Array<{index, label, prompt, referenceImageUrl, batchId, errorMsg}>>
  const [failedImages, setFailedImages] = useState({})
  // Live preview: charId → Array<{ url, label }> built up as each image completes
  const [liveImages, setLiveImages] = useState({})

  // TODO: wire resetKey into a key= prop on the form to force-reset state on navigation
  const _resetKey = useLocationResetKey()

  const { data: storylines = [] } = useQuery({
    queryKey: ['storylines', userId],
    queryFn: () => Storyline.list(userId),
    enabled: !!userId,
  })

  // Recent character batches for quick-resume panel
  const { data: recentBatches = [] } = useQuery({
    queryKey: ['recent-batches', userId],
    queryFn: () => CharacterBatch.list(userId).then(list => list.slice(0, 5)),
    enabled: !!userId,
  })

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    const id = searchParams.get('storylineId')
    if (id && userId) {
      Storyline.get(id).then(sl => {
      if (sl) {
        // Pre-fill genre from storyline_metadata if an attached prompt exists
        let prefillGenre = null
        if (sl.storyline_metadata?.genres?.length > 0) {
          const firstGenre = sl.storyline_metadata.genres[0]
          prefillGenre = STORYLINE_GENRE_TO_THEME_KEY[firstGenre] || null
        }
        if (prefillGenre) {
          setGenreKey(prefillGenre)
        }
        setStorylineConfig({ storylineId: id, newStorylineName: null, count: 5, genre: prefillGenre, artStyle: null })
        setStep(2)
      }
      }).catch(() => {})
    }
  }, [searchParams, userId, setGenreKey])

  const handleStorylineReady = (config) => {
    if (config.genre) {
      setGenreKey(config.genre)
    }
    setStorylineConfig(config)
    setStep(2)
  }

  const handleForge = async () => {
    // A character is valid if it has at least one source image
    const validChars = characters.filter(c => (c.sourceImages && c.sourceImages.length > 0) || c.imageUrl)
    if (validChars.length === 0) {
      toast.error('Please upload at least one character image')
      return
    }
    // Block if any character slot has no image uploaded at all
    const missingImage = characters.find(c => !(c.sourceImages && c.sourceImages.length > 0) && !c.imageUrl)
    if (missingImage) {
      toast.error(`Please upload a source image for "${missingImage.name || 'all characters'}"`)
      return
    }

    // [API-KEYS DISABLED] Key presence checks removed — keys come from .env, not user input.
    // const settings = Settings.get()
    // if (!settings.anthropic_key) {
    //   toast.error('Please add your Anthropic API key in Settings')
    //   navigate('/settings')
    //   return
    // }
    // if (!settings.fal_key) {
    //   toast.error('Please add your fal.ai API key in Settings')
    //   navigate('/settings')
    //   return
    // }

    setGenerating(true)
    setLiveImages({})
    let errors = []
    let successCount = 0
    const signal = getAbortSignal()

    try {
      let storylineId = storylineConfig.storylineId

      if (storylineConfig.newStorylineName) {
        const sl = await Storyline.create(userId, { name: storylineConfig.newStorylineName, storyline_art_style: storylineConfig.artStyle })
        storylineId = sl.id
        queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
      }

      for (const char of validChars) {
        if (isCancelled()) break

        const charName = char.name || 'Unnamed'
        
        // Phase 1: Analysis (0/1)
        setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, status: 'analyzing' } : c))
        startProgress(`Analyzing: ${charName}`, 1, '/generate')

        let analysis
        try {
          // Use all source images for analysis (multi-angle / multi-ref support)
          const analysisImageUrls = (char.sourceImages && char.sourceImages.length > 0)
            ? char.sourceImages
            : [char.imageUrl]
          analysis = await callLLM({
            generationType: 'image',
            prompt: `Analyze this character${analysisImageUrls.length > 1 ? ' (multiple reference images provided)' : ''} in great detail. Describe the character's:
- Physical appearance (body type, hair, skin, distinguishing features)
- Clothing and accessories (exact colors, patterns, styles)
- Art style (anime, cartoon, realistic, pixel art, etc.)
- Color palette used
- Any unique design elements

Be extremely specific and detailed so the character can be accurately recreated.`,
            imageUrls: analysisImageUrls
          })
        } catch (err) {
          console.error('Analysis failed:', err)
          if (err instanceof LimitError) { toast.error(err.message); break }
          errors.push(`${charName}: Analysis failed - ${err.message}`)
          setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, status: 'failed' } : c))
          continue
        }

        if (isCancelled()) break

        // Get variations from LLM
        const genre = storylineConfig.genre || 'default'
        const genreVibe = GENRE_VIBES[genre] || GENRE_VIBES.default
        const archetypeLabels = char.archetypes.map(a => {
          const arch = ARCHETYPES.find(x => x.id === a)
          return arch ? `${arch.label} — ${arch.desc}` : a
        }).join(', ')

        const personalityContext = archetypeLabels || (char.characterArc ? `Character arc: ${char.characterArc}` : 'No specific personality defined')

        let variations
        try {
          const variationPrompt = `You are a character art director. Given the character's personality and story arc, generate ${storylineConfig.count || char.variationCount || 5} distinct pose and emotion combinations.

${personalityContext}
Genre vibe: ${genreVibe}
${char.characterArc ? `Character arc: ${char.characterArc}` : ''}

Rules:
- Poses and emotions MUST feel authentic to the genre tone described above
- Make them varied and emotionally distinct, not repetitive

Return JSON: { "variations": [ { "pose": "...(max 8 words)", "emotion": "...(max 6 words)", "label": "...(max 10 words)" } ] }`

          const variationResult = await callLLM({ prompt: variationPrompt, responseSchema: { variations: [] }, generationType: 'image' })
          variations = variationResult.variations || []
        } catch (err) {
          console.error('Variation generation failed:', err)
          errors.push(`${charName}: Variation prompt failed - ${err.message}`)
          setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, status: 'failed' } : c))
          continue
        }

        if (isCancelled()) break

        setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, characterDescription: analysis, status: 'generating' } : c))

        // Resolve the primary reference URL (first source image, or legacy imageUrl)
        const primaryRefUrl = (char.sourceImages && char.sourceImages.length > 0)
          ? char.sourceImages[0]
          : char.imageUrl

        // Create batch
        const batch = await CharacterBatch.create(userId, {
          name: charName,
          storyline_id: storylineId || null,
          reference_image_url: primaryRefUrl,
          reference_image_urls: char.sourceImages && char.sourceImages.length > 0 ? char.sourceImages : [char.imageUrl],
          prop_image_url: char.propImageUrl || null,
          character_description: analysis,
          status: 'generating',
          image_count: 0,
          aspect_ratio: char.aspectRatio || '3:4',
        })

        // Invalidate so gallery shows the new batch immediately
        if (storylineId) {
          queryClient.invalidateQueries({ queryKey: ['storylines', userId] })
          queryClient.invalidateQueries({ queryKey: ['storyline-batches', storylineId] })
        }

        const allPrompts = [...variations]
        if (char.poseOverrides?.length) {
          allPrompts.push(...char.poseOverrides.map(p => ({ pose: p, emotion: char.expressionOverrides?.[0] || 'Neutral', label: p })))
        }

        // Phase 2: Generation (0/N)
        startProgress(`Generating: ${charName}`, allPrompts.length, '/generate')

        let imgCount = 0
        const charSourceImages = char.sourceImages && char.sourceImages.length > 0 ? char.sourceImages : [char.imageUrl]
        const charPropImage = char.propImageUrl || null

        for (let i = 0; i < allPrompts.length; i++) {
          if (isCancelled()) break

          const v = allPrompts[i]
          
          try {
            const fullPrompt = buildGenerationPrompt(char, analysis, v, storylineConfig.genre, char.shotType, char.aspectRatio, char.keepIntegrity, char.removeBackground, char.allowedItems, !!charPropImage)
            let imgUrl = await generateImage({
              prompt: fullPrompt,
              referenceImageUrls: charSourceImages,
              propImageUrl: charPropImage,
              aspectRatio: char.aspectRatio || '3:4',
            }, signal)

            if (char.removeBackground !== false) {
              try {
                imgUrl = await removeImageBackground(imgUrl, signal)
              } catch (rembgErr) {
                console.warn('Background removal failed:', rembgErr)
                toast.warning(`Background removal failed for image ${i + 1}: ${rembgErr.message}`)
              }
            }

            await GeneratedImage.create(userId, {
              batch_id: batch.id,
              url: imgUrl,
              label: v.label || `${v.pose} / ${v.emotion}`,
              category: v.pose
            })

            // Push into live preview for this character slot
            const imgLabel = v.label || `${v.pose} / ${v.emotion}`
            setLiveImages(prev => ({
              ...prev,
              [char.id]: [...(prev[char.id] || []), { url: imgUrl, label: imgLabel }]
            }))

            imgCount++
            successCount++

            // Invalidate queries after each image for live updates
            queryClient.invalidateQueries({ queryKey: ['images', batch.id] })
            queryClient.invalidateQueries({ queryKey: ['batch-images', batch.id] })
            queryClient.invalidateQueries({ queryKey: ['batch-images-preview', batch.id] })

            await CharacterBatch.update(batch.id, { image_count: imgCount })
            updateProgress(i + 1)
          } catch (err) {
            console.error(`Image ${i + 1} generation failed:`, err)
            if (err instanceof LimitError) { toast.error(err.message); break }
            errors.push(`${charName}: Image ${i + 1} failed - ${err.message}`)
            // Record failed image for manual retry
            const fullPrompt = buildGenerationPrompt(char, analysis, v, storylineConfig.genre, char.shotType, char.aspectRatio, char.keepIntegrity, char.removeBackground, char.allowedItems, !!charPropImage)
            setFailedImages(prev => ({
              ...prev,
              [char.id]: [
                ...(prev[char.id] || []),
                {
                  index: i + 1,
                  label: v.label || `${v.pose} / ${v.emotion}`,
                  pose: v.pose,
                  prompt: fullPrompt,
                  referenceImageUrls: charSourceImages,
                  propImageUrl: charPropImage,
                  referenceImageUrl: primaryRefUrl,  // legacy compat
                  batchId: batch.id,
                  removeBackground: char.removeBackground !== false,
                  aspectRatio: char.aspectRatio || '3:4',
                  errorMsg: err.message || 'Unknown error',
                }
              ]
            }))
          }
        }

        if (imgCount > 0) {
          await CharacterBatch.update(batch.id, { status: 'completed', image_count: imgCount })
          setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, status: 'completed' } : c))
        } else {
          await CharacterBatch.update(batch.id, { status: 'failed', image_count: 0 })
          setCharacters(prev => prev.map(c => c.id === char.id ? { ...c, status: 'failed' } : c))
        }
      }

      // Final cleanup
      queryClient.invalidateQueries({ queryKey: ['batches', userId] })
      queryClient.invalidateQueries({ queryKey: ['images'] })

      // Show results
      if (successCount > 0) {
        toast.success(`Generated ${successCount} image${successCount !== 1 ? 's' : ''} successfully!`)
      }
      
      if (errors.length > 0) {
        toast.error(`${errors.length} error${errors.length !== 1 ? 's' : ''} occurred. Check console for details.`)
        console.error('Generation errors:', errors)
      }

      if (successCount > 0) {
        clearProgress()
        navigate('/gallery')
      }
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Fatal generation error:', err)
      toast.error(err.message || 'Generation failed')
      clearProgress()
    } finally {
      if (mountedRef.current) setGenerating(false)
    }
  }

  const addCharacter = () => {
    setCharacters([...characters, createEmptyCharacter()])
  }

  const removeCharacter = (id) => {
    if (characters.length > 1) {
      setCharacters(characters.filter(c => c.id !== id))
    }
  }

  const updateCharacter = (id, data) => {
    setCharacters(characters.map(c => c.id === id ? { ...c, ...data } : c))
  }

  const handleRetry = async (charId, failedItem) => {
    setGenerating(true)
    // Optimistically remove the item from failedImages
    setFailedImages(prev => ({
      ...prev,
      [charId]: (prev[charId] || []).filter(f => f !== failedItem)
    }))
    setCharacters(prev => prev.map(c => c.id === charId ? { ...c, status: 'generating' } : c))
    startProgress(`Retrying image ${failedItem.index}`, 1, '/generate')
    const signal = getAbortSignal()

    try {
      let imgUrl = await generateImage({
        prompt: failedItem.prompt,
        referenceImageUrls: failedItem.referenceImageUrls,
        propImageUrl: failedItem.propImageUrl,
        referenceImageUrl: failedItem.referenceImageUrl,  // legacy fallback
        aspectRatio: failedItem.aspectRatio || '3:4',
      }, signal)

      if (failedItem.removeBackground) {
        try {
          imgUrl = await removeImageBackground(imgUrl, signal)
        } catch (rembgErr) {
          console.warn('Background removal failed on retry:', rembgErr)
          toast.warning(`Background removal failed: ${rembgErr.message}`)
        }
      }

      await GeneratedImage.create(userId, {
        batch_id: failedItem.batchId,
        url: imgUrl,
        label: failedItem.label,
        category: failedItem.pose || failedItem.label,
      })

      const batch = await CharacterBatch.get(failedItem.batchId)
      const newCount = (batch?.image_count || 0) + 1
      await CharacterBatch.update(failedItem.batchId, { image_count: newCount, status: 'completed' })

      queryClient.invalidateQueries({ queryKey: ['images', failedItem.batchId] })
      queryClient.invalidateQueries({ queryKey: ['batch-images', failedItem.batchId] })
      queryClient.invalidateQueries({ queryKey: ['batch-images-preview', failedItem.batchId] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })

      updateProgress(1)
      toast.success(`Image "${failedItem.label}" generated successfully`)

      // If no more failed images for this char, mark completed
      setFailedImages(prev => {
        const remaining = (prev[charId] || []).filter(f => f !== failedItem)
        if (remaining.length === 0) {
          setCharacters(p => p.map(c => c.id === charId ? { ...c, status: 'completed' } : c))
        }
        return { ...prev, [charId]: remaining }
      })
      clearProgress()
    } catch (err) {
      if (!mountedRef.current) return
      console.error('Retry failed:', err)
      toast.error(`Retry failed: ${err.message}`)
      clearProgress()
      // Re-add to failed list with updated error message
      setFailedImages(prev => ({
        ...prev,
        [charId]: [
          ...(prev[charId] || []),
          { ...failedItem, errorMsg: err.message || 'Unknown error' }
        ]
      }))
      setCharacters(prev => prev.map(c => c.id === charId ? { ...c, status: 'failed' } : c))
    } finally {
      if (mountedRef.current) setGenerating(false)
    }
  }

  if (step === 1) {
    return (
      <div className="max-w-md mx-auto py-8 md:py-16 px-4">
        <div
          className="card bg-base-200 border border-base-300"
          style={{ background: theme.cardBg, borderColor: theme.cardBorder, backdropFilter: 'blur(12px)' }}
        >
          <div className="card-body">
            <h2 className="text-2xl font-bold mb-6 text-center" style={{
              background: theme.titleGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Create New Storyline
            </h2>

            <div className="flex flex-col gap-4">
              <button
                onClick={() => setShowNewStorylineModal(true)}
                className="btn btn-primary w-full text-lg"
                style={{ minHeight: '44px', background: theme.buttonGradient, border: 'none' }}
              >
                <Plus className="w-5 h-5 mr-2" />
                New Storyline
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: theme.fieldBorder }} />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4" style={{ background: theme.cardBg, color: theme.textMuted }}>or</span>
                </div>
              </div>

              <button
                onClick={() => setShowExistingModal(true)}
                className="btn btn-outline w-full text-lg"
                style={{ minHeight: '44px', color: theme.textBody, borderColor: theme.fieldBorder }}
                disabled={storylines.length === 0}
              >
                <FolderOpen className="w-5 h-5 mr-2" />
                Existing Storyline
              </button>

              {/* Recent characters quick-resume */}
              {recentBatches.length > 0 && (
                <div className="pt-1">
                  <div className="text-xs uppercase tracking-widest font-medium mb-2" style={{ color: theme.labelColor }}>
                    Recent Characters
                  </div>
                  <div className="space-y-1.5">
                    {recentBatches.map(batch => (
                      <button
                        key={batch.id}
                        onClick={() => navigate(`/batch?id=${batch.id}`)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all hover:opacity-80"
                        style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
                      >
                        {batch.reference_image_url ? (
                          <img
                            src={batch.reference_image_url}
                            alt={batch.name}
                            className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: theme.cardBg }}>
                            <User className="w-4 h-4" style={{ color: theme.textMuted }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: theme.textBody }}>{batch.name || 'Unnamed Character'}</div>
                          <div className="text-xs truncate" style={{ color: theme.textMuted }}>
                            {batch.image_count || 0} images · {new Date(batch.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <ChevronDown className="w-4 h-4 rotate-[-90deg] flex-shrink-0" style={{ color: theme.textMuted }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {showNewStorylineModal && (
          <NewStorylineModal
            theme={theme}
            onClose={() => setShowNewStorylineModal(false)}
            onConfirm={handleStorylineReady}
          />
        )}

        {showExistingModal && (
          <ExistingStorylineModal
            theme={theme}
            storylines={storylines}
            onClose={() => setShowExistingModal(false)}
            onConfirm={handleStorylineReady}
          />
        )}
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Config badge — wraps on narrow screens */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge px-2 py-1 text-xs rounded-md" style={{ background: theme.primaryGlow, color: theme.primary }}>
            {storylineConfig.newStorylineName || 'Existing Storyline'}
          </span>
          <span className="badge px-2 py-1 text-xs rounded-md" style={{ background: theme.fieldBg, color: theme.textMuted }}>
            {storylineConfig.count} images/character
          </span>
          {storylineConfig.genre && (
            <span className="badge px-2 py-1 text-xs rounded-md" style={{ background: `${theme.accent}20`, color: theme.accent }}>
              {GENRES[storylineConfig.genre]?.label || storylineConfig.genre}
            </span>
          )}
        </div>
        <button
          onClick={() => { setStep(1); setStorylineConfig(null) }}
          className="btn btn-ghost btn-sm"
          style={{ color: theme.textMuted }}
        >
          ← Change
        </button>
      </div>

      {/* Characters */}
      <div className="space-y-6 mb-8">
        {characters.map((char, idx) => (
          <CharacterSlot
            key={char.id}
            character={char}
            index={idx}
            theme={theme}
            onUpdate={(data) => updateCharacter(char.id, data)}
            onRemove={() => removeCharacter(char.id)}
            canRemove={characters.length > 1}
            generating={generating}
            failedImages={failedImages[char.id] || []}
            onRetry={(failedItem) => handleRetry(char.id, failedItem)}
            liveImages={liveImages[char.id] || []}
            expectedTotal={storylineConfig?.count || 5}
          />
        ))}
      </div>

      {/* Add character */}
      <button
        onClick={addCharacter}
        className="btn btn-outline w-full py-6 border-dashed"
        style={{ minHeight: '44px', color: theme.textBody, borderColor: theme.fieldBorder }}
      >
        <Plus className="w-5 h-5 mr-2" />
        Add Another Character
      </button>

      {/* Generate button */}
      <div className="mt-8">
        {(() => {
          const readyChars = characters.filter(c => (c.sourceImages && c.sourceImages.length > 0) || c.imageUrl)
          const allHaveImages = characters.every(c => (c.sourceImages && c.sourceImages.length > 0) || c.imageUrl)
          return (
            <button
              onClick={handleForge}
              className="btn btn-primary w-full text-lg"
              style={{ minHeight: '44px', background: theme.buttonGradient, border: 'none' }}
              disabled={generating || !allHaveImages}
            >
              {generating
                ? <span className="loading loading-spinner loading-sm mr-2" />
                : <Sparkles className="w-5 h-5 mr-2" />}
              Forge {readyChars.length} Character{readyChars.length !== 1 ? 's' : ''}
            </button>
          )
        })()}
      </div>
    </div>
  )
}

function CharacterSlot({ character, index, theme, onUpdate, onRemove, canRemove, generating, failedImages, onRetry, liveImages, expectedTotal, prefilled }) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div
      className="card bg-base-200 border border-base-300"
      style={{ background: theme.cardBg, borderColor: theme.cardBorder, backdropFilter: 'blur(12px)', contain: 'content' }}
    >
      <div
        className="flex items-center gap-4 cursor-pointer p-4"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 relative" style={{ background: theme.fieldBg }}>
          {(character.sourceImages && character.sourceImages[0]) || character.imageUrl ? (
            <>
              <img src={(character.sourceImages && character.sourceImages[0]) || character.imageUrl} alt="" className="w-full h-full object-cover" />
              {character.sourceImages && character.sourceImages.length > 1 && (
                <div className="absolute bottom-0 right-0 text-xs px-1 rounded-tl" style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}>
                  +{character.sourceImages.length - 1}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-8 h-8" style={{ color: theme.textMuted }} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{character.name || `Character ${index + 1}`}</span>
            {character.status && (
              <StatusBadge status={character.status} />
            )}
            {failedImages.length > 0 && (
              <span className="badge badge-error inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md" style={{ background: '#ef444420', color: '#ef4444' }}>
                <AlertCircle className="w-3 h-3" />
                {failedImages.length} failed
              </span>
            )}
          </div>
        </div>

        {canRemove && !generating && (
          <button
            onClick={e => { e.stopPropagation(); onRemove() }}
            className="btn btn-ghost flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
            style={{ minWidth: '44px', minHeight: '44px', color: theme.textMuted }}
            aria-label={`Remove character ${index + 1}`}
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}

        {expanded ? <ChevronUp className="w-5 h-5" style={{ color: theme.textMuted }} /> : <ChevronDown className="w-5 h-5" style={{ color: theme.textMuted }} />}
      </div>

      {/* Live image preview — shown while generating or after completion if images exist */}
      {liveImages.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.cardBorder}`, background: theme.fieldBg }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${theme.fieldBorder}` }}>
            {character.status === 'generating' && <span className="loading loading-spinner loading-xs" style={{ color: theme.primary }} />}
            {character.status === 'completed' && <Check className="w-3.5 h-3.5" style={{ color: theme.primary }} />}
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: theme.labelColor }}>
              {character.status === 'generating'
                ? `Generating… ${liveImages.length} ready`
                : `${liveImages.length} image${liveImages.length !== 1 ? 's' : ''} generated`}
            </span>
          </div>
          <div className="p-2 grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
            {liveImages.map((img, i) => (
              <div key={i} className="relative group/img rounded-lg overflow-hidden" style={{ aspectRatio: '3/4', background: theme.cardBg }}>
                <img
                  src={img.url}
                  alt={img.label}
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-x-0 bottom-0 px-1 py-0.5 opacity-0 group-hover/img:opacity-100 transition-opacity"
                  style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.75))', fontSize: '9px', color: 'white', lineHeight: 1.3 }}
                >
                  {img.label}
                </div>
              </div>
            ))}
            {/* Placeholder cells for images still in progress */}
            {character.status === 'generating' && (() => {
              const total = expectedTotal || character.variationCount || 5
              const remaining = Math.max(0, total - liveImages.length)
              return Array(remaining).fill(0).map((_, i) => (
                <div
                  key={`pending-${i}`}
                  className="rounded-lg flex items-center justify-center"
                  style={{ aspectRatio: '3/4', background: theme.cardBg, border: `1px dashed ${theme.fieldBorder}` }}
                >
                  <span className="loading loading-spinner loading-xs" style={{ color: theme.textMuted, opacity: 0.5 }} />
                </div>
              ))
            })()}
          </div>
        </div>
      )}

      {/* Failed images panel — always visible when there are failures, regardless of expanded */}
      {failedImages.length > 0 && (
        <div className="mx-4 mb-4 rounded-xl overflow-hidden" style={{ border: `1px solid #ef444440`, background: '#ef444408' }}>
          <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid #ef444430` }}>
            <AlertCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#ef4444' }}>
              Failed Generations — Manual Retry Required
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: '#ef444420' }}>
            {failedImages.map((fi, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: theme.textBody }}>
                    Image {fi.index} — {fi.label}
                  </div>
                  <div className="text-xs mt-0.5 truncate" style={{ color: '#ef4444' }}>
                    {fi.errorMsg}
                  </div>
                </div>
                <button
                  onClick={() => onRetry(fi)}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: generating ? '#ef444420' : '#ef444430',
                    color: '#ef4444',
                    border: '1px solid #ef444450',
                    cursor: generating ? 'not-allowed' : 'pointer',
                    opacity: generating ? 0.6 : 1,
                    minHeight: '36px',
                  }}
                >
                  {generating
                    ? <span className="loading loading-spinner loading-xs" />
                    : <RefreshCw className="w-3 h-3" />}
                  Retry
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="p-4 pt-0 space-y-4">
          {/* Pre-fill badge — only shown when character was pre-filled from a storyline */}
          {prefilled && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{
                background: `${theme.primary}15`,
                border:     `1px solid ${theme.primary}40`,
                fontSize:   'var(--font-size-label)',
                color:      theme.primary,
              }}
              aria-label="This character has fields pre-filled from the linked storyline"
            >
              <BookOpen className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              Pre-filled from storyline
            </div>
          )}
          <MultiUploadZone
            theme={theme}
            values={character.sourceImages || (character.imageUrl ? [character.imageUrl] : [])}
            onChange={(imgs) => onUpdate({ sourceImages: imgs, imageUrl: imgs[0] || null })}
            required
          />

          <div className="space-y-1">
            <label className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
              Character Name
            </label>
            <input
              type="text"
              value={character.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder={`Character ${index + 1}`}
              className="input input-bordered bg-base-300 w-full text-sm"
              style={{ height: '44px', background: theme.fieldBg, borderColor: theme.fieldBorder, color: theme.textBody }}
              autoCorrect="on"
            />
          </div>

          <div>
            <div className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
              Archetypes
            </div>
            <ArchetypePicker
              selected={character.archetypes || []}
              onChange={(archetypes) => onUpdate({ archetypes })}
              theme={theme}
            />
          </div>

          <div className="space-y-1">
            <label className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
              Character Arc
            </label>
            <textarea
              value={character.characterArc}
              onChange={(e) => onUpdate({ characterArc: e.target.value })}
              placeholder="Describe the character's narrative journey..."
              rows={3}
              className="textarea textarea-bordered bg-base-300 w-full text-sm resize-y"
              style={{ background: theme.fieldBg, borderColor: theme.fieldBorder, color: theme.textBody, minHeight: '96px' }}
              autoCorrect="on"
              spellCheck="true"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Toggle
              label="Keep Integrity"
              checked={character.keepIntegrity !== false}
              onChange={(checked) => onUpdate({ keepIntegrity: checked })}
              theme={theme}
            />
            <Toggle
              label="Remove Background"
              checked={character.removeBackground !== false}
              onChange={(checked) => onUpdate({ removeBackground: checked })}
              theme={theme}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
                Shot Type
              </div>
              <select
                value={character.shotType || 'Full-body'}
                onChange={e => onUpdate({ shotType: e.target.value })}
                className="select select-bordered bg-base-300 w-full text-sm"
              >
                {['Portrait', 'Half-body', 'Full-body'].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
                Aspect Ratio
              </div>
              <select
                value={character.aspectRatio || '3:4'}
                onChange={e => onUpdate({ aspectRatio: e.target.value })}
                className="select select-bordered bg-base-300 w-full text-sm"
              >
                {ASPECT_RATIOS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <Toggle
            label="Allow Held Items"
            checked={character.allowHeldItems || false}
            onChange={(checked) => onUpdate({ allowHeldItems: checked, propImageUrl: checked ? character.propImageUrl : null })}
            theme={theme}
          />

          {character.allowHeldItems && (
            <div className="space-y-3 pl-1 border-l-2" style={{ borderColor: theme.accent + '60' }}>
              <div className="space-y-1">
                <label className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
                  Permitted Items
                </label>
                <input
                  type="text"
                  value={character.allowedItems || ''}
                  onChange={(e) => onUpdate({ allowedItems: e.target.value })}
                  placeholder="e.g., sword, book, flowers"
                  className="input input-bordered bg-base-300 w-full text-sm"
                  style={{ height: '44px', background: theme.fieldBg, borderColor: theme.fieldBorder, color: theme.textBody }}
                  autoCorrect="on"
                />
              </div>
              <div>
                <div className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
                  <div className="flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Prop Reference Image
                    <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: theme.fieldBg, color: theme.textMuted }}>optional</span>
                  </div>
                </div>
                <p className="text-xs mb-2" style={{ color: theme.textMuted }}>
                  Upload a photo of the prop/item to ensure accurate visual replication.
                </p>
                <SingleUploadZone
                  theme={theme}
                  value={character.propImageUrl || null}
                  onChange={(url) => onUpdate({ propImageUrl: url })}
                  hint="Drop prop image or click to upload"
                  icon={Package}
                />
              </div>
            </div>
          )}

          <LayerControls
            poseOverrides={character.poseOverrides || []}
            expressionOverrides={character.expressionOverrides || []}
            outfitOverrides={character.outfitOverrides || []}
            onUpdate={(data) => onUpdate(data)}
            theme={theme}
          />
        </div>
      )}
    </div>
  )
}

function LayerControls({ poseOverrides, expressionOverrides, outfitOverrides, onUpdate, theme }) {
  return (
    <div className="space-y-3">
      <div className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
        Layer Overrides
      </div>
      
      <TagInput
        label="Pose"
        presets={POSE_PRESETS}
        tags={poseOverrides}
        onChange={(tags) => onUpdate({ poseOverrides: tags })}
        theme={theme}
      />
      
      <TagInput
        label="Expression"
        presets={EXPRESSION_PRESETS}
        tags={expressionOverrides}
        onChange={(tags) => onUpdate({ expressionOverrides: tags })}
        theme={theme}
      />
      
      <TagInput
        label="Outfit"
        presets={OUTFIT_PRESETS}
        tags={outfitOverrides}
        onChange={(tags) => onUpdate({ outfitOverrides: tags })}
        theme={theme}
      />
    </div>
  )
}

function TagInput({ label, presets, tags, onChange, theme }) {
  const [input, setInput] = useState('')

  const addTag = (tag) => {
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInput('')
  }

  const removeTag = (tag) => {
    onChange(tags.filter(t => t !== tag))
  }

  const togglePreset = (preset) => {
    if (tags.includes(preset)) {
      removeTag(preset)
    } else {
      addTag(preset)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${label} options`}>
        {presets.map(preset => (
          <button
            key={preset}
            onClick={() => togglePreset(preset)}
            className="chip-btn rounded-full transition-all"
            style={{
              background: tags.includes(preset) ? theme.primaryGlow : theme.fieldBg,
              color:      tags.includes(preset) ? theme.primary : theme.textMuted,
              border:     `1px solid ${tags.includes(preset) ? theme.primary : theme.fieldBorder}`,
            }}
            role="checkbox"
            aria-checked={tags.includes(preset)}
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTag(input)}
          placeholder={`Add custom ${label.toLowerCase()}...`}
          className="input input-bordered bg-base-300 flex-1 text-sm"
          style={{ height: '44px', background: theme.fieldBg, borderColor: theme.fieldBorder, color: theme.textBody }}
          autoCorrect="on"
        />
        <button
          onClick={() => addTag(input)}
          className="btn btn-outline btn-sm"
          style={{ minHeight: '44px', color: theme.textBody, borderColor: theme.fieldBorder }}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="badge inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md"
              style={{ background: theme.primaryGlow, color: theme.primary }}
            >
              {tag}
              <button onClick={() => removeTag(tag)}><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function NewStorylineModal({ theme, onClose, onConfirm }) {
  const [name, setName] = useState('')
  const [count, setCount] = useState(5)
  const [genre, setGenre] = useState('default')
  const [keepIntegrity, setKeepIntegrity] = useState(true)
  const [artStyle, setArtStyle] = useState('')
  const { setGenreKey } = useTheme()

  const handleConfirm = () => {
    if (!name.trim()) return
    setGenreKey(genre)
    onConfirm({
      storylineId: null,
      newStorylineName: name,
      count,
      genre,
      artStyle: keepIntegrity ? null : artStyle,
      keepIntegrity
    })
  }

  return (
    <Modal theme={theme} onClose={onClose} title="New Storyline">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
            Storyline Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Story"
            className="input input-bordered bg-base-300 w-full text-sm"
            style={{ height: '44px', background: theme.fieldBg, borderColor: theme.fieldBorder, color: theme.textBody }}
          />
        </div>

        <div>
          <div className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
            Images per Character
          </div>
          <input
            type="number"
            min="1"
            max="20"
            value={count}
            onChange={e => {
              const v = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
              setCount(v)
            }}
            className="input input-bordered bg-base-300 w-full text-sm"
            style={{
              height: '44px',
              background: theme.fieldBg,
              borderColor: theme.fieldBorder,
              color: theme.textBody,
            }}
            aria-label="Images per character"
          />
          <p className="mt-1 text-xs" style={{ color: theme.textMuted }}>Enter a number between 1 and 20</p>
        </div>

        <div>
          <div className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
            Genre
          </div>
          <select
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="select select-bordered bg-base-300 w-full"
          >
            {Object.entries(GENRES).map(([key, g]) => (
              <option key={key} value={key}>{g.emoji} {g.label}</option>
            ))}
          </select>
        </div>

        <Toggle label="Keep Reference Integrity" checked={keepIntegrity} onChange={setKeepIntegrity} theme={theme} />

        {!keepIntegrity && (
          <div>
            <div className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
              Art Style
            </div>
            <select
              value={artStyle}
              onChange={(e) => setArtStyle(e.target.value)}
              className="select select-bordered bg-base-300 w-full"
            >
              <option value="">Select style...</option>
              {ART_STYLES.map(cat => (
                <optgroup key={cat.category} label={cat.category}>
                  {cat.options.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleConfirm}
          className="btn btn-primary w-full"
          style={{ minHeight: '44px', background: theme.buttonGradient, border: 'none' }}
          disabled={!name.trim()}
        >
          Create Storyline
        </button>
      </div>
    </Modal>
  )
}

function ExistingStorylineModal({ theme, storylines, onClose, onConfirm }) {
  return (
    <Modal theme={theme} onClose={onClose} title="Select Storyline">
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {storylines.map(sl => (
          <button
            key={sl.id}
            onClick={() => onConfirm({ storylineId: sl.id, newStorylineName: null, count: 5, genre: null, artStyle: null })}
            className="w-full p-3 rounded-lg text-left transition-all hover:opacity-80"
            style={{ background: theme.fieldBg, border: `1px solid ${theme.fieldBorder}` }}
          >
            <div className="font-medium" style={{ color: theme.textBody }}>{sl.name}</div>
            <div className="text-xs" style={{ color: theme.textMuted }}>
              {sl.batch_ids?.length || 0} characters • Created {new Date(sl.created_at).toLocaleDateString()}
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}

function Toggle({ label, checked, onChange, theme }) {
  return (
    <label
      className="flex items-center justify-between cursor-pointer"
      style={{ minHeight: '44px' }}
    >
      <span className="text-sm" style={{ color: theme.textBody }}>{label}</span>
      <input
        type="checkbox"
        className="toggle toggle-primary"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ '--tglbg': checked ? theme.primary : theme.fieldBg }}
        aria-label={label}
      />
    </label>
  )
}

function Modal({ children, theme, onClose, title }) {
  const [dragOffset, setDragOffset] = useState(0)
  const dragStart = useRef(0)
  const dragging = useRef(false)

  // Only initiate drag-to-dismiss when the touch starts on the sheet itself,
  // not on interactive children (inputs, selects, buttons, textareas).
  const INTERACTIVE = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'LABEL']
  const handleTouchStart = e => {
    if (INTERACTIVE.includes(e.target.tagName)) return
    dragStart.current = e.touches[0].clientY
    dragging.current = true
  }
  const handleTouchMove = e => {
    if (!dragging.current) return
    const dy = e.touches[0].clientY - dragStart.current
    if (dy > 0) setDragOffset(dy)
  }
  const handleTouchEnd = () => {
    if (!dragging.current) return
    dragging.current = false
    if (dragOffset > 80) { setDragOffset(0); onClose() }
    else setDragOffset(0)
  }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Mobile bottom sheet */}
      <div
        className="bottom-sheet md:hidden absolute bottom-0 left-0 right-0 rounded-t-2xl"
        style={{
          background:    theme.cardBg,
          border:        `1px solid ${theme.cardBorder}`,
          borderBottom:  'none',
          transform:     `translateY(${dragOffset}px)`,
          transition:    dragOffset === 0 ? 'transform 0.3s cubic-bezier(0.32,0.72,0,1)' : 'none',
          paddingBottom: `calc(var(--safe-bottom) + 1rem)`,
          maxHeight:     '85vh',
          overflowY:     'auto',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex justify-center pt-3 pb-2" aria-hidden="true">
          <div className="w-10 h-1 rounded-full" style={{ background: theme.fieldBorder }} />
        </div>
        <div className="px-5 pb-2">
          <h3 className="font-bold mb-4" style={{ fontSize: 'var(--font-size-heading)', color: theme.textBody }}>{title}</h3>
          {children}
        </div>
      </div>

      {/* Desktop centered dialog */}
      <div className="hidden md:flex absolute inset-0 items-center justify-center p-4">
        <div className="modal-box relative w-full max-w-md rounded-2xl p-6" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }}>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle absolute top-4 right-4 flex items-center justify-center rounded-lg hover:bg-white/10"
            style={{ minWidth: '44px', minHeight: '44px' }}
            aria-label="Close"
          >
            <X className="w-5 h-5" style={{ color: theme.textMuted }} aria-hidden="true" />
          </button>
          <h3 className="font-bold mb-4" style={{ fontSize: 'var(--font-size-heading)', color: theme.textBody }}>{title}</h3>
          {children}
        </div>
      </div>
    </div>
  )
}

// Utility: resize a File to max 1024px and return base64 JPEG data URL
async function resizeImageFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxSize = 1024
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width; width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height; height = maxSize
        }
        canvas.width = width; canvas.height = height
        canvas.getContext('2d').drawImage(img, 0, 0, width, height)
        const mediaType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
        resolve(canvas.toDataURL(mediaType, mediaType === 'image/png' ? undefined : 0.8))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

// Multi-image upload zone — accepts multiple source images, requires at least 1
function MultiUploadZone({ theme, values, onChange, required = false }) {
  const inputRef = useRef(null)

  const handleFiles = async (files) => {
    const imageFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (!imageFiles.length) return
    const resized = await Promise.all(imageFiles.map(resizeImageFile))
    onChange([...values, ...resized])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const removeImage = (idx) => {
    onChange(values.filter((_, i) => i !== idx))
  }

  const hasImages = values && values.length > 0
  const missingRequired = required && !hasImages

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="label label-text font-medium uppercase tracking-widest mb-1" style={{ fontSize: 'var(--font-size-label)', color: theme.labelColor }}>
          Source Images
          {required && <span className="ml-1" style={{ color: missingRequired ? '#ef4444' : theme.accent }}>*</span>}
        </div>
        {hasImages && (
          <span className="text-xs" style={{ color: theme.textMuted }}>{values.length} image{values.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Thumbnails grid */}
      {hasImages && (
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map((src, idx) => (
            <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0" style={{ border: `1px solid ${theme.fieldBorder}` }}>
              <img src={src} alt={`Reference ${idx + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              {/* Remove button — always visible, top-right corner, 36×36px */}
              <button
                onClick={e => { e.stopPropagation(); removeImage(idx) }}
                className="absolute top-1 right-1 flex items-center justify-center rounded-full bg-black/70 hover:bg-black/90 transition-colors"
                style={{ width: '28px', height: '28px' }}
                aria-label={`Remove reference image ${idx + 1}`}
              >
                <X className="w-3.5 h-3.5 text-white" aria-hidden="true" />
              </button>
              {idx === 0 && (
                <div className="absolute bottom-0 left-0 right-0 text-center text-xs py-0.5" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                  Primary
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:opacity-80"
        style={{
          borderColor: missingRequired ? '#ef4444' : theme.fieldBorder,
          background: missingRequired ? '#ef444408' : theme.fieldBg,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <ImagePlus className="w-6 h-6 mx-auto mb-1" style={{ color: missingRequired ? '#ef4444' : theme.textMuted }} />
        <p className="text-xs" style={{ color: missingRequired ? '#ef4444' : theme.textMuted }}>
          {hasImages ? 'Add more reference images' : 'Drop images or click to upload'}
        </p>
        {missingRequired && (
          <p className="text-xs mt-1 font-medium" style={{ color: '#ef4444' }}>At least one source image is required</p>
        )}
      </div>
    </div>
  )
}

// Single-image upload zone — used for prop reference
function SingleUploadZone({ theme, value, onChange, hint, icon: IconProp = Upload }) {
  const Icon = IconProp;
  const inputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    const dataUrl = await resizeImageFile(file)
    onChange(dataUrl)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all hover:opacity-80"
      style={{ borderColor: theme.fieldBorder, background: theme.fieldBg }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files[0])}
      />
      {value ? (
        <div className="relative">
          <img src={value} alt="" className="max-h-36 mx-auto rounded-lg" />
          <button
            onClick={(e) => { e.stopPropagation(); onChange(null) }}
            className="absolute top-2 right-2 p-1 rounded-full bg-black/50"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      ) : (
        <div>
          <Icon className="w-6 h-6 mx-auto mb-1" style={{ color: theme.textMuted }} />
          {hint && <p className="text-xs" style={{ color: theme.textMuted }}>{hint}</p>}
        </div>
      )}
    </div>
  )
}

function ArchetypePicker({ selected, onChange, theme }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Character archetypes">
      {ARCHETYPES.map(arch => {
        const isSelected = selected.includes(arch.id)
        return (
          <button
            key={arch.id}
            onClick={() => isSelected ? onChange(selected.filter(a => a !== arch.id)) : onChange([...selected, arch.id])}
            className="chip-btn rounded-full transition-all"
            style={{
              background: isSelected ? theme.primaryGlow : theme.fieldBg,
              color:      isSelected ? theme.primary : theme.textMuted,
              border:     `1px solid ${isSelected ? theme.primary : theme.fieldBorder}`,
            }}
            title={arch.desc}
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`${arch.label}: ${arch.desc}`}
          >
            {arch.label}
          </button>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }) {
  const variantMap = {
    analyzing: 'badge-info',
    generating: 'badge-warning',
    completed: 'badge-success',
    failed: 'badge-error',
  }
  const colorMap = {
    analyzing: { bg: '#3b82f620', color: '#3b82f6' },
    generating: { bg: '#f59e0b20', color: '#f59e0b' },
    completed: { bg: '#10b98120', color: '#10b981' },
    failed: { bg: '#ef444420', color: '#ef4444' },
  }
  const c = colorMap[status] || colorMap.analyzing

  return (
    <span
      className={`badge ${variantMap[status] || 'badge-info'} inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md`}
      style={{ background: c.bg, color: c.color }}
    >
      {(status === 'analyzing' || status === 'generating') && (
        <span className="loading loading-spinner loading-xs" />
      )}
      {status}
    </span>
  )
}

function useLocationResetKey() {
  const location = useLocation()
  const [resetKey, setResetKey] = useState(0)

  useEffect(() => {
    if (!location.state?.reset) return
    const id = requestAnimationFrame(() => setResetKey(location.state.reset))
    return () => cancelAnimationFrame(id)
  }, [location.state])

  return resetKey
}

function createEmptyCharacter() {
  return {
    id: crypto.randomUUID(),
    name: '',
    imageUrl: null,          // legacy single — kept for backwards compat
    sourceImages: [],        // array of base64 data URLs (multiple source images)
    propImageUrl: null,      // optional prop/item reference image
    characterDescription: '',
    archetypes: [],
    characterArc: '',
    keepIntegrity: true,
    removeBackground: true,
    shotType: 'Full-body',
    aspectRatio: '3:4',
    allowHeldItems: false,
    allowedItems: '',
    poseOverrides: [],
    expressionOverrides: [],
    outfitOverrides: [],
    variationCount: 5,
    status: null,
  }
}

function buildGenerationPrompt(char, description, variation, genre, shotType, aspectRatio, keepIntegrity, removeBackground, allowedItems, hasPropImage) {
  const integrityInstructions = keepIntegrity
    ? 'Strict pixel-faithful reproduction — same art style, colors, clothing, proportions — ONLY pose and expression change'
    : `COMPLETELY REIMAGINE this character in the art style: ${char.artStyle || 'default anime style'}. Fully transform rendering, linework, shading, color palette.`

  let shotInstructions = ''
  if (shotType === 'Portrait') shotInstructions = 'frame from chest up'
  else if (shotType === 'Half-body') shotInstructions = 'frame from waist up'
  else shotInstructions = 'entire character head to toe must be visible'

  const backgroundRule = removeBackground ? 'Remove all background — character as isolated subject' : ''
  const heldItemsRule = !allowedItems ? 'NO holding, gripping, or touching any prop, weapon, or item' : `May hold: ${allowedItems}`
  const propNote = hasPropImage ? `\n- The last provided reference image shows the prop/item — replicate it accurately in the character's hand` : ''

  const genreVibe = GENRE_VIBES[genre] || ''

  return `Generate an image of this exact character in a specific pose and emotional state.

CHARACTER DESCRIPTION (must match exactly):
${description}

POSE: ${variation.pose}
EMOTION/EXPRESSION: ${variation.emotion}
${genreVibe}

${integrityInstructions}

SHOT: ${shotInstructions}
OUTPUT ASPECT RATIO: ${aspectRatio}

CRITICAL SPRITE RULES:
- The character MUST be standing freely, as a self-contained figure
- NO leaning against walls, furniture, or any surface
- NO sitting in chairs, on beds, at desks, or on any object
- NO interacting with any environmental object whatsoever
- ${heldItemsRule}${propNote}
- ${backgroundRule}`
}
