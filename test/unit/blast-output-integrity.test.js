import { describe, expect, it } from 'vitest';
import { loadScript } from '../helpers/load-script';
const { exported: BlastManager } = loadScript('src/renderer/modules/BlastManager.js');
const manager = Object.create(BlastManager.prototype);
manager.config = { localDatabases: new Map() };
const params = { sequence: 'ACGT', database: 'nt' };
function row(query = 'ACGT', subject = 'ACAT', length = '4') {
  return [
    'q1',
    's1',
    '75',
    length,
    '1',
    '0',
    '1',
    '4',
    '1',
    '4',
    '1e-5',
    '10',
    'subject',
    query,
    subject,
    '100',
    '100',
  ].join('\t');
}
describe('local BLAST output integrity', () => {
  it('preserves real aligned sequences and computes the matching positions', () => {
    const result = manager.parseBlastOutput(row(), params);
    expect(result.hits[0].alignment).toEqual({ query: 'ACGT', subject: 'ACAT', match: '|| |' });
    expect(result.hits[0].hsps[0].hitSeq).toBe('ACAT');
  });
  it.each([row('ACGT', ''), row('', 'ACGT'), row('ACGT', 'ACG'), row('ACGT', 'ACGT', '5'), 'q1\ts1'])(
    'rejects incomplete output without inventing alignments',
    output => {
      expect(() => manager.parseBlastOutput(output, params)).toThrow(/Incomplete BLAST/);
    }
  );
  it('retains gaps in real protein alignments', () => {
    const result = manager.parseBlastOutput(row('MA-K', 'MLAK'), params);
    expect(result.hits[0].alignment.subject).toBe('MLAK');
    expect(result.hits[0].alignment.match).toBe('|  |');
  });
  it('accepts an empty result as no hits', () => {
    expect(manager.parseBlastOutput('# no hits\n', params).hits).toEqual([]);
  });
});
