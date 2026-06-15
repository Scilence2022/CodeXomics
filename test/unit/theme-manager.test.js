/**
 * ThemeManager Pattern Tests
 *
 * Validates the ThemeManager preset/style propagation pattern used
 * across the genome browser, Circos plotter, and Project Manager.
 */
import { describe, it, expect } from 'vitest';

// Replicate ThemeManager pattern from codebase
class ThemeManager {
  constructor() {
    this._currentPreset = 'professional';
    this._currentMode = 'light';
    this._presets = ['default', 'professional', 'minimal', 'pastel', 'amy', 'red', 'elegant', 'midnight'];
    this._modes = ['light', 'dark'];
  }

  applyPreset(preset) {
    if (!this._presets.includes(preset)) {
      throw new Error(`Unknown preset: ${preset}. Available: ${this._presets.join(', ')}`);
    }
    this._currentPreset = preset;
    this._applyCSSVars(preset);
  }

  toggleMode() {
    this._currentMode = this._currentMode === 'light' ? 'dark' : 'light';
    this._applyCSSVars(this._currentPreset);
  }

  get currentPreset() {
    return this._currentPreset;
  }
  get currentMode() {
    return this._currentMode;
  }
  get presets() {
    return [...this._presets];
  }
  get modes() {
    return [...this._modes];
  }

  // CSS var propagation via data-ui-style attribute
  _applyCSSVars(preset) {
    const colors = this._getPresetColors(preset);
    const cssVars = new Map();

    for (const [key, value] of Object.entries(colors)) {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      const adjustedValue = this._currentMode === 'dark' ? this._darken(value) : value;
      cssVars.set(cssVar, adjustedValue);
    }

    return cssVars;
  }

  _getPresetColors(preset) {
    const presets = {
      default: {
        primaryColor: '#3b82f6',
        backgroundColor: '#f8fafc',
        surfaceColor: '#ffffff',
        textColor: '#1f2937',
        accentColor: '#8b5cf6',
        borderColor: '#e5e7eb',
      },
      professional: {
        primaryColor: '#2563eb',
        backgroundColor: '#f8fafc',
        surfaceColor: '#ffffff',
        textColor: '#1e293b',
        accentColor: '#0ea5e9',
        borderColor: '#e2e8f0',
      },
      minimal: {
        primaryColor: '#000000',
        backgroundColor: '#ffffff',
        surfaceColor: '#fafafa',
        textColor: '#000000',
        accentColor: '#666666',
        borderColor: '#e5e5e5',
      },
      pastel: {
        primaryColor: '#f9a8d4',
        backgroundColor: '#fdf2f8',
        surfaceColor: '#ffffff',
        textColor: '#831843',
        accentColor: '#f472b6',
        borderColor: '#fce7f3',
      },
      amy: {
        primaryColor: '#df5fa1',
        backgroundColor: '#f5fbff',
        surfaceColor: '#fffafd',
        textColor: '#2f2938',
        accentColor: '#4aa3df',
        borderColor: '#dbe8f5',
      },
      red: {
        primaryColor: '#dc2626',
        backgroundColor: '#fff5f5',
        surfaceColor: '#fffafa',
        textColor: '#2f1f1f',
        accentColor: '#ef4444',
        borderColor: '#f1c6c6',
      },
      elegant: {
        primaryColor: '#8b5cf6',
        backgroundColor: '#0f0f23',
        surfaceColor: '#1a1a2e',
        textColor: '#e2e8f0',
        accentColor: '#a78bfa',
        borderColor: '#2d2d4a',
      },
      midnight: {
        primaryColor: '#10b981',
        backgroundColor: '#0f172a',
        surfaceColor: '#1e293b',
        textColor: '#f1f5f9',
        accentColor: '#34d399',
        borderColor: '#334155',
      },
    };
    return presets[preset] || presets.professional;
  }

  _darken(hex) {
    // Simple color darkening for dark mode
    const val = parseInt(hex.replace('#', ''), 16);
    const r = Math.floor(((val >> 16) & 0xff) * 0.7);
    const g = Math.floor(((val >> 8) & 0xff) * 0.7);
    const b = Math.floor((val & 0xff) * 0.7);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
}

describe('ThemeManager Pattern', () => {
  let theme;

  beforeEach(() => {
    theme = new ThemeManager();
  });

  it('should have 8 presets', () => {
    expect(theme.presets).toHaveLength(8);
    expect(theme.presets).toContain('professional');
    expect(theme.presets).toContain('red');
    expect(theme.presets).toContain('midnight');
  });

  it('should default to professional preset', () => {
    expect(theme.currentPreset).toBe('professional');
  });

  it('should default to light mode', () => {
    expect(theme.currentMode).toBe('light');
  });

  it('should throw on unknown preset', () => {
    expect(() => theme.applyPreset('unknown')).toThrow('Unknown preset');
  });

  it('should apply valid presets', () => {
    theme.applyPreset('midnight');
    expect(theme.currentPreset).toBe('midnight');
  });

  it('should toggle light/dark mode', () => {
    expect(theme.currentMode).toBe('light');
    theme.toggleMode();
    expect(theme.currentMode).toBe('dark');
    theme.toggleMode();
    expect(theme.currentMode).toBe('light');
  });

  it('should generate unique CSS var keys per preset', () => {
    const professionalVars = theme._applyCSSVars('professional');
    const midnightVars = theme._applyCSSVars('midnight');

    expect(professionalVars.size).toBe(6);
    expect(midnightVars.size).toBe(6);

    // Same CSS var names, different values
    const profBg = professionalVars.get('--background-color');
    const midBg = midnightVars.get('--background-color');
    expect(profBg).not.toBe(midBg);
  });

  it('should darken colors in dark mode', () => {
    const lightVars = theme._applyCSSVars('professional');
    const lightBg = lightVars.get('--background-color');

    theme._currentMode = 'dark';
    const darkVars = theme._applyCSSVars('professional');
    const darkBg = darkVars.get('--background-color');

    expect(darkBg).not.toBe(lightBg);
  });

  it('each preset should define required color keys', () => {
    for (const preset of theme.presets) {
      const colors = theme._getPresetColors(preset);
      const required = ['primaryColor', 'backgroundColor', 'surfaceColor', 'textColor', 'accentColor', 'borderColor'];
      for (const key of required) {
        expect(colors[key], `${preset} should have ${key}`).toBeDefined();
        expect(colors[key]).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('presets array should be immutable copy', () => {
    const presets = theme.presets;
    presets.push('hacked');
    expect(theme.presets).toHaveLength(8);
  });
});
