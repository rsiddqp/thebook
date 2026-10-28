import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const {
      activeText,
      localContext,
      styleFingerprint,
      globalContext
    } = await req.json();

    // Call Perplexity API
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a Developmental & Line Editor for fiction authors.

PRIME DIRECTIVE: NEVER write new plot or take creative control. Your job is to make the author sound like the best version of themselves.

VOICE PRESERVATION RULES:
- Analyze the author's style from the style_fingerprint (rhythm, cadence, tone, POV, tense, vocabulary level).
- If they write punchy minimalist prose, DO NOT suggest flowery purple prose.
- If they use simple vocabulary, maintain that simplicity.
- Elevate their articulation, fix awkward phrasing, tighten grammar, and flag continuity errors.
- Match their narrative voice—first person/third person, past/present tense, formal/casual tone.

OUTPUT FORMAT:
Return suggestions ONLY when there are clear improvements. Return a valid JSON object with this exact structure:
{
  "suggestions": [
    {
      "id": "unique-id-string",
      "type": "articulation" or "grammar" or "style" or "continuity",
      "original_text": "exact text from the passage",
      "suggested_text": "improved version",
      "rationale": "brief explanation"
    }
  ]
}

Each suggestion must:
1. Preserve the author's core voice and style
2. Make the prose stronger, clearer, or more elegant
3. Fix actual errors (grammar, continuity, awkward phrasing)

Do NOT suggest changes just for the sake of change. If a sentence is already strong and matches the author's voice, return an empty suggestions array.

Author's Style Profile: ${JSON.stringify(styleFingerprint)}
Previous Story Context: ${globalContext || 'First chapter - no previous context'}
`
          },
          {
            role: 'user',
            content: `Analyze this passage and provide editorial suggestions in valid JSON format:

PREVIOUS PARAGRAPHS (for context):
${localContext || 'No previous context'}

CURRENT WRITING TO ANALYZE:
${activeText}

Provide suggestions that preserve the author's voice while improving clarity, grammar, pacing, or flagging continuity errors against the story context. Return ONLY valid JSON.`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Perplexity API error');
    }

    // Parse the response content as JSON
    let result;
    try {
      const content = data.choices[0].message.content;
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(jsonContent);
      
      // Add unique IDs if missing
      if (result.suggestions && Array.isArray(result.suggestions)) {
        result.suggestions = result.suggestions.map((s, idx) => ({
          ...s,
          id: s.id || `suggestion-${Date.now()}-${idx}`
        }));
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      result = { suggestions: [] };
    }

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      suggestions: []
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
