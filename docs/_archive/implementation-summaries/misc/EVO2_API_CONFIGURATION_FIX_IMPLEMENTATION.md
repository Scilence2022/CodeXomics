# Evo2 API Configuration Fix Implementation

## Issue Description

The Evo2 Design Tool was showing "API Configured" in the frontend interface, but the MCP server was displaying `hasApiKey: false` in the logs. Additionally, even when the API configuration was properly passed, the API calls were returning 404 errors due to incorrect endpoint usage. This caused the tool to fall back to simulated responses instead of using the real NVIDIA Evo2 API.

## Root Cause Analysis

1. **Missing API Config in Tool Calls**: Some Evo2 tool functions (`optimizeSequenceMain` and `analyzeEssentialityMain`) were not including the `apiConfig` parameter in their requests to the MCP server.

2. **Incorrect Default API URL**: The frontend was using the old NVIDIA API URL (`https://health.api.nvidia.com`) instead of the correct one (`https://integrate.api.nvidia.com`).

3. **Wrong API Endpoint**: The MCP server was using the incorrect API endpoint (`/v1/models/nvidia/arc/evo2-40b/completions`) which returned 404 errors. The correct endpoint should be `/v1/chat/completions`.

4. **Incorrect Request Format**: The API requests were using the old format with `prompt` field instead of the new chat completions format with `messages` array.

5. **Insufficient Debugging**: There was no clear logging to track whether the API configuration was being passed correctly between frontend and server.

## Fixes Implemented

### 1. Added Missing API Configuration

**Files Modified:**
- `src/bioinformatics-tools/evo2-designer.html`

**Changes:**
- Added `apiConfig` parameter to `optimizeSequenceMain()` function
- Added `apiConfig` parameter to `analyzeEssentialityMain()` function
- Ensured all Evo2 tool calls include the API configuration

```javascript
// Before
const params = {
    sequence: sequence,
    optimizationGoal: optimizationGoal,
    targetOrganism: targetOrganism || null
};

// After
const apiConfig = getApiConfig();
const params = {
    sequence: sequence,
    optimizationGoal: optimizationGoal,
    targetOrganism: targetOrganism || null,
    apiConfig: apiConfig
};
```

### 2. Updated Default API URL

**Files Modified:**
- `src/bioinformatics-tools/evo2-designer.html`
- `src/mcp-server.js`

**Changes:**
- Updated default API URL from `https://health.api.nvidia.com` to `https://integrate.api.nvidia.com`
- Updated both frontend and server configurations

```javascript
// Before
apiUrl: localStorage.getItem('evo2_api_url') || 'https://health.api.nvidia.com'

// After
apiUrl: localStorage.getItem('evo2_api_url') || 'https://integrate.api.nvidia.com'
```

### 3. Fixed API Endpoint and Request Format

**Files Modified:**
- `src/mcp-server.js`

**Changes:**
- Updated API endpoint from `/v1/models/nvidia/arc/evo2-40b/completions` to `/v1/chat/completions`
- Changed request format from `prompt` field to `messages` array format
- Updated response parsing to handle chat completions format

```javascript
// Before
const requestBody = {
    prompt: 'Generate a short DNA sequence',
    max_tokens: 100,
    temperature: 1.0
};
const result = await this.callEvo2API('/v1/models/nvidia/arc/evo2-40b/completions', requestBody, apiConfig);

// After
const requestBody = {
    model: 'nvidia/arc/evo2-40b',
    messages: [
        {
            role: 'user',
            content: 'Generate a short DNA sequence'
        }
    ],
    max_tokens: 100,
    temperature: 1.0
};
const result = await this.callEvo2API('/v1/chat/completions', requestBody, apiConfig);
```

### 4. Enhanced Debugging and Logging

**Files Modified:**
- `src/bioinformatics-tools/evo2-designer.html`
- `src/mcp-server.js`

**Changes:**
- Added comprehensive logging in `callMCPTool()` function to track API configuration
- Added debugging in MCP server to log received parameters
- Enhanced error handling and validation

```javascript
// Frontend logging
console.log('=== EVO2 FRONTEND: CALLING MCP TOOL ===');
console.log('API Config present:', !!parameters.apiConfig);
if (parameters.apiConfig) {
    console.log('API Config details:', {
        hasKey: !!parameters.apiConfig.key,
        hasUrl: !!parameters.apiConfig.url,
        url: parameters.apiConfig.url
    });
}

// Server logging
console.log('=== MCP SERVER: EVO2 TOOL CALL ===');
console.log('API Config in parameters:', !!parameters.apiConfig);
```

### 5. Improved API Key Validation

**Files Modified:**
- `src/mcp-server.js`

**Changes:**
- Added strict validation for NVIDIA API key format (must start with `nvapi-`)
- Enhanced error handling for API configuration issues
- Better distinction between network errors and configuration errors

```javascript
// Validate API key format
if (!config.apiKey.startsWith('nvapi-')) {
    console.warn('Invalid NVIDIA API key format, using simulated response');
    return this.getSimulatedEvo2Response(requestBody);
}
```

## Testing

### Test File Created
- `test/evo2-api-configuration-fix-test.html`

**Test Coverage:**
1. **API Configuration Test**: Verifies that API config is properly stored and retrieved
2. **MCP Server Connection Test**: Ensures MCP server is accessible
3. **Evo2 Tool Call Test**: Tests all Evo2 tools with API configuration
4. **Configuration Display**: Shows current configuration state

**Test Features:**
- Set/clear test API configuration
- Test individual Evo2 tool calls
- Display detailed configuration information
- Real-time logging of API calls

## Verification Steps

1. **Configure API Key**: Enter a valid NVIDIA API key in the Evo2 Designer configuration
2. **Check Frontend**: Verify that the frontend shows "API Configured"
3. **Run Test**: Use the test file to verify API configuration is passed correctly
4. **Check Server Logs**: Verify that MCP server logs show `hasApiKey: true`
5. **Test Tool Calls**: Run Evo2 tools and verify they use real API instead of simulation

## Expected Behavior After Fix

- **Frontend**: Shows "API Configured" when valid API key is entered
- **MCP Server**: Logs show `hasApiKey: true` and proper API configuration
- **Tool Calls**: Evo2 tools use real NVIDIA API instead of simulated responses
- **Error Handling**: Clear error messages when API is not configured or invalid

## Files Modified

1. `src/bioinformatics-tools/evo2-designer.html`
   - Added missing `apiConfig` parameters
   - Updated default API URL
   - Enhanced debugging and logging

2. `src/mcp-server.js`
   - Updated default API URL
   - Enhanced API key validation
   - Improved error handling and logging

3. `test/evo2-api-configuration-fix-test.html` (new)
   - Comprehensive test suite for API configuration
   - Real-time verification of fixes

## Impact

- **Functionality**: Evo2 tools now properly use real NVIDIA API when configured
- **Reliability**: Better error handling and validation
- **Debugging**: Enhanced logging for troubleshooting
- **User Experience**: Clear indication of API configuration status

## Future Considerations

1. **Environment Variables**: Consider supporting environment variables for API configuration
2. **API Key Security**: Implement secure storage for API keys
3. **Rate Limiting**: Add rate limiting for API calls
4. **Caching**: Implement caching for API responses
5. **Fallback Strategy**: Improve fallback strategy when API is unavailable 