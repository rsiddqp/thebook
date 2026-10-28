import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    const { chapterId, bookId, userId, chapterContent } = await req.json();

    // Step 1: Generate chapter summary
    const summaryResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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
            content: 'You are a literary analyst. Summarize the key plot events, character developments, setting details, and unresolved threads from this chapter. Keep it under 300 words, focusing on facts that would help maintain continuity in future chapters.'
          },
          {
            role: 'user',
            content: chapterContent
          }
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    const summaryData = await summaryResponse.json();
    const chapterSummary = summaryData.choices[0].message.content;

    // Update chapter with summary
    await supabase
      .from('chapters')
      .update({ chapter_summary: chapterSummary })
      .eq('id', chapterId)
      .eq('user_id', userId);

    // Step 2: Fetch all chapter summaries for this book
    const { data: allChapters } = await supabase
      .from('chapters')
      .select('chapter_number, chapter_summary')
      .eq('book_id', bookId)
      .order('chapter_number', { ascending: true });

    // Step 3: Generate global context summary
    const allSummaries = allChapters
      ?.map(ch => `Chapter ${ch.chapter_number}: ${ch.chapter_summary}`)
      .join('\n\n') || '';

    const contextResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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
            content: 'Create a compact Story Bible (under 1000 tokens) covering: main characters, key plot points, major settings, unresolved conflicts, and narrative tone. This will be used to maintain continuity in future writing.'
          },
          {
            role: 'user',
            content: allSummaries
          }
        ],
        temperature: 0.5,
        max_tokens: 1000,
      }),
    });

    const contextData = await contextResponse.json();
    const globalContext = contextData.choices[0].message.content;

    // Step 4: Extract style fingerprint from recent writing
    const styleResponse = await fetch('https://api.perplexity.ai/chat/completions', {
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
            content: 'Analyze this writing sample and extract style characteristics. Return ONLY valid JSON with no markdown formatting.'
          },
          {
            role: 'user',
            content: `Analyze this writing and return a JSON object with these fields:
- pov: "first_person" | "third_person_limited" | "third_person_omniscient"
- tense: "past" | "present"
- tone: "casual" | "formal" | "literary" | "conversational"
- sentence_rhythm: "punchy" | "flowing" | "varied" | "long_complex"
- vocabulary_level: "simple" | "moderate" | "advanced" | "literary"
- stylistic_notes: brief description of unique voice traits

Writing sample:
${chapterContent.slice(0, 2000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    const styleData = await styleResponse.json();
    let styleFingerprint;
    try {
      const styleContent = styleData.choices[0].message.content;
      // Remove markdown code blocks if present
      const jsonContent = styleContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      styleFingerprint = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse style fingerprint:', parseError);
      styleFingerprint = {
        pov: "third_person_limited",
        tense: "past",
        tone: "conversational",
        sentence_rhythm: "varied",
        vocabulary_level: "moderate",
        stylistic_notes: "Standard narrative style"
      };
    }

    // Step 5: Update book with context and style
    await supabase
      .from('books')
      .update({
        global_context_summary: globalContext,
        style_fingerprint: styleFingerprint
      })
      .eq('id', bookId)
      .eq('user_id', userId);

    return new Response(JSON.stringify({
      success: true,
      chapterSummary,
      globalContext,
      styleFingerprint
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});
