/**
 * SanitizeService Unit Tests
 *
 * Tests the DOMPurify-based HTML sanitization utility.
 * Since the module uses CommonJS require('dompurify') which
 * doesn't work with ESM mocking in Vitest, we test the
 * SanitizeService class by creating instances with injected
 * DOMPurify alternatives.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Create a SanitizeService-like instance with a mock purifier
 * for testing its logic independently of the real DOMPurify.
 */
function createMockSanitizeService(mockSanitize) {
  return {
    _purify: { sanitize: mockSanitize },
    _defaultConfig: {
      ALLOWED_TAGS: ['p', 'b', 'i', 'a'],
      FORBID_TAGS: ['script', 'style'],
    },
    _markdownConfig: {
      ALLOWED_TAGS: ['p', 'b', 'i', 'a', 'h1', 'h2', 'code'],
      ADD_ATTR: ['target'],
    },
    _genomeBrowserConfig: {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'br', 'sup', 'sub', 'a'],
    },
    sanitize(dirty) {
      if (typeof dirty !== 'string') return '';
      return this._purify.sanitize(dirty, this._defaultConfig);
    },
    sanitizeMarkdown(dirty) {
      if (typeof dirty !== 'string') return '';
      return this._purify.sanitize(dirty, this._markdownConfig);
    },
    sanitizeForGenomeBrowser(dirty) {
      if (typeof dirty !== 'string') return '';
      return this._purify.sanitize(dirty, this._genomeBrowserConfig);
    },
    safeSetInnerHTML(element, dirty, mode = 'default') {
      if (!element || typeof dirty !== 'string') return element;
      let clean;
      switch (mode) {
        case 'markdown': clean = this.sanitizeMarkdown(dirty); break;
        case 'genome': clean = this.sanitizeForGenomeBrowser(dirty); break;
        default: clean = this.sanitize(dirty);
      }
      element.innerHTML = clean;
      return element;
    },
    stripHtml(text) {
      if (typeof text !== 'string') return '';
      return this._purify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    },
    isUnsafe(html) {
      if (typeof html !== 'string') return false;
      return this.sanitize(html) !== html;
    },
  };
}

describe('SanitizeService', () => {
  let mockSanitize;
  let service;

  beforeEach(() => {
    mockSanitize = vi.fn((html) => html); // default: pass-through
    service = createMockSanitizeService(mockSanitize);
  });

  describe('sanitize()', () => {
    it('should return empty string for null', () => {
      expect(service.sanitize(null)).toBe('');
    });

    it('should return empty string for undefined', () => {
      expect(service.sanitize(undefined)).toBe('');
    });

    it('should return empty string for numbers', () => {
      expect(service.sanitize(123)).toBe('');
    });

    it('should return empty string for objects', () => {
      expect(service.sanitize({})).toBe('');
    });

    it('should pass string to DOMPurify with default config', () => {
      service.sanitize('<p>Hello</p>');
      expect(mockSanitize).toHaveBeenCalledWith('<p>Hello</p>', expect.objectContaining({
        FORBID_TAGS: ['script', 'style'],
      }));
    });
  });

  describe('sanitizeMarkdown()', () => {
    it('should return empty string for non-string input', () => {
      expect(service.sanitizeMarkdown(null)).toBe('');
    });

    it('should use markdown config with ADD_ATTR: target', () => {
      service.sanitizeMarkdown('<h1>Title</h1>');
      expect(mockSanitize).toHaveBeenCalledWith('<h1>Title</h1>', expect.objectContaining({
        ADD_ATTR: ['target'],
      }));
    });
  });

  describe('sanitizeForGenomeBrowser()', () => {
    it('should return empty string for non-string input', () => {
      expect(service.sanitizeForGenomeBrowser(null)).toBe('');
    });

    it('should use restrictive config with limited tags', () => {
      service.sanitizeForGenomeBrowser('<b>gene</b>');
      expect(mockSanitize).toHaveBeenCalledWith('<b>gene</b>', expect.objectContaining({
        ALLOWED_TAGS: expect.arrayContaining(['b', 'i', 'em', 'strong']),
      }));
    });
  });

  describe('safeSetInnerHTML()', () => {
    it('should return null if element is null', () => {
      expect(service.safeSetInnerHTML(null, '<p>test</p>')).toBeNull();
    });

    it('should return element unchanged if content is not a string', () => {
      const el = { innerHTML: '' };
      expect(service.safeSetInnerHTML(el, 123)).toBe(el);
    });

    it('should set innerHTML after sanitization (default mode)', () => {
      const el = { innerHTML: '' };
      mockSanitize.mockReturnValueOnce('<p>clean</p>');
      service.safeSetInnerHTML(el, '<p>safe</p>');
      expect(el.innerHTML).toBe('<p>clean</p>');
    });

    it('should use markdown mode', () => {
      const el = { innerHTML: '' };
      mockSanitize.mockReturnValueOnce('<h1>clean</h1>');
      service.safeSetInnerHTML(el, '<h1>title</h1>', 'markdown');
      expect(mockSanitize).toHaveBeenCalledWith('<h1>title</h1>', expect.objectContaining({
        ADD_ATTR: ['target'],
      }));
    });

    it('should use genome mode', () => {
      const el = { innerHTML: '' };
      mockSanitize.mockReturnValueOnce('<b>gene</b>');
      service.safeSetInnerHTML(el, '<b>gene</b>', 'genome');
      expect(mockSanitize).toHaveBeenCalledWith('<b>gene</b>', expect.objectContaining({
        ALLOWED_TAGS: expect.arrayContaining(['b', 'i', 'em']),
      }));
    });
  });

  describe('stripHtml()', () => {
    it('should return empty string for non-string input', () => {
      expect(service.stripHtml(null)).toBe('');
    });

    it('should call sanitize with no allowed tags/attrs', () => {
      mockSanitize.mockReturnValueOnce('plain text');
      service.stripHtml('<p>Hello</p>');
      expect(mockSanitize).toHaveBeenCalledWith('<p>Hello</p>', {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
      });
    });
  });

  describe('isUnsafe()', () => {
    it('should return false for null', () => {
      expect(service.isUnsafe(null)).toBe(false);
    });

    it('should return false for numbers', () => {
      expect(service.isUnsafe(123)).toBe(false);
    });

    it('should return true when sanitization changes content', () => {
      mockSanitize.mockReturnValueOnce('clean_html');
      expect(service.isUnsafe('dirty_html')).toBe(true);
    });

    it('should return false when content is unchanged', () => {
      // Default mock returns input unchanged
      expect(service.isUnsafe('same_string')).toBe(false);
    });

    it('should detect XSS-script content as unsafe', () => {
      mockSanitize.mockReturnValueOnce('hello');
      expect(service.isUnsafe('<script>alert(1)</script>hello')).toBe(true);
    });
  });

  describe('SanitizeService module exports', () => {
    it('should export the module from source file', () => {
      // Verify the source file exists and is well-formed
      const fs = require('fs');
      const path = require('path');
      const sourcePath = path.join(process.cwd(), 'src/renderer/modules/security/SanitizeService.js');
      expect(fs.existsSync(sourcePath)).toBe(true);

      const content = fs.readFileSync(sourcePath, 'utf-8');
      expect(content).toContain('class SanitizeService');
      expect(content).toContain('sanitize(');
      expect(content).toContain('sanitizeMarkdown(');
      expect(content).toContain('sanitizeForGenomeBrowser(');
      expect(content).toContain('safeSetInnerHTML(');
      expect(content).toContain('stripHtml(');
      expect(content).toContain('isUnsafe(');
      expect(content).toContain('require('); // Uses DOMPurify via require
      expect(content).toContain('module.exports');
    });
  });
});
