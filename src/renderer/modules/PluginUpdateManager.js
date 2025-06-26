/**
 * PluginUpdateManager - Advanced plugin update management system
 * Handles automatic updates, version management, and rollback functionality
 */
class PluginUpdateManager {
    constructor(marketplace) {
        this.marketplace = marketplace;
        
        // Update state management
        this.updateQueue = new Map();
        this.updateHistory = new Map();
        this.rollbackPoints = new Map();
        
        // Update configuration
        this.config = {
            enableAutoUpdates: true,
            updateCheckInterval: 3600000, // 1 hour
            batchUpdateSize: 3,
            rollbackRetention: 30 // days
        };
        
        // Update statistics
        this.stats = {
            totalUpdates: 0,
            automaticUpdates: 0,
            manualUpdates: 0,
            failedUpdates: 0,
            rollbacks: 0,
            securityUpdates: 0
        };
        
        console.log('🔄 PluginUpdateManager initialized');
        this.initialize();
    }

    /**
     * Initialize update manager
     */
    async initialize() {
        try {
            // Load update history
            await this.loadUpdateHistory();
            
            // Load rollback points
            await this.loadRollbackPoints();
            
            // Setup automatic update checking
            this.setupAutomaticUpdateChecking();
            
            console.log('✅ PluginUpdateManager initialization complete');
            
        } catch (error) {
            console.error('❌ PluginUpdateManager initialization failed:', error);
            throw error;
        }
    }

    /**
     * Check for available updates
     */
    async checkForUpdates(pluginIds = null) {
        try {
            console.log('🔍 Checking for plugin updates...');
            
            const installedPlugins = this.marketplace.installedPlugins;
            const pluginsToCheck = pluginIds 
                ? Array.from(installedPlugins.keys()).filter(id => pluginIds.includes(id))
                : Array.from(installedPlugins.keys());
            
            const availableUpdates = [];
            
            // Check each plugin for updates
            for (const pluginId of pluginsToCheck) {
                try {
                    const installedPlugin = installedPlugins.get(pluginId);
                    const updateInfo = await this.checkPluginUpdate(pluginId, installedPlugin);
                    
                    if (updateInfo.hasUpdate) {
                        availableUpdates.push({
                            pluginId,
                            installedVersion: installedPlugin.version,
                            availableVersion: updateInfo.latestVersion,
                            updateType: updateInfo.updateType,
                            autoUpdate: updateInfo.autoUpdate,
                            securityUpdate: updateInfo.securityUpdate,
                            plugin: updateInfo.plugin
                        });
                    }
                    
                } catch (error) {
                    console.error(`❌ Failed to check updates for ${pluginId}:`, error);
                }
            }
            
            console.log(`✅ Update check complete: ${availableUpdates.length} updates available`);
            
            // Emit update check event
            this.marketplace.emitEvent('updates-checked', {
                availableUpdates: availableUpdates.length,
                timestamp: Date.now()
            });
            
            return { availableUpdates };
            
        } catch (error) {
            console.error('❌ Update check failed:', error);
            throw error;
        }
    }

    /**
     * Check update for specific plugin
     */
    async checkPluginUpdate(pluginId, installedPlugin) {
        const latestPlugin = await this.marketplace.findPlugin(pluginId);
        
        if (!latestPlugin) {
            return {
                hasUpdate: false,
                reason: 'Plugin not found in marketplace'
            };
        }
        
        const hasUpdate = this.compareVersions(latestPlugin.version, installedPlugin.version) > 0;
        
        if (!hasUpdate) {
            return {
                hasUpdate: false,
                latestVersion: latestPlugin.version,
                reason: 'Already up to date'
            };
        }
        
        // Determine update type
        const updateType = this.determineUpdateType(installedPlugin.version, latestPlugin.version);
        
        // Check if this plugin should auto-update
        const autoUpdate = installedPlugin.autoUpdate && this.shouldAutoUpdate(updateType);
        
        // Check for security update
        const securityUpdate = this.isSecurityUpdate(latestPlugin);
        
        return {
            hasUpdate: true,
            latestVersion: latestPlugin.version,
            updateType,
            autoUpdate,
            securityUpdate,
            plugin: latestPlugin
        };
    }

    /**
     * Compare version strings
     */
    compareVersions(version1, version2) {
        const v1Parts = version1.split('.').map(Number);
        const v2Parts = version2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
            const v1 = v1Parts[i] || 0;
            const v2 = v2Parts[i] || 0;
            
            if (v1 > v2) return 1;
            if (v1 < v2) return -1;
        }
        
        return 0;
    }

    /**
     * Determine update type (major, minor, patch)
     */
    determineUpdateType(currentVersion, newVersion) {
        const current = currentVersion.split('.').map(Number);
        const latest = newVersion.split('.').map(Number);
        
        if (latest[0] > current[0]) return 'major';
        if (latest[1] > current[1]) return 'minor';
        if (latest[2] > current[2]) return 'patch';
        
        return 'unknown';
    }

    /**
     * Check if update type should auto-update
     */
    shouldAutoUpdate(updateType) {
        switch (updateType) {
            case 'patch':
                return true;
            case 'minor':
                return true;
            case 'major':
                return false;
            default:
                return false;
        }
    }

    /**
     * Check if this is a security update
     */
    isSecurityUpdate(plugin) {
        // Mock security update detection
        return Math.random() > 0.8; // 20% chance of being security update
    }

    /**
     * Update plugin to latest version
     */
    async updatePlugin(pluginId, options = {}) {
        try {
            console.log(`📦 Starting update for plugin: ${pluginId}`);
            
            const installedPlugin = this.marketplace.installedPlugins.get(pluginId);
            if (!installedPlugin) {
                throw new Error(`Plugin ${pluginId} is not installed`);
            }
            
            // Check for available update
            const updateInfo = await this.checkPluginUpdate(pluginId, installedPlugin);
            if (!updateInfo.hasUpdate) {
                console.log(`✅ Plugin ${pluginId} is already up to date`);
                return { success: true, action: 'already-updated' };
            }
            
            // Create rollback point
            await this.createRollbackPoint(pluginId, installedPlugin);
            
            try {
                // Perform the update
                await this.performUpdate(pluginId, updateInfo);
                
                // Record update history
                await this.recordUpdateHistory(pluginId, {
                    fromVersion: installedPlugin.version,
                    toVersion: updateInfo.latestVersion,
                    updateType: updateInfo.updateType,
                    success: true,
                    timestamp: new Date(),
                    automatic: options.automatic || false
                });
                
                // Update statistics
                this.stats.totalUpdates++;
                if (options.automatic) {
                    this.stats.automaticUpdates++;
                } else {
                    this.stats.manualUpdates++;
                }
                
                if (updateInfo.securityUpdate) {
                    this.stats.securityUpdates++;
                }
                
                console.log(`✅ Plugin ${pluginId} updated successfully to v${updateInfo.latestVersion}`);
                
                // Emit update event
                this.marketplace.emitEvent('plugin-updated', {
                    pluginId,
                    fromVersion: installedPlugin.version,
                    toVersion: updateInfo.latestVersion,
                    updateType: updateInfo.updateType,
                    automatic: options.automatic || false
                });
                
                return {
                    success: true,
                    fromVersion: installedPlugin.version,
                    toVersion: updateInfo.latestVersion,
                    updateType: updateInfo.updateType
                };
                
            } catch (error) {
                // Update failed - attempt rollback
                console.error(`❌ Plugin update failed for ${pluginId}:`, error);
                
                try {
                    await this.rollbackPlugin(pluginId);
                    console.log(`🔄 Plugin ${pluginId} rolled back successfully`);
                } catch (rollbackError) {
                    console.error(`❌ Rollback failed for ${pluginId}:`, rollbackError);
                }
                
                this.stats.failedUpdates++;
                throw error;
            }
            
        } catch (error) {
            console.error(`❌ Failed to update plugin ${pluginId}:`, error);
            throw error;
        }
    }

    /**
     * Perform the actual update
     */
    async performUpdate(pluginId, updateInfo) {
        console.log(`🔧 Performing update for ${pluginId}...`);
        
        // Simulate update process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update the installed plugin registry
        const installedPlugin = this.marketplace.installedPlugins.get(pluginId);
        installedPlugin.version = updateInfo.latestVersion;
        installedPlugin.updatedAt = new Date();
        
        // Save updated registry
        this.marketplace.saveInstalledPluginsRegistry();
        
        return { success: true };
    }

    /**
     * Create rollback point
     */
    async createRollbackPoint(pluginId, installedPlugin) {
        console.log(`💾 Creating rollback point for ${pluginId}...`);
        
        const rollbackPoint = {
            pluginId,
            version: installedPlugin.version,
            timestamp: new Date(),
            metadata: { ...installedPlugin }
        };
        
        if (!this.rollbackPoints.has(pluginId)) {
            this.rollbackPoints.set(pluginId, []);
        }
        
        const rollbackHistory = this.rollbackPoints.get(pluginId);
        rollbackHistory.unshift(rollbackPoint);
        
        // Keep only recent rollback points
        if (rollbackHistory.length > 5) {
            rollbackHistory.splice(5);
        }
        
        this.saveRollbackPoints();
    }

    /**
     * Rollback plugin to previous version
     */
    async rollbackPlugin(pluginId, targetVersion = null) {
        try {
            console.log(`🔄 Rolling back plugin: ${pluginId}`);
            
            const rollbackHistory = this.rollbackPoints.get(pluginId);
            if (!rollbackHistory || rollbackHistory.length === 0) {
                throw new Error(`No rollback points available for plugin ${pluginId}`);
            }
            
            // Find target rollback point
            let rollbackPoint;
            if (targetVersion) {
                rollbackPoint = rollbackHistory.find(rp => rp.version === targetVersion);
                if (!rollbackPoint) {
                    throw new Error(`Rollback point for version ${targetVersion} not found`);
                }
            } else {
                rollbackPoint = rollbackHistory[0]; // Most recent
            }
            
            // Perform rollback
            const currentPlugin = this.marketplace.installedPlugins.get(pluginId);
            const currentVersion = currentPlugin.version;
            
            // Restore plugin to rollback state
            Object.assign(currentPlugin, rollbackPoint.metadata);
            currentPlugin.rolledBackAt = new Date();
            currentPlugin.rolledBackFrom = currentVersion;
            
            // Save updated registry
            this.marketplace.saveInstalledPluginsRegistry();
            
            this.stats.rollbacks++;
            
            console.log(`✅ Plugin ${pluginId} rolled back from v${currentVersion} to v${rollbackPoint.version}`);
            
            return {
                success: true,
                fromVersion: currentVersion,
                toVersion: rollbackPoint.version
            };
            
        } catch (error) {
            console.error(`❌ Failed to rollback plugin ${pluginId}:`, error);
            throw error;
        }
    }

    /**
     * Setup automatic update checking
     */
    setupAutomaticUpdateChecking() {
        if (!this.config.enableAutoUpdates) {
            console.log('⏸️ Automatic updates disabled');
            return;
        }
        
        console.log(`⏰ Setting up automatic update checking`);
        
        // Initial check after startup
        setTimeout(() => {
            this.performAutomaticUpdateCheck();
        }, 30000); // 30 seconds after startup
        
        // Regular interval checks
        setInterval(() => {
            this.performAutomaticUpdateCheck();
        }, this.config.updateCheckInterval);
    }

    /**
     * Perform automatic update check and updates
     */
    async performAutomaticUpdateCheck() {
        try {
            console.log('🔄 Performing automatic update check...');
            
            const updateCheck = await this.checkForUpdates();
            const autoUpdates = updateCheck.availableUpdates.filter(update => update.autoUpdate);
            
            if (autoUpdates.length === 0) {
                console.log('✅ No automatic updates available');
                return;
            }
            
            console.log(`📦 Found ${autoUpdates.length} automatic updates`);
            
            // Update plugins automatically
            for (const update of autoUpdates) {
                try {
                    await this.updatePlugin(update.pluginId, { automatic: true });
                } catch (error) {
                    console.error(`❌ Automatic update failed for ${update.pluginId}:`, error);
                }
            }
            
            console.log(`✅ Automatic updates completed`);
            
        } catch (error) {
            console.error('❌ Automatic update check failed:', error);
        }
    }

    /**
     * Load update history
     */
    async loadUpdateHistory() {
        const historyData = this.marketplace.configManager?.get('updates.history') || {};
        
        for (const [pluginId, history] of Object.entries(historyData)) {
            this.updateHistory.set(pluginId, history);
        }
        
        console.log(`📚 Loaded update history for ${this.updateHistory.size} plugins`);
    }

    /**
     * Record update history
     */
    async recordUpdateHistory(pluginId, updateRecord) {
        if (!this.updateHistory.has(pluginId)) {
            this.updateHistory.set(pluginId, []);
        }
        
        const history = this.updateHistory.get(pluginId);
        history.unshift(updateRecord);
        
        // Keep only recent history (last 20 updates)
        if (history.length > 20) {
            history.splice(20);
        }
        
        this.saveUpdateHistory();
    }

    /**
     * Save update history
     */
    saveUpdateHistory() {
        if (this.marketplace.configManager) {
            const historyData = {};
            for (const [pluginId, history] of this.updateHistory) {
                historyData[pluginId] = history;
            }
            this.marketplace.configManager.set('updates.history', historyData);
        }
    }

    /**
     * Load rollback points
     */
    async loadRollbackPoints() {
        const rollbackData = this.marketplace.configManager?.get('updates.rollbacks') || {};
        
        for (const [pluginId, points] of Object.entries(rollbackData)) {
            this.rollbackPoints.set(pluginId, points);
        }
        
        console.log(`💾 Loaded rollback points for ${this.rollbackPoints.size} plugins`);
    }

    /**
     * Save rollback points
     */
    saveRollbackPoints() {
        if (this.marketplace.configManager) {
            const rollbackData = {};
            for (const [pluginId, points] of this.rollbackPoints) {
                rollbackData[pluginId] = points;
            }
            this.marketplace.configManager.set('updates.rollbacks', rollbackData);
        }
    }

    /**
     * Get update statistics
     */
    getUpdateStats() {
        return {
            ...this.stats,
            updateQueue: this.updateQueue.size,
            autoUpdateEnabled: this.config.enableAutoUpdates
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginUpdateManager;
} else if (typeof window !== 'undefined') {
    window.PluginUpdateManager = PluginUpdateManager;
} 