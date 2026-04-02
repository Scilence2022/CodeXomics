# Workspace Migration Guide

## Overview

This guide documents the migration of CodeXomics to an npm workspace structure, completed on December 2, 2024. The workspace architecture provides better organization and independent dependency management for the Plugin Marketplace Server while maintaining backward compatibility.

## What Changed

### Directory Structure

**Before:**

```
CodeXomics/
├── plugin-marketplace-server.js
├── marketplace-server-package.json
├── marketplace-data/
├── start-marketplace-server.sh
└── ...
```

**After:**

```
CodeXomics/
├── packages/
│   └── marketplace-server/
│       ├── plugin-marketplace-server.js
│       ├── package.json (renamed from marketplace-server-package.json)
│       ├── marketplace-data/
│       ├── start-marketplace-server.sh
│       └── README.md
├── package.json (updated with workspace config)
├── WORKSPACE_ARCHITECTURE.md (new)
└── ...
```

### Package.json Changes

#### Root package.json

1. **Added workspace configuration:**

   ```json
   "workspaces": [
     "packages/*"
   ]
   ```

2. **Added marketplace management scripts:**
   - `marketplace:start` - Start marketplace server
   - `marketplace:dev` - Start with auto-reload
   - `marketplace:install` - Install marketplace dependencies
   - `start-with-marketplace` - Start app + marketplace
   - `start-full` - Start app + MCP + marketplace

#### Marketplace package.json

- Renamed from `marketplace-server-package.json` to `package.json`
- Moved to `packages/marketplace-server/`
- Content remains unchanged

### Files Moved

The following files were moved to `packages/marketplace-server/`:

- `plugin-marketplace-server.js`
- `marketplace-server-package.json` → `package.json`
- `start-marketplace-server.sh`
- `marketplace-data/` directory

### Files Added

- `packages/marketplace-server/README.md` - Package documentation
- `WORKSPACE_ARCHITECTURE.md` - Workspace architecture documentation
- `WORKSPACE_MIGRATION_GUIDE.md` - This migration guide
- `.gitkeep` files in marketplace-data subdirectories

### .gitignore Updates

Added workspace-specific patterns:

```gitignore
packages/*/node_modules/
packages/*/package-lock.json
packages/marketplace-server/marketplace-data/uploads/*
!packages/marketplace-server/marketplace-data/uploads/.gitkeep
```

## What Stayed the Same

### No Breaking Changes

1. **API remains identical** - The marketplace server still runs on port 3001 with the same endpoints
2. **Client code unchanged** - Frontend modules continue to work without modifications
3. **Functionality preserved** - All features work exactly as before
4. **Data compatibility** - Existing `marketplace-data/` content is preserved

### Backward Compatibility

The old files at the root level can remain for a transition period:

- `plugin-marketplace-server.js` (root)
- `marketplace-server-package.json` (root)
- `marketplace-data/` (root)

However, these are now duplicates and can be safely removed after verification.

## Developer Migration Steps

### For Existing Developers

1. **Pull the latest changes:**

   ```bash
   git pull origin main
   ```

2. **Clean install dependencies:**

   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Verify workspace setup:**

   ```bash
   npm ls --workspaces
   ```

4. **Update your workflow:**
   - Old: `node plugin-marketplace-server.js`
   - New: `npm run marketplace:start`

### For New Developers

Follow the standard setup:

```bash
git clone <repository>
cd CodeXomics
npm install
npm run marketplace:start  # Start marketplace
npm start                  # Start app (in another terminal)
```

## Updated Workflows

### Starting Services

#### Development (Recommended)

```bash
# Start everything together
npm run start-full

# Or individually:
npm run mcp-server        # Terminal 1: MCP Server (port 3000)
npm run marketplace:start # Terminal 2: Marketplace (port 3001)
npm start                 # Terminal 3: Electron App
```

#### Marketplace Only

```bash
npm run marketplace:start
# or with auto-reload
npm run marketplace:dev
```

#### Application with Marketplace

```bash
npm run start-with-marketplace
```

### Installing Dependencies

#### Root dependencies (Electron app):

```bash
npm install <package-name>
```

#### Marketplace dependencies:

```bash
npm install <package-name> --workspace=packages/marketplace-server
# or
cd packages/marketplace-server
npm install <package-name>
```

### Running Scripts

#### Marketplace scripts from root:

```bash
npm run start --workspace=packages/marketplace-server
npm run dev --workspace=packages/marketplace-server
```

#### Marketplace scripts from package directory:

```bash
cd packages/marketplace-server
npm start
npm run dev
```

## CI/CD Updates

### Build Scripts

No changes required for Electron builds. The `electron-builder` configuration excludes the marketplace server from the packaged application.

### Testing

```bash
# Test marketplace
npm test --workspace=packages/marketplace-server

# Test all workspaces
npm test --workspaces
```

### Deployment

#### Development/Staging

```bash
npm run marketplace:start
```

#### Production (Remote Server)

```bash
cd packages/marketplace-server
npm install --production
node plugin-marketplace-server.js
```

## Rollback Procedure

If issues arise, you can temporarily revert to the old structure:

1. **Use the root-level files:**

   ```bash
   node plugin-marketplace-server.js
   ```

2. **Or restore from git:**
   ```bash
   git checkout <previous-commit>
   ```

The old files remain in the repository during the transition period for safety.

## Verification Checklist

After migration, verify:

- [ ] `npm install` completes without errors
- [ ] `npm ls --workspaces` shows marketplace-server
- [ ] `npm run marketplace:start` starts the server
- [ ] Server responds at `http://localhost:3001/api/v1/health`
- [ ] Main app can connect to marketplace
- [ ] Plugin search and submission work
- [ ] All existing data is preserved in `marketplace-data/`

## Common Issues and Solutions

### Issue: Workspace not detected

**Solution:**

```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Dependencies not installing

**Solution:**

```bash
npm install --workspace=packages/marketplace-server --force
```

### Issue: Old scripts still used

**Solution:** Update scripts in your workflow to use new npm run commands.

### Issue: Port conflicts

**Solution:**

```bash
# Stop old marketplace processes
pkill -f plugin-marketplace-server
# Restart with workspace command
npm run marketplace:start
```

## Future Considerations

### Additional Packages

The workspace structure is designed to accommodate future packages:

```
packages/
├── marketplace-server/  # ✅ Implemented
├── mcp-server/          # 🔄 Potential future package
├── cli/                 # 🔄 Potential future package
└── shared/              # 🔄 Potential future package
```

### Full Separation

If needed in the future, the marketplace-server package can be:

1. Moved to its own repository
2. Published to npm
3. Installed as a regular dependency
4. The HTTP API already provides the necessary decoupling

## Testing the Migration

### Quick Verification

```bash
# 1. Install
npm install

# 2. Check workspace
npm ls --workspaces

# 3. Start marketplace
npm run marketplace:start &

# 4. Test health endpoint
curl http://localhost:3001/api/v1/health

# 5. Test plugin search
curl http://localhost:3001/api/v1/plugins

# 6. Stop server
pkill -f plugin-marketplace-server
```

### Integration Test

```bash
# Start all services
npm run start-full

# In CodeXomics app:
# 1. Open Plugin Marketplace (Options → Plugin Marketplace)
# 2. Search for plugins
# 3. View plugin details
# 4. Test submission workflow
```

## Benefits Realized

1. **Clear Organization** - Marketplace server has its own namespace
2. **Independent Dependencies** - No dependency conflicts
3. **Simplified Workflows** - Unified npm scripts
4. **Better Documentation** - Each package has its own README
5. **Future-Ready** - Easy to add more packages or extract to separate repos

## Documentation Updates

Updated documents:

- `WORKSPACE_ARCHITECTURE.md` - Complete architecture overview
- `packages/marketplace-server/README.md` - Package-specific docs
- `WORKSPACE_MIGRATION_GUIDE.md` - This migration guide

Existing documents remain valid:

- `docs/COMPLETE_SYSTEM_ARCHITECTURE.md`
- `docs/project-guides/PLUGIN_MARKETPLACE_USAGE_GUIDE.md`

## Support

For questions or issues related to the workspace migration:

1. Check this migration guide
2. Review `WORKSPACE_ARCHITECTURE.md`
3. Check package-specific README files
4. Open an issue on GitHub

## Timeline

- **December 2, 2024**: Workspace structure implemented
- **Transition Period**: 1-2 weeks (old files remain for compatibility)
- **Cleanup**: Remove duplicate files at root level after verification

## Acknowledgments

This migration maintains backward compatibility while providing a foundation for future scalability and better code organization.
