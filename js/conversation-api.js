const ConversationApi = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL   = 'claude-haiku-4-5-20251001';

  // Caps the source text sent for cost control — a comprehension question or
  // a turn's feedback don't need every word of a very long text.
  const MAX_SOURCE_CHARS = 2000;

  const TOTAL_QUESTIONS = 3;

  function truncateSource(text) {
    const t = text.trim();
    if (t.length <= MAX_SOURCE_CHARS) return t;
    return t.slice(0, MAX_SOURCE_CHARS) + ' …[texto truncado]';
  }

  function buildHistoryBlock(history) {
    if (!history.length) return '(none yet — this is the first question)';
    return history
      .map((h, i) => `Q${i + 1}: ${h.question}\nA${i + 1}: ${h.answer}`)
      .join('\n\n');
  }

  async function callClaude(prompt, maxTokens) {
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
        max_tokens: maxTokens,
        system: 'You are an English conversation practice partner. Respond with valid JSON only. No markdown. No prose. No explanation.',
        messages: [{ role: 'user', content: prompt }]
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

  async function fetchFirstQuestion(sourceText) {
    const prompt = `A student just read the following English text.

Text:
"""
${truncateSource(sourceText)}
"""

Ask ONE short opening question in English about the content of the text — something the student can answer out loud in one or two sentences. Avoid trivial yes/no questions; ask something that requires them to explain or describe something from the text.

Return ONLY a raw JSON object — no markdown fences, no explanation. Exact schema:
{ "question": "<the question, in English>" }`;

    const data = await callClaude(prompt, 250);
    return data.question;
  }

  async function fetchTurnResult(sourceText, history, question, answer, turnNumber) {
    const isFinal = turnNumber >= TOTAL_QUESTIONS;

    const finalInstructions = `This was the LAST answer (question ${TOTAL_QUESTIONS} of ${TOTAL_QUESTIONS}) — do NOT ask another question. Instead, briefly evaluate the whole conversation.

Return ONLY a raw JSON object — no markdown fences, no explanation. Exact schema:
{
  "feedback_breve": "<1-2 short lines in Spanish about the clarity/grammar of THIS specific answer — constructive, encouraging tone>",
  "conversation_summary": {
    "fluency_note": "<brief note in Spanish about the student's overall fluency across the whole conversation>",
    "grammar_note": "<brief note in Spanish about recurring grammar patterns across the conversation, or that grammar was solid>",
    "completeness_note": "<brief note in Spanish about how complete/developed the student's answers were>",
    "encouragement": "<brief, warm, encouraging closing note in Spanish>"
  }
}`;

    const nextInstructions = `Ask the next question (question ${turnNumber + 1} of ${TOTAL_QUESTIONS}).

Return ONLY a raw JSON object — no markdown fences, no explanation. Exact schema:
{
  "feedback_breve": "<1-2 short lines in Spanish about the clarity/grammar of THIS specific answer — constructive, encouraging tone>",
  "next_question": "<the next question, in English — must connect naturally to what the student just answered, not a generic disconnected question. Answerable out loud in one or two sentences.>"
}`;

    const prompt = `You are continuing a spoken conversation practice about a text an English student read.

Text (for reference):
"""
${truncateSource(sourceText)}
"""

Conversation so far:
${buildHistoryBlock(history)}

Current question: "${question}"
Student's spoken answer (transcribed by speech recognition): "${answer.trim()}"

Keep in mind the answer comes from speech recognition — ignore likely transcription artifacts (missing punctuation, homophones) and focus on genuine clarity/grammar issues.

${isFinal ? finalInstructions : nextInstructions}`;

    return callClaude(prompt, isFinal ? 550 : 300);
  }

  return { fetchFirstQuestion, fetchTurnResult, TOTAL_QUESTIONS };
})();
