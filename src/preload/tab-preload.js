'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Only expose astra API to internal pages loaded via file: protocol in the renderer directory
const isInternal = window.location.protocol === 'file:' && window.location.pathname.includes('renderer');

if (isInternal) {
  const api = {
    // Settings
    getSettings: () => ipcRenderer.invoke('settings:get'),
    updateSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
    selectDownloadDir: () => ipcRenderer.invoke('dialog:select-download-dir'),
    clearBrowsingData: (opts) => ipcRenderer.invoke('session:clear-data', opts),

    // History
    getHistory: () => ipcRenderer.invoke('history:get'),
    removeHistoryItem: (url) => ipcRenderer.invoke('history:remove-item', url),
    clearHistory: () => ipcRenderer.invoke('history:clear'),

    // Bookmarks
    getBookmarks: () => ipcRenderer.invoke('bookmarks:get'),
    toggleBookmark: (item) => ipcRenderer.invoke('bookmarks:toggle', item),
    removeBookmark: (url) => ipcRenderer.invoke('bookmarks:remove', url),

    // Downloads
    getDownloads: () => ipcRenderer.invoke('downloads:get'),
    openDownloadItem: (path) => ipcRenderer.send('downloads:open', path),
    clearDownloads: () => ipcRenderer.invoke('downloads:clear'),
    onDownloadsUpdate: (cb) => ipcRenderer.on('downloads:update', (_e, dl) => cb(dl)),

    // Navigation
    go: (url) => ipcRenderer.send('nav:go', url),
  };

  contextBridge.exposeInMainWorld('astra', api);
  contextBridge.exposeInMainWorld('quantum', api);
}
