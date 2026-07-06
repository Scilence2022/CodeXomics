/**
 * BLAST Tool Registry Consistency Tests
 *
 * Validates that all BLAST tool registries are synchronized:
 * - ToolNames.js constants
 * - builtInToolsMap entries
 * - BlastService methods
 * - FunctionCallsOrganizer categories
 * - ChatManager.executeLocalTool fallback
 * - ExternalAgent isSpecializedAgent mapping
 * - ExternalAgent toolMapping
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const BLAST_PRIMARY_TOOLS = [
  'blast_search',
  'blast_search_online',
  'blast_search_local',
  'blast_search_batch',
  'blast_create_database',
  'blast_list_databases',
  'blast_delete_database',
  'blast_create_db_from_genome',
  'blast_create_protein_db_from_genome',
  'blast_create_quick_db_for_current_genome',
  'blast_filter_results',
  'blast_export_results',
  'blast_detect_sequence_type',
  'blast_validate_database',
  'blast_get_installation_status',
];

const BLAST_LEGACY_ALIASES = [
  'blast_sequence_from_region',
  'get_blast_databases',
  'batch_blast_search',
  'advanced_blast_search',
];

function toCamelCase(str) {
  return str.replace(/([-_][a-z])/gi, $1 => $1.toUpperCase().replace('-', '').replace('_', ''));
}

function readFile(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

describe('BLAST Tool Registry Consistency', () => {
  describe('ToolNames.js BLAST constants', () => {
    const content = readFile('src/renderer/modules/chat/constants/ToolNames.js');

    it('should define all 16 primary BLAST tool constants', () => {
      for (const tool of BLAST_PRIMARY_TOOLS) {
        expect(content, `ToolNames.js missing '${tool}'`).toContain(tool);
      }
    });

    it('should define all 5 legacy alias BLAST constants', () => {
      for (const tool of BLAST_LEGACY_ALIASES) {
        expect(content, `ToolNames.js missing legacy alias '${tool}'`).toContain(tool);
      }
    });
  });

  describe('builtInToolsMap BLAST entries', () => {
    const content = readFile('tools_registry/builtin_tools_integration.js');

    it('should have all 16 primary BLAST tools in builtInToolsMap', () => {
      for (const tool of BLAST_PRIMARY_TOOLS) {
        const regex = new RegExp(`builtInToolsMap\\.set\\s*\\(\\s*['"]${tool}['"]`);
        expect(regex.test(content), `builtInToolsMap missing '${tool}'`).toBe(true);
      }
    });

    it('should have all 5 legacy alias BLAST tools in builtInToolsMap', () => {
      for (const tool of BLAST_LEGACY_ALIASES) {
        const regex = new RegExp(`builtInToolsMap\\.set\\s*\\(\\s*['"]${tool}['"]`);
        expect(regex.test(content), `builtInToolsMap missing legacy alias '${tool}'`).toBe(true);
      }
    });

    it('blast_search_batch method should be blastSearchBatch (not batchBlastSearch)', () => {
      const match = content.match(/builtInToolsMap\.set\('blast_search_batch',\s*\{[^}]*method:\s*'(\w+)'/s);
      expect(match, 'blast_search_batch entry not found').not.toBeNull();
      expect(match[1]).toBe('blastSearchBatch');
    });
  });

  describe('BlastService method coverage', () => {
    const content = readFile('src/renderer/modules/chat/services/BlastService.js');

    it('should have methods for all 16 primary BLAST tools (camelCase)', () => {
      for (const tool of BLAST_PRIMARY_TOOLS) {
        const methodName = toCamelCase(tool);
        const methodPattern = `async ${methodName}(`;
        expect(content, `BlastService missing method '${methodName}' for tool '${tool}'`).toContain(methodPattern);
      }
    });

    it('should have legacy alias methods', () => {
      const legacyMethods = [
        'getBlastDatabases',
        'batchBlastSearch',
        'advancedBlastSearch',
        'localBlastDatabaseInfo',
        'blastSequenceFromRegion',
      ];
      for (const method of legacyMethods) {
        const methodPattern = `async ${method}(`;
        expect(content, `BlastService missing legacy method '${method}'`).toContain(methodPattern);
      }
    });

    it('blastSearchBatch should be the primary name (not batchBlastSearch)', () => {
      expect(content).toContain('async blastSearchBatch(');
    });

    it('should have _toSnakeCase helper', () => {
      expect(content).toContain('_toSnakeCase');
    });

    it('should have _executeBlastRequest with 4-priority fallback', () => {
      expect(content).toContain('_executeBlastRequest');
      expect(content).toContain('blastFunctionTools');
      expect(content).toContain('blastManager');
      expect(content).toContain('executeMCPBlastTool');
    });

    it('should handle blast_sequence_from_region without recursive ChatManager delegation', () => {
      expect(content).toContain('_blastSequenceFromRegionDirect');
      expect(content).toContain("methodName === 'blastSequenceFromRegion'");
    });
  });

  describe('BlastFunctionTools behavior coverage', () => {
    const content = readFile('src/renderer/modules/BlastFunctionTools.js');

    it('should register generic and region BLAST tools', () => {
      expect(content).toContain('blast_search: this.executeBlastSearch.bind(this)');
      expect(content).toContain('blast_sequence_from_region: this.blastSequenceFromRegion.bind(this)');
    });

    it('should map BLAST programs to the correct database molecule type', () => {
      expect(content).toContain('getDatabaseTypeForBlastType(blastType)');
      expect(content).toContain("normalized === 'blastp' || normalized === 'blastx'");
      expect(content).toContain("return 'nucleotide'");
    });
  });

  describe('BlastManager semantic fixes', () => {
    const content = readFile('src/renderer/modules/BlastManager.js');

    it('should support tblastx executable lookup', () => {
      expect(content).toContain("tblastx: 'tblastx'");
    });

    it('should validate tblastn as protein-query BLAST', () => {
      expect(content).toContain("params.blastType === 'tblastn' && sequenceType !== 'Protein'");
    });

    it('should resolve quick/custom database IDs through registered database metadata', () => {
      expect(content).toContain('const directCustomDb = this.customDatabases.get(databaseValue)');
      expect(content).toContain('const localDb = this.config.localDatabases.get(databaseValue)');
      expect(content).toContain('path.join(localDb.path, localDb.name || databaseValue)');
    });

    it('should query scanned BLAST database stats by absolute database path', () => {
      const escapedDbNameToken = '$' + '{escapedDbName}';

      expect(content).toContain('const stats = await this.getDatabaseStats(dbPathFull, dbDirectory)');
      expect(content).toContain('async getDatabaseStats(dbName, dbDirectory = null)');
      expect(content).toContain(`blastdbcmd -db "${escapedDbNameToken}" -info`);
      expect(content).toContain('localDbPath: dbDirectory || this.config.localDbPath');
    });

    it('should name quick BLAST databases from generated FASTA basenames', () => {
      const dbNameToken = '$' + '{dbName}';

      expect(content).toContain('const dbName = this.getQuickDatabaseBaseName(genomeName, dbType)');
      expect(content).toContain('dbId = dbName');
      expect(content).toContain(`fileName: \`${dbNameToken}.fasta\``);
      expect(content).toContain("replace(/\\.(fasta|fa|fas|txt|gbk|gb|genbank)$/i, '')");
      expect(content).not.toContain('dbId = `quick_${dbName');
    });

    it('should refresh BLAST Search database UI after quick database creation', () => {
      const blastFunctionTools = readFile('src/renderer/modules/BlastFunctionTools.js');

      expect(content).toContain('refreshDatabaseUi(options = {})');
      expect(content).toContain("this.refreshDatabaseUi({ service: 'local', blastType: createdBlastType })");
      expect(content).toContain('database: {');
      expect(blastFunctionTools).toContain('const nuclDb = nuclResult.database');
      expect(blastFunctionTools).toContain('const protDb = protResult.database');
      expect(blastFunctionTools).toContain(
        "this.blastManager.refreshDatabaseUi({ service: 'local', blastType: preferredBlastType })"
      );
    });

    it('should delete local BLAST database files through main-process file IPC', () => {
      expect(content).toContain('window.electronAPI.deletePhysicalFile');
      expect(content).toContain("['.ndb', '.nhr', '.nin', '.nog', '.nos', '.not', '.nsq', '.ntf', '.nto']");
      expect(content).not.toContain('rm -f');
    });
  });

  describe('FunctionCallsOrganizer BLAST entries', () => {
    const content = readFile('src/renderer/modules/FunctionCallsOrganizer.js');

    it('should categorize all 16 primary BLAST tools', () => {
      for (const tool of BLAST_PRIMARY_TOOLS) {
        expect(content, `FunctionCallsOrganizer missing '${tool}'`).toContain(`'${tool}'`);
      }
    });

    it('should categorize all 5 legacy alias BLAST tools', () => {
      for (const tool of BLAST_LEGACY_ALIASES) {
        expect(content, `FunctionCallsOrganizer missing legacy alias '${tool}'`).toContain(`'${tool}'`);
      }
    });
  });

  describe('ChatManager.executeLocalTool BLAST fallback', () => {
    const content = readFile('src/renderer/modules/ChatManager.js');

    it('should have executeLocalTool method', () => {
      expect(content).toContain('async executeLocalTool(toolName, parameters)');
    });

    it('should have all 16 primary BLAST tools in localTools map', () => {
      for (const tool of BLAST_PRIMARY_TOOLS) {
        const localToolPattern = `${tool}:`;
        expect(content, `executeLocalTool missing '${tool}'`).toContain(localToolPattern);
      }
    });

    it('BLAST fallbacks should delegate to services.blast', () => {
      const blastSection = content.substring(
        content.indexOf('blast_search: () => this.services.blast'),
        content.indexOf('blast_search: () => this.services.blast') + 2000
      );
      expect(blastSection).toContain('this.services.blast.blastSearch');
      expect(blastSection).toContain('this.services.blast.blastSearchOnline');
      expect(blastSection).toContain('this.services.blast.blastSearchLocal');
    });
  });

  describe('ExternalAgent BLAST coverage', () => {
    const agentContent = readFile('src/renderer/modules/Agents/ExternalAgent.js');
    const multiAgentContent = readFile('src/renderer/modules/MultiAgentSystem.js');

    it('should have all 16 primary BLAST tools in ExternalAgent toolMapping', () => {
      for (const tool of BLAST_PRIMARY_TOOLS) {
        const regex = new RegExp(`toolMapping\\.set\\s*\\(\\s*['"]${tool}['"]`);
        expect(regex.test(agentContent), `ExternalAgent toolMapping missing '${tool}'`).toBe(true);
      }
    });

    it('should have _delegateToChatManager helper for BLAST database ops', () => {
      expect(agentContent).toContain('_delegateToChatManager');
    });

    it('should have all 16 primary BLAST tools in isSpecializedAgent ExternalAgent list', () => {
      const externalAgentSection = multiAgentContent.substring(
        multiAgentContent.lastIndexOf('ExternalAgent: ['),
        multiAgentContent.indexOf(']', multiAgentContent.lastIndexOf('ExternalAgent: [')) + 1
      );
      for (const tool of BLAST_PRIMARY_TOOLS) {
        expect(externalAgentSection, `isSpecializedAgent ExternalAgent missing '${tool}'`).toContain(tool);
      }
    });
  });

  describe('BlastService._toCamelCase consistency', () => {
    it('all primary tool names should produce valid camelCase method names', () => {
      const serviceContent = readFile('src/renderer/modules/chat/services/BlastService.js');
      for (const tool of BLAST_PRIMARY_TOOLS) {
        const camelName = toCamelCase(tool);
        const methodDef = `async ${camelName}(params)`;
        const msg = `BlastService: _toCamelCase('${tool}') = '${camelName}' but method not found`;
        expect(serviceContent, msg).toContain(methodDef);
      }
    });
  });

  describe('ToolCapabilityPolicy BLAST entries', () => {
    const content = readFile('src/renderer/modules/chat/services/ToolCapabilityPolicy.js');

    it('should explicitly rate-limit region BLAST as an external API tool', () => {
      expect(content).toMatch(/external_api:\s*\{[\s\S]*'blast_sequence_from_region'/);
    });
  });

  describe('YAML tool definitions', () => {
    it('should have YAML definitions for all primary BLAST tools', () => {
      const registryFiles = [];
      function findYaml(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) findYaml(fullPath);
          else if (entry.name.endsWith('.yaml')) registryFiles.push(fullPath);
        }
      }
      findYaml(path.join(process.cwd(), 'tools_registry'));

      const yamlToolNames = registryFiles
        .filter(f => f.includes('blast'))
        .map(f => {
          const content = fs.readFileSync(f, 'utf-8');
          const match = content.match(/^name:\s*['"]?([^'"\n]+)['"]?/m);
          return match ? match[1].trim() : null;
        })
        .filter(Boolean);

      for (const tool of BLAST_PRIMARY_TOOLS) {
        expect(yamlToolNames, `Missing YAML definition for '${tool}'`).toContain(tool);
      }
      expect(yamlToolNames, "Missing YAML definition for 'blast_sequence_from_region'").toContain(
        'blast_sequence_from_region'
      );
    });
  });
});
