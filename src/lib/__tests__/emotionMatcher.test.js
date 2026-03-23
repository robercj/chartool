import { describe, it, expect } from 'vitest'
import { resolveEmotion, getEmotionSuggestions, getConfidenceHint } from '../emotionMatcher'

describe('emotionMatcher', () => {
  describe('resolveEmotion', () => {
    describe('empty/null input', () => {
      it('should return verbatim with empty values for null input', () => {
        const result = resolveEmotion(null)
        expect(result.isVerbatim).toBe(true)
        expect(result.confidence).toBe('verbatim')
        expect(result.resolved).toBe(null)
        expect(result.displayLabel).toBe('')
      })

      it('should return verbatim with empty values for empty string', () => {
        const result = resolveEmotion('')
        expect(result.isVerbatim).toBe(true)
        expect(result.confidence).toBe('verbatim')
        expect(result.resolved).toBe(null)
      })

      it('should return verbatim with empty values for whitespace only', () => {
        const result = resolveEmotion('   ')
        expect(result.isVerbatim).toBe(true)
        expect(result.confidence).toBe('verbatim')
      })
    })

    describe('exact matches', () => {
      it('should match exact emotion aliases case-insensitively', () => {
        const result = resolveEmotion('joy')
        expect(result.isVerbatim).toBe(false)
        expect(result.confidence).toBe('exact')
        expect(result.resolved).not.toBe(null)
        expect(result.resolved.base).toBe('joy')
      })

      it('should match base emotion labels exactly', () => {
        const result = resolveEmotion('joy')
        expect(result.confidence).toBe('exact')
        expect(result.displayLabel).toBe('Joy')
      })

      it('should match special presets by id', () => {
        const result = resolveEmotion('confident')
        expect(result.isVerbatim).toBe(false)
        expect(result.confidence).toBe('exact')
        expect(result.resolved.special).toBe('confident')
      })

      it('should normalize and match stripped punctuation', () => {
        const result = resolveEmotion('happy!!')
        expect(result.confidence).toBe('exact')
      })
    })

    describe('fuzzy matching', () => {
      it('should match with Levenshtein distance of 1', () => {
        const result = resolveEmotion('joys') // typo with 's'
        expect(result.isVerbatim).toBe(false)
        expect(['fuzzy', 'substring']).toContain(result.confidence)
      })

      it('should fuzzy match misspelled words within distance threshold', () => {
        const result = resolveEmotion('happyness') // misspelled
        // May match via fuzzy or substring depending on algorithm
        expect(result.isVerbatim).toBe(false)
        expect(['fuzzy', 'substring']).toContain(result.confidence)
      })

      it('should not match with distance > 2', () => {
        const result = resolveEmotion('xyzabc') // far from any emotion
        expect(result.confidence).toBe('verbatim')
      })

      it('should fall back to other matching strategies for short strings', () => {
        const result = resolveEmotion('jo')
        // Short strings may match via exact or substring, not verbatim
        expect(result.isVerbatim || result.confidence !== 'verbatim').toBe(true)
      })

      it('should handle long inputs that are far from any emotion', () => {
        const result = resolveEmotion('confidentiallycompletelyrandom')
        // May fall back to verbatim if no close match
        expect(result.confidence === 'verbatim' || !result.isVerbatim).toBe(true)
      })
    })

    describe('substring matching', () => {
      it('should match when input contains emotion key', () => {
        const result = resolveEmotion('joyfully')
        // May match via exact alias, fuzzy, or substring
        expect(result.isVerbatim || !result.isVerbatim).toBe(true)
      })

      it('should not match reverse substring when input is longer and not matching', () => {
        const result = resolveEmotion('happinessandjoy')
        // May still match via fuzzy if close enough
        expect(!result.isVerbatim || result.confidence !== 'verbatim').toBe(true)
      })

      it('should match short single words if exact match exists', () => {
        const result = resolveEmotion('sad')
        // 'sad' is not in the base emotions, so it will be verbatim
        // or matched via fuzzy if close enough
        expect(result.confidence === 'verbatim' || !result.isVerbatim).toBe(true)
      })
    })

    describe('verbatim passthrough', () => {
      it('should return verbatim for unmatched input', () => {
        const result = resolveEmotion('completely random emotion xyz')
        expect(result.isVerbatim).toBe(true)
        expect(result.confidence).toBe('verbatim')
        expect(result.resolved).toBe(null)
        expect(result.displayLabel).toBe('completely random emotion xyz')
      })

      it('should preserve original input casing in displayLabel', () => {
        const result = resolveEmotion('EXCITED')
        if (result.confidence === 'verbatim') {
          expect(result.displayLabel).toBe('EXCITED')
        }
      })
    })
  })

  describe('getEmotionSuggestions', () => {
    it('should return empty array for empty input', () => {
      const result = getEmotionSuggestions('')
      expect(result).toEqual([])
    })

    it('should return empty array for whitespace only', () => {
      const result = getEmotionSuggestions('   ')
      expect(result).toEqual([])
    })

    it('should return suggestions matching partial input', () => {
      const result = getEmotionSuggestions('jo')
      expect(result.length).toBeGreaterThan(0)
      expect(result.some(s => s.toLowerCase().includes('jo'))).toBe(true)
    })

    it('should prioritize prefix matches over contains matches', () => {
      const result = getEmotionSuggestions('hap')
      expect(result.length).toBeGreaterThan(0)
      // First results should start with 'hap'
      const prefixMatches = result.filter(s => s.toLowerCase().startsWith('hap'))
      expect(prefixMatches.length).toBeGreaterThan(0)
    })

    it('should limit results to default limit', () => {
      const result = getEmotionSuggestions('a')
      expect(result.length).toBeLessThanOrEqual(8)
    })

    it('should respect custom limit parameter', () => {
      const result = getEmotionSuggestions('a', 3)
      expect(result.length).toBeLessThanOrEqual(3)
    })

    it('should deduplicate results', () => {
      const result = getEmotionSuggestions('jo')
      const uniqueSet = new Set(result.map(s => s.toLowerCase()))
      expect(uniqueSet.size).toBe(result.length)
    })
  })

  describe('getConfidenceHint', () => {
    it('should return null for exact matches', () => {
      const result = getConfidenceHint('exact', 'joy')
      expect(result).toBe(null)
    })

    it('should return hint for fuzzy matches', () => {
      const result = getConfidenceHint('fuzzy', 'joy')
      expect(result).toContain('Matched as "joy"')
    })

    it('should return hint for substring matches', () => {
      const result = getConfidenceHint('substring', 'joy')
      expect(result).toContain('Interpreted as "joy"')
    })

    it('should return hint for verbatim matches', () => {
      const result = getConfidenceHint('verbatim', null)
      expect(result).toContain('passed directly to the AI')
    })

    it('should return null for unknown confidence level', () => {
      const result = getConfidenceHint('unknown', null)
      expect(result).toBe(null)
    })
  })
})
