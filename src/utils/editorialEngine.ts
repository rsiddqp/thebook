import {
  Suggestion,
  SuggestionType,
  SuggestionImpact,
  EditorialPreferences,
  LearningState,
} from '../lib/supabase';
import { supabase } from '../lib/supabase';
import { generateTextHash } from '../store/useBookStore';

export interface AnalysisInput {
  fullText: string;
  /** If provided, analyze only this selected text instead of auto-detecting dirty paragraph */
  selectedText?: string;
  activeChapterId?: string;
  bookTitle?: string;
  bookGenre?: string | null;
  styleFingerprint?: Record<string, any>;
  globalContextSummary?: string | null;
  preferences: EditorialPreferences;
  learningState: LearningState;
}

export interface DirtyParagraphInfo {
  activeText: string;
  localContextBefore: string;
  localContextAfter: string;
  paragraphIndex: number;
  totalParagraphs: number;
}

/**
 * Extracts the dirty/active paragraph and its surrounding local context.
 */
export function extractActiveContext(
  currentText: string,
  previousText = ''
): DirtyParagraphInfo | null {
  const currentParagraphs = currentText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (currentParagraphs.length === 0) return null;

  const previousParagraphs = previousText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Find the first paragraph that differs from previous text
  let dirtyIndex = -1;
  for (let i = 0; i < currentParagraphs.length; i++) {
    if (currentParagraphs[i] !== previousParagraphs[i]) {
      dirtyIndex = i;
      break;
    }
  }

  // If no difference found or added at end, pick the last paragraph
  if (dirtyIndex === -1) {
    dirtyIndex = currentParagraphs.length - 1;
  }

  const activeText = currentParagraphs[dirtyIndex];
  if (!activeText || activeText.length < 20) {
    return null;
  }

  // Surrounding context: up to 2 preceding paragraphs
  const beforeStart = Math.max(0, dirtyIndex - 2);
  const localContextBefore = currentParagraphs.slice(beforeStart, dirtyIndex).join('\n\n');

  // 1 succeeding paragraph
  const localContextAfter = currentParagraphs.slice(dirtyIndex + 1, dirtyIndex + 2).join('\n\n');

  return {
    activeText,
    localContextBefore,
    localContextAfter,
    paragraphIndex: dirtyIndex,
    totalParagraphs: currentParagraphs.length,
  };
}

/**
 * Extracts the last paragraph as the active writing focus for real-time suggestions.
 */
export function extractLastParagraphContext(
  currentText: string
): DirtyParagraphInfo | null {
  const paragraphs = currentText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) return null;

  const lastIndex = paragraphs.length - 1;
  const activeText = paragraphs[lastIndex];

  if (!activeText || activeText.length < 20) return null;

  const beforeStart = Math.max(0, lastIndex - 2);
  const localContextBefore = paragraphs.slice(beforeStart, lastIndex).join('\n\n');

  return {
    activeText,
    localContextBefore,
    localContextAfter: '',
    paragraphIndex: lastIndex,
    totalParagraphs: paragraphs.length,
  };
}

/**
 * Extracts context for a user-selected text span within the full document.
 */
export function extractSelectionContext(
  fullText: string,
  selectedText: string
): DirtyParagraphInfo | null {
  if (!selectedText || selectedText.trim().length < 10) return null;

  const paragraphs = fullText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // Find which paragraph contains the selection
  let selectionIndex = paragraphs.findIndex((p) => p.includes(selectedText.trim()));
  if (selectionIndex === -1) {
    selectionIndex = paragraphs.length - 1;
  }

  const beforeStart = Math.max(0, selectionIndex - 2);
  const localContextBefore = paragraphs.slice(beforeStart, selectionIndex).join('\n\n');
  const localContextAfter = paragraphs.slice(selectionIndex + 1, selectionIndex + 2).join('\n\n');

  return {
    activeText: selectedText.trim(),
    localContextBefore,
    localContextAfter,
    paragraphIndex: selectionIndex,
    totalParagraphs: paragraphs.length,
  };
}

/**
 * High-grade local linguistic & editorial heuristic engine
 */
export function runLocalEditorialRules(
  activeText: string,
  preferences: EditorialPreferences,
  learningState: LearningState
): Suggestion[] {
  const results: Suggestion[] = [];
  const now = Date.now();

  const isEnabled = (type: SuggestionType) => {
    if (preferences.enabledCategories && preferences.enabledCategories[type] === false) {
      return false;
    }
    if (learningState.suppressedTypes.includes(type)) {
      return false;
    }
    return true;
  };

  // Helper to add suggestion if not suppressed
  const addSugg = (
    type: SuggestionType,
    impact: SuggestionImpact,
    original: string,
    suggested: string,
    rationale: string
  ) => {
    if (!isEnabled(type)) return;
    const hash = generateTextHash(original, activeText);
    if (learningState.acceptedHashes[hash] || learningState.dismissedHashes[hash]) {
      return;
    }
    results.push({
      id: `local-${now}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      impact,
      original_text: original,
      suggested_text: suggested,
      rationale,
      status: 'pending',
      context_paragraph: activeText,
      created_at: now,
      text_hash: hash,
    });
  };

  // 1. Common Grammar & Mechanics (High Impact)
  if (isEnabled('grammar')) {
    const grammarRules: Array<{ regex: RegExp; fix: (match: string) => string; rationale: string }> = [
      {
        regex: /\b(could|should|would)\s+of\b/gi,
        fix: (m) => m.replace(/of/i, 'have'),
        rationale: 'Use "have" instead of "of" with modal verbs.',
      },
      {
        regex: /\b(they|we)\s+was\b/gi,
        fix: (m) => m.replace(/was/i, 'were'),
        rationale: 'Subject-verb agreement: plural pronouns require "were".',
      },
      {
        regex: /\b(he|she|it)\s+were\b/gi,
        fix: (m) => m.replace(/were/i, 'was'),
        rationale: 'Subject-verb agreement: singular third person takes "was" in past tense.',
      },
      {
        regex: /\b(its)\s+(a|an|the|very|not|going|been)\b/gi,
        fix: (m) => m.replace(/\bits\b/i, "it's"),
        rationale: 'Use "it\'s" (contraction of "it is") before a determiner or predicate.',
      },
      {
        regex: /\b(your)\s+(a|an|the|not|going|welcome|right|wrong)\b/gi,
        fix: (m) => m.replace(/\byour\b/i, "you're"),
        rationale: 'Use "you\'re" (contraction of "you are") here.',
      },
      {
        regex: /\b(\w+)\s+\1\b/gi,
        fix: (m) => m.split(/\s+/)[0],
        rationale: 'Remove accidental repeated word.',
      },
      {
        regex: /\bto\s+far\b/gi,
        fix: () => 'too far',
        rationale: 'Use "too" to mean excessively.',
      },
      {
        regex: /\bloose\s+his\b/gi,
        fix: () => 'lose his',
        rationale: 'Use "lose" for misplacing or failing, not "loose".',
      },
      {
        regex: /\bloose\s+her\b/gi,
        fix: () => 'lose her',
        rationale: 'Use "lose" for misplacing or failing, not "loose".',
      },
      {
        regex: /\bloose\s+their\b/gi,
        fix: () => 'lose their',
        rationale: 'Use "lose" for misplacing or failing, not "loose".',
      },
    ];

    for (const rule of grammarRules) {
      const match = activeText.match(rule.regex);
      if (match) {
        for (const m of match) {
          addSugg('grammar', 'high', m, rule.fix(m), rule.rationale);
        }
      }
    }
  }

  // 2. Wordy / Bloated Phrasing -> Crisp Articulation
  if (isEnabled('articulation')) {
    const wordinessMap: Record<string, { fix: string; rationale: string }> = {
      'in order to': { fix: 'to', rationale: 'Tightens prose without changing meaning.' },
      'due to the fact that': { fix: 'because', rationale: '"Because" is punchier and direct.' },
      'at this point in time': { fix: 'now', rationale: 'Avoids wordy corporate phrasing.' },
      'for the purpose of': { fix: 'to', rationale: 'Simplifies prepositional bloat.' },
      'in the event that': { fix: 'if', rationale: 'More direct conditional statement.' },
      'has the ability to': { fix: 'can', rationale: 'Replaces passive auxiliary with active verb.' },
      'with the exception of': { fix: 'except for', rationale: 'Cleaner and more conversational.' },
      'a large number of': { fix: 'many', rationale: 'Tightens word count.' },
      'on a daily basis': { fix: 'daily', rationale: 'Clearer, single-word cadence.' },
      'needless to say,': { fix: '', rationale: 'If needless to say, omitting it strengthens the line.' },
      'as a matter of fact,': { fix: 'in fact,', rationale: 'Reduces filler phrasing.' },
      'all of a sudden': { fix: 'suddenly', rationale: 'More concise and keeps reader in the scene.' },
      'in spite of the fact that': { fix: 'although', rationale: 'Streamlines complex clause.' },
    };

    for (const [phrase, info] of Object.entries(wordinessMap)) {
      const idx = activeText.toLowerCase().indexOf(phrase);
      if (idx !== -1) {
        const originalSnippet = activeText.substring(idx, idx + phrase.length);
        addSugg(
          'articulation',
          'medium',
          originalSnippet,
          info.fix,
          info.rationale
        );
      }
    }
  }

  // 3. Weak Verbs & Modifiers -> Evocative Style
  if (isEnabled('style')) {
    const weakModifiers: Record<string, { fix: string; rationale: string }> = {
      'very tired': { fix: 'exhausted', rationale: 'Stronger, more evocative single verb/adjective.' },
      'very angry': { fix: 'furious', rationale: 'Evokes stronger emotional resonance.' },
      'very cold': { fix: 'frigid', rationale: 'Paints a more visceral sensory picture.' },
      'very hot': { fix: 'scorching', rationale: 'More sensory and dynamic description.' },
      'very quiet': { fix: 'silent', rationale: 'Sharper auditory image.' },
      'very big': { fix: 'colossal', rationale: 'More precise sense of scale.' },
      'very small': { fix: 'minute', rationale: 'Stronger descriptive vocabulary.' },
      'walked slowly': { fix: 'crept', rationale: 'A stronger verb conveys mood and intention.' },
      'ran quickly': { fix: 'sprinted', rationale: 'Strong active verb boosts narrative pacing.' },
      'shouted loudly': { fix: 'bellowed', rationale: 'Avoids redundant adverb modification.' },
      'whispered softly': { fix: 'whispered', rationale: '"Softly" is already implied by whisper.' },
      'started to walk': { fix: 'walked', rationale: 'Drop filter verbs ("started to") for immediate action.' },
      'began to run': { fix: 'ran', rationale: 'Direct action keeps momentum moving.' },
    };

    for (const [phrase, info] of Object.entries(weakModifiers)) {
      const idx = activeText.toLowerCase().indexOf(phrase);
      if (idx !== -1) {
        const originalSnippet = activeText.substring(idx, idx + phrase.length);
        addSugg('style', 'medium', originalSnippet, info.fix, info.rationale);
      }
    }

    // Passive voice checks
    const passiveMatches = activeText.match(/\b(was|were|is|are|been)\s+(\w+ed)\s+by\b/gi);
    if (passiveMatches) {
      for (const pm of passiveMatches) {
        addSugg(
          'style',
          'medium',
          pm,
          pm.replace(/\b(was|were|is|are|been)\s+/i, ''),
          'Consider active voice here to make the subject drive the action.'
        );
      }
    }
  }

  // 4. Pacing & Sentence Length (Pacing / Structure)
  if (isEnabled('pacing')) {
    const sentences = activeText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      const wordCount = sentence.split(/\s+/).length;
      if (wordCount > 38 && !sentence.includes(';') && !sentence.includes('—')) {
        addSugg(
          'pacing',
          'medium',
          sentence.slice(0, 60) + '...',
          'Consider breaking into two sentences',
          `This sentence contains ${wordCount} words. Splitting it improves readability and narrative breath.`
        );
      }
    }

    // Repetitive sentence starters
    if (sentences.length >= 3) {
      const firstWords = sentences.map((s) => s.split(/\s+/)[0]?.toLowerCase());
      if (firstWords[0] === firstWords[1] && firstWords[1] === firstWords[2]) {
        addSugg(
          'pacing',
          'low',
          `${sentences[1].split(/\s+/)[0]}...`,
          'Vary sentence opening',
          `Three consecutive sentences start with "${firstWords[0]}". Varying openers enhances cadence.`
        );
      }
    }
  }

  // Filter and prioritize
  // High impact first, then medium, then low
  const impactOrder: Record<SuggestionImpact, number> = { high: 0, medium: 1, low: 2 };
  results.sort((a, b) => impactOrder[a.impact || 'medium'] - impactOrder[b.impact || 'medium']);

  // Apply intervention level cap:
  // Minimal: only High impact (max 3)
  // Balanced: High + Medium (max 5)
  // Active: All (max 8)
  if (preferences.interventionLevel === 'minimal') {
    return results.filter((s) => s.impact === 'high').slice(0, 3);
  } else if (preferences.interventionLevel === 'balanced') {
    return results.filter((s) => s.impact !== 'low').slice(0, 5);
  }

  return results.slice(0, 8);
}

/**
 * Executes cloud or local analysis depending on configuration and availability.
 * In selection mode, analyzes only the selected text.
 * In real-time mode, analyzes only the last paragraph.
 */
export async function executeEditorialAnalysis(
  input: AnalysisInput
): Promise<{ suggestions: Suggestion[]; source: 'edge' | 'custom' | 'local'; focusText: string }> {
  const {
    fullText,
    selectedText,
    bookTitle,
    bookGenre,
    styleFingerprint,
    globalContextSummary,
    preferences,
    learningState,
  } = input;

  // Determine context based on mode
  let contextInfo: DirtyParagraphInfo | null;

  if (selectedText && selectedText.trim().length >= 10) {
    // Selection mode: analyze the user-highlighted text
    contextInfo = extractSelectionContext(fullText, selectedText);
  } else {
    // Real-time mode: analyze only the last paragraph
    contextInfo = extractLastParagraphContext(fullText);
  }

  if (!contextInfo) {
    return { suggestions: [], source: 'local', focusText: '' };
  }

  const { activeText, localContextBefore, localContextAfter } = contextInfo;
  const localContext = [localContextBefore, localContextAfter].filter(Boolean).join('\n---\n');

  // Custom API provider branch (OpenAI or Anthropic direct client-side call)
  if (preferences.apiProvider === 'custom_llm' && preferences.customApiKey) {
    try {
      const customSuggestions = await callCustomLLMApi({
        activeText,
        localContext,
        styleFingerprint,
        globalContextSummary,
        preferences,
        learningState,
      });
      if (customSuggestions && customSuggestions.length > 0) {
        return { suggestions: customSuggestions, source: 'custom', focusText: activeText };
      }
    } catch (err) {
      console.warn('Custom LLM API call failed, falling back to local/edge:', err);
    }
  }

  // Edge function branch with rate limit handling
  if (preferences.apiProvider !== 'mock') {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-writing', {
        body: {
          activeText,
          localContext,
          bookTitle,
          bookGenre,
          styleFingerprint: styleFingerprint || {},
          globalContext: globalContextSummary || '',
          preferences: {
            interventionLevel: preferences.interventionLevel,
            preferredTone: preferences.preferredTone,
            targetAudience: preferences.targetAudience,
            vocabularyLevel: preferences.vocabularyLevel,
          },
          suppressedTypes: learningState.suppressedTypes,
        },
      });

      // Check for rate limit errors
      if (error) {
        const errorMessage = error.message || '';
        if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
          console.info('Rate limit reached, using local editorial rules. Please wait before making more requests.');
          // Fall through to local rules
        } else {
          console.info('Edge function unavailable, using local editorial intelligence:', error);
        }
      } else if (data?.suggestions && Array.isArray(data.suggestions) && data.suggestions.length > 0) {
        // Tag with context paragraph
        const tagged: Suggestion[] = data.suggestions.map((s: any, idx: number) => ({
          ...s,
          id: s.id || `edge-${Date.now()}-${idx}`,
          impact: s.impact || 'medium',
          status: 'pending',
          context_paragraph: activeText,
          created_at: Date.now(),
          text_hash: generateTextHash(s.original_text, activeText),
        }));
        return { suggestions: tagged, source: 'edge', focusText: activeText };
      }
    } catch (edgeErr) {
      // Non-blocking fallback to local rules
      console.info('Edge function error, using local editorial intelligence:', edgeErr);
    }
  }

  // Local rule-based engine fallback (always available)
  const localSuggestions = runLocalEditorialRules(activeText, preferences, learningState);
  return { suggestions: localSuggestions, source: 'local', focusText: activeText };
}

/**
 * Direct custom API call if user configured an API key in settings
 */
async function callCustomLLMApi(params: {
  activeText: string;
  localContext: string;
  styleFingerprint?: Record<string, any>;
  globalContextSummary?: string | null;
  preferences: EditorialPreferences;
  learningState: LearningState;
}): Promise<Suggestion[]> {
  const { activeText, localContext, styleFingerprint, globalContextSummary, preferences, learningState } = params;
  const apiKey = preferences.customApiKey;
  if (!apiKey) return [];

  const endpoint = preferences.customApiBase || 'https://api.openai.com/v1/chat/completions';
  const model = preferences.customModel || 'gpt-4o-mini';

  const systemPrompt = `You are a world-class Developmental & Line Editor for book authors.
Your goal is to act as a real-time editorial partner to help improve phrasing, clarity, grammar, rhythm, tone, and continuity while STRICTLY PRESERVING the author's unique voice.

Tone: ${preferences.preferredTone}
Audience: ${preferences.targetAudience}
Intervention level: ${preferences.interventionLevel}
Suppressed categories user dislikes: ${learningState.suppressedTypes.join(', ') || 'None'}
Author style profile: ${JSON.stringify(styleFingerprint || {})}
Story context: ${globalContextSummary || 'None'}

Return ONLY a JSON object with this exact shape:
{
  "suggestions": [
    {
      "id": "uuid",
      "type": "articulation" | "grammar" | "style" | "continuity" | "pacing" | "structure",
      "impact": "high" | "medium" | "low",
      "original_text": "exact substring from user text",
      "suggested_text": "improved wording",
      "rationale": "1-sentence explanation of why this elevates the prose"
    }
  ]
}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Surrounding Context:\n${localContext}\n\nCurrent Passage:\n${activeText}\n\nProvide editorial suggestions in JSON.`,
        },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    throw new Error(`Custom API returned ${res.status}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) return [];

  const parsed = JSON.parse(content);
  return (parsed.suggestions || []).map((s: any, idx: number) => ({
    ...s,
    id: s.id || `custom-${Date.now()}-${idx}`,
    impact: s.impact || 'medium',
    status: 'pending',
    context_paragraph: activeText,
    created_at: Date.now(),
    text_hash: generateTextHash(s.original_text, activeText),
  }));
}
