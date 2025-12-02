#!/usr/bin/env node

/**
 * GenomeExplorer Plugin Marketplace Server
 * Simple RESTful API server for plugin distribution
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;
const PLUGINS_DIR = path.join(__dirname, 'marketplace-data', 'plugins');
const METADATA_FILE = path.join(__dirname, 'marketplace-data', 'metadata.json');
const UPLOADS_DIR = path.join(__dirname, 'marketplace-data', 'uploads');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        cb(null, `${timestamp}-${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 5
    },
    fileFilter: function (req, file, cb) {
        // Allow plugin archives and metadata files
        const allowedTypes = ['.zip', '.tar.gz', '.json', '.js', '.md'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext) || allowedTypes.some(type => file.originalname.toLowerCase().includes(type))) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: .zip, .tar.gz, .json, .js, .md'));
        }
    }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Plugin metadata storage
let pluginMetadata = {
    lastUpdated: new Date().toISOString(),
    plugins: {},
    pendingSubmissions: {},
    stats: {
        totalPlugins: 0,
        totalDownloads: 0,
        totalSubmissions: 0,
        categories: {}
    }
};

/**
 * Initialize server and load plugin metadata
 */
async function initializeServer() {
    try {
        // Ensure directories exist
        await fs.mkdir(path.dirname(PLUGINS_DIR), { recursive: true });
        await fs.mkdir(PLUGINS_DIR, { recursive: true });
        await fs.mkdir(UPLOADS_DIR, { recursive: true });
        
        // Load existing metadata
        try {
            const data = await fs.readFile(METADATA_FILE, 'utf8');
            pluginMetadata = JSON.parse(data);
            console.log(`📦 Loaded ${Object.keys(pluginMetadata.plugins).length} plugins from metadata`);
        } catch (error) {
            console.log('📝 Creating new plugin metadata');
            await initializeSamplePlugins();
        }
        
        console.log('🚀 Plugin Marketplace Server initialized');
    } catch (error) {
        console.error('❌ Server initialization failed:', error);
        process.exit(1);
    }
}

/**
 * Initialize with sample plugins for demonstration
 */
async function initializeSamplePlugins() {
    const samplePlugins = {
        'genomic-variant-caller': {
            id: 'genomic-variant-caller',
            name: 'Genomic Variant Caller',
            description: 'Advanced genomic variant calling with machine learning enhancement',
            version: '2.4.1',
            author: 'BioinformaticsTeam',
            category: 'variant-analysis',
            type: 'function',
            tags: ['variants', 'genomics', 'snp', 'indel', 'ml'],
            size: 4850000,
            homepage: 'https://github.com/genomeexplorer/variant-caller',
            repository: 'https://github.com/genomeexplorer/variant-caller.git',
            license: 'MIT',
            keywords: ['genomics', 'variants', 'bioinformatics'],
            dependencies: [
                { id: 'sequence-utils', version: '>=2.1.0' },
                { id: 'ml-core', version: '>=1.5.0' }
            ],
            screenshots: [
                'https://example.com/screenshots/variant-caller-1.png',
                'https://example.com/screenshots/variant-caller-2.png'
            ],
            rating: 4.7,
            downloads: 15847,
            lastUpdated: '2024-11-20T10:30:00Z',
            status: 'published',
            submittedBy: 'admin',
            submittedAt: '2024-11-01T00:00:00Z',
            changelog: {
                '2.4.1': 'Fixed compatibility with latest genome builds',
                '2.4.0': 'Added support for structural variants',
                '2.3.0': 'Machine learning enhancement for accuracy'
            },
            compatibility: {
                genomeExplorer: '>=2.0.0',
                platforms: ['windows', 'macos', 'linux']
            },
            security: {
                checksum: 'sha256:abc123def456...',
                signature: 'verified',
                scanResults: {
                    malware: false,
                    suspicious: false,
                    lastScanned: '2024-11-20T08:00:00Z'
                }
            }
        },
        'protein-interaction-network': {
            id: 'protein-interaction-network',
            name: 'Protein Interaction Network Visualizer',
            description: 'Interactive protein-protein interaction network analysis and visualization',
            version: '1.8.3',
            author: 'NetworkBioLab',
            category: 'network-analysis',
            type: 'visualization',
            tags: ['protein', 'interaction', 'network', 'ppi', 'visualization'],
            size: 3240000,
            homepage: 'https://github.com/genomeexplorer/protein-networks',
            repository: 'https://github.com/genomeexplorer/protein-networks.git',
            license: 'Apache-2.0',
            keywords: ['protein', 'network', 'interaction', 'visualization'],
            dependencies: [
                { id: 'graph-libs', version: '>=3.0.0' },
                { id: 'visualization-engine', version: '>=2.1.0' }
            ],
            screenshots: [
                'https://example.com/screenshots/protein-network-1.png'
            ],
            rating: 4.9,
            downloads: 8934,
            lastUpdated: '2024-11-18T14:22:00Z',
            status: 'published',
            submittedBy: 'admin',
            submittedAt: '2024-10-15T00:00:00Z',
            changelog: {
                '1.8.3': 'Performance improvements for large networks',
                '1.8.2': 'Added new layout algorithms',
                '1.8.0': 'Interactive filtering and search'
            },
            compatibility: {
                genomeExplorer: '>=2.0.0',
                platforms: ['windows', 'macos', 'linux']
            },
            security: {
                checksum: 'sha256:def789ghi012...',
                signature: 'verified',
                scanResults: {
                    malware: false,
                    suspicious: false,
                    lastScanned: '2024-11-18T09:00:00Z'
                }
            }
        },
        'rna-seq-analyzer': {
            id: 'rna-seq-analyzer',
            name: 'RNA-Seq Differential Expression Analyzer',
            description: 'Comprehensive RNA-Seq data analysis with statistical testing',
            version: '3.1.0',
            author: 'RNASeqGroup',
            category: 'rna-analysis',
            type: 'function',
            tags: ['rna-seq', 'differential-expression', 'statistics', 'transcriptomics'],
            size: 5670000,
            homepage: 'https://github.com/genomeexplorer/rna-seq-analyzer',
            repository: 'https://github.com/genomeexplorer/rna-seq-analyzer.git',
            license: 'GPL-3.0',
            keywords: ['rna', 'transcriptomics', 'differential-expression'],
            dependencies: [
                { id: 'stats-utils', version: '>=2.0.0' },
                { id: 'genomic-ranges', version: '>=1.3.0' }
            ],
            screenshots: [
                'https://example.com/screenshots/rna-seq-1.png',
                'https://example.com/screenshots/rna-seq-2.png'
            ],
            rating: 4.6,
            downloads: 12234,
            lastUpdated: '2024-11-19T16:45:00Z',
            status: 'published',
            submittedBy: 'admin',
            submittedAt: '2024-09-20T00:00:00Z',
            changelog: {
                '3.1.0': 'Added batch effect correction',
                '3.0.2': 'Improved memory efficiency',
                '3.0.0': 'Major refactor with new algorithms'
            },
            compatibility: {
                genomeExplorer: '>=2.0.0',
                platforms: ['windows', 'macos', 'linux']
            },
            security: {
                checksum: 'sha256:ghi345jkl678...',
                signature: 'verified',
                scanResults: {
                    malware: false,
                    suspicious: false,
                    lastScanned: '2024-11-19T11:00:00Z'
                }
            }
        },
        'phylogenetic-tree-builder': {
            id: 'phylogenetic-tree-builder',
            name: 'Advanced Phylogenetic Tree Builder',
            description: 'Maximum likelihood and Bayesian phylogenetic inference',
            version: '2.7.2',
            author: 'PhyloLab',
            category: 'phylogenetics',
            type: 'function',
            tags: ['phylogeny', 'evolution', 'tree', 'maximum-likelihood', 'bayesian'],
            size: 7890000,
            homepage: 'https://github.com/genomeexplorer/phylo-builder',
            repository: 'https://github.com/genomeexplorer/phylo-builder.git',
            license: 'BSD-3-Clause',
            keywords: ['phylogenetics', 'evolution', 'tree-building'],
            dependencies: [
                { id: 'sequence-alignment', version: '>=2.0.0' },
                { id: 'tree-utils', version: '>=1.8.0' }
            ],
            screenshots: [
                'https://example.com/screenshots/phylo-1.png'
            ],
            rating: 4.8,
            downloads: 6789,
            lastUpdated: '2024-11-17T12:15:00Z',
            status: 'published',
            submittedBy: 'admin',
            submittedAt: '2024-08-10T00:00:00Z',
            changelog: {
                '2.7.2': 'Bug fixes in bootstrap calculation',
                '2.7.1': 'Performance optimization',
                '2.7.0': 'Added support for partitioned models'
            },
            compatibility: {
                genomeExplorer: '>=2.0.0',
                platforms: ['windows', 'macos', 'linux']
            },
            security: {
                checksum: 'sha256:jkl901mno234...',
                signature: 'verified',
                scanResults: {
                    malware: false,
                    suspicious: false,
                    lastScanned: '2024-11-17T08:30:00Z'
                }
            }
        }
    };

    pluginMetadata.plugins = samplePlugins;
    pluginMetadata.stats.totalPlugins = Object.keys(samplePlugins).length;
    pluginMetadata.stats.totalDownloads = Object.values(samplePlugins)
        .reduce((sum, plugin) => sum + plugin.downloads, 0);
    
    // Calculate category stats
    Object.values(samplePlugins).forEach(plugin => {
        if (!pluginMetadata.stats.categories[plugin.category]) {
            pluginMetadata.stats.categories[plugin.category] = 0;
        }
        pluginMetadata.stats.categories[plugin.category]++;
    });

    await saveMetadata();
    console.log('✅ Sample plugins initialized');
}

/**
 * Save metadata to file
 */
async function saveMetadata() {
    try {
        await fs.writeFile(METADATA_FILE, JSON.stringify(pluginMetadata, null, 2));
    } catch (error) {
        console.error('❌ Failed to save metadata:', error);
    }
}

/**
 * Generate plugin ID from name
 */
function generatePluginId(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Validate plugin metadata
 */
function validatePluginMetadata(metadata) {
    const required = ['name', 'description', 'version', 'author', 'category', 'type'];
    const missing = required.filter(field => !metadata[field]);
    
    if (missing.length > 0) {
        throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(metadata.version)) {
        throw new Error('Version must follow semantic versioning (e.g., 1.0.0)');
    }
    
    // Validate category
    const validCategories = [
        'variant-analysis', 'network-analysis', 'rna-analysis', 'phylogenetics',
        'sequence-analysis', 'protein-analysis', 'visualization', 'data-import',
        'statistical-analysis', 'machine-learning'
    ];
    
    if (!validCategories.includes(metadata.category)) {
        throw new Error(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
    }
    
    // Validate type
    const validTypes = ['function', 'visualization', 'data-source', 'utility'];
    if (!validTypes.includes(metadata.type)) {
        throw new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`);
    }
    
    return true;
}

// API Routes

/**
 * GET /api/v1/plugins
 * Search and list plugins
 */
app.get('/api/v1/plugins', (req, res) => {
    try {
        const { query = '', category, type, author, tags, limit = 50, offset = 0, status = 'published' } = req.query;
        
        let plugins = Object.values(pluginMetadata.plugins);
        
        // Filter by status
        if (status) {
            plugins = plugins.filter(plugin => plugin.status === status);
        }
        
        // Apply search query
        if (query) {
            const queryLower = query.toLowerCase();
            plugins = plugins.filter(plugin =>
                plugin.name.toLowerCase().includes(queryLower) ||
                plugin.description.toLowerCase().includes(queryLower) ||
                plugin.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
                plugin.keywords.some(keyword => keyword.toLowerCase().includes(queryLower))
            );
        }
        
        // Apply filters
        if (category) {
            plugins = plugins.filter(plugin => plugin.category === category);
        }
        
        if (type) {
            plugins = plugins.filter(plugin => plugin.type === type);
        }
        
        if (author) {
            plugins = plugins.filter(plugin => 
                plugin.author.toLowerCase().includes(author.toLowerCase())
            );
        }
        
        if (tags) {
            const requiredTags = Array.isArray(tags) ? tags : [tags];
            plugins = plugins.filter(plugin =>
                requiredTags.some(tag =>
                    plugin.tags.some(pluginTag =>
                        pluginTag.toLowerCase().includes(tag.toLowerCase())
                    )
                )
            );
        }
        
        // Sort by relevance and popularity
        plugins.sort((a, b) => {
            // Calculate relevance score if query exists
            if (query) {
                const queryLower = query.toLowerCase();
                let scoreA = 0, scoreB = 0;
                
                if (a.name.toLowerCase().includes(queryLower)) scoreA += 10;
                if (b.name.toLowerCase().includes(queryLower)) scoreB += 10;
                
                if (a.description.toLowerCase().includes(queryLower)) scoreA += 5;
                if (b.description.toLowerCase().includes(queryLower)) scoreB += 5;
                
                if (scoreA !== scoreB) return scoreB - scoreA;
            }
            
            // Sort by popularity (rating and downloads)
            const popularityA = (a.rating || 0) * 0.3 + Math.log(a.downloads || 1) * 0.1;
            const popularityB = (b.rating || 0) * 0.3 + Math.log(b.downloads || 1) * 0.1;
            return popularityB - popularityA;
        });
        
        // Apply pagination
        const total = plugins.length;
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);
        plugins = plugins.slice(startIndex, endIndex);
        
        res.json({
            success: true,
            data: {
                plugins,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: endIndex < total
                }
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Search plugins error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/plugins/:id
 * Get plugin details
 */
app.get('/api/v1/plugins/:id', (req, res) => {
    try {
        const { id } = req.params;
        const plugin = pluginMetadata.plugins[id];
        
        if (!plugin) {
            return res.status(404).json({
                success: false,
                error: 'Plugin not found',
                message: `Plugin with ID '${id}' not found`
            });
        }
        
        res.json({
            success: true,
            data: plugin,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Get plugin details error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/plugins/:id/download
 * Track plugin download
 */
app.post('/api/v1/plugins/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        const plugin = pluginMetadata.plugins[id];
        
        if (!plugin) {
            return res.status(404).json({
                success: false,
                error: 'Plugin not found'
            });
        }
        
        // Increment download count
        plugin.downloads = (plugin.downloads || 0) + 1;
        pluginMetadata.stats.totalDownloads++;
        
        // Save updated metadata
        await saveMetadata();
        
        // Return download information
        res.json({
            success: true,
            data: {
                downloadUrl: `${req.protocol}://${req.get('host')}/downloads/${id}/${plugin.version}/${id}.zip`,
                checksum: plugin.security.checksum,
                size: plugin.size,
                version: plugin.version
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Track download error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/plugins/submit
 * Submit a new plugin
 */
app.post('/api/v1/plugins/submit', upload.array('files', 5), async (req, res) => {
    try {
        console.log('📤 Plugin submission received');
        
        // Parse metadata from form data
        let metadata;
        try {
            metadata = JSON.parse(req.body.metadata);
        } catch (error) {
            return res.status(400).json({
                success: false,
                error: 'Invalid metadata format',
                message: 'Metadata must be valid JSON'
            });
        }
        
        // Validate metadata
        validatePluginMetadata(metadata);
        
        // Generate plugin ID
        const pluginId = generatePluginId(metadata.name);
        
        // Check if plugin already exists
        if (pluginMetadata.plugins[pluginId]) {
            return res.status(409).json({
                success: false,
                error: 'Plugin already exists',
                message: `Plugin with ID '${pluginId}' already exists`
            });
        }
        
        // Process uploaded files
        const uploadedFiles = req.files || [];
        const fileInfos = uploadedFiles.map(file => ({
            originalName: file.originalname,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
            path: file.path
        }));
        
        // Create plugin metadata with submission info
        const submissionId = crypto.randomUUID();
        const submission = {
            id: pluginId,
            submissionId,
            ...metadata,
            tags: metadata.tags || [],
            keywords: metadata.keywords || [],
            dependencies: metadata.dependencies || [],
            files: fileInfos,
            size: fileInfos.reduce((total, file) => total + file.size, 0),
            status: 'pending',
            submittedBy: req.body.submitterEmail || 'anonymous',
            submittedAt: new Date().toISOString(),
            rating: 0,
            downloads: 0,
            lastUpdated: new Date().toISOString(),
            security: {
                checksum: 'pending',
                signature: 'pending',
                scanResults: {
                    malware: null,
                    suspicious: null,
                    lastScanned: null
                }
            }
        };
        
        // Add to pending submissions
        pluginMetadata.pendingSubmissions[submissionId] = submission;
        pluginMetadata.stats.totalSubmissions++;
        
        // Save metadata
        await saveMetadata();
        
        console.log(`✅ Plugin submission received: ${pluginId} (${submissionId})`);
        
        res.status(201).json({
            success: true,
            data: {
                submissionId,
                pluginId,
                status: 'pending',
                message: 'Plugin submitted successfully and is pending review'
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Plugin submission error:', error);
        
        // Clean up uploaded files on error
        if (req.files) {
            for (const file of req.files) {
                try {
                    await fs.unlink(file.path);
                } catch (cleanupError) {
                    console.error('Failed to cleanup file:', cleanupError);
                }
            }
        }
        
        res.status(400).json({
            success: false,
            error: 'Plugin submission failed',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/submissions
 * Get pending submissions (admin only for now)
 */
app.get('/api/v1/submissions', (req, res) => {
    try {
        const { status } = req.query;
        
        let submissions = Object.values(pluginMetadata.pendingSubmissions);
        
        if (status) {
            submissions = submissions.filter(sub => sub.status === status);
        }
        
        res.json({
            success: true,
            data: {
                submissions,
                total: submissions.length
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Get submissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * POST /api/v1/submissions/:id/approve
 * Approve a plugin submission (admin only for now)
 */
app.post('/api/v1/submissions/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        const submission = pluginMetadata.pendingSubmissions[id];
        
        if (!submission) {
            return res.status(404).json({
                success: false,
                error: 'Submission not found'
            });
        }
        
        // Move from pending to published
        const plugin = { ...submission };
        plugin.status = 'published';
        plugin.approvedAt = new Date().toISOString();
        plugin.approvedBy = req.body.approverEmail || 'admin';
        
        // Add to main plugins
        pluginMetadata.plugins[plugin.id] = plugin;
        
        // Remove from pending
        delete pluginMetadata.pendingSubmissions[id];
        
        // Update stats
        pluginMetadata.stats.totalPlugins++;
        if (!pluginMetadata.stats.categories[plugin.category]) {
            pluginMetadata.stats.categories[plugin.category] = 0;
        }
        pluginMetadata.stats.categories[plugin.category]++;
        
        // Save metadata
        await saveMetadata();
        
        console.log(`✅ Plugin approved: ${plugin.id}`);
        
        res.json({
            success: true,
            data: {
                pluginId: plugin.id,
                status: 'approved',
                message: 'Plugin approved and published successfully'
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Approve submission error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/categories
 * Get plugin categories
 */
app.get('/api/v1/categories', (req, res) => {
    try {
        const categories = Object.entries(pluginMetadata.stats.categories)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
            
        res.json({
            success: true,
            data: categories,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Get categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/stats
 * Get marketplace statistics
 */
app.get('/api/v1/stats', (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                ...pluginMetadata.stats,
                pendingSubmissions: Object.keys(pluginMetadata.pendingSubmissions).length,
                lastUpdated: pluginMetadata.lastUpdated,
                serverVersion: '1.1.0'
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Get stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/config
 * Get server configuration
 */
app.get('/api/v1/config', (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                serverUrl: `${req.protocol}://${req.get('host')}`,
                apiVersion: 'v1',
                port: PORT,
                maxFileSize: '50MB',
                allowedFileTypes: ['.zip', '.tar.gz', '.json', '.js', '.md'],
                supportedCategories: [
                    'variant-analysis', 'network-analysis', 'rna-analysis', 'phylogenetics',
                    'sequence-analysis', 'protein-analysis', 'visualization', 'data-import',
                    'statistical-analysis', 'machine-learning'
                ],
                supportedTypes: ['function', 'visualization', 'data-source', 'utility'],
                submissionGuidelines: {
                    requiredFields: ['name', 'description', 'version', 'author', 'category', 'type'],
                    versionFormat: 'Semantic versioning (e.g., 1.0.0)',
                    maxFiles: 5,
                    reviewProcess: 'Manual review by administrators'
                }
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Get config error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/v1/health
 * Health check endpoint
 */
app.get('/api/v1/health', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'File too large',
                message: 'File size exceeds 50MB limit'
            });
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Too many files',
                message: 'Maximum 5 files allowed'
            });
        }
    }
    
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'An unexpected error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Not found',
        message: `Endpoint ${req.method} ${req.path} not found`
    });
});

// Start server
async function startServer() {
    await initializeServer();
    
    app.listen(PORT, () => {
        console.log(`
🚀 GenomeExplorer Plugin Marketplace Server v1.1.0
📡 Server running on http://localhost:${PORT}
📚 API Documentation: http://localhost:${PORT}/api/v1/health
🔍 Plugin Search: http://localhost:${PORT}/api/v1/plugins
📊 Statistics: http://localhost:${PORT}/api/v1/stats
📤 Plugin Submission: http://localhost:${PORT}/api/v1/plugins/submit
⚙️  Configuration: http://localhost:${PORT}/api/v1/config
        `);
    });
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    await saveMetadata();
    process.exit(0);
});

// Start the server
if (require.main === module) {
    startServer().catch(console.error);
}

module.exports = app;
