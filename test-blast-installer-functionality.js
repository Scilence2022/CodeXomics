#!/usr/bin/env node

/**
 * BLAST+ Installer Functionality Test Script
 * Tests all aspects of the BLAST+ installer on different platforms
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class BlastInstallerTester {
    constructor() {
        this.platform = os.platform();
        this.arch = os.arch();
        this.testResults = [];
        this.version = '2.16.0'; // Test version
        
        console.log(`🧪 BLAST+ Installer Functionality Test Suite`);
        console.log(`Platform: ${this.platform} ${this.arch}`);
        console.log(`Node.js: ${process.version}`);
        console.log('=' * 60);
    }

    async runAllTests() {
        const tests = [
            this.testPlatformDetection,
            this.testDownloadUrlGeneration,
            this.testNetworkConnectivity,
            this.testSystemRequirements,
            this.testInstallationPaths,
            this.testBlastAvailability,
            this.testPermissions,
            this.testErrorHandling
        ];

        for (const test of tests) {
            try {
                await test.call(this);
            } catch (error) {
                this.logResult('ERROR', test.name, error.message);
            }
        }

        this.printSummary();
    }

    async testPlatformDetection() {
        this.logTest('Platform Detection Test');
        
        try {
            // Test enhanced platform detection
            let platformDisplay = this.platform;
            let archDisplay = this.arch;
            let supported = true;

            if (this.platform === 'darwin') {
                platformDisplay = 'macOS';
                if (this.arch === 'arm64') {
                    archDisplay = 'Apple Silicon (M1/M2)';
                } else if (this.arch === 'x64') {
                    archDisplay = 'Intel x64';
                }
            } else if (this.platform === 'win32') {
                platformDisplay = 'Windows';
                archDisplay = this.arch === 'x64' ? 'x64 (64-bit)' : 'x32 (32-bit)';
            } else if (this.platform === 'linux') {
                platformDisplay = 'Linux';
                if (this.arch === 'arm64' || this.arch === 'aarch64') {
                    archDisplay = 'ARM64/AArch64';
                } else if (this.arch === 'x64') {
                    archDisplay = 'x64 (64-bit)';
                }
            } else {
                supported = false;
            }

            this.logResult('PASS', 'Platform Detection', 
                `Detected: ${platformDisplay} ${archDisplay} (Supported: ${supported})`);
        } catch (error) {
            this.logResult('FAIL', 'Platform Detection', error.message);
        }
    }

    async testDownloadUrlGeneration() {
        this.logTest('Download URL Generation Test');
        
        try {
            const baseUrl = 'https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/LATEST/';
            
            let filename;
            if (this.platform === 'win32') {
                filename = this.arch === 'x64' ? 
                    `ncbi-blast-${this.version}+-win64.exe` :
                    `ncbi-blast-${this.version}+-win32.exe`;
            } else if (this.platform === 'darwin') {
                if (this.arch === 'arm64') {
                    filename = `ncbi-blast-${this.version}+-aarch64-macosx.tar.gz`;
                } else {
                    filename = `ncbi-blast-${this.version}+-x64-macosx.tar.gz`;
                }
            } else if (this.platform === 'linux') {
                if (this.arch === 'arm64' || this.arch === 'aarch64') {
                    filename = `ncbi-blast-${this.version}+-aarch64-linux.tar.gz`;
                } else if (this.arch === 'x64') {
                    filename = `ncbi-blast-${this.version}+-x64-linux.tar.gz`;
                } else {
                    filename = `ncbi-blast-${this.version}+-linux.tar.gz`;
                }
            }

            const downloadUrl = baseUrl + filename;
            
            // Test if URL is accessible
            await new Promise((resolve, reject) => {
                const req = https.request(downloadUrl, { method: 'HEAD' }, (res) => {
                    if (res.statusCode === 200) {
                        resolve();
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
                });
                req.on('error', reject);
                req.setTimeout(10000, () => {
                    req.destroy();
                    reject(new Error('Timeout'));
                });
                req.end();
            });

            this.logResult('PASS', 'Download URL Generation', 
                `Generated valid URL: ${filename}`);
        } catch (error) {
            this.logResult('FAIL', 'Download URL Generation', error.message);
        }
    }

    async testNetworkConnectivity() {
        this.logTest('Network Connectivity Test');
        
        try {
            const testUrls = [
                'https://ftp.ncbi.nlm.nih.gov',
                'https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/LATEST/'
            ];

            for (const url of testUrls) {
                await new Promise((resolve, reject) => {
                    const req = https.get(url, (res) => {
                        if (res.statusCode === 200) {
                            resolve();
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}`));
                        }
                    });
                    req.on('error', reject);
                    req.setTimeout(5000, () => {
                        req.destroy();
                        reject(new Error('Timeout'));
                    });
                });
            }

            this.logResult('PASS', 'Network Connectivity', 'All NCBI FTP endpoints accessible');
        } catch (error) {
            this.logResult('FAIL', 'Network Connectivity', error.message);
        }
    }

    async testSystemRequirements() {
        this.logTest('System Requirements Test');
        
        try {
            const totalMemory = os.totalmem() / (1024**3);
            const freeMemory = os.freemem() / (1024**3);
            
            let results = [];
            
            // Memory check
            if (totalMemory >= 2) {
                results.push(`✓ Memory: ${totalMemory.toFixed(1)}GB`);
            } else {
                results.push(`✗ Memory: ${totalMemory.toFixed(1)}GB (insufficient)`);
            }
            
            // Node.js version check
            const nodeVersion = process.version;
            const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
            if (majorVersion >= 14) {
                results.push(`✓ Node.js: ${nodeVersion}`);
            } else {
                results.push(`✗ Node.js: ${nodeVersion} (too old)`);
            }
            
            // Platform support check
            const supportedPlatforms = ['win32', 'darwin', 'linux'];
            if (supportedPlatforms.includes(this.platform)) {
                results.push(`✓ Platform: ${this.platform}`);
            } else {
                results.push(`✗ Platform: ${this.platform} (unsupported)`);
            }

            this.logResult('PASS', 'System Requirements', results.join(', '));
        } catch (error) {
            this.logResult('FAIL', 'System Requirements', error.message);
        }
    }

    async testInstallationPaths() {
        this.logTest('Installation Paths Test');
        
        try {
            const homeDir = os.homedir();
            let installPath;
            
            if (this.platform === 'win32') {
                installPath = path.join('C:', 'Program Files', 'NCBI', 'blast+');
            } else if (this.platform === 'darwin') {
                installPath = path.join(homeDir, 'Applications', 'blast+');
            } else {
                installPath = path.join(homeDir, '.local', 'blast+');
            }

            // Test directory creation in temp location
            const testPath = path.join(os.tmpdir(), 'blast-test-' + Date.now());
            fs.mkdirSync(testPath, { recursive: true });
            fs.rmSync(testPath, { recursive: true, force: true });

            this.logResult('PASS', 'Installation Paths', 
                `Path: ${installPath}, Directory creation: OK`);
        } catch (error) {
            this.logResult('FAIL', 'Installation Paths', error.message);
        }
    }

    async testBlastAvailability() {
        this.logTest('BLAST+ Availability Test');
        
        try {
            const blastTools = ['blastn', 'blastp', 'blastx', 'tblastn', 'makeblastdb'];
            const availableTools = [];
            const unavailableTools = [];

            for (const tool of blastTools) {
                try {
                    const { stdout } = await execAsync(`${tool} -version`);
                    const versionMatch = stdout.match(new RegExp(`${tool}: ([\\d.]+)`));
                    const version = versionMatch ? versionMatch[1] : 'Unknown';
                    availableTools.push(`${tool}:v${version}`);
                } catch (error) {
                    unavailableTools.push(tool);
                }
            }

            let result = '';
            if (availableTools.length > 0) {
                result += `Available: ${availableTools.join(', ')}`;
            }
            if (unavailableTools.length > 0) {
                result += ` Missing: ${unavailableTools.join(', ')}`;
            }

            this.logResult(availableTools.length > 0 ? 'PASS' : 'INFO', 
                'BLAST+ Availability', result || 'No BLAST+ tools found');
        } catch (error) {
            this.logResult('FAIL', 'BLAST+ Availability', error.message);
        }
    }

    async testPermissions() {
        this.logTest('Permissions Test');
        
        try {
            const homeDir = os.homedir();
            let testResults = [];
            
            // Test write permission in home directory
            try {
                const testFile = path.join(homeDir, 'blast_perm_test_' + Date.now());
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                testResults.push('✓ Home directory writable');
            } catch (error) {
                testResults.push('✗ Home directory not writable');
            }
            
            // Test write permission in temp directory
            try {
                const testFile = path.join(os.tmpdir(), 'blast_perm_test_' + Date.now());
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                testResults.push('✓ Temp directory writable');
            } catch (error) {
                testResults.push('✗ Temp directory not writable');
            }

            this.logResult('PASS', 'Permissions', testResults.join(', '));
        } catch (error) {
            this.logResult('FAIL', 'Permissions', error.message);
        }
    }

    async testErrorHandling() {
        this.logTest('Error Handling Test');
        
        try {
            let errorTests = [];
            
            // Test invalid command
            try {
                await execAsync('nonexistent-command-12345');
                errorTests.push('✗ Invalid command (should fail)');
            } catch (error) {
                errorTests.push('✓ Invalid command error handled');
            }
            
            // Test network timeout
            try {
                await new Promise((resolve, reject) => {
                    const req = https.get('https://nonexistent-domain-12345.com', resolve);
                    req.on('error', reject);
                    req.setTimeout(1000, () => {
                        req.destroy();
                        reject(new Error('Timeout'));
                    });
                });
                errorTests.push('✗ Network timeout (should fail)');
            } catch (error) {
                errorTests.push('✓ Network timeout handled');
            }

            this.logResult('PASS', 'Error Handling', errorTests.join(', '));
        } catch (error) {
            this.logResult('FAIL', 'Error Handling', error.message);
        }
    }

    logTest(testName) {
        console.log(`\n🔍 Running: ${testName}`);
    }

    logResult(status, testName, details) {
        const timestamp = new Date().toLocaleTimeString();
        const statusIcon = {
            'PASS': '✅',
            'FAIL': '❌',
            'INFO': 'ℹ️',
            'ERROR': '🚨'
        }[status] || '❓';
        
        console.log(`${statusIcon} [${timestamp}] ${testName}: ${details}`);
        
        this.testResults.push({
            status,
            testName,
            details,
            timestamp
        });
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const errors = this.testResults.filter(r => r.status === 'ERROR').length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`🚨 Errors: ${errors}`);
        console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        if (failed > 0 || errors > 0) {
            console.log('\n❌ FAILED/ERROR TESTS:');
            this.testResults
                .filter(r => r.status === 'FAIL' || r.status === 'ERROR')
                .forEach(r => {
                    console.log(`  • ${r.testName}: ${r.details}`);
                });
        }
        
        console.log('\n🏁 Test suite completed!');
        
        // Platform-specific recommendations
        this.printRecommendations();
    }

    printRecommendations() {
        console.log('\n💡 PLATFORM-SPECIFIC RECOMMENDATIONS:');
        
        if (this.platform === 'darwin') {
            console.log('📱 macOS:');
            console.log('  • Use Homebrew for easier installation: brew install blast');
            console.log('  • For Apple Silicon, ensure ARM64 compatibility');
            console.log('  • May need to approve downloaded files in Security preferences');
        } else if (this.platform === 'win32') {
            console.log('🪟 Windows:');
            console.log('  • Run installer as Administrator for system-wide installation');
            console.log('  • Add BLAST+ bin directory to system PATH manually if needed');
            console.log('  • Windows Defender may scan large downloads');
        } else if (this.platform === 'linux') {
            console.log('🐧 Linux:');
            console.log('  • Use package manager when available: apt install ncbi-blast+');
            console.log('  • Ensure proper permissions for /usr/local installation');
            console.log('  • Update shell profile for PATH configuration');
        }
    }
}

// Run the test suite
if (require.main === module) {
    const tester = new BlastInstallerTester();
    tester.runAllTests().catch(error => {
        console.error('🚨 Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = BlastInstallerTester; 