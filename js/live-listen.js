const LiveListen = (() => {
  const _Rec = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function isSupported() { return _Rec !== null; }

  let _rec      = null;
  let _active   = false;   // true while the user wants listening to run
  let _onPhrase = null;
  let _onError  = null;

  // Launches one non-continuous session. Called again from onend when
  // _active=true — same restart strategy as shadowing.js, but instead of
  // accumulating into one transcript, each final phrase is reported as soon
  // as it completes so it can be translated independently.
  function _startSession() {
    if (!_active) return;

    const rec = new _Rec();
    rec.lang            = 'en-US';
    rec.continuous      = false;  // short session per utterance — more reliable in Chrome
    rec.interimResults  = false;  // only final results; avoids empty-transcript interim bug
    rec.maxAlternatives = 1;

    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal && t) {
          _onPhrase(t);
        }
      }
    };

    rec.onerror = e => {
      if (e.error === 'aborted') return;
      // 'no-speech' is normal between utterances — onend fires next and restarts
      if (e.error === 'no-speech') return;
      const MESSAGES = {
        'not-allowed': 'Permiso de micrófono denegado. Actívalo en la configuración del navegador.',
        'network':     'Error de red en reconocimiento de voz.',
      };
      const msg = MESSAGES[e.error] ?? `Error inesperado (${e.error}).`;
      _active = false;
      _rec    = null;
      _onError({ code: e.error, message: msg });
    };

    rec.onend = () => {
      _rec = null;
      if (_active) {
        // Session ended naturally (utterance done or no-speech timeout) — restart
        _startSession();
      }
    };

    _rec = rec;
    try {
      rec.start();
    } catch (err) {
      _active = false;
      _rec    = null;
      _onError({ code: 'start-error', message: 'No se pudo iniciar el micrófono.' });
    }
  }

  // Starts listening. Sessions restart automatically until stop() is called.
  // onPhrase(text) fires once per completed final phrase.
  // onError({code, message}) fires on unrecoverable errors.
  function start(onPhrase, onError) {
    if (!_Rec) {
      onError({ code: 'not-supported', message: 'Reconocimiento de voz no disponible en este navegador.' });
      return;
    }
    if (_rec) { try { _rec.abort(); } catch {} _rec = null; }

    _active   = true;
    _onPhrase = onPhrase;
    _onError  = onError;

    _startSession();
  }

  // Stops listening. Any in-flight utterance is discarded (no pending
  // transcript to flush — each phrase was already reported via onPhrase).
  function stop() {
    _active = false;
    if (_rec) {
      const rec = _rec;
      _rec = null;
      try { rec.stop(); } catch {}
    }
  }

  return { isSupported, start, stop };
})();
