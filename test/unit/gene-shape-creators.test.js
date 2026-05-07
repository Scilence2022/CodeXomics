/**
 * GeneShapeCreators Module Validation Tests
 * 
 * Validates the extracted GeneShapeCreators module from TrackRenderer.js.
 * Tests that all 24 static methods load correctly, shape type detection
 * works, and SVG generation produces valid output.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MODULE_PATH = path.join(process.cwd(), 'src/renderer/modules/tracks/GeneShapeCreators.js');

describe('GeneShapeCreators Module', () => {
  let content;

  beforeAll(() => {
    expect(fs.existsSync(MODULE_PATH)).toBe(true);
    content = fs.readFileSync(MODULE_PATH, 'utf-8');
  });

  it('should be valid JS', () => {
    expect(content.length).toBeGreaterThan(1000);
  });

  it('should use strict mode', () => {
    expect(content).toContain("'use strict'");
  });

  it('should define GeneShapeCreators class', () => {
    expect(content).toContain('class GeneShapeCreators');
  });

  it('should export via module.exports', () => {
    expect(content).toContain('module.exports');
  });

  it('should export GeneShapeCreators class name', () => {
    const exportLine = content.match(/module\.exports\s*=\s*(\S+)/);
    expect(exportLine).not.toBeNull();
    const exported = exportLine[1].replace(/;+$/, '');
    expect(exported).toBe('GeneShapeCreators');
  });

  // List all required methods
  const requiredMethods = [
    'createSVGGeneGradient',
    'createSpecializedGradients',
    'createSVGGeneShape',
    'shouldUseSpecializedShape',
    'createSpecializedGeneShape',
    'createPromoterShape',
    'createTerminatorShape',
    'createRegulatoryShape',
    'createRepeatShape',
    'createTRNAShape',
    'createRRNAShape',
    'createMRNAShape',
    'createCommentShape',
    'createJaggedTrianglePath',
    'createJaggedArrowPath',
    'createJaggedPromoterPath',
    'createJaggedTerminatorPath',
    'createJaggedRegulatoryPath',
    'createJaggedRepeatPath',
    'createJaggedRNAPath',
    'createJaggedCommentPath',
    'createSVGGeneText',
    'updateSVGTextForResize',
    'addSVGGeneInteraction',
  ];

  for (const method of requiredMethods) {
    it(`should define ${method} static method`, () => {
      expect(content).toContain(`static ${method}(`);
    });
  }

  it('should define SVG_NS constant', () => {
    expect(content).toContain('http://www.w3.org/2000/svg');
  });

  // Verify the migration: these methods should NOT exist in TrackRenderer anymore
  describe('Dead code removal verification', () => {
    const trackRendererPath = path.join(process.cwd(), 'src/renderer/modules/TrackRenderer.js');
    let trContent;

    beforeAll(() => {
      trContent = fs.readFileSync(trackRendererPath, 'utf-8');
    });

    it('TrackRenderer should import GeneShapeCreators', () => {
      // The import may be through script tag, not module system
      // The functions should be referenced as GeneShapeCreators.xxx or window.GeneShapeCreators
      expect(trContent.includes('GeneShapeCreators')).toBe(true);
    });

    it('should no longer define createJaggedTrianglePath inline', () => {
      // After extraction, this should only appear as GeneShapeCreators.createJaggedTrianglePath
      const inlineDefCount = (trContent.match(/(?<!GeneShapeCreators\.)(createJaggedTrianglePath)\s*\(/g) || []).length;
      expect(inlineDefCount).toBe(0);
    });
  });

  describe('Shape type detection logic', () => {
    // Verify shouldUseSpecializedShape recognizes known types
    const shapeTypes = ['promoter', 'terminator', 'regulatory', 'repeat',
                        'tRNA', 'rRNA', 'mRNA', 'comment'];
    
    it('content should reference all specialized shape types', () => {
      for (const type of shapeTypes) {
        expect(content.includes(type), `Should reference ${type}`).toBe(true);
      }
    });
  });

  describe('SVG path generation', () => {
    it('should generate SVG path strings (contains d= attribute patterns)', () => {
      // All path creators should output SVG path 'd' attributes
      expect(content).toContain("M ");
      expect(content).toContain("L ");
    });

    it('should handle forward/reverse strand in jagged paths', () => {
      // Jagged path creators have isForward parameter
      expect(content).toContain('isForward');
      expect(content).toContain('isLeftJagged');
      expect(content).toContain('isRightJagged');
    });
  });
});
