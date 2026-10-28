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
      bookTitle,
      bookGenre,
      styleFingerprint,
      globalContext,
      preferences,
      suppressedTypes
    } = await req.json();

    const tone = preferences?.preferredTone || 'preserve';
    const audience = preferences?.targetAudience || 'general';
    const intervention = preferences?.interventionLevel || 'balanced';
    const suppressed = Array.isArray(suppressedTypes) ? suppressedTypes.join(', ') : 'none';

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
            content: `You are an elite Developmental & Line Editor for authors.

PRIME DIRECTIVE: NEVER write new plot or replace the author's creativity. Act as an intelligent, context-aware editorial partner. Make the author sound like the best version of themselves while preserving their natural writing voice.

EDITORIAL CONSTRAINTS:
- Intervention Level: ${intervention} (${intervention === 'minimal' ? 'Only flag actual errors and high-impact awkwardness' : intervention === 'active' ? 'Provide thorough developmental & line polish' : 'Provide high-value, balanced improvements'}).
- Preferred Tone: ${tone}.
- Target Audience: ${audience}.
- Suppressed Categories (do NOT suggest): ${suppressed}.
- Analyze author style metrics: ${JSON.stringify(styleFingerprint || {})}.
- Story continuity bible: ${globalContext || 'First chapter - no prior context'}.
${bookGenre ? `- Book Genre: ${bookGenre}` : ''}
${bookTitle ? `- Book Title: ${bookTitle}` : ''}

VOICE PRESERVATION RULES:
- If they write punchy minimalist prose, DO NOT suggest flowery purple prose.
- If they write simple vocabulary, maintain clarity; do not inject generic artificial jargon.
- Prioritise high-impact improvements over trivial corrections.
- Do not suggest changes just for the sake of change. If prose is strong, return an empty suggestions array.

OUTPUT FORMAT:
Return ONLY a valid JSON object matching this exact schema:
{
  "suggestions": [
    {
      "id": "unique-id-string",
      "type": "articulation" | "grammar" | "style" | "continuity" | "pacing" | "structure",
      "impact": "high" | "medium" | "low",
      "original_text": "exact substring from the user's active passage",
      "suggested_text": "improved version matching author voice",
      "rationale": "1 concise sentence explaining what is improved and why"
    }
  ]
}`
          },
          {
            role: 'user',
            content: `SURROUNDING CONTEXT (previous & next paragraphs):
${localContext || 'No surrounding context'}

ACTIVE PASSAGE TO ANALYZE:
${activeText}

Analyze the active passage in relation to the surrounding context. Return ONLY valid JSON.`
          }
        ],
        temperature: 0.5,
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

      // Strip markdown code blocks
      let jsonContent = content
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      // Try direct parse first
      try {
        result = JSON.parse(jsonContent);
      } catch {
        // Fall back: extract the first top-level JSON object from the text
        const start = jsonContent.indexOf('{');
        const end = jsonContent.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          let candidate = jsonContent.slice(start, end + 1);

          // Aggressive cleaning for common LLM JSON mistakes
          candidate = candidate
            // Remove trailing commas in arrays and objects
            .replace(/,\s*([\]}])/g, '$1')
            // Replace single quotes with double quotes (naive but helps)
            .replace(/'/g, '"')
            // Escape literal newlines inside strings
            .replace(/\n/g, '\\n');

          result = JSON.parse(candidate);
        } else {
          throw new Error('No JSON object found in AI response');
        }
      }

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
