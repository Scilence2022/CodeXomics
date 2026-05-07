// @ts-check
/**
 * SanitizeService — HTML sanitization utility for CodeXomics
 *
 * Wraps DOMPurify to provide a centralized, safe alternative to raw innerHTML.
 * All innerHTML assignments should go through this service to prevent XSS attacks.
 *
 * Security Context:
 * - CodeXomics currently runs with nodeIntegration:true + contextIsolation:false
 * - Any XSS directly equals full system compromise
 * - 422+ innerHTML assignments exist without sanitization
 *
 * Usage:
 *   // Instead of:
 *   element.innerHTML = userInput;
 *
 *   // Use:
 *   const { SanitizeService } = window.SanitizeService || require('./SanitizeService');
 *   element.innerHTML = SanitizeService.sanitize(userInput);
 *
 * @module SanitizeService
 */

const DOMPurify = require('dompurify');

class SanitizeService {
  constructor() {
    // Default configuration: allow common safe tags but strip dangerous ones
    this._defaultConfig = {
      ALLOWED_TAGS: [
        'a', 'abbr', 'acronym', 'b', 'blockquote', 'br', 'code', 'dd', 'div',
        'dl', 'dt', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i',
        'img', 'li', 'mark', 'ol', 'p', 'pre', 's', 'small', 'span', 'strong',
        'sub', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
        'u', 'ul', 'details', 'summary', 'kbd', 'var', 'cite', 'dfn', 'samp',
        'button', 'input', 'label', 'select', 'option', 'textarea', 'form',
        'figure', 'figcaption', 'aside', 'article', 'section', 'header', 'footer',
        'nav', 'main', 'time', 'progress', 'meter', 'ruby', 'rt', 'rp',
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel', 'class', 'id', 'style', 'title', 'alt',
        'src', 'width', 'height', 'colspan', 'rowspan', 'align', 'valign',
        'name', 'type', 'value', 'placeholder', 'disabled', 'checked',
        'data-*', 'role', 'aria-*', 'tabindex', 'for', 'lang', 'dir',
        'download', 'hreflang', 'ping', 'referrerpolicy',
      ],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'meta', 'link'],
      FORBID_ATTR: ['onabort', 'onblur', 'onchange', 'onclick', 'ondblclick', 'onerror',
        'onfocus', 'onkeydown', 'onkeypress', 'onkeyup', 'onload', 'onmousedown',
        'onmousemove', 'onmouseout', 'onmouseover', 'onmouseup', 'onreset',
        'onresize', 'onscroll', 'onselect', 'onsubmit', 'onunload',
        'onanimationend', 'onanimationiteration', 'onanimationstart',
        'ontransitionend', 'onpointerdown', 'onpointerup', 'onpointermove',
        'ontouchstart', 'ontouchend', 'ontouchmove'],
      USE_PROFILES: {html: true},
    };

    // Markdown-specific config: allows slightly more for rendered markdown content
    this._markdownConfig = {
      ...this._defaultConfig,
      ALLOWED_TAGS: [
        ...this._defaultConfig.ALLOWED_TAGS,
        'del', 'ins', 'sup', 'sub', 'input', // for task lists
      ],
      ADD_ATTR: ['target'], // for links
    };

    // Genome browser config: very restrictive, only basic formatting
    this._genomeBrowserConfig = {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'br', 'sup', 'sub', 'a'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'title'],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    };

    // Cache DOMPurify instance
    this._purify = DOMPurify;
  }

  /**
   * Sanitize HTML string with default configuration
   * @param {string} dirty - The unsanitized HTML string
   * @returns {string} Sanitized HTML string
   */
  sanitize(dirty) {
    if (typeof dirty !== 'string') return '';
    return this._purify.sanitize(dirty, this._defaultConfig);
  }

  /**
   * Sanitize HTML for markdown-rendered content (e.g., AI chat messages)
   * Allows slightly more tags for rich markdown rendering
   * @param {string} dirty - The unsanitized HTML string from markdown
   * @returns {string} Sanitized HTML string
   */
  sanitizeMarkdown(dirty) {
    if (typeof dirty !== 'string') return '';
    return this._purify.sanitize(dirty, this._markdownConfig);
  }

  /**
   * Sanitize HTML for genome browser track tooltips and labels
   * Very restrictive: only basic inline formatting allowed
   * @param {string} dirty - The unsanitized HTML string
   * @returns {string} Sanitized HTML string
   */
  sanitizeForGenomeBrowser(dirty) {
    if (typeof dirty !== 'string') return '';
    return this._purify.sanitize(dirty, this._genomeBrowserConfig);
  }

  /**
   * Sanitize and set innerHTML on an element (safest usage pattern)
   * @param {HTMLElement} element - Target DOM element
   * @param {string} dirty - The unsanitized HTML string
   * @param {string} [mode='default'] - Sanitization mode: 'default', 'markdown', 'genome'
   * @returns {HTMLElement} The element with sanitized content
   */
  safeSetInnerHTML(element, dirty, mode = 'default') {
    if (!element || typeof dirty !== 'string') return element;

    let clean;
    switch (mode) {
      case 'markdown':
        clean = this.sanitizeMarkdown(dirty);
        break;
      case 'genome':
        clean = this.sanitizeForGenomeBrowser(dirty);
        break;
      default:
        clean = this.sanitize(dirty);
    }

    element.innerHTML = clean;
    return element;
  }

  /**
   * Sanitize a plain text value (strips all HTML)
   * Use this instead of innerHTML when only plain text is needed
   * @param {string} text - Potentially unsafe text
   * @returns {string} Clean text with all HTML stripped
   */
  stripHtml(text) {
    if (typeof text !== 'string') return '';
    return this._purify.sanitize(text, {ALLOWED_TAGS: [], ALLOWED_ATTR: []});
  }

  /**
   * Check if a string contains potentially dangerous HTML
   * @param {string} html - HTML string to check
   * @returns {boolean} True if the string was modified during sanitization
   */
  isUnsafe(html) {
    if (typeof html !== 'string') return false;
    return this.sanitize(html) !== html;
  }
}

// Export as singleton for consistent usage across the app
const sanitizeService = new SanitizeService();

// Also expose on window for modules that rely on global scope
if (typeof window !== 'undefined') {
  window.SanitizeService = sanitizeService;
}

module.exports = sanitizeService;
module.exports.SanitizeService = SanitizeService;
