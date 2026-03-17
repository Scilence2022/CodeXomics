/**
 * ExtensionManifest - Extension manifest schema and validation
 *
 * Modeled after VS Code's package.json extension manifest, this provides:
 * - Standardized manifest schema for extension metadata
 * - Contribution points declaration
 * - Activation events configuration
 * - Dependency management
 * - Validation and schema enforcement
 *
 * @see https://code.visualstudio.com/api/references/extension-manifest
 */

/**
 * Contribution point types
 * @readonly
 * @enum {string}
 */
const ContributionPointType = {
  /** Commands that can be invoked */
  Commands: 'commands',
  /** Menu items */
  Menus: 'menus',
  /** Keyboard shortcuts */
  Keybindings: 'keybindings',
  /** Configuration settings */
  Configuration: 'configuration',
  /** Views in sidebars */
  Views: 'views',
  /** View containers */
  ViewContainers: 'viewContainers',
  /** Custom editors */
  CustomEditors: 'customEditors',
  /** Language support */
  Languages: 'languages',
  /** Grammars for syntax highlighting */
  Grammars: 'grammars',
  /** Themes */
  Themes: 'themes',
  /** Icons */
  Icons: 'icons',
  /** Snippets */
  Snippets: 'snippets',
  /** Problem matchers */
  ProblemMatchers: 'problemMatchers',
  /** Task definitions */
  TaskDefinitions: 'taskDefinitions',
  /** Debuggers */
  Debuggers: 'debuggers',
  /** Terminal profiles */
  TerminalProfiles: 'terminalProfiles',
  /** Walkthroughs */
  Walkthroughs: 'walkthroughs',
  /** Tool functions for AI integration */
  Functions: 'functions',
  /** Data visualizations */
  Visualizations: 'visualizations',
  /** Utilities */
  Utilities: 'utilities',
};

/**
 * Activation event types
 * @readonly
 * @enum {string}
 */
const ActivationEventType = {
  /** Activate on specific command */
  OnCommand: 'onCommand',
  /** Activate on specific language */
  OnLanguage: 'onLanguage',
  /** Activate on view visibility */
  OnView: 'onView',
  /** Activate on URI scheme */
  OnUri: 'onUri',
  /** Activate on file system operation */
  OnFileSystem: 'onFileSystem',
  /** Activate on custom editor */
  OnCustomEditor: 'onCustomEditor',
  /** Activate on authentication */
  OnAuthenticationRequest: 'onAuthenticationRequest',
  /** Activate on debug */
  OnDebug: 'onDebug',
  /** Activate on workspace contains file */
  WorkspaceContains: 'workspaceContains',
  /** Activate on startup (immediately) */
  OnStartup: '*',
  /** Activate after startup finished */
  OnStartupFinished: 'onStartupFinished',
  /** Activate on web worker */
  OnWebWorker: 'onWebWorker',
  /** Custom activation event */
  Custom: 'custom',
};

/**
 * Extension categories
 * @readonly
 * @enum {string}
 */
const ExtensionCategory = {
  SequenceAnalysis: 'sequence-analysis',
  PhylogeneticAnalysis: 'phylogenetic-analysis',
  ProteinAnalysis: 'protein-analysis',
  NetworkAnalysis: 'network-analysis',
  GenomicVisualization: 'genomic-visualization',
  DataProcessing: 'data-processing',
  ExternalTools: 'external-tools',
  AIAnalysis: 'ai-analysis',
  DatabaseSearch: 'database-search',
  Utilities: 'utilities',
  Other: 'other',
};

/**
 * Schema definitions for manifest validation
 */
const ManifestSchema = {
  required: ['name', 'version', 'displayName', 'description', 'publisher'],
  optional: [
    'main',
    'browser',
    'activationEvents',
    'contributes',
    'dependencies',
    'devDependencies',
    'extensionDependencies',
    'extensionPack',
    'extensionKind',
    'capabilities',
    'keywords',
    'categories',
    'icon',
    'license',
    'repository',
    'bugs',
    'homepage',
    'qna',
    'sponsor',
    'markdown',
    'pricing',
    'badges',
    'galleryBanner',
    'preview',
    'enabledApiProposals',
    'scripts',
    'engines',
  ],
  types: {
    name: 'string',
    version: 'string',
    displayName: 'string',
    description: 'string',
    publisher: 'string',
    main: 'string',
    browser: 'string',
    activationEvents: 'array',
    contributes: 'object',
    dependencies: 'object',
    extensionDependencies: 'array',
    extensionPack: 'array',
    extensionKind: 'array',
    capabilities: 'object',
    keywords: 'array',
    categories: 'array',
    icon: 'string',
    license: 'string',
    engines: 'object',
  },
};

/**
 * Command contribution schema
 */
const CommandSchema = {
  required: ['command', 'title'],
  optional: ['category', 'icon', 'enablement', 'description', 'shortTitle'],
};

/**
 * Function contribution schema (for AI tool integration)
 */
const FunctionSchema = {
  required: ['name', 'description', 'parameters'],
  optional: ['executor', 'returnType', 'examples', 'category', 'priority'],
};

/**
 * Visualization contribution schema
 */
const VisualizationSchema = {
  required: ['id', 'name', 'supportedDataTypes'],
  optional: ['description', 'executor', 'options', 'priority'],
};

/**
 * ManifestValidationError - Error thrown during manifest validation
 */
class ManifestValidationError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} field - Field that failed validation
   * @param {string} code - Error code
   */
  constructor(message, field = '', code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ManifestValidationError';
    this.field = field;
    this.code = code;
  }
}

/**
 * ExtensionManifest - Represents an extension's manifest
 */
class ExtensionManifest {
  /**
   * @param {Object} manifest - Raw manifest object
   */
  constructor(manifest) {
    this._raw = manifest;
    this._isValid = false;
    this._validationErrors = [];

    // Parse manifest fields
    this._parseManifest();
  }

  /**
   * Parse and validate the manifest
   * @private
   */
  _parseManifest() {
    const m = this._raw;

    // Required fields
    this.name = m.name || '';
    this.version = m.version || '0.0.0';
    this.displayName = m.displayName || m.name || '';
    this.description = m.description || '';
    this.publisher = m.publisher || 'unknown';

    // Computed ID
    this.id = `${this.publisher}.${this.name}`;

    // Entry points
    this.main = m.main || null;
    this.browser = m.browser || null;

    // Activation
    this.activationEvents = m.activationEvents || [];

    // Contributions
    this.contributes = m.contributes || {};

    // Dependencies
    this.dependencies = m.dependencies || {};
    this.devDependencies = m.devDependencies || {};
    this.extensionDependencies = m.extensionDependencies || [];
    this.extensionPack = m.extensionPack || [];

    // Extension kind
    this.extensionKind = m.extensionKind || ['workspace'];

    // Capabilities
    this.capabilities = m.capabilities || {};

    // Metadata
    this.keywords = m.keywords || [];
    this.categories = m.categories || [];
    this.icon = m.icon || null;
    this.license = m.license || null;
    this.repository = m.repository || null;
    this.homepage = m.homepage || null;
    this.bugs = m.bugs || null;

    // Engine compatibility
    this.engines = m.engines || {};

    // Author info (extended)
    this.author = m.author || this.publisher;

    // Type (function, visualization, utility)
    this.type = m.type || this._inferType();

    // Priority
    this.priority = m.priority || 'normal';

    // Enabled state
    this.enabled = m.enabled !== false;

    // Preview flag
    this.preview = m.preview || false;
  }

  /**
   * Infer extension type from contributions
   * @private
   * @returns {string}
   */
  _inferType() {
    const c = this.contributes;

    if (c.functions && Object.keys(c.functions).length > 0) {
      return 'function';
    }
    if (c.visualizations && Object.keys(c.visualizations).length > 0) {
      return 'visualization';
    }
    if (c.utilities && Object.keys(c.utilities).length > 0) {
      return 'utility';
    }
    if (c.commands && c.commands.length > 0) {
      return 'command';
    }

    return 'generic';
  }

  /**
   * Get the raw manifest object
   * @returns {Object}
   */
  get raw() {
    return this._raw;
  }

  /**
   * Check if manifest is valid
   * @returns {boolean}
   */
  get isValid() {
    return this._isValid;
  }

  /**
   * Get validation errors
   * @returns {ManifestValidationError[]}
   */
  get validationErrors() {
    return this._validationErrors;
  }

  /**
   * Get all contributed commands
   * @returns {Object[]}
   */
  getCommands() {
    return this.contributes.commands || [];
  }

  /**
   * Get all contributed functions
   * @returns {Object}
   */
  getFunctions() {
    return this.contributes.functions || {};
  }

  /**
   * Get all contributed visualizations
   * @returns {Object}
   */
  getVisualizations() {
    return this.contributes.visualizations || {};
  }

  /**
   * Get configuration contribution
   * @returns {Object}
   */
  getConfiguration() {
    return this.contributes.configuration || {};
  }

  /**
   * Check if extension should activate on specific event
   * @param {string} event - Activation event
   * @returns {boolean}
   */
  shouldActivateOn(event) {
    if (this.activationEvents.includes('*')) {
      return true;
    }

    return this.activationEvents.some(ae => {
      if (ae === event) {
        return true;
      }

      // Handle parameterized events like "onCommand:myCommand"
      if (ae.includes(':')) {
        const [aeType, aeParam] = ae.split(':');
        const [eventType, eventParam] = event.split(':');
        return aeType === eventType && aeParam === eventParam;
      }

      return false;
    });
  }

  /**
   * Check if this extension depends on another
   * @param {string} extensionId - Extension ID to check
   * @returns {boolean}
   */
  dependsOn(extensionId) {
    return this.extensionDependencies.includes(extensionId);
  }

  /**
   * Convert manifest to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      version: this.version,
      displayName: this.displayName,
      description: this.description,
      publisher: this.publisher,
      main: this.main,
      browser: this.browser,
      activationEvents: this.activationEvents,
      contributes: this.contributes,
      extensionDependencies: this.extensionDependencies,
      extensionKind: this.extensionKind,
      categories: this.categories,
      keywords: this.keywords,
      type: this.type,
      priority: this.priority,
      enabled: this.enabled,
    };
  }
}

/**
 * ManifestValidator - Validates extension manifests
 */
class ManifestValidator {
  constructor(options = {}) {
    this._options = {
      strict: options.strict || false,
      allowUnknownFields: options.allowUnknownFields !== false,
      customValidators: options.customValidators || [],
    };
  }

  /**
   * Validate a manifest
   * @param {Object|ExtensionManifest} manifest - Manifest to validate
   * @returns {{isValid: boolean, errors: ManifestValidationError[], warnings: string[]}}
   */
  validate(manifest) {
    const raw = manifest instanceof ExtensionManifest ? manifest._raw : manifest;
    const errors = [];
    const warnings = [];

    // Validate required fields
    for (const field of ManifestSchema.required) {
      if (!raw[field]) {
        errors.push(new ManifestValidationError(`Missing required field: ${field}`, field, 'MISSING_REQUIRED'));
      }
    }

    // Validate field types
    for (const [field, expectedType] of Object.entries(ManifestSchema.types)) {
      if (raw[field] !== undefined && !this._validateType(raw[field], expectedType)) {
        errors.push(
          new ManifestValidationError(`Invalid type for ${field}: expected ${expectedType}`, field, 'INVALID_TYPE')
        );
      }
    }

    // Validate version format (semver)
    if (raw.version && !this._isValidSemver(raw.version)) {
      errors.push(
        new ManifestValidationError(
          'Invalid version format. Expected semver (e.g., 1.0.0)',
          'version',
          'INVALID_VERSION'
        )
      );
    }

    // Validate name format
    if (raw.name && !this._isValidName(raw.name)) {
      errors.push(
        new ManifestValidationError(
          'Invalid extension name. Use lowercase letters, numbers, and hyphens',
          'name',
          'INVALID_NAME'
        )
      );
    }

    // Validate activation events
    if (raw.activationEvents) {
      const aeErrors = this._validateActivationEvents(raw.activationEvents);
      errors.push(...aeErrors);
    }

    // Validate contributions
    if (raw.contributes) {
      const contribErrors = this._validateContributions(raw.contributes);
      errors.push(...contribErrors);
    }

    // Validate engine compatibility
    if (raw.engines) {
      const engineWarnings = this._validateEngines(raw.engines);
      warnings.push(...engineWarnings);
    }

    // Run custom validators
    for (const validator of this._options.customValidators) {
      try {
        const result = validator(raw);
        if (result.errors) {
          errors.push(...result.errors);
        }
        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      } catch (error) {
        console.error('Custom validator error:', error);
      }
    }

    const isValid = errors.length === 0;

    // Update manifest validity if it's an ExtensionManifest instance
    if (manifest instanceof ExtensionManifest) {
      manifest._isValid = isValid;
      manifest._validationErrors = errors;
    }

    return { isValid, errors, warnings };
  }

  /**
   * Validate type of a value
   * @private
   * @param {any} value
   * @param {string} expectedType
   * @returns {boolean}
   */
  _validateType(value, expectedType) {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Validate semver format
   * @private
   * @param {string} version
   * @returns {boolean}
   */
  _isValidSemver(version) {
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?(\+[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;
    return semverRegex.test(version);
  }

  /**
   * Validate extension name format
   * @private
   * @param {string} name
   * @returns {boolean}
   */
  _isValidName(name) {
    const nameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/;
    return nameRegex.test(name);
  }

  /**
   * Validate activation events
   * @private
   * @param {string[]} events
   * @returns {ManifestValidationError[]}
   */
  _validateActivationEvents(events) {
    const errors = [];
    const validPrefixes = Object.values(ActivationEventType);

    for (const event of events) {
      if (event === '*' || event === 'onStartupFinished') {
        continue;
      }

      const [prefix] = event.split(':');
      const isValid = validPrefixes.some(vp => vp === prefix || event.startsWith(vp));

      if (!isValid && this._options.strict) {
        errors.push(
          new ManifestValidationError(
            `Unknown activation event: ${event}`,
            'activationEvents',
            'UNKNOWN_ACTIVATION_EVENT'
          )
        );
      }
    }

    return errors;
  }

  /**
   * Validate contributions
   * @private
   * @param {Object} contributes
   * @returns {ManifestValidationError[]}
   */
  _validateContributions(contributes) {
    const errors = [];

    // Validate commands
    if (contributes.commands) {
      for (const cmd of contributes.commands) {
        for (const req of CommandSchema.required) {
          if (!cmd[req]) {
            errors.push(
              new ManifestValidationError(
                `Command missing required field: ${req}`,
                `contributes.commands.${cmd.command || 'unknown'}`,
                'INVALID_COMMAND'
              )
            );
          }
        }
      }
    }

    // Validate functions
    if (contributes.functions) {
      for (const [funcName, func] of Object.entries(contributes.functions)) {
        for (const req of FunctionSchema.required) {
          if (!func[req]) {
            errors.push(
              new ManifestValidationError(
                `Function ${funcName} missing required field: ${req}`,
                `contributes.functions.${funcName}`,
                'INVALID_FUNCTION'
              )
            );
          }
        }

        // Validate parameters schema
        if (func.parameters && !this._validateParameterSchema(func.parameters)) {
          errors.push(
            new ManifestValidationError(
              `Function ${funcName} has invalid parameter schema`,
              `contributes.functions.${funcName}.parameters`,
              'INVALID_PARAMETERS'
            )
          );
        }
      }
    }

    // Validate visualizations
    if (contributes.visualizations) {
      for (const [vizId, viz] of Object.entries(contributes.visualizations)) {
        for (const req of VisualizationSchema.required) {
          if (!viz[req]) {
            errors.push(
              new ManifestValidationError(
                `Visualization ${vizId} missing required field: ${req}`,
                `contributes.visualizations.${vizId}`,
                'INVALID_VISUALIZATION'
              )
            );
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validate parameter schema (JSON Schema subset)
   * @private
   * @param {Object} schema
   * @returns {boolean}
   */
  _validateParameterSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];

    if (schema.type && !validTypes.includes(schema.type)) {
      return false;
    }

    // Validate properties if present
    if (schema.properties) {
      for (const prop of Object.values(schema.properties)) {
        if (!this._validateParameterSchema(prop)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Validate engine compatibility
   * @private
   * @param {Object} engines
   * @returns {string[]}
   */
  _validateEngines(engines) {
    const warnings = [];

    if (engines.vscode && !this._isValidVersionRange(engines.vscode)) {
      warnings.push(`Invalid vscode engine version range: ${engines.vscode}`);
    }

    if (engines.node && !this._isValidVersionRange(engines.node)) {
      warnings.push(`Invalid node engine version range: ${engines.node}`);
    }

    return warnings;
  }

  /**
   * Validate version range format
   * @private
   * @param {string} range
   * @returns {boolean}
   */
  _isValidVersionRange(range) {
    // Simple validation for version ranges like ^1.0.0, >=1.0.0, etc.
    const rangeRegex = /^[\^~>=<]*\d+\.\d+\.\d+(-\w+)?$/;
    return rangeRegex.test(range);
  }
}

/**
 * ManifestParser - Parses and creates ExtensionManifest instances
 */
class ManifestParser {
  constructor() {
    this._validator = new ManifestValidator();
  }

  /**
   * Parse a manifest from object
   * @param {Object} raw - Raw manifest object
   * @param {boolean} validate - Whether to validate
   * @returns {ExtensionManifest}
   */
  parse(raw, validate = true) {
    const manifest = new ExtensionManifest(raw);

    if (validate) {
      this._validator.validate(manifest);
    }

    return manifest;
  }

  /**
   * Parse a manifest from JSON string
   * @param {string} json - JSON string
   * @param {boolean} validate - Whether to validate
   * @returns {ExtensionManifest}
   */
  parseJSON(json, validate = true) {
    const raw = JSON.parse(json);
    return this.parse(raw, validate);
  }

  /**
   * Create a new manifest with defaults
   * @param {Object} overrides - Override values
   * @returns {ExtensionManifest}
   */
  create(overrides = {}) {
    const defaults = {
      name: 'untitled-extension',
      version: '0.0.1',
      displayName: 'Untitled Extension',
      description: 'A new extension',
      publisher: 'unknown',
      activationEvents: ['onStartupFinished'],
      contributes: {},
      engines: {
        genome: '^1.0.0',
      },
    };

    return this.parse({ ...defaults, ...overrides });
  }

  /**
   * Merge two manifests
   * @param {ExtensionManifest} base - Base manifest
   * @param {Object} overrides - Override values
   * @returns {ExtensionManifest}
   */
  merge(base, overrides) {
    const merged = {
      ...base._raw,
      ...overrides,
      contributes: {
        ...base.contributes,
        ...(overrides.contributes || {}),
      },
    };

    return this.parse(merged);
  }
}

/**
 * ManifestBuilder - Fluent builder for creating manifests
 */
class ManifestBuilder {
  constructor() {
    this._manifest = {
      name: '',
      version: '0.0.1',
      displayName: '',
      description: '',
      publisher: '',
      activationEvents: [],
      contributes: {},
    };
  }

  /**
   * Set basic info
   */
  name(name) {
    this._manifest.name = name;
    return this;
  }
  version(version) {
    this._manifest.version = version;
    return this;
  }
  displayName(name) {
    this._manifest.displayName = name;
    return this;
  }
  description(desc) {
    this._manifest.description = desc;
    return this;
  }
  publisher(pub) {
    this._manifest.publisher = pub;
    return this;
  }
  author(author) {
    this._manifest.author = author;
    return this;
  }

  /**
   * Set entry point
   * @param {string} path
   */
  main(path) {
    this._manifest.main = path;
    return this;
  }

  /**
   * Add activation event
   * @param {string} event
   */
  activateOn(event) {
    this._manifest.activationEvents.push(event);
    return this;
  }

  /**
   * Add multiple activation events
   * @param {string[]} events
   */
  activateOnAny(events) {
    this._manifest.activationEvents.push(...events);
    return this;
  }

  /**
   * Activate on startup
   */
  activateOnStartup() {
    this._manifest.activationEvents.push('*');
    return this;
  }

  /**
   * Add a command
   * @param {Object} command
   */
  command(command) {
    if (!this._manifest.contributes.commands) {
      this._manifest.contributes.commands = [];
    }
    this._manifest.contributes.commands.push(command);
    return this;
  }

  /**
   * Add a function
   * @param {string} name
   * @param {Object} func
   */
  function(name, func) {
    if (!this._manifest.contributes.functions) {
      this._manifest.contributes.functions = {};
    }
    this._manifest.contributes.functions[name] = func;
    return this;
  }

  /**
   * Add a visualization
   * @param {string} id
   * @param {Object} viz
   */
  visualization(id, viz) {
    if (!this._manifest.contributes.visualizations) {
      this._manifest.contributes.visualizations = {};
    }
    this._manifest.contributes.visualizations[id] = viz;
    return this;
  }

  /**
   * Add configuration
   * @param {Object} config
   */
  configuration(config) {
    this._manifest.contributes.configuration = config;
    return this;
  }

  /**
   * Add extension dependency
   * @param {string} extensionId
   */
  dependsOn(extensionId) {
    if (!this._manifest.extensionDependencies) {
      this._manifest.extensionDependencies = [];
    }
    this._manifest.extensionDependencies.push(extensionId);
    return this;
  }

  /**
   * Set categories
   * @param {string[]} categories
   */
  categories(categories) {
    this._manifest.categories = categories;
    return this;
  }

  /**
   * Set keywords
   * @param {string[]} keywords
   */
  keywords(keywords) {
    this._manifest.keywords = keywords;
    return this;
  }

  /**
   * Build the manifest
   * @returns {ExtensionManifest}
   */
  build() {
    const parser = new ManifestParser();
    return parser.parse(this._manifest);
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExtensionManifest,
    ManifestValidator,
    ManifestParser,
    ManifestBuilder,
    ManifestValidationError,
    ContributionPointType,
    ActivationEventType,
    ExtensionCategory,
    ManifestSchema,
    CommandSchema,
    FunctionSchema,
    VisualizationSchema,
  };
} else if (typeof window !== 'undefined') {
  window.ExtensionManifest = ExtensionManifest;
  window.ManifestValidator = ManifestValidator;
  window.ManifestParser = ManifestParser;
  window.ManifestBuilder = ManifestBuilder;
  window.ManifestValidationError = ManifestValidationError;
  window.ContributionPointType = ContributionPointType;
  window.ActivationEventType = ActivationEventType;
  window.ExtensionCategory = ExtensionCategory;
}
