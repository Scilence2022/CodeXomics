/**
 * File Format Integration Tests
 *
 * Validates that test data files are valid and parseable
 * for the file formats supported by CodeXomics.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const TEST_DATA = path.join(process.cwd(), 'test_data');

describe('File Format Validation', () => {
  describe('GenBank (.gbk)', () => {
    const gbkPath = path.join(TEST_DATA, 'ECOLI.gbk');

    it('should have ECOLI.gbk test file', () => {
      expect(fs.existsSync(gbkPath)).toBe(true);
    });

    it('ECOLI.gbk should have GenBank structure (LOCUS, FEATURES, //)', () => {
      const content = fs.readFileSync(gbkPath, 'utf-8');
      // GenBank format: LOCUS header, FEATURES section, // terminator
      expect(content).toMatch(/^LOCUS\s+\S+/m);
      expect(content).toMatch(/^FEATURES/m);
      expect(content.trim()).toMatch(/\/\/\s*$/);
    });

    it('ECOLI.gbk file should be > 1KB (real genome data)', () => {
      const stat = fs.statSync(gbkPath);
      expect(stat.size).toBeGreaterThan(1024);
    });
  });

  describe('WIG files', () => {
    const wigDir = path.join(TEST_DATA);
    const wigFiles = fs.readdirSync(wigDir).filter(f => f.endsWith('.wig'));

    it('should have at least 3 WIG test files', () => {
      expect(wigFiles.length).toBeGreaterThanOrEqual(3);
    });

    it('all WIG files should have track definition line', () => {
      for (const file of wigFiles) {
        const content = fs.readFileSync(path.join(wigDir, file), 'utf-8');
        const hasTrack = content.includes('track') || content.includes('type=');
        // Some WIG files use variableStep or fixedStep
        expect(hasTrack || content.includes('fixedStep') || content.includes('variableStep'),
          `${file} should be a valid WIG file`).toBe(true);
      }
    });

    it('ECOLI chip_seq WIG file should have position data', () => {
      const chipFile = path.join(wigDir, 'ecoli_chip_seq_h3k4me3_5000bp.wig');
      if (fs.existsSync(chipFile)) {
        const content = fs.readFileSync(chipFile, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('track') && !l.startsWith('#'));
        expect(lines.length).toBeGreaterThan(10);
      }
    });
  });

  describe('Documentation files', () => {
    it('docs/ directory should exist and have markdown files', () => {
      const docsDir = path.join(process.cwd(), 'docs');
      expect(fs.existsSync(docsDir)).toBe(true);
      const mdFiles = fs.readdirSync(docsDir, { recursive: true }).filter(f => f.endsWith('.md'));
      expect(mdFiles.length).toBeGreaterThan(0);
    });
  });

  describe('Project structure integrity', () => {
    it('package.json should be valid JSON', () => {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const content = fs.readFileSync(pkgPath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });

    it('package.json should have required fields', () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));
      expect(pkg.name).toBe('codexomics');
      expect(pkg.main).toBe('src/main.js');
      expect(pkg.version).toBeTruthy();
    });
  });
});
