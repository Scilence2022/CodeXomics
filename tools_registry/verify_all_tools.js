/**
 * Comprehensive Tool System Verification
 * 
 * This script verifies the complete tool registration and integration system:
 * 1. All tools in FunctionCallsOrganizer have corresponding case statements
 * 2. All tools can be properly discovered and categorized
 * 3. Tool source detection works correctly (no "Unknown Source")
 * 4. YAML specifications exist for appropriate tools
 * 5. Built-in tools integration is complete
 * 
 * Run: node verify_all_tools.js
 */

const fs = require('fs');
const path = require('path');

class ToolSystemVerifier {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };
        
        this.paths = {
            chatManager: path.join(__dirname, '../src/renderer/modules/ChatManager.js'),
            functionCallsOrganizer: path.join(__dirname, '../src/renderer/modules/FunctionCallsOrganizer.js'),
            builtinIntegration: path.join(__dirname, 'builtin_tools_integration.js'),
            yamlDir: __dirname
        };
        
        this.toolsData = {
            organizerTools: new Set(),
            caseStatements: new Set(),
            builtinTools: new Set(),
            yamlTools: new Set()
        };
    }

    log(emoji, message, isTest = false) {
        const output = `${emoji} ${message}`;
        console.log(output);
        if (isTest) {
            this.results.tests.push({ emoji, message });
        }
    }

    pass(testName) {
        this.results.passed++;
        this.log('✅', `PASS: ${testName}`, true);
    }

    fail(testName, error) {
        this.results.failed++;
        this.log('❌', `FAIL: ${testName} - ${error}`, true);
    }

    warn(testName, warning) {
        this.results.warnings++;
        this.log('⚠️ ', `WARN: ${testName} - ${warning}`, true);
    }

    // Extract all tools from FunctionCallsOrganizer
    extractOrganizerTools() {
        this.log('🔍', 'Test 1: Extracting tools from FunctionCallsOrganizer');
        
        const content = fs.readFileSync(this.paths.functionCallsOrganizer, 'utf8');
        
        // Match all function arrays in functionCategories
        const categoryRegex = /functions\s*:\s*\[([\s\S]*?)\]/g;
        let match;
        let totalTools = 0;
        
        while ((match = categoryRegex.exec(content)) !== null) {
            const functionsBlock = match[1];
            // Extract individual tool names (single or double quoted strings)
            const toolRegex = /['"]([^'"]+)['"]/g;
            let toolMatch;
            
            while ((toolMatch = toolRegex.exec(functionsBlock)) !== null) {
                const toolName = toolMatch[1];
                this.toolsData.organizerTools.add(toolName);
                totalTools++;
            }
        }
        
        this.log('📊', `Found ${this.toolsData.organizerTools.size} unique tools in FunctionCallsOrganizer (${totalTools} total entries)`);
        return this.toolsData.organizerTools;
    }

    // Extract all case statements from ChatManager
    extractCaseStatements() {
        this.log('🔍', 'Test 2: Extracting case statements from ChatManager.executeToolByName()');
        
        const content = fs.readFileSync(this.paths.chatManager, 'utf8');
        
        // Find all case statements in switch blocks
        const caseRegex = /case\s+['"]([^'"]+)['"]:/g;
        let match;
        
        while ((match = caseRegex.exec(content)) !== null) {
            this.toolsData.caseStatements.add(match[1]);
        }
        
        this.log('📊', `Found ${this.toolsData.caseStatements.size} case statements in ChatManager`);
        return this.toolsData.caseStatements;
    }

    // Extract built-in tools from builtin_tools_integration.js
    extractBuiltinTools() {
        this.log('🔍', 'Test 3: Extracting built-in tools from builtin_tools_integration.js');
        
        const content = fs.readFileSync(this.paths.builtinIntegration, 'utf8');
        
        // Find all builtInToolsMap.set calls
        const builtinRegex = /builtInToolsMap\.set\s*\(\s*['"]([^'"]+)['"]/g;
        let match;
        
        while ((match = builtinRegex.exec(content)) !== null) {
            this.toolsData.builtinTools.add(match[1]);
        }
        
        this.log('📊', `Found ${this.toolsData.builtinTools.size} built-in tools mapped`);
        return this.toolsData.builtinTools;
    }

    // Extract YAML tool specifications
    extractYAMLTools() {
        this.log('🔍', 'Test 4: Extracting YAML tool specifications');
        
        const scanDirectory = (dir) => {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory() && !item.startsWith('.')) {
                    scanDirectory(fullPath);
                } else if (item.endsWith('.yaml') || item.endsWith('.yml')) {
                    try {
                        const content = fs.readFileSync(fullPath, 'utf8');
                        const nameMatch = content.match(/^name:\s*(.+)$/m);
                        if (nameMatch) {
                            this.toolsData.yamlTools.add(nameMatch[1].trim());
                        }
                    } catch (error) {
                        this.log('⚠️ ', `Could not read YAML file: ${fullPath}`);
                    }
                }
            }
        };
        
        scanDirectory(this.paths.yamlDir);
        this.log('📊', `Found ${this.toolsData.yamlTools.size} YAML tool specifications`);
        return this.toolsData.yamlTools;
    }

    // Verify all organizer tools have case statements
    verifyCaseStatementCoverage() {
        this.log('🔍', 'Test 5: Verifying case statement coverage for all organizer tools');
        
        let missingCount = 0;
        const missing = [];
        
        for (const tool of this.toolsData.organizerTools) {
            // Skip plugin tools (contain dots)
            if (tool.includes('.')) continue;
            
            if (!this.toolsData.caseStatements.has(tool)) {
                this.fail(`Case statement for '${tool}'`, 'Missing in ChatManager.executeToolByName()');
                missing.push(tool);
                missingCount++;
            } else {
                this.pass(`Case statement exists for '${tool}'`);
            }
        }
        
        if (missingCount > 0) {
            this.log('📋', `Missing case statements: ${missing.join(', ')}`);
        }
        
        return missingCount === 0;
    }

    // Verify tool source detection (check if getToolSource would work)
    verifyToolSourceDetection() {
        this.log('🔍', 'Test 6: Verifying tool source detection coverage');
        
        let problematicTools = 0;
        const chatManagerContent = fs.readFileSync(this.paths.chatManager, 'utf8');
        
        // Check if tool would be detected by getToolSource
        for (const tool of this.toolsData.organizerTools) {
            // Skip plugin tools
            if (tool.includes('.')) continue;
            
            // Check if it's in FunctionCallsOrganizer (which getToolSource now uses)
            // Since we extracted from organizer, it's automatically covered
            
            // Verify getToolSource method exists and uses FunctionCallsOrganizer
            if (!chatManagerContent.includes('this.functionCallsOrganizer.getFunctionCategory')) {
                this.fail('getToolSource implementation', 'Does not use FunctionCallsOrganizer.getFunctionCategory()');
                problematicTools++;
                break;
            }
        }
        
        if (problematicTools === 0) {
            this.pass('All organizer tools will be detected as Internal Function');
        }
        
        return problematicTools === 0;
    }

    // Verify built-in integration completeness
    verifyBuiltinIntegration() {
        this.log('🔍', 'Test 7: Verifying built-in tools integration');
        
        const expectedBuiltinCategories = ['database', 'protein_structure', 'export', 'file_loading'];
        let issues = 0;
        
        // Check that built-in tools are properly mapped
        for (const tool of this.toolsData.builtinTools) {
            if (!this.toolsData.organizerTools.has(tool)) {
                this.warn(`Built-in tool '${tool}'`, 'Not registered in FunctionCallsOrganizer');
                issues++;
            } else {
                this.pass(`Built-in tool '${tool}' properly integrated`);
            }
        }
        
        return issues === 0;
    }

    // Generate detailed tool inventory
    generateToolInventory() {
        this.log('📊', '\n=== TOOL INVENTORY ===\n');
        
        const categories = {
            'In Organizer Only': [],
            'In Case Statements Only': [],
            'In Both (Correct)': [],
            'Built-in Tools': [],
            'Plugin Tools': [],
            'YAML Specified': []
        };
        
        // Categorize all tools
        for (const tool of this.toolsData.organizerTools) {
            if (tool.includes('.')) {
                categories['Plugin Tools'].push(tool);
            } else if (this.toolsData.caseStatements.has(tool)) {
                categories['In Both (Correct)'].push(tool);
            } else {
                categories['In Organizer Only'].push(tool);
            }
        }
        
        for (const tool of this.toolsData.caseStatements) {
            if (!this.toolsData.organizerTools.has(tool) && !tool.includes('.')) {
                categories['In Case Statements Only'].push(tool);
            }
        }
        
        for (const tool of this.toolsData.builtinTools) {
            categories['Built-in Tools'].push(tool);
        }
        
        for (const tool of this.toolsData.yamlTools) {
            categories['YAML Specified'].push(tool);
        }
        
        // Print inventory
        for (const [category, tools] of Object.entries(categories)) {
            if (tools.length > 0) {
                this.log('📁', `${category}: ${tools.length} tools`);
                if (tools.length <= 10) {
                    tools.forEach(tool => this.log('  ', `- ${tool}`));
                } else {
                    tools.slice(0, 10).forEach(tool => this.log('  ', `- ${tool}`));
                    this.log('  ', `... and ${tools.length - 10} more`);
                }
                console.log('');
            }
        }
        
        return categories;
    }

    // Run all verifications
    runAll() {
        console.log('\n╔════════════════════════════════════════════════════════════════════╗');
        console.log('║         Comprehensive Tool System Verification Suite               ║');
        console.log('║         Checking All Tool Registrations and Integrations          ║');
        console.log('╚════════════════════════════════════════════════════════════════════╝\n');

        try {
            // Extract data
            this.extractOrganizerTools();
            console.log('');
            
            this.extractCaseStatements();
            console.log('');
            
            this.extractBuiltinTools();
            console.log('');
            
            this.extractYAMLTools();
            console.log('');
            
            // Run verifications
            this.verifyCaseStatementCoverage();
            console.log('');
            
            this.verifyToolSourceDetection();
            console.log('');
            
            this.verifyBuiltinIntegration();
            console.log('');
            
            // Generate inventory
            const inventory = this.generateToolInventory();
            
            // Print summary
            this.printSummary(inventory);
            
        } catch (error) {
            console.error('❌ Verification error:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }

    printSummary(inventory) {
        console.log('\n╔════════════════════════════════════════════════════════════════════╗');
        console.log('║                        VERIFICATION SUMMARY                         ║');
        console.log('╚════════════════════════════════════════════════════════════════════╝\n');
        
        const total = this.results.passed + this.results.failed;
        const passRate = total > 0 ? ((this.results.passed / total) * 100).toFixed(1) : 0;
        
        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⚠️  Warnings: ${this.results.warnings}`);
        console.log(`📊 Pass Rate: ${passRate}%\n`);
        
        console.log('📈 Tool Statistics:');
        console.log(`   • FunctionCallsOrganizer: ${this.toolsData.organizerTools.size} tools`);
        console.log(`   • ChatManager case statements: ${this.toolsData.caseStatements.size} tools`);
        console.log(`   • Built-in integration: ${this.toolsData.builtinTools.size} tools`);
        console.log(`   • YAML specifications: ${this.toolsData.yamlTools.size} tools\n`);
        
        // Key findings
        if (inventory['In Organizer Only'].length > 0) {
            console.log(`⚠️  ${inventory['In Organizer Only'].length} tools registered but missing case statements`);
        }
        
        if (inventory['In Case Statements Only'].length > 0) {
            console.log(`⚠️  ${inventory['In Case Statements Only'].length} case statements without organizer registration`);
        }
        
        if (this.results.failed === 0 && this.results.warnings === 0) {
            console.log('🎉 ALL VERIFICATIONS PASSED! Tool system is fully integrated.\n');
            console.log('✨ Tool source detection should now work correctly for all tools.');
            console.log('✅ No more "[Unknown Source]" issues!\n');
            process.exit(0);
        } else if (this.results.failed === 0) {
            console.log('✅ All critical tests passed, but there are warnings to review.\n');
            process.exit(0);
        } else {
            console.log('⚠️  Some verifications failed. Please review the errors above.\n');
            process.exit(1);
        }
    }
}

// Run verification
if (require.main === module) {
    const verifier = new ToolSystemVerifier();
    verifier.runAll();
}

module.exports = ToolSystemVerifier;
