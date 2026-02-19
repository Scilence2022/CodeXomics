#!/usr/bin/env node

/**
 * Fix Claude Desktop Configuration Issues
 * This script automatically fixes common Claude Desktop MCP configuration problems
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔧 Claude Desktop Configuration Fixer\n');

// Determine Claude Desktop config path based on OS
function getClaudeConfigPath() {
    const platform = os.platform();

    switch (platform) {
        case 'darwin': // macOS
            return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        case 'win32': // Windows
            return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
        case 'linux': // Linux
            return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
        default:
            throw new Error(`Unsupported platform: ${platform}`);
    }
}

// Create clean configuration
function createCleanConfig() {
    const currentDir = process.cwd();
    const serverPath = path.join(currentDir, 'start-mcp-server.js');

    return {
        mcpServers: {
            "codexomics": {
                command: "node",
                args: [serverPath],
                env: {}
            }
        }
    };
}

// Backup existing config
function backupConfig(configPath) {
    if (fs.existsSync(configPath)) {
        const backupPath = configPath + '.backup.' + Date.now();
        fs.copyFileSync(configPath, backupPath);
        console.log(`📋 Backed up existing config to: ${backupPath}`);
        return backupPath;
    }
    return null;
}

// Validate JSON
function validateJSON(content) {
    try {
        JSON.parse(content);
        return true;
    } catch (error) {
        console.log(`❌ JSON validation failed: ${error.message}`);
        return false;
    }
}

// Main fix function
function fixClaudeConfig() {
    try {
        const configPath = getClaudeConfigPath();
        console.log(`📍 Claude Desktop config path: ${configPath}`);

        // Ensure directory exists
        const configDir = path.dirname(configPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
            console.log(`📁 Created config directory: ${configDir}`);
        }

        // Backup existing config
        const backupPath = backupConfig(configPath);

        // Create clean configuration
        const cleanConfig = createCleanConfig();
        const cleanConfigJSON = JSON.stringify(cleanConfig, null, 2);

        // Validate the clean config
        if (!validateJSON(cleanConfigJSON)) {
            throw new Error('Generated configuration is invalid');
        }

        // Write clean config
        fs.writeFileSync(configPath, cleanConfigJSON, 'utf8');
        console.log('✅ Clean configuration written successfully');

        // Verify the written config
        const writtenContent = fs.readFileSync(configPath, 'utf8');
        if (validateJSON(writtenContent)) {
            console.log('✅ Configuration validation passed');
        } else {
            throw new Error('Written configuration is invalid');
        }

        // Display final configuration
        console.log('\n📋 Final Configuration:');
        console.log(cleanConfigJSON);

        console.log('\n💡 Next Steps:');
        console.log('1. Restart Claude Desktop completely');
        console.log('2. Start the MCP server: node start-mcp-server.js');
        console.log('3. Check Claude Desktop for the codexomics server');

        return true;

    } catch (error) {
        console.error(`❌ Error fixing configuration: ${error.message}`);
        return false;
    }
}

// Run the fix
if (fixClaudeConfig()) {
    console.log('\n🎉 Configuration fix completed successfully!');
} else {
    console.log('\n💥 Configuration fix failed!');
    process.exit(1);
} 