// @ts-ignore - typo-js doesn't have type definitions
import Typo from 'typo-js';

/**
 * Spell checker utility with auto-correct functionality
 * Uses Typo.js for efficient dictionary-based spell checking
 */
class SpellChecker {
  private dictionary: Typo | null = null;
  private autoCorrectCache: Map<string, string> = new Map();
  private customDictionary: Set<string> = new Set();
  private isInitialized: boolean = false;

  /**
   * Initialize the spell checker with US English dictionary
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Typo.js requires dictionary files - we'll use a CDN or local files
      // For now, create a basic implementation with common corrections
      this.dictionary = new Typo('en_US', '', '', { 
        dictionaryPath: 'https://cdn.jsdelivr.net/codemirror.spell-checker/latest/',
      });
      
      this.loadCommonAutoCorrections();
      this.loadCustomDictionary();
      this.isInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize full dictionary, using fallback mode:', error);
      this.loadCommonAutoCorrections();
      this.isInitialized = true;
    }
  }

  /**
   * Load common auto-corrections for seamless typing experience
   */
  private loadCommonAutoCorrections(): void {
    const corrections: Record<string, string> = {
      // Common typos
      'teh': 'the',
      'hte': 'the',
      'adn': 'and',
      'nad': 'and',
      'taht': 'that',
      'waht': 'what',
      'wnat': 'want',
      'wnats': 'wants',
      'recieve': 'receive',
      'beleive': 'believe',
      'acheive': 'achieve',
      'occured': 'occurred',
      'occurence': 'occurrence',
      'seperate': 'separate',
      'definately': 'definitely',
      'untill': 'until',
      'realy': 'really',
      'basicly': 'basically',
      'finaly': 'finally',
      'wich': 'which',
      'thier': 'their',
      'freind': 'friend',
      'wierd': 'weird',
      'becuase': 'because',
      'publically': 'publicly',
      'arguement': 'argument',
      'begining': 'beginning',
      'tommorrow': 'tomorrow',
      'accomodate': 'accommodate',
      'profesional': 'professional',
      'occassion': 'occasion',
      'recomend': 'recommend',
      'sieze': 'seize',
      'foriegn': 'foreign',
      'heighth': 'height',
      'alot': 'a lot',
      'aswell': 'as well',
      'noone': 'no one',
      'cannot': 'cannot', // keep this form
      'wont': "won't",
      'cant': "can't",
      'dont': "don't",
      'didnt': "didn't",
      'doesnt': "doesn't",
      'wouldnt': "wouldn't",
      'shouldnt': "shouldn't",
      'couldnt': "couldn't",
      'wasnt': "wasn't",
      'werent': "weren't",
      'hasnt': "hasn't",
      'havent': "haven't",
      'isnt': "isn't",
      'arent': "aren't",
      
      // Capitalization
      'i': 'I',
      'im': "I'm",
      'ive': "I've",
      'id': "I'd",
      'ill': "I'll",
    };

    for (const [wrong, correct] of Object.entries(corrections)) {
      this.autoCorrectCache.set(wrong.toLowerCase(), correct);
    }
  }

  /**
   * Load user's custom dictionary from localStorage
   */
  private loadCustomDictionary(): void {
    try {
      const saved = localStorage.getItem('customDictionary');
      if (saved) {
        const words = JSON.parse(saved) as string[];
        words.forEach(word => this.customDictionary.add(word.toLowerCase()));
      }
    } catch (error) {
      console.warn('Failed to load custom dictionary:', error);
    }
  }

  /**
   * Save custom dictionary to localStorage
   */
  private saveCustomDictionary(): void {
    try {
      const words = Array.from(this.customDictionary);
      localStorage.setItem('customDictionary', JSON.stringify(words));
    } catch (error) {
      console.warn('Failed to save custom dictionary:', error);
    }
  }

  /**
   * Add word to custom dictionary
   */
  addToCustomDictionary(word: string): void {
    this.customDictionary.add(word.toLowerCase());
    this.saveCustomDictionary();
  }

  /**
   * Remove word from custom dictionary
   */
  removeFromCustomDictionary(word: string): void {
    this.customDictionary.delete(word.toLowerCase());
    this.saveCustomDictionary();
  }

  /**
   * Check if a word is spelled correctly
   */
  isCorrect(word: string): boolean {
    if (!word || word.length < 2) return true;
    
    const lowerWord = word.toLowerCase();
    
    // Check custom dictionary first
    if (this.customDictionary.has(lowerWord)) return true;
    
    // Check if it's a proper noun (capitalized)
    if (/^[A-Z][a-z]+$/.test(word)) return true;
    
    // Check if it's a number or contains numbers
    if (/\d/.test(word)) return true;
    
    // Use dictionary if available
    if (this.dictionary) {
      return this.dictionary.check(word);
    }
    
    // Fallback: consider it correct if not in auto-correct cache
    return !this.autoCorrectCache.has(lowerWord);
  }

  /**
   * Get auto-correction for a misspelled word
   */
  getAutoCorrection(word: string): string | null {
    if (!word) return null;
    
    const lowerWord = word.toLowerCase();
    
    // Check auto-correct cache first (instant corrections)
    if (this.autoCorrectCache.has(lowerWord)) {
      const correction = this.autoCorrectCache.get(lowerWord)!;
      
      // Preserve original capitalization pattern
      if (word[0] === word[0].toUpperCase() && correction[0] !== correction[0].toUpperCase()) {
        return correction.charAt(0).toUpperCase() + correction.slice(1);
      }
      
      return correction;
    }
    
    return null;
  }

  /**
   * Get spelling suggestions for a misspelled word
   */
  getSuggestions(word: string, maxSuggestions: number = 5): string[] {
    if (!word || word.length < 2) return [];
    
    // Check auto-correct first
    const autoCorrect = this.getAutoCorrection(word);
    if (autoCorrect) {
      return [autoCorrect];
    }
    
    // Use dictionary suggestions if available
    if (this.dictionary) {
      try {
        const suggestions = this.dictionary.suggest(word);
        return suggestions.slice(0, maxSuggestions);
      } catch (error) {
        console.warn('Dictionary suggest failed:', error);
      }
    }
    
    return [];
  }

  /**
   * Check and auto-correct text as user types
   * Returns the corrected text if changes were made, null otherwise
   */
  autoCorrectText(text: string, cursorPosition: number): { text: string; cursorDelta: number } | null {
    if (!text || text.length === 0) return null;
    
    // Get the word at cursor position
    const beforeCursor = text.substring(0, cursorPosition);
    const afterCursor = text.substring(cursorPosition);
    
    // Find the current word being typed (word before cursor)
    const wordMatch = beforeCursor.match(/(\b\w+)$/);
    if (!wordMatch) return null;
    
    const word = wordMatch[1];
    const wordStart = cursorPosition - word.length;
    
    // Check if we should auto-correct (only after space, period, etc.)
    const charAfterCursor = afterCursor[0];
    const shouldAutoCorrect = !charAfterCursor || /[\s.,!?;:]/.test(charAfterCursor);
    
    if (!shouldAutoCorrect) return null;
    
    // Get auto-correction
    const correction = this.getAutoCorrection(word);
    if (!correction || correction === word) return null;
    
    // Apply correction
    const correctedText = 
      text.substring(0, wordStart) + 
      correction + 
      text.substring(cursorPosition);
    
    const cursorDelta = correction.length - word.length;
    
    return { text: correctedText, cursorDelta };
  }

  /**
   * Check text for spelling errors
   * Returns array of misspelled words with positions
   */
  checkText(text: string): Array<{ word: string; start: number; end: number; suggestions: string[] }> {
    if (!text) return [];
    
    const errors: Array<{ word: string; start: number; end: number; suggestions: string[] }> = [];
    const wordRegex = /\b[a-zA-Z]+\b/g;
    let match;
    
    while ((match = wordRegex.exec(text)) !== null) {
      const word = match[0];
      if (!this.isCorrect(word)) {
        errors.push({
          word,
          start: match.index,
          end: match.index + word.length,
          suggestions: this.getSuggestions(word),
        });
      }
    }
    
    return errors;
  }
}

// Singleton instance
export const spellChecker = new SpellChecker();

// Initialize on module load
spellChecker.initialize().catch(err => {
  console.warn('Spell checker initialization delayed:', err);
});
