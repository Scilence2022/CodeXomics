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

  it('should create separate tabs for PDB and AlphaFold searches of the same gene', async () => {
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
    const initialPdbResults = [
      {pdbId: '1A2B', title: 'Structure of p53', organism: 'Homo sapiens'},
    ];
    await service.renderProteinStructureResults({
      results: initialPdbResults,
      searchType: 'PDB',
      geneName: 'TP53',
    });

    expect(service.tabs.length).toBe(1);
    expect(service.tabs[0].results.length).toBe(1);
    expect(service.tabs[0].results[0].pdbId).toBe('1A2B');

    // 2. New PDB search for the same gene with different case ("tp53") and different results
    const newPdbResults = [
      {pdbId: '3C4D', title: 'New Structure of p53', organism: 'Homo sapiens'},
    ];
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
      results: [{uniprotId: 'P04637', proteinName: 'p53 AF'}],
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    // 2. PDB search
    await service.renderProteinStructureResults({
      results: [{pdbId: '1A2B', title: 'p53 PDB'}],
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
      results: [{uniprotId: 'P04637', proteinName: 'p53 AF', geneName: 'TP53'}],
      searchType: 'AlphaFold',
      geneName: 'TP53',
    });

    // 2. PDB search
    await service.renderProteinStructureResults({
      results: [{pdbId: '1A2B', title: 'p53 PDB', geneName: 'TP53'}],
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
