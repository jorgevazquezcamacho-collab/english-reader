const Shadowing = (() => {
  const _Rec = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function isSupported() { return _Rec !== null; }

  function normalize(text) {
    return text.toLowerCase().replace(/[^a-z']/g, '').trim();
  }

  // Greedy forward alignment with a sliding window.
  // Returns a boolean array the same length as originalWords.
  // windowSize lets recognized words "skip ahead" to stay in sync when
  // the user skips a word or the engine mis-transcribes one.
  function align(originalWords, recognizedWords, windowSize = 8) {
    const normOrig = originalWords.map(normalize);
    const normRec  = recognizedWords.map(normalize).filter(Boolean);
    const matched  = new Array(originalWords.length).fill(false);
    let j = 0;
    for (let i = 0; i < normOrig.length; i++) {
      if (!normOrig[i]) { matched[i] = true; continue; }
      const end = Math.min(j + windowSize, normRec.length);
      for (let k = j; k < end; k++) {
        if (normRec[k] === normOrig[i]) {
          matched[i] = true;
          j = k + 1;
          break;
        }
      }
    }
    return matched;
  }

  let _rec            = null;
  let _active         = false;   // true while user wants recording to run
  let _finalTranscript = '';     // accumulated across all short sessions
  let _onProgress     = null;
  let _onError        = null;

  // Launches one non-continuous session. Called again from onend when _active=true.
  function _startSession() {
    if (!_active) return;

    const rec = new _Rec();
    rec.lang            = 'en-US';
    rec.continuous      = false;  // short session per utterance — more reliable in Chrome
    rec.interimResults  = false;  // only final results; avoids empty-transcript interim bug
    rec.maxAlternatives = 1;

    rec.onresult = e => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal && t.trim()) {
          _finalTranscript += t + ' ';
        }
      }
      const wordCount = _finalTranscript.trim().split(/\s+/).filter(Boolean).length;
      _onProgress(wordCount);
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

  // Starts recording. Sessions restart automatically until stop() or stopActive() is called.
  // onProgress(wordCount), onUnexpectedEnd (unused with restart strategy), onError({code,message})
  function start(onProgress, _onUnexpectedEnd, onError) {
    if (!_Rec) {
      onError({ code: 'not-supported', message: 'Reconocimiento de voz no disponible en este navegador.' });
      return;
    }
    if (_rec) { try { _rec.abort(); } catch {} _rec = null; }

    _finalTranscript = '';
    _active          = true;
    _onProgress      = onProgress;
    _onError         = onError;

    _startSession();
  }

  // Stops recording gracefully. Returns a Promise<string> with the full transcript.
  function stop() {
    return new Promise(resolve => {
      _active = false;
      if (!_rec) {
        resolve(_finalTranscript.trim());
        return;
      }
      const rec = _rec;
      _rec = null;
      rec.onend = () => resolve(_finalTranscript.trim());
      try { rec.stop(); } catch { resolve(_finalTranscript.trim()); }
    });
  }

  // Aborts immediately without returning a result (used when user navigates away).
  function stopActive() {
    _active          = false;
    _finalTranscript = '';
    if (_rec) {
      try { _rec.abort(); } catch {}
      _rec = null;
    }
  }

  return { isSupported, normalize, align, start, stop, stopActive };
})();
