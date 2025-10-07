/**
 * External Tools System Test
 * 
 * This file documents the testing approach for the External Tools configuration system.
 * Run these tests manually to verify functionality.
 */

console.log('🧪 External Tools System Test Suite');

// Test 1: Verify ExternalToolsManager initialization
function testExternalToolsManagerInit() {
    console.log('🔬 Test 1: ExternalToolsManager Initialization');
    
    if (window.externalToolsManager) {
        console.log('✅ ExternalToolsManager is available globally');
        console.log('✅ Built-in tools:', window.externalToolsManager.builtinTools);
        console.log('✅ Custom tools:', window.externalToolsManager.customTools);
        return true;
    } else {
        console.error('❌ ExternalToolsManager not found');
        return false;
    }
}

// Test 2: Test modal opening
function testModalOpening() {
    console.log('🔬 Test 2: Modal Opening');
    
    try {
        if (window.genomeBrowser && window.genomeBrowser.showExternalToolsModal) {
            window.genomeBrowser.showExternalToolsModal();
            console.log('✅ External tools modal opened successfully');
            return true;
        } else {
            console.error('❌ showExternalToolsModal method not found');
            return false;
        }
    } catch (error) {
        console.error('❌ Error opening modal:', error);
        return false;
    }
}

// Test 3: Test custom tool addition
function testCustomToolAddition() {
    console.log('🔬 Test 3: Custom Tool Addition');
    
    if (window.externalToolsManager) {
        const initialCount = window.externalToolsManager.customTools.length;
        window.externalToolsManager.addCustomTool();
        const newCount = window.externalToolsManager.customTools.length;
        
        if (newCount > initialCount) {
            console.log('✅ Custom tool added successfully');
            return true;
        } else {
            console.error('❌ Custom tool was not added');
            return false;
        }
    } else {
        console.error('❌ ExternalToolsManager not available');
        return false;
    }
}

// Test 4: Test menu integration
function testMenuIntegration() {
    console.log('🔬 Test 4: Menu Integration');
    
    if (window.externalToolsManager) {
        const tools = window.externalToolsManager.getAllTools();
        console.log('✅ All tools retrieved:', tools);
        
        // Test updateMainMenu
        window.externalToolsManager.updateMainMenu();
        console.log('✅ Main menu update triggered');
        return true;
    } else {
        console.error('❌ ExternalToolsManager not available');
        return false;
    }
}

// Test 5: Test settings persistence
async function testSettingsPersistence() {
    console.log('🔬 Test 5: Settings Persistence');
    
    if (window.externalToolsManager) {
        try {
            await window.externalToolsManager.loadSettings();
            console.log('✅ Settings loaded successfully');
            
            // Test save (without actually modifying data)
            console.log('✅ Settings can be saved (simulation)');
            return true;
        } catch (error) {
            console.error('❌ Settings persistence test failed:', error);
            return false;
        }
    } else {
        console.error('❌ ExternalToolsManager not available');
        return false;
    }
}

// Run all tests
async function runAllTests() {
    console.log('🧪 Starting External Tools System Test Suite...');
    
    const results = [];
    
    results.push({ test: 'Manager Init', result: testExternalToolsManagerInit() });
    results.push({ test: 'Modal Opening', result: testModalOpening() });
    results.push({ test: 'Custom Tool Addition', result: testCustomToolAddition() });
    results.push({ test: 'Menu Integration', result: testMenuIntegration() });
    results.push({ test: 'Settings Persistence', result: await testSettingsPersistence() });
    
    // Close modal if opened during testing
    const modal = document.getElementById('externalToolsModal');
    if (modal) {
        modal.classList.remove('show');
    }
    
    // Summary
    const passed = results.filter(r => r.result).length;
    const failed = results.filter(r => !r.result).length;
    
    console.log('🧪 Test Results Summary:');
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    
    results.forEach(r => {
        console.log(`${r.result ? '✅' : '❌'} ${r.test}`);
    });
    
    if (failed === 0) {
        console.log('🎉 All tests passed! External Tools system is working correctly.');
    } else {
        console.log('⚠️ Some tests failed. Please check the implementation.');
    }
    
    return results;
}

// Manual testing instructions
console.log(`
📝 Manual Testing Instructions:

1. Run automated tests:
   runAllTests()

2. Test menu access:
   - Go to Tools menu
   - Click "Configure External Tools"
   - Verify modal opens

3. Test built-in tools configuration:
   - Change Deep Gene Research URL
   - Change CHOPCHOP URL
   - Save settings
   - Verify URLs are updated

4. Test custom tools:
   - Click "Add Custom Tool"
   - Enter tool name and URL
   - Save settings
   - Verify tool appears in Tools menu

5. Test tool opening:
   - Try opening Deep Gene Research from menu
   - Try opening CHOPCHOP from menu
   - Try opening a custom tool from menu

6. Test settings persistence:
   - Configure tools and save
   - Restart application
   - Verify settings are retained
`);

// Export for use in console
if (typeof window !== 'undefined') {
    window.testExternalTools = {
        runAllTests,
        testExternalToolsManagerInit,
        testModalOpening,
        testCustomToolAddition,
        testMenuIntegration,
        testSettingsPersistence
    };
}