# Plugin System Production Deployment Guide

## Overview

The plugin system has been enhanced to work correctly in both development and production (packaged) environments. This guide explains the changes and how the system handles different deployment scenarios.

## The Challenge

When Electron applications are packaged using electron-builder, the entire application is bundled into an ASAR archive. This creates several challenges for the plugin system:

1. **Read-only ASAR**: The ASAR archive is read-only, preventing users from adding custom plugins
2. **Path Changes**: Development paths like `src/renderer/modules/Plugins` don't exist as normal directories
3. **Dynamic Imports**: Module paths must be resolved differently in development vs production
4. **User Data**: Plugins downloaded from the marketplace need a writable location

## Solution Architecture

### Dual-Path Plugin System

The system now supports two distinct plugin locations:

**Built-in Plugins** (Read-only)
- Development: `src/renderer/modules/Plugins/`
- Production: `app.asar/src/renderer/modules/Plugins/`
- Bundled with the application
- Accessed via JavaScript imports (work transparently in ASAR)

**User-Installed Plugins** (Writable)
- Development: `src/renderer/modules/Plugins/UserInstalled/`
- Production (macOS): `~/Library/Application Support/CodeXomics/plugins/`
- Production (Windows): `%APPDATA%/CodeXomics/plugins/`
- Production (Linux): `~/.config/CodeXomics/plugins/`
- Downloaded from marketplace or manually installed
- Fully writable and accessible

### Key Components

#### 1. PluginPathResolver (`PluginPathResolver.js`)

Centralized path resolution service that:
- Detects whether app is in development or production mode
- Communicates with main process via IPC to get correct paths
- Provides unified API for accessing plugin directories
- Handles path conversion for both built-in and user plugins

**Key Methods:**
```javascript
await pluginPathResolver.initialize();
const builtinPath = pluginPathResolver.getBuiltinPluginsPath();
const userPath = pluginPathResolver.getUserPluginsPath();
const installPath = pluginPathResolver.getInstallPath(pluginId);
```

#### 2. Main Process IPC Handlers (`main.js`)

Three new IPC handlers provide path information:

**`get-plugin-paths`**
- Returns both built-in and user plugin paths
- Detects `app.isPackaged` to determine environment
- Calculates appropriate paths for current platform

**`ensure-directory`**
- Creates user plugins directory if it doesn't exist
- Only needed for user-writable locations

**`list-plugins`**
- Scans plugin directories for installed plugins
- Works with both ASAR and normal filesystem

#### 3. Preload Script Updates (`preload.js`)

Exposes three new APIs to renderer process:
- `window.electronAPI.getPluginPaths()`
- `window.electronAPI.ensureDirectory(dirPath)`
- `window.electronAPI.listPlugins(pluginPath)`

#### 4. PluginManagerV2 Integration

Enhanced to use PluginPathResolver:
- Initializes path resolver during startup
- Uses resolved paths for plugin imports
- Distinguishes between built-in and user plugins
- Logs paths for debugging

#### 5. PluginManagementUI Updates

Settings panel now shows both plugin directories:
- Displays read-only built-in path
- Displays writable user path
- Provides tooltip with full path information

## Path Resolution Flow

### Development Environment

1. PluginPathResolver detects `!app.isPackaged`
2. Returns `src/renderer/modules/Plugins` for built-in
3. Returns `src/renderer/modules/Plugins/UserInstalled` for user plugins
4. All paths are normal filesystem directories

### Production Environment

1. Main process detects `app.isPackaged === true`
2. Built-in path: `process.resourcesPath/app.asar/src/renderer/modules/Plugins`
3. User path: `app.getPath('userData')/plugins`
4. User directory created if missing
5. ASAR-aware imports used for built-in plugins

## File Structure

### Development
```
project/
├── src/
│   └── renderer/
│       └── modules/
│           └── Plugins/
│               ├── UniProtSearchPlugin.js (built-in)
│               ├── BiologicalNetworksPlugin.js (built-in)
│               └── UserInstalled/
│                   └── CustomPlugin/ (user plugin)
```

### Production (macOS)
```
/Applications/CodeXomics.app/
├── Contents/
│   └── Resources/
│       └── app.asar
│           └── src/renderer/modules/Plugins/ (built-in, read-only)

~/Library/Application Support/CodeXomics/
└── plugins/
    ├── marketplace-plugin-1/ (user installed)
    └── custom-plugin/ (manually installed)
```

## Usage Examples

### Loading Built-in Plugin

```javascript
// PluginManagerV2 automatically uses correct path
const uniprotPath = this.pathResolver 
    ? `${this.pathResolver.getBuiltinPluginsPath()}/UniProtSearchPlugin.js`
    : './Plugins/UniProtSearchPlugin.js';

const plugin = await import(uniprotPath);
```

### Installing User Plugin

```javascript
// Get writable installation path
const installPath = pluginPathResolver.getInstallPath('my-plugin');
// installPath will be in user's data directory in production

// Download/copy plugin to this location
await downloadPlugin(pluginUrl, installPath);
```

### Checking Plugin Source

```javascript
const source = pluginPathResolver.getPluginSource(pluginPath);
// Returns: 'builtin' | 'user' | 'unknown'

if (source === 'builtin') {
    console.log('This is a read-only built-in plugin');
} else if (source === 'user') {
    console.log('This is a user-installed plugin that can be updated');
}
```

## Security Considerations

### Built-in Plugins
- Signed as part of application package
- Cannot be modified by users
- Verified by code signing

### User Plugins
- Stored in user-writable location
- Should be validated before loading
- May require security permissions
- Can be updated/removed by user

## Platform-Specific Paths

### macOS
- User Data: `~/Library/Application Support/CodeXomics/plugins/`
- Built-in: `/Applications/CodeXomics.app/Contents/Resources/app.asar/...`

### Windows
- User Data: `C:\Users\{User}\AppData\Roaming\CodeXomics\plugins\`
- Built-in: `C:\Program Files\CodeXomics\resources\app.asar\...`

### Linux
- User Data: `~/.config/CodeXomics/plugins/`
- Built-in: `/opt/CodeXomics/resources/app.asar/...`

## Testing

### Development Testing
1. Verify plugins load from `src/renderer/modules/Plugins/`
2. Test marketplace plugin installation
3. Confirm user plugins go to `UserInstalled/` subdirectory

### Production Testing
1. Build application: `npm run build:mac`
2. Install and launch packaged app
3. Verify built-in plugins load correctly
4. Test marketplace plugin installation
5. Check user plugins directory creation
6. Verify paths in settings panel

## Troubleshooting

### Plugins Not Loading in Production
- Check console for path resolution errors
- Verify `app.isPackaged` is correctly detected
- Ensure user plugins directory has write permissions

### Import Errors
- Built-in plugins must use module imports, not file system reads
- User plugins may require dynamic import with absolute paths

### Permission Issues
- User plugins directory should have user write permissions
- On macOS, may need to grant app filesystem access
- On Linux, check directory ownership

## Future Enhancements

1. **Plugin Verification**: Digital signature verification for user plugins
2. **Auto-Update**: Automatic updates for user-installed plugins
3. **Plugin Sandboxing**: Isolate user plugins in separate processes
4. **Hot Reload**: Reload plugins without restarting application
5. **Plugin Dependencies**: Manage shared dependencies between plugins

## Migration from Legacy System

Existing plugins work without modification because:
- Relative imports in built-in plugins still work in ASAR
- PluginPathResolver provides fallback paths
- Backward compatibility maintained in PluginManagerV2

To take advantage of new features:
1. Use `pluginPathResolver` for path operations
2. Distinguish between built-in and user plugins
3. Update installation logic to use `getInstallPath()`
4. Test in both development and production

## Conclusion

The enhanced plugin system provides production-ready path handling while maintaining backward compatibility. Built-in plugins remain bundled and verified, while user plugins have a proper writable location across all platforms.
