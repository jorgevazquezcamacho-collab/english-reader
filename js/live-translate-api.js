const LiveTranslateApi = (() => {
  const API_URL = 'https://api.anthropic.com/v1/messages';
  const MODEL   = 'claude-haiku-4-5-20251001';

  // One short sentence per call — deliberately not the paragraph-batch prompt
  // used by "Ver traducción", so each live phrase translates quickly.
  async function translate(sentence) {
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
        max_tokens: 300,
        system: 'You are an English-to-Spanish translator. Respond with only the Spanish translation of the given sentence — no notes, no quotes, no explanation.',
        messages: [{ role: 'user', content: sentence }]
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
    return (data.content?.[0]?.text ?? '').trim();
  }

  return { translate };
})();
