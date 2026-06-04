// @ts-check
/**
 * SanitizeService — HTML sanitization utility for CodeXomics
 *
 * Wraps DOMPurify to provide a centralized, safe alternative to raw innerHTML.
 * All innerHTML assignments should go through this service to prevent XSS attacks.
 *
 * Security Context:
 * - CodeXomics renderer runs with nodeIntegration disabled and contextIsolation enabled
 * - Sanitization still protects persisted/project content, chat messages, and plugin-provided HTML
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

function createFallbackSanitizer() {
  const escapeHtml = value =>
    String(value).replace(/[&<>"']/g, char => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[char];
    });

  return {
    sanitize(value, config = {}) {
      if (typeof value !== 'string') return '';

      if (config.ALLOWED_TAGS && config.ALLOWED_TAGS.length === 0) {
        return escapeHtml(value.replace(/<[^>]*>/g, ''));
      }

      if (typeof document === 'undefined') {
        return escapeHtml(value);
      }

      const allowedTags = new Set((config.ALLOWED_TAGS || []).map(tag => tag.toLowerCase()));
      const allowedAttrs = new Set((config.ALLOWED_ATTR || config.ADD_ATTR || []).map(attr => attr.toLowerCase()));
      const allowDataAttrs = config.ALLOW_DATA_ATTR === true;
      const template = document.createElement('template');
      template.innerHTML = value;

      template.content.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(node => {
        node.remove();
      });

      template.content.querySelectorAll('*').forEach(node => {
        const tagName = node.tagName.toLowerCase();
        if (allowedTags.size > 0 && !allowedTags.has(tagName)) {
          node.replaceWith(...Array.from(node.childNodes));
          return;
        }

        Array.from(node.attributes).forEach(attr => {
          const attrName = attr.name.toLowerCase();
          const attrValue = attr.value || '';
          const isAllowedDataAttr = allowDataAttrs && attrName.startsWith('data-');
          const isAllowedAttr = allowedAttrs.size === 0 || allowedAttrs.has(attrName) || isAllowedDataAttr;

          if (
            !isAllowedAttr ||
            attrName.startsWith('on') ||
            /javascript\s*:/i.test(attrValue) ||
            /data\s*:/i.test(attrValue)
          ) {
            node.removeAttribute(attr.name);
          }
        });
      });

      return template.innerHTML;
    },
  };
}

function resolveDOMPurify() {
  if (typeof window !== 'undefined' && window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
    return window.DOMPurify;
  }

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try {
      const requiredDOMPurify = require('dompurify');
      if (requiredDOMPurify && typeof requiredDOMPurify.sanitize === 'function') {
        return requiredDOMPurify;
      }
    } catch (error) {
      console.warn('[Security] DOMPurify CommonJS load failed, using fallback sanitizer:', error.message);
    }
  }

  console.error('[Security] DOMPurify browser bundle was not available; using limited fallback sanitizer');
  return createFallbackSanitizer();
}

class SanitizeService {
  constructor() {
    // Default configuration: allow common safe tags but strip dangerous ones
    this._defaultConfig = {
      ALLOWED_TAGS: [
        'a',
        'abbr',
        'acronym',
        'b',
        'blockquote',
        'br',
        'code',
        'dd',
        'div',
        'dl',
        'dt',
        'em',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'hr',
        'i',
        'img',
        'li',
        'mark',
        'ol',
        'p',
        'pre',
        's',
        'small',
        'span',
        'strong',
        'sub',
        'sup',
        'table',
        'tbody',
        'td',
        'tfoot',
        'th',
        'thead',
        'tr',
        'u',
        'ul',
        'details',
        'summary',
        'kbd',
        'var',
        'cite',
        'dfn',
        'samp',
        'button',
        'input',
        'label',
        'select',
        'option',
        'textarea',
        'form',
        'figure',
        'figcaption',
        'aside',
        'article',
        'section',
        'header',
        'footer',
        'nav',
        'main',
        'time',
        'progress',
        'meter',
        'ruby',
        'rt',
        'rp',
      ],
      ALLOWED_ATTR: [
        'href',
        'target',
        'rel',
        'class',
        'id',
        'style',
        'title',
        'alt',
        'src',
        'width',
        'height',
        'colspan',
        'rowspan',
        'align',
        'valign',
        'name',
        'type',
        'value',
        'placeholder',
        'disabled',
        'checked',
        'data-*',
        'role',
        'aria-*',
        'tabindex',
        'for',
        'lang',
        'dir',
        'download',
        'hreflang',
        'ping',
        'referrerpolicy',
      ],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'meta', 'link'],
      FORBID_ATTR: [
        'onabort',
        'onblur',
        'onchange',
        'onclick',
        'ondblclick',
        'onerror',
        'onfocus',
        'onkeydown',
        'onkeypress',
        'onkeyup',
        'onload',
        'onmousedown',
        'onmousemove',
        'onmouseout',
        'onmouseover',
        'onmouseup',
        'onreset',
        'onresize',
        'onscroll',
        'onselect',
        'onsubmit',
        'onunload',
        'onanimationend',
        'onanimationiteration',
        'onanimationstart',
        'ontransitionend',
        'onpointerdown',
        'onpointerup',
        'onpointermove',
        'ontouchstart',
        'ontouchend',
        'ontouchmove',
      ],
      USE_PROFILES: { html: true },
    };

    // Markdown-specific config: allows slightly more for rendered markdown content
    this._markdownConfig = {
      ...this._defaultConfig,
      ALLOWED_TAGS: [
        ...this._defaultConfig.ALLOWED_TAGS,
        'del',
        'ins',
        'sup',
        'sub',
        'input', // for task lists
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
    this._purify = resolveDOMPurify();
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
    return this._purify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = sanitizeService;
  module.exports.SanitizeService = SanitizeService;
}
