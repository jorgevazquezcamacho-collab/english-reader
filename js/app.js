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

  // ── Settings modal ────────────────────────────────────────
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

  settingsOverlay.addEventListener('click', (e) => {
    if (e.target === settingsOverlay) closeSettings();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !settingsOverlay.classList.contains('hidden')) {
      closeSettings();
    }
  });

  // ── Save API key ──────────────────────────────────────────
  saveApiKeyBtn.addEventListener('click', () => {
    Storage.saveApiKey(apiKeyInput.value);
    saveFeedback.classList.remove('hidden');
    setTimeout(() => saveFeedback.classList.add('hidden'), 2000);
  });

  // ── Toggle key visibility ─────────────────────────────────
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

  // ── Analyze (placeholder) ─────────────────────────────────
  analyzeBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) return;

    if (!Storage.getApiKey()) {
      openSettings();
      return;
    }

    // TODO (Etapa 1B): pasar texto a reading.js para tokenizar y renderizar
    console.log('[app] Analizar ->', text.slice(0, 60) + (text.length > 60 ? '…' : ''));
  });
})();
