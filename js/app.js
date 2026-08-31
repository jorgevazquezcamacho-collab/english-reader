(() => {
  // ── Element refs ──────────────────────────────────────────
  const openSettingsBtn  = document.getElementById('openSettings');
  const closeSettingsBtn = document.getElementById('closeSettings');
  const settingsOverlay  = document.getElementById('settingsOverlay');
  const apiKeyInput      = document.getElementById('apiKeyInput');
  const saveApiKeyBtn    = document.getElementById('saveApiKeyBtn');
  const saveFeedback     = document.getElementById('saveFeedback');
  const toggleVisBtn     = document.getElementById('toggleKeyVisibility');
  const eyeIcon          = document.getElementById('eyeIcon');
  const analyzeBtn       = document.getElementById('analyzeBtn');
  const textInput        = document.getElementById('textInput');
  const readingSection   = document.getElementById('readingSection');
  const sheetOverlay     = document.getElementById('sheetOverlay');
  const sheetContent     = document.getElementById('sheetContent');
  const closeSheetBtn    = document.getElementById('closeSheet');
  const photoBtn         = document.getElementById('photoBtn');
  const photoInput       = document.getElementById('photoInput');
  const ocrStatus        = document.getElementById('ocrStatus');
  const ocrStatusMsg     = document.getElementById('ocrStatusMsg');
  const clearBtn         = document.getElementById('clearBtn');
  const translateBtn     = document.getElementById('translateBtn');
  const speechBar        = document.getElementById('speechBar');
  const playPauseBtn     = document.getElementById('playPauseBtn');
  const stopBtn          = document.getElementById('stopBtn');
  const speedSelect      = document.getElementById('speedSelect');
  const voiceSelect      = document.getElementById('voiceSelect');

  // ── State ─────────────────────────────────────────────────
  let activeWordEl = null;
  let isFetching   = false;
  const cache      = new Map(); // word.toLowerCase() → definition object
  let originalHtml         = null; // tokenized innerHTML snapshot before translation
  let translationHtml      = null; // rendered translation (cached to avoid re-fetching)
  let isShowingTranslation = false;

  // ── HTML escape ───────────────────────────────────────────
  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─────────────────────────────────────────────────────────
  // Settings modal
  // ─────────────────────────────────────────────────────────
  function openSettings() {
    apiKeyInput.value = Storage.getApiKey();
    settingsOverlay.classList.remove('hidden');
    apiKeyInput.focus();
  }

  function closeSettings() {
    settingsOverlay.classList.add('hidden');
    saveFeedback.classList.add('hidden');
  }

  openSettingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  settingsOverlay.addEventListener('click', e => {
    if (e.target === settingsOverlay) closeSettings();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!settingsOverlay.classList.contains('hidden')) {
      closeSettings();
    } else if (sheetOverlay.classList.contains('is-open')) {
      closeSheet();
    }
  });

  saveApiKeyBtn.addEventListener('click', () => {
    Storage.saveApiKey(apiKeyInput.value);
    saveFeedback.classList.remove('hidden');
    setTimeout(() => saveFeedback.classList.add('hidden'), 2000);
  });

  const EYE_OPEN = `
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>`;
  const EYE_CLOSED = `
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8
             a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4
             c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19
             m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>`;

  toggleVisBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    eyeIcon.innerHTML = isPassword ? EYE_CLOSED : EYE_OPEN;
  });

  // ─────────────────────────────────────────────────────────
  // Analyze
  // ─────────────────────────────────────────────────────────
  analyzeBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) return;

    if (!Storage.getApiKey()) {
      openSettings();
      return;
    }

    closeSheet();
    cache.clear();
    originalHtml         = null;
    translationHtml      = null;
    isShowingTranslation = false;
    translateBtn.textContent = 'Ver traducción';
    Reading.render(text);
    updateTranslateBtn();
    Speech.stop();
    updateSpeechUI();
    updateSpeechBar();

    // Collapse textarea to give reading area more space
    textInput.rows = 4;
    readingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ─────────────────────────────────────────────────────────
  // Photo / OCR
  // ─────────────────────────────────────────────────────────
  function updateClearBtn() {
    const hasText  = textInput.value.trim().length > 0;
    const hasError = ocrStatus.classList.contains('ocr-status--error') &&
                     !ocrStatus.classList.contains('hidden');
    clearBtn.classList.toggle('hidden', !(hasText || hasError));
  }

  function clearAll() {
    textInput.value  = '';
    textInput.rows   = 12;
    photoInput.value = '';
    ocrStatus.classList.add('hidden');
    ocrStatus.classList.remove('ocr-status--error');
    closeSheet();
    readingSection.classList.add('hidden');
    readingSection.innerHTML = '';
    cache.clear();
    originalHtml         = null;
    translationHtml      = null;
    isShowingTranslation = false;
    photoBtn.disabled    = false;
    analyzeBtn.disabled  = false;
    translateBtn.textContent = 'Ver traducción';
    translateBtn.disabled    = false;
    translateBtn.classList.add('hidden');
    clearBtn.classList.add('hidden');
    Speech.stop();
    updateSpeechUI();
    updateSpeechBar();
    textInput.focus();
  }

  function setOcrBusy(on) {
    photoBtn.disabled   = on;
    analyzeBtn.disabled = on;
    clearBtn.disabled   = on;
    if (on) {
      ocrStatus.classList.remove('hidden', 'ocr-status--error');
      ocrStatusMsg.textContent = 'Analizando imagen...';
    } else {
      ocrStatus.classList.add('hidden');
      ocrStatus.classList.remove('ocr-status--error');
    }
  }

  function showOcrError(msg) {
    photoBtn.disabled   = false;
    analyzeBtn.disabled = false;
    clearBtn.disabled   = false;
    ocrStatus.classList.remove('hidden');
    ocrStatus.classList.add('ocr-status--error');
    ocrStatusMsg.textContent = msg;
    updateClearBtn();
  }

  textInput.addEventListener('input', updateClearBtn);

  clearBtn.addEventListener('click', clearAll);

  photoBtn.addEventListener('click', () => {
    if (!Storage.getApiKey()) { openSettings(); return; }
    ocrStatus.classList.add('hidden');
    ocrStatus.classList.remove('ocr-status--error');
    photoInput.value = '';
    photoInput.click();
  });

  photoInput.addEventListener('change', async () => {
    const file = photoInput.files?.[0];
    if (!file) return;

    setOcrBusy(true);
    try {
      const text = await OcrApi.extractText(file);
      textInput.value = text;
      textInput.rows  = 12;
      setOcrBusy(false);
      textInput.focus();
      updateClearBtn();
    } catch (err) {
      if (err.code === 'NO_API_KEY') {
        setOcrBusy(false);
        openSettings();
      } else {
        showOcrError(err.message);
      }
    }
  });

  // ─────────────────────────────────────────────────────────
  // Translation
  // ─────────────────────────────────────────────────────────
  function updateTranslateBtn() {
    translateBtn.classList.toggle('hidden', readingSection.classList.contains('hidden'));
  }

  async function fetchTranslation(text) {
    const apiKey = Storage.getApiKey();
    if (!apiKey) {
      const err = new Error('Sin API key');
      err.code = 'NO_API_KEY';
      throw err;
    }
    // Scale output budget to text length; cap at Haiku's max
    const wordCount = text.trim().split(/\s+/).length;
    const maxTokens = Math.min(8192, Math.max(2048, Math.ceil(wordCount * 1.5)));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{
          role: 'user',
          content: `Translate the following English text to Spanish. Preserve paragraph structure exactly. Return only the translated text — no explanations, no notes.\n\n${text}`
        }]
      })
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    return (data.content?.[0]?.text ?? '').trim();
  }

  function renderTranslation(text) {
    return text.split(/\n{2,}/)
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p class="reading-para">${esc(p.replace(/\n/g, '<br>'))}</p>`)
      .join('');
  }

  translateBtn.addEventListener('click', async () => {
    // Toggle back to original tokenized view
    if (isShowingTranslation) {
      readingSection.innerHTML = originalHtml;
      isShowingTranslation     = false;
      translateBtn.textContent = 'Ver traducción';
      return;
    }

    // Stop narration before replacing word spans with translation
    if (Speech.isActive()) { Speech.stop(); updateSpeechUI(); }

    // Show cached translation without re-fetching
    if (translationHtml !== null) {
      originalHtml             = readingSection.innerHTML;
      readingSection.innerHTML = translationHtml;
      isShowingTranslation     = true;
      translateBtn.textContent = 'Ver original';
      return;
    }

    // New fetch — snapshot original HTML and show loading state
    const sourceText = textInput.value.trim();
    const wordCount  = sourceText.split(/\s+/).length;
    originalHtml     = readingSection.innerHTML;

    translateBtn.textContent = wordCount > 800
      ? 'Traduciendo texto largo...'
      : 'Traduciendo...';
    translateBtn.disabled = true;

    try {
      const translated = await fetchTranslation(sourceText);
      // Guard: user may have cleared while this was in flight
      if (readingSection.classList.contains('hidden')) return;
      translationHtml          = renderTranslation(translated);
      readingSection.innerHTML = translationHtml;
      isShowingTranslation     = true;
      translateBtn.textContent = 'Ver original';
    } catch (err) {
      if (readingSection.classList.contains('hidden')) return;
      if (err.code === 'NO_API_KEY') {
        openSettings();
      } else {
        translateBtn.textContent = 'Error — reintentar';
        setTimeout(() => {
          if (!isShowingTranslation) translateBtn.textContent = 'Ver traducción';
        }, 2500);
      }
    } finally {
      if (!readingSection.classList.contains('hidden')) {
        translateBtn.disabled = false;
      }
    }
  });

  // ─────────────────────────────────────────────────────────
  // Speech (Listening — Etapa 2)
  // ─────────────────────────────────────────────────────────
  const PLAY_ICON  = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  const PAUSE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;

  function updateSpeechBar() {
    speechBar.classList.toggle('hidden', readingSection.classList.contains('hidden'));
  }

  function updateSpeechUI() {
    const playing = Speech.isPlaying();
    const active  = Speech.isActive();
    playPauseBtn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    playPauseBtn.setAttribute('aria-label', playing ? 'Pausar' : 'Reproducir');
    playPauseBtn.classList.toggle('speech-btn--active', active);
    stopBtn.classList.toggle('speech-btn--active', active);
  }

  function populateVoices() {
    const voices = Speech.getEnglishVoices();
    if (voices.length < 2) { voiceSelect.classList.add('hidden'); return; }
    voiceSelect.classList.remove('hidden');
    const prevVal = voiceSelect.value;
    voiceSelect.innerHTML = voices
      .map(v => `<option value="${esc(v.voiceURI)}">${esc(Speech.voiceLabel(v))}</option>`)
      .join('');
    if (prevVal && voices.some(v => v.voiceURI === prevVal)) {
      voiceSelect.value = prevVal;
    } else {
      const usVoice = voices.find(v => v.lang === 'en-US');
      if (usVoice) voiceSelect.value = usVoice.voiceURI;
    }
    Speech.setVoice(voices.find(v => v.voiceURI === voiceSelect.value) ?? null);
  }

  speechSynthesis.addEventListener('voiceschanged', populateVoices);
  populateVoices();
  Speech.setRate(speedSelect.value);
  Speech.onEnd(updateSpeechUI);

  speedSelect.addEventListener('change', () => Speech.setRate(speedSelect.value));

  voiceSelect.addEventListener('change', () => {
    const voices = Speech.getEnglishVoices();
    Speech.setVoice(voices.find(v => v.voiceURI === voiceSelect.value) ?? null);
  });

  playPauseBtn.addEventListener('click', () => {
    if (isShowingTranslation) {
      readingSection.innerHTML = originalHtml;
      isShowingTranslation = false;
      translateBtn.textContent = 'Ver traducción';
    }
    if (Speech.isPaused()) {
      Speech.resume();
    } else if (Speech.isPlaying()) {
      Speech.pause();
    } else {
      Speech.play(readingSection);
    }
    updateSpeechUI();
  });

  stopBtn.addEventListener('click', () => {
    Speech.stop();
    updateSpeechUI();
  });

  // ─────────────────────────────────────────────────────────
  // Bottom sheet
  // ─────────────────────────────────────────────────────────
  function openSheet() {
    sheetOverlay.classList.add('is-open');
  }

  function closeSheet() {
    sheetOverlay.classList.remove('is-open');
    if (activeWordEl) {
      activeWordEl.classList.remove('word--active', 'word--loading');
      activeWordEl = null;
    }
  }

  function setSheetLoading() {
    sheetContent.innerHTML = '<div class="sheet-spinner"></div>';
    openSheet();
  }

  function setSheetError(msg) {
    sheetContent.innerHTML = `
      <div class="sheet-error">
        <strong>Error al consultar la API</strong>
        <p>${esc(msg)}</p>
      </div>`;
  }

  closeSheetBtn.addEventListener('click', closeSheet);
  sheetOverlay.addEventListener('click', e => {
    if (e.target === sheetOverlay) closeSheet();
  });

  // ─────────────────────────────────────────────────────────
  // Definition renderer
  // ─────────────────────────────────────────────────────────
  function renderDefinition(def) {
    const translations = (def.translations ?? []).join(', ');

    const verbHtml = (def.is_verb && def.verb_forms) ? `
      <div class="card-section">
        <h4 class="card-section__title">Formas verbales</h4>
        <table class="verb-table">
          <thead>
            <tr><th>Base</th><th>Past</th><th>Past Participle</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>${esc(def.verb_forms.base)}</td>
              <td>${esc(def.verb_forms.past)}</td>
              <td>${esc(def.verb_forms.participle)}</td>
            </tr>
          </tbody>
        </table>
      </div>` : '';

    const usageItems = (def.usage ?? []).map(u => `
      <div class="usage-item">
        <span class="usage-tag">${esc(u.tag)}</span>
        <p>${esc(u.text)}</p>
      </div>`).join('');

    const usageHtml = usageItems ? `
      <div class="card-section">
        <h4 class="card-section__title">Usos</h4>
        ${usageItems}
      </div>` : '';

    const phrasalItems = (def.phrasal_verbs ?? []).map(pv => `
      <div class="phrasal-item">
        <strong>${esc(pv.verb)}</strong>
        <span>${esc(pv.meaning)}</span>
      </div>`).join('');

    const phrasalHtml = phrasalItems ? `
      <div class="card-section">
        <h4 class="card-section__title">Phrasal verbs</h4>
        ${phrasalItems}
      </div>` : '';

    const synonymItems = (def.synonyms ?? []).map(s => `
      <div class="usage-item">
        <span class="usage-tag">${esc(s.word)}</span>
        <p>${esc(s.note)}</p>
      </div>`).join('');

    const synonymsHtml = synonymItems ? `
      <div class="card-section">
        <h4 class="card-section__title">Sinónimos</h4>
        ${synonymItems}
      </div>` : '';

    const examplesHtml = (def.examples ?? []).map(ex => `
      <div class="example-pair">
        <p class="example-en">${esc(ex.en)}</p>
        <p class="example-es">${esc(ex.es)}</p>
      </div>`).join('');

    const exSection = examplesHtml ? `
      <div class="card-section">
        <h4 class="card-section__title">Ejemplos</h4>
        ${examplesHtml}
      </div>` : '';

    sheetContent.innerHTML = `
      <div class="def-word-row">
        <span class="def-word">${esc(def.word)}</span>
      </div>
      <div class="def-phonetics">
        <span class="def-ipa">${esc(def.phonetic_ipa ?? '')}</span>
        <span class="def-approx">≈ ${esc(def.phonetic_approx ?? '')}</span>
      </div>
      <div class="def-translations">${esc(translations)}</div>
      ${verbHtml}
      ${usageHtml}
      ${phrasalHtml}
      ${synonymsHtml}
      ${exSection}
      <div class="def-context">
        <h4 class="def-context__title">En este texto</h4>
        <p class="def-context__text">${esc(def.context_use ?? '')}</p>
      </div>`;
  }

  // ─────────────────────────────────────────────────────────
  // Word click — event delegation on the reading section
  // ─────────────────────────────────────────────────────────
  readingSection.addEventListener('click', async e => {
    const wordEl = e.target.closest('.word');
    if (!wordEl) return;

    if (Speech.isPlaying()) { Speech.pause(); updateSpeechUI(); }

    if (isFetching) return;

    // Second click on the same word → close the sheet
    if (wordEl === activeWordEl) {
      closeSheet();
      return;
    }

    // Deactivate the previous active word
    if (activeWordEl) {
      activeWordEl.classList.remove('word--active', 'word--loading');
    }

    activeWordEl  = wordEl;
    const word    = wordEl.dataset.word;
    const cacheKey = word.toLowerCase();

    // Serve cached definition immediately
    if (cache.has(cacheKey)) {
      wordEl.classList.add('word--active');
      renderDefinition(cache.get(cacheKey));
      openSheet();
      return;
    }

    // Fetch from Claude API
    wordEl.classList.add('word--loading');
    isFetching = true;
    setSheetLoading();

    try {
      const context = Reading.getContext(wordEl);
      const def     = await DictionaryApi.fetchDefinition(word, context);
      cache.set(cacheKey, def);

      // Guard: user may have clicked another word while this was fetching
      if (activeWordEl === wordEl) {
        wordEl.classList.replace('word--loading', 'word--active');
        renderDefinition(def);
      }
    } catch (err) {
      if (activeWordEl === wordEl) {
        wordEl.classList.remove('word--loading', 'word--active');
        activeWordEl = null;

        if (err.code === 'NO_API_KEY') {
          closeSheet();
          openSettings();
        } else {
          setSheetError(err.message);
        }
      }
    } finally {
      isFetching = false;
    }
  });
})();
