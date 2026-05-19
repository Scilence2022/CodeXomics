import { describe, it, expect } from 'vitest';
import MicrobeGenomicsFunctions from '../../src/renderer/modules/MicrobeGenomicsFunctions.js';
import SequenceTools from '../../src/mcp-tools/sequence/SequenceTools.js';

describe('Molecular Weight Calculation Tests', () => {
  const dnaSeq = 'ATGCGCTATCG'; // A:3, T:3, G:3, C:2
  const rnaSeq = 'AUGCGCUAUCG'; // A:3, U:3, G:3, C:2
  const proteinSeq = 'MSKGPAVGI';   // M, S, K, G, P, A, V, G, I

  describe('MicrobeGenomicsFunctions.calculateMolecularWeight', () => {
    it('should return 0 for empty or invalid input', () => {
      expect(MicrobeGenomicsFunctions.calculateMolecularWeight('')).toBe(0);
      expect(MicrobeGenomicsFunctions.calculateMolecularWeight(null)).toBe(0);
      expect(MicrobeGenomicsFunctions.calculateMolecularWeight(undefined)).toBe(0);
      expect(MicrobeGenomicsFunctions.calculateMolecularWeight(123)).toBe(0);
    });

    it('should calculate DNA molecular weight correctly (auto-detect)', () => {
      // 2*331.2 (A) + 3*322.2 (T) + 3*347.2 (G) + 3*307.2 (C) = 3592.2 Da
      // Subtract water molecules: 3592.2 - (11 - 1) * 18.01 = 3412.1 Da
      const mw = MicrobeGenomicsFunctions.calculateMolecularWeight(dnaSeq, 'auto');
      expect(mw).toBeCloseTo(3412.1, 1);
    });

    it('should calculate DNA molecular weight correctly (explicit dna type)', () => {
      const mw = MicrobeGenomicsFunctions.calculateMolecularWeight(dnaSeq, 'dna');
      expect(mw).toBeCloseTo(3412.1, 1);
    });

    it('should calculate RNA molecular weight correctly (explicit dna/rna type)', () => {
      // RNA has U (308.2) instead of T (322.2)
      // 2*331.2 (A) + 3*308.2 (U) + 3*347.2 (G) + 3*307.2 (C) = 3550.2 Da
      // Subtract water molecules: 3550.2 - (11 - 1) * 18.01 = 3370.1 Da
      const mw = MicrobeGenomicsFunctions.calculateMolecularWeight(rnaSeq, 'dna');
      expect(mw).toBeCloseTo(3370.1, 1);
    });

    it('should calculate Protein molecular weight correctly (auto-detect)', () => {
      // MSKGPAVGI: M:131.2, S:87.08, K:128.17, G:57.05, P:97.12, A:71.08, V:99.13, G:57.05, I:113.16 -> sum = 841.04 Da
      // Add terminal water molecule: 841.04 + 18.02 = 859.06 Da
      const mw = MicrobeGenomicsFunctions.calculateMolecularWeight(proteinSeq, 'auto');
      expect(mw).toBeCloseTo(859.06, 1);
    });

    it('should calculate Protein molecular weight correctly (explicit protein type)', () => {
      const mw = MicrobeGenomicsFunctions.calculateMolecularWeight(proteinSeq, 'protein');
      expect(mw).toBeCloseTo(859.06, 1);
    });
  });

  describe('SequenceTools.calculateMolecularWeight (MCP / Server-Side)', () => {
    const seqTools = new SequenceTools();

    it('should calculate DNA molecular weight correctly', () => {
      const mw = seqTools.calculateMolecularWeight(dnaSeq, 'dna');
      expect(mw).toBeCloseTo(3412.1, 1);
    });

    it('should calculate Protein molecular weight correctly', () => {
      const mw = seqTools.calculateMolecularWeight(proteinSeq, 'protein');
      expect(mw).toBeCloseTo(859.06, 1);
    });

    it('should auto-detect protein sequences', () => {
      const mw = seqTools.calculateMolecularWeight(proteinSeq, 'auto');
      expect(mw).toBeCloseTo(859.06, 1);
    });
  });
});
