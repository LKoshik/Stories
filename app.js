(function () {
  'use strict';

  const els = {
    views: {
      library: document.getElementById('view-library'),
      chapters: document.getElementById('view-chapters'),
      reader: document.getElementById('view-reader'),
    },
    storyGrid: document.getElementById('story-grid'),
    chaptersTitle: document.getElementById('chapters-title'),
    chaptersMeta: document.getElementById('chapters-meta'),
    chapterList: document.getElementById('chapter-list'),
    readerCrumb: document.getElementById('reader-crumb'),
    readerTitle: document.getElementById('reader-title'),
    readerBody: document.getElementById('reader-body'),
    btnToLibrary: document.getElementById('btn-to-library'),
    btnToChapters: document.getElementById('btn-to-chapters'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
  };

  const state = { manifest: null, storySlug: null };

  init();

  async function init() {
    els.btnToLibrary.addEventListener('click', () => { location.hash = '#/'; });
    els.btnToChapters.addEventListener('click', () => {
      location.hash = state.storySlug ? '#/' + state.storySlug : '#/';
    });
    els.btnPrev.addEventListener('click', () => stepChapter(-1));
    els.btnNext.addEventListener('click', () => stepChapter(1));

    try {
      state.manifest = await loadManifest();
    } catch (err) {
      showFatalError(err);
      return;
    }

    window.addEventListener('hashchange', route);
    route();
  }

  async function loadManifest() {
    const res = await fetch('stories.json');
    if (!res.ok) throw new Error('stories.json responded with ' + res.status);
    return res.json();
  }

  // ---------- routing ----------
  // '#/' -> library, '#/<slug>' -> chapters, '#/<slug>/<n>' -> reader

  function route() {
    const parts = location.hash
      .replace(/^#\/?/, '')
      .split('/')
      .filter(Boolean)
      .map(decodeURIComponent);

    if (parts.length === 0) renderLibrary();
    else if (parts.length === 1) renderChapters(parts[0]);
    else renderReader(parts[0], parseInt(parts[1], 10));
  }

  function findStory(slug) {
    return state.manifest.stories.find((s) => s.slug === slug);
  }

  // ---------- library ----------

  function renderLibrary() {
    showView('library');
    document.title = 'Stories · Koshik';

    els.storyGrid.innerHTML = '';
    state.manifest.stories.forEach((story, i) => {
      const card = document.createElement('article');
      card.className = 'story-card';
      card.tabIndex = 0;
      card.innerHTML = `
        <div class="story-card-glow" aria-hidden="true"></div>
        <span class="story-index" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <h2 class="story-title">${escapeHtml(story.title)}</h2>
        <p class="story-desc">${escapeHtml(story.description)}</p>
        <div class="story-meta">
          <span>${story.chapters.length} ${story.chapters.length === 1 ? 'chapter' : 'chapters'}</span>
          <span class="meta-dot" aria-hidden="true"></span>
          <span>${escapeHtml(story.genre)}</span>
        </div>`;
      const go = () => { location.hash = '#/' + story.slug; };
      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => activateOnKey(e, go));
      els.storyGrid.appendChild(card);
    });

    window.scrollTo(0, 0);
  }

  // ---------- chapters ----------

  function renderChapters(slug) {
    const story = findStory(slug);
    if (!story) { location.hash = '#/'; return; }

    state.storySlug = slug;
    showView('chapters');
    document.title = story.title + ' · Stories';

    els.chaptersTitle.textContent = story.title;
    els.chaptersMeta.textContent =
      `${story.chapters.length} ${story.chapters.length === 1 ? 'chapter' : 'chapters'}`;

    els.chapterList.innerHTML = '';
    story.chapters.forEach((ch) => {
      const li = document.createElement('li');
      li.className = 'chapter-row';
      li.tabIndex = 0;
      li.innerHTML = `
        <span class="chapter-num" aria-hidden="true">${String(ch.number).padStart(2, '0')}</span>
        <span class="chapter-name">${escapeHtml(ch.title)}</span>
        <span class="chapter-go" aria-hidden="true">→</span>`;
      const go = () => { location.hash = `#/${slug}/${ch.number}`; };
      li.addEventListener('click', go);
      li.addEventListener('keydown', (e) => activateOnKey(e, go));
      els.chapterList.appendChild(li);
    });

    window.scrollTo(0, 0);
  }

  // ---------- reader ----------

  async function renderReader(slug, chapterNumber) {
    const story = findStory(slug);
    if (!story) { location.hash = '#/'; return; }

    const idx = story.chapters.findIndex((c) => c.number === chapterNumber);
    if (idx === -1) { location.hash = '#/' + slug; return; }

    const chapter = story.chapters[idx];
    state.storySlug = slug;

    showView('reader');
    document.title = `${chapter.title} · ${story.title}`;
    els.readerCrumb.textContent = `${story.title} · ${chapter.title}`;
    els.readerTitle.textContent = chapter.title;
    els.readerBody.innerHTML = '<p class="reader-status">Loading…</p>';
    updateReaderNav(story, idx);
    window.scrollTo(0, 0);

    try {
      const res = await fetch(chapter.file);
      if (!res.ok) throw new Error('responded with ' + res.status);
      const raw = await res.text();
      els.readerBody.innerHTML = parseChapterText(raw);
    } catch (err) {
      els.readerBody.innerHTML =
        `<p class="reader-status reader-status-error">Couldn't load this chapter (${escapeHtml(err.message)}). ` +
        `If you're previewing this by double-clicking index.html, your browser blocks it from reading local files — ` +
        `run a local server (e.g. <code>python3 -m http.server</code>) or view it through GitHub Pages instead.</p>`;
    }
  }

  function updateReaderNav(story, idx) {
    const prev = story.chapters[idx - 1];
    const next = story.chapters[idx + 1];
    els.btnPrev.disabled = !prev;
    els.btnNext.disabled = !next;
    els.btnPrev.dataset.target = prev ? prev.number : '';
    els.btnNext.dataset.target = next ? next.number : '';
  }

  function stepChapter(direction) {
    const btn = direction === -1 ? els.btnPrev : els.btnNext;
    if (btn.disabled || !btn.dataset.target) return;
    location.hash = `#/${state.storySlug}/${btn.dataset.target}`;
  }

  // ---------- chapter text -> HTML ----------
  // blank line = paragraph break, *word* = italics, a line of --- = scene break

  function parseChapterText(raw) {
    return raw
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        if (p === '---' || p === '***') return '<p class="scene-break">· · ·</p>';
        const safe = escapeHtml(p).replace(/\*(.+?)\*/g, '<em>$1</em>');
        return `<p>${safe}</p>`;
      })
      .join('\n');
  }

  // ---------- helpers ----------

  function showView(name) {
    Object.entries(els.views).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
  }

  function activateOnKey(e, fn) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showFatalError(err) {
    document.body.innerHTML = `
      <div style="max-width:640px;margin:0 auto;padding:5rem 1.5rem;font-family:sans-serif;color:#f6ece1;">
        <h1 style="font-family:Georgia,serif;font-weight:500;margin-bottom:1rem;">Couldn't load the library</h1>
        <p style="color:#af9bab;line-height:1.7;">${escapeHtml(err.message)}</p>
        <p style="color:#af9bab;line-height:1.7;margin-top:1rem;">
          If you're previewing this by double-clicking index.html, your browser blocks it from reading local files.
          Run a local server in this folder (e.g. <code>python3 -m http.server</code>) or view it through GitHub Pages instead.
        </p>
      </div>`;
  }
})();
