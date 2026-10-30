import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per user
const GLOBAL_MAX_REQUESTS = 50; // 50 requests per minute globally

// In-memory rate limit tracking (for serverless, we use Supabase for persistence)
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

/**
 * Check and enforce rate limits for a user
 */
async function checkRateLimit(userId: string | null, supabase: any): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const clientId = userId || 'anonymous';
  
  // Check in-memory cache first (fast path)
  let userLimit = rateLimitCache.get(clientId);
  
  if (!userLimit || now >= userLimit.resetAt) {
    // Reset window
    userLimit = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitCache.set(clientId, userLimit);
  }
  
  // Check if user exceeded their limit
  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  // Check global rate limit using Supabase
  try {
    const windowStart = new Date(now - RATE_LIMIT_WINDOW_MS).toISOString();
    
    // Count recent requests from rate_limit_log table
    const { count, error } = await supabase
      .from('rate_limit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', windowStart);
    
    if (!error && count !== null && count >= GLOBAL_MAX_REQUESTS) {
      return { allowed: false, retryAfter: 60 };
    }
  } catch (err) {
    // If rate limit check fails, allow the request (fail open)
    console.warn('Rate limit check failed:', err);
  }
  
  // Increment user's request count
  userLimit.count++;
  
  return { allowed: true };
}

/**
 * Log rate limit event to Supabase for tracking
 */
async function logRateLimitEvent(userId: string | null, supabase: any): Promise<void> {
  try {
    await supabase.from('rate_limit_log').insert({
      user_id: userId,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Failed to log rate limit event:', err);
  }
}

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
    // Initialize Supabase client
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Extract user ID from auth token
    let userId: string | null = null;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch (err) {
        console.warn('Failed to extract user from token:', err);
      }
    }
    
    // Check rate limit
    const rateLimitResult = await checkRateLimit(userId, supabase);
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded. Please wait before making more requests.',
        retryAfter: rateLimitResult.retryAfter,
        suggestions: []
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(rateLimitResult.retryAfter || 60),
        },
      });
    }
    
    // Log the request
    await logRateLimitEvent(userId, supabase);
    
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
