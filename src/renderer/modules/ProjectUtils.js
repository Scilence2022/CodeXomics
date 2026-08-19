/**
 * ProjectUtils - Shared pure utility functions for the project management module.
 *
 * This module is intentionally free of DOM/IPC dependencies so it can be unit
 * tested in isolation. In the renderer it is exposed as `window.ProjectUtils`;
 * under Node/Vitest it is exported via `module.exports`.
 */
(function (root, factory) {
  const utils = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = utils;
  }
  if (root) {
    root.ProjectUtils = utils;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /**
   * Canonical folders created for every new project. This is the single source
   * of truth — previously copy-pasted across ProjectManager,
   * ProjectManagerWindow and ProjectXMLHandler.
   */
  const DEFAULT_PROJECT_FOLDERS = [
    { name: 'Genomes', icon: '🧬', path: ['genomes'] },
    { name: 'Annotations', icon: '📋', path: ['annotations'] },
    { name: 'Variants', icon: '🔄', path: ['variants'] },
    { name: 'Reads', icon: '📊', path: ['reads'] },
    { name: 'Analysis', icon: '📈', path: ['analysis'] },
  ];

  /**
   * File type registry: display icon/color plus the recognized extensions
   * (lowercase, leading dot). The `extensions` arrays are required by
   * `detectFileType` — omitting them used to silently break type detection.
   */
  const FILE_TYPES = {
    fasta: { icon: 'FA', color: '#28a745', extensions: ['.fasta', '.fa', '.fas', '.fna', '.ffn'] },
    genbank: { icon: 'GB', color: '#17a2b8', extensions: ['.gb', '.gbk', '.gbff', '.genbank'] },
    gff: { icon: 'GFF', color: '#007bff', extensions: ['.gff', '.gff3', '.gtf'] },
    bed: { icon: 'BED', color: '#fd7e14', extensions: ['.bed'] },
    vcf: { icon: 'VCF', color: '#6f42c1', extensions: ['.vcf', '.bcf'] },
    sam: { icon: 'SAM', color: '#e83e8c', extensions: ['.sam'] },
    bam: { icon: 'BAM', color: '#dc3545', extensions: ['.bam', '.cram'] },
    fastq: { icon: 'FQ', color: '#20c997', extensions: ['.fastq', '.fq'] },
    wig: { icon: 'WIG', color: '#6610f2', extensions: ['.wig', '.bw', '.bigwig', '.bedgraph'] },
    txt: { icon: 'TXT', color: '#6c757d', extensions: ['.txt', '.md'] },
    csv: { icon: 'CSV', color: '#198754', extensions: ['.csv'] },
    tsv: { icon: 'TSV', color: '#198754', extensions: ['.tsv', '.tab'] },
    json: { icon: 'JS', color: '#ffc107', extensions: ['.json'] },
    xml: { icon: 'XML', color: '#0d6efd', extensions: ['.xml'] },
    html: { icon: 'HTM', color: '#fd7e14', extensions: ['.html', '.htm'] },
    pdf: { icon: 'PDF', color: '#dc3545', extensions: ['.pdf'] },
    log: { icon: 'LOG', color: '#6c757d', extensions: ['.log'] },
  };

  /** Paired-end read token pairs, forward token first. */
  const PAIRED_READ_TOKENS = [
    ['_R1', '_R2'],
    ['_r1', '_r2'],
    ['_1', '_2'],
  ];

  /**
   * Extract the lowercase extension (with leading dot) from a file name.
   * Returns '' for extensionless names and dotfiles (`.gitignore`).
   */
  function getExtension(fileName) {
    if (!fileName || typeof fileName !== 'string') return '';
    const base = getBaseName(fileName);
    const dot = base.lastIndexOf('.');
    if (dot <= 0) return '';
    return base.slice(dot).toLowerCase();
  }

  /**
   * Detect the file type key from a file name.
   * Contract (kept from the original implementation): names without an
   * extension return 'text', unrecognized extensions return 'unknown'.
   */
  function detectFileType(fileName) {
    if (!fileName || typeof fileName !== 'string') {
      return 'unknown';
    }
    const ext = getExtension(fileName);
    if (!ext) {
      return 'text';
    }
    for (const [type, config] of Object.entries(FILE_TYPES)) {
      if (config.extensions.includes(ext)) {
        return type;
      }
    }
    return 'unknown';
  }

  /** Escape a value for safe interpolation into HTML markup/attributes. */
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, ch => {
      switch (ch) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return ch;
      }
    });
  }

  /** Escape a string so it can be embedded in a RegExp literally. */
  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Escape a value for use inside a single-quoted JavaScript string literal.
   * Needed when building inline event-handler attributes; combine with
   * escapeHtml for the attribute layer.
   */
  function escapeJsString(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  }

  /**
   * Format a byte count. Guards against non-numeric/negative input and clamps
   * the unit index so TB+ sizes no longer render as "12.3 undefined".
   */
  function formatFileSize(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), sizes.length - 1);
    return Math.round((value / Math.pow(1024, i)) * 10) / 10 + ' ' + sizes[i];
  }

  /** Format a date-ish value; invalid/empty input renders as '—'. */
  function formatDate(dateInput) {
    if (!dateInput) return '—';
    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString();
  }

  /**
   * Return the parent directory of a path, accepting both '/' and '\'
   * separators (renderer code cannot rely on Node's path module).
   */
  function getParentPath(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';
    const trimmed = filePath.replace(/[/\\]+$/, '');
    const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
    if (idx < 0) return '';
    if (idx === 0) return trimmed.slice(0, 1); // filesystem root '/'
    return trimmed.slice(0, idx);
  }

  /** Return the final component of a path, separator-agnostic. */
  function getBaseName(filePath) {
    if (!filePath || typeof filePath !== 'string') return '';
    const trimmed = filePath.replace(/[/\\]+$/, '');
    const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
    return idx < 0 ? trimmed : trimmed.slice(idx + 1);
  }

  /**
   * Join path segments with the separator already used by the first absolute
   * segment ('\' when present, otherwise '/'). Collapses duplicate separators
   * at the joins and strips meaningless trailing separators.
   */
  function joinPath(...segments) {
    const parts = segments.filter(p => p !== null && p !== undefined && p !== '');
    if (parts.length === 0) return '';

    const separator = String(parts[0]).indexOf('\\') !== -1 ? '\\' : '/';
    const rootMatch = String(parts[0]).match(/^([/\\]+)/);
    const first = String(parts[0]).replace(/[/\\]+$/, '') || (rootMatch ? rootMatch[1][0] : '');
    const rest = parts.slice(1).map(p => String(p).replace(/^[/\\]+|[/\\]+$/g, ''));

    return [first, ...rest]
      .filter(p => p !== '')
      .join(separator)
      .replace(/[/\\]{2,}/g, separator);
  }

  /**
   * Detect the on-disk project format from the file name and/or content.
   * Unified replacement for the two divergent sniffers that lived in
   * ProjectManager (content-based) and ProjectManagerWindow (name-based).
   * Returns 'xml' or 'json'.
   */
  function detectProjectFormat(fileName, content) {
    const name = (fileName || '').toLowerCase();
    if (name.endsWith('.gai') || name.endsWith('.xml')) return 'xml';
    if (name.endsWith('.json') || name.endsWith('.genomeproj')) return 'json';
    if (typeof content === 'string') {
      const trimmed = content.trimStart();
      if (trimmed.startsWith('<?xml') || content.includes('<GenomeExplorerProject')) return 'xml';
      if (trimmed.startsWith('{')) return 'json';
    }
    // Default to the current canonical format.
    return 'xml';
  }

  /**
   * Find the mate file of a paired-end read file. The candidate mate name is
   * derived by literal token replacement (no dynamic RegExp construction,
   * which previously escaped the alternation into a literal and never
   * matched) and checked against the provided set of lowercase names.
   *
   * @param {string} fileName name of the read file (e.g. "sample_R1.fastq")
   * @param {Set<string>} lowerCaseNames lowercase names of all candidate files
   * @returns {string|null} the matching mate name (original casing) or null
   */
  function findPairedReadName(fileName, lowerCaseNames) {
    if (!fileName || !(lowerCaseNames instanceof Set)) return null;
    for (const [forward, reverse] of PAIRED_READ_TOKENS) {
      let candidate = null;
      if (fileName.includes(forward)) {
        candidate = fileName.replace(forward, reverse);
      } else if (fileName.includes(reverse)) {
        candidate = fileName.replace(reverse, forward);
      }
      if (candidate && candidate !== fileName && lowerCaseNames.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
    return null;
  }

  /** Deep clone with structuredClone and a JSON fallback. */
  function deepClone(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  /** Generate a collision-resistant id (replaces deprecated `substr` usage). */
  function generateId(prefix) {
    return `${prefix || 'id'}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Normalize a freshly loaded/restored project object so downstream code can
   * rely on the presence of the standard containers and metadata fields.
   * Older JSON project files frequently lack `metadata`, `settings`, etc.
   */
  function normalizeProject(project) {
    if (!project || typeof project !== 'object') return project;
    if (!Array.isArray(project.files)) project.files = [];
    if (!Array.isArray(project.folders)) project.folders = [];
    if (!Array.isArray(project.history)) project.history = [];
    if (!project.settings || typeof project.settings !== 'object') {
      project.settings = { fileFilters: [], customAnnotations: [] };
    }
    if (!project.metadata || typeof project.metadata !== 'object') {
      project.metadata = {};
    }
    if (typeof project.metadata.totalFiles !== 'number') project.metadata.totalFiles = project.files.length;
    if (typeof project.metadata.totalSize !== 'number') {
      project.metadata.totalSize = project.files.reduce((sum, f) => sum + (Number(f && f.size) || 0), 0);
    }
    if (!project.metadata.lastOpened) project.metadata.lastOpened = new Date().toISOString();
    return project;
  }

  return {
    DEFAULT_PROJECT_FOLDERS,
    FILE_TYPES,
    PAIRED_READ_TOKENS,
    getExtension,
    detectFileType,
    escapeHtml,
    escapeRegExp,
    escapeJsString,
    formatFileSize,
    formatDate,
    getParentPath,
    getBaseName,
    joinPath,
    detectProjectFormat,
    findPairedReadName,
    deepClone,
    generateId,
    normalizeProject,
  };
});
