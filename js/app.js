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
  const cameraBtn        = document.getElementById('cameraBtn');
  const uploadBtn        = document.getElementById('uploadBtn');
  const cameraInput      = document.getElementById('cameraInput');
  const uploadInput      = document.getElementById('uploadInput');
  const ocrStatus        = document.getElementById('ocrStatus');
  const ocrStatusMsg     = document.getElementById('ocrStatusMsg');
  const clearBtn         = document.getElementById('clearBtn');
  const translateBtn     = document.getElementById('translateBtn');
  const speechBar        = document.getElementById('speechBar');
  const playPauseBtn     = document.getElementById('playPauseBtn');
  const stopBtn          = document.getElementById('stopBtn');
  const speedSelect      = document.getElementById('speedSelect');
  const voiceSelect      = document.getElementById('voiceSelect');
  const shadowingBar    = document.getElementById('shadowingBar');
  const shadowingBtn    = document.getElementById('shadowingBtn');
  const shadowingStatus = document.getElementById('shadowingStatus');
  const summaryBar        = document.getElementById('summaryBar');
  const summaryBtn        = document.getElementById('summaryBtn');
  const summaryStatus     = document.getElementById('summaryStatus');
  const summaryReview     = document.getElementById('summaryReview');
  const summaryTranscript = document.getElementById('summaryTranscript');
  const summaryRetryBtn   = document.getElementById('summaryRetryBtn');
  const summarySendBtn    = document.getElementById('summarySendBtn');
  const conversationBar          = document.getElementById('conversationBar');
  const conversationStartBtn     = document.getElementById('conversationStartBtn');
  const conversationStatus       = document.getElementById('conversationStatus');
  const conversationPanel        = document.getElementById('conversationPanel');
  const conversationTurnLabel    = document.getElementById('conversationTurnLabel');
  const conversationQuestionText = document.getElementById('conversationQuestionText');
  const conversationListenBtn    = document.getElementById('conversationListenBtn');
  const conversationAnswerBtn    = document.getElementById('conversationAnswerBtn');
  const conversationReview       = document.getElementById('conversationReview');
  const conversationTranscriptEl = document.getElementById('conversationTranscript');
  const conversationRetryBtn     = document.getElementById('conversationRetryBtn');
  const conversationSendBtn      = document.getElementById('conversationSendBtn');
  const conversationFeedback     = document.getElementById('conversationFeedback');
  const conversationFeedbackText = document.getElementById('conversationFeedbackText');
  const conversationEndBtn       = document.getElementById('conversationEndBtn');

  // ── State ─────────────────────────────────────────────────
  let activeWordEl = null;
  let isFetching   = false;
  const cache      = new Map(); // word.toLowerCase() → definition object
  let originalHtml         = null; // tokenized innerHTML snapshot before translation
  let translationHtml      = null; // rendered translation (cached to avoid re-fetching)
  let isShowingTranslation = false;
  let isShadowing = false;
  let isSummaryRecording = false;
  let summaryTranscriptText = '';
  let isConversationRecording   = false;
  let conversationHistory       = []; // [{ question, answer, feedback }] — in-memory only
  let conversationCurrentQuestion = '';
  let conversationTurnNumber    = 0;
  let conversationTranscriptText = '';

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
    if (isShadowing) { Shadowing.stopActive(); }
    setShadowingIdle();
    clearShadowingHighlights();
    updateShadowingBar();
    stopSummaryActive();
    updateSummaryBar();
    stopConversationActive();
    updateConversationBar();

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
    textInput.value   = '';
    textInput.rows    = 12;
    cameraInput.value = '';
    uploadInput.value = '';
    ocrStatus.classList.add('hidden');
    ocrStatus.classList.remove('ocr-status--error');
    closeSheet();
    readingSection.classList.add('hidden');
    readingSection.innerHTML = '';
    cache.clear();
    originalHtml         = null;
    translationHtml      = null;
    isShowingTranslation = false;
    cameraBtn.disabled   = false;
    uploadBtn.disabled   = false;
    analyzeBtn.disabled  = false;
    translateBtn.textContent = 'Ver traducción';
    translateBtn.disabled    = false;
    translateBtn.classList.add('hidden');
    clearBtn.classList.add('hidden');
    Speech.stop();
    updateSpeechUI();
    updateSpeechBar();
    if (isShadowing) { Shadowing.stopActive(); }
    setShadowingIdle();
    clearShadowingHighlights();
    updateShadowingBar();
    stopSummaryActive();
    updateSummaryBar();
    stopConversationActive();
    updateConversationBar();
    textInput.focus();
  }

  function setOcrBusy(on) {
    cameraBtn.disabled  = on;
    uploadBtn.disabled  = on;
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
    cameraBtn.disabled  = false;
    uploadBtn.disabled  = false;
    analyzeBtn.disabled = false;
    clearBtn.disabled   = false;
    ocrStatus.classList.remove('hidden');
    ocrStatus.classList.add('ocr-status--error');
    ocrStatusMsg.textContent = msg;
    updateClearBtn();
  }

  textInput.addEventListener('input', updateClearBtn);

  clearBtn.addEventListener('click', clearAll);

  function triggerPhotoInput(inputEl) {
    if (!Storage.getApiKey()) { openSettings(); return; }
    ocrStatus.classList.add('hidden');
    ocrStatus.classList.remove('ocr-status--error');
    inputEl.value = '';
    inputEl.click();
  }

  async function handlePhotoFile(file) {
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
  }

  cameraBtn.addEventListener('click', () => triggerPhotoInput(cameraInput));
  uploadBtn.addEventListener('click',  () => triggerPhotoInput(uploadInput));

  cameraInput.addEventListener('change', async () => {
    const file = cameraInput.files?.[0];
    if (file) await handlePhotoFile(file);
  });

  uploadInput.addEventListener('change', async () => {
    const file = uploadInput.files?.[0];
    if (file) await handlePhotoFile(file);
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
    if (isShadowing) { Shadowing.stopActive(); setShadowingIdle(); clearShadowingHighlights(); }

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
  // Shadowing (Etapa 3 — Speaking, pieza 2)
  // ─────────────────────────────────────────────────────────
  const MIC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
     fill="none" stroke="currentColor" stroke-width="2"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8" y1="23" x2="16" y2="23"/>
  </svg>`;

  function updateShadowingBar() {
    const visible = !readingSection.classList.contains('hidden') && Shadowing.isSupported();
    shadowingBar.classList.toggle('hidden', !visible);
  }

  function clearShadowingHighlights() {
    readingSection.querySelectorAll('.word--shadowed-ok, .word--shadowed-miss')
      .forEach(el => el.classList.remove('word--shadowed-ok', 'word--shadowed-miss'));
  }

  function setShadowingIdle() {
    isShadowing = false;
    shadowingBtn.classList.remove('shadowing-btn--recording');
    shadowingBtn.innerHTML = `${MIC_ICON} Shadowing`;
    shadowingStatus.textContent = '';
  }

  function setShadowingRecording() {
    isShadowing = true;
    shadowingBtn.classList.add('shadowing-btn--recording');
    shadowingBtn.innerHTML = `<span class="pronunciation-btn__dot" aria-hidden="true"></span> Detener`;
    shadowingStatus.textContent = 'Grabando…';
  }

  function processTranscript(transcript) {
    const wordEls = Array.from(readingSection.querySelectorAll('.word'));
    if (!wordEls.length) return;
    const originalWords   = wordEls.map(el => el.dataset.word || el.textContent);
    const recognizedWords = transcript.trim().split(/\s+/);
    const matched = Shadowing.align(originalWords, recognizedWords);
    clearShadowingHighlights();
    wordEls.forEach((el, i) => {
      el.classList.add(matched[i] ? 'word--shadowed-ok' : 'word--shadowed-miss');
    });
    const okCount = matched.filter(Boolean).length;
    const pct = Math.round((okCount / wordEls.length) * 100);
    shadowingStatus.textContent = `${pct}% reconocido (${okCount}/${wordEls.length} palabras)`;
  }

  shadowingBtn.addEventListener('click', async () => {
    if (!Shadowing.isSupported()) return;

    if (isShadowing) {
      const transcript = await Shadowing.stop();
      setShadowingIdle();
      if (transcript.trim()) {
        processTranscript(transcript);
      } else {
        shadowingStatus.textContent = 'No se detectó voz.';
      }
      return;
    }

    if (isShowingTranslation) {
      readingSection.innerHTML = originalHtml;
      isShowingTranslation = false;
      translateBtn.textContent = 'Ver traducción';
    }
    if (Speech.isActive()) { Speech.stop(); updateSpeechUI(); }
    clearShadowingHighlights();
    stopSummaryActive();
    stopConversationActive();

    setShadowingRecording();
    Shadowing.start(
      wordCount => { shadowingStatus.textContent = `Grabando… (${wordCount} palabras)`; },
      async () => {
        const transcript = await Shadowing.stop();
        setShadowingIdle();
        if (transcript.trim()) {
          processTranscript(transcript);
        } else {
          shadowingStatus.textContent = 'No se detectó voz.';
        }
      },
      err => {
        setShadowingIdle();
        shadowingStatus.textContent = err.message;
      }
    );
  });

  // ─────────────────────────────────────────────────────────
  // Spoken summary (Etapa 3 — Speaking, pieza 3)
  // Reuses the Shadowing module's recognition engine (start/stop/stopActive)
  // — it's already a generic continuous=false-with-restart recorder, only
  // its align()/normalize() helpers are shadowing-specific.
  // ─────────────────────────────────────────────────────────
  function updateSummaryBar() {
    const visible = !readingSection.classList.contains('hidden') && Shadowing.isSupported();
    summaryBar.classList.toggle('hidden', !visible);
  }

  function hideSummaryReview() {
    summaryReview.classList.add('hidden');
    summaryTranscript.textContent = '';
    summaryTranscriptText = '';
  }

  function setSummaryIdle() {
    isSummaryRecording = false;
    summaryBtn.classList.remove('shadowing-btn--recording');
    summaryBtn.innerHTML = `${MIC_ICON} Resumir en voz alta`;
    summaryStatus.textContent = '';
  }

  function setSummaryRecording() {
    isSummaryRecording = true;
    summaryBtn.classList.add('shadowing-btn--recording');
    summaryBtn.innerHTML = `<span class="pronunciation-btn__dot" aria-hidden="true"></span> Detener`;
    summaryStatus.textContent = 'Grabando…';
  }

  function showSummaryReview(transcript) {
    setSummaryIdle();
    summaryStatus.textContent = 'Listo. Revisa tu resumen abajo.';
    summaryTranscriptText = transcript;
    summaryTranscript.textContent = transcript;
    summaryReview.classList.remove('hidden');
  }

  // Cancels any in-flight recording and clears the review panel — used when
  // navigating away (new text, clear, or switching to shadowing) so the two
  // features never fight over the shared recognition engine.
  function stopSummaryActive() {
    if (isSummaryRecording) { Shadowing.stopActive(); }
    setSummaryIdle();
    hideSummaryReview();
  }

  summaryBtn.addEventListener('click', () => {
    if (!Shadowing.isSupported()) return;

    if (isSummaryRecording) {
      Shadowing.stop().then(transcript => {
        setSummaryIdle();
        if (transcript.trim()) {
          showSummaryReview(transcript.trim());
        } else {
          summaryStatus.textContent = 'No se detectó voz.';
        }
      });
      return;
    }

    if (Speech.isActive()) { Speech.stop(); updateSpeechUI(); }
    if (isShadowing) { Shadowing.stopActive(); setShadowingIdle(); clearShadowingHighlights(); }
    stopConversationActive();
    hideSummaryReview();

    setSummaryRecording();
    Shadowing.start(
      wordCount => { summaryStatus.textContent = `Grabando… (${wordCount} palabras)`; },
      null,
      err => {
        setSummaryIdle();
        summaryStatus.textContent = err.message;
      }
    );
  });

  summaryRetryBtn.addEventListener('click', () => {
    hideSummaryReview();
    setSummaryIdle();
  });

  summarySendBtn.addEventListener('click', async () => {
    if (!Storage.getApiKey()) { openSettings(); return; }
    const sourceText = textInput.value.trim();
    const transcript = summaryTranscriptText;
    if (!sourceText || !transcript) return;

    summarySendBtn.disabled  = true;
    summaryRetryBtn.disabled = true;
    setSheetLoading();

    try {
      const feedback = await SummaryApi.fetchFeedback(sourceText, transcript);
      renderSummaryFeedback(feedback);
    } catch (err) {
      if (err.code === 'NO_API_KEY') {
        closeSheet();
        openSettings();
      } else {
        setSheetError(err.message);
      }
    } finally {
      summarySendBtn.disabled  = false;
      summaryRetryBtn.disabled = false;
    }
  });

  function renderSummaryFeedback(fb) {
    const scoreKey    = (fb.comprehension_score || '').toLowerCase();
    const scoreLabels = { alta: 'Alta', media: 'Media', baja: 'Baja' };
    const scoreClasses = {
      alta:  'summary-score--high',
      media: 'summary-score--mid',
      baja:  'summary-score--low'
    };
    const scoreLabel = scoreLabels[scoreKey] ?? esc(fb.comprehension_score ?? '—');
    const scoreClass = scoreClasses[scoreKey] ?? '';

    const grammarItems = (fb.grammar_notes ?? []).map(g => `
      <div class="usage-item">
        <span class="usage-tag">${esc(g.error)} → ${esc(g.correction)}</span>
        <p>${esc(g.explanation)}</p>
      </div>`).join('');

    const grammarHtml = grammarItems ? `
      <div class="card-section">
        <h4 class="card-section__title">Gramática</h4>
        ${grammarItems}
      </div>` : '';

    const vocabItems = (fb.vocabulary_suggestions ?? []).map(v => `
      <div class="usage-item">
        <span class="usage-tag">${esc(v.used)} → ${esc(v.suggestion)}</span>
        <p>${esc(v.note)}</p>
      </div>`).join('');

    const vocabHtml = vocabItems ? `
      <div class="card-section">
        <h4 class="card-section__title">Vocabulario</h4>
        ${vocabItems}
      </div>` : '';

    sheetContent.innerHTML = `
      <div class="def-word-row">
        <span class="def-word">Tu resumen — feedback</span>
      </div>
      <div class="summary-score ${scoreClass}">
        <span class="summary-score__label">Comprensión</span>
        <span class="summary-score__value">${esc(scoreLabel)}</span>
      </div>
      ${grammarHtml}
      ${vocabHtml}
      <div class="def-context">
        <h4 class="def-context__title">Nota final</h4>
        <p class="def-context__text">${esc(fb.encouragement ?? '')}</p>
      </div>`;
  }

  // ─────────────────────────────────────────────────────────
  // Guided conversation (Etapa 3 — Speaking, pieza 4)
  // Also reuses Shadowing.start/stop/stopActive for recording answers, and
  // Speech.play for the optional "listen to the question" button.
  // ─────────────────────────────────────────────────────────
  function updateConversationBar() {
    const visible = !readingSection.classList.contains('hidden') && Shadowing.isSupported();
    conversationBar.classList.toggle('hidden', !visible);
  }

  function setConversationAnswerIdle() {
    isConversationRecording = false;
    conversationAnswerBtn.classList.remove('shadowing-btn--recording');
    conversationAnswerBtn.innerHTML = `${MIC_ICON} Responder`;
  }

  function setConversationAnswerRecording() {
    isConversationRecording = true;
    conversationAnswerBtn.classList.add('shadowing-btn--recording');
    conversationAnswerBtn.innerHTML = `<span class="pronunciation-btn__dot" aria-hidden="true"></span> Detener`;
  }

  function hideConversationReview() {
    conversationReview.classList.add('hidden');
    conversationTranscriptEl.textContent = '';
    conversationTranscriptText = '';
  }

  function showConversationReview(transcript) {
    conversationTranscriptText = transcript;
    conversationTranscriptEl.textContent = transcript;
    conversationReview.classList.remove('hidden');
  }

  function showConversationQuestion(text, turnNumber) {
    conversationCurrentQuestion = text;
    conversationTurnNumber      = turnNumber;
    conversationTurnLabel.textContent  = String(turnNumber);
    conversationQuestionText.textContent = text;
    hideConversationReview();
    setConversationAnswerIdle();
  }

  // Resets the whole feature back to its starting state — used both by
  // "Terminar conversación" and defensively whenever another feature
  // (analyze, clear, shadowing, summary) needs the recognition engine.
  function resetConversationUI() {
    conversationHistory         = [];
    conversationCurrentQuestion = '';
    conversationTurnNumber      = 0;
    isConversationRecording     = false;
    conversationPanel.classList.add('hidden');
    conversationReview.classList.add('hidden');
    conversationFeedback.classList.add('hidden');
    conversationQuestionText.textContent = '';
    conversationTranscriptEl.textContent = '';
    conversationTranscriptText  = '';
    conversationStatus.textContent = '';
    conversationStartBtn.classList.remove('hidden');
    conversationStartBtn.disabled = false;
    setConversationAnswerIdle();
  }

  function stopConversationActive() {
    if (isConversationRecording) { Shadowing.stopActive(); }
    resetConversationUI();
  }

  conversationStartBtn.addEventListener('click', async () => {
    if (!Storage.getApiKey()) { openSettings(); return; }
    const sourceText = textInput.value.trim();
    if (!sourceText) return;

    if (Speech.isActive()) { Speech.stop(); updateSpeechUI(); }
    if (isShadowing) { Shadowing.stopActive(); setShadowingIdle(); clearShadowingHighlights(); }
    stopSummaryActive();

    conversationHistory = [];
    conversationStartBtn.disabled  = true;
    conversationStatus.textContent = 'Generando pregunta…';

    try {
      const question = await ConversationApi.fetchFirstQuestion(sourceText);
      conversationStartBtn.classList.add('hidden');
      conversationStatus.textContent = '';
      conversationPanel.classList.remove('hidden');
      showConversationQuestion(question, 1);
    } catch (err) {
      if (err.code === 'NO_API_KEY') {
        openSettings();
      } else {
        conversationStatus.textContent = err.message;
      }
    } finally {
      conversationStartBtn.disabled = false;
    }
  });

  conversationListenBtn.addEventListener('click', () => {
    if (!conversationCurrentQuestion) return;
    if (Speech.isActive()) { Speech.stop(); updateSpeechUI(); }
    const temp = document.createElement('span');
    temp.textContent = conversationCurrentQuestion;
    Speech.play(temp);
    updateSpeechUI();
  });

  conversationAnswerBtn.addEventListener('click', () => {
    if (!Shadowing.isSupported()) return;

    if (isConversationRecording) {
      Shadowing.stop().then(transcript => {
        setConversationAnswerIdle();
        if (transcript.trim()) {
          showConversationReview(transcript.trim());
        } else {
          conversationStatus.textContent = 'No se detectó voz.';
        }
      });
      return;
    }

    if (Speech.isActive()) { Speech.stop(); updateSpeechUI(); }
    if (isShadowing) { Shadowing.stopActive(); setShadowingIdle(); clearShadowingHighlights(); }
    stopSummaryActive();
    hideConversationReview();
    conversationStatus.textContent = '';

    setConversationAnswerRecording();
    Shadowing.start(
      wordCount => { conversationStatus.textContent = `Grabando… (${wordCount} palabras)`; },
      null,
      err => {
        setConversationAnswerIdle();
        conversationStatus.textContent = err.message;
      }
    );
  });

  conversationRetryBtn.addEventListener('click', () => {
    hideConversationReview();
    setConversationAnswerIdle();
  });

  conversationEndBtn.addEventListener('click', () => {
    stopConversationActive();
  });

  function renderConversationSummary(lastAnswerFeedback, summary) {
    sheetContent.innerHTML = `
      <div class="def-word-row">
        <span class="def-word">Cómo te fue en la conversación</span>
      </div>
      <div class="card-section">
        <h4 class="card-section__title">Tu última respuesta</h4>
        <p class="def-context__text">${esc(lastAnswerFeedback ?? '')}</p>
      </div>
      <div class="card-section">
        <h4 class="card-section__title">Fluidez</h4>
        <p class="def-context__text">${esc(summary.fluency_note ?? '')}</p>
      </div>
      <div class="card-section">
        <h4 class="card-section__title">Gramática</h4>
        <p class="def-context__text">${esc(summary.grammar_note ?? '')}</p>
      </div>
      <div class="card-section">
        <h4 class="card-section__title">Qué tan completas fueron tus respuestas</h4>
        <p class="def-context__text">${esc(summary.completeness_note ?? '')}</p>
      </div>
      <div class="def-context">
        <h4 class="def-context__title">Nota final</h4>
        <p class="def-context__text">${esc(summary.encouragement ?? '')}</p>
      </div>`;
  }

  conversationSendBtn.addEventListener('click', async () => {
    if (!Storage.getApiKey()) { openSettings(); return; }
    const sourceText = textInput.value.trim();
    const answer     = conversationTranscriptText;
    if (!sourceText || !answer) return;

    conversationSendBtn.disabled   = true;
    conversationRetryBtn.disabled  = true;
    conversationStatus.textContent = 'Enviando…';

    try {
      const result = await ConversationApi.fetchTurnResult(
        sourceText, conversationHistory, conversationCurrentQuestion, answer, conversationTurnNumber
      );

      conversationHistory.push({
        question: conversationCurrentQuestion,
        answer,
        feedback: result.feedback_breve
      });
      hideConversationReview();
      conversationStatus.textContent = '';

      if (result.conversation_summary) {
        conversationPanel.classList.add('hidden');
        renderConversationSummary(result.feedback_breve, result.conversation_summary);
        openSheet();
        resetConversationUI();
      } else {
        conversationFeedbackText.textContent = result.feedback_breve ?? '';
        conversationFeedback.classList.remove('hidden');
        showConversationQuestion(result.next_question ?? '', conversationTurnNumber + 1);
      }
    } catch (err) {
      if (err.code === 'NO_API_KEY') {
        openSettings();
      } else {
        conversationStatus.textContent = err.message;
      }
    } finally {
      conversationSendBtn.disabled  = false;
      conversationRetryBtn.disabled = false;
    }
  });

  // ─────────────────────────────────────────────────────────
  // Bottom sheet
  // ─────────────────────────────────────────────────────────
  function openSheet() {
    sheetOverlay.classList.add('is-open');
  }

  function closeSheet() {
    sheetOverlay.classList.remove('is-open');
    Pronunciation.stopActive();
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

    const pronunciationHtml = Pronunciation.isSupported() ? `
      <div class="pronunciation-wrap">
        <button class="pronunciation-btn" id="pronunciationBtn">
          <span aria-hidden="true">🎤</span> Practicar pronunciación
        </button>
        <div class="pronunciation-status" id="pronunciationStatus"></div>
      </div>` : '';

    sheetContent.innerHTML = `
      <div class="def-word-row">
        <span class="def-word">${esc(def.word)}</span>
      </div>
      <div class="def-phonetics">
        <span class="def-ipa">${esc(def.phonetic_ipa ?? '')}</span>
        <span class="def-approx">≈ ${esc(def.phonetic_approx ?? '')}</span>
      </div>
      ${pronunciationHtml}
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

    if (Pronunciation.isSupported()) wirePronunciation(def.word);
  }

  // ─────────────────────────────────────────────────────────
  // Pronunciation practice (Etapa 3 — Speaking, pieza 1)
  // ─────────────────────────────────────────────────────────
  function wirePronunciation(word) {
    const btn    = document.getElementById('pronunciationBtn');
    const status = document.getElementById('pronunciationStatus');
    if (!btn || !status) return;

    let stopFn = null;

    function setIdle() {
      btn.className = 'pronunciation-btn';
      btn.innerHTML = '<span aria-hidden="true">🎤</span> Practicar pronunciación';
    }

    function setListening() {
      btn.className = 'pronunciation-btn pronunciation-btn--listening';
      btn.innerHTML = '<span class="pronunciation-btn__dot" aria-hidden="true"></span> Escuchando…';
      status.innerHTML = '';
    }

    function showResult(result) {
      setIdle();
      if (result.matched) {
        status.innerHTML = `
          <div class="pronunciation-result pronunciation-result--ok">
            <span class="pronunciation-result__icon" aria-hidden="true">✓</span>
            <span class="pronunciation-result__text">¡Bien pronunciada!</span>
          </div>`;
      } else {
        const heard = esc(result.heard || '(sin transcripción)');
        status.innerHTML = `
          <div class="pronunciation-result pronunciation-result--miss">
            <span class="pronunciation-result__icon" aria-hidden="true">◎</span>
            <div>
              <p class="pronunciation-result__text">Entendí: <strong>${heard}</strong></p>
              <p class="pronunciation-result__hint">Inténtalo de nuevo</p>
            </div>
          </div>`;
      }
    }

    function showError(err) {
      setIdle();
      status.innerHTML = `<p class="pronunciation-result__hint">${esc(err.message)}</p>`;
    }

    btn.addEventListener('click', () => {
      if (stopFn) {
        // Second click while listening → cancel
        stopFn();
        stopFn = null;
        setIdle();
        return;
      }
      setListening();
      stopFn = Pronunciation.listen(
        word,
        result => { stopFn = null; showResult(result); },
        err    => { stopFn = null; showError(err); }
      );
    });
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
