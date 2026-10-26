'use strict';

const SEARCH_URL = 'https://www.google.com/search?q=';

const PREFIX_MAP = [
  { prefix: /^gh[:\s]+/i, url: 'https://github.com/search?q=%s' },
  { prefix: /^so[:\s]+/i, url: 'https://stackoverflow.com/search?q=%s' },
  { prefix: /^yt[:\s]+/i, url: 'https://www.youtube.com/results?search_query=%s' },
  { prefix: /^w[:\s]+/i, url: 'https://en.wikipedia.org/wiki/Special:Search?search=%s' },
  { prefix: /^ddg[:\s]+/i, url: 'https://duckduckgo.com/?q=%s' },
];

function resolveQuery(raw) {
  const input = String(raw || '').trim();
  if (!input) return null;

  for (const item of PREFIX_MAP) {
    if (item.prefix.test(input)) {
      const q = input.replace(item.prefix, '').trim();
      return item.url.replace('%s', encodeURIComponent(q));
    }
  }

  // Already a full URL
  if (/^https?:\/\//i.test(input) || /^file:\/\//i.test(input)) {
    return input;
  }

  // Looks like host / domain
  if (/^localhost(:\d+)?(\/.*)?$/i.test(input) || /^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(input)) {
    return 'https://' + input;
  }

  return SEARCH_URL + encodeURIComponent(input);
}

function saveHistoryEntry(url, title) {
  try {
    const list = JSON.parse(localStorage.getItem('qb_recent') || '[]');
    const filtered = list.filter((item) => item.url !== url);
    filtered.unshift({
      url,
      title: title || url,
      timestamp: Date.now(),
    });
    localStorage.setItem('qb_recent', JSON.stringify(filtered.slice(0, 30)));
  } catch (_) {}
}

function navigateTo(url, title) {
  if (!url) return;
  saveHistoryEntry(url, title || url);
  window.location.href = url;
}

// Form Submission
const form = document.getElementById('cli-form');
const input = document.getElementById('cli-input');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const raw = input.value.trim();
  if (!raw) return;
  const target = resolveQuery(raw);
  if (target) navigateTo(target, raw);
});

// Syntax Pills Click
document.querySelectorAll('.syntax-pill').forEach((pill) => {
  pill.addEventListener('click', () => {
    const prefix = pill.getAttribute('data-prefix');
    input.value = prefix;
    input.focus();
    input.setSelectionRange(prefix.length, prefix.length);
  });
});

// Speed Dial Cards
document.querySelectorAll('.matrix-card').forEach((card) => {
  card.addEventListener('click', (e) => {
    e.preventDefault();
    const url = card.getAttribute('data-url');
    const label = card.querySelector('.card-label')?.textContent || url;
    navigateTo(url, label);
  });
});

// Render Recent History
function formatTime(ts) {
  if (!ts) return '--:--:--';
  const d = new Date(ts);
  return d.toTimeString().split(' ')[0];
}

function renderRecentLog() {
  const container = document.getElementById('access-log');
  if (!container) return;

  try {
    const history = JSON.parse(localStorage.getItem('qb_recent') || '[]');
    container.innerHTML = '';

    if (!history || history.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'log-empty';
      empty.textContent = '// LOG BUFFER EMPTY - ACCESS SESSIONS WILL BE RECORDED HERE';
      container.appendChild(empty);
      return;
    }

    history.slice(0, 10).forEach((entry) => {
      const row = document.createElement('a');
      row.className = 'log-row';
      row.href = entry.url;

      row.innerHTML = `
        <span class="col-time">${formatTime(entry.timestamp)}</span>
        <span class="col-status">[200 OK]</span>
        <span class="col-title">${entry.title || entry.url}</span>
        <span class="col-url">${entry.url}</span>
      `;

      row.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(entry.url, entry.title);
      });

      container.appendChild(row);
    });
  } catch (_) {
    container.innerHTML = '<div class="log-empty">// FAILED TO RETRIEVE LOG BUFFER</div>';
  }
}

// Clear Log Button
const clearBtn = document.getElementById('clear-log-btn');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    try {
      localStorage.removeItem('qb_recent');
      renderRecentLog();
    } catch (_) {}
  });
}

// Keyboard shortcuts inside New Tab page
window.addEventListener('keydown', (e) => {
  const isInputFocused = document.activeElement === input;

  if (e.key === 'Escape') {
    input.value = '';
    input.blur();
    return;
  }

  if (e.key === '/' && !isInputFocused) {
    e.preventDefault();
    input.focus();
    input.select();
    return;
  }

  // Hotkeys 1-8 when input is not focused
  if (!isInputFocused && !e.ctrlKey && !e.metaKey && !e.altKey) {
    if (e.key >= '1' && e.key <= '8') {
      const card = document.querySelector(`.matrix-card[data-key="${e.key}"]`);
      if (card) {
        e.preventDefault();
        card.click();
      }
    }
  }
});

// Initial log render
renderRecentLog();
