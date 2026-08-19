/**
 * Unit tests for ProjectUtils — the shared pure helpers of the project
 * management module (extracted from ProjectManager/ProjectManagerWindow).
 */
import { describe, it, expect } from 'vitest';
import * as ProjectUtilsModule from '../../src/renderer/modules/ProjectUtils.js';

const ProjectUtils = ProjectUtilsModule.default ?? ProjectUtilsModule;

describe('ProjectUtils', () => {
  describe('getExtension', () => {
    it('returns the lowercase extension with dot', () => {
      expect(ProjectUtils.getExtension('genome.FASTA')).toBe('.fasta');
      expect(ProjectUtils.getExtension('dir/annotation.GBK')).toBe('.gbk');
      expect(ProjectUtils.getExtension('C:\\data\\reads.FQ')).toBe('.fq');
    });

    it('returns empty string for extensionless names and dotfiles', () => {
      expect(ProjectUtils.getExtension('README')).toBe('');
      expect(ProjectUtils.getExtension('.gitignore')).toBe('');
      expect(ProjectUtils.getExtension('')).toBe('');
      expect(ProjectUtils.getExtension(null)).toBe('');
    });
  });

  describe('detectFileType', () => {
    it('detects known bioinformatics extensions', () => {
      expect(ProjectUtils.detectFileType('genome.fa')).toBe('fasta');
      expect(ProjectUtils.detectFileType('genome.fasta')).toBe('fasta');
      expect(ProjectUtils.detectFileType('annotation.gff3')).toBe('gff');
      expect(ProjectUtils.detectFileType('variants.vcf')).toBe('vcf');
      expect(ProjectUtils.detectFileType('reads_R1.fastq')).toBe('fastq');
      expect(ProjectUtils.detectFileType('aligned.bam')).toBe('bam');
      expect(ProjectUtils.detectFileType('track.wig')).toBe('wig');
      expect(ProjectUtils.detectFileType('sequence.gbk')).toBe('genbank');
    });

    it('is case-insensitive', () => {
      expect(ProjectUtils.detectFileType('GENOME.FA')).toBe('fasta');
    });

    it('keeps the historical text/unknown contract', () => {
      expect(ProjectUtils.detectFileType('notes')).toBe('text');
      expect(ProjectUtils.detectFileType('archive.xyz')).toBe('unknown');
      expect(ProjectUtils.detectFileType(null)).toBe('unknown');
      expect(ProjectUtils.detectFileType(42)).toBe('unknown');
    });
  });

  describe('escapeHtml', () => {
    it('escapes markup-significant characters', () => {
      expect(ProjectUtils.escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(ProjectUtils.escapeHtml('a"b\'c&d')).toBe('a&quot;b&#39;c&amp;d');
    });

    it('handles null/undefined', () => {
      expect(ProjectUtils.escapeHtml(null)).toBe('');
      expect(ProjectUtils.escapeHtml(undefined)).toBe('');
    });
  });

  describe('escapeJsString', () => {
    it('escapes single quotes and backslashes', () => {
      expect(ProjectUtils.escapeJsString("it's")).toBe("it\\'s");
      expect(ProjectUtils.escapeJsString('a\\b')).toBe('a\\\\b');
    });

    it('produces attribute-safe inline handler args when combined with escapeHtml', () => {
      const hostile = "');alert(1);//";
      const attr = ProjectUtils.escapeHtml(ProjectUtils.escapeJsString(hostile));
      // Decodes to a valid single-quoted JS string content
      const decoded = attr
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&');
      expect(decoded).toBe("\\');alert(1);//");
      expect(attr).not.toContain("')");
    });
  });

  describe('escapeRegExp', () => {
    it('escapes regex metacharacters', () => {
      const pattern = new RegExp(ProjectUtils.escapeRegExp('file[1].txt'), 'g');
      expect(pattern.test('file[1].txt')).toBe(true);
      expect(pattern.test('filex1ytxt')).toBe(false);
    });
  });

  describe('formatFileSize', () => {
    it('formats common sizes', () => {
      expect(ProjectUtils.formatFileSize(0)).toBe('0 B');
      expect(ProjectUtils.formatFileSize(512)).toBe('512 B');
      expect(ProjectUtils.formatFileSize(1024)).toBe('1 KB');
      expect(ProjectUtils.formatFileSize(1536)).toBe('1.5 KB');
      expect(ProjectUtils.formatFileSize(1024 * 1024)).toBe('1 MB');
    });

    it('clamps the unit index instead of printing "undefined" for TB+ sizes', () => {
      expect(ProjectUtils.formatFileSize(5 * Math.pow(1024, 4))).toBe('5 TB');
      expect(ProjectUtils.formatFileSize(3 * Math.pow(1024, 5))).toBe('3 PB');
      // Beyond PB the index clamps at PB (7 EB → 7*1024 PB)
      expect(ProjectUtils.formatFileSize(7 * Math.pow(1024, 6))).toBe('7168 PB');
    });

    it('guards invalid input', () => {
      expect(ProjectUtils.formatFileSize(NaN)).toBe('0 B');
      expect(ProjectUtils.formatFileSize(-10)).toBe('0 B');
      expect(ProjectUtils.formatFileSize(undefined)).toBe('0 B');
    });
  });

  describe('formatDate', () => {
    it('formats valid dates using the locale format', () => {
      const iso = '2024-05-06T10:00:00.000Z';
      expect(ProjectUtils.formatDate(iso)).toBe(new Date(iso).toLocaleDateString());
    });

    it('renders a placeholder for invalid or empty input', () => {
      expect(ProjectUtils.formatDate('')).toBe('—');
      expect(ProjectUtils.formatDate(null)).toBe('—');
      expect(ProjectUtils.formatDate('not a date')).toBe('—');
    });
  });

  describe('path helpers', () => {
    it('getParentPath handles POSIX and Windows separators', () => {
      expect(ProjectUtils.getParentPath('/a/b/c.txt')).toBe('/a/b');
      expect(ProjectUtils.getParentPath('C:\\data\\proj\\file.txt')).toBe('C:\\data\\proj');
      expect(ProjectUtils.getParentPath('file.txt')).toBe('');
      expect(ProjectUtils.getParentPath('/root.txt')).toBe('/');
      expect(ProjectUtils.getParentPath('/a/b/')).toBe('/a');
      expect(ProjectUtils.getParentPath('')).toBe('');
    });

    it('getBaseName handles POSIX and Windows separators', () => {
      expect(ProjectUtils.getBaseName('/a/b/c.txt')).toBe('c.txt');
      expect(ProjectUtils.getBaseName('C:\\data\\file.txt')).toBe('file.txt');
      expect(ProjectUtils.getBaseName('plain.txt')).toBe('plain.txt');
      expect(ProjectUtils.getBaseName('/a/b/')).toBe('b');
    });

    it('joinPath joins with the existing separator style', () => {
      expect(ProjectUtils.joinPath('/a', 'b', 'c')).toBe('/a/b/c');
      expect(ProjectUtils.joinPath('/a/', '/b/')).toBe('/a/b');
      expect(ProjectUtils.joinPath('C:\\data', 'proj')).toBe('C:\\data\\proj');
      expect(ProjectUtils.joinPath('')).toBe('');
    });
  });

  describe('detectProjectFormat', () => {
    it('detects XML project files by name (case-insensitive)', () => {
      expect(ProjectUtils.detectProjectFormat('MyProject.prj.GAI', '')).toBe('xml');
      expect(ProjectUtils.detectProjectFormat('Project.GAI', '')).toBe('xml');
      expect(ProjectUtils.detectProjectFormat('legacy.xml', '')).toBe('xml');
    });

    it('detects JSON project files by name', () => {
      expect(ProjectUtils.detectProjectFormat('backup.json', '')).toBe('json');
      expect(ProjectUtils.detectProjectFormat('old.genomeproj', '')).toBe('json');
    });

    it('falls back to content sniffing for unknown names', () => {
      expect(ProjectUtils.detectProjectFormat('noext', '<?xml version="1.0"?><GenomeExplorerProject/>')).toBe('xml');
      expect(ProjectUtils.detectProjectFormat('noext', '<GenomeExplorerProject version="1.0"/>')).toBe('xml');
      expect(ProjectUtils.detectProjectFormat('noext', '{"id":"p1"}')).toBe('json');
    });
  });

  describe('findPairedReadName', () => {
    it('finds the R2 mate of an R1 file', () => {
      const names = new Set(['sample_r1.fastq', 'sample_r2.fastq']);
      expect(ProjectUtils.findPairedReadName('sample_R1.fastq', names)).toBe('sample_R2.fastq');
    });

    it('finds the R1 mate of an R2 file', () => {
      const names = new Set(['sample_r1.fastq', 'sample_r2.fastq']);
      expect(ProjectUtils.findPairedReadName('sample_R2.fastq', names)).toBe('sample_R1.fastq');
    });

    it('supports _1/_2 naming', () => {
      const names = new Set(['lane_1.fq', 'lane_2.fq']);
      expect(ProjectUtils.findPairedReadName('lane_1.fq', names)).toBe('lane_2.fq');
    });

    it('returns null when no mate exists', () => {
      const names = new Set(['sample_r1.fastq']);
      expect(ProjectUtils.findPairedReadName('sample_R1.fastq', names)).toBeNull();
      expect(ProjectUtils.findPairedReadName('sample_R1.fastq', null)).toBeNull();
    });
  });

  describe('deepClone', () => {
    it('deep-copies nested structures', () => {
      const original = { files: [{ name: 'a', folder: ['genomes'] }], metadata: { totalFiles: 1 } };
      const copy = ProjectUtils.deepClone(original);
      expect(copy).toEqual(original);
      expect(copy.files).not.toBe(original.files);
      expect(copy.files[0].folder).not.toBe(original.files[0].folder);
      copy.files[0].name = 'changed';
      expect(original.files[0].name).toBe('a');
    });
  });

  describe('generateId', () => {
    it('generates prefixed unique ids without deprecated substr', () => {
      const a = ProjectUtils.generateId('project');
      const b = ProjectUtils.generateId('project');
      expect(a).toMatch(/^project_\d+_[a-z0-9]+$/);
      expect(a).not.toBe(b);
    });
  });

  describe('normalizeProject', () => {
    it('fills in missing containers and metadata for legacy projects', () => {
      const project = { id: 'p1', name: 'Legacy' };
      ProjectUtils.normalizeProject(project);
      expect(project.files).toEqual([]);
      expect(project.folders).toEqual([]);
      expect(project.history).toEqual([]);
      expect(project.settings).toEqual({ fileFilters: [], customAnnotations: [] });
      expect(project.metadata.totalFiles).toBe(0);
      expect(project.metadata.totalSize).toBe(0);
      expect(typeof project.metadata.lastOpened).toBe('string');
    });

    it('computes totals from existing files but preserves existing metadata', () => {
      const project = {
        files: [{ size: 100 }, { size: 50 }],
        metadata: { lastOpened: '2020-01-01T00:00:00.000Z' },
      };
      ProjectUtils.normalizeProject(project);
      expect(project.metadata.totalFiles).toBe(2);
      expect(project.metadata.totalSize).toBe(150);
      expect(project.metadata.lastOpened).toBe('2020-01-01T00:00:00.000Z');
    });

    it('tolerates null/invalid input', () => {
      expect(ProjectUtils.normalizeProject(null)).toBeNull();
    });
  });

  describe('DEFAULT_PROJECT_FOLDERS', () => {
    it('uses canonical lowercase paths (auto-organize depends on this)', () => {
      expect(ProjectUtils.DEFAULT_PROJECT_FOLDERS.length).toBe(5);
      ProjectUtils.DEFAULT_PROJECT_FOLDERS.forEach(folder => {
        expect(folder.path.length).toBe(1);
        expect(folder.path[0]).toBe(folder.path[0].toLowerCase());
      });
    });
  });
});
