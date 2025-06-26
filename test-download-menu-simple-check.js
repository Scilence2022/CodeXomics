#!/usr/bin/env node

/**
 * Simple Download Menu Verification
 * 验证Project Manager是否正确复制了Download菜单
 */

const fs = require('fs');

console.log('🧬 Simple Download Menu Verification');
console.log('===================================');

const mainJs = fs.readFileSync('src/main.js', 'utf8');

// 检查Project Manager Download菜单的实现
const projectManagerMenuStart = mainJs.indexOf('function createProjectManagerMenu');
const projectManagerMenuEnd = mainJs.indexOf('return Menu.buildFromTemplate(template);', projectManagerMenuStart);
const projectManagerMenuSection = mainJs.substring(projectManagerMenuStart, projectManagerMenuEnd);

console.log('\n📋 Project Manager Download Menu Check:');

// 检查Download菜单是否存在
if (projectManagerMenuSection.includes('Download Menu - copied from main window')) {
    console.log('✅ Download menu comment found');
    
    // 检查具体的菜单项
    const menuItems = [
        'NCBI Databases',
        'EMBL-EBI Databases',
        'DDBJ Sequences', 
        'UniProt Proteins',
        'KEGG Pathways',
        'Bulk Download Manager'
    ];
    
    let foundItems = 0;
    for (const item of menuItems) {
        if (projectManagerMenuSection.includes(`label: '${item}'`)) {
            console.log(`✅ ${item} - Found`);
            foundItems++;
        } else {
            console.log(`❌ ${item} - Missing`);
        }
    }
    
    console.log(`\n📊 Menu Items: ${foundItems}/${menuItems.length} found`);
    
    // 检查函数调用
    const functionCalls = [
        'createGenomicDownloadWindow(\'ncbi-unified\')',
        'createGenomicDownloadWindow(\'embl-unified\')',
        'createGenomicDownloadWindow(\'ddbj-sequences\')',
        'createGenomicDownloadWindow(\'uniprot-proteins\')',
        'createGenomicDownloadWindow(\'kegg-pathways\')',
        'createGenomicDownloadWindow(\'bulk-manager\')'
    ];
    
    console.log('\n🔧 Function Calls Check:');
    let foundCalls = 0;
    for (const call of functionCalls) {
        if (projectManagerMenuSection.includes(call)) {
            console.log(`✅ ${call} - Found`);
            foundCalls++;
        } else {
            console.log(`❌ ${call} - Missing`);
        }
    }
    
    console.log(`\n📊 Function Calls: ${foundCalls}/${functionCalls.length} found`);
    
    // 检查快捷键
    if (projectManagerMenuSection.includes('CmdOrCtrl+Shift+D')) {
        console.log('✅ Bulk Download Manager shortcut (Ctrl+Shift+D) found');
    } else {
        console.log('❌ Bulk Download Manager shortcut missing');
    }
    
    // 总结
    if (foundItems === menuItems.length && foundCalls === functionCalls.length) {
        console.log('\n🎉 SUCCESS: Download menu completely copied to Project Manager!');
    } else {
        console.log('\n⚠️  WARNING: Download menu copy is incomplete');
    }
    
} else {
    console.log('❌ Download menu not found in Project Manager');
}

// 检查支持文件
console.log('\n📁 Supporting Files Check:');
const supportingFiles = [
    'src/genomic-data-download.html',
    'src/renderer/modules/GenomicDataDownloader.js'
];

for (const file of supportingFiles) {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} missing`);
    }
}

console.log('\n✅ Verification completed!'); 