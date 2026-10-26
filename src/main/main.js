'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, WebContentsView, ipcMain, session, shell, nativeTheme, dialog } = require('electron');

// Force dark mode theme across all native menus and Chromium elements
nativeTheme.themeSource = 'dark';

// Performance switches to achieve Chrome-grade speed and eliminate Windows view-switch occlusion freezes
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,ParallelDownloading,BackForwardCache');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('enable-fast-unload');
app.commandLine.appendSwitch('enable-quic');
app.commandLine.appendSwitch('enable-tcp-fast-open');
app.commandLine.appendSwitch('disk-cache-size', '524288000'); // 500MB disk cache

// Store all information, cookies, history, and bookmarks in %appdata%/AstraForxBrowser
const appDataPath = process.env.APPDATA
  ? path.join(process.env.APPDATA, 'AstraForxBrowser')
  : path.join(app.getPath('appData'), 'AstraForxBrowser');
if (!fs.existsSync(appDataPath)) {
  fs.mkdirSync(appDataPath, { recursive: true });
}
app.setPath('userData', appDataPath);

const DEBUG_LOG = path.join(appDataPath, 'debug.log');
function logDebug(...args) {
  const line = `[${new Date().toISOString()}] ${args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')}\n`;
  try { fs.appendFileSync(DEBUG_LOG, line, 'utf8'); } catch (_) {}
}
logDebug('--- AstraForx Starting ---');

process.on('uncaughtException', (err) => {
  logDebug('UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
});

const { CHROME_HEIGHT, HOME_URL } = require('./config');
const { resolveInput } = require('./navigation');
const { TabManager } = require('./tabs');

const EMPTY_BOUNDS = { x: 0, y: 0, width: 0, height: 0 };
const windowInstances = new Map();
let mainWindow = null;

class WindowInstance {
  constructor(win, chromeView, isIncognito = false, customSession = null) {
    this.win = win;
    this.chromeView = chromeView;
    this.isIncognito = isIncognito;
    this.customSession = customSession;
    this.currentChromeHeight = CHROME_HEIGHT;

    this.getChromeBounds = () => {
      if (!this.win || this.win.isDestroyed()) return EMPTY_BOUNDS;
      const { width } = this.win.getContentBounds();
      return { x: 0, y: 0, width, height: this.currentChromeHeight };
    };

    this.getContentBounds = () => {
      if (!this.win || this.win.isDestroyed()) return EMPTY_BOUNDS;
      const { width, height } = this.win.getContentBounds();
      return {
        x: 0,
        y: this.currentChromeHeight,
        width,
        height: Math.max(0, height - this.currentChromeHeight),
      };
    };

    this.tabs = new TabManager(this.win, this.chromeView, this.getContentBounds, {
      incognito: isIncognito,
      customSession: customSession,
      onNewIncognito: () => createIncognitoWindow(),
    });

    this.layout = () => {
      if (!this.win || this.win.isDestroyed() || !this.chromeView) return;
      this.chromeView.setBounds(this.getChromeBounds());
      if (this.tabs) this.tabs.layout();
    };
  }

  sendWindowState() {
    if (!this.chromeView || this.chromeView.webContents.isDestroyed() || !this.win || this.win.isDestroyed()) return;
    this.chromeView.webContents.send('window:state', { maximized: this.win.isMaximized() });
  }

  sendBookmarks(bmList) {
    if (!this.chromeView || this.chromeView.webContents.isDestroyed()) return;
    this.chromeView.webContents.send('bookmarks:update', bmList);
  }

  sendDownloads(dlList) {
    if (!this.chromeView || this.chromeView.webContents.isDestroyed()) return;
    this.chromeView.webContents.send('downloads:update', dlList);
  }

  destroy() {
    if (this.tabs) {
      this.tabs.destroy();
    }
  }
}

function getWindowInstance(event) {
  if (event && event.sender) {
    const sender = event.sender;
    for (const inst of windowInstances.values()) {
      if (inst.chromeView && !inst.chromeView.webContents.isDestroyed() && inst.chromeView.webContents === sender) {
        return inst;
      }
      if (inst.tabs && inst.tabs.hasWebContents(sender)) {
        return inst;
      }
    }
    const bw = BrowserWindow.fromWebContents(sender);
    if (bw && windowInstances.has(bw.id)) {
      return windowInstances.get(bw.id);
    }
  }
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && windowInstances.has(focused.id)) {
    return windowInstances.get(focused.id);
  }
  if (mainWindow && windowInstances.has(mainWindow.id)) {
    return windowInstances.get(mainWindow.id);
  }
  for (const inst of windowInstances.values()) {
    return inst;
  }
  return null;
}

function broadcastBookmarks() {
  for (const inst of windowInstances.values()) {
    inst.sendBookmarks(bookmarks);
  }
}

function broadcastDownloads() {
  for (const inst of windowInstances.values()) {
    if (!inst.isIncognito) {
      inst.sendDownloads(downloads);
    }
  }
}


const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');
let settings = loadSettings();

const BOOKMARKS_FILE = path.join(app.getPath('userData'), 'bookmarks.json');
let bookmarks = loadBookmarks();
let downloads = [];

function loadSettings() {
  const defaults = {
    theme: 'obsidian',
    showBookmarksBar: false,
    compactMode: false,
    searchEngine: 'google',
    onStartup: 'continue',
    customStartupUrl: '',
    httpsOnly: false,
    doNotTrack: true,
    defaultDownloadDir: app.getPath('downloads'),
    askDownloadLocation: false,
    hardwareAcceleration: true,
    memorySaver: true,
  };
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return { ...defaults, ...data };
    }
  } catch (_) {}
  return defaults;
}

function saveSettings(next) {
  settings = { ...settings, ...next };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  } catch (_) {}
}

function loadBookmarks() {
  try {
    if (fs.existsSync(BOOKMARKS_FILE)) {
      const data = JSON.parse(fs.readFileSync(BOOKMARKS_FILE, 'utf8'));
      if (Array.isArray(data)) return data;
    }
  } catch (_) {}
  return [
    { title: 'GitHub', url: 'https://github.com', favicon: null },
    { title: 'Stack Overflow', url: 'https://stackoverflow.com', favicon: null },
    { title: 'Hacker News', url: 'https://news.ycombinator.com', favicon: null },
    { title: 'MDN Web Docs', url: 'https://developer.mozilla.org', favicon: null },
  ];
}

function saveBookmarks() {
  try {
    fs.writeFileSync(BOOKMARKS_FILE, JSON.stringify(bookmarks, null, 2), 'utf8');
  } catch (_) {}
}

function attachDownloadHandler(targetSession, isIncognito = false) {
  targetSession.on('will-download', (_e, item) => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    if (!settings.askDownloadLocation && settings.defaultDownloadDir && fs.existsSync(settings.defaultDownloadDir)) {
      item.setSavePath(path.join(settings.defaultDownloadDir, item.getFilename()));
    }

    const download = {
      id,
      name: item.getFilename(),
      totalBytes: item.getTotalBytes(),
      receivedBytes: 0,
      percent: 0,
      state: 'progressing',
      path: item.getSavePath(),
      startTime: Date.now(),
      incognito: isIncognito,
    };
    if (!isIncognito) {
      downloads.unshift(download);
      broadcastDownloads();
    }

    item.on('updated', (_event, state) => {
      download.receivedBytes = item.getReceivedBytes();
      download.totalBytes = item.getTotalBytes();
      download.percent = download.totalBytes > 0 ? Math.round((download.receivedBytes / download.totalBytes) * 100) : 0;
      download.state = state;
      download.path = item.getSavePath();
      if (!isIncognito) broadcastDownloads();
    });

    item.once('done', (_event, state) => {
      download.state = state;
      download.path = item.getSavePath();
      download.percent = state === 'completed' ? 100 : download.percent;
      if (!isIncognito) broadcastDownloads();
    });
  });
}

function initDownloadManager() {
  attachDownloadHandler(session.defaultSession, false);
}

async function createWindow() {
  const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
  const win = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 720,
    minHeight: 500,
    frame: false,
    backgroundColor: '#07080c',
    title: 'AstraForx',
    icon: iconPath,
    skipTaskbar: false,
    show: true,
  });

  win.center();
  win.setSkipTaskbar(false);
  win.show();
  win.focus();

  const chromeView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'chrome-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  chromeView.webContents.on('console-message', (_e, level, msg, line, src) => {
    logDebug(`[CHROME CONSOLE ${level}] (${src}:${line}) ${msg}`);
  });
  chromeView.webContents.on('did-finish-load', () => {
    logDebug('chromeView did-finish-load');
  });
  chromeView.webContents.on('did-fail-load', (_e, errCode, errDesc, validatedURL) => {
    logDebug('chromeView did-fail-load:', errCode, errDesc, validatedURL);
  });

  win.contentView.addChildView(chromeView);

  const inst = new WindowInstance(win, chromeView, false);
  windowInstances.set(win.id, inst);
  mainWindow = win;

  inst.layout();

  try {
    await chromeView.webContents.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  } catch (err) {
    logDebug('Failed to load chrome index.html:', err);
  }

  // Always restore pinned tabs, and set active unpinned tab as configured in settings
  inst.tabs.restoreSession(settings.onStartup, settings.customStartupUrl);

  inst.sendWindowState();
  inst.sendBookmarks(bookmarks);
  inst.sendDownloads(downloads);
  win.show();
  win.focus();

  win.on('resize', () => inst.layout());
  win.on('maximize', () => inst.sendWindowState());
  win.on('unmaximize', () => inst.sendWindowState());
  win.on('closed', () => {
    inst.destroy();
    windowInstances.delete(win.id);
    if (mainWindow === win) {
      mainWindow = null;
    }
  });

  return inst;
}

async function createIncognitoWindow() {
  const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
  const incogWin = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 720,
    minHeight: 500,
    frame: false,
    backgroundColor: '#0c0714',
    title: 'AstraForx [INCOGNITO]',
    icon: iconPath,
    show: true,
  });

  const incogSession = session.fromPartition('incognito-' + Date.now(), { cache: false });
  attachDownloadHandler(incogSession, true);

  const incogChrome = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'chrome-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  incogWin.contentView.addChildView(incogChrome);

  const incogInst = new WindowInstance(incogWin, incogChrome, true, incogSession);
  windowInstances.set(incogWin.id, incogInst);

  incogInst.layout();

  try {
    await incogChrome.webContents.loadFile(
      path.join(__dirname, '..', 'renderer', 'index.html'),
      { query: { incognito: '1' } }
    );
  } catch (err) {
    logDebug('Failed to load incognito chrome index.html:', err);
  }

  incogInst.tabs.createTab(HOME_URL, { activate: true });

  incogInst.sendWindowState();
  incogInst.sendBookmarks(bookmarks);
  incogWin.show();
  incogWin.focus();

  incogWin.on('resize', () => incogInst.layout());
  incogWin.on('maximize', () => incogInst.sendWindowState());
  incogWin.on('unmaximize', () => incogInst.sendWindowState());
  incogWin.on('closed', () => {
    incogInst.destroy();
    windowInstances.delete(incogWin.id);
  });

  return incogInst;
}

function registerIpc() {
  ipcMain.on('debug:log', (_e, msg) => {
    logDebug('[RENDERER LOG]', msg);
  });

  ipcMain.on('chrome:ready', (e) => {
    const inst = getWindowInstance(e);
    if (!inst) return;
    logDebug(`IPC received chrome:ready for window ${inst.win.id} (incognito: ${inst.isIncognito})`);
    if (inst.tabs) inst.tabs.emitState();
    inst.sendBookmarks(bookmarks);
    if (!inst.isIncognito) {
      inst.sendDownloads(downloads);
    }
    inst.sendWindowState();
  });

  // Dynamic chrome view height for Find in Page / Bookmarks / Panels
  ipcMain.on('chrome:height-change', (e, newHeight) => {
    const inst = getWindowInstance(e);
    if (!inst) return;
    if (typeof newHeight === 'number' && newHeight >= CHROME_HEIGHT) {
      inst.currentChromeHeight = newHeight;
      inst.layout();
    }
  });

  // Tab operations
  ipcMain.on('tab:new', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.createTab(HOME_URL);
  });
  ipcMain.on('tab:close', (e, id) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.closeTab(id);
  });
  ipcMain.on('tab:activate', (e, id) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.activate(id);
  });
  ipcMain.on('tab:reopen', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.reopenClosed();
  });
  ipcMain.on('tab:duplicate', (e, id) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.duplicateTab(id);
  });
  ipcMain.on('tab:pin', (e, id) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.pinTab(id);
  });
  ipcMain.on('tab:mute', (e, id) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.muteTab(id);
  });
  ipcMain.on('tab:close-others', (e, id) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.closeOtherTabs(id);
  });
  ipcMain.on('tab:close-right', (e, id) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.closeTabsToRight(id);
  });
  ipcMain.on('tab:new-after', (e, id) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.createTab(HOME_URL, { activate: true, insertAfterId: id });
  });

  // Native Tab Right-Click Context Menu (zero clipping, dark theme)
  ipcMain.on('tab:context-menu', (e, id) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.showTabContextMenu(id);
  });

  // In-page search, print, save page, view source
  ipcMain.on('tab:find', (e, { text, forward, findNext }) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.findInPage(text, forward, findNext);
  });
  ipcMain.on('tab:stop-find', (e, action) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.stopFindInPage(action);
  });
  ipcMain.on('tab:print', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.print();
  });
  ipcMain.on('tab:save-page', async (e) => {
    const inst = getWindowInstance(e);
    if (!inst || !inst.tabs) return;
    const tab = inst.tabs._active();
    if (!tab || tab.view.webContents.isDestroyed()) return;
    const { filePath } = await dialog.showSaveDialog(inst.win, {
      title: 'Save Page As',
      defaultPath: `${tab.title || 'page'}.html`,
      filters: [{ name: 'Webpage, Complete', extensions: ['html', 'htm'] }],
    });
    if (filePath) {
      tab.view.webContents.savePage(filePath, 'HTMLComplete');
    }
  });
  ipcMain.on('tab:view-source', (e) => {
    const inst = getWindowInstance(e);
    if (!inst || !inst.tabs) return;
    const tab = inst.tabs._active();
    if (!tab || !tab.url) return;
    inst.tabs.createTab('view-source:' + tab.url);
  });

  // Internal page navigation
  ipcMain.on('page:open-settings', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.createTab('astra://settings');
  });
  ipcMain.on('page:open-history', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.createTab('astra://history');
  });
  ipcMain.on('page:open-bookmarks', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.createTab('astra://bookmarks');
  });
  ipcMain.on('page:open-downloads', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.createTab('astra://downloads');
  });
  ipcMain.on('window:new-incognito', () => createIncognitoWindow());

  // Navigation operations
  ipcMain.on('nav:back', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.back();
  });
  ipcMain.on('nav:forward', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.forward();
  });
  ipcMain.on('nav:reload', (e, ignoreCache) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.reload(!!ignoreCache);
  });
  ipcMain.on('nav:go', (e, input) => {
    const inst = getWindowInstance(e);
    if (!inst || !inst.tabs) return;
    const url = resolveInput(input, settings.searchEngine || 'google');
    if (url) inst.tabs.navigate(url);
  });

  // View tools & controls
  ipcMain.on('view:devtools', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.toggleDevTools();
  });
  ipcMain.on('view:zoom-in', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.zoomIn();
  });
  ipcMain.on('view:zoom-out', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.zoomOut();
  });
  ipcMain.on('view:zoom-reset', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.zoomReset();
  });

  // Settings
  ipcMain.handle('settings:get', () => settings);
  ipcMain.handle('settings:set', (_e, nextSettings) => {
    saveSettings(nextSettings);
    return settings;
  });
  ipcMain.handle('dialog:select-download-dir', async (e) => {
    const inst = getWindowInstance(e);
    const parentWin = (inst && inst.win) || mainWindow;
    const result = await dialog.showOpenDialog(parentWin, {
      title: 'Select Default Download Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Clear Browsing Data
  ipcMain.handle('session:clear-data', async (_e, options = {}) => {
    logDebug('Purging browsing data:', options);
    try {
      const storages = [];
      if (options.cookies) storages.push('cookies', 'localstorage', 'indexdb', 'websql');
      if (options.cache) storages.push('cache', 'serviceworkers');
      if (storages.length > 0) {
        await session.defaultSession.clearStorageData({ storages });
        await session.defaultSession.clearCache();
      }
      if (options.history) {
        for (const inst of windowInstances.values()) {
          if (inst.tabs) inst.tabs.clearHistory();
        }
      }
      return true;
    } catch (err) {
      logDebug('Failed to clear browsing data:', err);
      return false;
    }
  });

  // Bookmarks
  ipcMain.handle('bookmarks:get', () => bookmarks);
  ipcMain.handle('bookmarks:toggle', (_e, item) => {
    const existingIdx = bookmarks.findIndex((b) => b.url === item.url);
    if (existingIdx !== -1) {
      bookmarks.splice(existingIdx, 1);
    } else {
      bookmarks.push({
        title: item.title || item.url,
        url: item.url,
        favicon: item.favicon || null,
        timestamp: Date.now(),
      });
    }
    saveBookmarks();
    broadcastBookmarks();
    return bookmarks.some((b) => b.url === item.url);
  });
  ipcMain.handle('bookmarks:remove', (_e, url) => {
    bookmarks = bookmarks.filter((b) => b.url !== url);
    saveBookmarks();
    broadcastBookmarks();
    return true;
  });

  // Downloads
  ipcMain.handle('downloads:get', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.isIncognito) return [];
    return downloads;
  });
  ipcMain.on('downloads:open', (_e, filePath) => {
    if (filePath && fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
    }
  });
  ipcMain.handle('downloads:clear', () => {
    downloads = downloads.filter((d) => d.state === 'progressing');
    broadcastDownloads();
    return true;
  });

  // History operations
  ipcMain.handle('history:get', (e) => {
    const inst = getWindowInstance(e);
    return inst && inst.tabs ? inst.tabs.getHistory() : [];
  });
  ipcMain.handle('history:remove-item', (e, url) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.removeHistoryItem(url);
    return true;
  });
  ipcMain.handle('history:clear', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.tabs) inst.tabs.clearHistory();
    return true;
  });

  // Window operations
  ipcMain.on('window:minimize', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.win && !inst.win.isDestroyed()) {
      inst.win.minimize();
    }
  });
  ipcMain.on('window:maximize', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.win && !inst.win.isDestroyed()) {
      if (inst.win.isMaximized()) inst.win.unmaximize();
      else inst.win.maximize();
    }
  });
  ipcMain.on('window:close', (e) => {
    const inst = getWindowInstance(e);
    if (inst && inst.win && !inst.win.isDestroyed()) {
      inst.win.close();
    }
  });
}

app.whenReady().then(() => {
  initDownloadManager();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
