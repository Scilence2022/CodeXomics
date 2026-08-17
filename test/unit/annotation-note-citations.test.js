import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

// renderer-modular.js is a classic script with no exports, so the citation helpers are
// lifted out of the class body by line range (Prettier keeps the indentation stable).
const rendererSource = fs.readFileSync(path.join(process.cwd(), 'src/renderer/renderer-modular.js'), 'utf8');
const rendererLines = rendererSource.split('\n');

function extractMethod(name) {
  const start = rendererLines.findIndex(line => line.startsWith(`  ${name}(`));
  expect(start, `method ${name} not found`).toBeGreaterThan(-1);
  const end = rendererLines.findIndex((line, index) => index > start && line === '  }');
  expect(end, `method ${name} has no closing brace`).toBeGreaterThan(start);
  return rendererLines.slice(start, end + 1).join('\n');
}

function createRenderer() {
  const body = ['processUnifiedCitations', 'addUnifiedCitation', 'getCitationUrl', 'enhanceGeneAttributeWithLinks']
    .map(extractMethod)
    .join('\n');
  const Harness = vm.runInNewContext(`(class CitationHarness {
    constructor() { this.citationCollector = new Map(); this.citationCounter = 0; }
    ${body}
  })`);
  const harness = new Harness();
  return {
    harness,
    render: value => harness.processUnifiedCitations(harness.enhanceGeneAttributeWithLinks(value)),
  };
}

describe('Genome annotation note citation rendering', () => {
  it('consumes the whole |CITS: [PMID]| marker instead of leaving the pipes behind', () => {
    const { render } = createRenderer();
    const html = render('acquired by horizontal gene transfer |CITS: [39501255]| and may be a pseudogene.');

    expect(html).not.toContain('|CITS:');
    expect(html).not.toContain('|');
    expect(html).toContain('https://pubmed.ncbi.nlm.nih.gov/39501255/');
    expect(html).toContain('<sup>1</sup>');
  });

  it('numbers every PMID in a multi-id marker and reuses numbers across markers', () => {
    const { harness, render } = createRenderer();
    const html = render('first |CITS: 20974832 21876789| second |CITS: [20974832]|');

    expect(html).not.toContain('|CITS:');
    expect(html).toContain('<sup>1</sup>');
    expect(html).toContain('<sup>2</sup>');
    expect(harness.citationCollector.size).toBe(2);
  });

  it('does not fabricate a PubMed link for short reference numbers', () => {
    const { harness, render } = createRenderer();
    const html = render('already resolved elsewhere |CITS: 3|');

    expect(html).toContain('<sup class="cits-ref">3</sup>');
    expect(html).not.toContain('pubmed.ncbi.nlm.nih.gov/3');
    expect(harness.citationCollector.size).toBe(0);
  });

  it('renders inline italics from the note but keeps dangerous markup escaped', () => {
    const { render } = createRenderer();
    const html = render('The <i>eaeH</i> gene of <em>E. coli</em>. <script>alert(1)</script> <img src=x onerror=y>');

    expect(html).toContain('<i>eaeH</i>');
    expect(html).toContain('<em>E. coli</em>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });
});
