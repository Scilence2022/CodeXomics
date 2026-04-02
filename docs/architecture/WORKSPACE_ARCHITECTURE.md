# CodeXomics Workspace Architecture

## Overview

CodeXomics uses an npm workspace structure to organize the codebase into independent but coordinated packages. This architecture provides clear separation between the main application and supporting services while maintaining the convenience of a monorepo.

## Workspace Structure

```
CodeXomics/
├── packages/
│   ├── marketplace-server/          # Plugin Marketplace API Server
│   │   ├── plugin-marketplace-server.js
│   │   ├── package.json
│   │   ├── marketplace-data/
│   │   ├── start-marketplace-server.sh
│   │   └── README.md
│   └── app/ (future)                # Main Electron application
├── src/                              # Application source code
├── tools_registry/                   # Plugin tools registry
├── package.json                      # Root workspace configuration
└── ...
```

## Package Descriptions

### Root Package (`codexomics`)

The root package serves as the workspace coordinator and contains the main Electron application code.

**Key Responsibilities:**

- Electron application initialization
- MCP server integration
- Plugin management frontend
- Bioinformatics tools integration

**Scripts:**

- `npm start` - Start the Electron application
- `npm run marketplace:start` - Start marketplace server
- `npm run start-with-marketplace` - Start app + marketplace
- `npm run start-full` - Start app + MCP + marketplace

### Marketplace Server Package (`genomeexplorer-plugin-marketplace`)

Independent RESTful API server for plugin distribution and management.

**Key Responsibilities:**

- Plugin discovery and search
- Plugin submission workflow
- Metadata management
- Download tracking

**Location:** `packages/marketplace-server/`

**Port:** 3001 (MCP Server port + 1)

## Workspace Benefits

### 1. Clear Separation of Concerns

Each package has well-defined boundaries and responsibilities. The marketplace server can evolve independently without affecting the main application.

### 2. Independent Dependency Management

Each package maintains its own `package.json` with specific dependencies:

- **Root**: Electron, bioinformatics libraries, UI frameworks
- **Marketplace Server**: Express, CORS, Multer (minimal web server stack)

### 3. Simplified Development Workflow

Developers can work on specific packages without loading the entire codebase:

```bash
# Work on marketplace server
cd packages/marketplace-server
npm install
npm start

# Work on main app
npm start  # from root
```

### 4. Flexible Deployment Options

The marketplace server can be:

- Run locally alongside the Electron app (development)
- Deployed to a remote server (production)
- Scaled independently as needed

### 5. Coordinated Version Management

All packages share a single git repository, making it easy to:

- Coordinate breaking changes
- Tag releases
- Track API compatibility

## Development Workflows

### Initial Setup

```bash
# From root directory
npm install

# This installs:
# 1. Root package dependencies
# 2. All workspace package dependencies
# 3. Shared dependencies (hoisted to root)
```

### Starting Services

#### Development Mode (All Services)

```bash
npm run start-full
# Starts: MCP Server (3000) + Marketplace (3001) + Electron App
```

#### Application Only

```bash
npm start
```

#### Marketplace Server Only

```bash
npm run marketplace:start
# or with auto-reload
npm run marketplace:dev
```

#### Application + Marketplace

```bash
npm run start-with-marketplace
```

### Working with Workspaces

#### Install dependencies for a specific workspace

```bash
npm install <package-name> --workspace=packages/marketplace-server
```

#### Run scripts in a specific workspace

```bash
npm run <script-name> --workspace=packages/marketplace-server
```

#### Install dependencies for all workspaces

```bash
npm install
```

## Migration from Single Package

The workspace structure was introduced to better organize the growing codebase. The original marketplace server files were located at the root level:

**Before:**

```
CodeXomics/
├── plugin-marketplace-server.js
├── marketplace-server-package.json
├── marketplace-data/
└── ...
```

**After:**

```
CodeXomics/
├── packages/
│   └── marketplace-server/
│       ├── plugin-marketplace-server.js
│       ├── package.json (was marketplace-server-package.json)
│       ├── marketplace-data/
│       └── ...
└── ...
```

### Breaking Changes

None. The API and functionality remain identical. Client code continues to connect to `http://localhost:3001/api/v1`.

### Path Updates

The marketplace server now runs from `packages/marketplace-server/` instead of root, but this is transparent to:

- The Electron application (connects via HTTP)
- End users (same port, same API)
- Client modules (no import path changes)

## API Integration

The main application integrates with the marketplace server through HTTP REST API calls:

```javascript
// Example from PluginMarketplace.js
const response = await fetch('http://localhost:3001/api/v1/plugins', {
  method: 'GET',
  headers: {
    Accept: 'application/json',
  },
});
```

This loose coupling means:

- No import statements between packages
- No shared code dependencies
- Clean separation via HTTP protocol
- Easy to point to remote servers

## Future Expansion

The workspace structure is designed to accommodate future packages:

### Potential Future Packages

- `packages/mcp-server` - MCP server as independent package
- `packages/cli` - Command-line interface tools
- `packages/shared` - Shared utilities and types
- `packages/plugins` - Core plugin implementations

### Adding a New Package

1. Create package directory:

   ```bash
   mkdir -p packages/new-package
   ```

2. Create package.json:

   ```json
   {
     "name": "@codexomics/new-package",
     "version": "1.0.0",
     "main": "index.js"
   }
   ```

3. The workspace will automatically detect it (no root config changes needed)

## Testing

### Running Tests

```bash
# Test specific workspace
npm test --workspace=packages/marketplace-server

# Test all workspaces
npm test --workspaces
```

### Integration Testing

Since packages communicate via HTTP, integration tests can:

- Start servers in test mode
- Make HTTP requests
- Verify responses
- Clean up test data

## Deployment Strategies

### Development (Local)

All services run on localhost with different ports. The Electron app connects to local marketplace.

### Staging (Hybrid)

- Electron app runs locally
- Marketplace server deployed to staging server
- Configure `PluginMarketplaceConfig` to point to staging URL

### Production (Distributed)

- Electron app distributed to users
- Marketplace server on production infrastructure
- Configure official marketplace URL in default sources

## Troubleshooting

### Workspace Dependencies Not Installing

```bash
# Clean install
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules
npm install
```

### Can't Find Workspace Package

```bash
# Verify workspace configuration
npm ls --workspaces
```

### Port Conflicts

```bash
# Check if ports are in use
lsof -i :3000  # MCP Server
lsof -i :3001  # Marketplace Server
```

## Best Practices

1. **Never import across packages** - Use HTTP API for communication
2. **Keep dependencies minimal** - Each package should be lightweight
3. **Version in sync** - Coordinate breaking changes across packages
4. **Document APIs** - Maintain clear API contracts between packages
5. **Test independently** - Each package should have its own test suite

## References

- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v7/using-npm/workspaces)
- [Monorepo Best Practices](https://monorepo.tools/)
- CodeXomics Architecture Documentation: `docs/COMPLETE_SYSTEM_ARCHITECTURE.md`

## Version History

- **2024-12-02**: Initial workspace structure implementation
  - Created `packages/marketplace-server/`
  - Added workspace npm scripts
  - Documented architecture

## License

MIT License - See LICENSE file in the root repository
