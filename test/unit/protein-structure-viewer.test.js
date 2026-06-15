/* eslint-disable no-new-func */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const VIEWER_PATH = path.join(process.cwd(), 'src/renderer/modules/ProteinStructureViewer.js');

function loadProteinStructureViewer() {
  const code = fs.readFileSync(VIEWER_PATH, 'utf-8');

  // Create mock environment variables
  const mockWindow = {
    addEventListener: vi.fn(),
    open: vi.fn(),
    themeManager: {
      getCurrentStyle: () => 'professional',
      stylePresets: {
        professional: {
          variables: {
            '--primary-color': '#0d7377',
            '--bg-primary': '#ffffff',
          },
        },
        midnight: {
          variables: {
            '--primary-color': '#0891b2',
            '--bg-primary': '#0f172a',
          },
        },
      },
    },
    document: {
      createElement: () => ({
        getContext: () => ({
          getExtension: () => null,
          getParameter: () => '',
        }),
      }),
      head: {
        appendChild: vi.fn(),
      },
    },
  };

  const mockModule = { exports: {} };

  // Run the module in clean scope
  const runModule = new Function('window', 'document', 'navigator', 'module', `${code}; return module.exports;`);

  const ProteinStructureViewerClass = runModule(
    mockWindow,
    mockWindow.document,
    { userAgent: 'mock-agent', platform: 'mock-platform' },
    mockModule
  );

  return { ProteinStructureViewerClass, mockWindow };
}

describe('ProteinStructureViewer Theme Propagation', () => {
  let ProteinStructureViewerClass;
  let viewer;
  let mockWindow;

  beforeEach(() => {
    const loaded = loadProteinStructureViewer();
    ProteinStructureViewerClass = loaded.ProteinStructureViewerClass;
    mockWindow = loaded.mockWindow;

    // Instantiate class
    viewer = new ProteinStructureViewerClass();
  });

  it('should initialize successfully and register uiStyleChanged listener', () => {
    expect(viewer).toBeDefined();
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('uiStyleChanged', expect.any(Function));
  });

  it('should normalize tool representation and confidence coloring options for NGL', () => {
    expect(
      viewer.normalizeViewerOptions({
        representation: 'ball_stick',
        colorScheme: 'temperature',
        showLigands: false,
        showWaters: true,
        centerOnLigand: true,
      })
    ).toEqual({
      representation: 'ball+stick',
      colorScheme: 'bfactor',
      showLigands: false,
      showWaters: true,
      centerOnLigand: true,
    });
  });

  it('should apply current theme immediately on window creation', () => {
    const mockDoc = {
      write: vi.fn(),
      close: vi.fn(),
      body: {
        classList: {
          remove: vi.fn(),
          add: vi.fn(),
        },
      },
      documentElement: {
        setAttribute: vi.fn(),
        style: {
          setProperty: vi.fn(),
        },
      },
    };

    const mockOpenWindow = {
      document: mockDoc,
      onload: null,
      addEventListener: vi.fn(),
    };

    mockWindow.open.mockReturnValue(mockOpenWindow);

    // Call openStructureViewer
    viewer.openStructureViewer('PDB_DATA_HERE', '6CYZ', '6CYZ');

    expect(mockDoc.write).toHaveBeenCalled();
    expect(mockDoc.close).toHaveBeenCalled();

    // Verify theme was applied immediately
    expect(mockDoc.body.classList.remove).toHaveBeenCalledWith(
      'style-default',
      'style-professional',
      'style-minimal',
      'style-pastel',
      'style-amy',
      'style-red',
      'style-elegant',
      'style-midnight'
    );
    expect(mockDoc.body.classList.add).toHaveBeenCalledWith('style-professional');
    expect(mockDoc.documentElement.setAttribute).toHaveBeenCalledWith('data-ui-style', 'professional');
    expect(mockDoc.documentElement.style.setProperty).toHaveBeenCalledWith('--primary-color', '#0d7377');
    expect(mockDoc.documentElement.style.setProperty).toHaveBeenCalledWith('--bg-primary', '#ffffff');
  });

  it('should propagate new theme styles to all open windows when style changes', () => {
    // Set up mock window in the tracking map
    const mockDoc = {
      body: {
        classList: {
          remove: vi.fn(),
          add: vi.fn(),
        },
      },
      documentElement: {
        setAttribute: vi.fn(),
        style: {
          setProperty: vi.fn(),
        },
      },
    };

    const mockOpenWindow = {
      document: mockDoc,
      closed: false,
    };

    viewer.structureWindows.set('test-window-1', mockOpenWindow);

    // Call applyThemeToAllWindows
    const preset = mockWindow.themeManager.stylePresets.midnight;
    viewer.applyThemeToAllWindows('midnight', preset);

    // Verify theme update propagates to the mock window
    expect(mockDoc.body.classList.remove).toHaveBeenCalled();
    expect(mockDoc.body.classList.add).toHaveBeenCalledWith('style-midnight');
    expect(mockDoc.documentElement.setAttribute).toHaveBeenCalledWith('data-ui-style', 'midnight');
    expect(mockDoc.documentElement.style.setProperty).toHaveBeenCalledWith('--primary-color', '#0891b2');
    expect(mockDoc.documentElement.style.setProperty).toHaveBeenCalledWith('--bg-primary', '#0f172a');
  });

  it('should clean up closed windows from the tracking map during propagation', () => {
    const mockOpenWindow = {
      closed: false,
      document: {
        body: { classList: { remove: vi.fn(), add: vi.fn() } },
        documentElement: { setAttribute: vi.fn(), style: { setProperty: vi.fn() } },
      },
    };

    const mockClosedWindow = {
      closed: true,
    };

    viewer.structureWindows.set('active-window', mockOpenWindow);
    viewer.structureWindows.set('closed-window', mockClosedWindow);

    expect(viewer.structureWindows.size).toBe(2);

    const preset = mockWindow.themeManager.stylePresets.midnight;
    viewer.applyThemeToAllWindows('midnight', preset);

    // Closed window should be removed, active window should remain
    expect(viewer.structureWindows.has('closed-window')).toBe(false);
    expect(viewer.structureWindows.has('active-window')).toBe(true);
    expect(viewer.structureWindows.size).toBe(1);
  });
});
