/**
 * I18nManager.js - Internationalization Manager for Renderer Process
 * 
 * Provides translation functionality for the renderer process including:
 * - UI translations
 * - Dynamic DOM updates with data-i18n attributes
 * - Language switching with ConfigManager persistence
 * - Event system for language change notifications
 * 
 * @class I18nManager
 */

class I18nManager {
    /**
     * Supported languages configuration
     */
    static SUPPORTED_LANGUAGES = [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' }
    ];

    static DEFAULT_LANGUAGE = 'en';

    /**
     * Create an I18nManager instance
     * @param {ConfigManager} configManager - The config manager for persistence
     */
    constructor(configManager) {
        this.configManager = configManager;
        this.currentLanguage = I18nManager.DEFAULT_LANGUAGE;
        this.translations = {};
        this.isInitialized = false;
        this.namespaces = ['common', 'menu', 'dialogs', 'notifications', 'tracks'];
        this.listeners = new Set();

        // Fallback translations (minimal set for bootstrapping)
        this.fallbackTranslations = {
            'app.name': 'CodeXomics',
            'status.loading': 'Loading...',
            'status.ready': 'Ready'
        };
    }

    /**
     * Initialize the i18n manager
     * Loads saved language preference and translation files
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) {
            console.log('[I18nManager] Already initialized');
            return;
        }

        try {
            // Load saved language preference from ConfigManager
            const savedLanguage = await this.loadLanguagePreference();
            this.currentLanguage = savedLanguage || I18nManager.DEFAULT_LANGUAGE;

            // Try to get language from main process (system language detection)
            if (!savedLanguage && window.ipcRenderer) {
                try {
                    const systemLang = await window.ipcRenderer.invoke('i18n:getCurrentLanguage');
                    if (systemLang && this.isLanguageSupported(systemLang)) {
                        this.currentLanguage = systemLang;
                    }
                } catch (e) {
                    console.warn('[I18nManager] Could not get system language:', e);
                }
            }

            // Load translations for current language
            await this.loadTranslations(this.currentLanguage);

            this.isInitialized = true;
            console.log(`[I18nManager] Initialized with language: ${this.currentLanguage}`);
        } catch (error) {
            console.error('[I18nManager] Initialization error:', error);
            this.isInitialized = true; // Mark as initialized to prevent loops
        }
    }

    /**
     * Load language preference from ConfigManager
     * @returns {Promise<string|null>}
     */
    async loadLanguagePreference() {
        try {
            if (this.configManager && this.configManager.getConfig) {
                const config = this.configManager.getConfig();
                return config?.general?.language || null;
            }
        } catch (e) {
            console.warn('[I18nManager] Could not load language preference:', e);
        }
        return null;
    }

    /**
     * Save language preference to ConfigManager
     * @param {string} language - Language code
     */
    async saveLanguagePreference(language) {
        try {
            if (this.configManager && this.configManager.updateConfig) {
                await this.configManager.updateConfig('general.language', language);
            }
        } catch (e) {
            console.warn('[I18nManager] Could not save language preference:', e);
        }
    }

    /**
     * Load translations for a language
     * @param {string} language - Language code
     * @returns {Promise<void>}
     */
    async loadTranslations(language) {
        const translationsData = {};

        for (const ns of this.namespaces) {
            try {
                const response = await fetch(`./locales/${language}/${ns}.json`);
                if (response.ok) {
                    translationsData[ns] = await response.json();
                } else {
                    // Try fallback to English
                    if (language !== 'en') {
                        const fallbackResponse = await fetch(`./locales/en/${ns}.json`);
                        if (fallbackResponse.ok) {
                            translationsData[ns] = await fallbackResponse.json();
                        }
                    }
                }
            } catch (error) {
                console.warn(`[I18nManager] Failed to load ${ns} translations for ${language}:`, error);
            }
        }

        this.translations = translationsData;
        console.log(`[I18nManager] Loaded translations for: ${language}`);
    }

    /**
     * Translate a key
     * @param {string} key - Translation key (namespace:key.path or just key.path)
     * @param {Object} options - Interpolation options
     * @returns {string} Translated string or key if not found
     */
    t(key, options = {}) {
        if (!key) return '';

        // Parse namespace and key path
        let namespace = 'common';
        let keyPath = key;

        if (key.includes(':')) {
            [namespace, keyPath] = key.split(':');
        }

        // Get value from translations
        let value = this.getNestedValue(this.translations[namespace], keyPath);

        // Try fallback namespace
        if (value === undefined && namespace !== 'common') {
            value = this.getNestedValue(this.translations.common, keyPath);
        }

        // Use fallback translations
        if (value === undefined) {
            value = this.fallbackTranslations[key] || this.fallbackTranslations[keyPath];
        }

        // Return key if no translation found
        if (value === undefined) {
            console.debug(`[I18nManager] Missing translation: ${key}`);
            return key;
        }

        // Handle interpolation
        if (options && typeof value === 'string') {
            value = value.replace(/\{\{(\w+)\}\}/g, (match, name) => {
                return options[name] !== undefined ? options[name] : match;
            });
        }

        return value;
    }

    /**
     * Get nested value from object using dot notation
     * @param {Object} obj - Object to search
     * @param {string} path - Dot-separated path
     * @returns {*} Value at path or undefined
     */
    getNestedValue(obj, path) {
        if (!obj || !path) return undefined;

        const parts = path.split('.');
        let current = obj;

        for (const part of parts) {
            if (current === undefined || current === null) return undefined;
            current = current[part];
        }

        return current;
    }

    /**
     * Change the current language
     * @param {string} lang - Language code
     * @returns {Promise<void>}
     */
    async changeLanguage(lang) {
        if (!this.isLanguageSupported(lang)) {
            console.warn(`[I18nManager] Unsupported language: ${lang}`);
            lang = I18nManager.DEFAULT_LANGUAGE;
        }

        if (lang === this.currentLanguage) {
            return;
        }

        const previousLanguage = this.currentLanguage;
        this.currentLanguage = lang;

        // Load new translations
        await this.loadTranslations(lang);

        // Save preference
        await this.saveLanguagePreference(lang);

        // Notify main process
        if (window.ipcRenderer) {
            try {
                await window.ipcRenderer.invoke('i18n:changeLanguage', lang);
            } catch (e) {
                console.warn('[I18nManager] Could not notify main process of language change:', e);
            }
        }

        // Update DOM
        this.updateDOM();

        // Notify listeners
        this.notifyListeners(lang, previousLanguage);

        console.log(`[I18nManager] Language changed from ${previousLanguage} to ${lang}`);
    }

    /**
     * Check if a language is supported
     * @param {string} lang - Language code
     * @returns {boolean}
     */
    isLanguageSupported(lang) {
        return I18nManager.SUPPORTED_LANGUAGES.some(l => l.code === lang);
    }

    /**
     * Get current language code
     * @returns {string}
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    /**
     * Get list of supported languages
     * @returns {Array<{code: string, name: string, nativeName: string}>}
     */
    getSupportedLanguages() {
        return I18nManager.SUPPORTED_LANGUAGES;
    }

    /**
     * Update DOM elements with data-i18n attribute
     */
    updateDOM() {
        // Update all elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const options = el.getAttribute('data-i18n-options');

            let opts = {};
            if (options) {
                try {
                    opts = JSON.parse(options);
                } catch (e) {
                    console.warn('[I18nManager] Invalid data-i18n-options:', options);
                }
            }

            const translation = this.t(key, opts);

            // Handle different element types
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                if (el.getAttribute('data-i18n-attr') === 'placeholder') {
                    el.placeholder = translation;
                } else {
                    el.value = translation;
                }
            } else if (el.getAttribute('data-i18n-attr') === 'title') {
                el.title = translation;
            } else {
                el.textContent = translation;
            }
        });

        // Update placeholder attributes
        const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
        placeholderElements.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = this.t(key);
        });

        // Update title attributes
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = this.t(key);
        });

        console.log(`[I18nManager] DOM updated with ${elements.length} elements`);
    }

    /**
     * Add a language change listener
     * @param {function} callback - Callback(newLang, oldLang)
     */
    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
        }
    }

    /**
     * Remove a language change listener
     * @param {function} callback
     */
    removeListener(callback) {
        this.listeners.delete(callback);
    }

    /**
     * Notify all listeners of language change
     * @param {string} newLang
     * @param {string} oldLang
     */
    notifyListeners(newLang, oldLang) {
        this.listeners.forEach(callback => {
            try {
                callback(newLang, oldLang);
            } catch (e) {
                console.error('[I18nManager] Listener error:', e);
            }
        });
    }

    /**
     * Get a translation function bound to a specific namespace
     * @param {string} namespace
     * @returns {function} Translation function
     */
    getNamespacedT(namespace) {
        return (key, options) => this.t(`${namespace}:${key}`, options);
    }

    /**
     * Check if manager is ready
     * @returns {boolean}
     */
    isReady() {
        return this.isInitialized;
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.I18nManager = I18nManager;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = I18nManager;
}
