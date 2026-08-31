const DictionaryApi = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL   = 'claude-haiku-4-5-20251001';

  function buildPrompt(word, context) {
    return `Analyze the English word "${word}" as used in this text:

"""
${context}
"""

Return ONLY a raw JSON object — no markdown fences, no explanation. Exact schema:

{
  "word": "<the word>",
  "phonetic_ipa": "<IPA transcription>",
  "phonetic_approx": "<approximate pronunciation written in Spanish phonetics, e.g. work→uork, think→zink>",
  "translations": ["<translation in Spanish>", "..."],
  "is_verb": <true|false>,
  "verb_forms": { "base": "<>", "past": "<>", "participle": "<>" },
  "usage": [
    { "tag": "<domain label in Spanish, e.g. General, Negocios, Educación, Medicina, Tecnología>",
      "text": "<explanation of this usage sense, in Spanish>" }
  ],
  "phrasal_verbs": [
    { "verb": "<phrasal verb>", "meaning": "<meaning in Spanish>" }
  ],
  "synonyms": [
    { "word": "<synonym>", "note": "<brief explanation in Spanish of when to use this synonym instead of '${word}', e.g. if it fits a formal/informal register or matches better the specific context of the sentence above>" }
  ],
  "examples": [
    { "en": "<example sentence in English>", "es": "<Spanish translation>" }
  ],
  "context_use": "<MOST IMPORTANT — write in Spanish — explain specifically how '${word}' is being used in the sentence above: its exact meaning in this context, its grammatical role (noun, verb, adjective, adverb, etc.), tone, and any nuance that helps a Spanish speaker fully understand this specific usage>"
}

Rules:
• verb_forms: include only when is_verb is true; omit the key otherwise.
• phrasal_verbs: include only if there are 1–4 common ones; omit the key otherwise.
• synonyms: include 2–4 synonyms; omit the key if there are no meaningful ones.
• usage: 2–4 senses labelled by domain when the word has distinct register differences.
• examples: 2–3 natural bilingual pairs.
• context_use: always present, always in Spanish, always specific to the provided text — never generic.
• Return raw JSON only — nothing before or after the object.`;
  }

  async function fetchDefinition(word, context) {
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
        max_tokens: 1024,
        system: 'You are a bilingual English–Spanish dictionary API. Respond with valid JSON only. No markdown. No prose. No explanation.',
        messages: [{ role: 'user', content: buildPrompt(word, context) }]
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

  return { fetchDefinition };
})();
