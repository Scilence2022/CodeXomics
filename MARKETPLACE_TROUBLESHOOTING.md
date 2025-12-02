# Plugin Marketplace Troubleshooting Guide

## Common Issues and Solutions

### Issue: "No Plugins Available" Despite Successful Connection

**Symptoms:**
- Marketplace UI loads successfully
- Connection test shows "✅ Connection successful"
- Plugin list displays "No Plugins Available"
- Server logs show `📦 Loaded X plugins from metadata`

**Root Cause:**

The marketplace server filters plugins by `status: 'published'` by default. If the `metadata.json` file was created before this field was added to the schema, all plugins will lack the status field and be filtered out.

**Verification:**

1. Check server API response:
   ```bash
   curl http://localhost:3001/api/v1/plugins
   ```
   
   If you see:
   ```json
   {
     "success": true,
     "data": {
       "plugins": [],
       "pagination": { "total": 0 }
     }
   }
   ```

2. Check metadata file has status field:
   ```bash
   cat packages/marketplace-server/marketplace-data/metadata.json | grep "status"
   ```
   
   If no results, the schema is outdated.

**Solution:**

Regenerate the metadata with the correct schema:

```bash
# Stop the marketplace server
pkill -f plugin-marketplace-server

# Backup old metadata
cd packages/marketplace-server
mv marketplace-data/metadata.json marketplace-data/metadata.json.backup

# Restart server (will auto-generate new metadata)
npm run marketplace:start
```

The server will automatically create fresh sample plugins with the complete schema including:
- `status: 'published'`
- `submittedBy: 'admin'`
- `submittedAt: '2024-...'`
- Security scan results
- Compatibility information

**Verification After Fix:**

```bash
curl http://localhost:3001/api/v1/plugins
# Should return 4 sample plugins

# Or check in UI:
# Options → Plugin Marketplace
# Should display: Genomic Variant Caller, Protein Interaction Network, etc.
```

### Issue: Port Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**

```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
lsof -ti:3001 | xargs kill -9

# Or kill by name
pkill -f plugin-marketplace-server

# Restart
npm run marketplace:start
```

### Issue: Workspace Not Detected

**Symptoms:**
```bash
npm run marketplace:start
# Error: missing script: marketplace:start
```

**Solution:**

```bash
# Verify workspace configuration
npm ls --workspaces

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Verify root package.json has workspaces field
grep -A 2 "workspaces" package.json
```

### Issue: Dependencies Not Installing

**Symptoms:**
- `npm install` completes but marketplace server has missing dependencies
- Error: `Cannot find module 'express'`

**Solution:**

```bash
# Install workspace dependencies explicitly
npm install --workspace=packages/marketplace-server

# Or from package directory
cd packages/marketplace-server
npm install
```

### Issue: Server Starts But API Returns 404

**Symptoms:**
- Server logs show successful startup
- `curl http://localhost:3001/api/v1/health` returns 404

**Possible Causes:**

1. Wrong port (check if server is actually on 3001)
2. Server crashed after startup
3. Firewall blocking connections

**Solution:**

```bash
# Check server is running
lsof -i :3001

# Check server logs for errors
# Look for stack traces after startup message

# Try direct access
curl -v http://localhost:3001/api/v1/health

# Check firewall (macOS)
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate
```

### Issue: Metadata Corruption

**Symptoms:**
- Server crashes on startup
- Error: `SyntaxError: Unexpected token in JSON`

**Solution:**

```bash
# Validate JSON
cat packages/marketplace-server/marketplace-data/metadata.json | python3 -m json.tool

# If invalid, restore from backup or regenerate
mv packages/marketplace-server/marketplace-data/metadata.json packages/marketplace-server/marketplace-data/metadata.json.corrupted
npm run marketplace:start
```

### Issue: Plugins Not Persisting

**Symptoms:**
- Plugins disappear after server restart
- New submissions lost

**Possible Causes:**
- metadata.json file permissions
- Directory permissions

**Solution:**

```bash
# Check file permissions
ls -la packages/marketplace-server/marketplace-data/

# Fix permissions if needed
chmod 644 packages/marketplace-server/marketplace-data/metadata.json
chmod 755 packages/marketplace-server/marketplace-data/
chmod 755 packages/marketplace-server/marketplace-data/uploads/
```

### Issue: Connection Test Fails in UI

**Symptoms:**
- UI shows "🔴 Disconnected"
- Connection test returns error

**Checklist:**

1. Server is running:
   ```bash
   curl http://localhost:3001/api/v1/health
   ```

2. Port is correct in configuration:
   - Default should be 3001
   - Check `PluginMarketplaceConfig.js` default sources

3. CORS is enabled:
   - Server should have `app.use(cors())`

4. Network settings:
   - Check if localhost resolves: `ping localhost`
   - Try 127.0.0.1 instead: `http://127.0.0.1:3001`

**Solution:**

```bash
# Restart server
npm run marketplace:start

# Test from command line
curl http://localhost:3001/api/v1/health

# If successful but UI fails, check browser console for CORS errors
```

## Debug Mode

To get detailed logging:

```bash
# Set debug environment variable
DEBUG=* npm run marketplace:start

# Or modify server code temporarily to add more logging
```

## Getting Help

If issues persist:

1. Check `WORKSPACE_IMPLEMENTATION_SUMMARY.md` for detailed architecture
2. Review `packages/marketplace-server/README.md` for API documentation
3. Check server logs for error messages
4. Verify workspace configuration with `npm ls --workspaces`
5. Open an issue on GitHub with:
   - Error messages
   - Server logs
   - Steps to reproduce

## Quick Health Check

Run this comprehensive check:

```bash
# 1. Check workspace
npm ls --workspaces --depth=0

# 2. Check server is running
lsof -i :3001

# 3. Test health endpoint
curl http://localhost:3001/api/v1/health

# 4. Test plugin list
curl http://localhost:3001/api/v1/plugins | python3 -m json.tool

# 5. Check metadata file
cat packages/marketplace-server/marketplace-data/metadata.json | python3 -m json.tool | grep status

# All checks should pass for a healthy system
```

## Prevention Best Practices

1. **Always use workspace commands:**
   ```bash
   npm run marketplace:start  # Not: node plugin-marketplace-server.js
   ```

2. **Don't manually edit metadata.json:**
   - Use API endpoints for submissions
   - Use admin endpoints for approvals

3. **Keep backups:**
   ```bash
   cp packages/marketplace-server/marketplace-data/metadata.json /path/to/backups/
   ```

4. **Monitor logs:**
   - Watch for warnings during startup
   - Check for schema validation errors

5. **Update regularly:**
   ```bash
   git pull
   npm install  # Updates all workspaces
   ```
