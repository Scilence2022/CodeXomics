/**
 * ThemeManager - Multi-style theme management for CodeXomics
 * Supports switching between different light-mode UI style presets.
 * Each style preset defines a complete color palette via CSS custom properties.
 */
class ThemeManager {
  constructor(configManager) {
    this.configManager = configManager;
    this.currentStyle = 'default'; // 'default' (蓝紫色AI风), 'professional' (专业科研风), or 'minimal' (极简琥珀风)

    // The early style application (flash-of-default prevention) is handled by
    // the inline <script> in index.html which reads _uiStyleHint from localStorage
    // and applies CSS custom properties before any external scripts load.
    // Check if the inline script already set a style so we stay in sync.
    try {
      var hint = localStorage.getItem('_uiStyleHint');
      if (hint && hint !== 'default') {
        this.currentStyle = hint;
      }
    } catch (_) {}

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
          // Backgrounds - dark slate
          '--bg-primary': '#1f2937',
          '--bg-secondary': '#111827',
          '--bg-tertiary': '#374151',

          // Text - light on dark
          '--text-primary': '#f9fafb',
          '--text-secondary': '#d1d5db',
          '--text-muted': '#9ca3af',

          // Borders
          '--border-color': '#374151',
          '--border-hover': '#4b5563',

          // Header gradients - darker versions
          '--header-gradient': 'linear-gradient(135deg, #1e293b 0%, #1e3a5f 50%, #4c1d95 80%)',
          '--welcome-gradient': 'linear-gradient(135deg, #1e293b 0%, #667eea 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #1e293b 0%, #667eea 100%)',

          // Accent highlights - brighter for dark bg
          '--accent-indigo': '#818cf8',
          '--accent-purple': '#a78bfa',
          '--accent-violet': '#a78bfa',

          // Chat bubble colors - adjusted for dark
          '--chat-user-bg': 'linear-gradient(135deg, #1e293b 0%, #667eea 100%)',
          '--chat-ai-border': '#818cf8',
          '--chat-tab-active': '#818cf8',
          '--chat-send-bg': '#818cf8',

          // Button gradient - brighter for dark
          '--btn-gradient': 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',

          // Selection
          '--selection-bg': '#60a5fa',
        },
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
          // Backgrounds - dark navy
          '--bg-primary': '#141d2b',
          '--bg-secondary': '#0f1722',
          '--bg-tertiary': '#1e2a3a',

          // Text
          '--text-primary': '#e2e8f0',
          '--text-secondary': '#a0b1c4',
          '--text-muted': '#6b7f94',

          // Borders
          '--border-color': '#1e2a3a',
          '--border-hover': '#2d3f54',

          // Header gradients
          '--header-gradient': 'linear-gradient(135deg, #0a1018 0%, #152030 60%, #0d7377 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #0a1018 0%, #0d7377 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #0a1018 0%, #0d7377 100%)',

          // Accent highlights - brighter teal
          '--accent-indigo': '#2dd4bf',
          '--accent-purple': '#5c6b73',
          '--accent-violet': '#2dd4bf',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #0f1722 0%, #0d7377 100%)',
          '--chat-ai-border': '#2dd4bf',
          '--chat-tab-active': '#2dd4bf',
          '--chat-send-bg': '#2dd4bf',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #14b8a6 0%, #5c6b73 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #0d7377 0%, #4a5568 100%)',

          // Selection
          '--selection-bg': '#14b8a6',
        },
      },
      minimal: {
        name: 'Minimal',
        description: 'Elegant warm-gray with amber accent',
        icon: 'fa-feather',
        variables: {
          // Primary accent - warm amber
          '--primary-color': '#c87d2f',
          '--primary-hover': '#a86520',
          '--primary-rgb': '200, 125, 47',

          // Secondary / neutral
          '--secondary-color': '#8c8c8c',

          // Backgrounds - cool warm-gray
          '--bg-primary': '#fafaf9',
          '--bg-secondary': '#f5f4f1',
          '--bg-tertiary': '#eceae5',

          // Text - charcoal
          '--text-primary': '#2c2c2c',
          '--text-secondary': '#666666',
          '--text-muted': '#999999',

          // Borders - soft warm
          '--border-color': '#e0ddd8',
          '--border-hover': '#ccc8c0',

          // Header gradient - warm charcoal to amber
          '--header-gradient': 'linear-gradient(135deg, #3c3c3c 0%, #5a534a 60%, #c87d2f 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #3c3c3c 0%, #c87d2f 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #3c3c3c 0%, #c87d2f 100%)',

          // Accent highlights
          '--accent-indigo': '#c87d2f',
          '--accent-purple': '#8c8c8c',
          '--accent-violet': '#c87d2f',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #3c3c3c 0%, #c87d2f 100%)',
          '--chat-ai-border': '#c87d2f',
          '--chat-tab-active': '#c87d2f',
          '--chat-send-bg': '#c87d2f',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #c87d2f 0%, #a86520 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #a86520 0%, #8c5518 100%)',

          // Focus ring
          '--focus-ring': 'rgba(200, 125, 47, 0.3)',
          '--focus-ring-intense': 'rgba(200, 125, 47, 0.8)',

          // Selection
          '--selection-bg': '#c87d2f',
        },
        darkVariables: {
          // Backgrounds - warm dark
          '--bg-primary': '#1c1b19',
          '--bg-secondary': '#141311',
          '--bg-tertiary': '#2a2824',

          // Text
          '--text-primary': '#e8e4dc',
          '--text-secondary': '#b0a898',
          '--text-muted': '#7a7468',

          // Borders
          '--border-color': '#2a2824',
          '--border-hover': '#3d3930',

          // Header gradients
          '--header-gradient': 'linear-gradient(135deg, #141311 0%, #2a2520 60%, #c87d2f 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #141311 0%, #c87d2f 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #141311 0%, #c87d2f 100%)',

          // Accent highlights - warmer amber for dark
          '--accent-indigo': '#d4a054',
          '--accent-purple': '#8c8c8c',
          '--accent-violet': '#d4a054',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #141311 0%, #c87d2f 100%)',
          '--chat-ai-border': '#d4a054',
          '--chat-tab-active': '#d4a054',
          '--chat-send-bg': '#d4a054',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #d4a054 0%, #a86520 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #c87d2f 0%, #8c5518 100%)',

          // Selection
          '--selection-bg': '#d4a054',
        },
      },
      elegant: {
        name: 'Elegant Gray',
        description: 'Sophisticated monochrome with silver accents',
        icon: 'fa-gem',
        variables: {
          // Primary accent - cool silver
          '--primary-color': '#6b6b6b',
          '--primary-hover': '#4a4a4a',
          '--primary-rgb': '107, 107, 107',

          // Secondary / neutral
          '--secondary-color': '#9e9e9e',

          // Backgrounds - cool grays with blue undertone
          '--bg-primary': '#ffffff',
          '--bg-secondary': '#f7f7f8',
          '--bg-tertiary': '#ededee',

          // Text - near black
          '--text-primary': '#1a1a1a',
          '--text-secondary': '#555555',
          '--text-muted': '#8c8c8c',

          // Borders - subtle cool gray
          '--border-color': '#dcdcdc',
          '--border-hover': '#c0c0c0',

          // Header gradient - deep charcoal to silver
          '--header-gradient': 'linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 60%, #6b6b6b 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #2a2a2a 0%, #6b6b6b 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #2a2a2a 0%, #6b6b6b 100%)',

          // Accent highlights - monochrome
          '--accent-indigo': '#6b6b6b',
          '--accent-purple': '#8c8c8c',
          '--accent-violet': '#555555',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #2a2a2a 0%, #6b6b6b 100%)',
          '--chat-ai-border': '#6b6b6b',
          '--chat-tab-active': '#6b6b6b',
          '--chat-send-bg': '#6b6b6b',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #6b6b6b 0%, #3a3a3a 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #4a4a4a 0%, #2a2a2a 100%)',

          // Focus ring
          '--focus-ring': 'rgba(107, 107, 107, 0.3)',
          '--focus-ring-intense': 'rgba(107, 107, 107, 0.8)',

          // Selection
          '--selection-bg': '#6b6b6b',
        },
        darkVariables: {
          // Backgrounds - pure dark
          '--bg-primary': '#1a1a1a',
          '--bg-secondary': '#111111',
          '--bg-tertiary': '#2a2a2a',

          // Text
          '--text-primary': '#f0f0f0',
          '--text-secondary': '#b0b0b0',
          '--text-muted': '#707070',

          // Borders
          '--border-color': '#2a2a2a',
          '--border-hover': '#3d3d3d',

          // Header gradients
          '--header-gradient': 'linear-gradient(135deg, #111111 0%, #1f1f1f 60%, #6b6b6b 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #111111 0%, #6b6b6b 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #111111 0%, #6b6b6b 100%)',

          // Accent highlights - lighter silver for dark
          '--accent-indigo': '#9e9e9e',
          '--accent-purple': '#8c8c8c',
          '--accent-violet': '#b0b0b0',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #111111 0%, #6b6b6b 100%)',
          '--chat-ai-border': '#9e9e9e',
          '--chat-tab-active': '#9e9e9e',
          '--chat-send-bg': '#9e9e9e',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #9e9e9e 0%, #4a4a4a 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #6b6b6b 0%, #3a3a3a 100%)',

          // Selection
          '--selection-bg': '#9e9e9e',
        },
      },
      midnight: {
        name: 'Midnight',
        description: 'Deep navy with icy cyan-blue accents',
        icon: 'fa-snowflake',
        variables: {
          // Primary accent - icy cyan-blue
          '--primary-color': '#0891b2',
          '--primary-hover': '#0e7490',
          '--primary-rgb': '8, 145, 178',

          // Secondary / neutral
          '--secondary-color': '#64748b',

          // Backgrounds - cool icy light
          '--bg-primary': '#f8fafc',
          '--bg-secondary': '#f1f5f9',
          '--bg-tertiary': '#e2e8f0',

          // Text - deep navy
          '--text-primary': '#0f172a',
          '--text-secondary': '#475569',
          '--text-muted': '#94a3b8',

          // Borders - cool slate
          '--border-color': '#cbd5e1',
          '--border-hover': '#94a3b8',

          // Header gradient - navy to cyan
          '--header-gradient': 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #22d3ee 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #0f172a 0%, #22d3ee 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #0f172a 0%, #22d3ee 100%)',

          // Accent highlights
          '--accent-indigo': '#0891b2',
          '--accent-purple': '#64748b',
          '--accent-violet': '#06b6d4',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #1e293b 0%, #22d3ee 100%)',
          '--chat-ai-border': '#0891b2',
          '--chat-tab-active': '#0891b2',
          '--chat-send-bg': '#0891b2',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #0e7490 0%, #155e75 100%)',

          // Focus ring
          '--focus-ring': 'rgba(8, 145, 178, 0.3)',
          '--focus-ring-intense': 'rgba(8, 145, 178, 0.8)',

          // Selection
          '--selection-bg': '#0891b2',
        },
        darkVariables: {
          // Backgrounds - deep navy
          '--bg-primary': '#0f172a',
          '--bg-secondary': '#1e293b',
          '--bg-tertiary': '#334155',

          // Text
          '--text-primary': '#e2e8f0',
          '--text-secondary': '#94a3b8',
          '--text-muted': '#64748b',

          // Borders
          '--border-color': '#1e293b',
          '--border-hover': '#475569',

          // Header gradients
          '--header-gradient': 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #22d3ee 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #0f172a 0%, #22d3ee 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #0f172a 0%, #22d3ee 100%)',

          // Accent highlights - brighter cyan for dark
          '--accent-indigo': '#22d3ee',
          '--accent-purple': '#64748b',
          '--accent-violet': '#06b6d4',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #1e293b 0%, #22d3ee 100%)',
          '--chat-ai-border': '#22d3ee',
          '--chat-tab-active': '#22d3ee',
          '--chat-send-bg': '#22d3ee',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #06b6d4 0%, #0e7490 100%)',

          // Selection
          '--selection-bg': '#22d3ee',
        },
      },
      pastel: {
        name: 'Pastel',
        description: 'Soft lavender-rose with light airy tones',
        icon: 'fa-cloud',
        variables: {
          // Primary accent - soft rose
          '--primary-color': '#b07fb0',
          '--primary-hover': '#966896',
          '--primary-rgb': '176, 127, 176',

          // Secondary / neutral
          '--secondary-color': '#9ca3af',

          // Backgrounds - very light lavender-blush
          '--bg-primary': '#faf8fc',
          '--bg-secondary': '#f5f0f8',
          '--bg-tertiary': '#ede6f2',

          // Text - soft dark
          '--text-primary': '#3d3245',
          '--text-secondary': '#6b5f75',
          '--text-muted': '#9e93a8',

          // Borders - light lavender
          '--border-color': '#e2d9ea',
          '--border-hover': '#cec2d8',

          // Header gradient - soft lavender to rose
          '--header-gradient': 'linear-gradient(135deg, #5c4d6d 0%, #8b6f9a 50%, #b07fb0 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #6d5880 0%, #b07fb0 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #6d5880 0%, #b07fb0 100%)',

          // Accent highlights
          '--accent-indigo': '#b07fb0',
          '--accent-purple': '#8b6f9a',
          '--accent-violet': '#c494c4',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #6d5880 0%, #b07fb0 100%)',
          '--chat-ai-border': '#b07fb0',
          '--chat-tab-active': '#b07fb0',
          '--chat-send-bg': '#b07fb0',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #b07fb0 0%, #8b6f9a 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #966896 0%, #755a84 100%)',

          // Focus ring
          '--focus-ring': 'rgba(176, 127, 176, 0.3)',
          '--focus-ring-intense': 'rgba(176, 127, 176, 0.8)',

          // Selection
          '--selection-bg': '#b07fb0',
        },
        darkVariables: {
          // Backgrounds - dark purple
          '--bg-primary': '#1e1828',
          '--bg-secondary': '#16111f',
          '--bg-tertiary': '#2a2238',

          // Text
          '--text-primary': '#e8e0f0',
          '--text-secondary': '#b8aac8',
          '--text-muted': '#847894',

          // Borders
          '--border-color': '#2a2238',
          '--border-hover': '#3d3350',

          // Header gradients
          '--header-gradient': 'linear-gradient(135deg, #16111f 0%, #2a2238 60%, #b07fb0 100%)',
          '--welcome-gradient': 'linear-gradient(135deg, #16111f 0%, #b07fb0 100%)',
          '--modal-header-gradient': 'linear-gradient(135deg, #16111f 0%, #b07fb0 100%)',

          // Accent highlights - brighter rose for dark
          '--accent-indigo': '#d4a5d4',
          '--accent-purple': '#a78bba',
          '--accent-violet': '#e0b8e0',

          // Chat bubble colors
          '--chat-user-bg': 'linear-gradient(135deg, #16111f 0%, #b07fb0 100%)',
          '--chat-ai-border': '#d4a5d4',
          '--chat-tab-active': '#d4a5d4',
          '--chat-send-bg': '#d4a5d4',

          // Button gradient
          '--btn-gradient': 'linear-gradient(135deg, #d4a5d4 0%, #a78bba 100%)',
          '--btn-gradient-hover': 'linear-gradient(135deg, #b07fb0 0%, #8b6f9a 100%)',

          // Selection
          '--selection-bg': '#d4a5d4',
        },
      },
    };

    this.isInitialized = false;
  }

  /**
   * Initialize the theme manager
   */
  async init() {
    if (this.isInitialized) return;

    try {
      // Wait for ConfigManager to finish loading before reading settings
      if (this.configManager?.waitForInit) {
        await this.configManager.waitForInit();
      }

      const styleBeforeLoad = this.currentStyle;
      await this.loadStyle();

      // Always call applyStyle() to ensure CSS custom properties are set.
      // The constructor applied body class / data-attribute eagerly to prevent
      // a flash, but the full CSS variable overrides require the presets map
      // which is now available.
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
    document.body.classList.remove(
      'style-default',
      'style-professional',
      'style-minimal',
      'style-pastel',
      'style-elegant',
      'style-midnight'
    );
    document.body.classList.add(`style-${styleName}`);

    // Set data attribute for CSS selectors
    document.documentElement.setAttribute('data-ui-style', styleName);

    // Apply light-mode variables
    const root = document.documentElement;
    Object.entries(preset.variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Persist style hint to localStorage so the inline script in index.html can
    // apply it synchronously on the next launch, eliminating the flash of default style.
    try {
      localStorage.setItem('_uiStyleHint', styleName);
      localStorage.setItem('_themeHint', 'light');
    } catch (_) {
      // Ignore if localStorage is unavailable
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
    return false;
  }

  /**
   * Keep the current style in light mode.
   */
  applyDarkModeOverrides() {
    const preset = this.stylePresets[this.currentStyle];
    if (!preset) return;

    const root = document.documentElement;

    Object.entries(preset.variables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Persist theme mode hint for the inline early-style script
    try {
      localStorage.setItem('_themeHint', 'light');
    } catch (_) {}

    // Dispatch event so other windows (e.g., Project Manager) can sync
    window.dispatchEvent(
      new CustomEvent('uiStyleChanged', {
        detail: { style: this.currentStyle, preset: preset, isDark: false },
      })
    );
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
    window.dispatchEvent(
      new CustomEvent('uiStyleChanged', {
        detail: { style: styleName, preset: this.stylePresets[styleName], isDark: false },
      })
    );

    console.log(`✅ [ThemeManager] Switched to style: ${styleName}`);
  }

  /**
   * Get CSS custom property value for current style
   */
  getVariable(name) {
    const preset = this.stylePresets[this.currentStyle];
    if (preset) {
      return preset.variables[name];
    }
    return null;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
}
