# Quick Start: Workspace Commands

## Installation

```bash
# Install all dependencies (root + workspaces)
npm install
```

## Running Services

### Start Everything

```bash
npm run start-full
# Starts: MCP Server (3000) + Marketplace (3001) + Electron App
```

### Start Individual Services

```bash
# Electron App only
npm start

# Marketplace Server only
npm run marketplace:start

# Marketplace Server with auto-reload (development)
npm run marketplace:dev

# App + Marketplace
npm run start-with-marketplace

# App + MCP Server
npm run start-with-mcp
```

## Managing Dependencies

### Root Package (Electron App)

```bash
npm install <package-name>
npm uninstall <package-name>
```

### Marketplace Server Package

```bash
npm install <package-name> --workspace=packages/marketplace-server
npm uninstall <package-name> --workspace=packages/marketplace-server
```

## Testing

```bash
# Test marketplace server
npm test --workspace=packages/marketplace-server

# Test all workspaces
npm test --workspaces
```

## Workspace Information

```bash
# List all workspaces
npm ls --workspaces --depth=0

# Show workspace tree
npm ls --workspaces

# Get info about specific workspace
npm info packages/marketplace-server
```

## Development Workflows

### Scenario 1: Working on Main App

```bash
npm start
```

### Scenario 2: Working on Marketplace Server

```bash
cd packages/marketplace-server
npm run dev  # Auto-reload on changes
```

### Scenario 3: Full Stack Development

```bash
npm run start-full
```

### Scenario 4: Marketplace API Testing

```bash
# Terminal 1
npm run marketplace:start

# Terminal 2
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/plugins
curl http://localhost:3001/api/v1/stats
```

### Marketplace administration

The server binds to `127.0.0.1` by default. Set `CODEXOMICS_MARKETPLACE_HOST` explicitly to serve on another interface. For remote deployment, use a TLS reverse proxy and keep the administrator token on the server side.

- Set `CODEXOMICS_MARKETPLACE_ADMIN_TOKEN` to a strong secret before starting the server. The pending list and approval routes require `Authorization: Bearer <token>`. They are disabled when the token is absent.
- Set `CODEXOMICS_MARKETPLACE_ADMIN_ID` to the audit identity used for approvals.
- Submit one ZIP file, up to 32 MiB, with a root manifest whose ID and version match the submission. To approve a submission, review the staged archive and send its SHA-256 as `sha256` in the approval request body. Re-submit older pending packages that lack a verified ZIP digest.
- Set `CODEXOMICS_MARKETPLACE_DATA_DIR` to an isolated data directory for a deployment or test server.

## Directory Structure

```
CodeXomics/
├── packages/
│   └── marketplace-server/      # Plugin Marketplace Server
│       ├── plugin-marketplace-server.js
│       ├── package.json
│       ├── marketplace-data/
│       └── README.md
├── src/                         # Electron App Source
├── tools_registry/              # Plugin Tools
├── package.json                 # Root Workspace Config
└── README.md
```

## Port Mapping

- **3000**: MCP Server
- **3001**: Plugin Marketplace Server
- **Electron App**: Main window

## Quick Troubleshooting

### Dependencies not installing

```bash
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules
npm install
```

### Port already in use

```bash
# Check what's using the port
lsof -i :3001

# Kill the process
pkill -f plugin-marketplace-server
```

### Workspace not detected

```bash
npm ls --workspaces
```

## More Information

- Full Architecture: `WORKSPACE_ARCHITECTURE.md`
- Migration Guide: `WORKSPACE_MIGRATION_GUIDE.md`
- Marketplace Server: `packages/marketplace-server/README.md`
- Main README: `README.md`
