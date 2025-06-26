#!/usr/bin/env node

/**
 * Download Functionality Verification Script
 * 测试Project Manager中复制的Download菜单所有功能
 */

const fs = require('fs');
const path = require('path');

console.log('🧬 Download Functionality Verification');
console.log('=====================================');

// 1. 检查必要文件存在性
console.log('\n📁 Checking Required Files...');

const requiredFiles = [
    'src/genomic-data-download.html',
    'src/renderer/modules/GenomicDataDownloader.js',
    'src/main.js',
    'src/preload.js'
];

let allFilesExist = true;
for (const file of requiredFiles) {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} is missing`);
        allFilesExist = false;
    }
}

// 2. 检查主窗口Download菜单配置
console.log('\n🔍 Checking Main Window Download Menu...');

const mainJs = fs.readFileSync('src/main.js', 'utf8');

// 检查主窗口Download菜单项
const mainDownloadMenuItems = [
    'NCBI Databases',
    'EMBL-EBI Databases', 
    'DDBJ Sequences',
    'UniProt Proteins',
    'KEGG Pathways',
    'Bulk Download Manager'
];

let mainMenuComplete = true;
for (const item of mainDownloadMenuItems) {
    if (mainJs.includes(`label: '${item}'`)) {
        console.log(`✅ Main window has "${item}"`);
    } else {
        console.log(`❌ Main window missing "${item}"`);
        mainMenuComplete = false;
    }
}

// 3. 检查Project Manager Download菜单配置
console.log('\n🔍 Checking Project Manager Download Menu...');

let pmMenuComplete = false;
const projectManagerMenuPattern = /createProjectManagerMenu[\s\S]*?Download[\s\S]*?submenu:([\s\S]*?)}\s*,\s*\/\/ Help Menu/;
const projectManagerMenuMatch = mainJs.match(projectManagerMenuPattern);

if (projectManagerMenuMatch) {
    console.log('✅ Project Manager Download menu structure found');
    
    const downloadMenuSection = projectManagerMenuMatch[1];
    let pmMenuItemsFound = 0;
    
    for (const item of mainDownloadMenuItems) {
        if (downloadMenuSection.includes(`label: '${item}'`)) {
            console.log(`✅ Project Manager has "${item}"`);
            pmMenuItemsFound++;
        } else {
            console.log(`❌ Project Manager missing "${item}"`);
        }
    }
    
    pmMenuComplete = pmMenuItemsFound === mainDownloadMenuItems.length;
    
    if (pmMenuComplete) {
        console.log('✅ Project Manager Download menu is complete');
    } else {
        console.log('❌ Project Manager Download menu is incomplete');
    }
} else {
    console.log('❌ Project Manager Download menu not found');
    // 尝试更简单的检查
    if (mainJs.includes('// Download Menu - copied from main window')) {
        console.log('✅ Download menu comment found - checking individual items...');
        
        let itemsFound = 0;
        for (const item of mainDownloadMenuItems) {
            // 在createProjectManagerMenu函数中查找
            const pmMenuRegex = new RegExp(`createProjectManagerMenu[\\s\\S]*?label: '${item}'[\\s\\S]*?Help Menu`);
            if (pmMenuRegex.test(mainJs)) {
                console.log(`✅ Project Manager has "${item}" (alternative check)`);
                itemsFound++;
            }
        }
        pmMenuComplete = itemsFound === mainDownloadMenuItems.length;
    }
}

// 4. 检查GenomicDataDownloader.js功能
console.log('\n🔍 Checking GenomicDataDownloader Module...');

const downloaderJs = fs.readFileSync('src/renderer/modules/GenomicDataDownloader.js', 'utf8');

const requiredMethods = [
    'constructor',
    'initialize',
    'setDownloadType',
    'performSearch',
    'searchNCBI',
    'searchEMBL',
    'downloadSelected',
    'downloadAll'
];

let allMethodsPresent = true;
for (const method of requiredMethods) {
    if (downloaderJs.includes(method)) {
        console.log(`✅ GenomicDataDownloader has ${method}()`);
    } else {
        console.log(`❌ GenomicDataDownloader missing ${method}()`);
        allMethodsPresent = false;
    }
}

// 5. 检查API配置
console.log('\n🔍 Checking API Configurations...');

const expectedDatabases = [
    'ncbi-unified',
    'embl-unified', 
    'ddbj-sequences',
    'uniprot-proteins',
    'kegg-pathways'
];

let allDatabasesConfigured = true;
for (const db of expectedDatabases) {
    if (downloaderJs.includes(`'${db}'`)) {
        console.log(`✅ API config includes ${db}`);
    } else {
        console.log(`❌ API config missing ${db}`);
        allDatabasesConfigured = false;
    }
}

// 6. 检查IPC处理器
console.log('\n🔍 Checking IPC Handlers...');

const requiredIpcHandlers = [
    'selectDirectory',
    'downloadFile', 
    'getCurrentProject',
    'setActiveProject'
];

let allHandlersPresent = true;
for (const handler of requiredIpcHandlers) {
    if (mainJs.includes(`ipcMain.handle('${handler}'`)) {
        console.log(`✅ IPC handler "${handler}" exists`);
    } else {
        console.log(`❌ IPC handler "${handler}" missing`);
        allHandlersPresent = false;
    }
}

// 7. 检查preload.js API暴露
console.log('\n🔍 Checking Preload API Exposure...');

const preloadJs = fs.readFileSync('src/preload.js', 'utf8');

const requiredPreloadAPIs = [
    'selectDirectory',
    'downloadFile',
    'getCurrentProject', 
    'onSetDownloadType',
    'onSetActiveProject'
];

let allAPIsExposed = true;
for (const api of requiredPreloadAPIs) {
    if (preloadJs.includes(api)) {
        console.log(`✅ Preload exposes "${api}"`);
    } else {
        console.log(`❌ Preload missing "${api}"`);
        allAPIsExposed = false;
    }
}

// 8. 检查createGenomicDownloadWindow函数
console.log('\n🔍 Checking Download Window Creation...');

if (mainJs.includes('function createGenomicDownloadWindow')) {
    console.log('✅ createGenomicDownloadWindow function exists');
    
    // 检查是否正确使用GenomicDataDownloader
    if (mainJs.includes('GenomicDataDownloader')) {
        console.log('✅ Function references GenomicDataDownloader');
    } else {
        console.log('❌ Function does not reference GenomicDataDownloader');
    }
} else {
    console.log('❌ createGenomicDownloadWindow function missing');
}

// 9. 综合评估
console.log('\n📊 Overall Assessment');
console.log('===================');

const checks = [
    { name: 'Required Files', passed: allFilesExist },
    { name: 'Main Window Menu', passed: mainMenuComplete },
    { name: 'Project Manager Menu', passed: pmMenuComplete },
    { name: 'Downloader Methods', passed: allMethodsPresent },
    { name: 'Database Configs', passed: allDatabasesConfigured },
    { name: 'IPC Handlers', passed: allHandlersPresent },
    { name: 'Preload APIs', passed: allAPIsExposed }
];

const passedChecks = checks.filter(check => check.passed).length;
const totalChecks = checks.length;

console.log(`\n📈 Score: ${passedChecks}/${totalChecks} checks passed`);

if (passedChecks === totalChecks) {
    console.log('🎉 ALL CHECKS PASSED! Download functionality is fully integrated.');
} else {
    console.log('⚠️  Some checks failed. Please review the issues above.');
}

// 10. 功能测试建议
console.log('\n🧪 Manual Testing Recommendations');
console.log('================================');
console.log('1. Open Project Manager window');
console.log('2. Verify Download menu appears in menu bar');
console.log('3. Test each submenu item:');
console.log('   - NCBI Databases');
console.log('   - EMBL-EBI Databases'); 
console.log('   - DDBJ Sequences');
console.log('   - UniProt Proteins');
console.log('   - KEGG Pathways');
console.log('   - Bulk Download Manager (Ctrl+Shift+D)');
console.log('4. Verify each opens correct download interface');
console.log('5. Test search functionality with sample terms');
console.log('6. Test download progress and file saving');
console.log('7. Verify project integration works correctly');

console.log('\n✅ Verification completed!'); 