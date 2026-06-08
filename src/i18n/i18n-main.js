/**
 * i18n-main.js - Internationalization module for Electron main process
 *
 * Provides translation functionality for native menus, system dialogs,
 * and other main process UI elements.
 *
 * @module i18n-main
 */

const i18next = require('i18next');
const Backend = require('i18next-fs-backend');
const path = require('path');
const { ipcMain } = require('electron');

// Supported languages
const SUPPORTED_LANGUAGES = ['en', 'zh-CN'];
const DEFAULT_LANGUAGE = 'en';

// Current language state
let currentLanguage = DEFAULT_LANGUAGE;
let isInitialized = false;

/**
 * Get the path to the locales directory
 * Handles both development and packaged app scenarios
 */
function getLocalesPath() {
  // src/locales/ is the single source of truth for all locale files.
  // Included in the asar via build.files: ["src/**/*"].
  // Path: src/i18n/i18n-main.js → ../locales → src/locales/
  return path.join(__dirname, '..', 'locales');
}

/**
 * Initialize i18next for the main process
 * @param {string} language - Initial language code (e.g., 'en', 'zh-CN')
 * @returns {Promise<void>}
 */
async function init(language = DEFAULT_LANGUAGE) {
  if (isInitialized) {
    console.log('[i18n-main] Already initialized');
    return;
  }

  const localesPath = getLocalesPath();

  try {
    await i18next.use(Backend).init({
      lng: language,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES,
      ns: ['common', 'menu', 'dialogs', 'notifications'],
      defaultNS: 'common',
      backend: {
        loadPath: path.join(localesPath, '{{lng}}', '{{ns}}.json'),
      },
      interpolation: {
        escapeValue: false,
      },
      returnEmptyString: false,
      returnNull: false,
      // Return key if translation not found
      saveMissing: false,
      missingKeyHandler: (lng, ns, key) => {
        console.warn(`[i18n-main] Missing translation: ${lng}/${ns}/${key}`);
      },
    });

    currentLanguage = language;
    isInitialized = true;
    console.log(`[i18n-main] Initialized with language: ${language}`);
  } catch (error) {
    console.error('[i18n-main] Initialization failed:', error);
    throw error;
  }
}

/**
 * Translate a key
 * @param {string} key - Translation key (namespace:key format supported)
 * @param {Object} options - Interpolation options
 * @returns {string} Translated string or key if not found
 */
function t(key, options = {}) {
  if (!isInitialized) {
    console.warn('[i18n-main] Not initialized, returning key:', key);
    return key;
  }
  return i18next.t(key, options);
}

/**
 * Change the current language
 * @param {string} lang - Language code
 * @returns {Promise<void>}
 */
async function changeLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.warn(`[i18n-main] Unsupported language: ${lang}, falling back to ${DEFAULT_LANGUAGE}`);
    lang = DEFAULT_LANGUAGE;
  }

  if (!isInitialized) {
    await init(lang);
    return;
  }

  try {
    await i18next.changeLanguage(lang);
    currentLanguage = lang;
    console.log(`[i18n-main] Language changed to: ${lang}`);
  } catch (error) {
    console.error('[i18n-main] Failed to change language:', error);
    throw error;
  }
}

/**
 * Get the current language
 * @returns {string} Current language code
 */
function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Get list of supported languages with display names
 * @returns {Array<{code: string, name: string, nativeName: string}>}
 */
function getSupportedLanguages() {
  return [
    { code: 'en', name: 'English', nativeName: 'English' },
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  ];
}

/**
 * Check if i18n is initialized
 * @returns {boolean}
 */
function isReady() {
  return isInitialized;
}

/**
 * Setup IPC handlers for language-related events
 * @param {function} onLanguageChange - Callback when language changes
 */
function setupIPC(onLanguageChange) {
  // Handle language change requests from renderer
  ipcMain.handle('i18n:changeLanguage', async (event, lang) => {
    await changeLanguage(lang);
    if (typeof onLanguageChange === 'function') {
      onLanguageChange(lang);
    }
    return { success: true, language: lang };
  });

  // Handle language query from renderer
  ipcMain.handle('i18n:getCurrentLanguage', () => {
    return currentLanguage;
  });

  // Handle supported languages query
  ipcMain.handle('i18n:getSupportedLanguages', () => {
    return getSupportedLanguages();
  });

  // Handle translation requests from renderer (for shared strings)
  ipcMain.handle('i18n:translate', (event, key, options) => {
    return t(key, options);
  });

  console.log('[i18n-main] IPC handlers registered');
}

module.exports = {
  init,
  t,
  changeLanguage,
  getCurrentLanguage,
  getSupportedLanguages,
  isReady,
  setupIPC,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
};
