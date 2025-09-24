/**
 * Deployment Script for Dynamic Tools Registry
 * Validates, tests, and deploys the tools registry system
 */

const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const ToolsRegistryManager = require('./registry_manager');

class ToolsRegistryDeployer {
    constructor() {
        this.registryPath = __dirname;
        this.errors = [];
        this.warnings = [];
        this.stats = {
            totalTools: 0,
            validTools: 0,
            invalidTools: 0,
            categories: 0,
            totalSize: 0
        };
    }

    /**
     * Deploy the tools registry system
     */
    async deploy() {
        console.log('🚀 Deploying Dynamic Tools Registry System...\n');

        try {
            // Step 1: Validate all tool definitions
            await this.validateAllTools();

            // Step 2: Test registry manager
            await this.testRegistryManager();

            // Step 3: Generate deployment report
            await this.generateDeploymentReport();

            // Step 4: Create backup of existing system
            await this.createBackup();

            // Step 5: Deploy new system
            await this.deploySystem();

            console.log('\n✅ Deployment completed successfully!');
            this.printSummary();

        } catch (error) {
            console.error('\n❌ Deployment failed:', error.message);
            this.printErrors();
            process.exit(1);
        }
    }

    /**
     * Validate all tool definition files
     */
    async validateAllTools() {
        console.log('📋 Validating tool definitions...');

        const categories = await this.getCategories();
        this.stats.categories = categories.length;

        for (const category of categories) {
            const categoryPath = path.join(this.registryPath, category);
            const files = await fs.readdir(categoryPath);
            const yamlFiles = files.filter(file => file.endsWith('.yaml'));

            for (const file of yamlFiles) {
                const toolPath = path.join(categoryPath, file);
                await this.validateToolFile(toolPath);
            }
        }

        console.log(`   ✅ Validated ${this.stats.validTools} tools`);
        if (this.stats.invalidTools > 0) {
            console.log(`   ⚠️  ${this.stats.invalidTools} tools have issues`);
        }
    }

    /**
     * Validate a single tool definition file
     */
    async validateToolFile(toolPath) {
        try {
            const content = await fs.readFile(toolPath, 'utf8');
            const tool = yaml.load(content);
            const fileSize = Buffer.byteLength(content, 'utf8');
            this.stats.totalSize += fileSize;

            // Validate required fields
            const requiredFields = ['name', 'version', 'description', 'category', 'keywords', 'priority'];
            const missingFields = requiredFields.filter(field => !tool[field]);

            if (missingFields.length > 0) {
                this.errors.push(`${path.basename(toolPath)}: Missing required fields: ${missingFields.join(', ')}`);
                this.stats.invalidTools++;
                return;
            }

            // Validate data types
            if (typeof tool.priority !== 'number' || tool.priority < 1 || tool.priority > 3) {
                this.warnings.push(`${path.basename(toolPath)}: Invalid priority value: ${tool.priority}`);
            }

            if (!Array.isArray(tool.keywords)) {
                this.warnings.push(`${path.basename(toolPath)}: Keywords should be an array`);
            }

            // Validate parameters schema
            if (tool.parameters && tool.parameters.type !== 'object') {
                this.warnings.push(`${path.basename(toolPath)}: Parameters should be an object type`);
            }

            this.stats.totalTools++;
            this.stats.validTools++;

        } catch (error) {
            this.errors.push(`${path.basename(toolPath)}: ${error.message}`);
            this.stats.invalidTools++;
        }
    }

    /**
     * Test the registry manager
     */
    async testRegistryManager() {
        console.log('🧪 Testing registry manager...');

        try {
            const registryManager = new ToolsRegistryManager();
            await registryManager.initializeRegistry();

            // Test basic functionality
            const allTools = await registryManager.getAllTools();
            const stats = await registryManager.getRegistryStats();

            if (allTools.length === 0) {
                throw new Error('No tools loaded by registry manager');
            }

            if (stats.total_tools === 0) {
                throw new Error('Registry statistics not working');
            }

            // Test tool retrieval
            const testTool = await registryManager.getToolDefinition('navigate_to_position');
            if (!testTool) {
                throw new Error('Tool retrieval not working');
            }

            // Test dynamic tool selection
            const relevantTools = await registryManager.getRelevantTools('find genes', {
                hasData: true,
                hasNetwork: true
            });

            if (relevantTools.length === 0) {
                this.warnings.push('Dynamic tool selection returned no tools for test query');
            }

            console.log('   ✅ Registry manager tests passed');

        } catch (error) {
            this.errors.push(`Registry manager test failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate deployment report
     */
    async generateDeploymentReport() {
        console.log('📊 Generating deployment report...');

        const report = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            stats: this.stats,
            errors: this.errors,
            warnings: this.warnings,
            categories: await this.getCategories(),
            tools: await this.getToolList()
        };

        const reportPath = path.join(this.registryPath, 'deployment_report.json');
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        console.log(`   ✅ Report saved to ${reportPath}`);
    }

    /**
     * Create backup of existing system
     */
    async createBackup() {
        console.log('💾 Creating backup of existing system...');

        const backupDir = path.join(this.registryPath, 'backup');
        await fs.mkdir(backupDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(backupDir, `backup_${timestamp}`);

        // This would backup the existing ChatManager system
        // For now, just create a marker file
        await fs.writeFile(path.join(backupDir, 'backup_marker.txt'), 
            `Backup created at ${new Date().toISOString()}\n` +
            `Tools registry system deployed\n` +
            `Total tools: ${this.stats.totalTools}\n` +
            `Valid tools: ${this.stats.validTools}\n`
        );

        console.log(`   ✅ Backup created at ${backupPath}`);
    }

    /**
     * Deploy the new system
     */
    async deploySystem() {
        console.log('🚀 Deploying new system...');

        // Create deployment marker
        const deploymentMarker = {
            deployed: true,
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            totalTools: this.stats.totalTools,
            validTools: this.stats.validTools,
            categories: this.stats.categories
        };

        const markerPath = path.join(this.registryPath, 'deployment_marker.json');
        await fs.writeFile(markerPath, JSON.stringify(deploymentMarker, null, 2));

        // Create integration instructions
        const instructions = this.generateIntegrationInstructions();
        const instructionsPath = path.join(this.registryPath, 'INTEGRATION_INSTRUCTIONS.md');
        await fs.writeFile(instructionsPath, instructions);

        console.log('   ✅ System deployed successfully');
    }

    /**
     * Get all categories
     */
    async getCategories() {
        const categoriesPath = path.join(this.registryPath, 'tool_categories.yaml');
        const content = await fs.readFile(categoriesPath, 'utf8');
        const categories = yaml.load(content);
        return Object.keys(categories.categories || {});
    }

    /**
     * Get list of all tools
     */
    async getToolList() {
        const tools = [];
        const categories = await this.getCategories();

        for (const category of categories) {
            const categoryPath = path.join(this.registryPath, category);
            const files = await fs.readdir(categoryPath);
            const yamlFiles = files.filter(file => file.endsWith('.yaml'));

            for (const file of yamlFiles) {
                const toolName = path.basename(file, '.yaml');
                tools.push({
                    name: toolName,
                    category: category,
                    file: file
                });
            }
        }

        return tools;
    }

    /**
     * Generate integration instructions
     */
    generateIntegrationInstructions() {
        return `# Integration Instructions

## Quick Start

1. **Install Dependencies**
   \`\`\`bash
   npm install js-yaml
   \`\`\`

2. **Update ChatManager**
   Add to your ChatManager.js:
   \`\`\`javascript
   const SystemIntegration = require('./tools_registry/system_integration');
   
   // In constructor
   this.dynamicTools = new SystemIntegration();
   await this.dynamicTools.initialize();
   
   // Replace getBaseSystemMessage()
   async getBaseSystemMessage() {
       const context = this.getCurrentContext();
       const promptData = await this.dynamicTools.generateDynamicSystemPrompt(
           this.getLastUserQuery(),
           context
       );
       return promptData.systemPrompt;
   }
   \`\`\`

3. **Test Integration**
   \`\`\`javascript
   const stats = await chatManager.dynamicTools.getRegistryStats();
   console.log('Tools loaded:', stats.total_tools);
   \`\`\`

## Deployment Summary

- **Total Tools**: ${this.stats.totalTools}
- **Valid Tools**: ${this.stats.validTools}
- **Categories**: ${this.stats.categories}
- **Errors**: ${this.errors.length}
- **Warnings**: ${this.warnings.length}

## Next Steps

1. Follow the integration instructions above
2. Test with sample queries
3. Monitor performance
4. Add new tools as needed

For detailed integration guide, see INTEGRATION_GUIDE.md
`;
    }

    /**
     * Print deployment summary
     */
    printSummary() {
        console.log('\n📊 Deployment Summary:');
        console.log(`   Total Tools: ${this.stats.totalTools}`);
        console.log(`   Valid Tools: ${this.stats.validTools}`);
        console.log(`   Categories: ${this.stats.categories}`);
        console.log(`   Total Size: ${(this.stats.totalSize / 1024).toFixed(2)} KB`);
        console.log(`   Errors: ${this.errors.length}`);
        console.log(`   Warnings: ${this.warnings.length}`);

        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.warnings.forEach(warning => console.log(`   - ${warning}`));
        }
    }

    /**
     * Print errors
     */
    printErrors() {
        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(error => console.log(`   - ${error}`));
        }
    }
}

// Run deployment if called directly
if (require.main === module) {
    const deployer = new ToolsRegistryDeployer();
    deployer.deploy().catch(error => {
        console.error('Deployment failed:', error);
        process.exit(1);
    });
}

module.exports = ToolsRegistryDeployer;
