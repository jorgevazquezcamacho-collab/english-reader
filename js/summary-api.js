const SummaryApi = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL   = 'claude-haiku-4-5-20251001';

  // Caps the source text sent for cost control — a spoken summary only needs
  // enough of the original to judge whether the key ideas were captured, not
  // every word of a very long text.
  const MAX_SOURCE_CHARS = 3000;

  function truncateSource(text) {
    const t = text.trim();
    if (t.length <= MAX_SOURCE_CHARS) return t;
    return t.slice(0, MAX_SOURCE_CHARS) + ' …[texto truncado]';
  }

  function buildPrompt(sourceText, summaryTranscript) {
    return `You are an English teacher. A student read the following English text and then gave a spoken summary of it, in their own words.

Original text:
"""
${truncateSource(sourceText)}
"""

Student's spoken summary (transcribed by speech recognition):
"""
${summaryTranscript.trim()}
"""

Return ONLY a raw JSON object — no markdown fences, no explanation. Exact schema:

{
  "comprehension_score": "<one of: alta, media, baja — how well the summary captures the key ideas of the original text>",
  "grammar_notes": [
    { "error": "<exact phrase from the transcript with the grammar issue>", "correction": "<corrected phrase>", "explanation": "<brief explanation, in Spanish>" }
  ],
  "vocabulary_suggestions": [
    { "used": "<basic or repeated word/phrase the student used>", "suggestion": "<more precise or natural alternative>", "note": "<brief explanation, in Spanish, of why it's better>" }
  ],
  "encouragement": "<brief, warm, encouraging closing note in Spanish about the summary overall>"
}

Rules:
• grammar_notes: only real grammatical errors found in the transcript, 0–5 items; omit the key if none.
• vocabulary_suggestions: only meaningful improvements (basic or repetitive word choices), 0–5 items; omit the key if none.
• Keep in mind the transcript comes from speech recognition — ignore likely transcription artifacts (missing punctuation, homophones) and focus on genuine grammar/vocabulary issues.
• Tone: constructive, never punitive — this is a language learner practicing out loud.
• comprehension_score and every text field must be in Spanish except the "error"/"correction"/"used"/"suggestion" quoted phrases, which stay in English.
• Return raw JSON only — nothing before or after the object.`;
  }

  async function fetchFeedback(sourceText, summaryTranscript) {
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      const err = new Error('Sin API key configurada');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1280,
        system: 'You are an English teaching assistant. Respond with valid JSON only. No markdown. No prose. No explanation.',
        messages: [{ role: 'user', content: buildPrompt(sourceText, summaryTranscript) }]
      })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg  = body.error?.message || `HTTP ${res.status}`;
      const err  = new Error(msg);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const raw  = (data.content?.[0]?.text ?? '').trim();

    // Guard against accidental markdown fences from the model
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('La respuesta no contiene JSON válido');

    return JSON.parse(match[0]);
  }

  return { fetchFeedback };
})();
