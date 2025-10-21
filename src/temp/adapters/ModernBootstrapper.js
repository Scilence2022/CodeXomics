/**
 * ModernBootstrapper - Orchestrates the migration to improved function calling system
 * Initializes modern infrastructure and manages the transition
 */
class ModernBootstrapper {
    constructor() {
        this.context = null;
        this.compatibilityAdapter = null;
        this.migratedServices = new Map();
        this.isInitialized = false;
        
        // Track migration progress
        this.migrationStatus = {
            phase: 'initialization',
            startTime: Date.now(),
            completedModules: [],
            errors: [],
            performance: {
                initTime: 0,
                migrationTime: 0
            }
        };
    }
    
    /**
     * Initialize the modern infrastructure
     */
    async initialize(legacyGenomeBrowser) {
        const startTime = performance.now();
        
        console.log('🚀 [ModernBootstrapper] Starting modern infrastructure initialization...');
        
        try {
            // Phase 1: Initialize core context
            await this.initializeContext();
            
            // Phase 2: Setup compatibility layer
            await this.setupCompatibilityLayer(legacyGenomeBrowser);
            
            // Phase 3: Register core commands
            await this.registerCoreCommands();
            
            // Phase 4: Setup monitoring and metrics
            await this.setupMonitoring();
            
            const initTime = performance.now() - startTime;
            this.migrationStatus.performance.initTime = initTime;
            this.isInitialized = true;
            
            console.log(`✅ [ModernBootstrapper] Initialization completed in ${initTime.toFixed(2)}ms`);
            
            // Emit initialization complete event
            this.context.getService('eventBus').emit('bootstrap:initialized', {
                initTime,
                context: this.context,
                compatibilityAdapter: this.compatibilityAdapter
            });
            
            return {
                success: true,
                context: this.context,
                adapter: this.compatibilityAdapter,
                initTime
            };
            
        } catch (error) {
            console.error('🚨 [ModernBootstrapper] Initialization failed:', error);
            this.migrationStatus.errors.push({
                phase: 'initialization',
                error: error.message,
                timestamp: Date.now()
            });
            
            throw error;
        }
    }
    
    /**
     * Initialize the modern context system
     */
    async initializeContext() {
        console.log('🧬 [ModernBootstrapper] Initializing GenomeContext...');
        
        // Initialize context with production-ready configuration
        this.context = new GenomeContext({
            enableLogging: process.env.NODE_ENV === 'development',
            enablePerformanceTracking: true,
            maxSubscribers: 1000,
            stateHistorySize: 100
        });
        
        // Register core services
        await this.registerCoreServices();
        
        console.log('✅ [ModernBootstrapper] GenomeContext initialized');
    }
    
    /**
     * Register core services in the context
     */
    async registerCoreServices() {
        // EventBus and other core services are auto-registered in GenomeContext
        
        // Register additional core services
        const cacheManager = this.context.getService('cacheManager');
        const eventBus = this.context.getService('eventBus');
        const taskQueue = this.context.getService('taskQueue');
        
        // Register command registry
        const commandRegistry = new CommandRegistry();
        this.context.registerService('commandRegistry', commandRegistry);
        
        // Register specialized services
        this.context.registerService('migrationManager', this);
        
        console.log('✅ [ModernBootstrapper] Core services registered');
    }
    
    /**
     * Setup compatibility layer with legacy system
     */
    async setupCompatibilityLayer(legacyGenomeBrowser) {
        console.log('🔄 [ModernBootstrapper] Setting up compatibility layer...');
        
        this.compatibilityAdapter = new LegacyCompatibilityAdapter(
            this.context, 
            legacyGenomeBrowser
        );
        
        // Register the adapter as a service
        this.context.registerService('compatibilityAdapter', this.compatibilityAdapter);
        
        // Setup migration event handlers
        this.setupMigrationEventHandlers();
        
        console.log('✅ [ModernBootstrapper] Compatibility layer setup complete');
    }
    
    /**
     * Register core commands that will be used during migration
     */
    async registerCoreCommands() {
        console.log('📝 [ModernBootstrapper] Registering core commands...');
        
        const commandRegistry = this.context.getService('commandRegistry');
        
        // Register migration control commands
        const migrateModuleCommand = new Command(
            'migration:migrateModule',
            this.migrateModuleHandler.bind(this),
            {
                description: 'Migrate a specific module to modern patterns',
                category: 'migration',
                timeout: 30000,
                inputSchema: {
                    moduleName: { type: 'string', required: true },
                    force: { type: 'boolean', required: false }
                }
            }
        );
        
        commandRegistry.register(migrateModuleCommand);
        
        // Register rollback command
        const rollbackCommand = new Command(
            'migration:rollback',
            this.rollbackModuleHandler.bind(this),
            {
                description: 'Rollback a module to legacy implementation',
                category: 'migration',
                timeout: 10000,
                inputSchema: {
                    moduleName: { type: 'string', required: true },
                    reason: { type: 'string', required: false }
                }
            }
        );
        
        commandRegistry.register(rollbackCommand);
        
        console.log('✅ [ModernBootstrapper] Core commands registered');
    }
    
    /**
     * Setup monitoring and metrics collection
     */
    async setupMonitoring() {
        console.log('📊 [ModernBootstrapper] Setting up monitoring...');
        
        const eventBus = this.context.getService('eventBus');
        
        // Monitor performance issues
        eventBus.on('performance:slow', (eventData) => {
            this.handleSlowPerformance(eventData.data);
        });
        
        // Monitor errors
        eventBus.on('error', (eventData) => {
            this.handleError(eventData.data);
        });
        
        // Monitor migration progress
        eventBus.on('migration:module-completed', (eventData) => {
            this.handleModuleMigrationComplete(eventData.data);
        });
        
        console.log('✅ [ModernBootstrapper] Monitoring setup complete');
    }
    
    /**
     * Setup migration event handlers
     */
    setupMigrationEventHandlers() {
        const eventBus = this.context.getService('eventBus');
        
        // Handle migration completion
        eventBus.on('migration:module-completed', (eventData) => {
            const { moduleName } = eventData.data;
            this.migrationStatus.completedModules.push(moduleName);
            
            console.log(`✅ [ModernBootstrapper] Module '${moduleName}' migration completed`);
        });
        
        // Handle forced fallbacks
        eventBus.on('migration:forced-fallback', (eventData) => {
            const { methodName, reason } = eventData.data;
            console.warn(`🔄 [ModernBootstrapper] Forced fallback for ${methodName}: ${reason}`);
        });
    }
    
    /**
     * Start the gradual migration process
     */
    async startMigration() {
        if (!this.isInitialized) {
            throw new Error('ModernBootstrapper must be initialized before starting migration');
        }
        
        console.log('🚀 [ModernBootstrapper] Starting gradual migration process...');
        
        const migrationStartTime = performance.now();
        
        try {
            // Migrate ActionManager first (it's a core dependency)
            await this.migrateActionManager();
            
            // Migrate SequenceUtils second
            await this.migrateSequenceUtils();
            
            // Migrate other modules as needed
            // await this.migrateTrackRenderer();
            
            const migrationTime = performance.now() - migrationStartTime;
            this.migrationStatus.performance.migrationTime = migrationTime;
            this.migrationStatus.phase = 'completed';
            
            console.log(`✅ [ModernBootstrapper] Migration completed in ${migrationTime.toFixed(2)}ms`);
            
            // Emit migration complete event
            this.context.getService('eventBus').emit('migration:completed', {
                migrationTime,
                completedModules: this.migrationStatus.completedModules
            });
            
            return {
                success: true,
                migrationTime,
                completedModules: this.migrationStatus.completedModules
            };
            
        } catch (error) {
            console.error('🚨 [ModernBootstrapper] Migration failed:', error);
            this.migrationStatus.errors.push({
                phase: 'migration',
                error: error.message,
                timestamp: Date.now()
            });
            
            throw error;
        }
    }
    
    /**
     * Migrate ActionManager to command pattern
     */
    async migrateActionManager() {
        console.log('🔧 [ModernBootstrapper] Migrating ActionManager...');
        
        const result = await this.context.execute('migration:migrateModule', {
            moduleName: 'actionManager'
        });
        
        if (!result.success) {
            throw new Error(`ActionManager migration failed: ${result.error.message}`);
        }
        
        return result.data;
    }
    
    /**
     * Migrate SequenceUtils to improved patterns
     */
    async migrateSequenceUtils() {
        console.log('🧬 [ModernBootstrapper] Migrating SequenceUtils...');
        
        const result = await this.context.execute('migration:migrateModule', {
            moduleName: 'sequenceUtils'
        });
        
        if (!result.success) {
            throw new Error(`SequenceUtils migration failed: ${result.error.message}`);
        }
        
        return result.data;
    }
    
    /**
     * Command handler for module migration
     */
    async migrateModuleHandler(context, params) {
        const { moduleName, force = false } = params;
        
        console.log(`🔧 [ModernBootstrapper] Migrating module: ${moduleName}`);
        
        // Check if module is already migrated
        if (this.migratedServices.has(moduleName) && !force) {
            return {
                moduleName,
                status: 'already-migrated',
                timestamp: Date.now()
            };
        }
        
        let migratedService = null;
        
        // Migrate specific modules
        switch (moduleName) {
            case 'actionManager':
                migratedService = await this.createModernActionManager(context);
                break;
                
            case 'sequenceUtils':
                migratedService = await this.createModernSequenceUtils(context);
                break;
                
            default:
                throw new Error(`Unknown module for migration: ${moduleName}`);
        }
        
        // Store the migrated service
        this.migratedServices.set(moduleName, migratedService);
        
        // Mark module as migrated in compatibility adapter
        this.compatibilityAdapter.markModuleAsMigrated(moduleName);
        
        return {
            moduleName,
            status: 'migrated',
            service: migratedService,
            timestamp: Date.now()
        };
    }
    
    /**
     * Command handler for module rollback
     */
    async rollbackModuleHandler(context, params) {
        const { moduleName, reason = 'Manual rollback' } = params;
        
        console.log(`🔄 [ModernBootstrapper] Rolling back module: ${moduleName}`);
        
        // Force fallback in compatibility adapter
        this.compatibilityAdapter.forceLegacyFallback(moduleName, reason);
        
        // Remove from migrated services
        this.migratedServices.delete(moduleName);
        
        return {
            moduleName,
            status: 'rolled-back',
            reason,
            timestamp: Date.now()
        };
    }
    
    /**
     * Create modern ActionManager with command pattern
     */
    async createModernActionManager(context) {
        console.log('🔧 [ModernBootstrapper] Creating modern ActionManager...');
        
        // Create the ModernActionManager instance
        const modernActionManager = new ModernActionManager(context);
        
        // Register as a service
        context.registerService('modernActionManager', modernActionManager);
        
        return {
            type: 'ModernActionManager',
            instance: modernActionManager,
            initialized: true,
            commands: ['action:setCursorPosition', 'action:paste', 'action:delete', 'action:copy', 'action:executeAll']
        };
    }
    
    /**
     * Create modern SequenceUtils with improved patterns
     */
    async createModernSequenceUtils(context) {
        console.log('🧬 [ModernBootstrapper] Creating modern SequenceUtils...');
        
        // Create the ModernSequenceUtils instance
        const modernSequenceUtils = new ModernSequenceUtils(context);
        
        // Register as a service
        context.registerService('modernSequenceUtils', modernSequenceUtils);
        
        return {
            type: 'ModernSequenceUtils',
            instance: modernSequenceUtils,
            initialized: true,
            commands: ['sequence:setCursor', 'sequence:setCursorColor', 'sequence:click', 'sequence:render', 'sequence:calculatePosition']
        };
    }
    
    /**
     * Get available migrated services
     */
    getAvailableServices() {
        const services = {};
        
        for (const [serviceName, service] of this.migratedServices.entries()) {
            services[serviceName] = {
                type: service.type,
                initialized: service.initialized,
                commands: service.commands
            };
        }
        
        return services;
    }
    
    /**
     * Handle slow performance events
     */
    handleSlowPerformance(data) {
        console.warn('⚠️ [ModernBootstrapper] Slow performance detected:', data);
        
        // Log to migration status
        this.migrationStatus.errors.push({
            type: 'performance',
            data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle error events
     */
    handleError(data) {
        console.error('🚨 [ModernBootstrapper] Error detected:', data);
        
        // Log to migration status
        this.migrationStatus.errors.push({
            type: 'error',
            data,
            timestamp: Date.now()
        });
    }
    
    /**
     * Handle module migration completion
     */
    handleModuleMigrationComplete(data) {
        const { moduleName } = data;
        console.log(`✅ [ModernBootstrapper] Module '${moduleName}' migration completed`);
    }
    
    /**
     * Get migration status and metrics
     */
    getMigrationStatus() {
        return {
            ...this.migrationStatus,
            isInitialized: this.isInitialized,
            migratedServices: Array.from(this.migratedServices.keys()),
            contextMetrics: this.context?.getPerformanceMetrics(),
            eventBusMetrics: this.context?.getService('eventBus')?.getMetrics()
        };
    }
    
    /**
     * Export configuration for debugging
     */
    exportConfiguration() {
        return {
            contextState: this.context?.getAllState(),
            registeredCommands: this.context?.getService('commandRegistry')?.getNames(),
            migrationStatus: this.getMigrationStatus(),
            serviceNames: this.context?.getServiceNames()
        };
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        if (this.compatibilityAdapter) {
            this.compatibilityAdapter.destroy();
        }
        
        if (this.context) {
            this.context.destroy();
        }
        
        this.migratedServices.clear();
        
        console.log('🧹 [ModernBootstrapper] Resources cleaned up');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModernBootstrapper;
} else if (typeof window !== 'undefined') {
    window.ModernBootstrapper = ModernBootstrapper;
}