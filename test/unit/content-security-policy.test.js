import { describe, expect, it } from 'vitest';
import { RENDERER_CONTENT_SECURITY_POLICY } from '../../src/main/security-utils.js';

/**
 * Behavioral guard for the renderer Content Security Policy. These assertions lock
 * in the security-relevant invariants so an accidental loosening is caught in CI.
 */
describe('renderer Content Security Policy', () => {
  const directives = Object.fromEntries(
    RENDERER_CONTENT_SECURITY_POLICY.split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values];
      })
  );

  it('never allows unsafe-eval anywhere', () => {
    expect(RENDERER_CONTENT_SECURITY_POLICY).not.toContain('unsafe-eval');
  });

  it('disables plugins via object-src none', () => {
    expect(directives['object-src']).toEqual(["'none'"]);
  });

  it('locks base-uri to self', () => {
    expect(directives['base-uri']).toEqual(["'self'"]);
  });

  it('prevents the app from being framed (clickjacking)', () => {
    expect(directives['frame-ancestors']).toEqual(["'none'"]);
  });

  it('restricts form submissions to self', () => {
    expect(directives['form-action']).toEqual(["'self'"]);
  });

  it('enforces TLS for remote stylesheets (no bare http:)', () => {
    expect(directives['style-src']).toBeDefined();
    expect(directives['style-src']).not.toContain('http:');
  });

  it('enforces TLS for remote fonts (no bare http: or wildcard https:)', () => {
    expect(directives['font-src']).toBeDefined();
    expect(directives['font-src']).not.toContain('http:');
    expect(directives['font-src']).not.toContain('https:');
  });

  it('restricts script sources to self, inline, and an explicit CDN allowlist', () => {
    const scriptSrc = directives['script-src'];
    expect(scriptSrc).toBeDefined();
    // No blanket remote wildcard for scripts.
    expect(scriptSrc).not.toContain('https:');
    expect(scriptSrc).not.toContain('http:');
    // The CDNs the bundled tool windows actually use must be present.
    for (const host of ['https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com']) {
      expect(scriptSrc).toContain(host);
    }
  });
});
