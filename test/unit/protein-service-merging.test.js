/* eslint-disable no-new-func */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/ProteinService.js');
const CHAT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
const TEST_PDB = [
  'HEADER    TEST PROTEIN',
  'ATOM      1  CA  ALA A   1      11.104  13.207   9.447  1.00 95.00           C',
  'ATOM      2  CA  GLY A   2      12.104  14.207  10.447  1.00 75.00           C',
  'END',
].join('\n');

function createService(mockApp, mockChatManager) {
  const code = fs.readFileSync(SERVICE_PATH, 'utf-8').replace('window.ProteinService = ProteinService;', '');
  const body = `${code}; return new ProteinService(mockApp, mockChatManager);`;
  const fn = new Function('mockApp', 'mockChatManager', body);
  return fn(mockApp, mockChatManager);
}

function createBareChatManager() {
  const code = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');
  const module = { exports: {} };
  const ChatManagerClass = new Function('window', 'module', `${code}; return ChatManager;`)(window, module);
  return Object.create(ChatManagerClass.prototype);
}

describe('ProteinService - PDB & AlphaFold Merging', () => {
  let service;
  let mockApp;
  let mockChatManager;

  beforeEach(() => {
    // Clean up DOM between tests
    const existing = document.querySelector('.protein-results-sidebar');
    if (existing) {
      existing.remove();
    }
    const style = document.getElementById('protein-sidebar-styles');
    if (style) {
      style.remove();
    }

    mockApp = {};
    mockChatManager = {
      performAlphaFoldSearch: vi.fn(),
      openProteinViewer: vi.fn().mockResolvedValue({ success: true }),
      services: {
        ui: {
          addAlphaFoldSidebarStyles: vi.fn(),
        },
      },
    };

    service = createService(mockApp, mockChatManager);
  });

  afterEach(() => {
    delete window.electronAPI;
    delete window.proteinStructureViewer;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should initialize service with empty tabs', () => {
    expect(service.tabs).toEqual([]);
    expect(service.activeTabId).toBeNull();
  });

  it('returns per-residue AlphaFold confidence scores without exposing raw PDB data', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue([
            {
              uniprotAccession: 'P04637',
              modelEntityId: 'AF-P04637-F1',
              latestVersion: 7,
              modelCreatedDate: '2026-01-01T00:00:00Z',
              globalMetricValue: 85,
              pdbUrl: 'https://alphafold.example/AF-P04637-F1-model_v7.pdb',
            },
          ]),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: vi.fn().mockResolvedValue(TEST_PDB),
        })
    );

    const result = await service.fetchAlphaFoldStructure({
      uniprot_id: 'P04637',
      format: 'pdb',
      include_confidence: true,
    });

    expect(result.success).toBe(true);
    expect(result.pdbData).toBeUndefined();
    expect(result._dataRef).toMatch(/^alphafold_P04637_/);
    expect(result.downloadUrl).toBe('https://alphafold.example/AF-P04637-F1-model_v7.pdb');
    expect(result.modelVersion).toBe(7);
    expect(result.confidence).toEqual({
      average: 85,
      min: 75,
      max: 95,
      residueCount: 2,
      interpretation: 'Confident (pLDDT 70-90)',
    });
    expect(result.confidenceScores).toHaveLength(2);
    expect(result.confidenceScores[0]).toMatchObject({ residueName: 'ALA', residueNumber: 1, plddt: 95 });
    expect(service.getCachedStructureData(result._dataRef)).toBe(TEST_PDB);
  });

  it('resolves snake-case UniProt viewer input through AlphaFold and preserves viewer options', async () => {
    vi.spyOn(service, 'fetchAlphaFoldStructure').mockImplementation(async () => {
      service._cacheStructureData('alphafold_test', TEST_PDB);
      return { success: true, _dataRef: 'alphafold_test' };
    });

    const result = await service.resolveStructureViewerInput({
      uniprot_id: 'P04637',
      representation: 'cartoon',
      color_scheme: 'temperature',
      show_ligands: false,
    });

    expect(result).toMatchObject({
      success: true,
      source: 'AlphaFold',
      uniprotId: 'P04637',
      structureId: 'AF-P04637-F1',
      viewerOptions: {
        representation: 'cartoon',
        colorScheme: 'temperature',
        showLigands: false,
      },
    });
    expect(result.pdbData).toBe(TEST_PDB);
  });

  it('recognizes a UniProt accession passed through the legacy pdb_id field', async () => {
    const fetchAlphaFold = vi.spyOn(service, 'fetchAlphaFoldStructure').mockImplementation(async () => {
      service._cacheStructureData('legacy_uniprot', TEST_PDB);
      return { success: true, _dataRef: 'legacy_uniprot' };
    });

    const result = await service.resolveStructureViewerInput({ pdb_id: 'P04637' });

    expect(result.success).toBe(true);
    expect(result.source).toBe('AlphaFold');
    expect(fetchAlphaFold).toHaveBeenCalledWith(expect.objectContaining({ uniprotId: 'P04637', format: 'pdb' }));
  });

  it('resolves a geneName-only viewer request to an AlphaFold structure', async () => {
    mockChatManager.performAlphaFoldSearch.mockResolvedValue([
      {
        uniprotId: 'P04637',
        proteinName: 'Cellular tumor antigen p53',
      },
    ]);
    vi.spyOn(service, 'fetchAlphaFoldStructure').mockImplementation(async () => {
      service._cacheStructureData('gene_lookup', TEST_PDB);
      return { success: true, _dataRef: 'gene_lookup', structureId: 'AF-P04637-F1' };
    });

    const result = await service.resolveStructureViewerInput({
      geneName: 'p53',
      organism: 'Homo sapiens',
      representation: 'cartoon',
    });

    expect(mockChatManager.performAlphaFoldSearch).toHaveBeenCalledWith('p53', 'Homo sapiens', 1);
    expect(result).toMatchObject({
      success: true,
      source: 'AlphaFold gene lookup',
      uniprotId: 'P04637',
      structureId: 'AF-P04637-F1',
      proteinName: 'Cellular tumor antigen p53',
    });
  });

  it('opens local PDB files through the hardened renderer file API', async () => {
    window.electronAPI = {
      readFile: vi.fn().mockResolvedValue({ success: true, data: TEST_PDB }),
    };

    const result = await service.resolveStructureViewerInput({
      file_path: '/tmp/AF-P04637-F1-model_v6.pdb',
      protein_name: 'p53 local model',
    });

    expect(window.electronAPI.readFile).toHaveBeenCalledWith('/tmp/AF-P04637-F1-model_v6.pdb');
    expect(result).toMatchObject({
      success: true,
      source: 'Local PDB file',
      structureId: 'AF-P04637-F1-model_v6',
      proteinName: 'p53 local model',
    });
  });

  it('downloads and opens an online PDB URL', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(TEST_PDB),
      })
    );

    const result = await service.resolveStructureViewerInput({
      structure_url: 'https://example.org/structures/p53.pdb?download=1',
    });

    expect(result).toMatchObject({
      success: true,
      source: 'Online PDB URL',
      structureId: 'p53',
    });
    expect(fetch).toHaveBeenCalledWith('https://example.org/structures/p53.pdb?download=1', {
      signal: expect.any(AbortSignal),
    });
  });

  it('routes open_protein_viewer through the unified resolver before opening the UI', async () => {
    const chatManager = createBareChatManager();
    const resolveStructureViewerInput = vi.fn().mockResolvedValue({
      success: true,
      pdbData: TEST_PDB,
      proteinName: 'Cellular tumor antigen p53',
      pdbId: null,
      uniprotId: 'P04637',
      structureId: 'AF-P04637-F1',
      source: 'AlphaFold',
      viewerOptions: { representation: 'cartoon', colorScheme: 'temperature' },
    });
    chatManager.services = { protein: { resolveStructureViewerInput } };
    window.proteinStructureViewer = { openStructureViewer: vi.fn() };

    const parameters = { uniprot_id: 'P04637', representation: 'cartoon', color_scheme: 'temperature' };
    const result = await chatManager.openProteinViewer(parameters);

    expect(resolveStructureViewerInput).toHaveBeenCalledWith(parameters);
    expect(window.proteinStructureViewer.openStructureViewer).toHaveBeenCalledWith(
      TEST_PDB,
      'Cellular tumor antigen p53',
      'AF-P04637-F1',
      { representation: 'cartoon', colorScheme: 'temperature' }
    );
    expect(result).toMatchObject({
      success: true,
      uniprotId: 'P04637',
      structureId: 'AF-P04637-F1',
      source: 'AlphaFold',
      representationUsed: 'cartoon',
    });
  });

  it('should create a new tab for AlphaFold results if no tab exists', async () => {
    const results = [
      { uniprotId: 'P04637', proteinName: 'Cellular tumor antigen p53', geneNames: ['TP53'], organism: 'Homo sapiens' },
    ];

    const renderResult = await service.renderProteinStructureResults({
      results,
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    expect(renderResult.success).toBe(true);
    expect(service.tabs.length).toBe(1);
    expect(service.tabs[0].searchType).toBe('AlphaFold');
    expect(service.tabs[0].title).toBe('TP53 (AlphaFold)');
    expect(service.tabs[0].geneName).toBe('TP53');
    expect(service.tabs[0].results.length).toBe(1);
    expect(service.tabs[0].results[0].structureType).toBe('AlphaFold');
    expect(service.activeTabId).toBe(service.tabs[0].id);

    // Sidebar DOM should be visible
    const sidebar = document.querySelector('.protein-results-sidebar');
    expect(sidebar).not.toBeNull();
    expect(sidebar.classList.contains('visible')).toBe(true);
  });

  it('should create a new tab for PDB results if no tab exists', async () => {
    const results = [{ pdbId: '1A2B', title: 'Structure of tumor suppressor p53', organism: 'Homo sapiens' }];

    const renderResult = await service.renderProteinStructureResults({
      results,
      searchType: 'PDB',
      geneName: 'TP53',
    });

    expect(renderResult.success).toBe(true);
    expect(service.tabs.length).toBe(1);
    expect(service.tabs[0].searchType).toBe('PDB');
    expect(service.tabs[0].title).toBe('TP53 (PDB)');
    expect(service.tabs[0].results.length).toBe(1);
    expect(service.tabs[0].results[0].structureType).toBe('PDB');
  });

  it('should create separate tabs for PDB and AlphaFold searches of the same gene', async () => {
    // 1. Initial AlphaFold search
    const afResults = [{ uniprotId: 'P04637', proteinName: 'p53', geneNames: ['TP53'], organism: 'Homo sapiens' }];
    await service.renderProteinStructureResults({
      results: afResults,
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    // 2. Incoming PDB search for the same gene, with different case ("tp53")
    const pdbResults = [{ pdbId: '1A2B', title: 'Structure of p53', organism: 'Homo sapiens' }];
    const pdbResult = await service.renderProteinStructureResults({
      results: pdbResults,
      searchType: 'PDB',
      geneName: 'tp53',
    });

    expect(pdbResult.success).toBe(true);
    expect(service.tabs.length).toBe(2); // Two separate tabs in the same sidebar
    expect(service.tabs[0].searchType).toBe('AlphaFold');
    expect(service.tabs[0].title).toBe('TP53 (AlphaFold)');
    expect(service.tabs[1].searchType).toBe('PDB');
    expect(service.tabs[1].title).toBe('tp53 (PDB)');
    expect(service.activeTabId).toBe(service.tabs[1].id); // The latest search tab is active
  });

  it('should update results if same search type runs for same gene (case-insensitive)', async () => {
    // 1. Initial PDB search
    const initialPdbResults = [{ pdbId: '1A2B', title: 'Structure of p53', organism: 'Homo sapiens' }];
    await service.renderProteinStructureResults({
      results: initialPdbResults,
      searchType: 'PDB',
      geneName: 'TP53',
    });

    expect(service.tabs.length).toBe(1);
    expect(service.tabs[0].results.length).toBe(1);
    expect(service.tabs[0].results[0].pdbId).toBe('1A2B');

    // 2. New PDB search for the same gene with different case ("tp53") and different results
    const newPdbResults = [{ pdbId: '3C4D', title: 'New Structure of p53', organism: 'Homo sapiens' }];
    await service.renderProteinStructureResults({
      results: newPdbResults,
      searchType: 'PDB',
      geneName: 'tp53',
    });

    expect(service.tabs.length).toBe(1); // Still 1 tab since same searchType & geneName
    expect(service.tabs[0].results.length).toBe(1);
    expect(service.tabs[0].results[0].pdbId).toBe('3C4D'); // Replaced
  });

  it('should render distinct badges for PDB and AlphaFold items in their respective tabs', async () => {
    // 1. AlphaFold search
    await service.renderProteinStructureResults({
      results: [{ uniprotId: 'P04637', proteinName: 'p53 AF' }],
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    // 2. PDB search
    await service.renderProteinStructureResults({
      results: [{ pdbId: '1A2B', title: 'p53 PDB' }],
      searchType: 'PDB',
      geneName: 'TP53',
    });

    // Verify UI matches active tab (PDB)
    service.refreshSidebarUI();
    let resultItems = document.querySelectorAll('.protein-result-item');
    expect(resultItems.length).toBe(1);
    let badge = resultItems[0].querySelector('.structure-badge');
    expect(badge.classList.contains('badge-pdb')).toBe(true);
    expect(badge.textContent).toContain('PDB');

    // Switch to AlphaFold tab
    service.activeTabId = service.tabs[0].id;
    service.refreshSidebarUI();
    resultItems = document.querySelectorAll('.protein-result-item');
    expect(resultItems.length).toBe(1);
    badge = resultItems[0].querySelector('.structure-badge');
    expect(badge.classList.contains('badge-alphafold')).toBe(true);
    expect(badge.textContent).toContain('AlphaFold');
  });

  it('should pass correct viewer parameters when clicking View 3D Structure for either type of tab', async () => {
    // 1. AlphaFold search
    await service.renderProteinStructureResults({
      results: [{ uniprotId: 'P04637', proteinName: 'p53 AF', geneName: 'TP53' }],
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    // 2. PDB search
    await service.renderProteinStructureResults({
      results: [{ pdbId: '1A2B', title: 'p53 PDB', geneName: 'TP53' }],
      searchType: 'PDB',
      geneName: 'TP53',
    });

    // View PDB structure (active tab by default after second search)
    service.refreshSidebarUI();
    let resultItems = document.querySelectorAll('.protein-result-item');
    let viewBtn = resultItems[0].querySelector('.view-structure');
    await viewBtn.click();
    expect(mockChatManager.openProteinViewer).toHaveBeenLastCalledWith({
      geneName: 'TP53',
      pdbId: '1A2B',
    });

    // Switch to AlphaFold tab and view
    service.activeTabId = service.tabs[0].id;
    service.refreshSidebarUI();
    resultItems = document.querySelectorAll('.protein-result-item');
    viewBtn = resultItems[0].querySelector('.view-structure');
    await viewBtn.click();
    expect(mockChatManager.openProteinViewer).toHaveBeenLastCalledWith({
      geneName: 'TP53',
      uniprotId: 'P04637',
    });
  });

  it('should close sidebar tabs and update activeTabId', async () => {
    await service.renderProteinStructureResults({
      results: [{ uniprotId: 'P04637', proteinName: 'p53' }],
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });
    const tab1Id = service.activeTabId;

    await service.renderProteinStructureResults({
      results: [{ pdbId: '2H1L', title: 'BRCA1 structure' }],
      searchType: 'PDB',
      geneName: 'BRCA1',
    });
    const tab2Id = service.activeTabId;

    expect(service.tabs.length).toBe(2);
    expect(service.activeTabId).toBe(tab2Id);

    // Close active tab
    service.closeProteinSidebarTab(tab2Id);
    expect(service.tabs.length).toBe(1);
    expect(service.activeTabId).toBe(tab1Id);

    // Close remaining tab
    service.closeProteinSidebarTab(tab1Id);
    expect(service.tabs.length).toBe(0);
    expect(service.activeTabId).toBeNull();

    // Sidebar should not be visible anymore
    const sidebar = document.querySelector('.protein-results-sidebar');
    expect(sidebar.classList.contains('visible')).toBe(false);
  });

  it('should display different genes as separate tabs in the same sidebar', async () => {
    // 1. Search for TP53
    await service.renderProteinStructureResults({
      results: [{ uniprotId: 'P04637', proteinName: 'p53' }],
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    // 2. Search for BRCA1
    await service.renderProteinStructureResults({
      results: [{ pdbId: '2H1L', title: 'BRCA1 structure' }],
      searchType: 'PDB',
      geneName: 'BRCA1',
    });

    // Assert that we have exactly 1 sidebar in the document body
    const sidebars = document.querySelectorAll('.protein-results-sidebar');
    expect(sidebars.length).toBe(1);

    // Assert that both tabs are rendered in the sidebar's tab bar
    const tabButtons = sidebars[0].querySelectorAll('.tab-button');
    expect(tabButtons.length).toBe(2);
    expect(tabButtons[0].textContent).toContain('TP53');
    expect(tabButtons[1].textContent).toContain('BRCA1');
  });

  it('should reuse persistent ProteinService instance inside ToolExecutionService', async () => {
    const execServicePath = path.join(process.cwd(), 'src/renderer/modules/chat/services/ToolExecutionService.js');
    const execCode = fs
      .readFileSync(execServicePath, 'utf-8')
      .replace('window.ToolExecutionService = ToolExecutionService;', '');
    const execBody = `${execCode}; return new ToolExecutionService(mockApp, mockChatManager);`;
    const execFn = new Function('mockApp', 'mockChatManager', execBody);

    // Set up window.ProteinService mock constructor/class
    const mockProteinServiceInstance = service;
    window.ProteinService = vi.fn().mockImplementation(() => mockProteinServiceInstance);
    window.FileOperationService = vi.fn();
    window.AnnotationService = vi.fn();
    window.BlastService = vi.fn();
    window.GenomeAnalysisService = vi.fn();

    // Attach service to mockChatManager.services.protein
    mockChatManager.services.protein = mockProteinServiceInstance;

    const execService = execFn(mockApp, mockChatManager);

    // Spy on searchPdbStructures
    vi.spyOn(mockProteinServiceInstance, 'searchPdbStructures').mockResolvedValue({ success: true });

    // Execute tool search_pdb_structures
    await execService.execute('search_pdb_structures', { geneName: 'TP53' });

    // Verify it called searchPdbStructures on the persistent instance
    expect(mockProteinServiceInstance.searchPdbStructures).toHaveBeenCalledWith({ geneName: 'TP53' });

    // Clean up window globals
    delete window.ProteinService;
    delete window.FileOperationService;
    delete window.AnnotationService;
    delete window.BlastService;
    delete window.GenomeAnalysisService;
  });
});
