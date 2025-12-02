# GenomeExplorer Plugin Marketplace Server

A RESTful API server for plugin distribution, discovery, and submission for the CodeXomics platform.

## Overview

The Plugin Marketplace Server provides a centralized repository for bioinformatics plugins, enabling:
- Plugin discovery and search
- Plugin submission and review workflow
- Dependency management
- Security validation
- Download tracking and statistics

## Quick Start

### From Root Directory (Recommended)

```bash
# Install all workspace dependencies
npm install

# Start the marketplace server
npm run marketplace:start

# Or start in development mode with auto-reload
npm run marketplace:dev
```

### From This Package Directory

```bash
# Install dependencies
npm install

# Start the server
npm start

# Or use the startup script
./start-marketplace-server.sh
```

## API Endpoints

### Plugin Discovery
- `GET /api/v1/plugins` - Search and list plugins
- `GET /api/v1/plugins/:id` - Get plugin details
- `GET /api/v1/categories` - List plugin categories

### Plugin Submission
- `POST /api/v1/plugins/submit` - Submit a new plugin
- `GET /api/v1/submissions` - List pending submissions
- `POST /api/v1/submissions/:id/approve` - Approve a submission

### Server Management
- `GET /api/v1/health` - Health check
- `GET /api/v1/stats` - Server statistics
- `GET /api/v1/config` - Server configuration

### Plugin Operations
- `POST /api/v1/plugins/:id/download` - Track plugin download

## Configuration

The server uses the following defaults:
- **Port**: 3001 (MCP Server port + 1)
- **Max File Size**: 50MB
- **Allowed File Types**: .zip, .tar.gz, .json, .js, .md
- **Max Files per Submission**: 5

Configuration can be modified through:
- Environment variables (`PORT`)
- The CodeXomics application's marketplace configuration UI

## Data Storage

Plugin data is stored in the `marketplace-data/` directory:
```
marketplace-data/
├── plugins/          # Published plugin packages
├── uploads/          # Temporary upload storage
└── metadata.json     # Plugin metadata and statistics
```

## Development

### Dependencies
- **express**: Web server framework
- **cors**: Cross-origin resource sharing
- **multer**: File upload handling
- **nodemon** (dev): Auto-restart on file changes

### Adding Sample Plugins

On first startup, the server automatically initializes with sample plugins for demonstration. The metadata is persisted in `marketplace-data/metadata.json`.

### Testing

```bash
# Test health endpoint
curl http://localhost:3001/api/v1/health

# Search plugins
curl http://localhost:3001/api/v1/plugins?query=variant

# Get server statistics
curl http://localhost:3001/api/v1/stats
```

## Integration with CodeXomics

The marketplace server is designed to run alongside the CodeXomics Electron application:

1. CodeXomics connects to `http://localhost:3001/api/v1`
2. Users can browse, search, and install plugins through the UI
3. Plugin submissions are made through the CodeXomics submission dialog
4. Administrators can review and approve submissions

## Architecture

The server implements a stateless RESTful API with:
- **In-memory metadata cache** for fast queries
- **File-based persistence** for durability
- **Pluggable validation** for security and quality checks
- **Event-driven submission workflow** for extensibility

## Security

The server includes:
- File type validation
- File size limits
- Checksum verification support
- Malware scanning placeholder (to be implemented)
- Manual review workflow for submissions

## Production Deployment

For production deployment:

1. Set appropriate environment variables
2. Configure reverse proxy (nginx, Apache)
3. Enable HTTPS
4. Implement proper authentication for admin endpoints
5. Set up automated backups of `marketplace-data/`
6. Configure monitoring and logging

## Version History

- **v1.1.0**: Added plugin submission support with file uploads
- **v1.0.0**: Initial release with plugin discovery and download tracking

## License

MIT License - See LICENSE file in the root repository
