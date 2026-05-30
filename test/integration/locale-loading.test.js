/**
 * Locale Loading Integration Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const LOCALES_PATH = path.join(process.cwd(), 'src', 'locales');

describe('Locale Loading Integration', () => {
  const languages = fs
    .readdirSync(LOCALES_PATH, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name);

  it('should have at least 2 language directories', () => {
    expect(languages.length).toBeGreaterThanOrEqual(2);
  });

  it('should have en and zh-CN languages', () => {
    expect(languages).toContain('en');
    expect(languages).toContain('zh-CN');
  });

  it('each language should have required namespace files', () => {
    const requiredNamespaces = ['common', 'menu', 'notifications', 'dialogs'];
    for (const lang of languages) {
      for (const ns of requiredNamespaces) {
        const filePath = path.join(LOCALES_PATH, lang, `${ns}.json`);
        expect(fs.existsSync(filePath), `${lang}/${ns}.json should exist`).toBe(true);
      }
    }
  });

  it('all locale JSON files should be valid JSON', () => {
    for (const lang of languages) {
      const langPath = path.join(LOCALES_PATH, lang);
      const files = fs.readdirSync(langPath).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(langPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        expect(() => JSON.parse(content), `${lang}/${file} should be valid JSON`).not.toThrow();
      }
    }
  });

  it('en and zh-CN should have the same namespace keys', () => {
    const enFiles = fs
      .readdirSync(path.join(LOCALES_PATH, 'en'))
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort();

    const zhFiles = fs
      .readdirSync(path.join(LOCALES_PATH, 'zh-CN'))
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
      .sort();

    expect(enFiles).toEqual(zhFiles);
  });

  it('common.json should have essential translation keys', () => {
    const enCommon = JSON.parse(fs.readFileSync(path.join(LOCALES_PATH, 'en', 'common.json'), 'utf-8'));
    // Verify common.json has expected structure
    expect(enCommon).toHaveProperty('app');
    expect(enCommon.app).toHaveProperty('name');
    expect(enCommon).toHaveProperty('buttons');
    expect(enCommon.buttons).toHaveProperty('save');
  });
});
