import { describe, it, expect } from 'vitest'
import { compileSpritePrompt, compileEditPrompt, resolveVariationSpecs } from '../promptCompiler'

describe('promptCompiler', () => {
  describe('compileSpritePrompt', () => {
    describe('section ordering', () => {
      it('should always include identity lock section first when provided', () => {
        const result = compileSpritePrompt({
          identityLock: {
            immutable_traits: {
              face: ['round face'],
              hair: ['black hair'],
              eyes: ['brown eyes'],
            },
            notes: ['Keep style consistent'],
          },
        })

        const identityLockIndex = result.indexOf('## CHARACTER IDENTITY LOCK')
        expect(identityLockIndex).toBe(0)
      })

      it('should include forbidden changes section', () => {
        const result = compileSpritePrompt({
          identityLock: { immutable_traits: {} },
        })

        expect(result).toContain('## FORBIDDEN CHANGES')
      })

      it('should include critical constraints footer last', () => {
        const result = compileSpritePrompt({})

        const criticalIndex = result.indexOf('## CRITICAL GENERATION CONSTRAINTS')
        const lastIndex = result.lastIndexOf('## CRITICAL GENERATION CONSTRAINTS')
        expect(criticalIndex).toBe(lastIndex)
      })
    })

    describe('identity lock section', () => {
      it('should output face traits with IMMUTABLE label', () => {
        const result = compileSpritePrompt({
          identityLock: {
            immutable_traits: {
              face: ['round face shape', 'rosy cheeks'],
            },
          },
        })

        expect(result).toContain('**Face** (IMMUTABLE):')
        expect(result).toContain('- round face shape')
        expect(result).toContain('- rosy cheeks')
      })

      it('should output hair traits with IMMUTABLE label', () => {
        const result = compileSpritePrompt({
          identityLock: {
            immutable_traits: {
              hair: ['long black hair'],
            },
          },
        })

        expect(result).toContain('**Hair** (IMMUTABLE):')
        expect(result).toContain('- long black hair')
      })

      it('should output outfit traits when present', () => {
        const result = compileSpritePrompt({
          identityLock: {
            immutable_traits: {
              outfit: ['blue school uniform'],
            },
          },
        })

        expect(result).toContain('**Outfit** (IMMUTABLE):')
        expect(result).toContain('- blue school uniform')
      })

      it('should output identity notes when present', () => {
        const result = compileSpritePrompt({
          identityLock: {
            immutable_traits: {},
            notes: ['Keep anime style consistent'],
          },
        })

        expect(result).toContain('**Identity Notes**:')
        expect(result).toContain('- Keep anime style consistent')
      })

      it('should use consistency prompt as fallback when no identityLock', () => {
        const result = compileSpritePrompt({
          consistencyPrompt: 'Character has blue hair and red eyes',
        })

        expect(result).toContain('## CHARACTER IDENTITY LOCK')
        expect(result).toContain('Character has blue hair and red eyes')
      })

      it('should skip identity section entirely when neither provided', () => {
        const result = compileSpritePrompt({})

        expect(result).not.toContain('## CHARACTER IDENTITY LOCK')
      })
    })

    describe('forbidden changes section', () => {
      it('should always include core facial constraints', () => {
        const result = compileSpritePrompt({
          identityLock: { immutable_traits: {} },
        })

        expect(result).toContain('DO NOT alter facial structure')
        expect(result).toContain('DO NOT change hair color')
        expect(result).toContain('DO NOT change eye color')
        expect(result).toContain('DO NOT alter skin tone')
      })

      it('should include clothing constraints when allowClothing is false', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          allowClothing: false,
        })

        expect(result).toContain('DO NOT change, swap, or modify the outfit')
        expect(result).toContain('clothing is identity-locked')
      })

      it('should NOT include clothing constraints when allowClothing is true', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          allowClothing: true,
        })

        expect(result).not.toContain('DO NOT change, swap, or modify the outfit')
      })

      it('should include props constraints when allowProps is false', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          allowProps: false,
        })

        expect(result).toContain('DO NOT add props')
      })

      it('should NOT include props constraints when allowProps is true', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          allowProps: true,
        })

        expect(result).not.toContain('DO NOT add props')
      })

      it('should merge custom forbidden changes with core constraints', () => {
        const result = compileSpritePrompt({
          identityLock: {
            forbidden_changes: ['DO NOT show weapons'],
          },
        })

        expect(result).toContain('DO NOT show weapons')
        expect(result).toContain('DO NOT alter facial structure')
      })

      it('should deduplicate identical constraints', () => {
        const result = compileSpritePrompt({
          identityLock: {
            forbidden_changes: [
              'Keep anime art style',
              'Keep anime art style', // duplicate
            ],
          },
        })

        const matches = result.match(/Keep anime art style/g)
        expect(matches).toHaveLength(1)
      })
    })

    describe('pose & emotion section', () => {
      it('should include pose when poseId provided', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          poseId: 'neutral',
        })

        expect(result).toContain('## POSE & EMOTION FOR THIS VARIATION')
      })

      it('should include emotion instructions when emotionEntry provided', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          emotionEntry: {
            resolved: { base: 'joy', tier: 'average' },
            isVerbatim: false,
            rawInput: 'happy',
            intensity: 'average',
            modifiers: '',
          },
        })

        expect(result).toContain('## POSE & EMOTION FOR THIS VARIATION')
        expect(result).toContain('**Emotion**:')
      })

      it('should include verbatim emotion input directly', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          emotionEntry: {
            resolved: null,
            isVerbatim: true,
            rawInput: 'custom emotion expression',
            intensity: 'high',
            modifiers: '',
          },
        })

        expect(result).toContain('**Emotion**: custom emotion expression')
      })
    })

    describe('user direction section', () => {
      it('should include user direction when allowPrompt is true and customPrompt provided', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          allowPrompt: true,
          customPrompt: 'Make the character look excited',
        })

        expect(result).toContain('## USER DIRECTION')
        expect(result).toContain('Make the character look excited')
      })

      it('should NOT include user direction when allowPrompt is false', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          allowPrompt: false,
          customPrompt: 'Some direction',
        })

        expect(result).not.toContain('## USER DIRECTION')
      })

      it('should NOT include user direction when customPrompt is empty', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          allowPrompt: true,
          customPrompt: '',
        })

        expect(result).not.toContain('## USER DIRECTION')
      })
    })

    describe('clothing section', () => {
      it('should include clothing change when allowed and provided', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          allowClothing: true,
          clothingDescription: 'Switch to formal attire',
        })

        expect(result).toContain('## CLOTHING VARIATION')
        expect(result).toContain('Switch to formal attire')
      })

      it('should NOT include clothing section when allowClothing is false', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          allowClothing: false,
          clothingDescription: 'Some clothing',
        })

        expect(result).not.toContain('## CLOTHING VARIATION')
      })
    })

    describe('edit instructions section', () => {
      it('should include edit instructions when provided', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          editInstructions: 'Change the background to sunset',
        })

        expect(result).toContain('## EDIT INSTRUCTIONS')
        expect(result).toContain('Change the background to sunset')
      })
    })

    describe('sections separation', () => {
      it('should separate sections with ---', () => {
        const result = compileSpritePrompt({
          identityLock: { immutable_traits: { face: ['round'] } },
        })

        expect(result).toContain('---')
      })

      it('should filter out empty sections', () => {
        const result = compileSpritePrompt({
          identityLock: {},
          emotionEntry: null,
          allowPrompt: false,
          allowClothing: false,
          editInstructions: '',
        })

        // Should not have multiple --- in a row from empty sections
        expect(result).not.toMatch(/---\s*---/)
      })
    })
  })

  describe('compileEditPrompt', () => {
    it('should always disable custom prompt for edit flow', () => {
      const result = compileEditPrompt({
        identityLock: {},
        editInstructions: 'Make changes',
        originalPoseId: 'neutral',
        originalEmotionEntry: { resolved: { base: 'joy' }, isVerbatim: false },
      })

      expect(result).not.toContain('## USER DIRECTION')
    })

    it('should preserve original pose and emotion', () => {
      const result = compileEditPrompt({
        identityLock: {},
        originalPoseId: 'arms_crossed',
        originalEmotionEntry: {
          resolved: { base: 'anger' },
          isVerbatim: false,
        },
        editInstructions: 'Fix the eyes',
      })

      expect(result).toContain('## POSE & EMOTION FOR THIS VARIATION')
    })
  })

  describe('resolveVariationSpecs', () => {
    const mockRandomPool = [
      { base: 'joy', tier: 'average' },
      { base: 'sadness', tier: 'subtle' },
      { base: 'anger', tier: 'high' },
    ]

    const mockPosePool = [
      { id: 'neutral', promptText: 'Standing straight neutral' },
      { id: 'arms_crossed', promptText: 'Arms crossed' },
    ]

    it('should return user-provided entries first', () => {
      const userEntries = [
        { emotion: 'joy', rawInput: 'joy', resolved: { base: 'joy' }, isVerbatim: false },
        { emotion: 'sad', rawInput: 'sad', resolved: { base: 'sadness' }, isVerbatim: false },
      ]

      const result = resolveVariationSpecs(userEntries, 'neutral', 4, mockRandomPool, mockPosePool)

      expect(result[0].emotionEntry.emotion).toBe('joy')
      expect(result[1].emotionEntry.emotion).toBe('sad')
    })

    it('should fill remaining slots with random entries', () => {
      const userEntries = [
        { emotion: 'joy', rawInput: 'joy', resolved: { base: 'joy' }, isVerbatim: false },
      ]

      const result = resolveVariationSpecs(userEntries, 'neutral', 4, mockRandomPool, mockPosePool)

      expect(result.length).toBe(4)
      expect(result[1].emotionEntry).toBeDefined()
      expect(result[1].emotionEntry.resolved.base).toBeDefined()
    })

    it('should handle no user entries', () => {
      const result = resolveVariationSpecs([], 'neutral', 3, mockRandomPool, mockPosePool)

      expect(result.length).toBe(3)
      result.forEach(spec => {
        expect(spec.emotionEntry.resolved).toBeDefined()
        expect(spec.poseId).toBe('neutral')
      })
    })

    it('should respect count parameter exactly', () => {
      const result = resolveVariationSpecs([], 'neutral', 5, mockRandomPool, mockPosePool)

      expect(result.length).toBe(5)
    })

    it('should use random pose when poseId is random', () => {
      const result = resolveVariationSpecs([], 'random', 3, mockRandomPool, mockPosePool)

      expect(result.length).toBe(3)
      // Each should have a valid pose ID from the pool
      const validPoseIds = mockPosePool.map(p => p.id)
      result.forEach(spec => {
        expect(validPoseIds).toContain(spec.poseId)
      })
    })

    it('should not exceed count when user entries exceed requested count', () => {
      const userEntries = [
        { emotion: 'joy', rawInput: 'joy', resolved: { base: 'joy' }, isVerbatim: false },
        { emotion: 'sad', rawInput: 'sad', resolved: { base: 'sadness' }, isVerbatim: false },
        { emotion: 'angry', rawInput: 'angry', resolved: { base: 'anger' }, isVerbatim: false },
        { emotion: 'fear', rawInput: 'fear', resolved: { base: 'fear' }, isVerbatim: false },
      ]

      const result = resolveVariationSpecs(userEntries, 'neutral', 2, mockRandomPool, mockPosePool)

      expect(result.length).toBe(2)
    })

    it('should include proper emotionEntry structure for random entries', () => {
      const result = resolveVariationSpecs([], 'neutral', 1, mockRandomPool, mockPosePool)

      const randomEntry = result[0].emotionEntry
      expect(randomEntry.emotion).toBeDefined()
      expect(randomEntry.rawInput).toBeDefined()
      expect(randomEntry.intensity).toBeDefined()
      expect(randomEntry.resolved).toBeDefined()
      expect(randomEntry.isVerbatim).toBe(false)
    })
  })
})
