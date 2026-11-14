'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

const APP_ROOT = path.join(__dirname, '..', '..');

async function dragBetween(page, from, to, useCenter = false) {
  await from.scrollIntoViewIfNeeded();
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  await page.mouse.move(start.x + (useCenter ? start.width / 2 : 2), start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + (useCenter ? end.width / 2 : end.width - 2), end.y + end.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('workspace scopes text editing and preserves coordinate-based sequence copy', async () => {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'codexomics-selection-'));
  let app;
  try {
    const sequence = 'ACGTAAATGCCATGTA'.repeat(1024);
    const fixture = path.join(profile, 'selection.gbk');
    await fs.writeFile(
      fixture,
      [
        'LOCUS       SELECTION                16384 bp    DNA     linear   UNK 01-JAN-2000',
        'FEATURES             Location/Qualifiers',
        '     gene            2..12',
        '                     /gene="fixture_gene"',
        '                     /locus_tag="fixture_001"',
        'ORIGIN',
        sequence
          .match(/.{1,60}/g)
          .map((line, i) => `        ${i * 60 + 1} ${line}`)
          .join('\n'),
        '//',
        '',
      ].join('\n')
    );
    const bootstrap = path.join(profile, 'bootstrap.cjs');
    await fs.writeFile(
      bootstrap,
      `const { app } = require('electron');
app.setPath('userData', ${JSON.stringify(profile)});
app.setPath('temp', ${JSON.stringify(profile)});
app.setAppPath(${JSON.stringify(APP_ROOT)});
require(${JSON.stringify(path.join(APP_ROOT, 'src/main.js'))});
`
    );
    app = await electron.launch({
      args: [bootstrap, '--no-sandbox', '--disable-gpu', fixture],
      env: { ...process.env, NODE_ENV: 'test', CODEXOMICS_E2E: '1' },
    });

    let view;
    await expect
      .poll(() => {
        view = app.windows().find(page => new URL(page.url()).pathname.endsWith('/renderer/index.html'));
        return Boolean(view);
      })
      .toBe(true);
    await expect.poll(() => view.evaluate(() => window.genomeBrowser?.currentChromosome)).toBe('SELECTION');

    // Use Electron's actual menu callbacks on every platform. Playwright sends DOM
    // key events to WebContentsView, which can bypass native menu accelerators.
    const edit = (label, menuName = 'Search') =>
      app.evaluate(
        ({ Menu, BrowserWindow }, { label, menuName }) => {
          const menu = Menu.getApplicationMenu().items.find(item => item.label.startsWith(menuName));
          const item = menu.submenu.items.find(entry => entry.label === label);
          item.click(item, BrowserWindow.getFocusedWindow(), {});
        },
        { label, menuName }
      );
    const selectedText = () => view.evaluate(() => window.getSelection().toString());
    // Capture the exact text sent to the clipboard without modifying the desktop clipboard.
    await view.evaluate(() => {
      navigator.clipboard.writeText = async text => {
        window.copiedText = text;
      };
    });
    const clipboardText = () => view.evaluate(() => window.copiedText?.trim());

    const search = view.locator('#searchInput');
    await search.fill('fixture_gene');
    await search.evaluate(input => input.setSelectionRange(0, 0));
    await edit('Select All');
    await expect.poll(() => search.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([0, 12]);
    await edit('Copy');
    await expect.poll(clipboardText).toBe('fixture_gene');

    await search.evaluate(input => input.setSelectionRange(0, 0));
    const trackTitle = view.locator('#genomeViewer .track-title').first();
    await dragBetween(view, trackTitle, trackTitle);
    await expect.poll(selectedText).toBe('');
    await edit('Select All');
    await expect.poll(selectedText).toBe('');

    await view.evaluate(() => {
      const genome = window.genomeBrowser;
      genome.populateGeneDetails(genome.currentAnnotations.SELECTION[0]);
      genome.uiManager.revealSidebarPanel('geneDetailsSection');
      genome.showGeneDetailsPanel();
    });
    const locusTag = view
      .locator('#geneDetailsContent .gene-attribute-value')
      .getByText('fixture_001', { exact: true });
    await locusTag.focus();
    await edit('Select All');
    await expect.poll(selectedText).toBe('fixture_001');
    await edit('Copy');
    await expect.poll(clipboardText).toBe('fixture_001');

    await view.evaluate(() => window.genomeBrowser.chatManager.showChatBox());
    const welcome = view.locator('#chatMessages .welcome-hero-text h3');
    await dragBetween(view, welcome, welcome);
    await expect.poll(selectedText).toBe('');
    await view.evaluate(() => {
      window.genomeBrowser.chatManager.displayChatMessage(
        'A copyable reply with **formatted text**.',
        'assistant',
        null,
        'selection-reply'
      );
    });
    const reply = view.locator('#selection-reply p');
    const strong = reply.locator('strong');
    await dragBetween(view, reply, strong);
    await expect.poll(selectedText).toMatch(/^A .+/);
    await view.locator('#selection-reply').focus();
    await expect(view.locator('#selection-reply')).toBeFocused();
    await edit('Select All');
    await expect
      .poll(() =>
        view.evaluate(() => ({
          tag: document.activeElement.id,
          scope: document.activeElement.hasAttribute('data-selectable-text'),
          selection: window.getSelection().toString().trim(),
        }))
      )
      .toEqual({ tag: 'selection-reply', scope: true, selection: 'A copyable reply with formatted text.' });
    await edit('Copy');
    await expect.poll(clipboardText).toBe('A copyable reply with formatted text.');
    await view.evaluate(() => window.genomeBrowser.chatManager.hideChatBox());

    const bottom = view.locator('#sequenceContent');
    const lines = bottom.locator('.sequence-line-group');
    const bases = '.main-strand-row .sequence-bases span[data-position]';
    const from = lines.nth(0).locator(bases).nth(2);
    const to = lines.nth(1).locator(bases).nth(6);
    await expect(to).toBeVisible();
    const start = Number(await from.getAttribute('data-position'));
    const end = Number(await to.getAttribute('data-position'));
    await dragBetween(view, from, to, true);
    await expect
      .poll(() => view.evaluate(() => window.genomeBrowser.currentSequenceSelection))
      .toMatchObject({
        start: start + 1,
        end: end + 1,
        length: end - start + 1,
        source: 'sequence-track',
      });
    await expect.poll(selectedText).toBe('');
    await edit('Copy');
    await expect.poll(clipboardText).toBe(sequence.slice(start, end + 1));

    const renderedSequence = bottom.locator('.virtual-viewport');
    await expect(renderedSequence).toHaveCount(1);
    await bottom.evaluate(panel => {
      panel.scrollTop = panel.scrollHeight;
    });
    await expect(bottom.locator(`${bases}[data-position="${start}"]`)).toHaveCount(0);
    await bottom.evaluate(panel => {
      panel.scrollTop = 0;
    });
    await expect(from).toHaveClass(/sequence-selected/);
    const copyButton = view.locator('#copySequenceHeaderBtn');
    await copyButton.click();
    await expect.poll(clipboardText).toBe(sequence.slice(start, end + 1));

    const complements = { A: 'T', C: 'G', G: 'C', T: 'A' };
    const reverseComplement = sequence
      .slice(start, end + 1)
      .split('')
      .reverse()
      .map(base => complements[base])
      .join('');
    await copyButton.click({ modifiers: ['Shift'] });
    await expect.poll(clipboardText).toBe(reverseComplement);

    await view.evaluate(() => window.settingsCenter.open('blast'));
    const settingsTitle = view.locator('#settingsCenterTitle');
    await dragBetween(view, settingsTitle, settingsTitle);
    await expect.poll(selectedText).toBe('');
    const settingsSearch = view.locator('#settingsCenterSearch');
    await settingsSearch.fill('BLAST');
    await settingsSearch.evaluate(input => input.setSelectionRange(0, 0));
    await edit('Select All');
    await expect.poll(() => settingsSearch.evaluate(input => input.selectionEnd)).toBe(5);
    await view.evaluate(() => window.settingsCenter.close());

    const configOpened = app.waitForEvent('window', page =>
      new URL(page.url()).pathname.endsWith('/blast-config.html')
    );
    await view.evaluate(() => window.ipcRenderer.send('open-blast-config-window'));
    const blastConfig = await configOpened;
    const config = blastConfig.locator('#currentConfig');
    await expect(config).not.toHaveText('Loading current configuration...');
    await config.focus();
    await edit('Select All', 'Edit');
    await expect
      .poll(() =>
        blastConfig.evaluate(() => {
          const selection = window.getSelection();
          const region = document.getElementById('currentConfig');
          return (
            !selection.isCollapsed && region.contains(selection.anchorNode) && region.contains(selection.focusNode)
          );
        })
      )
      .toBe(true);
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
