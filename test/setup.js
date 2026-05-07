/**
 * Test setup file for Vitest
 * Provides global mocks and configuration for the CodeXomics test suite
 */

import { vi } from 'vitest';

// Mock DOMPurify for sanitizer tests
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html, config) => {
      // Simple mock: strip <script> tags for testing
      return html.replace(/<script[\s\S]*?<\/script>/gi, '');
    }),
  },
  sanitize: vi.fn((html, config) => {
    return html.replace(/<script[\s\S]*?<\/script>/gi, '');
  }),
}));

// Mock window object properties used across the codebase
if (typeof globalThis.window === 'undefined') {
  globalThis.window = globalThis;
}

// Ensure DOMMatcher is available for jsdom
if (!globalThis.matchMedia) {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
