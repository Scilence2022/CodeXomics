/* global CircosData */

// The source renderer owns the sequences. Circos receives feature geometry
// and requested measurements, with a snapshot ID for subsequent requests.
window.circosGenome = (() => {
  const snapshots = new Map();

  function getSnapshot(id) {
    const browser = window.genomeBrowser;
    const snapshot = snapshots.get(id);
    if (
      !snapshot ||
      snapshot.sequenceSource !== browser?.currentSequence ||
      snapshot.tabId !== browser.tabManager?.activeTabId
    ) {
      throw new Error('The source genome changed. Reload the current genome in Circos.');
    }
    return snapshot;
  }

  function load(id) {
    const browser = window.genomeBrowser;
    const data = CircosData.fromGenome(browser?.currentSequence, browser?.currentAnnotations);
    const wigTracks = Object.entries(browser.currentWIGTracks || {})
      .filter(
        ([, track]) =>
          !track.bigWigFile &&
          data.chromosomes.some(chr => Object.hasOwn(track.data || {}, chr.name) && track.data[chr.name].length)
      )
      .map(([name]) => name);
    snapshots.set(id, {
      sequenceSource: browser.currentSequence,
      sequences: Object.fromEntries(data.chromosomes.map(chr => [chr.name, browser.currentSequence[chr.name]])),
      tabId: browser.tabManager?.activeTabId,
      chromosomes: data.chromosomes,
      gcRequest: 0,
    });
    return { data, wigTracks };
  }

  async function tracks(id, { windowSize, wigName }) {
    const snapshot = getSnapshot(id);
    const unchanged = () => {
      const current = getSnapshot(id);
      return (
        current === snapshot &&
        snapshot.chromosomes.every(chr => snapshot.sequences[chr.name] === current.sequenceSource[chr.name])
      );
    };
    if (!unchanged()) throw new Error('The source genome changed. Reload the current genome in Circos.');
    if (windowSize !== undefined) {
      const request = ++snapshot.gcRequest;
      return CircosData.sequenceTracks(snapshot.sequences, windowSize, () => {
        return snapshot.gcRequest === request && unchanged();
      });
    }
    const signal = window.genomeBrowser.currentWIGTracks;
    if (signal && Object.hasOwn(signal, wigName) && signal[wigName].data) {
      return { wig: CircosData.wigTrack(snapshot.chromosomes, signal[wigName].data) };
    }
    throw new Error('This WIG track is no longer available. Reload the current genome.');
  }

  function navigate(id, { chromosome, start, end }) {
    const snapshot = getSnapshot(id);
    const sequence = Object.hasOwn(snapshot.sequences, chromosome) ? snapshot.sequences[chromosome] : '';
    const length = sequence.length;
    if (!length) throw new Error('The chromosome is unavailable in the source genome.');
    const browser = window.genomeBrowser;
    if (sequence !== browser.currentSequence[chromosome]) {
      throw new Error('The source genome changed. Reload the current genome in Circos.');
    }
    if (start === undefined) {
      browser.selectChromosome(chromosome);
      return { success: true };
    }
    if (start < 0 || start >= end || end > length) throw new Error('The feature is outside the chromosome.');
    return browser.navigationManager.navigateToPosition(chromosome, start + 1, end);
  }

  return { load, tracks, navigate, close: id => snapshots.delete(id) };
})();
