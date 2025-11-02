# MCP Auto-Connect Disabled by Default Fix

## Problem Description

The Genome AI Studio was experiencing unwanted automatic MCP server connections on startup, causing repeated connection failures and console error spam:

```
MCPServerManager.js:696 WebSocket connection to 'ws://localhost:3003/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED
MCPServerManager.js:728 WebSocket server error (genome-studio)
MCPServerManager.js:733 WebSocket server disconnected: Genome AI Studio
ChatManager.js:654 MCP Server disconnected: Genome AI Studio
```

The system was continuously attempting to connect to `ws://localhost:3003/` even when no MCP server was running, creating a poor user experience with constant error messages.

## Root Cause Analysis

### Auto-Connect Configuration
The MCPServerManager was configured with `autoConnect: true` by default for the built-in 'genome-studio' server:

```javascript
['genome-studio', {
    id: 'genome-studio',
    name: 'Genome AI Studio',
    url: 'ws://localhost:3003',
    enabled: true,
    autoConnect: true, // This caused unwanted connections
    // ...
}]
```

### Initialization Behavior
The `setupAutoConnect()` method in MCPServerManager constructor was unconditionally attempting connections to all servers with `autoConnect: true`, regardless of whether the user wanted these connections.

### No Global Control
There was no global setting to disable auto-connection functionality entirely, making it impossible for users to prevent unwanted connection attempts.

## Technical Solution

### 1. Default Configuration Changes

#### Modified `src/renderer/modules/MCPServerManager.js`

**Changed default server configuration:**
```javascript
// Before
autoConnect: true,

// After  
autoConnect: false, // Changed: Disable auto-connection by default
```

**Updated addServer method defaults:**
```javascript
// Before
autoConnect: serverConfig.autoConnect !== false,

// After
autoConnect: serverConfig.autoConnect === true, // Changed: Default to false for auto-connection
```

### 2. Global Auto-Connect Control

**Added global auto-connect setting check in setupAutoConnect():**
```javascript
setupAutoConnect() {
    // Check global auto-connect setting
    const globalSettings = this.configManager ? 
        this.configManager.get('mcpGlobalSettings', { enableAutoConnect: false }) : 
        { enableAutoConnect: false };
        
    if (!globalSettings.enableAutoConnect) {
        console.log('🚫 MCP auto-connect is disabled globally');
        return;
    }
    
    // Rest of auto-connect logic...
}
```

**Added control methods:**
```javascript
// Enable/disable global auto-connect
setGlobalAutoConnect(enabled) {
    const globalSettings = this.configManager ? 
        this.configManager.get('mcpGlobalSettings', { enableAutoConnect: false }) : 
        { enableAutoConnect: false };
        
    globalSettings.enableAutoConnect = enabled;
    
    if (this.configManager) {
        this.configManager.set('mcpGlobalSettings', globalSettings);
    }
    
    console.log(`🔧 MCP global auto-connect ${enabled ? 'enabled' : 'disabled'}`);
    
    // If enabling, trigger auto-connect for eligible servers
    if (enabled) {
        this.setupAutoConnect();
    }
}

// Get global auto-connect status
getGlobalAutoConnect() {
    const globalSettings = this.configManager ? 
        this.configManager.get('mcpGlobalSettings', { enableAutoConnect: false }) : 
        { enableAutoConnect: false };
    return globalSettings.enableAutoConnect;
}
```

### 3. ChatManager Compatibility

The ChatManager already had proper default settings:
```javascript
const defaultSettings = {
    allowAutoActivation: false, // Already set to false
    autoConnect: false, // Already set to false
    serverUrl: 'ws://localhost:3003',
    reconnectDelay: 5
};
```

## Implementation Details

### Configuration Hierarchy

1. **Global Setting**: `mcpGlobalSettings.enableAutoConnect` (default: false)
2. **Server Setting**: Individual server `autoConnect` property (default: false)
3. **Both must be true** for auto-connection to occur

### Behavior Changes

#### Before Fix:
- All servers with `autoConnect: true` would automatically connect on startup
- No way to globally disable auto-connection
- Caused unwanted connection attempts and error spam

#### After Fix:
- **Default behavior**: No automatic connections
- **Global control**: `setGlobalAutoConnect(true/false)` to enable/disable globally
- **Individual control**: Each server's `autoConnect` setting still respected
- **Manual connections**: Still possible through UI or API calls

### Migration Strategy

- **Existing installations**: Will automatically get the new defaults on next startup
- **Saved configurations**: Existing server configs with `autoConnect: true` will be preserved but won't auto-connect unless global setting is enabled
- **Backward compatibility**: All existing manual connection functionality remains unchanged

## Testing

### Test File: `test/fix-validation-tests/test-mcp-auto-connect-disabled.html`

The test file provides comprehensive validation:

1. **Configuration Testing**: Verifies default settings are correct
2. **Auto-Connect Behavior**: Monitors for unwanted connection attempts
3. **Manual Control**: Tests enable/disable functionality
4. **Server Status**: Displays current connection states
5. **Connection Logging**: Captures and displays all connection attempts

### Test Results Expected:

✅ **PASS**: No automatic connection attempts on startup
✅ **PASS**: Global auto-connect setting defaults to false  
✅ **PASS**: Individual server autoConnect defaults to false
✅ **PASS**: Manual connections still work when initiated by user

## User Experience Impact

### Immediate Benefits:
- **No unwanted connections**: Clean startup without connection errors
- **Reduced console spam**: No more repeated connection failure messages
- **Better performance**: No unnecessary network attempts
- **User control**: Connections only happen when explicitly requested

### User Control Options:
1. **Global Enable**: `mcpServerManager.setGlobalAutoConnect(true)`
2. **Individual Server**: Enable autoConnect for specific servers
3. **Manual Connection**: Use UI buttons or API calls as needed

## Security Considerations

- **Default-deny approach**: No connections attempted without explicit user consent
- **Granular control**: Users can enable auto-connect globally or per-server
- **Audit trail**: All connection attempts are logged for debugging

## Future Enhancements

1. **UI Integration**: Add global auto-connect toggle to settings UI
2. **Connection Profiles**: Allow users to save different connection configurations
3. **Smart Retry**: Implement intelligent retry logic with backoff for enabled auto-connections
4. **Health Checks**: Add server health monitoring before attempting connections

## Files Modified

- `src/renderer/modules/MCPServerManager.js` - Main auto-connect logic changes
- `test/fix-validation-tests/test-mcp-auto-connect-disabled.html` - Comprehensive test suite

## Configuration Keys

- `mcpGlobalSettings.enableAutoConnect` - Global auto-connect control (default: false)
- `mcpServers.[serverId].autoConnect` - Individual server auto-connect (default: false)
- `mcpSettings.allowAutoActivation` - ChatManager auto-activation (existing, default: false)
- `mcpSettings.autoConnect` - ChatManager auto-connect (existing, default: false)

This fix ensures that MCP server connections are only established when explicitly requested by the user, eliminating unwanted connection attempts and providing a cleaner, more controlled user experience.
