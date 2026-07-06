import { describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const BlastFunctionTools = require('../../src/renderer/modules/BlastFunctionTools.js');

function loadBlastService() {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'src/renderer/modules/chat/services/BlastService.js'),
    'utf8'
  );
  const sandbox = {
    console,
    window: {},
  };
  vm.runInNewContext(source, sandbox);
  return { BlastService: sandbox.window.BlastService, window: sandbox.window };
}

describe('BLAST service direct fallbacks', () => {
  it('validates a database with the documented dbName parameter', async () => {
    const { BlastService } = loadBlastService();
    const blastManager = {
      config: {
        localDatabases: new Map([['benchmark_view_nucl', { name: 'benchmark_view_nucl', type: 'blastn' }]]),
      },
      customDatabases: new Map(),
      resolveDatabasePath: vi.fn(() => '/tmp/benchmark_view_nucl'),
      validateDatabase: vi.fn(async () => true),
    };
    const service = new BlastService({ blastManager }, {});

    const result = await service.blastValidateDatabase({ dbName: 'benchmark_view_nucl' });

    expect(result.success).toBe(true);
    expect(result.valid).toBe(true);
    expect(blastManager.resolveDatabasePath).toHaveBeenCalledWith('benchmark_view_nucl');
    expect(blastManager.validateDatabase).toHaveBeenCalledWith('/tmp/benchmark_view_nucl', 'blastn');
  });

  it('infers protein BLAST validation from local database metadata', async () => {
    const { BlastService } = loadBlastService();
    const blastManager = {
      config: {
        localDatabases: new Map([['benchmark_view_prot', { name: 'benchmark_view_prot', type: 'protein' }]]),
      },
      customDatabases: new Map(),
      resolveDatabasePath: vi.fn(() => '/tmp/benchmark_view_prot'),
      validateDatabase: vi.fn(async () => true),
    };
    const service = new BlastService({ blastManager }, {});

    await service.blastValidateDatabase({ dbName: 'benchmark_view_prot' });

    expect(blastManager.validateDatabase).toHaveBeenCalledWith('/tmp/benchmark_view_prot', 'blastp');
  });

  it('deletes a local database with dbName and confirmation when function tools are unavailable', async () => {
    const { BlastService } = loadBlastService();
    const blastManager = {
      config: {
        localDatabases: new Map([['benchmark_view_nucl', { name: 'benchmark_view_nucl', type: 'blastn' }]]),
      },
      customDatabases: new Map(),
      deleteLocalDatabase: vi.fn(async () => true),
    };
    const service = new BlastService({ blastManager }, {});

    const result = await service.blastDeleteDatabase({ dbName: 'benchmark_view_nucl', confirm: true });

    expect(result.success).toBe(true);
    expect(blastManager.deleteLocalDatabase).toHaveBeenCalledWith('benchmark_view_nucl');
  });

  it('exports current BLAST results by searchId as CSV', async () => {
    const { BlastService, window } = loadBlastService();
    const writeFile = vi.fn(async () => ({ success: true, filePath: '/tmp/benchmark_blast_results.csv' }));
    window.electronAPI = { writeFile };
    const blastManager = {
      searchResults: {
        searchId: '4RAT9HRP016',
        hits: [
          {
            id: 'hit_1',
            accession: 'ACC1',
            description: 'alpha, beta',
            evalue: '1e-20',
            score: '100 bits',
            identity: '98.5%',
            coverage: '95%',
            alignmentLength: 42,
          },
        ],
      },
    };
    const service = new BlastService({ blastManager }, {});

    const result = await service.blastExportResults({
      searchId: '4RAT9HRP016',
      format: 'csv',
      outputPath: '/tmp/benchmark_blast_results.csv',
    });

    expect(result.success).toBe(true);
    expect(writeFile).toHaveBeenCalledWith(
      '/tmp/benchmark_blast_results.csv',
      expect.stringContaining('"alpha, beta"')
    );
  });
});

describe('BLAST function tool parameter compatibility', () => {
  it('deletes a local database using dbName through BlastFunctionTools', async () => {
    const tools = Object.create(BlastFunctionTools.prototype);
    tools.blastManager = {
      config: {
        localDatabases: new Map([['benchmark_view_nucl', { name: 'benchmark_view_nucl', type: 'blastn' }]]),
      },
      customDatabases: new Map(),
      deleteLocalDatabase: vi.fn(async () => true),
    };

    const result = await tools.deleteBlastDatabase({ dbName: 'benchmark_view_nucl', confirm: true });

    expect(result.success).toBe(true);
    expect(tools.blastManager.deleteLocalDatabase).toHaveBeenCalledWith('benchmark_view_nucl');
  });
});
