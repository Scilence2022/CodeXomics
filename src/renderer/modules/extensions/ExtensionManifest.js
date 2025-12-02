/**
 * ExtensionManifest - Standardized extension manifest format
 * Inspired by VS Code's extension manifest (package.json)
 * Provides schema validation and utilities for extension manifests
 */

// Extension manifest schema (VS Code-inspired)
const EXTENSION_MANIFEST_SCHEMA = {
    required: [
        'id', 'name', 'version', 'publisher', 'description', 'main'
    ],
    properties: {
        // Basic information
        id: {
            type: 'string',
            pattern: '^[a-zA-Z0-9-]+\\.[a-zA-Z0-9-]+$',
            description: 'Extension ID in format publisher.extension'
        },
        name: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Extension name'
        },
        version: {
            type: 'string',
            pattern: '^\\d+\\.\\d+\\.\\d+(-[a-zA-Z0-9.]+)?$',
            description: 'Semantic version'
        },
        publisher: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            description: 'Extension publisher'
        },
        description: {
            type: 'string',
            minLength: 10,
            maxLength: 500,
            description: 'Extension description'
        },
        
        // Execution configuration
        main: {
            type: 'string',
            description: 'Main entry point (relative path)'
        },
        browser: {
            type: 'string',
            description: 'Browser entry point (relative path)'
        },
        engines: {
            type: 'object',
            properties: {
                'genome-explorer': {
                    type: 'string',
                    description: 'Required Genome Explorer version'
                }
            }
        },
        
        // Extension metadata
        categories: {
            type: 'array',
            items: {
                type: 'string',
                enum: [
                    'sequence-analysis', 'visualization', 'comparative-genomics',
                    'phylogenetics', 'annotation', 'utility', 'ai', 'workflow'
                ]
            }
        },
        keywords: {
            type: 'array',
            items: {
                type: 'string'
            }
        },
        icon: {
            type: 'string',
            description: 'Extension icon path'
        },
        
        // Activation events (VS Code-inspired)
        activationEvents: {
            type: 'array',
            items: {
                type: 'string',
                pattern: '^(onCommand|onLanguage|onView|onUri|onStartupFinished|onWorkspaceOpen|onFileOpen):.+$'
            }
        },
        
        // Contributions (VS Code-inspired)
        contributes: {
            type: 'object',
            properties: {
                commands: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['command', 'title'],
                        properties: {
                            command: {
                                type: 'string',
                                pattern: '^[a-zA-Z0-9-.]+$'
                            },
                            title: {
                                type: 'string'
                            },
                            category: {
                                type: 'string'
                            },
                            icon: {
                                type: ['string', 'object']
                            }
                        }
                    }
                },
                menus: {
                    type: 'object',
                    properties: {
                        'editor/context': {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['command'],
                                properties: {
                                    command: {
                                        type: 'string'
                                    },
                                    when: {
                                        type: 'string'
                                    },
                                    group: {
                                        type: 'string'
                                    }
                                }
                            }
                        }
                    }
                },
                keybindings: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['command', 'key'],
                        properties: {
                            command: {
                                type: 'string'
                            },
                            key: {
                                type: 'string'
                            },
                            when: {
                                type: 'string'
                            },
                            mac: {
                                type: 'string'
                            }
                        }
                    }
                },
                languages: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['id', 'aliases'],
                        properties: {
                            id: {
                                type: 'string'
                            },
                            aliases: {
                                type: 'array',
                                items: {
                                    type: 'string'
                                }
                            },
                            extensions: {
                                type: 'array',
                                items: {
                                    type: 'string'
                                }
                            }
                        }
                    }
                }
            }
        },
        
        // Runtime configuration
        scripts: {
            type: 'object',
            properties: {
                'test': {
                    type: 'string'
                },
                'build': {
                    type: 'string'
                }
            }
        },
        
        // Dependencies
        dependencies: {
            type: 'object',
            additionalProperties: {
                type: 'string'
            }
        },
        devDependencies: {
            type: 'object',
            additionalProperties: {
                type: 'string'
            }
        },
        
        // Permissions (enhanced security)
        permissions: {
            type: 'array',
            items: {
                type: 'string',
                enum: [
                    'genome.read', 'genome.write',
                    'annotations.read', 'annotations.write',
                    'tracks.read', 'tracks.write',
                    'file.read', 'file.write',
                    'network.request',
                    'export.data',
                    'terminal.execute'
                ]
            }
        },
        
        // Extension capabilities
        capabilities: {
            type: 'array',
            items: {
                type: 'string',
                enum: [
                    'streaming', 'inline-completion',
                    'chat-participant', 'lsp-provider'
                ]
            }
        }
    }
};

/**
 * ExtensionManifest - Utility class for extension manifests
 */
class ExtensionManifest {
    /**
     * Validate extension manifest against schema
     */
    static validate(manifest) {
        const errors = [];
        
        // Check required fields
        for (const requiredField of EXTENSION_MANIFEST_SCHEMA.required) {
            if (!manifest[requiredField]) {
                errors.push(`Missing required field: ${requiredField}`);
                continue;
            }
            
            // Validate field type and format
            const fieldSchema = EXTENSION_MANIFEST_SCHEMA.properties[requiredField];
            if (fieldSchema) {
                const fieldErrors = this.validateField(manifest[requiredField], fieldSchema, requiredField);
                errors.push(...fieldErrors);
            }
        }
        
        // Check optional fields
        for (const [fieldName, fieldSchema] of Object.entries(EXTENSION_MANIFEST_SCHEMA.properties)) {
            if (!EXTENSION_MANIFEST_SCHEMA.required.includes(fieldName) && manifest[fieldName] !== undefined) {
                const fieldErrors = this.validateField(manifest[fieldName], fieldSchema, fieldName);
                errors.push(...fieldErrors);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Validate single field against schema
     */
    static validateField(value, schema, fieldPath = '') {
        const errors = [];
        
        // Check type
        if (schema.type && typeof value !== schema.type) {
            if (Array.isArray(schema.type)) {
                const isAnyTypeMatch = schema.type.some(type => typeof value === type);
                if (!isAnyTypeMatch) {
                    errors.push(`${fieldPath}: Expected type ${schema.type.join(' or ')}, got ${typeof value}`);
                }
            } else {
                errors.push(`${fieldPath}: Expected type ${schema.type}, got ${typeof value}`);
            }
            return errors;
        }
        
        // Check pattern
        if (schema.pattern && typeof value === 'string' && !new RegExp(schema.pattern).test(value)) {
            errors.push(`${fieldPath}: Invalid format. Expected pattern: ${schema.pattern}`);
        }
        
        // Check min/max length
        if (typeof value === 'string') {
            if (schema.minLength && value.length < schema.minLength) {
                errors.push(`${fieldPath}: Too short. Expected at least ${schema.minLength} characters`);
            }
            if (schema.maxLength && value.length > schema.maxLength) {
                errors.push(`${fieldPath}: Too long. Expected at most ${schema.maxLength} characters`);
            }
        }
        
        // Check enum values
        if (schema.enum && !schema.enum.includes(value)) {
            errors.push(`${fieldPath}: Invalid value. Expected one of: ${schema.enum.join(', ')}`);
        }
        
        // Check array items
        if (Array.isArray(value) && schema.items) {
            for (let i = 0; i < value.length; i++) {
                const itemPath = `${fieldPath}[${i}]`;
                const itemErrors = this.validateField(value[i], schema.items, itemPath);
                errors.push(...itemErrors);
            }
        }
        
        // Check object properties
        if (typeof value === 'object' && value !== null && schema.properties) {
            // Check required properties
            if (schema.required) {
                for (const requiredProp of schema.required) {
                    if (value[requiredProp] === undefined) {
                        errors.push(`${fieldPath}: Missing required property: ${requiredProp}`);
                    }
                }
            }
            
            // Validate properties
            for (const [propName, propSchema] of Object.entries(schema.properties)) {
                if (value[propName] !== undefined) {
                    const propPath = fieldPath ? `${fieldPath}.${propName}` : propName;
                    const propErrors = this.validateField(value[propName], propSchema, propPath);
                    errors.push(...propErrors);
                }
            }
        }
        
        return errors;
    }
    
    /**
     * Create minimal valid manifest
     */
    static createMinimalManifest(baseManifest) {
        const minimalManifest = {
            id: 'example.extension',
            name: 'Example Extension',
            version: '1.0.0',
            publisher: 'ExamplePublisher',
            description: 'Example extension description',
            main: './extension.js',
            ...baseManifest
        };
        
        return minimalManifest;
    }
    
    /**
     * Normalize manifest (add defaults, format fields)
     */
    static normalize(manifest) {
        const normalized = { ...manifest };
        
        // Add default values
        normalized.categories = normalized.categories || [];
        normalized.keywords = normalized.keywords || [];
        normalized.activationEvents = normalized.activationEvents || [];
        normalized.contributes = normalized.contributes || {};
        normalized.permissions = normalized.permissions || [];
        normalized.capabilities = normalized.capabilities || [];
        
        // Normalize engines
        if (!normalized.engines) {
            normalized.engines = {
                'genome-explorer': '^2.0.0'
            };
        }
        
        return normalized;
    }
    
    /**
     * Compare two manifests for compatibility
     */
    static isCompatible(manifest1, manifest2) {
        // Check if manifests are compatible for update
        if (manifest1.id !== manifest2.id) {
            return false;
        }
        
        // Check major version compatibility
        const version1 = manifest1.version.split('.').map(Number);
        const version2 = manifest2.version.split('.').map(Number);
        
        // Same major version, or manifest2 is newer major version
        return version1[0] === version2[0] || version2[0] > version1[0];
    }
    
    /**
     * Get manifest summary
     */
    static getSummary(manifest) {
        return {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            publisher: manifest.publisher,
            description: manifest.description,
            categories: manifest.categories || [],
            activationEvents: manifest.activationEvents || [],
            permissions: manifest.permissions || []
        };
    }
    
    /**
     * Validate activation events
     */
    static validateActivationEvents(events) {
        const validEvents = [];
        const invalidEvents = [];
        
        for (const event of events) {
            const isValid = this.isValidActivationEvent(event);
            if (isValid) {
                validEvents.push(event);
            } else {
                invalidEvents.push(event);
            }
        }
        
        return {
            valid: invalidEvents.length === 0,
            validEvents,
            invalidEvents
        };
    }
    
    /**
     * Check if activation event is valid
     */
    static isValidActivationEvent(event) {
        const eventPattern = /^(onCommand|onLanguage|onView|onUri|onStartupFinished|onWorkspaceOpen|onFileOpen):.+$/;
        return eventPattern.test(event);
    }
    
    /**
     * Get activation event type
     */
    static getActivationEventType(event) {
        const parts = event.split(':');
        return parts[0];
    }
    
    /**
     * Get activation event target
     */
    static getActivationEventTarget(event) {
        const parts = event.split(':');
        return parts.slice(1).join(':');
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ExtensionManifest,
        EXTENSION_MANIFEST_SCHEMA
    };
} else if (typeof window !== 'undefined') {
    window.ExtensionManifest = ExtensionManifest;
    window.EXTENSION_MANIFEST_SCHEMA = EXTENSION_MANIFEST_SCHEMA;
}
