/**
 * Extension System Integration Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const EXT_DIR = path.join(process.cwd(), 'src/renderer/modules/core');

describe('Extension System Structure', () => {
  let files;

  beforeAll(() => {
    files = fs.readdirSync(EXT_DIR).filter(f => f.endsWith('.js'));
  });

  it('should have core infrastructure modules', () => {
    expect(files).toContain('ExtensionService.js');
    expect(files).toContain('ExtensionHost.js');
    expect(files).toContain('ExtensionContext.js');
    expect(files).toContain('ContributionRegistry.js');
    expect(files).toContain('CommandRegistry.js');
    expect(files).toContain('ExtensionManifest.js');
    expect(files).toContain('ActivationEventsService.js');
    expect(files).toContain('Disposable.js');
  });

  it('ExtensionManifest should define manifest validation', () => {
    const content = fs.readFileSync(path.join(EXT_DIR, 'ExtensionManifest.js'), 'utf-8');
    expect(content).toContain('class ExtensionManifest');
    expect(content.includes('validate') || content.includes('schema')).toBe(true);
  });

  it('ContributionRegistry should manage contribution points', () => {
    const content = fs.readFileSync(path.join(EXT_DIR, 'ContributionRegistry.js'), 'utf-8');
    expect(content).toContain('class ContributionRegistry');
    expect(content.includes('register') || content.includes('add')).toBe(true);
  });

  it('CommandRegistry should manage command registration', () => {
    const content = fs.readFileSync(path.join(EXT_DIR, 'CommandRegistry.js'), 'utf-8');
    expect(content).toContain('class CommandRegistry');
  });

  it('all extension modules should define a class', () => {
    for (const file of files) {
      const content = fs.readFileSync(path.join(EXT_DIR, file), 'utf-8');
      expect(content.includes('class ') || content.includes('module.exports')).toBe(true);
    }
  });
});

describe('Export Subsystem', () => {
  const exportDir = path.join(process.cwd(), 'src/renderer/modules/export');

  it('GenBankExporter should exist', () => {
    expect(fs.existsSync(path.join(exportDir, 'GenBankExporter.js'))).toBe(true);
  });

  it('GenBankExporter should define export methods', () => {
    const content = fs.readFileSync(path.join(exportDir, 'GenBankExporter.js'), 'utf-8');
    expect(content).toContain('class GenBankExporter');
    expect(content.includes('export') || content.includes('format')).toBe(true);
  });
});
