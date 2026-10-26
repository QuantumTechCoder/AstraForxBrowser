'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Bridge between the AstraForx chrome renderer and the main process.
const api = {
  ready: () => ipcRenderer.send('chrome:ready'),
  log: (msg) => ipcRenderer.send('debug:log', msg),

  // Tabs
  newTab: () => ipcRenderer.send('tab:new'),
  closeTab: (id) => ipcRenderer.send('tab:close', id),
  activateTab: (id) => ipcRenderer.send('tab:activate', id),
  reopenClosed: () => ipcRenderer.send('tab:reopen'),
  duplicateTab: (id) => ipcRenderer.send('tab:duplicate', id),
  pinTab: (id) => ipcRenderer.send('tab:pin', id),
  muteTab: (id) => ipcRenderer.send('tab:mute', id),
  closeOtherTabs: (id) => ipcRenderer.send('tab:close-others', id),
  closeTabsToRight: (id) => ipcRenderer.send('tab:close-right', id),
  newTabAfter: (id) => ipcRenderer.send('tab:new-after', id),

  // Native Tab Right-Click Menu (zero clipping)
  showTabContextMenu: (id) => ipcRenderer.send('tab:context-menu', id),

  // Dynamic layout adjustment
  setChromeHeight: (height) => ipcRenderer.send('chrome:height-change', height),

  // Navigation
  back: () => ipcRenderer.send('nav:back'),
  forward: () => ipcRenderer.send('nav:forward'),
  reload: (ignoreCache) => ipcRenderer.send('nav:reload', ignoreCache),
  go: (input) => ipcRenderer.send('nav:go', input),

  // View & Tools
  toggleDevTools: () => ipcRenderer.send('view:devtools'),
  zoomIn: () => ipcRenderer.send('view:zoom-in'),
  zoomOut: () => ipcRenderer.send('view:zoom-out'),
  zoomReset: () => ipcRenderer.send('view:zoom-reset'),
  print: () => ipcRenderer.send('tab:print'),
  savePage: () => ipcRenderer.send('tab:save-page'),
  viewSource: () => ipcRenderer.send('tab:view-source'),

  // Internal Navigation
  openSettings: () => ipcRenderer.send('page:open-settings'),
  openHistory: () => ipcRenderer.send('page:open-history'),
  openBookmarks: () => ipcRenderer.send('page:open-bookmarks'),
  openDownloads: () => ipcRenderer.send('page:open-downloads'),
  newIncognitoWindow: () => ipcRenderer.send('window:new-incognito'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (s) => ipcRenderer.invoke('settings:set', s),
  selectDownloadDir: () => ipcRenderer.invoke('dialog:select-download-dir'),
  clearBrowsingData: (opts) => ipcRenderer.invoke('session:clear-data', opts),

  // Find in page
  findInPage: (text, forward = true, findNext = false) =>
    ipcRenderer.send('tab:find', { text, forward, findNext }),
  stopFindInPage: (action = 'clearSelection') =>
    ipcRenderer.send('tab:stop-find', action),

  // Bookmarks
  getBookmarks: () => ipcRenderer.invoke('bookmarks:get'),
  toggleBookmark: (item) => ipcRenderer.invoke('bookmarks:toggle', item),
  removeBookmark: (url) => ipcRenderer.invoke('bookmarks:remove', url),

  // Downloads
  getDownloads: () => ipcRenderer.invoke('downloads:get'),
  openDownloadItem: (path) => ipcRenderer.send('downloads:open', path),
  clearDownloads: () => ipcRenderer.invoke('downloads:clear'),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  removeHistoryItem: (url) => ipcRenderer.invoke('history:remove-item', url),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Window Controls
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // Event streams
  onTabsState: (cb) => ipcRenderer.on('tabs:state', (_e, state) => cb(state)),
  onWindowState: (cb) => ipcRenderer.on('window:state', (_e, state) => cb(state)),
  onFocusAddress: (cb) => ipcRenderer.on('chrome:focus-address', () => cb()),
  onZoom: (cb) => ipcRenderer.on('chrome:zoom', (_e, data) => cb(data)),
  onHistoryUpdated: (cb) => ipcRenderer.on('history:updated', (_e, hist) => cb(hist)),
  onFindResult: (cb) => ipcRenderer.on('find:result', (_e, res) => cb(res)),
  onOpenFind: (cb) => ipcRenderer.on('chrome:open-find', () => cb()),
  onToggleDownloads: (cb) => ipcRenderer.on('chrome:toggle-downloads', () => cb()),
  onToggleBookmark: (cb) => ipcRenderer.on('chrome:toggle-bookmark', () => cb()),
  onDownloadsUpdate: (cb) => ipcRenderer.on('downloads:update', (_e, dl) => cb(dl)),
  onBookmarksUpdate: (cb) => ipcRenderer.on('bookmarks:update', (_e, bm) => cb(bm)),
};

contextBridge.exposeInMainWorld('astra', api);
contextBridge.exposeInMainWorld('quantum', api);
