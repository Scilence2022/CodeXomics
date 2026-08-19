/**
 * Unit tests for ProjectXMLHandler — serialization round-trip integrity of the
 * .prj.GAI / Project.GAI XML project format.
 */
import { describe, it, expect } from 'vitest';
import * as ProjectUtilsModule from '../../src/renderer/modules/ProjectUtils.js';
import * as HandlerModule from '../../src/renderer/modules/ProjectXMLHandler.js';

const ProjectUtils = ProjectUtilsModule.default ?? ProjectUtilsModule;
const ProjectXMLHandler = HandlerModule.default ?? HandlerModule;

// Make ProjectUtils visible to the handler's optional integration
if (typeof window !== 'undefined' && !window.ProjectUtils) {
  window.ProjectUtils = ProjectUtils;
}

function buildSampleProject() {
  return {
    id: 'project_1',
    name: 'Test & <Project> "quoted"',
    description: "It's a test project",
    location: '/home/user/Documents/CodeXomics Projects',
    dataFolderPath: '/home/user/Documents/CodeXomics Projects/Test',
    created: '2024-01-01T00:00:00.000Z',
    modified: '2024-01-02T00:00:00.000Z',
    files: [
      {
        id: 'file_1',
        name: 'genome & annotations.fa',
        path: 'genomes/genome & annotations.fa',
        absolutePath: '/home/user/Documents/CodeXomics Projects/Test/genomes/genome & annotations.fa',
        type: 'fasta',
        size: 2048,
        added: '2024-01-01T01:00:00.000Z',
        modified: '2024-01-01T02:00:00.000Z',
        folder: ['genomes'],
        metadata: { source: 'ncbi', stats: { contigs: 3 } },
        tags: ['reference', 'e.coli'],
      },
      {
        id: 'file_2',
        name: 'genes.gff',
        path: 'annotations/genes.gff',
        type: 'gff',
        size: 0,
        added: '2024-01-01T03:00:00.000Z',
        modified: '',
        folder: [],
      },
    ],
    folders: [
      { name: 'Genomes', icon: '🧬', path: ['genomes'] },
      {
        name: 'Custom & Deep',
        icon: '📁',
        path: ['genomes', 'custom deep'],
        custom: true,
        parent: ['genomes'],
        description: 'A <user-created> subfolder',
      },
    ],
    settings: {
      fileFilters: [{ type: 'extension', value: '.tmp' }],
      customAnnotations: [{ key: 'owner', value: 'lab & co' }],
    },
    metadata: {
      totalFiles: 2,
      totalSize: 2048,
      lastOpened: '2024-01-03T00:00:00.000Z',
      fileTypeStats: { fasta: 1, gff: 1 },
    },
    history: [
      {
        timestamp: '2024-01-01T00:00:00.000Z',
        action: 'created',
        description: 'Project created',
      },
    ],
  };
}

describe('ProjectXMLHandler', () => {
  const handler = new ProjectXMLHandler();

  describe('round-trip', () => {
    it('serializes and parses back a full project without data loss', () => {
      const project = buildSampleProject();
      const xml = handler.projectToXML(project);
      const parsed = handler.xmlToProject(xml);

      expect(parsed.id).toBe(project.id);
      expect(parsed.name).toBe(project.name);
      expect(parsed.description).toBe(project.description);
      expect(parsed.location).toBe(project.location);
      expect(parsed.dataFolderPath).toBe(project.dataFolderPath);
      expect(parsed.created).toBe(project.created);
      expect(parsed.modified).toBe(project.modified);

      // Files
      expect(parsed.files.length).toBe(2);
      const f1 = parsed.files.find(f => f.id === 'file_1');
      expect(f1.name).toBe('genome & annotations.fa');
      expect(f1.path).toBe('genomes/genome & annotations.fa');
      expect(f1.absolutePath).toBe(project.files[0].absolutePath);
      expect(f1.type).toBe('fasta');
      expect(f1.size).toBe(2048);
      expect(f1.folder).toEqual(['genomes']);
      expect(f1.metadata.source).toBe('ncbi');
      expect(f1.metadata.stats).toEqual({ contigs: 3 });
      expect(f1.tags).toEqual(['reference', 'e.coli']);

      const f2 = parsed.files.find(f => f.id === 'file_2');
      expect(f2.size).toBe(0);
      expect(f2.folder).toEqual([]);

      // Folders (including the custom-folder attributes added in the
      // round-trip completeness fix)
      expect(parsed.folders.length).toBe(2);
      const custom = parsed.folders.find(f => f.name === 'Custom & Deep');
      expect(custom.custom).toBe(true);
      expect(custom.parent).toEqual(['genomes']);
      expect(custom.description).toBe('A <user-created> subfolder');

      // Settings
      expect(parsed.settings.fileFilters).toEqual([{ type: 'extension', value: '.tmp' }]);
      expect(parsed.settings.customAnnotations).toEqual([{ key: 'owner', value: 'lab & co' }]);

      // Metadata
      expect(parsed.metadata.totalFiles).toBe(2);
      expect(parsed.metadata.totalSize).toBe(2048);
      expect(parsed.metadata.fileTypeStats).toEqual({ fasta: 1, gff: 1 });

      // History
      expect(parsed.history).toEqual([
        { timestamp: '2024-01-01T00:00:00.000Z', action: 'created', description: 'Project created' },
      ]);
    });

    it('escapes special XML characters through the DOM serializer', () => {
      const project = buildSampleProject();
      const xml = handler.projectToXML(project);
      expect(xml).not.toContain('<Project> "quoted"'); // raw text must not appear unescaped
      expect(handler.xmlToProject(xml).name).toBe(project.name);
    });
  });

  describe('backward compatibility', () => {
    it('parses an old-format file without the newer optional fields', () => {
      const oldXml = `<?xml version="1.0" encoding="UTF-8"?>
<GenomeExplorerProject xmlns="http://genomeexplorer.org/project/1.0" version="1.0" created="2023-01-01T00:00:00.000Z">
  <ProjectInfo>
    <ID>legacy_1</ID>
    <Name>Legacy Project</Name>
    <Description>old format</Description>
    <Location>/data</Location>
    <Created>2023-01-01T00:00:00.000Z</Created>
    <Modified>2023-01-01T00:00:00.000Z</Modified>
  </ProjectInfo>
  <Settings/>
  <Folders>
    <Folder>
      <Name>Genomes</Name>
      <Icon>🧬</Icon>
      <Path>
        <Segment>genomes</Segment>
      </Path>
    </Folder>
  </Folders>
  <Files>
    <File>
      <ID>f1</ID>
      <Name>a.fa</Name>
      <Path>a.fa</Path>
      <Type>fasta</Type>
      <Size>10</Size>
      <Added>2023-01-01T00:00:00.000Z</Added>
      <Modified/>
    </File>
  </Files>
  <ProjectMetadata>
    <TotalFiles>1</TotalFiles>
    <TotalSize>10</TotalSize>
    <LastOpened>2023-01-01T00:00:00.000Z</LastOpened>
  </ProjectMetadata>
  <History/>
</GenomeExplorerProject>`;

      const parsed = handler.xmlToProject(oldXml);
      expect(parsed.id).toBe('legacy_1');
      expect(parsed.dataFolderPath).toBeUndefined();
      expect(parsed.files[0].absolutePath).toBeUndefined();
      expect(parsed.folders[0].custom).toBeUndefined();
      expect(parsed.metadata.totalFiles).toBe(1);
    });

    it('warns but parses files with an unknown format version', () => {
      const project = buildSampleProject();
      const xml = handler.projectToXML(project).replace('version="1.0"', 'version="2.0"');
      const parsed = handler.xmlToProject(xml);
      expect(parsed.id).toBe(project.id);
    });
  });

  describe('validation and errors', () => {
    it('validateProjectXML accepts a valid document', () => {
      const xml = handler.projectToXML(buildSampleProject());
      const result = handler.validateProjectXML(xml);
      expect(result.valid).toBe(true);
      expect(result.project.id).toBe('project_1');
    });

    it('validateProjectXML rejects documents without id/name', () => {
      const project = buildSampleProject();
      delete project.name;
      const xml = handler.projectToXML(project);
      expect(handler.validateProjectXML(xml).valid).toBe(false);
    });

    it('validateProjectXML rejects duplicate file ids', () => {
      const project = buildSampleProject();
      project.files.push({ ...project.files[0] }); // same id 'file_1'
      const xml = handler.projectToXML(project);
      const result = handler.validateProjectXML(xml);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Duplicate file ID');
    });

    it('xmlToProject throws on malformed XML', () => {
      expect(() => handler.xmlToProject('<GenomeExplorerProject><unclosed>')).toThrow();
    });

    it('xmlToProject throws on a wrong root element', () => {
      expect(() => handler.xmlToProject('<NotAProject/>')).toThrow();
    });
  });

  describe('generateProjectTemplate', () => {
    it('creates a parseable project with the canonical default folders', () => {
      const xml = handler.generateProjectTemplate('My Project', 'demo');
      const parsed = handler.xmlToProject(xml);
      expect(parsed.name).toBe('My Project');
      expect(parsed.description).toBe('demo');
      expect(parsed.folders.map(f => f.path[0])).toEqual(['genomes', 'annotations', 'variants', 'reads', 'analysis']);
    });
  });

  describe('isVersionSupported', () => {
    it('accepts 1.0 and rejects unknown versions', () => {
      expect(handler.isVersionSupported('1.0')).toBe(true);
      expect(handler.isVersionSupported('2.0')).toBe(false);
    });
  });
});
