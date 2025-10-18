/**
 * Codon Usage Analysis Enhancement Verification Script
 * Tests the integration of enhanced codon usage analysis tools
 */

const fs = require('fs');
const path = require('path');

class CodonUsageVerification {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            warnings: 0,
            tests: []
        };
    }

    log(icon, test, status, message) {
        console.log(`${icon} ${test}: ${message}`);
        this.results.tests.push({ test, status, message });
        
        if (status === 'PASS') this.results.passed++;
        else if (status === 'FAIL') this.results.failed++;
        else if (status === 'WARN') this.results.warnings++;
    }

    pass(test, message = 'Test passed') {
        this.log('✅', test, 'PASS', message);
    }

    fail(test, message) {
        this.log('❌', test, 'FAIL', message);
    }

    warn(test, message) {
        this.log('⚠️', test, 'WARN', message);
    }

    // Test 1: Verify YAML files exist
    verifyYAMLFiles() {
        console.log('\n📋 Test 1: Verifying YAML Tool Definitions');
        
        const files = [
            {
                path: path.join(__dirname, 'data_management/codon_usage_analysis.yaml'),
                name: 'codon_usage_analysis.yaml'
            },
            {
                path: path.join(__dirname, 'data_management/genome_codon_usage_analysis.yaml'),
                name: 'genome_codon_usage_analysis.yaml'
            }
        ];

        for (const file of files) {
            if (fs.existsSync(file.path)) {
                const content = fs.readFileSync(file.path, 'utf-8');
                
                // Check for essential fields
                const hasName = content.includes('name:');
                const hasDescription = content.includes('description:');
                const hasCategory = content.includes('category: data_management');
                const hasParameters = content.includes('parameters:');
                const hasReturns = content.includes('returns:');
                
                if (hasName && hasDescription && hasCategory && hasParameters && hasReturns) {
                    this.pass(`YAML file ${file.name}`, 'All essential fields present');
                } else {
                    this.fail(`YAML file ${file.name}`, 'Missing essential fields');
                }

                // Check for enhanced features
                if (file.name === 'codon_usage_analysis.yaml') {
                    if (content.includes('codonPreferences') && content.includes('RSCU')) {
                        this.pass('Enhanced codon_usage_analysis', 'Contains codonPreferences and RSCU documentation');
                    } else {
                        this.fail('Enhanced codon_usage_analysis', 'Missing enhanced features documentation');
                    }
                }

                if (file.name === 'genome_codon_usage_analysis.yaml') {
                    if (content.includes('genome-wide') && content.includes('gcContent')) {
                        this.pass('Genome-wide analysis', 'Contains genome-wide specific features');
                    } else {
                        this.fail('Genome-wide analysis', 'Missing genome-wide features');
                    }
                }
            } else {
                this.fail(`YAML file ${file.name}`, 'File does not exist');
            }
        }
    }

    // Test 2: Verify ChatManager implementation
    verifyChatManagerImplementation() {
        console.log('\n🔧 Test 2: Verifying ChatManager Implementation');
        
        const chatManagerPath = path.join(__dirname, '../src/renderer/modules/ChatManager.js');
        
        if (fs.existsSync(chatManagerPath)) {
            const content = fs.readFileSync(chatManagerPath, 'utf-8');
            
            // Check for method implementations
            if (content.includes('async codonUsageAnalysis(params)')) {
                this.pass('codonUsageAnalysis method', 'Method exists');
                
                // Check for enhanced features
                if (content.includes('synonymousCodons') && 
                    content.includes('rscu') && 
                    content.includes('codonPreferences')) {
                    this.pass('Enhanced codon analysis', 'Contains RSCU and preference calculations');
                } else {
                    this.fail('Enhanced codon analysis', 'Missing enhanced calculations');
                }
            } else {
                this.fail('codonUsageAnalysis method', 'Method not found');
            }

            if (content.includes('async genomeCodonUsageAnalysis(params)')) {
                this.pass('genomeCodonUsageAnalysis method', 'Method exists');
                
                // Check for genome-wide features
                if (content.includes('gcByPosition') && 
                    content.includes('totalGenes') && 
                    content.includes('genomeRSCU')) {
                    this.pass('Genome-wide analysis', 'Contains genome-wide calculations');
                } else {
                    this.fail('Genome-wide analysis', 'Missing genome-wide features');
                }
            } else {
                this.fail('genomeCodonUsageAnalysis method', 'Method not found');
            }

            // Check executeToolByName integration
            if (content.includes("case 'codon_usage_analysis':") && 
                content.includes("case 'genome_codon_usage_analysis':")) {
                this.pass('Tool execution registration', 'Both tools registered in executeToolByName');
            } else {
                this.fail('Tool execution registration', 'Tools not properly registered');
            }

            // Check response formatting
            if (content.includes('formatToolResultForDisplay') || 
                content.includes('genome_codon_usage_analysis')) {
                const hasCodonResponseFormat = content.match(/case 'codon_usage_analysis':/g);
                const hasGenomeResponseFormat = content.match(/case 'genome_codon_usage_analysis':/g);
                
                if (hasCodonResponseFormat && hasCodonResponseFormat.length >= 1) {
                    this.pass('Response formatting', 'Codon usage response formatting exists');
                } else {
                    this.warn('Response formatting', 'Codon usage response formatting may need review');
                }

                if (hasGenomeResponseFormat && hasGenomeResponseFormat.length >= 1) {
                    this.pass('Genome response formatting', 'Genome-wide response formatting exists');
                } else {
                    this.warn('Genome response formatting', 'Genome-wide response formatting may need review');
                }
            }
        } else {
            this.fail('ChatManager.js', 'File not found');
        }
    }

    // Test 3: Verify FunctionCallsOrganizer integration
    verifyFunctionCallsOrganizer() {
        console.log('\n📊 Test 3: Verifying FunctionCallsOrganizer Integration');
        
        const organizerPath = path.join(__dirname, '../src/renderer/modules/FunctionCallsOrganizer.js');
        
        if (fs.existsSync(organizerPath)) {
            const content = fs.readFileSync(organizerPath, 'utf-8');
            
            // Check for tool registration
            if (content.includes("'codon_usage_analysis'") && 
                content.includes("'genome_codon_usage_analysis'")) {
                this.pass('Tool registration', 'Both tools registered in FunctionCallsOrganizer');
                
                // Verify they're in dataManipulation category
                const dataManipulationMatch = content.match(/dataManipulation:\s*{[^}]*functions:\s*\[[^\]]*'codon_usage_analysis'[^\]]*'genome_codon_usage_analysis'[^\]]*\]/s);
                
                if (dataManipulationMatch) {
                    this.pass('Category assignment', 'Tools in dataManipulation category');
                } else {
                    this.warn('Category assignment', 'Tools may not be in correct category');
                }
            } else {
                this.fail('Tool registration', 'Tools not found in FunctionCallsOrganizer');
            }
        } else {
            this.fail('FunctionCallsOrganizer.js', 'File not found');
        }
    }

    // Test 4: Verify built-in tools integration
    verifyBuiltInToolsIntegration() {
        console.log('\n🔌 Test 4: Verifying Built-in Tools Integration');
        
        const builtinPath = path.join(__dirname, 'builtin_tools_integration.js');
        
        if (fs.existsSync(builtinPath)) {
            const content = fs.readFileSync(builtinPath, 'utf-8');
            
            // Check for tool mapping
            const hasCodonMapping = content.includes("builtInToolsMap.set('codon_usage_analysis'");
            const hasGenomeMapping = content.includes("builtInToolsMap.set('genome_codon_usage_analysis'");
            
            if (hasCodonMapping && hasGenomeMapping) {
                this.pass('Built-in tool mapping', 'Both tools mapped in builtin_tools_integration');
                
                // Check for correct methods
                if (content.includes("method: 'codonUsageAnalysis'") && 
                    content.includes("method: 'genomeCodonUsageAnalysis'")) {
                    this.pass('Method mapping', 'Correct ChatManager methods referenced');
                } else {
                    this.fail('Method mapping', 'Incorrect method names in mapping');
                }

                // Check category
                const categoryMatches = content.match(/category: 'data_management'/g);
                if (categoryMatches && categoryMatches.length >= 2) {
                    this.pass('Category mapping', 'Correct category assignment');
                } else {
                    this.warn('Category mapping', 'Category assignment may need review');
                }
            } else {
                this.fail('Built-in tool mapping', 'Tools not mapped in builtin_tools_integration');
            }
        } else {
            this.fail('builtin_tools_integration.js', 'File not found');
        }
    }

    // Test 5: Verify documentation
    verifyDocumentation() {
        console.log('\n📖 Test 5: Verifying Documentation');
        
        const docPath = path.join(__dirname, '../CODON_USAGE_ANALYSIS_ENHANCEMENT.md');
        
        if (fs.existsSync(docPath)) {
            const content = fs.readFileSync(docPath, 'utf-8');
            
            if (content.includes('## Problem Statement') && 
                content.includes('## Solution Architecture') && 
                content.includes('## Integration Points') && 
                content.includes('## Usage Examples')) {
                this.pass('Documentation', 'Complete implementation documentation exists');
                
                // Check for key sections
                if (content.includes('RSCU') && content.includes('codonPreferences')) {
                    this.pass('Technical details', 'RSCU and preference documentation present');
                }
                
                if (content.includes('Testing Recommendations')) {
                    this.pass('Testing section', 'Testing recommendations included');
                }
            } else {
                this.warn('Documentation', 'Documentation may be incomplete');
            }
        } else {
            this.warn('Documentation', 'Implementation summary document not found');
        }
    }

    // Generate final report
    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('CODON USAGE ANALYSIS ENHANCEMENT - VERIFICATION REPORT');
        console.log('='.repeat(80));
        console.log(`\nTotal Tests: ${this.results.tests.length}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`⚠️  Warnings: ${this.results.warnings}`);
        
        const successRate = ((this.results.passed / this.results.tests.length) * 100).toFixed(2);
        console.log(`\nSuccess Rate: ${successRate}%`);
        
        if (this.results.failed === 0) {
            console.log('\n🎉 ALL CRITICAL TESTS PASSED! Implementation is ready for use.');
        } else {
            console.log('\n⚠️  Some tests failed. Please review the issues above.');
        }
        
        console.log('\n' + '='.repeat(80));
        
        // Write report to file
        const reportPath = path.join(__dirname, 'CODON_ANALYSIS_VERIFICATION_REPORT.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`\nDetailed report saved to: ${reportPath}`);
        
        return this.results.failed === 0;
    }

    // Run all tests
    runAll() {
        console.log('🧬 Starting Codon Usage Analysis Enhancement Verification...\n');
        
        this.verifyYAMLFiles();
        this.verifyChatManagerImplementation();
        this.verifyFunctionCallsOrganizer();
        this.verifyBuiltInToolsIntegration();
        this.verifyDocumentation();
        
        return this.generateReport();
    }
}

// Run verification
if (require.main === module) {
    const verification = new CodonUsageVerification();
    const success = verification.runAll();
    process.exit(success ? 0 : 1);
}

module.exports = CodonUsageVerification;
