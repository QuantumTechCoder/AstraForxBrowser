'use strict';

const path = require('path');
const { pathToFileURL } = require('url');

const CHROME_HEIGHT = 92;

const NEW_TAB_FILE = path.join(__dirname, '..', 'renderer', 'newtab.html');
const HOME_URL = pathToFileURL(NEW_TAB_FILE).href;
const NEW_TAB_URL = HOME_URL;

const SEARCH_ENGINES = {
  google: 'https://www.google.com/search?q=%s',
  duckduckgo: 'https://duckduckgo.com/?q=%s',
  bing: 'https://www.bing.com/search?q=%s',
  brave: 'https://search.brave.com/search?q=%s',
  ecosia: 'https://www.ecosia.org/search?q=%s',
};

const SEARCH_URL = SEARCH_ENGINES.google;

module.exports = {
  CHROME_HEIGHT,
  HOME_URL,
  NEW_TAB_URL,
  SEARCH_URL,
  SEARCH_ENGINES,
  NEW_TAB_FILE,
};
