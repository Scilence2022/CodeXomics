/* eslint-disable no-new-func */
import {describe, it, expect, beforeEach, vi} from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/ProteinService.js');

function createService(mockApp, mockChatManager) {
  const code = fs
      .readFileSync(SERVICE_PATH, 'utf-8')
      .replace('window.ProteinService = ProteinService;', '');
  const body = `${code}; return new ProteinService(mockApp, mockChatManager);`;
  const fn = new Function('mockApp', 'mockChatManager', body);
  return fn(mockApp, mockChatManager);
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
      openProteinViewer: vi.fn().mockResolvedValue({success: true}),
      services: {
        ui: {
          addAlphaFoldSidebarStyles: vi.fn(),
        },
      },
    };

    service = createService(mockApp, mockChatManager);
  });

  it('should initialize service with empty tabs', () => {
    expect(service.tabs).toEqual([]);
    expect(service.activeTabId).toBeNull();
  });

  it('should create a new tab for AlphaFold results if no tab exists', async () => {
    const results = [
      {uniprotId: 'P04637', proteinName: 'Cellular tumor antigen p53', geneNames: ['TP53'], organism: 'Homo sapiens'},
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
    const results = [
      {pdbId: '1A2B', title: 'Structure of tumor suppressor p53', organism: 'Homo sapiens'},
    ];

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

  it('should merge PDB results into existing AlphaFold tab for the same gene (case-insensitive)', async () => {
    // 1. Initial AlphaFold search
    const afResults = [
      {uniprotId: 'P04637', proteinName: 'p53', geneNames: ['TP53'], organism: 'Homo sapiens'},
    ];
    await service.renderProteinStructureResults({
      results: afResults,
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    // 2. Incoming PDB search for the same gene, with different case ("tp53")
    const pdbResults = [
      {pdbId: '1A2B', title: 'Structure of p53', organism: 'Homo sapiens'},
    ];
    const mergeResult = await service.renderProteinStructureResults({
      results: pdbResults,
      searchType: 'PDB',
      geneName: 'tp53',
    });

    expect(mergeResult.success).toBe(true);
    expect(service.tabs.length).toBe(1); // Merged into existing tab
    expect(service.tabs[0].searchType).toBe('Both');
    expect(service.tabs[0].title).toBe('TP53 (PDB & AlphaFold)');
    expect(service.tabs[0].results.length).toBe(2);

    // Verify individual structureType tagging
    expect(service.tabs[0].results[0].structureType).toBe('AlphaFold');
    expect(service.tabs[0].results[1].structureType).toBe('PDB');
  });

  it('should merge AlphaFold results into existing PDB tab for the same gene', async () => {
    // 1. Initial PDB search
    const pdbResults = [
      {pdbId: '1A2B', title: 'Structure of p53', organism: 'Homo sapiens'},
    ];
    await service.renderProteinStructureResults({
      results: pdbResults,
      searchType: 'PDB',
      geneName: 'TP53',
    });

    // 2. Incoming AlphaFold search
    const afResults = [
      {uniprotId: 'P04637', proteinName: 'p53', geneNames: ['TP53'], organism: 'Homo sapiens'},
    ];
    await service.renderProteinStructureResults({
      results: afResults,
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    expect(service.tabs.length).toBe(1);
    expect(service.tabs[0].searchType).toBe('Both');
    expect(service.tabs[0].title).toBe('TP53 (PDB & AlphaFold)');
    expect(service.tabs[0].results.length).toBe(2);
  });

  it('should ignore duplicate results with same ID (case-insensitive) when merging', async () => {
    const initialResults = [
      {uniprotId: 'P04637', proteinName: 'p53'},
      {pdbId: '1A2B', title: 'Structure 1'},
    ];
    // Populate tab manually to test tag-fallback logic and deduplication
    service.tabs = [{
      id: 'tab_test',
      title: 'TP53 (PDB & AlphaFold)',
      searchType: 'Both',
      geneName: 'TP53',
      results: initialResults,
    }];
    service.activeTabId = 'tab_test';

    // Incoming duplicate and non-duplicate results
    const newResults = [
      {uniprotId: 'p04637', proteinName: 'p53 duplicate'}, // Duplicate uniprotId
      {pdbId: '1a2b', title: 'Structure 1 duplicate'}, // Duplicate pdbId
      {pdbId: '3C4D', title: 'Structure 2'}, // New pdbId
    ];

    await service.renderProteinStructureResults({
      results: newResults,
      searchType: 'PDB', // PDB search
      geneName: 'TP53',
    });

    expect(service.tabs[0].results.length).toBe(3); // Only 1 added (3C4D)
    expect(service.tabs[0].results.map((r) => r.pdbId || r.uniprotId)).toEqual(['P04637', '1A2B', '3C4D']);
  });

  it('should render distinct badges for PDB and AlphaFold items', async () => {
    const results = [
      {uniprotId: 'P04637', proteinName: 'p53 AF', structureType: 'AlphaFold'},
      {pdbId: '1A2B', title: 'p53 PDB', structureType: 'PDB'},
    ];
    service.tabs = [{
      id: 'tab_test',
      title: 'TP53 (PDB & AlphaFold)',
      searchType: 'Both',
      geneName: 'TP53',
      results,
    }];
    service.activeTabId = 'tab_test';

    service.refreshSidebarUI();

    const resultItems = document.querySelectorAll('.protein-result-item');
    expect(resultItems.length).toBe(2);

    // Verify badges
    const firstItemBadge = resultItems[0].querySelector('.structure-badge');
    expect(firstItemBadge.classList.contains('badge-alphafold')).toBe(true);
    expect(firstItemBadge.textContent).toContain('AlphaFold');

    const secondItemBadge = resultItems[1].querySelector('.structure-badge');
    expect(secondItemBadge.classList.contains('badge-pdb')).toBe(true);
    expect(secondItemBadge.textContent).toContain('PDB');
  });

  it('should pass correct viewer parameters when clicking View 3D Structure', async () => {
    const results = [
      {uniprotId: 'P04637', proteinName: 'p53 AF', geneName: 'TP53', structureType: 'AlphaFold'},
      {pdbId: '1A2B', title: 'p53 PDB', geneName: 'TP53', structureType: 'PDB'},
    ];
    service.tabs = [{
      id: 'tab_test',
      title: 'TP53 (PDB & AlphaFold)',
      searchType: 'Both',
      geneName: 'TP53',
      results,
    }];
    service.activeTabId = 'tab_test';

    service.refreshSidebarUI();

    const resultItems = document.querySelectorAll('.protein-result-item');

    // Click View 3D Structure on AlphaFold item
    const afViewBtn = resultItems[0].querySelector('.view-structure');
    await afViewBtn.click();
    expect(mockChatManager.openProteinViewer).toHaveBeenLastCalledWith({
      geneName: 'TP53',
      uniprotId: 'P04637',
    });

    // Click View 3D Structure on PDB item
    const pdbViewBtn = resultItems[1].querySelector('.view-structure');
    await pdbViewBtn.click();
    expect(mockChatManager.openProteinViewer).toHaveBeenLastCalledWith({
      geneName: 'TP53',
      pdbId: '1A2B',
    });
  });

  it('should close sidebar tabs and update activeTabId', async () => {
    await service.renderProteinStructureResults({
      results: [{uniprotId: 'P04637', proteinName: 'p53'}],
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });
    const tab1Id = service.activeTabId;

    await service.renderProteinStructureResults({
      results: [{pdbId: '2H1L', title: 'BRCA1 structure'}],
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
      results: [{uniprotId: 'P04637', proteinName: 'p53'}],
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    // 2. Search for BRCA1
    await service.renderProteinStructureResults({
      results: [{pdbId: '2H1L', title: 'BRCA1 structure'}],
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

  it(
      'should reuse persistent ProteinService instance inside ToolExecutionService',
      async () => {
        const execServicePath = path.join(
            process.cwd(),
            'src/renderer/modules/chat/services/ToolExecutionService.js',
        );
        const execCode = fs.readFileSync(execServicePath, 'utf-8')
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
        vi.spyOn(mockProteinServiceInstance, 'searchPdbStructures').mockResolvedValue({success: true});

        // Execute tool search_pdb_structures
        await execService.execute('search_pdb_structures', {geneName: 'TP53'});

        // Verify it called searchPdbStructures on the persistent instance
        expect(mockProteinServiceInstance.searchPdbStructures).toHaveBeenCalledWith({geneName: 'TP53'});

        // Clean up window globals
        delete window.ProteinService;
        delete window.FileOperationService;
        delete window.AnnotationService;
        delete window.BlastService;
        delete window.GenomeAnalysisService;
      },
  );
});
