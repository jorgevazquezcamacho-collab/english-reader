const Reading = (() => {
  function escHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Splits a paragraph into word / non-word tokens and wraps words in spans.
  // split() with a capturing group gives: [nonWord, word, nonWord, word, ...]
  function tokenizePara(paraText) {
    const tokens = paraText.split(/([a-zA-Z]+(?:'[a-zA-Z]+)*)/);
    return tokens.map((tok, i) => {
      if (i % 2 === 1) {
        return `<span class="word" data-word="${tok}">${tok}</span>`;
      }
      return escHtml(tok).replace(/\n/g, '<br>');
    }).join('');
  }

  function render(text) {
    const section = document.getElementById('readingSection');
    const paras = text.split(/\n{2,}/);
    section.innerHTML = paras
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => `<p class="reading-para">${tokenizePara(p)}</p>`)
      .join('');
    section.classList.remove('hidden');
  }

  // Returns the sentence that contains the clicked span.
  // Walks text nodes to find the exact char offset of the span, then scans
  // outward for . ! ? terminators. Sending one sentence (not the full paragraph)
  // keeps context tokens predictable regardless of text formatting.
  function getContext(spanEl) {
    const para = spanEl.closest('.reading-para');
    if (!para) return spanEl.textContent;

    const paraText = para.textContent;
    const wordLen  = spanEl.textContent.length;

    // Accumulate char offset by walking text nodes that precede this span
    let offset = 0;
    let found  = false;
    const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement === spanEl) { found = true; break; }
      offset += node.textContent.length;
    }
    if (!found) return paraText;

    // Scan backwards for the nearest sentence terminator
    let start = 0;
    for (let i = offset - 1; i >= 0; i--) {
      if (paraText[i] === '.' || paraText[i] === '!' || paraText[i] === '?') {
        start = i + 1;
        break;
      }
    }

    // Scan forwards for the nearest sentence terminator
    let end = paraText.length;
    for (let i = offset + wordLen; i < paraText.length; i++) {
      if (paraText[i] === '.' || paraText[i] === '!' || paraText[i] === '?') {
        end = i + 1;
        break;
      }
    }

    return paraText.slice(start, end).trim();
  }

  return { render, getContext };
})();
