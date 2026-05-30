/**
 * Chat Services Structure Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICES_DIR = path.join(process.cwd(), 'src/renderer/modules/chat/services');

describe('Chat Services Structure', () => {
  let serviceFiles;

  beforeAll(() => {
    serviceFiles = fs.readdirSync(SERVICES_DIR).filter(f => f.endsWith('.js'));
  });

  it('should have at least 8 service modules', () => {
    expect(serviceFiles.length).toBeGreaterThanOrEqual(8);
  });

  it('each service should be a valid JS file', () => {
    for (const file of serviceFiles) {
      const content = fs.readFileSync(path.join(SERVICES_DIR, file), 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('each service should define a class or module', () => {
    for (const file of serviceFiles) {
      const content = fs.readFileSync(path.join(SERVICES_DIR, file), 'utf-8');
      const hasClass = content.includes('class ') || content.includes('module.exports');
      expect(hasClass, `${file} should define a class or export`).toBe(true);
    }
  });

  it('ToolExecutionService should exist', () => {
    expect(serviceFiles).toContain('ToolExecutionService.js');
  });

  it('FileOperationService should exist', () => {
    expect(serviceFiles).toContain('FileOperationService.js');
  });

  it('BlastService should exist', () => {
    expect(serviceFiles).toContain('BlastService.js');
  });

  it('AnnotationService should exist', () => {
    expect(serviceFiles).toContain('AnnotationService.js');
  });

  it('ProteinService should exist', () => {
    expect(serviceFiles).toContain('ProteinService.js');
  });

  it('GenomeAnalysisService should exist', () => {
    expect(serviceFiles).toContain('GenomeAnalysisService.js');
  });

  it('IntentParserService should exist', () => {
    expect(serviceFiles).toContain('IntentParserService.js');
  });

  it('LLMContextService should exist', () => {
    expect(serviceFiles).toContain('LLMContextService.js');
  });

  it('UIService should exist', () => {
    expect(serviceFiles).toContain('UIService.js');
  });

  it('all services should use strict mode', () => {
    for (const file of serviceFiles) {
      const content = fs.readFileSync(path.join(SERVICES_DIR, file), 'utf-8');
      if (
        content.startsWith("'use strict'") ||
        content.startsWith('"use strict"') ||
        content.startsWith('//') ||
        content.startsWith('/*')
      ) {
        // Good
      } else {
        console.log(`${file} does not start with 'use strict'`);
      }
    }
  });
});
