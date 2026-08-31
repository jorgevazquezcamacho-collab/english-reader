const Pronunciation = (() => {
  // Safari uses the webkit prefix; Chrome/Edge don't on desktop.
  // On iOS, only Safari exposes webkitSpeechRecognition — Chrome for iOS does not.
  const _Rec = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  // Tracks the stop() function for the currently active session so that
  // closeSheet() can abort recognition without needing a reference to it.
  let _currentStop = null;

  function isSupported() { return _Rec !== null; }

  // Case-insensitive, strips punctuation (keeps apostrophes for contractions).
  function _normalize(text) {
    return text.toLowerCase().replace(/[^a-z']/g, '').trim();
  }

  // Returns true if any alternative transcript contains the target word as a
  // standalone token. Permissive on purpose: if the browser transcribed "hello
  // there" when the user said "hello", we still count it correct.
  function _isMatch(alternatives, targetWord) {
    const target = _normalize(targetWord);
    if (!target) return false;
    return alternatives.some(alt =>
      alt.toLowerCase()
        .split(/\s+/)
        .map(_normalize)
        .filter(Boolean)
        .includes(target)
    );
  }

  // Starts a SpeechRecognition session.
  // Returns a stop() function the caller can use to cancel early.
  // onResult({ heard: string, matched: boolean })
  // onError({ code: string, message: string })
  function listen(targetWord, onResult, onError) {
    if (!_Rec) {
      onError({ code: 'not-supported', message: 'Reconocimiento de voz no disponible en este navegador.' });
      return () => {};
    }

    // Abort any previous session before starting a new one.
    if (_currentStop) { _currentStop(); _currentStop = null; }

    const rec = new _Rec();
    rec.lang            = 'en-US';
    rec.interimResults  = false;
    rec.maxAlternatives = 3;
    rec.continuous      = false;

    let settled = false;

    // Ensures onResult / onError fire at most once.
    function settle(fn) {
      if (settled) return;
      settled = true;
      fn();
    }

    const stop = () => {
      if (settled) return;
      settled = true;
      if (_currentStop === stop) _currentStop = null;
      try { rec.abort(); } catch {}
    };
    _currentStop = stop;

    rec.onresult = e => {
      const resultList = e.results[0];
      const transcript = resultList[0].transcript.trim();
      const alts = Array.from(resultList).map(r => r.transcript.trim());
      settle(() => onResult({ heard: transcript, matched: _isMatch(alts, targetWord) }));
    };

    rec.onerror = e => {
      if (e.error === 'aborted') {
        // Triggered by our own stop() — suppress silently.
        settled = true;
        return;
      }
      const MESSAGES = {
        'not-allowed': 'Permiso de micrófono denegado. Actívalo en la configuración del navegador.',
        'no-speech':   'No se detectó voz. Intenta de nuevo.',
        'network':     'Error de red al conectar con el reconocimiento de voz.',
      };
      const msg = MESSAGES[e.error] ?? `Error inesperado (${e.error}).`;
      settle(() => onError({ code: e.error, message: msg }));
    };

    // onend always fires last — if nothing has settled yet, no speech was captured.
    rec.onend = () => {
      settle(() => onError({ code: 'no-speech', message: 'No se detectó voz. Intenta de nuevo.' }));
    };

    try {
      rec.start();
    } catch {
      stop();
      onError({ code: 'start-error', message: 'No se pudo iniciar el micrófono.' });
    }

    return stop;
  }

  // Called by closeSheet() so recognition doesn't keep running after the
  // definition card is dismissed.
  function stopActive() {
    if (_currentStop) { _currentStop(); _currentStop = null; }
  }

  return { isSupported, listen, stopActive };
})();
