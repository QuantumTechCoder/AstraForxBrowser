'use strict';

const { SEARCH_ENGINES } = require('./config');

const ALLOWED_SCHEMES = ['http:', 'https:', 'about:', 'file:', 'data:', 'chrome:', 'astra:', 'view-source:'];

// Command-line prefix shortcuts
const PREFIX_COMMANDS = [
  { prefix: /^gh[:\s]+/i, url: 'https://github.com/search?q=%s' },
  { prefix: /^so[:\s]+/i, url: 'https://stackoverflow.com/search?q=%s' },
  { prefix: /^yt[:\s]+/i, url: 'https://www.youtube.com/results?search_query=%s' },
  { prefix: /^w[:\s]+/i, url: 'https://en.wikipedia.org/wiki/Special:Search?search=%s' },
  { prefix: /^ddg[:\s]+/i, url: 'https://duckduckgo.com/?q=%s' },
  { prefix: /^r\/([a-zA-Z0-9_]+)$/i, url: 'https://www.reddit.com/r/%s/' },
];

/**
 * Turn address-bar / command input into a navigable URL.
 * - Handles CLI shortcuts (gh, so, yt, etc.)
 * - Full URLs (with an allowed scheme) are used as-is.
 * - Localhost / IP addresses / domain names get https://
 * - Everything else defaults to search with selected engine
 */
function resolveInput(rawInput, searchEngineKey = 'google') {
  const input = String(rawInput || '').trim();
  if (!input) return null;

  // Internal astra:// or chrome:// shortcuts
  if (/^(astra|chrome):\/\//i.test(input)) {
    return input.toLowerCase();
  }

  // Check prefix commands
  for (const cmd of PREFIX_COMMANDS) {
    if (cmd.prefix.test(input)) {
      const query = input.replace(cmd.prefix, '').trim();
      return cmd.url.replace('%s', encodeURIComponent(query));
    }
  }

  // Already a full URL with scheme
  try {
    const parsed = new URL(input);
    if (ALLOWED_SCHEMES.includes(parsed.protocol)) {
      return parsed.toString();
    }
  } catch (_) {
    // not a full URL
  }

  const looksLikeHost =
    /^localhost(:\d+)?(\/.*)?$/i.test(input) ||
    /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(input) ||
    (/^[^\s]+\.[^\s]{2,}(\/.*)?$/.test(input) && !input.includes(' '));

  if (looksLikeHost) {
    return 'https://' + input;
  }

  const searchTemplate = SEARCH_ENGINES[searchEngineKey] || SEARCH_ENGINES.google;
  return searchTemplate.replace('%s', encodeURIComponent(input));
}

module.exports = { resolveInput };
