/**
 * SecurityManager - Enhanced security model with fine-grained permissions
 * Inspired by VS Code's security model and browser permissions
 * Provides comprehensive permission management for extensions
 */

// Permission definitions with levels and descriptions
const PERMISSION_DEFINITIONS = {
    // Genome-related permissions
    'genome.read': {
        description: 'Read genome sequence data',
        level: 'low',
        default: true,
        requiredBy: ['sequence-analysis', 'visualization']
    },
    'genome.write': {
        description: 'Modify genome sequence data',
        level: 'high',
        default: false,
        requiredBy: ['annotation']
    },
    
    // Annotation-related permissions
    'annotations.read': {
        description: 'Read genome annotations',
        level: 'low',
        default: true,
        requiredBy: ['sequence-analysis', 'visualization']
    },
    'annotations.write': {
        description: 'Modify genome annotations',
        level: 'medium',
        default: false,
        requiredBy: ['annotation']
    },
    
    // Track-related permissions
    'tracks.read': {
        description: 'Read track data',
        level: 'low',
        default: true,
        requiredBy: ['visualization']
    },
    'tracks.write': {
        description: 'Create or modify tracks',
        level: 'medium',
        default: false,
        requiredBy: ['visualization', 'annotation']
    },
    
    // File system permissions
    'file.read': {
        description: 'Read files from local filesystem',
        level: 'medium',
        default: false,
        requiredBy: ['utility', 'workflow']
    },
    'file.write': {
        description: 'Write files to local filesystem',
        level: 'high',
        default: false,
        requiredBy: ['utility', 'workflow']
    },
    
    // Network permissions
    'network.request': {
        description: 'Make network requests',
        level: 'medium',
        default: false,
        requiredBy: ['ai', 'workflow']
    },
    
    // Data export permissions
    'export.data': {
        description: 'Export data from the application',
        level: 'medium',
        default: false,
        requiredBy: ['utility']
    },
    
    // Terminal execution permissions
    'terminal.execute': {
        description: 'Execute commands in terminal',
        level: 'high',
        default: false,
        requiredBy: ['workflow']
    }
};

/**
 * SecurityManager - Core security management class
 */
class SecurityManager {
    constructor(app, configManager) {
        this.app = app;
        this.configManager = configManager;
        
        // Extension permissions storage
        this.extensionPermissions = new Map();
        
        // Permission requests queue
        this.permissionRequests = new Map();
        
        // Security policies
        this.policies = {
            enablePermissionPrompt: true,
            defaultPermissionLevel: 'low',
            enableAutoApprove: false,
            restrictedPermissions: ['terminal.execute', 'file.write', 'genome.write']
        };
        
        // Load saved permissions from config
        this.loadPermissions();
        
        console.log('SecurityManager initialized with', Object.keys(PERMISSION_DEFINITIONS).length, 'permissions');
    }
    
    /**
     * Load saved permissions from configuration
     */
    loadPermissions() {
        try {
            const savedPermissions = this.configManager?.getConfig('extensionPermissions') || {};
            for (const [extensionId, permissions] of Object.entries(savedPermissions)) {
                this.extensionPermissions.set(extensionId, permissions);
            }
        } catch (error) {
            console.error('Failed to load extension permissions:', error);
        }
    }
    
    /**
     * Save permissions to configuration
     */
    savePermissions() {
        try {
            const permissionsToSave = {};
            for (const [extensionId, permissions] of this.extensionPermissions) {
                permissionsToSave[extensionId] = permissions;
            }
            this.configManager?.setConfig('extensionPermissions', permissionsToSave);
        } catch (error) {
            console.error('Failed to save extension permissions:', error);
        }
    }
    
    /**
     * Register extension permissions from manifest
     */
    registerExtensionPermissions(extensionId, requestedPermissions) {
        // Get current permissions or defaults
        let currentPermissions = this.extensionPermissions.get(extensionId) || this.getDefaultPermissions();
        
        // Update permissions based on request
        for (const permission of requestedPermissions) {
            if (PERMISSION_DEFINITIONS[permission]) {
                currentPermissions[permission] = true;
            }
        }
        
        // Save updated permissions
        this.extensionPermissions.set(extensionId, currentPermissions);
        this.savePermissions();
        
        console.log(`Registered permissions for ${extensionId}:`, requestedPermissions);
    }
    
    /**
     * Get default permissions for extensions
     */
    getDefaultPermissions() {
        const defaults = {};
        for (const [permission, def] of Object.entries(PERMISSION_DEFINITIONS)) {
            defaults[permission] = def.default;
        }
        return defaults;
    }
    
    /**
     * Check if extension has a specific permission
     */
    hasPermission(extensionId, permission) {
        // Check if permission exists
        if (!PERMISSION_DEFINITIONS[permission]) {
            console.warn(`Unknown permission: ${permission}`);
            return false;
        }
        
        // Get extension permissions
        const permissions = this.extensionPermissions.get(extensionId) || this.getDefaultPermissions();
        
        // Check if permission is granted
        return permissions[permission] === true;
    }
    
    /**
     * Request permission for extension
     */
    async requestPermission(extensionId, permission, options = {}) {
        // Check if permission already granted
        if (this.hasPermission(extensionId, permission)) {
            return true;
        }
        
        // Check if permission is restricted
        if (this.policies.restrictedPermissions.includes(permission)) {
            console.warn(`Restricted permission requested: ${permission}`);
            return false;
        }
        
        // Check if we should prompt user
        if (this.policies.enablePermissionPrompt && !this.policies.enableAutoApprove) {
            return this.promptUserForPermission(extensionId, permission, options);
        }
        
        // Auto-approve based on policy
        if (this.policies.enableAutoApprove) {
            return this.grantPermission(extensionId, permission);
        }
        
        return false;
    }
    
    /**
     * Prompt user for permission (stub implementation)
     */
    async promptUserForPermission(extensionId, permission, options = {}) {
        // In real implementation, this would show a UI prompt to the user
        console.log(`Permission prompt for ${extensionId}: ${permission}`);
        
        // For now, we'll auto-approve for development
        return this.grantPermission(extensionId, permission);
    }
    
    /**
     * Grant permission to extension
     */
    grantPermission(extensionId, permission) {
        // Get current permissions
        const permissions = this.extensionPermissions.get(extensionId) || this.getDefaultPermissions();
        
        // Grant permission
        permissions[permission] = true;
        
        // Save updated permissions
        this.extensionPermissions.set(extensionId, permissions);
        this.savePermissions();
        
        console.log(`Granted permission ${permission} to ${extensionId}`);
        return true;
    }
    
    /**
     * Revoke permission from extension
     */
    revokePermission(extensionId, permission) {
        // Get current permissions
        const permissions = this.extensionPermissions.get(extensionId) || this.getDefaultPermissions();
        
        // Revoke permission
        permissions[permission] = false;
        
        // Save updated permissions
        this.extensionPermissions.set(extensionId, permissions);
        this.savePermissions();
        
        console.log(`Revoked permission ${permission} from ${extensionId}`);
        return true;
    }
    
    /**
     * Validate extension permissions against manifest
     */
    validateExtensionPermissions(extensionId, manifest) {
        const requestedPermissions = manifest.permissions || [];
        const validationResult = {
            valid: true,
            errors: [],
            warnings: []
        };
        
        // Check for unknown permissions
        for (const permission of requestedPermissions) {
            if (!PERMISSION_DEFINITIONS[permission]) {
                validationResult.warnings.push(`Unknown permission requested: ${permission}`);
            }
        }
        
        // Check for required permissions based on categories
        const categories = manifest.categories || [];
        for (const category of categories) {
            // Check permissions required by this category
            for (const [permission, def] of Object.entries(PERMISSION_DEFINITIONS)) {
                if (def.requiredBy && def.requiredBy.includes(category)) {
                    if (!requestedPermissions.includes(permission)) {
                        validationResult.warnings.push(`Category ${category} recommends permission: ${permission}`);
                    }
                }
            }
        }
        
        return validationResult;
    }
    
    /**
     * Get permission info for a specific permission
     */
    getPermissionInfo(permission) {
        return PERMISSION_DEFINITIONS[permission] || {
            description: 'Unknown permission',
            level: 'unknown',
            default: false
        };
    }
    
    /**
     * Get all available permissions
     */
    getAllPermissions() {
        return Object.keys(PERMISSION_DEFINITIONS);
    }
    
    /**
     * Get permissions for an extension
     */
    getExtensionPermissions(extensionId) {
        return this.extensionPermissions.get(extensionId) || this.getDefaultPermissions();
    }
    
    /**
     * Set permissions for an extension (admin operation)
     */
    setExtensionPermissions(extensionId, permissions) {
        // Validate permissions
        const validatedPermissions = {};
        for (const [permission, granted] of Object.entries(permissions)) {
            if (PERMISSION_DEFINITIONS[permission]) {
                validatedPermissions[permission] = !!granted;
            }
        }
        
        // Save permissions
        this.extensionPermissions.set(extensionId, validatedPermissions);
        this.savePermissions();
        
        console.log(`Set permissions for ${extensionId}:`, validatedPermissions);
    }
    
    /**
     * Clear permissions for an extension
     */
    clearExtensionPermissions(extensionId) {
        this.extensionPermissions.delete(extensionId);
        this.savePermissions();
        
        console.log(`Cleared permissions for ${extensionId}`);
    }
    
    /**
     * Get security stats
     */
    getStats() {
        return {
            totalPermissions: Object.keys(PERMISSION_DEFINITIONS).length,
            extensionsWithPermissions: this.extensionPermissions.size,
            policies: { ...this.policies }
        };
    }
    
    /**
     * Update security policies
     */
    updatePolicies(newPolicies) {
        this.policies = { ...this.policies, ...newPolicies };
        console.log('Updated security policies:', this.policies);
    }
    
    /**
     * Create permission token for extension
     */
    createPermissionToken(extensionId) {
        // Create a JWT-like token for permission verification
        const permissions = this.getExtensionPermissions(extensionId);
        const tokenData = {
            extensionId,
            permissions,
            timestamp: Date.now(),
            expires: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        };
        
        // For now, return base64 encoded string (in production, this would be signed)
        return btoa(JSON.stringify(tokenData));
    }
    
    /**
     * Verify permission token
     */
    verifyPermissionToken(token) {
        try {
            const decoded = JSON.parse(atob(token));
            
            // Check if token is expired
            if (decoded.expires < Date.now()) {
                return { valid: false, error: 'Token expired' };
            }
            
            // Check if extension exists
            if (!this.extensionPermissions.has(decoded.extensionId)) {
                return { valid: false, error: 'Invalid extension' };
            }
            
            return { valid: true, data: decoded };
        } catch (error) {
            return { valid: false, error: 'Invalid token' };
        }
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SecurityManager,
        PERMISSION_DEFINITIONS
    };
} else if (typeof window !== 'undefined') {
    window.SecurityManager = SecurityManager;
    window.PERMISSION_DEFINITIONS = PERMISSION_DEFINITIONS;
}
