(function () {
  'use strict';

  function getAstra() {
    return window.astra || window.quantum;
  }

  // Sidebar navigation
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.settings-section');

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      navItems.forEach((b) => b.classList.toggle('active', b === btn));
      sections.forEach((sec) => {
        sec.classList.toggle('active', sec.id === `section-${tab}`);
      });
    });
  });

  // Settings elements
  const elTheme = document.getElementById('setting-theme');
  const elBookmarksBar = document.getElementById('setting-bookmarks-bar');
  const elCompact = document.getElementById('setting-compact');
  const elSearchEngine = document.getElementById('setting-search-engine');
  const elStartupNewtab = document.getElementById('startup-newtab');
  const elStartupContinue = document.getElementById('startup-continue');
  const elStartupCustom = document.getElementById('startup-custom');
  const elStartupUrl = document.getElementById('setting-startup-url');
  const elStartupWrap = document.getElementById('startup-custom-wrap');
  const elHttpsOnly = document.getElementById('setting-https-only');
  const elDoNotTrack = document.getElementById('setting-do-not-track');
  const elDownloadDirDisplay = document.getElementById('download-dir-display');
  const btnChangeDownloadDir = document.getElementById('btn-change-download-dir');
  const elAskDownload = document.getElementById('setting-ask-download');
  const elHardwareAccel = document.getElementById('setting-hardware-accel');
  const elMemorySaver = document.getElementById('setting-memory-saver');

  // Modal elements
  const clearModal = document.getElementById('clear-modal');
  const btnOpenClearData = document.getElementById('btn-open-clear-data');
  const modalClose = document.getElementById('modal-close');
  const btnCancelClear = document.getElementById('btn-cancel-clear');
  const btnConfirmClear = document.getElementById('btn-confirm-clear');
  const clearTimeRange = document.getElementById('clear-timerange');
  const clearHistoryCb = document.getElementById('clear-history');
  const clearCookiesCb = document.getElementById('clear-cookies');
  const clearCacheCb = document.getElementById('clear-cache');

  let currentSettings = {};

  async function load() {
    const api = getAstra();
    if (api && api.getSettings) {
      currentSettings = await api.getSettings();
    } else {
      currentSettings = {
        theme: 'obsidian',
        showBookmarksBar: false,
        compactMode: false,
        searchEngine: 'google',
        onStartup: 'continue',
        customStartupUrl: '',
        httpsOnly: false,
        doNotTrack: true,
        defaultDownloadDir: 'Downloads',
        askDownloadLocation: false,
        hardwareAcceleration: true,
        memorySaver: true,
      };
    }

    if (elTheme) elTheme.value = currentSettings.theme || 'obsidian';
    if (elBookmarksBar) elBookmarksBar.checked = !!currentSettings.showBookmarksBar;
    if (elCompact) elCompact.checked = !!currentSettings.compactMode;
    if (elSearchEngine) elSearchEngine.value = currentSettings.searchEngine || 'google';

    if (currentSettings.onStartup === 'newtab') {
      if (elStartupNewtab) elStartupNewtab.checked = true;
      if (elStartupWrap) elStartupWrap.classList.add('hidden');
    } else if (currentSettings.onStartup === 'custom') {
      if (elStartupCustom) elStartupCustom.checked = true;
      if (elStartupWrap) elStartupWrap.classList.remove('hidden');
    } else {
      if (elStartupContinue) elStartupContinue.checked = true;
      if (elStartupWrap) elStartupWrap.classList.add('hidden');
    }

    if (elStartupUrl) elStartupUrl.value = currentSettings.customStartupUrl || '';
    if (elHttpsOnly) elHttpsOnly.checked = !!currentSettings.httpsOnly;
    if (elDoNotTrack) elDoNotTrack.checked = currentSettings.doNotTrack !== false;
    if (elDownloadDirDisplay) elDownloadDirDisplay.textContent = currentSettings.defaultDownloadDir || '// default';
    if (elAskDownload) elAskDownload.checked = !!currentSettings.askDownloadLocation;
    if (elHardwareAccel) elHardwareAccel.checked = currentSettings.hardwareAcceleration !== false;
    if (elMemorySaver) elMemorySaver.checked = currentSettings.memorySaver !== false;
  }

  async function save() {
    const next = {
      theme: elTheme ? elTheme.value : 'obsidian',
      showBookmarksBar: elBookmarksBar ? elBookmarksBar.checked : false,
      compactMode: elCompact ? elCompact.checked : false,
      searchEngine: elSearchEngine ? elSearchEngine.value : 'google',
      onStartup: elStartupNewtab && elStartupNewtab.checked ? 'newtab' : (elStartupCustom && elStartupCustom.checked ? 'custom' : 'continue'),
      customStartupUrl: elStartupUrl ? elStartupUrl.value.trim() : '',
      httpsOnly: elHttpsOnly ? elHttpsOnly.checked : false,
      doNotTrack: elDoNotTrack ? elDoNotTrack.checked : true,
      defaultDownloadDir: currentSettings.defaultDownloadDir,
      askDownloadLocation: elAskDownload ? elAskDownload.checked : false,
      hardwareAcceleration: elHardwareAccel ? elHardwareAccel.checked : true,
      memorySaver: elMemorySaver ? elMemorySaver.checked : true,
    };

    currentSettings = next;
    const api = getAstra();
    if (api && api.updateSettings) {
      await api.updateSettings(next);
    }
  }

  // Bind change listeners
  [elTheme, elBookmarksBar, elCompact, elSearchEngine, elHttpsOnly, elDoNotTrack, elAskDownload, elHardwareAccel, elMemorySaver].forEach((el) => {
    if (el) el.addEventListener('change', save);
  });

  [elStartupNewtab, elStartupContinue, elStartupCustom].forEach((el) => {
    if (el) {
      el.addEventListener('change', () => {
        if (elStartupWrap) {
          elStartupWrap.classList.toggle('hidden', !elStartupCustom.checked);
        }
        save();
      });
    }
  });

  if (elStartupUrl) {
    elStartupUrl.addEventListener('blur', save);
    elStartupUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  }

  if (btnChangeDownloadDir) {
    btnChangeDownloadDir.addEventListener('click', async () => {
      const api = getAstra();
      if (api && api.selectDownloadDir) {
        const dir = await api.selectDownloadDir();
        if (dir) {
          currentSettings.defaultDownloadDir = dir;
          if (elDownloadDirDisplay) elDownloadDirDisplay.textContent = dir;
          save();
        }
      }
    });
  }

  // Clear Browsing Data Modal
  function openClearModal() { if (clearModal) clearModal.classList.remove('hidden'); }
  function closeClearModal() { if (clearModal) clearModal.classList.add('hidden'); }

  if (btnOpenClearData) btnOpenClearData.addEventListener('click', openClearModal);
  if (modalClose) modalClose.addEventListener('click', closeClearModal);
  if (btnCancelClear) btnCancelClear.addEventListener('click', closeClearModal);

  if (btnConfirmClear) {
    btnConfirmClear.addEventListener('click', async () => {
      const options = {
        timeRange: clearTimeRange ? clearTimeRange.value : 'all',
        history: clearHistoryCb ? clearHistoryCb.checked : true,
        cookies: clearCookiesCb ? clearCookiesCb.checked : true,
        cache: clearCacheCb ? clearCacheCb.checked : true,
      };
      const api = getAstra();
      if (api && api.clearBrowsingData) {
        btnConfirmClear.textContent = 'PURGING...';
        btnConfirmClear.disabled = true;
        await api.clearBrowsingData(options);
        btnConfirmClear.textContent = 'DATA PURGED!';
        setTimeout(() => {
          btnConfirmClear.textContent = 'PURGE DATA';
          btnConfirmClear.disabled = false;
          closeClearModal();
        }, 500);
      } else {
        closeClearModal();
      }
    });
  }

  // Support opening directly to clear data modal via URL hash e.g. astra://settings#clear-data
  if (window.location.hash === '#clear-data') {
    openClearModal();
  }

  load();
})();
