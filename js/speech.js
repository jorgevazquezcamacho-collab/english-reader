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

  function _clearHighlight() {
    if (_highlighted) {
      _highlighted.classList.remove('word--speaking');
      _highlighted = null;
    }
  }

  function _highlightAt(charIndex) {
    _clearHighlight();
    const entry = _wordMap.find(e => charIndex >= e.start && charIndex < e.end);
    if (entry) {
      _highlighted = entry.el;
      _highlighted.classList.add('word--speaking');
    }
  }

  // Walks text nodes in container to build char-offset → span map,
  // then returns container.textContent as the utterance string.
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
    return container.textContent;
  }

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
  function isPlaying() { return speechSynthesis.speaking && !speechSynthesis.paused; }
  function isPaused() { return speechSynthesis.paused; }
  function isActive() { return speechSynthesis.speaking || speechSynthesis.paused; }

  function play(container) {
    if (speechSynthesis.paused) { speechSynthesis.resume(); return; }
    if (speechSynthesis.speaking) return;

    const text = _buildWordMap(container);
    if (!text.trim()) return;

    _utt = new SpeechSynthesisUtterance(text);
    _utt.rate = _rate;
    if (_voice) _utt.voice = _voice;

    _utt.onboundary = e => {
      if (e.name === 'word') _highlightAt(e.charIndex);
    };

    _utt.onend = () => {
      _clearHighlight();
      _utt = null;
      if (_onEndCb) _onEndCb();
    };

    _utt.onerror = e => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        _clearHighlight();
        _utt = null;
        if (_onEndCb) _onEndCb();
      }
    };

    speechSynthesis.speak(_utt);
  }

  function pause() { if (isPlaying()) speechSynthesis.pause(); }
  function resume() { if (isPaused()) speechSynthesis.resume(); }

  function stop() {
    speechSynthesis.cancel();
    _clearHighlight();
    _utt = null;
  }

  return { play, pause, resume, stop, setRate, setVoice,
           isPlaying, isPaused, isActive,
           getEnglishVoices, voiceLabel, onEnd };
})();
