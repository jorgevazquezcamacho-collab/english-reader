const Speech = (() => {
  const RATE_MAP = { b2: 0.75, c1: 1.0, native: 1.25 };
  const FLAGS = {
    'en-US': '🇺🇸', 'en-GB': '🇬🇧', 'en-AU': '🇦🇺',
    'en-CA': '🇨🇦', 'en-IE': '🇮🇪', 'en-NZ': '🇳🇿',
    'en-IN': '🇮🇳', 'en-ZA': '🇿🇦'
  };

  let _rate = 1.0;
  let _voice = null;
  let _utt = null;
  let _wordMap = [];
  let _highlighted = null;
  let _onEndCb = null;

  // Own state flags — never read speechSynthesis.paused/speaking directly
  // for public API, because browser state lags behind our calls by ≥1 tick.
  let _speaking = false;
  let _paused   = false;

  // Position tracking for the Chrome/Windows pause-resume workaround.
  let _fullText      = '';   // textContent of the container passed to play()
  let _sliceOffset   = 0;    // chars skipped at the start of the current utterance
  let _lastCharIndex = 0;    // absolute position in _fullText of the last word boundary
  let _resumeTimer   = null;

  // ── Highlight helpers ──────────────────────────────────────
  function _clearHighlight() {
    if (_highlighted) {
      _highlighted.classList.remove('word--speaking');
      _highlighted = null;
    }
  }

  // absIndex is always relative to _fullText (not the current utterance slice).
  function _highlightAt(absIndex) {
    _clearHighlight();
    const entry = _wordMap.find(e => absIndex >= e.start && absIndex < e.end);
    if (entry) {
      _highlighted = entry.el;
      _highlighted.classList.add('word--speaking');
    }
  }

  // ── Word map ───────────────────────────────────────────────
  // Walks all text nodes in container and records each .word span's absolute
  // char range inside container.textContent. Also caches the full text.
  function _buildWordMap(container) {
    _wordMap = [];
    let pos = 0;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (node.parentElement.classList.contains('word')) {
        _wordMap.push({ start: pos, end: pos + len, el: node.parentElement });
      }
      pos += len;
    }
    _fullText = container.textContent;
  }

  // ── Core speak ─────────────────────────────────────────────
  // Starts a new SpeechSynthesisUtterance from fromOffset chars into _fullText.
  // onboundary charIndex values are relative to the slice, so we add _sliceOffset
  // before looking up the word span.
  function _speak(fromOffset) {
    _sliceOffset = fromOffset;
    const text = _fullText.slice(fromOffset);
    if (!text.trim()) {
      _speaking = false;
      _paused   = false;
      if (_onEndCb) _onEndCb();
      return;
    }

    _utt = new SpeechSynthesisUtterance(text);
    _utt.rate = _rate;
    if (_voice) _utt.voice = _voice;

    _utt.onboundary = e => {
      if (e.name !== 'word') return;
      const absIndex = _sliceOffset + e.charIndex;
      _lastCharIndex = absIndex;
      _highlightAt(absIndex);
    };

    _utt.onend = () => {
      _clearHighlight();
      _utt     = null;
      _speaking = false;
      _paused   = false;
      if (_onEndCb) _onEndCb();
    };

    // 'interrupted' / 'canceled' fire when we call cancel() ourselves — ignore.
    _utt.onerror = e => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        _clearHighlight();
        _utt     = null;
        _speaking = false;
        _paused   = false;
        if (_onEndCb) _onEndCb();
      }
    };

    speechSynthesis.speak(_utt);
  }

  // ── Public API ─────────────────────────────────────────────
  function getEnglishVoices() {
    return speechSynthesis.getVoices()
      .filter(v => v.lang.startsWith('en'))
      .sort((a, b) => {
        if (a.lang === 'en-US' && b.lang !== 'en-US') return -1;
        if (b.lang === 'en-US' && a.lang !== 'en-US') return 1;
        if (a.lang === 'en-GB' && b.lang !== 'en-GB') return -1;
        if (b.lang === 'en-GB' && a.lang !== 'en-GB') return 1;
        return a.name.localeCompare(b.name);
      });
  }

  function voiceLabel(v) { return `${FLAGS[v.lang] ?? '🌐'} ${v.name}`; }
  function setRate(level) { _rate = RATE_MAP[level] ?? 1.0; }
  function setVoice(voice) { _voice = voice; }
  function onEnd(cb) { _onEndCb = cb; }

  // State queries read our own flags, not speechSynthesis.*, so they are
  // synchronously correct immediately after calling pause/resume/stop.
  function isPlaying() { return _speaking && !_paused; }
  function isPaused()  { return _paused; }
  function isActive()  { return _speaking; }

  function play(container) {
    if (_speaking) return;
    _buildWordMap(container);
    _sliceOffset   = 0;
    _lastCharIndex = 0;
    _speaking      = true;
    _paused        = false;
    _speak(0);
  }

  function pause() {
    if (!_speaking || _paused) return;
    // Cancel any pending resume-fallback before we pause again.
    if (_resumeTimer) { clearTimeout(_resumeTimer); _resumeTimer = null; }
    _paused = true;
    speechSynthesis.pause();
  }

  function resume() {
    if (!_paused) return;
    // Optimistically update our flag so callers see isPlaying() = true immediately.
    _paused = false;
    speechSynthesis.resume();

    // Chrome / Edge on Windows sometimes silently ignore resume().
    // After 300 ms, if the browser is still paused, cancel and restart
    // a new utterance from the last reported word boundary.
    _resumeTimer = setTimeout(() => {
      _resumeTimer = null;
      if (_speaking && !_paused && speechSynthesis.paused) {
        speechSynthesis.cancel();
        _speak(_lastCharIndex);
      }
    }, 300);
  }

  function stop() {
    if (_resumeTimer) { clearTimeout(_resumeTimer); _resumeTimer = null; }
    speechSynthesis.cancel();
    _clearHighlight();
    _utt           = null;
    _speaking      = false;
    _paused        = false;
    _lastCharIndex = 0;
  }

  return { play, pause, resume, stop, setRate, setVoice,
           isPlaying, isPaused, isActive,
           getEnglishVoices, voiceLabel, onEnd };
})();
