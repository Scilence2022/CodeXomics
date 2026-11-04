import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const PrimerLibraryUI = require(path.join(process.cwd(), 'src/renderer/modules/PrimerLibraryUI.js'));

describe('PrimerLibraryUI locate window', () => {
  const FLANK = PrimerLibraryUI.LOCATE_MIN_FLANK_BP;

  it('pads a short primer site with flanking sequence on both sides', () => {
    const win = PrimerLibraryUI.siteViewWindow(1001, 1020, 100000);
    expect(win).toEqual({ start: 1001 - FLANK, end: 1020 + FLANK });
  });

  it('scales the flank with the site length for long sites', () => {
    const win = PrimerLibraryUI.siteViewWindow(5001, 5300, 100000);
    expect(win).toEqual({ start: 5001 - 300, end: 5300 + 300 });
  });

  it('shifts the window right at the chromosome start without shrinking it', () => {
    const win = PrimerLibraryUI.siteViewWindow(10, 29, 100000);
    expect(win.start).toBe(1);
    expect(win.end - win.start).toBe(29 - 10 + 2 * FLANK);
  });

  it('shifts the window left at the chromosome end', () => {
    const win = PrimerLibraryUI.siteViewWindow(99981, 100000, 100000);
    expect(win.end).toBe(100000);
    expect(win.end - win.start).toBe(100000 - 99981 + 2 * FLANK);
  });

  it('clamps to the whole chromosome when it is shorter than the window', () => {
    expect(PrimerLibraryUI.siteViewWindow(50, 69, 150)).toEqual({ start: 1, end: 150 });
  });

  it('navigates to the padded window, resolving the chromosome name for its length', () => {
    const navigateToPosition = vi.fn();
    const ui = Object.create(PrimerLibraryUI.prototype);
    ui.gb = {
      currentSequence: { 'NC_000913.3': { length: 4641652 } },
      navigationManager: {
        navigateToPosition,
        resolveChromosomeName: () => ({ name: 'NC_000913.3', matchedBy: 'accession' }),
      },
    };
    ui._navigateToSite('NC_000913', 2000, 2019);
    expect(navigateToPosition).toHaveBeenCalledWith('NC_000913', 2000 - FLANK, 2019 + FLANK);
  });
});
