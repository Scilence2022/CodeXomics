import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Gene Details annotation note presentation', () => {
  it('separates the formal CDS annotation note from editable curator notes', () => {
    const renderer = fs.readFileSync(path.join(process.cwd(), 'src/renderer/renderer-modular.js'), 'utf8');
    const notesManager = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/GeneNotesManager.js'), 'utf8');

    expect(renderer).toContain('Annotation Note');
    expect(renderer).toContain('CDS /note');
    expect(renderer).toContain("getAllQualifierValues(gene.qualifiers, 'note')");
    expect(renderer).toContain('No formal CDS annotation note has been applied.');
    expect(notesManager).toContain('Curator Notes');
    expect(notesManager).toContain('Add private curator notes about this gene');
  });
});
