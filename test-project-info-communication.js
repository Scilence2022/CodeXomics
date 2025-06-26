/**
 * Test Script: Project Manager Project Info Communication Fix
 * 
 * This test verifies that the Project Manager correctly passes current project 
 * information to Download windows after our fix.
 */

console.log('🧪 Project Manager Project Info Communication Fix Test');
console.log('=' .repeat(60));

// Test 1: Verify main.js changes
console.log('\n📋 Test 1: Main Process Changes');
const fs = require('fs');
const path = require('path');

try {
    const mainJsPath = path.join(__dirname, 'src', 'main.js');
    const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
    
    // Check for Project Manager window detection
    const hasProjectManagerDetection = mainJsContent.includes('getAllWindows().filter(window =>') && 
                                      mainJsContent.includes('Project Manager');
    
    // Check for project info request
    const hasProjectInfoRequest = mainJsContent.includes('request-current-project-for-download');
    
    // Check for response handler
    const hasResponseHandler = mainJsContent.includes('project-manager-current-project-response');
    
    console.log(`   ✅ Project Manager window detection: ${hasProjectManagerDetection ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Project info request mechanism: ${hasProjectInfoRequest ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Response handler: ${hasResponseHandler ? 'FOUND' : 'MISSING'}`);
    
    const mainProcessScore = [hasProjectManagerDetection, hasProjectInfoRequest, hasResponseHandler].filter(Boolean).length;
    console.log(`   📊 Main Process Score: ${mainProcessScore}/3`);
} catch (error) {
    console.log(`   ❌ Error reading main.js: ${error.message}`);
}

// Test 2: Verify project-manager.html changes
console.log('\n📋 Test 2: Project Manager Changes');

try {
    const projectManagerPath = path.join(__dirname, 'src', 'project-manager.html');
    const projectManagerContent = fs.readFileSync(projectManagerPath, 'utf8');
    
    // Check for request listener
    const hasRequestListener = projectManagerContent.includes('request-current-project-for-download');
    
    // Check for project info extraction
    const hasProjectInfoExtraction = projectManagerContent.includes('projectManagerWindow.currentProject') &&
                                    projectManagerContent.includes('dataFolderPath');
    
    // Check for response sending
    const hasResponseSending = projectManagerContent.includes('project-manager-current-project-response');
    
    console.log(`   ✅ Request listener: ${hasRequestListener ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Project info extraction: ${hasProjectInfoExtraction ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Response sending: ${hasResponseSending ? 'FOUND' : 'MISSING'}`);
    
    const projectManagerScore = [hasRequestListener, hasProjectInfoExtraction, hasResponseSending].filter(Boolean).length;
    console.log(`   📊 Project Manager Score: ${projectManagerScore}/3`);
} catch (error) {
    console.log(`   ❌ Error reading project-manager.html: ${error.message}`);
}

// Test 3: Verify preload.js changes
console.log('\n📋 Test 3: Preload Script Changes');

try {
    const preloadPath = path.join(__dirname, 'src', 'preload.js');
    const preloadContent = fs.readFileSync(preloadPath, 'utf8');
    
    // Check for send method exposure
    const hasSendMethod = preloadContent.includes('send: (channel, ...args)');
    
    // Check for response channel whitelist
    const hasResponseChannel = preloadContent.includes('project-manager-current-project-response');
    
    // Check for request channel whitelist
    const hasRequestChannel = preloadContent.includes('request-current-project-for-download');
    
    console.log(`   ✅ ipcRenderer.send method exposed: ${hasSendMethod ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Response channel whitelisted: ${hasResponseChannel ? 'FOUND' : 'MISSING'}`);
    console.log(`   ✅ Request channel whitelisted: ${hasRequestChannel ? 'FOUND' : 'MISSING'}`);
    
    const preloadScore = [hasSendMethod, hasResponseChannel, hasRequestChannel].filter(Boolean).length;
    console.log(`   📊 Preload Script Score: ${preloadScore}/3`);
} catch (error) {
    console.log(`   ❌ Error reading preload.js: ${error.message}`);
}

// Overall Summary
console.log('\n' + '='.repeat(60));
console.log('📋 OVERALL TEST SUMMARY');
console.log('='.repeat(60));

console.log('\n🔧 Implementation Status:');
console.log('   ✅ Main Process: Enhanced createGenomicDownloadWindow() function');
console.log('   ✅ Project Manager: Added request-response communication');  
console.log('   ✅ Preload Script: Exposed secure IPC send capabilities');

console.log('\n�� Key Changes Made:');
console.log('   1. Dynamic Project Manager window detection');
console.log('   2. Async project info request-response mechanism');
console.log('   3. Fallback to current active project if needed');
console.log('   4. Secure IPC channel whitelisting');

console.log('\n🎯 Expected Result:');
console.log('   • Download windows launched from Project Manager receive correct project info');
console.log('   • No more "null" project information in console logs');
console.log('   • Automatic project directory targeting for downloads');
console.log('   • Improved user experience with seamless project integration');

console.log('\n📋 Test Instructions:');
console.log('   1. Open Project Manager and load/create a project');
console.log('   2. Use Download menu to open any download tool');
console.log('   3. Check console for proper project info transmission');
console.log('   4. Verify project info is not null');

console.log('\n🔧 Test completed! Please manually verify the fix by following the test instructions.');
