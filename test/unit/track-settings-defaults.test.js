import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import SequenceUtils from '../../src/renderer/modules/SequenceUtils.js';
import TrackRenderer from '../../src/renderer/modules/TrackRenderer.js';

const CM_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');

describe('Track Settings Defaults', () => {
  describe('SequenceUtils Defaults', () => {
    it('should default showStartMarkers to false and arrowSize to 12', () => {
      const mockGenomeBrowser = {
        trackRenderer: null,
      };
      
      const sequenceUtils = new SequenceUtils(mockGenomeBrowser);
      const settings = sequenceUtils.getSequenceTrackSettings();
      
      expect(settings.showStartMarkers).toBe(false);
      expect(settings.arrowSize).toBe(12);
    });
  });

  describe('TrackRenderer Defaults', () => {
    it('should define showStartMarkers as false and arrowSize as 12 in sequence track defaults', () => {
      const mockGenomeBrowser = {};
      const trackRenderer = new TrackRenderer(mockGenomeBrowser);
      
      const defaults = trackRenderer._getDefaultTrackSettings('sequence');
      expect(defaults.showStartMarkers).toBe(false);
      expect(defaults.arrowSize).toBe(12);
    });
  });

  describe('ChatManager Schema Defaults', () => {
    it('should define showStartMarkers default as false and arrowSize default as 12 in sequence track schema', () => {
      const content = fs.readFileSync(CM_PATH, 'utf-8');
      
      // Check that the schema specifies the updated defaults
      expect(content).toContain("showStartMarkers: { type: 'boolean', default: false");
      expect(content).toContain("arrowSize: { type: 'number', min: 3, max: 12, default: 12");
    });
  });
});
