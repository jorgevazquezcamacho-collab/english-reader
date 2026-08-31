const OcrApi = (() => {
  const API_URL   = 'https://api.anthropic.com/v1/messages';
  const MODEL     = 'claude-haiku-4-5-20251001';
  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  const SUPPORTED = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

  // Draws the image onto a canvas and returns a compressed JPEG blob.
  // Scales down to MAX_DIM on the longest side before encoding.
  async function resizeToJpeg(file, quality) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      throw new Error('Formato de imagen no compatible. Usa JPEG, PNG o WEBP.');
    }

    const MAX_DIM = 1920;
    let w = bitmap.width, h = bitmap.height;
    if (w > MAX_DIM || h > MAX_DIM) {
      const scale = Math.min(MAX_DIM / w, MAX_DIM / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Error al comprimir la imagen'))),
        'image/jpeg',
        quality
      );
    });
  }

  // Returns { blob, mediaType } ready to encode as base64.
  // Converts unsupported formats and compresses oversized images.
  async function prepareImage(file) {
    if (SUPPORTED.has(file.type) && file.size <= MAX_BYTES) {
      return { blob: file, mediaType: file.type };
    }

    // First pass: 1920px max, 85% JPEG quality
    let blob = await resizeToJpeg(file, 0.85);

    // Second pass: lower quality if still over the limit
    if (blob.size > MAX_BYTES) {
      blob = await resizeToJpeg(file, 0.60);
    }

    if (blob.size > MAX_BYTES) {
      const mb = (blob.size / 1024 / 1024).toFixed(1);
      throw new Error(
        `La imagen ocupa ${mb} MB incluso comprimida. Usa una foto con menos resolución.`
      );
    }

    return { blob, mediaType: 'image/jpeg' };
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result.split(',')[1]);
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(blob);
    });
  }

  async function extractText(file) {
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      const err = new Error('Sin API key configurada');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const { blob, mediaType } = await prepareImage(file);
    const base64 = await blobToBase64(blob);

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
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 }
            },
            {
              type: 'text',
              text: 'Transcribe ALL the visible text in this image exactly as it appears — every word, number, and punctuation mark. Preserve paragraph breaks where they exist in the original. Do not correct spelling or grammar. Do not summarize. Do not add any commentary or explanation. If there is no readable text in the image, respond only with the exact token: NO_TEXT_FOUND\n\nReturn only the transcribed text, nothing else.'
            }
          ]
        }]
      })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = (data.content?.[0]?.text ?? '').trim();

    if (!text || text === 'NO_TEXT_FOUND') {
      const err = new Error('No se encontró texto legible en la imagen.');
      err.code = 'NO_TEXT';
      throw err;
    }

    return text;
  }

  return { extractText };
})();
