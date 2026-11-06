(function () {
  'use strict';

  function getGenomeFileFormat(filePath) {
    if (typeof filePath !== 'string') return null;
    if (/\.(?:fa|fasta|fas|fna)(?:\.gz)?$/i.test(filePath)) return 'fasta';
    if (/\.(?:gb|gbk|gbff|genbank)(?:\.gz)?$/i.test(filePath)) return 'genbank';
    return null;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getGenomeFileFormat };
  } else {
    globalThis.genomeFileFormats = { getGenomeFileFormat };
  }
})();
