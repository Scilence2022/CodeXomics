#!/usr/bin/env node

/**
 * Project Manager Menu Verification Script
 * Checks if all menu functions are properly implemented
 */

const fs = require('fs');
const path = require('path');

console.log('🧬 Project Manager Menu Verification\n');

// Function implementations to check
const menuFunctions = {
    'File Menu': [
        'createNewProject',
        'openProject', 
        'openRecentProject',
        'saveCurrentProject',
        'saveProjectAs',
        'importProject',
        'exportCurrentProject', 
        'closeCurrentProject'
    ],
    'Edit Menu': [
        'addFiles',
        'createFolder',
        'selectAllFiles',
        'clearSelection',
        'deleteSelectedFiles'
    ],
    'View Menu': [
        'manualRefreshProjects',
        'setViewMode',
        'toggleDetailsPanel',
        'toggleSidebar'
    ],
    'Tools Menu': [
        'analyzeProject',
        'validateFiles',
        'findDuplicateFiles',
        'openInGenomeViewer',
        'runGenomicAnalysis'
    ],
    'Help Menu': [
        'showDocumentation',
        'showKeyboardShortcuts',
        'reportBug',
        'showAbout'
    ]
};

// Files to check
const filesToCheck = [
    'src/renderer/modules/ProjectManagerWindow.js',
    'src/renderer/modules/ProjectManager.js',
    'src/project-manager.html'
];

function checkFileExists(filePath) {
    return fs.existsSync(filePath);
}

function checkFunctionInFile(filePath, functionName) {
    if (!checkFileExists(filePath)) {
        return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for function definition patterns
    const patterns = [
        new RegExp(`${functionName}\\s*\\(`, 'g'),
        new RegExp(`"${functionName}"`, 'g'),
        new RegExp(`'${functionName}'`, 'g'),
        new RegExp(`onclick="[^"]*${functionName}\\(`, 'g')
    ];
    
    return patterns.some(pattern => pattern.test(content));
}

function verifyMenuImplementations() {
    console.log('📊 Menu Implementation Status:\n');
    
    let totalFunctions = 0;
    let implementedFunctions = 0;
    
    for (const [menuName, functions] of Object.entries(menuFunctions)) {
        console.log(`\n${menuName}:`);
        console.log('='.repeat(menuName.length + 1));
        
        for (const functionName of functions) {
            totalFunctions++;
            let found = false;
            let foundInFiles = [];
            
            for (const filePath of filesToCheck) {
                if (checkFunctionInFile(filePath, functionName)) {
                    found = true;
                    foundInFiles.push(path.basename(filePath));
                }
            }
            
            if (found) {
                implementedFunctions++;
                console.log(`✅ ${functionName} (found in: ${foundInFiles.join(', ')})`);
            } else {
                console.log(`❌ ${functionName} (NOT FOUND)`);
            }
        }
    }
    
    console.log('\n📈 Summary:');
    console.log('==========');
    console.log(`Total functions: ${totalFunctions}`);
    console.log(`Implemented: ${implementedFunctions}`);
    console.log(`Missing: ${totalFunctions - implementedFunctions}`);
    console.log(`Implementation rate: ${Math.round((implementedFunctions / totalFunctions) * 100)}%`);
    
    return {
        total: totalFunctions,
        implemented: implementedFunctions,
        missing: totalFunctions - implementedFunctions,
        rate: Math.round((implementedFunctions / totalFunctions) * 100)
    };
}

function checkFolderPersistenceImplementation() {
    console.log('\n\n🔍 Folder Persistence Implementation Check:\n');
    
    const criticalFunctions = [
        'createFolder',
        'saveProjectAsXML', 
        'xmlToProject',
        'projectToXML'
    ];
    
    console.log('Critical Functions for Folder Persistence:');
    console.log('==========================================');
    
    for (const functionName of criticalFunctions) {
        let found = false;
        let foundInFiles = [];
        
        for (const filePath of filesToCheck.concat(['src/renderer/modules/ProjectXMLHandler.js'])) {
            if (checkFunctionInFile(filePath, functionName)) {
                found = true;
                foundInFiles.push(path.basename(filePath));
            }
        }
        
        if (found) {
            console.log(`✅ ${functionName} (found in: ${foundInFiles.join(', ')})`);
        } else {
            console.log(`❌ ${functionName} (NOT FOUND)`);
        }
    }
    
    // Check for XML folder structure handling
    const xmlHandlerPath = 'src/renderer/modules/ProjectXMLHandler.js';
    if (checkFileExists(xmlHandlerPath)) {
        const content = fs.readFileSync(xmlHandlerPath, 'utf8');
        
        console.log('\nXML Handler Folder Support:');
        console.log('===========================');
        console.log(`✅ Folders element: ${content.includes('<Folders>') ? 'Yes' : 'No'}`);
        console.log(`✅ Folder parsing: ${content.includes('querySelector(\'Folder\')') ? 'Yes' : 'No'}`);
        console.log(`✅ Path segments: ${content.includes('querySelectorAll(\'Segment\')') ? 'Yes' : 'No'}`);
    }
}

function checkProjectXMLFormat() {
    console.log('\n\n📄 Project XML Format Check:\n');
    
    const xmlHandlerPath = 'src/renderer/modules/ProjectXMLHandler.js';
    if (!checkFileExists(xmlHandlerPath)) {
        console.log('❌ ProjectXMLHandler.js not found!');
        return;
    }
    
    const content = fs.readFileSync(xmlHandlerPath, 'utf8');
    
    console.log('XML Structure Support:');
    console.log('=====================');
    
    const xmlElements = [
        'GenomeExplorerProject',
        'ProjectInfo',
        'Settings', 
        'Folders',
        'Files',
        'ProjectMetadata',
        'History'
    ];
    
    for (const element of xmlElements) {
        const hasElement = content.includes(`<${element}>`) || content.includes(`'${element}'`) || content.includes(`"${element}"`);
        console.log(`${hasElement ? '✅' : '❌'} ${element}`);
    }
}

// Run verification
function main() {
    try {
        const results = verifyMenuImplementations();
        checkFolderPersistenceImplementation();
        checkProjectXMLFormat();
        
        console.log('\n\n🎯 Recommendations:');
        console.log('===================');
        
        if (results.rate >= 90) {
            console.log('✅ Menu implementation is excellent!');
        } else if (results.rate >= 75) {
            console.log('⚠️  Menu implementation is good but could be improved.');
        } else {
            console.log('❌ Menu implementation needs significant work.');
        }
        
        console.log('\nFor the folder persistence issue:');
        console.log('1. Ensure createFolder() calls saveProjectAsXML()');
        console.log('2. Verify XML format includes complete folder structure');
        console.log('3. Test project save/load cycle with custom folders');
        console.log('4. Check that folders array includes files property');
        
    } catch (error) {
        console.error('❌ Error during verification:', error.message);
    }
}

main(); 