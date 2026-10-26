(function () {
'use strict';

window.onerror = function (msg, url, line, col, err) {
  if (window.astra && window.astra.log) {
    window.astra.log(`WINDOW ERROR: ${msg} at ${url}:${line}:${col} stack: ${err ? err.stack : ''}`);
  }
};

const $ = (sel) => document.querySelector(sel);
const astra = window.astra || window.quantum;
if (astra && astra.log) astra.log('renderer.js starting execution');

const els = {
  app: $('#app'),
  tabs: $('#tabs'),
  newTab: $('#new-tab'),
  back: $('#nav-back'),
  forward: $('#nav-forward'),
  reload: $('#nav-reload'),
  address: $('#address'),
  protocolChip: $('#protocol-chip'),
  laserProgress: $('#laser-progress'),
  telemetryTabs: $('#telemetry-tabs'),
  winMin: $('#win-min'),
  winMax: $('#win-max'),
  winClose: $('#win-close'),
  zoomBadge: $('#zoom-badge'),
  devtoolsBtn: $('#devtools-btn'),
  bookmarkBtn: $('#bookmark-btn'),
  downloadsBtn: $('#downloads-btn'),
  dlBadge: $('#dl-badge'),
  downloadsPanel: $('#downloads-panel'),
  downloadsList: $('#downloads-list'),
  downloadsClear: $('#downloads-clear'),
  bookmarksToggleBtn: $('#bookmarks-toggle-btn'),
  bookmarksBar: $('#bookmarks-bar'),
  bookmarksList: $('#bookmarks-list'),
  findBar: $('#find-bar'),
  findInput: $('#find-input'),
  findCount: $('#find-count'),
  findPrev: $('#find-prev'),
  findNext: $('#find-next'),
  findClose: $('#find-close'),
  settingsBtn: $('#settings-btn'),
};

let state = { tabs: [], activeId: null, tabCount: 0 };
let currentZoom = 100;
let currentBookmarks = [];
let currentDownloads = [];

const urlParams = new URLSearchParams(window.location.search);
const isIncognitoMode = urlParams.get('incognito') === '1' || urlParams.get('incognito') === 'true';

if (isIncognitoMode) {
  document.body.classList.add('incognito-mode');
  const incogPill = $('#telemetry-incognito');
  if (incogPill) incogPill.classList.remove('hidden');
  if (els.address) {
    els.address.placeholder = 'Search privately or enter URL...';
  }
}

function activeTab() {
  return state.tabs.find((t) => t.id === state.activeId) || null;
}

function isNewTabUrl(url) {
  if (!url) return true;
  return url.includes('newtab.html') || url === 'astra://newtab' || url.startsWith('about:blank');
}

function updateChromeHeight() {
  let height = 92;
  const bmVisible = !els.bookmarksBar.classList.contains('hidden');
  const dlVisible = !els.downloadsPanel.classList.contains('hidden');

  if (bmVisible) height += 26;
  if (dlVisible) height += 80;

  if (astra && astra.setChromeHeight) {
    astra.setChromeHeight(height);
  }
}

function faviconEl(tab) {
  const fav = document.createElement('span');
  fav.className = 'tab-favicon';
  if (tab.loading) {
    fav.classList.add('spin');
  } else if (tab.favicon && !tab.favicon.includes('default_favicon')) {
    fav.style.backgroundImage = `url("${tab.favicon}")`;
  } else {
    fav.textContent = '⬡';
    fav.style.color = tab.id === state.activeId ? 'var(--accent-cyan)' : 'var(--text-dim)';
  }
  return fav;
}

function renderTabs() {
  els.tabs.innerHTML = '';
  state.tabs.forEach((tab, index) => {
    const el = document.createElement('div');
    const isActive = tab.id === state.activeId;
    el.className = 'tab' + (isActive ? ' active' : '') + (tab.pinned ? ' pinned' : '');
    el.title = tab.title || 'New Tab';

    if (tab.pinned) {
      const pin = document.createElement('span');
      pin.className = 'pin-glyph';
      pin.textContent = '📌';
      el.appendChild(pin);
    } else {
      const idx = document.createElement('span');
      idx.className = 'tab-idx';
      idx.textContent = String(index + 1).padStart(2, '0');
      el.appendChild(idx);
    }

    // Favicon
    el.appendChild(faviconEl(tab));

    // Audio Speaker Badge
    if (tab.hasAudio || tab.muted) {
      const audioIcon = document.createElement('span');
      audioIcon.className = 'tab-audio-icon' + (tab.muted ? ' muted' : '');
      audioIcon.innerHTML = tab.muted ? '&#x1F507;' : '&#x1F50A;';
      audioIcon.title = tab.muted ? 'Unmute Tab' : 'Mute Tab';
      audioIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        astra.muteTab(tab.id);
      });
      el.appendChild(audioIcon);
    }

    // Title (if not pinned)
    if (!tab.pinned) {
      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = isNewTabUrl(tab.url) ? 'New Tab' : (tab.title || tab.url || 'Tab');
      el.appendChild(title);

      // Close button
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.innerHTML = '&#x2715;';
      close.title = 'Close [Ctrl+W]';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        astra.closeTab(tab.id);
      });
      el.appendChild(close);
    }

    // Tab click
    el.addEventListener('click', () => astra.activateTab(tab.id));
    el.addEventListener('auxclick', (e) => {
      if (e.button === 1 && !tab.pinned) astra.closeTab(tab.id); // Middle-click
    });

    // Native Tab Right-Click Context Menu (zero clipping, drawn over whole window)
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      astra.showTabContextMenu(tab.id);
    });

    els.tabs.appendChild(el);
  });

  if (els.telemetryTabs) {
    els.telemetryTabs.textContent = `[TABS: ${String(state.tabs.length).padStart(2, '0')}]`;
  }
}

function formatDisplayUrl(url) {
  if (!url) return '';
  if (isNewTabUrl(url)) return '';
  const lower = url.toLowerCase();
  if (lower === 'astra://game' || lower === 'chrome://dino' || lower === 'astra://runner' || (lower.includes('error.html') && lower.includes('game=1'))) return 'astra://game';
  if (lower === 'astra://settings' || lower.includes('settings.html')) return 'astra://settings';
  if (lower === 'astra://history' || lower.includes('history.html')) return 'astra://history';
  if (lower === 'astra://bookmarks' || lower.includes('bookmarks.html')) return 'astra://bookmarks';
  if (lower === 'astra://downloads' || lower.includes('downloads.html')) return 'astra://downloads';
  if (lower === 'astra://newtab' || lower.includes('newtab.html')) return '';
  return url;
}

function updateProtocolChip(url) {
  if (!els.protocolChip) return;
  els.protocolChip.className = 'protocol-chip';

  if (!url || isNewTabUrl(url)) {
    els.protocolChip.textContent = isIncognitoMode ? '[INCOGNITO]' : '[LOCAL]';
    els.protocolChip.classList.add('proto-local');
  } else if (url.startsWith('astra://')) {
    els.protocolChip.textContent = '[ASTRA]';
    els.protocolChip.classList.add('proto-local');
  } else if (url.startsWith('https://')) {
    els.protocolChip.textContent = '[HTTPS]';
  } else if (url.startsWith('http://')) {
    els.protocolChip.textContent = '[HTTP]';
    els.protocolChip.classList.add('proto-insecure');
  } else {
    els.protocolChip.textContent = '[SYS]';
    els.protocolChip.classList.add('proto-query');
  }
}

function updateBookmarkStar(url) {
  const isBm = currentBookmarks.some((b) => b.url === url);
  els.bookmarkBtn.classList.toggle('bookmarked', isBm);
  els.bookmarkBtn.innerHTML = isBm ? '&#x2605;' : '&#x2606;';
  els.bookmarkBtn.title = isBm ? 'Remove Bookmark [Ctrl+D]' : 'Bookmark Page [Ctrl+D]';
}

function renderToolbar() {
  const tab = activeTab();
  els.back.disabled = !tab || !tab.canGoBack;
  els.forward.disabled = !tab || !tab.canGoForward;

  const loading = !!(tab && tab.loading);
  if (els.laserProgress) {
    els.laserProgress.classList.toggle('hidden', !loading);
  }
  els.reload.querySelector('.glyph').innerHTML = loading ? '&#x2715;' : '&#x21BB;';
  els.reload.title = loading ? 'Stop' : 'Reload [Ctrl+R]';

  const tabUrl = tab ? tab.url : '';
  const displayUrl = formatDisplayUrl(tabUrl);
  updateProtocolChip(displayUrl || tabUrl);
  updateBookmarkStar(tabUrl);

  if (document.activeElement !== els.address) {
    els.address.value = displayUrl;
  }
}

function render() {
  renderTabs();
  renderToolbar();
}

// ---- Bookmarks ----
function renderBookmarksBar() {
  els.bookmarksList.innerHTML = '';
  currentBookmarks.forEach((bm) => {
    const a = document.createElement('a');
    a.className = 'bookmark-item';
    a.href = bm.url;
    a.title = `${bm.title} (${bm.url})`;

    if (bm.favicon) {
      const fav = document.createElement('span');
      fav.className = 'bm-favicon';
      fav.style.backgroundImage = `url("${bm.favicon}")`;
      a.appendChild(fav);
    }

    const title = document.createElement('span');
    title.textContent = bm.title || bm.url;
    a.appendChild(title);

    a.addEventListener('click', (e) => {
      e.preventDefault();
      astra.go(bm.url);
    });

    els.bookmarksList.appendChild(a);
  });
}

els.bookmarkBtn.addEventListener('click', async () => {
  const tab = activeTab();
  if (!tab || isNewTabUrl(tab.url)) return;
  await astra.toggleBookmark({
    url: tab.url,
    title: tab.title || tab.url,
    favicon: tab.favicon,
  });
});

els.bookmarksToggleBtn.addEventListener('click', () => {
  els.bookmarksBar.classList.toggle('hidden');
  updateChromeHeight();
});

// ---- Downloads Panel ----
function renderDownloads() {
  const activeCount = currentDownloads.filter((d) => d.state === 'progressing').length;
  if (activeCount > 0) {
    els.dlBadge.textContent = String(activeCount);
    els.dlBadge.classList.remove('hidden');
  } else {
    els.dlBadge.classList.add('hidden');
  }

  els.downloadsList.innerHTML = '';
  if (currentDownloads.length === 0) {
    els.downloadsList.innerHTML = '<div class="dl-empty">// NO ACTIVE DOWNLOADS</div>';
    return;
  }

  currentDownloads.forEach((dl) => {
    const item = document.createElement('div');
    item.className = 'dl-item';

    const top = document.createElement('div');
    top.className = 'dl-item-top';
    top.innerHTML = `
      <span class="dl-name" title="${dl.name}">${dl.name}</span>
      <span class="dl-status ${dl.state}">${dl.state === 'progressing' ? dl.percent + '%' : dl.state.toUpperCase()}</span>
    `;
    item.appendChild(top);

    if (dl.state === 'progressing') {
      const bar = document.createElement('div');
      bar.className = 'dl-progress-bar';
      bar.innerHTML = `<div class="dl-progress-fill" style="width:${dl.percent}%"></div>`;
      item.appendChild(bar);
    }

    if (dl.path) {
      const actions = document.createElement('div');
      actions.className = 'dl-item-actions';
      const openBtn = document.createElement('button');
      openBtn.className = 'dl-btn';
      openBtn.textContent = 'SHOW IN FOLDER';
      openBtn.addEventListener('click', () => astra.openDownloadItem(dl.path));
      actions.appendChild(openBtn);
      item.appendChild(actions);
    }

    els.downloadsList.appendChild(item);
  });
}

els.downloadsBtn.addEventListener('click', () => {
  els.downloadsPanel.classList.toggle('hidden');
  updateChromeHeight();
});

els.downloadsClear.addEventListener('click', async () => {
  await astra.clearDownloads();
});

// ---- Inline Find in Page [Ctrl+F] (Inside visible toolbar, never cut off) ----
function openFindBar() {
  els.findBar.classList.remove('hidden');
  els.findInput.focus();
  els.findInput.select();
  const text = els.findInput.value.trim();
  if (text) astra.findInPage(text, true, false);
}

function closeFindBar() {
  els.findBar.classList.add('hidden');
  astra.stopFindInPage('clearSelection');
  els.findCount.textContent = '[ 0/0 ]';
}

els.findClose.addEventListener('click', closeFindBar);

els.findInput.addEventListener('input', () => {
  const text = els.findInput.value.trim();
  if (text) {
    astra.findInPage(text, true, false);
  } else {
    astra.stopFindInPage('clearSelection');
    els.findCount.textContent = '[ 0/0 ]';
  }
});

els.findNext.addEventListener('click', () => {
  const text = els.findInput.value.trim();
  if (text) astra.findInPage(text, true, true);
});

els.findPrev.addEventListener('click', () => {
  const text = els.findInput.value.trim();
  if (text) astra.findInPage(text, false, true);
});

els.findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const text = els.findInput.value.trim();
    if (text) astra.findInPage(text, !e.shiftKey, true);
  } else if (e.key === 'Escape') {
    closeFindBar();
  }
});

// ---- IPC event listeners ----
astra.onTabsState((next) => {
  state = next;
  render();
});

astra.onWindowState((win) => {
  els.winMax.title = win.maximized ? 'Restore' : 'Maximize';
  els.winMax.querySelector('.glyph').innerHTML = win.maximized ? '&#x29C9;' : '&#x25A1;';
});

astra.onFocusAddress(() => {
  els.address.focus();
  els.address.select();
});

astra.onZoom((data) => {
  currentZoom = data.factor;
  if (els.zoomBadge) els.zoomBadge.textContent = `${currentZoom}%`;
});

astra.onBookmarksUpdate((bm) => {
  currentBookmarks = bm || [];
  renderBookmarksBar();
  const tab = activeTab();
  if (tab) updateBookmarkStar(tab.url);
});

astra.onDownloadsUpdate((dl) => {
  currentDownloads = dl || [];
  renderDownloads();
});

astra.onFindResult((res) => {
  if (res) {
    els.findCount.textContent = `[ ${res.activeMatchOrdinal || 0}/${res.matches || 0} ]`;
  }
});

astra.onOpenFind(() => openFindBar());
astra.onToggleDownloads(() => {
  els.downloadsPanel.classList.toggle('hidden');
  updateChromeHeight();
});
astra.onToggleBookmark(async () => {
  const tab = activeTab();
  if (!tab || isNewTabUrl(tab.url)) return;
  await astra.toggleBookmark({
    url: tab.url,
    title: tab.title || tab.url,
    favicon: tab.favicon,
  });
});

// ---- Toolbar Actions ----
els.newTab.addEventListener('click', () => astra.newTab());
els.back.addEventListener('click', () => astra.back());
els.forward.addEventListener('click', () => astra.forward());
els.reload.addEventListener('click', (e) => {
  astra.reload(e.shiftKey);
});

els.address.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const value = els.address.value.trim();
    if (value) astra.go(value);
    els.address.blur();
  } else if (e.key === 'Escape') {
    const tab = activeTab();
    els.address.value = (tab && !isNewTabUrl(tab.url)) ? tab.url : '';
    els.address.blur();
  }
});

els.address.addEventListener('focus', () => {
  els.address.select();
});

if (els.zoomBadge) {
  els.zoomBadge.addEventListener('click', () => {
    astra.zoomReset();
  });
}

if (els.devtoolsBtn) {
  els.devtoolsBtn.addEventListener('click', () => {
    astra.toggleDevTools();
  });
}

if (els.settingsBtn) {
  els.settingsBtn.addEventListener('click', () => {
    if (astra && astra.openSettings) astra.openSettings();
  });
}

// ---- Window Controls ----
els.winMin.addEventListener('click', () => astra.minimize());
els.winMax.addEventListener('click', () => astra.toggleMaximize());
els.winClose.addEventListener('click', () => astra.close());

// ---- Keyboard Shortcuts in Chrome Renderer ----
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (e.key === 'F12' || (mod && e.shiftKey && key === 'i')) {
    e.preventDefault();
    astra.toggleDevTools();
  } else if (mod && key === 'f') {
    e.preventDefault();
    openFindBar();
  } else if (mod && key === 'p') {
    e.preventDefault();
    astra.print();
  } else if (mod && key === 's') {
    e.preventDefault();
    if (astra && astra.savePage) astra.savePage();
  } else if (mod && key === 'u') {
    e.preventDefault();
    if (astra && astra.viewSource) astra.viewSource();
  } else if (mod && key === 'h') {
    e.preventDefault();
    if (astra && astra.openHistory) astra.openHistory();
  } else if (mod && e.shiftKey && key === 'o') {
    e.preventDefault();
    if (astra && astra.openBookmarks) astra.openBookmarks();
  } else if (mod && e.key === ',') {
    e.preventDefault();
    if (astra && astra.openSettings) astra.openSettings();
  } else if (mod && e.shiftKey && key === 'n') {
    e.preventDefault();
    if (astra && astra.newIncognitoWindow) astra.newIncognitoWindow();
  } else if (mod && key === 'j') {
    e.preventDefault();
    els.downloadsPanel.classList.toggle('hidden');
    updateChromeHeight();
  } else if (mod && key === 'd') {
    e.preventDefault();
    const tab = activeTab();
    if (tab && !isNewTabUrl(tab.url)) {
      astra.toggleBookmark({
        url: tab.url,
        title: tab.title || tab.url,
        favicon: tab.favicon,
      });
    }
  } else if (mod && e.shiftKey && key === 'b') {
    e.preventDefault();
    els.bookmarksBar.classList.toggle('hidden');
    updateChromeHeight();
  } else if (mod && e.shiftKey && key === 't') {
    e.preventDefault();
    astra.reopenClosed();
  } else if (mod && key === 't') {
    e.preventDefault();
    astra.newTab();
  } else if (mod && key === 'w') {
    e.preventDefault();
    if (state.activeId != null) astra.closeTab(state.activeId);
  } else if (mod && key === 'l') {
    e.preventDefault();
    els.address.focus();
    els.address.select();
  } else if (mod && e.shiftKey && key === 'r') {
    e.preventDefault();
    astra.reload(true);
  } else if (mod && key === 'r') {
    e.preventDefault();
    astra.reload(false);
  } else if (e.altKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    astra.back();
  } else if (e.altKey && e.key === 'ArrowRight') {
    e.preventDefault();
    astra.forward();
  } else if (mod && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const idx = parseInt(e.key, 10) - 1;
    if (state.tabs[idx]) {
      astra.activateTab(state.tabs[idx].id);
    }
  } else if (mod && (e.key === '=' || e.key === '+')) {
    e.preventDefault();
    astra.zoomIn();
  } else if (mod && e.key === '-') {
    e.preventDefault();
    astra.zoomOut();
  } else if (mod && e.key === '0') {
    e.preventDefault();
    astra.zoomReset();
  }
});

// Signal main process that chrome view is ready
if (astra && astra.ready) astra.ready();
})();
