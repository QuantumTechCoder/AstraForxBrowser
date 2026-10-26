(function () {
  'use strict';

  function getAstra() {
    return window.astra || window.quantum;
  }

  const listEl = document.getElementById('bm-list');
  const emptyEl = document.getElementById('bm-empty');
  const searchInput = document.getElementById('bm-search');
  const btnAdd = document.getElementById('btn-add-bm');

  // Modal
  const modal = document.getElementById('bm-modal');
  const modalClose = document.getElementById('bm-modal-close');
  const modalCancel = document.getElementById('bm-modal-cancel');
  const modalSave = document.getElementById('bm-modal-save');
  const inputTitle = document.getElementById('modal-bm-title');
  const inputUrl = document.getElementById('modal-bm-url');

  let bookmarks = [];

  function render(filter = '') {
    listEl.innerHTML = '';
    const q = filter.toLowerCase().trim();
    const filtered = bookmarks.filter((bm) => {
      if (!q) return true;
      return (bm.title && bm.title.toLowerCase().includes(q)) || (bm.url && bm.url.toLowerCase().includes(q));
    });

    if (filtered.length === 0) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');

    filtered.forEach((bm) => {
      const row = document.createElement('div');
      row.className = 'bm-item';

      const left = document.createElement('div');
      left.className = 'item-left';

      const fav = document.createElement('span');
      fav.className = 'item-favicon';
      if (bm.favicon) {
        fav.style.backgroundImage = `url("${bm.favicon}")`;
      } else {
        fav.textContent = '⭐';
      }
      left.appendChild(fav);

      const a = document.createElement('a');
      a.className = 'item-title';
      a.href = bm.url;
      a.textContent = bm.title || bm.url;
      a.title = bm.url;
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const api = getAstra();
        if (api && api.go) api.go(bm.url);
      });
      left.appendChild(a);

      const urlSpan = document.createElement('span');
      urlSpan.className = 'item-url';
      urlSpan.textContent = bm.url;
      left.appendChild(urlSpan);

      row.appendChild(left);

      const delBtn = document.createElement('button');
      delBtn.className = 'item-delete';
      delBtn.innerHTML = '&#x2715;';
      delBtn.title = 'Remove bookmark';
      delBtn.addEventListener('click', async () => {
        const api = getAstra();
        if (api && api.removeBookmark) {
          await api.removeBookmark(bm.url);
        }
        bookmarks = bookmarks.filter((b) => b.url !== bm.url);
        render(searchInput.value);
      });
      row.appendChild(delBtn);

      listEl.appendChild(row);
    });
  }

  async function load() {
    const api = getAstra();
    if (api && api.getBookmarks) {
      bookmarks = await api.getBookmarks();
    }
    render();
  }

  function openModal() {
    if (inputTitle) inputTitle.value = '';
    if (inputUrl) inputUrl.value = '';
    if (modal) modal.classList.remove('hidden');
    if (inputTitle) inputTitle.focus();
  }

  function closeModal() {
    if (modal) modal.classList.add('hidden');
  }

  if (btnAdd) btnAdd.addEventListener('click', openModal);
  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (modalCancel) modalCancel.addEventListener('click', closeModal);

  if (modalSave) {
    modalSave.addEventListener('click', async () => {
      const title = inputTitle ? inputTitle.value.trim() : '';
      let url = inputUrl ? inputUrl.value.trim() : '';
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

      const item = { title: title || url, url, favicon: null };
      const api = getAstra();
      if (api && api.toggleBookmark) {
        await api.toggleBookmark(item);
      }
      bookmarks.push(item);
      render(searchInput.value);
      closeModal();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => render(searchInput.value));
  }

  load();
})();
