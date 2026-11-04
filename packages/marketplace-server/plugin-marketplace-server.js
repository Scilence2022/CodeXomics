#!/usr/bin/env node

/**
 * CodeXomics Plugin Marketplace Server
 * Simple RESTful API server for plugin distribution
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const semver = require('semver');

const { inspectPluginPackage, MAX_PACKAGE_BYTES } = require('../../src/main/plugin-package-inspector');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.CODEXOMICS_MARKETPLACE_HOST || '127.0.0.1';
const DATA_DIR = path.resolve(process.env.CODEXOMICS_MARKETPLACE_DATA_DIR || path.join(__dirname, 'marketplace-data'));
const PLUGINS_DIR = path.join(DATA_DIR, 'plugins');
const METADATA_FILE = path.join(DATA_DIR, 'metadata.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const PACKAGES_DIR = path.join(DATA_DIR, 'packages');
const ADMIN_TOKEN = process.env.CODEXOMICS_MARKETPLACE_ADMIN_TOKEN;
const ADMIN_ID = process.env.CODEXOMICS_MARKETPLACE_ADMIN_ID || 'marketplace-admin';
const SHA256 = /^[a-f0-9]{64}$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (_req, _file, callback) => callback(null, `${crypto.randomUUID()}.zip`),
  }),
  limits: {
    fileSize: MAX_PACKAGE_BYTES,
    files: 1,
    fields: 2,
    fieldSize: 64 * 1024,
  },
  fileFilter: (_req, file, callback) => callback(null, path.extname(file.originalname).toLowerCase() === '.zip'),
});

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function requireAdministrator(req, res, next) {
  if (!ADMIN_TOKEN) return res.status(503).json({ success: false, error: 'Marketplace administration is disabled' });
  const provided = req.get('authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
  if (
    !provided ||
    !crypto.timingSafeEqual(Buffer.from(sha256(provided), 'hex'), Buffer.from(sha256(ADMIN_TOKEN), 'hex'))
  ) {
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ success: false, error: 'Marketplace administrator credentials are required' });
  }
  return next();
}

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
    categories: {},
  },
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
    await fs.mkdir(PACKAGES_DIR, { recursive: true });

    // Load existing metadata
    try {
      const data = await fs.readFile(METADATA_FILE, 'utf8');
      pluginMetadata = JSON.parse(data);
      console.log(`📦 Loaded ${Object.keys(pluginMetadata.plugins).length} plugins from metadata`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
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
    'protein-interaction-network': {
      id: 'protein-interaction-network',
      name: 'Protein Interaction Network Visualizer',
      description:
        'Interactive protein-protein interaction network analysis and visualization with real biological data',
      version: '1.8.3',
      author: 'NetworkBioLab',
      category: 'network-analysis',
      type: 'visualization',
      tags: ['protein', 'interaction', 'network', 'ppi', 'visualization', 'p53', 'pathway'],
      size: 3240000,
      homepage: 'https://github.com/genomeexplorer/protein-networks',
      repository: 'https://github.com/genomeexplorer/protein-networks.git',
      license: 'Apache-2.0',
      keywords: ['protein', 'network', 'interaction', 'visualization', 'biological-pathways'],
      dependencies: [],
      screenshots: ['https://example.com/screenshots/protein-network-1.png'],
      rating: 4.9,
      downloads: 8954,
      lastUpdated: '2024-12-03T14:22:00Z',
      status: 'published',
      submittedBy: 'admin',
      submittedAt: '2024-10-15T00:00:00Z',
      changelog: {
        '1.8.3': 'Performance improvements for large networks',
        '1.8.2': 'Added new layout algorithms',
        '1.8.0': 'Interactive filtering and search',
      },
      compatibility: {
        genomeExplorer: '>=2.0.0',
        platforms: ['windows', 'macos', 'linux'],
      },
      security: {
        checksum: 'sha256:def789ghi012...',
        signature: 'verified',
        scanResults: {
          malware: false,
          suspicious: false,
          lastScanned: '2024-12-03T09:00:00Z',
        },
      },
    },
  };

  pluginMetadata.plugins = samplePlugins;
  pluginMetadata.stats.totalPlugins = Object.keys(samplePlugins).length;
  pluginMetadata.stats.totalDownloads = Object.values(samplePlugins).reduce((sum, plugin) => sum + plugin.downloads, 0);

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
async function writeAtomically(filePath, content) {
  const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, content, { flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, filePath);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}

function saveMetadata(data = pluginMetadata) {
  return writeAtomically(METADATA_FILE, JSON.stringify(data, null, 2));
}

let metadataWrites = Promise.resolve();

function updateMetadata(operation) {
  const pending = metadataWrites.then(async () => {
    const next = structuredClone(pluginMetadata);
    const result = await operation(next);
    await saveMetadata(next);
    pluginMetadata = next;
    return result;
  });
  metadataWrites = pending.catch(() => {});
  return pending;
}

function trackDownload(id) {
  return updateMetadata(data => {
    const plugin = data.plugins[id];
    plugin.downloads = (plugin.downloads || 0) + 1;
    data.stats.totalDownloads++;
  });
}

async function readPluginUpload(filename) {
  if (typeof filename !== 'string' || filename !== path.basename(filename) || path.extname(filename) !== '.zip') {
    throw new Error('Invalid plugin archive filename');
  }
  const filePath = path.join(UPLOADS_DIR, filename);
  const stats = await fs.lstat(filePath);
  if (!stats.isFile() || stats.size === 0 || stats.size > MAX_PACKAGE_BYTES) {
    throw new Error('Invalid plugin archive size');
  }
  return fs.readFile(filePath);
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
  const missing = required.filter(field => typeof metadata?.[field] !== 'string' || !metadata[field].trim());

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  // Validate version format
  if (!semver.valid(metadata.version)) {
    throw new Error('Version must follow semantic versioning (e.g., 1.0.0)');
  }

  // Validate category
  const validCategories = [
    'variant-analysis',
    'network-analysis',
    'rna-analysis',
    'phylogenetics',
    'sequence-analysis',
    'protein-analysis',
    'visualization',
    'data-import',
    'statistical-analysis',
    'machine-learning',
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
      plugins = plugins.filter(
        plugin =>
          plugin.name.toLowerCase().includes(queryLower) ||
          plugin.description.toLowerCase().includes(queryLower) ||
          plugin.tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
          plugin.keywords.some(keyword => keyword.toLowerCase().includes(queryLower))
      );
    }

    // Apply filters (treat 'all' as no filter)
    if (category && category !== 'all') {
      plugins = plugins.filter(plugin => plugin.category === category);
    }

    if (type && type !== 'all') {
      plugins = plugins.filter(plugin => plugin.type === type);
    }

    if (author) {
      plugins = plugins.filter(plugin => plugin.author.toLowerCase().includes(author.toLowerCase()));
    }

    if (tags) {
      const requiredTags = Array.isArray(tags) ? tags : [tags];
      plugins = plugins.filter(plugin =>
        requiredTags.some(tag => plugin.tags.some(pluginTag => pluginTag.toLowerCase().includes(tag.toLowerCase())))
      );
    }

    // Sort by relevance and popularity
    plugins.sort((a, b) => {
      // Calculate relevance score if query exists
      if (query) {
        const queryLower = query.toLowerCase();
        let scoreA = 0,
          scoreB = 0;

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
          hasMore: endIndex < total,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Search plugins error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
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
    const plugin = Object.hasOwn(pluginMetadata.plugins, id) ? pluginMetadata.plugins[id] : null;

    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found',
        message: `Plugin with ID '${id}' not found`,
      });
    }

    res.json({
      success: true,
      data: plugin,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Get plugin details error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/plugins/:id/:version/download
 * Download plugin package file
 */
app.get('/api/v1/plugins/:id/:version/download', async (req, res) => {
  try {
    const { id, version } = req.params;
    const plugin = Object.hasOwn(pluginMetadata.plugins, id) ? pluginMetadata.plugins[id] : null;

    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found',
      });
    }

    if (plugin.version !== version) {
      return res.status(404).json({
        success: false,
        error: 'Plugin version not found',
        message: `Version ${version} not found. Available version: ${plugin.version}`,
      });
    }

    await trackDownload(id);

    if (SHA256.test(plugin.packageSha256 || '')) {
      return res.download(path.join(PACKAGES_DIR, `${plugin.packageSha256}.zip`), `${id}-${version}.zip`);
    }

    // Serve previously bundled packages through the legacy directory layout.
    const pluginPackagePath = path.join(PLUGINS_DIR, id, `${id}.zip`);

    // Check if actual plugin file exists
    try {
      await fs.access(pluginPackagePath);
      // File exists, serve it
      console.log(`📦 Serving plugin file: ${pluginPackagePath}`);
      res.download(pluginPackagePath, `${id}-${version}.zip`);
    } catch (error) {
      // File doesn't exist - check for directory structure with real files
      const pluginDir = path.join(PLUGINS_DIR, id, version);
      const indexPath = path.join(pluginDir, 'index.js');
      const manifestPath = path.join(pluginDir, 'manifest.json');
      const readmePath = path.join(pluginDir, 'README.md');

      try {
        await fs.access(indexPath);
        await fs.access(manifestPath);

        // Real plugin files exist - read and send them
        const [indexJs, manifestJson, readmeMd] = await Promise.all([
          fs.readFile(indexPath, 'utf-8'),
          fs.readFile(manifestPath, 'utf-8'),
          fs.readFile(readmePath, 'utf-8').catch(() => `# ${plugin.name}\n\n${plugin.description}`),
        ]);

        const manifest = JSON.parse(manifestJson);

        console.log(`📦 Serving real plugin files for ${id} from ${pluginDir}`);

        res.json({
          success: true,
          data: {
            pluginId: plugin.id,
            version: plugin.version,
            manifest: manifest,
            files: {
              'manifest.json': manifestJson,
              'index.js': indexJs,
              'README.md': readmeMd,
            },
            size: plugin.size,
            checksum: plugin.security.checksum,
          },
          message: 'Plugin package downloaded successfully',
          timestamp: new Date().toISOString(),
        });
      } catch (fileError) {
        // Neither zip nor directory files exist - this should not happen
        console.error(`❌ Plugin files not found for ${id}:`, fileError);
        res.status(404).json({
          success: false,
          error: 'Plugin files not found',
          message: `Plugin ${id} is registered but files are missing. Please contact the plugin author.`,
        });
      }
    }
  } catch (error) {
    console.error('❌ Download plugin error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
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
    const plugin = Object.hasOwn(pluginMetadata.plugins, id) ? pluginMetadata.plugins[id] : null;

    if (!plugin) {
      return res.status(404).json({
        success: false,
        error: 'Plugin not found',
      });
    }

    await trackDownload(id);

    // Return download information
    res.json({
      success: true,
      data: {
        downloadUrl: `${req.protocol}://${req.get('host')}/api/v1/plugins/${id}/${plugin.version}/download`,
        checksum: plugin.security.checksum,
        size: plugin.size,
        version: plugin.version,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Track download error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/plugins/submit
 * Submit a new plugin
 */
app.post('/api/v1/plugins/submit', upload.single('files'), async (req, res) => {
  const file = req.file;
  let retained = false;
  try {
    const metadata = JSON.parse(req.body.metadata);
    validatePluginMetadata(metadata);

    const pluginId = generatePluginId(metadata.name);
    if (!pluginId) throw new Error('Plugin name must contain letters or digits');
    if (!file) throw new Error('One ZIP plugin archive is required');

    const bytes = await readPluginUpload(file.filename);
    inspectPluginPackage({ data: bytes, pluginId, version: metadata.version });
    const packageSha256 = sha256(bytes);
    const submissionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const submission = {
      id: pluginId,
      submissionId,
      name: metadata.name,
      description: metadata.description,
      version: metadata.version,
      author: metadata.author,
      category: metadata.category,
      type: metadata.type,
      tags: metadata.tags || [],
      keywords: metadata.keywords || [],
      dependencies: metadata.dependencies || [],
      archiveFilename: file.filename,
      packageSha256,
      size: bytes.length,
      status: 'pending',
      submittedBy: req.body.submitterEmail || 'anonymous',
      submittedAt: now,
      rating: 0,
      downloads: 0,
      lastUpdated: now,
    };

    await updateMetadata(data => {
      if (Object.hasOwn(data.plugins, pluginId)) {
        throw Object.assign(new Error('Plugin already exists'), { statusCode: 409 });
      }
      data.pendingSubmissions[submissionId] = submission;
      data.stats.totalSubmissions++;
    }).catch(error => {
      if (error.statusCode) throw error;
      console.error('Failed to save marketplace submission:', error);
      throw Object.assign(new Error('Could not save submission'), { statusCode: 500 });
    });
    retained = true;

    return res
      .status(201)
      .json({ success: true, data: { submissionId, pluginId, status: 'pending', sha256: packageSha256 } });
  } catch (error) {
    if (file && !retained) {
      await fs.rm(file.path, { force: true }).catch(error => console.error('Failed to clean up upload:', error));
    }
    return res.status(error.statusCode || 400).json({
      success: false,
      error: 'Plugin submission failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/v1/submissions
 * Get pending submissions (admin only for now)
 */
app.get('/api/v1/submissions', requireAdministrator, (req, res) => {
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
        total: submissions.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Get submissions error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
});

/**
 * POST /api/v1/submissions/:id/approve
 * Approve a plugin submission (admin only for now)
 */
app.post('/api/v1/submissions/:id/approve', requireAdministrator, async (req, res) => {
  try {
    const { id } = req.params;
    const expectedDigest = req.body?.sha256;
    if (typeof expectedDigest !== 'string' || !SHA256.test(expectedDigest)) {
      return res.status(400).json({ success: false, error: 'The reviewed archive SHA-256 digest is required' });
    }

    const approval = await updateMetadata(async data => {
      const submission = Object.hasOwn(data.pendingSubmissions, id) ? data.pendingSubmissions[id] : null;
      if (!submission) {
        const published = Object.values(data.plugins).find(plugin => plugin.submissionId === id);
        if (published?.packageSha256 === expectedDigest) return { plugin: published };
        throw Object.assign(new Error('Submission not found'), { statusCode: 404 });
      }
      if (submission.packageSha256 !== expectedDigest) {
        throw Object.assign(new Error('Reviewed archive digest does not match the submission'), { statusCode: 409 });
      }
      if (Object.hasOwn(data.plugins, submission.id)) {
        throw Object.assign(new Error('Plugin already exists'), { statusCode: 409 });
      }

      let bytes;
      let evidence;
      try {
        bytes = await readPluginUpload(submission.archiveFilename);
        if (sha256(bytes) !== expectedDigest) throw new Error('Archive digest changed');
        evidence = inspectPluginPackage({ data: bytes, pluginId: submission.id, version: submission.version });
      } catch (error) {
        throw Object.assign(new Error('Submitted archive cannot be verified', { cause: error }), { statusCode: 422 });
      }

      await writeAtomically(path.join(PACKAGES_DIR, `${expectedDigest}.zip`), bytes);
      const { archiveFilename, ...plugin } = submission;
      plugin.status = 'published';
      plugin.approvedAt = new Date().toISOString();
      plugin.approvedBy = ADMIN_ID;
      plugin.security = { checksum: evidence.sha256, archiveSha256: expectedDigest };

      data.plugins[plugin.id] = plugin;
      delete data.pendingSubmissions[id];
      data.stats.totalPlugins++;
      data.stats.categories[plugin.category] = (data.stats.categories[plugin.category] || 0) + 1;
      return { plugin, archiveFilename };
    });

    if (approval.archiveFilename) {
      await fs
        .rm(path.join(UPLOADS_DIR, approval.archiveFilename), { force: true })
        .catch(error => console.error('Failed to clean up approved upload:', error));
    }
    return res.json({
      success: true,
      data: { pluginId: approval.plugin.id, status: 'approved', sha256: approval.plugin.packageSha256 },
    });
  } catch (error) {
    if (!error.statusCode) console.error('Failed to publish marketplace package:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.statusCode ? error.message : 'Could not publish the verified package',
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
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
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
        serverVersion: '1.1.0',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
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
        maxFileSize: '32MB',
        allowedFileTypes: ['.zip'],
        supportedCategories: [
          'variant-analysis',
          'network-analysis',
          'rna-analysis',
          'phylogenetics',
          'sequence-analysis',
          'protein-analysis',
          'visualization',
          'data-import',
          'statistical-analysis',
          'machine-learning',
        ],
        supportedTypes: ['function', 'visualization', 'data-source', 'utility'],
        submissionGuidelines: {
          requiredFields: ['name', 'description', 'version', 'author', 'category', 'type'],
          versionFormat: 'Semantic versioning (e.g., 1.0.0)',
          maxFiles: 1,
          reviewProcess: 'Manual review by administrators',
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Get config error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
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
      timestamp: new Date().toISOString(),
    },
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
        message: 'File size exceeds 32 MiB limit',
      });
    } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        message: 'Exactly one ZIP archive is allowed',
      });
    }
    return res.status(400).json({ success: false, error: 'Invalid upload', message: err.message });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: 'An unexpected error occurred',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Endpoint ${req.method} ${req.path} not found`,
  });
});

// Start server
async function startServer() {
  await initializeServer();

  const server = app.listen(PORT, HOST, () => {
    const address = server.address();
    console.log(`
🚀 CodeXomics Plugin Marketplace Server v1.1.0
📡 Server running on http://${HOST}:${address.port}
📚 API Documentation: http://${HOST}:${address.port}/api/v1/health
🔍 Plugin Search: http://${HOST}:${address.port}/api/v1/plugins
📊 Statistics: http://${HOST}:${address.port}/api/v1/stats
📤 Plugin Submission: http://${HOST}:${address.port}/api/v1/plugins/submit
⚙️  Configuration: http://${HOST}:${address.port}/api/v1/config
        `);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  await metadataWrites;
  process.exit(0);
});

// Start the server
if (require.main === module) {
  startServer().catch(console.error);
}

module.exports = app;
