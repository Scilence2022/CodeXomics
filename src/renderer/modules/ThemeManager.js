/**
 * ThemeManager - Multi-style theme management for CodeXomics
 * Supports switching between different UI style presets (not just light/dark).
 * Each style preset defines a complete color palette via CSS custom properties.
 */
class ThemeManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.currentStyle = 'default'; // 'default' (蓝紫色AI风) or 'professional' (专业科研风)

    // Available style presets
    this.stylePresets = {
      default: {
        name: 'AI Dynamic',
        description: 'Vibrant blue-purple gradient style',
        icon: 'fa-wand-magic-sparkles',
        variables: {
          // Primary accent colors
          '--primary-color': '#3b82f6',
          '--primary-hover': '#2563eb',
          '--primary-rgb': '59, 130, 246',

          // Secondary / neutral
          '--secondary-color': '#6b7280',

          // Backgrounds
          '--bg-primary': '#ffffff',
          '--bg-secondary': '#f8fafc',
          '--bg-tertiary': '#f1f5f9',

          // Text
          '--text-primary': '#1f2937',
          '--text-secondary': '#6b7280',
          '--text-muted': '#9ca3af',

          // Borders
          '--border-color': '#e5e7eb',
          '--border-hover': '#d1d5db',

          // Header gradient
          '--header-gradient': 'linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #667eea 80%)',
          '--welcome-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',

          // Accent highlights
          '--accent-indigo': '#667eea',
          '--accent-purple': '#764ba2',
          '--accent-violet': '#8b5cf6',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          '--chat-ai-border': '#667eea',
          '--chat-tab-active': '#667eea',
          '--chat-send-bg': '#667eea',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',

          // Focus ring
          '--focus-ring': 'rgba(59, 130, 246, 0.3)',
          '--focus-ring-intense': 'rgba(59, 130, 246, 0.8)',

          // Selection
          '--selection-bg': '#3b82f6',
        },
        darkVariables: {
          '--bg-primary': '#1f2937',
          '--bg-secondary': '#111827',
          '--bg-tertiary': '#374151',
          '--text-primary': '#f9fafb',
          '--text-secondary': '#d1d5db',
          '--text-muted': '#9ca3af',
          '--border-color': '#374151',
          '--border-hover': '#4b5563',
          '--header-gradient': 'linear-gradient(135deg, #1e293b 0%, #1e3a5f 50%, #4c1d95 80%)',
        }
      },
      professional: {
        name: 'Professional',
        description: 'Clean, muted tones for scientific work',
        icon: 'fa-flask',
        variables: {
          // Primary accent colors - deep teal
          '--primary-color': '#0d7377',
          '--primary-hover': '#095456',
          '--primary-rgb': '13, 115, 119',

          // Secondary / neutral
          '--secondary-color': '#5c6b73',

          // Backgrounds - warm neutral tones
          '--bg-primary': '#ffffff',
          '--bg-secondary': '#f7f8fa',
          '--bg-tertiary': '#eceef2',

          // Text - darker, more readable
          '--text-primary': '#1a2332',
          '--text-secondary': '#4a5568',
          '--text-muted': '#8896a6',

          // Borders - subtle warm gray
          '--border-color': '#d4d9e0',
          '--border-hover': '#b8c0cc',

          // Header gradient - deep professional navy-teal
          '--header-gradient': 'linear-gradient(135deg, #1a2332 0%, #2c3e50 60%, #0d7377 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #1a2332 0%, #0d7377 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #1a2332 0%, #0d7377 100%)',

          // Accent highlights - professional tones
          '--accent-indigo': '#0d7377',
          '--accent-purple': '#5c6b73',
          '--accent-violet': '#0d7377',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #1a2332 0%, #0d7377 100%)',
          '--chat-ai-border': '#0d7377',
          '--chat-tab-active': '#0d7377',
          '--chat-send-bg': '#0d7377',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #0d7377 0%, #5c6b73 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #095456 0%, #4a5568 100%)',

          // Focus ring
          '--focus-ring': 'rgba(13, 115, 119, 0.3)',
          '--focus-ring-intense': 'rgba(13, 115, 119, 0.8)',

          // Selection
          '--selection-bg': '#0d7377',
        },
        darkVariables: {
          '--bg-primary': '#141d2b',
          '--bg-secondary': '#0f1722',
          '--bg-tertiary': '#1e2a3a',
          '--text-primary': '#e2e8f0',
          '--text-secondary': '#a0b1c4',
          '--text-muted': '#6b7f94',
          '--border-color': '#1e2a3a',
          '--border-hover': '#2d3f54',
          '--header-gradient': 'linear-gradient(135deg, #0a1018 0%, #152030 60%, #0d7377 100%)',
        }
      }
    };

    this.isInitialized = false;
  }

  /**
   * Initialize the theme manager
   */
  async init() {
    if (this.isInitialized) return;

    try {
      await this.loadStyle();
      this.applyStyle(this.currentStyle);
      this.isInitialized = true;
      console.log(`✅ [ThemeManager] Initialized with style: ${this.currentStyle}`);
    } catch (error) {
      console.error('❌ [ThemeManager] Failed to initialize:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Load saved style preference
   */
  async loadStyle() {
    if (this.configManager) {
      try {
        const savedStyle = this.configManager.get('generalSettings.uiStyle', 'default');
        if (this.stylePresets[savedStyle]) {
          this.currentStyle = savedStyle;
        }
      } catch (error) {
        console.warn('[ThemeManager] Could not load saved style, using default');
      }
    }
  }

  /**
   * Apply a style preset by name
   */
  applyStyle(styleName) {
    const preset = this.stylePresets[styleName];
    if (!preset) {
      console.error(`[ThemeManager] Unknown style: ${styleName}`);
      return;
    }

    this.currentStyle = styleName;

    // Remove any previous style class from body
    document.body.classList.remove('style-default', 'style-professional');
    document.body.classList.add(`style-${styleName}`);

    // Set data attribute for CSS selectors
    document.documentElement.setAttribute('data-ui-style', styleName);

    // Apply light-mode variables
    const root = document.documentElement;
    Object.entries(preset.variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // If dark mode is active, also apply dark overrides
    if (this.isDarkMode()) {
      Object.entries(preset.darkVariables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }

    // Update accent color input if it exists
    const accentColorInput = document.getElementById('accentColor');
    if (accentColorInput) {
      accentColorInput.value = preset.variables['--primary-color'];
    }

    // Update style selector UI if it exists
    const styleSelect = document.getElementById('uiStyle');
    if (styleSelect) {
      styleSelect.value = styleName;
    }

    console.log(`✅ [ThemeManager] Applied style: ${styleName}`);
  }

  /**
   * Check if dark mode is currently active
   */
  isDarkMode() {
    const themeMode = this.configManager?.get('generalSettings.themeMode', 'auto');
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    // auto - check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * Apply dark mode overrides for the current style
   */
  applyDarkModeOverrides(isDark) {
    const preset = this.stylePresets[this.currentStyle];
    if (!preset) return;

    const root = document.documentElement;

    if (isDark) {
      Object.entries(preset.darkVariables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    } else {
      // Restore light-mode values
      Object.entries(preset.variables).forEach(([key, value]) => {
        root.style.setProperty(key, value);
      });
    }
  }

  /**
   * Get the current style name
   */
  getCurrentStyle() {
    return this.currentStyle;
  }

  /**
   * Get available style presets
   */
  getAvailableStyles() {
    return Object.entries(this.stylePresets).map(([key, preset]) => ({
      id: key,
      name: preset.name,
      description: preset.description,
      icon: preset.icon,
    }));
  }

  /**
   * Switch to a different style
   */
  async switchStyle(styleName) {
    if (!this.stylePresets[styleName]) {
      console.error(`[ThemeManager] Unknown style: ${styleName}`);
      return;
    }

    this.applyStyle(styleName);

    // Save preference
    if (this.configManager) {
      try {
        await this.configManager.set('generalSettings.uiStyle', styleName);
        await this.configManager.saveConfig();
      } catch (error) {
        console.error('[ThemeManager] Failed to save style preference:', error);
      }
    }

    // Update GeneralSettingsManager's accent color to match the new style
    if (window.generalSettingsManager) {
      const preset = this.stylePresets[styleName];
      window.generalSettingsManager.settings.accentColor = preset.variables['--primary-color'];
      window.generalSettingsManager.settings.uiStyle = styleName;
    }

    // Emit event for other components to react
    window.dispatchEvent(new CustomEvent('uiStyleChanged', {
      detail: { style: styleName, preset: this.stylePresets[styleName] }
    }));

    console.log(`✅ [ThemeManager] Switched to style: ${styleName}`);
  }

  /**
   * Get CSS custom property value for current style
   */
  getVariable(name) {
    const preset = this.stylePresets[this.currentStyle];
    if (preset) {
      const isDark = this.isDarkMode();
      if (isDark && preset.darkVariables[name]) {
        return preset.darkVariables[name];
      }
      return preset.variables[name];
    }
    return null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
