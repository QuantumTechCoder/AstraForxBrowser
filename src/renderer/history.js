(function () {
  'use strict';

  function getAstra() {
    return window.astra || window.quantum;
  }

  const listEl = document.getElementById('history-list');
  const emptyEl = document.getElementById('history-empty');
  const searchInput = document.getElementById('history-search');
  const btnClearAll = document.getElementById('btn-clear-history');

  let historyItems = [];

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function render(filter = '') {
    listEl.innerHTML = '';
    const q = filter.toLowerCase().trim();
    const filtered = historyItems.filter((item) => {
      if (!q) return true;
      return (item.title && item.title.toLowerCase().includes(q)) || (item.url && item.url.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');

    const api = getAstra();

    filtered.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'history-item';

      const left = document.createElement('div');
      left.className = 'item-left';

      const time = document.createElement('span');
      time.className = 'item-time';
      time.textContent = formatTime(item.timestamp);
      left.appendChild(time);

      const fav = document.createElement('span');
      fav.className = 'item-favicon';
      if (item.favicon) {
        fav.style.backgroundImage = `url("${item.favicon}")`;
      } else {
        fav.textContent = '⬡';
      }
      left.appendChild(fav);

      const a = document.createElement('a');
      a.className = 'item-title';
      a.href = item.url;
      a.textContent = item.title || item.url;
      a.title = item.url;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const astraApi = getAstra();
        if (astraApi && astraApi.go) astraApi.go(item.url);
      });
      left.appendChild(a);

      const urlSpan = document.createElement('span');
      urlSpan.className = 'item-url';
      urlSpan.textContent = item.url;
      left.appendChild(urlSpan);

      row.appendChild(left);

      const delBtn = document.createElement('button');
      delBtn.className = 'item-delete';
      delBtn.innerHTML = '&#x2715;';
      delBtn.title = 'Remove from history';
      delBtn.addEventListener('click', async () => {
        historyItems.splice(index, 1);
        const astraApi = getAstra();
        if (astraApi && astraApi.removeHistoryItem) {
          await astraApi.removeHistoryItem(item.url);
        }
        render(searchInput.value);
      });
      row.appendChild(delBtn);

      listEl.appendChild(row);
    });
  }

  async function load() {
    const api = getAstra();
    if (api && api.getHistory) {
      historyItems = await api.getHistory();
    }
    render();
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => render(searchInput.value));
  }

  if (btnClearAll) {
    btnClearAll.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all browsing history?')) {
        historyItems = [];
        const api = getAstra();
        if (api && api.clearHistory) await api.clearHistory();
        render();
      }
    });
  }

  load();
})();
