import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Gene Details annotation note presentation', () => {
  it('places the genome annotation note in General and keeps User Notes separate', () => {
    const renderer = fs.readFileSync(path.join(process.cwd(), 'src/renderer/renderer-modular.js'), 'utf8');
    const notesManager = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/GeneNotesManager.js'), 'utf8');
    const index = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf8');

    expect(renderer).toContain('Genome Annotation Note');
    expect(renderer).toContain('GenBank /note');
    expect(renderer).toContain("getAllQualifierValues(gene.qualifiers, 'note')");
    expect(renderer).toContain("if (normalizedKey === 'note') return;");
    expect(renderer).toContain('generalAttributesHtml + annotationNoteHtml');
    expect(renderer).toContain("{ id: 'user-notes', label: 'User Notes', content: userNotesTabHtml }");
    expect(renderer).toContain("activeTab?.dataset.tab === 'user-notes'");
    expect(renderer).not.toContain("{ id: 'notes', label: 'Notes'");
    expect(notesManager).toContain('User Notes');
    expect(notesManager).toContain('They do not change the genome annotation');
    expect(notesManager).toContain('Add your own notes about this gene');
    expect(index).toContain('Genome Annotation Note (GenBank /note)');
  });
});
