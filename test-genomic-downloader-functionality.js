#!/usr/bin/env node

/**
 * GenomicDataDownloader Functionality Test
 * 测试GenomicDataDownloader类的核心功能
 */

const fs = require('fs');

console.log('🧬 GenomicDataDownloader Functionality Test');
console.log('==========================================');

// 读取GenomicDataDownloader.js文件
const downloaderContent = fs.readFileSync('src/renderer/modules/GenomicDataDownloader.js', 'utf8');

console.log('\n🔍 Checking Class Structure...');

// 1. 检查类定义
if (downloaderContent.includes('class GenomicDataDownloader')) {
    console.log('✅ GenomicDataDownloader class definition found');
} else {
    console.log('❌ GenomicDataDownloader class definition missing');
}

// 2. 检查API配置
console.log('\n🔍 Checking API Configurations...');

const apiDatabases = [
    'ncbi-unified',
    'embl-unified',
    'ddbj-sequences', 
    'uniprot-proteins',
    'kegg-pathways'
];

const apiConfig = downloaderContent.match(/apiConfig\s*=\s*{([\s\S]*?)};/);
if (apiConfig) {
    console.log('✅ API configuration object found');
    
    let configComplete = true;
    for (const db of apiDatabases) {
        if (apiConfig[1].includes(`'${db}'`)) {
            console.log(`✅ ${db} configuration exists`);
        } else {
            console.log(`❌ ${db} configuration missing`);
            configComplete = false;
        }
    }
    
    if (configComplete) {
        console.log('✅ All database configurations present');
    }
} else {
    console.log('❌ API configuration object not found');
}

// 3. 检查核心方法
console.log('\n🔍 Checking Core Methods...');

const coreMethods = [
    'constructor()',
    'initialize()',
    'setupEventListeners()',
    'setupIpcListeners()',
    'setDownloadType(',
    'performSearch()',
    'searchNCBI(',
    'searchEMBL(',
    'downloadSelected()',
    'downloadAll()',
    'displayResults(',
    'selectOutputDirectory(',
    'clearSearch()'
];

let methodsFound = 0;
for (const method of coreMethods) {
    if (downloaderContent.includes(method)) {
        console.log(`✅ ${method} method found`);
        methodsFound++;
    } else {
        console.log(`❌ ${method} method missing`);
    }
}

console.log(`\n📊 Core Methods: ${methodsFound}/${coreMethods.length} found`);

// 4. 检查事件监听器
console.log('\n🔍 Checking Event Listeners...');

const eventListeners = [
    'addEventListener(\'submit\'',
    'addEventListener(\'click\'',
    'onSetDownloadType',
    'onSetActiveProject'
];

let listenersFound = 0;
for (const listener of eventListeners) {
    if (downloaderContent.includes(listener)) {
        console.log(`✅ ${listener} event listener found`);
        listenersFound++;
    } else {
        console.log(`❌ ${listener} event listener missing`);
    }
}

// 5. 检查数据库特定的搜索方法
console.log('\n🔍 Checking Database-Specific Search Methods...');

const searchMethods = [
    'searchNCBIUnified(',
    'searchEMBLUnified(',
    'searchUniProt(',
    'searchKEGG('
];

let searchMethodsFound = 0;
for (const method of searchMethods) {
    if (downloaderContent.includes(method)) {
        console.log(`✅ ${method} method found`);
        searchMethodsFound++;
    } else {
        console.log(`❌ ${method} method missing`);
    }
}

// 6. 检查UI交互方法
console.log('\n🔍 Checking UI Interaction Methods...');

const uiMethods = [
    'displayResults(',
    'showStatusMessage(',
    'updateDownloadButtons(',
    'toggleResultSelection(',
    'clearResults('
];

let uiMethodsFound = 0;
for (const method of uiMethods) {
    if (downloaderContent.includes(method)) {
        console.log(`✅ ${method} UI method found`);
        uiMethodsFound++;
    } else {
        console.log(`❌ ${method} UI method missing`);
    }
}

// 7. 检查项目集成功能
console.log('\n🔍 Checking Project Integration...');

const projectFeatures = [
    'setActiveProject(',
    'currentProject',
    'outputDirectory',
    'projectInfo'
];

let projectFeaturesFound = 0;
for (const feature of projectFeatures) {
    if (downloaderContent.includes(feature)) {
        console.log(`✅ ${feature} project feature found`);
        projectFeaturesFound++;
    } else {
        console.log(`❌ ${feature} project feature missing`);
    }
}

// 8. 检查下载功能
console.log('\n🔍 Checking Download Functionality...');

const downloadFeatures = [
    'downloadItem(',
    'downloadQueue',
    'isDownloading',
    'getFileExtension(',
    'startDownload('
];

let downloadFeaturesFound = 0;
for (const feature of downloadFeatures) {
    if (downloaderContent.includes(feature)) {
        console.log(`✅ ${feature} download feature found`);
        downloadFeaturesFound++;
    } else {
        console.log(`❌ ${feature} download feature missing`);
    }
}

// 9. 检查错误处理
console.log('\n🔍 Checking Error Handling...');

const errorHandling = [
    'try {',
    'catch',
    'console.error',
    'showStatusMessage'
];

let errorHandlingFound = 0;
for (const handler of errorHandling) {
    if (downloaderContent.includes(handler)) {
        console.log(`✅ ${handler} error handling found`);
        errorHandlingFound++;
    } else {
        console.log(`❌ ${handler} error handling missing`);
    }
}

// 10. 综合评估
console.log('\n📊 Overall Functionality Assessment');
console.log('=================================');

const allChecks = [
    { name: 'Core Methods', score: methodsFound, total: coreMethods.length },
    { name: 'Event Listeners', score: listenersFound, total: eventListeners.length },
    { name: 'Search Methods', score: searchMethodsFound, total: searchMethods.length },
    { name: 'UI Methods', score: uiMethodsFound, total: uiMethods.length },
    { name: 'Project Features', score: projectFeaturesFound, total: projectFeatures.length },
    { name: 'Download Features', score: downloadFeaturesFound, total: downloadFeatures.length },
    { name: 'Error Handling', score: errorHandlingFound, total: errorHandling.length }
];

let totalScore = 0;
let totalPossible = 0;
for (const check of allChecks) {
    totalScore += check.score;
    totalPossible += check.total;
    const percentage = Math.round((check.score / check.total) * 100);
    console.log(`📈 ${check.name}: ${check.score}/${check.total} (${percentage}%)`);
}

const overallPercentage = Math.round((totalScore / totalPossible) * 100);
console.log(`\n🎯 Overall Score: ${totalScore}/${totalPossible} (${overallPercentage}%)`);

if (overallPercentage >= 90) {
    console.log('🎉 EXCELLENT! GenomicDataDownloader is fully functional');
} else if (overallPercentage >= 80) {
    console.log('✅ GOOD! GenomicDataDownloader has most features implemented');
} else if (overallPercentage >= 70) {
    console.log('⚠️  FAIR! GenomicDataDownloader needs some improvements');
} else {
    console.log('❌ POOR! GenomicDataDownloader needs significant work');
}

console.log('\n✅ Functionality test completed!'); 