'use strict';

const fs = require('fs');
const path = require('path');
const { app, Menu, MenuItem, WebContentsView, clipboard, dialog } = require('electron');
const { HOME_URL } = require('./config');

let nextId = 1;
const EMPTY_BOUNDS = { x: 0, y: 0, width: 0, height: 0 };
const MAX_HISTORY = 100;

function nav(wc) {
  const h = wc.navigationHistory;
  return h && typeof h.canGoBack === 'function' ? h : wc;
}
function canGoBack(wc) {
  return nav(wc).canGoBack();
}
function canGoForward(wc) {
  return nav(wc).canGoForward();
}
function goBack(wc) {
  nav(wc).goBack();
}
function goForward(wc) {
  nav(wc).goForward();
}

function resolveInternalUrl(url) {
  if (!url) return null;
  const lower = String(url).toLowerCase().trim();
  if (lower === 'astra://game' || lower === 'chrome://dino' || lower === 'astra://runner') {
    return {
      file: path.join(__dirname, '..', 'renderer', 'error.html'),
      title: 'Astra Runner',
      displayUrl: 'astra://game',
      query: { game: '1' },
    };
  }
  if (lower === 'astra://settings' || lower === 'chrome://settings' || lower.includes('settings.html')) {
    return { file: path.join(__dirname, '..', 'renderer', 'settings.html'), title: 'Settings', displayUrl: 'astra://settings' };
  }
  if (lower === 'astra://history' || lower === 'chrome://history' || lower.includes('history.html')) {
    return { file: path.join(__dirname, '..', 'renderer', 'history.html'), title: 'History', displayUrl: 'astra://history' };
  }
  if (lower === 'astra://bookmarks' || lower === 'chrome://bookmarks' || lower.includes('bookmarks.html')) {
    return { file: path.join(__dirname, '..', 'renderer', 'bookmarks.html'), title: 'Bookmarks', displayUrl: 'astra://bookmarks' };
  }
  if (lower === 'astra://downloads' || lower === 'chrome://downloads' || lower.includes('downloads.html')) {
    return { file: path.join(__dirname, '..', 'renderer', 'downloads.html'), title: 'Downloads', displayUrl: 'astra://downloads' };
  }
  if (lower === 'astra://newtab' || lower === 'chrome://newtab' || lower.includes('newtab.html') || lower === 'about:blank' || lower === HOME_URL) {
    return { file: path.join(__dirname, '..', 'renderer', 'newtab.html'), title: 'New Tab', displayUrl: 'astra://newtab' };
  }
  return null;
}

/**
 * TabManager: Controls tabs, persistent pinned tabs, WebContentsViews,
 * native context menus, find-in-page, and audio muting.
 */
class TabManager {
  /**
   * @param {import('electron').BrowserWindow} win
   * @param {import('electron').WebContentsView} chromeView
   * @param {() => Electron.Rectangle} getContentBounds
   * @param {object} [options]
   */
  constructor(win, chromeView, getContentBounds, options = {}) {
    this.win = win;
    this.chromeView = chromeView;
    this.getContentBounds = getContentBounds;
    this.options = options;
    this.tabs = new Map();
    this.order = [];
    this.activeId = null;
    this.closedTabs = [];

    this.historyFile = path.join(app.getPath('userData'), 'history.json');
    this.pinnedFile = path.join(app.getPath('userData'), 'pinned_tabs.json');

    this.history = this.options.incognito ? [] : this._loadHistory();
  }

  _loadHistory() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const raw = fs.readFileSync(this.historyFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(0, MAX_HISTORY);
      }
    } catch (_) {}
    return [];
  }

  _saveHistory() {
    if (this.options.incognito) return;
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.history.slice(0, MAX_HISTORY), null, 2), 'utf8');
    } catch (_) {}
  }

  _loadPinned() {
    if (this.options.incognito) return [];
    try {
      if (fs.existsSync(this.pinnedFile)) {
        const raw = fs.readFileSync(this.pinnedFile, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  }

  _savePinned() {
    if (this.options.incognito) return;
    try {
      const pinnedTabs = this.order
        .map((id) => this.tabs.get(id))
        .filter((tab) => tab && tab.pinned)
        .map((tab) => ({
          url: tab.url,
          title: tab.title,
          favicon: tab.favicon,
          pinned: true,
        }));
      fs.writeFileSync(this.pinnedFile, JSON.stringify(pinnedTabs, null, 2), 'utf8');
    } catch (_) {}
  }

  restoreSession(onStartupMode = 'continue', customUrl = '') {
    const savedPinned = this._loadPinned();
    let firstPinnedId = null;

    // Always restore pinned tabs regardless of startup setting
    if (savedPinned.length > 0) {
      for (const p of savedPinned) {
        if (p.url) {
          const id = this.createTab(p.url, { activate: false, pinned: true });
          if (!firstPinnedId) firstPinnedId = id;
        }
      }
    }

    let targetUrl = HOME_URL;
    if (onStartupMode === 'custom' && customUrl) {
      targetUrl = customUrl;
    }

    // Always ensure at least one unpinned tab
    const unpinnedId = this.createTab(targetUrl, { activate: true, pinned: false });

    // Activate the unpinned tab
    this.activate(unpinnedId || firstPinnedId);
    this.emitState();
  }

  recordHistory(tab) {
    if (this.options.incognito || !tab || !tab.url) return;
    const url = tab.url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return;
    const title = tab.title && tab.title !== 'New Tab' ? tab.title : url;

    this.history = this.history.filter((h) => h.url !== url);
    this.history.unshift({
      title,
      url,
      favicon: tab.favicon || null,
      timestamp: Date.now(),
    });
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(0, MAX_HISTORY);
    }
    this._saveHistory();
    this._send('history:updated', this.history);
  }

  getHistory() {
    return this.history;
  }

  removeHistoryItem(url) {
    this.history = this.history.filter((h) => h.url !== url);
    this._saveHistory();
    this._send('history:updated', this.history);
  }

  clearHistory() {
    this.history = [];
    this._saveHistory();
    this._send('history:updated', []);
  }

  _send(channel, payload) {
    const wc = this.chromeView.webContents;
    if (wc && !wc.isDestroyed()) wc.send(channel, payload);
  }

  _serialize(tab) {
    return {
      id: tab.id,
      title: tab.title || 'New Tab',
      url: tab.url || '',
      loading: tab.loading,
      canGoBack: tab.canGoBack,
      canGoForward: tab.canGoForward,
      favicon: tab.favicon,
      active: tab.id === this.activeId,
      pinned: !!tab.pinned,
      hasAudio: !!tab.hasAudio,
      muted: !!tab.muted,
      zoomFactor: tab.zoomFactor || 1.0,
    };
  }

  emitState() {
    const tabs = this.order
      .map((id) => this.tabs.get(id))
      .filter(Boolean)
      .map((tab) => this._serialize(tab));

    this._send('tabs:state', {
      tabs,
      activeId: this.activeId,
      tabCount: tabs.length,
    });
  }

  createTab(url = HOME_URL, { activate = true, insertAfterId = null, pinned = false } = {}) {
    const id = nextId++;
    const webPreferences = {
      preload: path.join(__dirname, '..', 'preload', 'tab-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    };
    if (this.options.customSession) {
      webPreferences.session = this.options.customSession;
    }

    const view = new WebContentsView({ webPreferences });

    const internal = resolveInternalUrl(url);
    const initialUrl = internal ? internal.displayUrl : url;
    const initialTitle = internal ? internal.title : 'New Tab';

    const tab = {
      id,
      view,
      title: initialTitle,
      url: initialUrl,
      loading: false,
      canGoBack: false,
      canGoForward: false,
      favicon: null,
      zoomFactor: 1.0,
      pinned: !!pinned,
      hasAudio: false,
      muted: false,
    };

    this.tabs.set(id, tab);

    if (insertAfterId != null) {
      const idx = this.order.indexOf(insertAfterId);
      if (idx !== -1) {
        this.order.splice(idx + 1, 0, id);
      } else {
        this.order.push(id);
      }
    } else {
      this.order.push(id);
    }

    this._reorderPinned();
    this.win.contentView.addChildView(view);
    view.setBounds(EMPTY_BOUNDS);

    this._wireEvents(tab);

    if (internal) {
      view.webContents.loadFile(internal.file, internal.query ? { query: internal.query } : undefined).catch(() => {});
    } else if (url.startsWith('view-source:')) {
      view.webContents.loadURL(url).catch(() => {});
    } else {
      view.webContents.loadURL(url).catch(() => {});
    }

    if (pinned) {
      this._savePinned();
    }

    if (activate) this.activate(id);
    this.emitState();
    return id;
  }

  _reorderPinned() {
    const pinned = [];
    const unpinned = [];
    for (const id of this.order) {
      const tab = this.tabs.get(id);
      if (tab && tab.pinned) pinned.push(id);
      else unpinned.push(id);
    }
    this.order = [...pinned, ...unpinned];
  }

  duplicateTab(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    return this.createTab(tab.url || HOME_URL, { activate: true, insertAfterId: id });
  }

  pinTab(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    tab.pinned = !tab.pinned;
    this._reorderPinned();
    this._savePinned();
    this.layout();
    this.emitState();
  }

  muteTab(id) {
    const tab = this.tabs.get(id);
    if (!tab || tab.view.webContents.isDestroyed()) return;
    const isMuted = !tab.view.webContents.isAudioMuted();
    tab.view.webContents.setAudioMuted(isMuted);
    tab.muted = isMuted;
    this.emitState();
  }

  closeOtherTabs(id) {
    const toClose = this.order.filter((x) => x !== id && !this.tabs.get(x)?.pinned);
    for (const closeId of toClose) {
      this.closeTab(closeId);
    }
  }

  closeTabsToRight(id) {
    const idx = this.order.indexOf(id);
    if (idx === -1) return;
    const toClose = this.order.slice(idx + 1).filter((x) => !this.tabs.get(x)?.pinned);
    for (const closeId of toClose) {
      this.closeTab(closeId);
    }
  }

  /**
   * Native Electron Tab Right-Click Context Menu (zero clipping, dark theme)
   */
  showTabContextMenu(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    const menu = new Menu();

    menu.append(
      new MenuItem({
        label: 'Reload Tab',
        accelerator: 'CmdOrCtrl+R',
        click: () => this.reloadTab(id),
      })
    );

    menu.append(
      new MenuItem({
        label: 'Duplicate Tab',
        click: () => this.duplicateTab(id),
      })
    );

    menu.append(
      new MenuItem({
        label: tab.pinned ? 'Unpin Tab' : 'Pin Tab',
        click: () => this.pinTab(id),
      })
    );

    menu.append(
      new MenuItem({
        label: tab.muted ? 'Unmute Tab' : 'Mute Tab',
        click: () => this.muteTab(id),
      })
    );

    menu.append(new MenuItem({ type: 'separator' }));

    menu.append(
      new MenuItem({
        label: 'New Tab After',
        click: () => this.createTab(HOME_URL, { activate: true, insertAfterId: id }),
      })
    );

    menu.append(
      new MenuItem({
        label: 'Reopen Closed Tab',
        accelerator: 'CmdOrCtrl+Shift+T',
        enabled: this.closedTabs.length > 0,
        click: () => this.reopenClosed(),
      })
    );

    menu.append(new MenuItem({ type: 'separator' }));

    menu.append(
      new MenuItem({
        label: 'Close Other Tabs',
        click: () => this.closeOtherTabs(id),
      })
    );

    menu.append(
      new MenuItem({
        label: 'Close Tabs to Right',
        click: () => this.closeTabsToRight(id),
      })
    );

    menu.append(
      new MenuItem({
        label: 'Close Tab',
        accelerator: 'CmdOrCtrl+W',
        click: () => this.closeTab(id),
      })
    );

    menu.popup({ window: this.win });
  }

  _wireEvents(tab) {
    const wc = tab.view.webContents;

    const refreshNav = () => {
      tab.canGoBack = canGoBack(wc);
      tab.canGoForward = canGoForward(wc);
    };

    wc.on('page-title-updated', (_e, title) => {
      tab.title = title || 'New Tab';
      this.recordHistory(tab);
      this.emitState();
    });

    wc.on('did-start-loading', () => {
      tab.loading = true;
      refreshNav();
      this.emitState();
    });

    wc.on('did-stop-loading', () => {
      tab.loading = false;
      refreshNav();
      this.recordHistory(tab);
      if (tab.pinned) this._savePinned();
      this.emitState();
    });

    wc.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      tab.loading = false;
      refreshNav();

      // Ignore user-initiated aborts (-3)
      if (errorCode === -3) {
        this.emitState();
        return;
      }

      // If main frame failed, load the cybernetic error page
      if (isMainFrame !== false && validatedURL && !validatedURL.includes('error.html')) {
        const errorHtmlPath = path.join(__dirname, '..', 'renderer', 'error.html');
        tab.title = `Error: ${errorDescription || 'Connection Failed'}`;
        tab.url = validatedURL; // Preserve the requested URL in the address bar!
        wc.loadFile(errorHtmlPath, {
          query: {
            code: errorDescription || 'ERR_CONNECTION_FAILED',
            num: String(errorCode || -100),
            url: validatedURL,
          },
        }).catch(() => {});
      }

      this.emitState();
    });

    wc.on('did-navigate', (_e, url) => {
      if (url.includes('error.html')) {
        if (url.includes('game=1')) {
          tab.url = 'astra://game';
          tab.title = 'Astra Runner';
        }
        refreshNav();
        this.emitState();
        return;
      }

      const internal = resolveInternalUrl(url);
      tab.url = internal ? internal.displayUrl : url;
      if (internal) tab.title = internal.title;
      refreshNav();
      this.recordHistory(tab);
      if (tab.pinned) this._savePinned();
      this.emitState();
    });

    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => {
      if (!isMainFrame) return;
      if (url.includes('error.html')) {
        if (url.includes('game=1')) {
          tab.url = 'astra://game';
          tab.title = 'Astra Runner';
        }
        refreshNav();
        this.emitState();
        return;
      }
      const internal = resolveInternalUrl(url);
      tab.url = internal ? internal.displayUrl : url;
      if (internal) tab.title = internal.title;
      refreshNav();
      this.recordHistory(tab);
      if (tab.pinned) this._savePinned();
      this.emitState();
    });

    wc.on('page-favicon-updated', (_e, favicons) => {
      tab.favicon = (favicons && favicons[0]) || null;
      this.recordHistory(tab);
      if (tab.pinned) this._savePinned();
      this.emitState();
    });

    // Audio indicators
    wc.on('media-started-playing', () => {
      tab.hasAudio = true;
      this.emitState();
    });
    wc.on('media-paused', () => {
      tab.hasAudio = false;
      this.emitState();
    });

    // In-page search result event
    wc.on('found-in-page', (_e, result) => {
      this._send('find:result', {
        requestId: result.requestId,
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
        finalUpdate: result.finalUpdate,
      });
    });

    wc.setWindowOpenHandler(({ url }) => {
      this.createTab(url);
      return { action: 'deny' };
    });

    // Web content right-click context menu (dark styled)
    wc.on('context-menu', (_e, params) => {
      this._showWebContextMenu(tab, params);
    });

    // Global keyboard shortcuts in web content
    wc.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') return;
      const mod = input.control || input.meta;
      const key = (input.key || '').toLowerCase();

      // F12 or Ctrl+Shift+I -> DevTools
      if (input.key === 'F12' || (mod && input.shift && key === 'i')) {
        event.preventDefault();
        this.toggleDevTools();
        return;
      }

      // Ctrl+F -> Find in page
      if (mod && key === 'f') {
        event.preventDefault();
        this._send('chrome:open-find');
        return;
      }

      // Ctrl+P -> Print page
      if (mod && key === 'p') {
        event.preventDefault();
        this.print();
        return;
      }

      // Ctrl+S -> Save page as (Direct execution in main process)
      if (mod && key === 's') {
        event.preventDefault();
        this.savePage(tab);
        return;
      }

      // Ctrl+U -> View page source (Direct execution in main process)
      if (mod && key === 'u') {
        event.preventDefault();
        if (tab && tab.url && !tab.url.startsWith('view-source:')) {
          this.createTab('view-source:' + tab.url);
        }
        return;
      }

      // Ctrl+D -> Bookmark
      if (mod && key === 'd') {
        event.preventDefault();
        this._send('chrome:toggle-bookmark');
        return;
      }

      // Ctrl+H -> History
      if (mod && key === 'h') {
        event.preventDefault();
        this.createTab('astra://history');
        return;
      }

      // Ctrl+Shift+O -> Bookmarks Manager
      if (mod && input.shift && key === 'o') {
        event.preventDefault();
        this.createTab('astra://bookmarks');
        return;
      }

      // Ctrl+, -> Settings
      if (mod && input.key === ',') {
        event.preventDefault();
        this.createTab('astra://settings');
        return;
      }

      // Ctrl+Shift+Delete -> Settings (Clear Data)
      if (mod && input.shift && (input.key === 'Delete' || key === 'delete')) {
        event.preventDefault();
        this.createTab('astra://settings');
        return;
      }

      // Ctrl+Shift+N -> Incognito Window (Direct execution via option callback)
      if (mod && input.shift && key === 'n') {
        event.preventDefault();
        if (typeof this.options.onNewIncognito === 'function') {
          this.options.onNewIncognito();
        }
        return;
      }

      // Ctrl+J -> Downloads
      if (mod && key === 'j') {
        event.preventDefault();
        this._send('chrome:toggle-downloads');
        return;
      }

      if (mod && input.shift && key === 't') {
        this.reopenClosed();
      } else if (mod && key === 't') {
        this.createTab();
      } else if (mod && key === 'w') {
        this.closeTab(this.activeId);
      } else if (mod && key === 'l') {
        this._send('chrome:focus-address');
      } else if (mod && input.shift && key === 'r') {
        this.reload(true);
      } else if (mod && key === 'r') {
        this.reload(false);
      } else if (input.alt && input.key === 'ArrowLeft') {
        this.back();
      } else if (input.alt && input.key === 'ArrowRight') {
        this.forward();
      } else if (mod && key >= '1' && key <= '9') {
        const idx = parseInt(key, 10) - 1;
        if (this.order[idx]) this.activate(this.order[idx]);
      } else if (mod && (input.key === '=' || input.key === '+')) {
        this.zoomIn();
      } else if (mod && input.key === '-') {
        this.zoomOut();
      } else if (mod && input.key === '0') {
        this.zoomReset();
      } else {
        return;
      }
      event.preventDefault();
    });
  }

  _showWebContextMenu(tab, params) {
    const menu = new Menu();
    const wc = tab.view.webContents;

    if (params.linkURL) {
      menu.append(
        new MenuItem({
          label: 'Open Link in New Tab',
          click: () => this.createTab(params.linkURL),
        })
      );
      menu.append(
        new MenuItem({
          label: 'Copy Link Address',
          click: () => clipboard.writeText(params.linkURL),
        })
      );
      menu.append(new MenuItem({ type: 'separator' }));
    }

    if (params.hasImageContents && params.srcURL) {
      menu.append(
        new MenuItem({
          label: 'Open Image in New Tab',
          click: () => this.createTab(params.srcURL),
        })
      );
      menu.append(
        new MenuItem({
          label: 'Copy Image Address',
          click: () => clipboard.writeText(params.srcURL),
        })
      );
      menu.append(new MenuItem({ type: 'separator' }));
    }

    if (params.selectionText && params.selectionText.trim()) {
      const q = params.selectionText.trim();
      menu.append(
        new MenuItem({
          label: `Search Google for "${q.length > 25 ? q.slice(0, 25) + '...' : q}"`,
          click: () => this.createTab(`https://www.google.com/search?q=${encodeURIComponent(q)}`),
        })
      );
      menu.append(new MenuItem({ role: 'copy', label: 'Copy' }));
      menu.append(new MenuItem({ type: 'separator' }));
    }

    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'undo', label: 'Undo' }));
      menu.append(new MenuItem({ role: 'redo', label: 'Redo' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'cut', label: 'Cut' }));
      menu.append(new MenuItem({ role: 'copy', label: 'Copy' }));
      menu.append(new MenuItem({ role: 'paste', label: 'Paste' }));
      menu.append(new MenuItem({ role: 'selectAll', label: 'Select All' }));
      menu.append(new MenuItem({ type: 'separator' }));
    }

    menu.append(
      new MenuItem({
        label: 'Back',
        enabled: canGoBack(wc),
        click: () => goBack(wc),
      })
    );
    menu.append(
      new MenuItem({
        label: 'Forward',
        enabled: canGoForward(wc),
        click: () => goForward(wc),
      })
    );
    menu.append(
      new MenuItem({
        label: 'Reload',
        click: () => wc.reload(),
      })
    );

    menu.append(new MenuItem({ type: 'separator' }));

    menu.append(
      new MenuItem({
        label: 'Save Page As...',
        accelerator: 'CmdOrCtrl+S',
        click: () => this.savePage(tab),
      })
    );
    menu.append(
      new MenuItem({
        label: 'Print...',
        accelerator: 'CmdOrCtrl+P',
        click: () => this.print(),
      })
    );
    menu.append(
      new MenuItem({
        label: 'View Page Source',
        accelerator: 'CmdOrCtrl+U',
        click: () => {
          if (tab && tab.url && !tab.url.startsWith('view-source:')) {
            this.createTab('view-source:' + tab.url);
          }
        },
      })
    );
    menu.append(
      new MenuItem({
        label: 'Inspect Element',
        accelerator: 'F12',
        click: () => wc.inspectElement(params.x, params.y),
      })
    );

    menu.popup({ window: this.win });
  }

  async savePage(tab) {
    const target = tab || this._active();
    if (!target || target.view.webContents.isDestroyed()) return;
    const wc = target.view.webContents;
    const defaultName = (target.title || 'page').replace(/[\\/:*?"<>|]/g, '_') + '.html';
    const { filePath } = await dialog.showSaveDialog(this.win, {
      title: 'Save Page As',
      defaultPath: defaultName,
      filters: [{ name: 'Webpage, Complete', extensions: ['html', 'htm'] }],
    });
    if (filePath) {
      wc.savePage(filePath, 'HTMLComplete').catch(() => {});
    }
  }

  activate(id) {
    if (!this.tabs.has(id)) return;
    this.activeId = id;
    const active = this.tabs.get(id);
    this.win.contentView.addChildView(active.view);
    this.layout();
    this.emitState();
  }

  closeTab(id) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    if (!tab.pinned) {
      this.closedTabs.push({ url: tab.url, title: tab.title });
      if (this.closedTabs.length > 20) this.closedTabs.shift();
    }

    this.win.contentView.removeChildView(tab.view);
    if (!tab.view.webContents.isDestroyed()) {
      try {
        if (typeof tab.view.webContents.destroy === 'function') {
          tab.view.webContents.destroy();
        } else if (typeof tab.view.webContents.close === 'function') {
          tab.view.webContents.close();
        }
      } catch (_) {}
    }
    this.tabs.delete(id);
    this.order = this.order.filter((x) => x !== id);

    if (tab.pinned) {
      this._savePinned();
    }

    if (this.activeId === id) {
      const fallback = this.order[this.order.length - 1];
      if (fallback != null) {
        this.activate(fallback);
      } else {
        this.activeId = null;
        this.createTab();
        return;
      }
    }
    this.layout();
    this.emitState();
  }

  reopenClosed() {
    const last = this.closedTabs.pop();
    if (!last) return;
    const url = last.url || HOME_URL;
    this.createTab(url);
  }

  layout() {
    const content = this.getContentBounds();
    for (const [id, tab] of this.tabs) {
      tab.view.setBounds(id === this.activeId ? content : EMPTY_BOUNDS);
    }
  }

  _active() {
    return this.activeId != null ? this.tabs.get(this.activeId) : null;
  }

  navigate(input) {
    const tab = this._active();
    if (!tab || !input) return;

    const internal = resolveInternalUrl(input);
    if (internal) {
      tab.url = internal.displayUrl;
      tab.title = internal.title;
      tab.view.webContents.loadFile(internal.file, internal.query ? { query: internal.query } : undefined).catch(() => {});
    } else if (input.startsWith('view-source:')) {
      tab.url = input;
      tab.view.webContents.loadURL(input).catch(() => {});
    } else {
      tab.view.webContents.loadURL(input).catch(() => {});
    }
  }

  back() {
    const tab = this._active();
    if (tab && canGoBack(tab.view.webContents)) goBack(tab.view.webContents);
  }
  forward() {
    const tab = this._active();
    if (tab && canGoForward(tab.view.webContents)) goForward(tab.view.webContents);
  }
  reload(ignoreCache = false) {
    const tab = this._active();
    if (tab) {
      if (tab.loading) {
        tab.view.webContents.stop();
      } else if (ignoreCache) {
        tab.view.webContents.reloadIgnoringCache();
      } else {
        tab.view.webContents.reload();
      }
    }
  }

  reloadTab(id) {
    const tab = this.tabs.get(id);
    if (tab && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.reload();
    }
  }

  toggleDevTools() {
    const tab = this._active();
    if (tab && !tab.view.webContents.isDestroyed()) {
      if (tab.view.webContents.isDevToolsOpened()) {
        tab.view.webContents.closeDevTools();
      } else {
        tab.view.webContents.openDevTools({ mode: 'detach' });
      }
    }
  }

  zoomIn() {
    const tab = this._active();
    if (tab && !tab.view.webContents.isDestroyed()) {
      tab.zoomFactor = Math.min(3.0, (tab.zoomFactor || 1.0) + 0.1);
      tab.view.webContents.setZoomFactor(tab.zoomFactor);
      this._send('chrome:zoom', { factor: Math.round(tab.zoomFactor * 100) });
    }
  }
  zoomOut() {
    const tab = this._active();
    if (tab && !tab.view.webContents.isDestroyed()) {
      tab.zoomFactor = Math.max(0.3, (tab.zoomFactor || 1.0) - 0.1);
      tab.view.webContents.setZoomFactor(tab.zoomFactor);
      this._send('chrome:zoom', { factor: Math.round(tab.zoomFactor * 100) });
    }
  }
  zoomReset() {
    const tab = this._active();
    if (tab && !tab.view.webContents.isDestroyed()) {
      tab.zoomFactor = 1.0;
      tab.view.webContents.setZoomFactor(1.0);
      this._send('chrome:zoom', { factor: 100 });
    }
  }

  findInPage(text, forward = true, findNext = false) {
    const tab = this._active();
    if (tab && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.findInPage(text, { forward, findNext });
    }
  }
  stopFindInPage(action = 'clearSelection') {
    const tab = this._active();
    if (tab && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.stopFindInPage(action);
    }
  }

  print() {
    const tab = this._active();
    if (tab && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.print();
    }
  }

  hasWebContents(wc) {
    if (!wc) return false;
    for (const tab of this.tabs.values()) {
      if (tab.view && !tab.view.webContents.isDestroyed() && tab.view.webContents === wc) {
        return true;
      }
    }
    return false;
  }

  destroy() {
    for (const [id, tab] of this.tabs) {
      if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
        try {
          if (this.win && !this.win.isDestroyed() && this.win.contentView) {
            this.win.contentView.removeChildView(tab.view);
          }
          if (typeof tab.view.webContents.destroy === 'function') {
            tab.view.webContents.destroy();
          } else if (typeof tab.view.webContents.close === 'function') {
            tab.view.webContents.close();
          }
        } catch (_) {}
      }
    }
    this.tabs.clear();
    this.order = [];
    this.closedTabs = [];
  }
}

module.exports = { TabManager };
