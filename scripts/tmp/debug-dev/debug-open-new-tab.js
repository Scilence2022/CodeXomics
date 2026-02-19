// Debug script for open_new_tab function call
// Run this in the browser console to test the function call

console.log('🔧 Starting open_new_tab debug script...');

async function debugOpenNewTab() {
  console.log('🔧 ===== OPEN NEW TAB DEBUG START =====');

  try {
    // Check environment
    console.log('🔧 Checking environment...');
    const genomeBrowser = window.genomeBrowser;
    console.log('🔧 window.genomeBrowser available:', !!genomeBrowser);

    if (!genomeBrowser) {
      throw new Error('Genome browser not available');
    }

    // Check components
    console.log('🔧 Checking components...');
    console.log('🔧 actionManager available:', !!genomeBrowser.actionManager);
    console.log('🔧 tabManager available:', !!genomeBrowser.tabManager);
    console.log('🔧 chatManager available:', !!genomeBrowser.chatManager);

    if (!genomeBrowser.actionManager || !genomeBrowser.tabManager || !genomeBrowser.chatManager) {
      throw new Error('Required components not available');
    }

    // Check current tab count
    const initialTabCount = genomeBrowser.tabManager.tabs.size;
    console.log('🔧 Initial tab count:', initialTabCount);
    console.log('🔧 Current tabs:', Array.from(genomeBrowser.tabManager.tabs.keys()));

    // Test 1: Direct ActionManager call
    console.log('🔧 Test 1: Direct ActionManager.functionOpenNewTab() call...');
    const directResult = await genomeBrowser.actionManager.functionOpenNewTab({});
    console.log('🔧 Direct call result:', directResult);

    // Wait for tab creation
    await new Promise(resolve => setTimeout(resolve, 1000));

    const afterDirectCount = genomeBrowser.tabManager.tabs.size;
    console.log('🔧 Tab count after direct call:', afterDirectCount);
    console.log('🔧 Tabs after direct call:', Array.from(genomeBrowser.tabManager.tabs.keys()));

    // Test 2: ChatManager route
    console.log('🔧 Test 2: ChatManager.executeToolByName() route...');
    const chatResult = await genomeBrowser.chatManager.executeToolByName('open_new_tab', {});
    console.log('🔧 ChatManager route result:', chatResult);

    // Wait for tab creation
    await new Promise(resolve => setTimeout(resolve, 1000));

    const afterChatCount = genomeBrowser.tabManager.tabs.size;
    console.log('🔧 Tab count after ChatManager call:', afterChatCount);
    console.log('🔧 Tabs after ChatManager call:', Array.from(genomeBrowser.tabManager.tabs.keys()));

    // Test 3: Manual button simulation
    console.log('🔧 Test 3: Manual button simulation...');
    const newTabButton = document.getElementById('newTabButton');
    console.log('🔧 newTabButton found:', !!newTabButton);

    if (newTabButton) {
      const beforeButtonCount = genomeBrowser.tabManager.tabs.size;
      console.log('🔧 Tab count before button click:', beforeButtonCount);

      newTabButton.click();
      console.log('🔧 Button click simulated');

      await new Promise(resolve => setTimeout(resolve, 1000));

      const afterButtonCount = genomeBrowser.tabManager.tabs.size;
      console.log('🔧 Tab count after button click:', afterButtonCount);
      console.log('🔧 Tabs after button click:', Array.from(genomeBrowser.tabManager.tabs.keys()));
    }

    // Summary
    console.log('🔧 ===== SUMMARY =====');
    console.log('🔧 Initial tab count:', initialTabCount);
    console.log('🔧 After direct call:', afterDirectCount);
    console.log('🔧 After ChatManager call:', afterChatCount);
    console.log('🔧 Direct call success:', directResult && directResult.success);
    console.log('🔧 ChatManager call success:', chatResult && chatResult.success);

    if (directResult && directResult.success && chatResult && chatResult.success) {
      console.log('✅ Both calls succeeded!');
    } else if (directResult && directResult.success && (!chatResult || !chatResult.success)) {
      console.log('⚠️ Direct call succeeded but ChatManager route failed - routing issue');
    } else if (!directResult || !directResult.success) {
      console.log('❌ Direct call failed - core functionality issue');
    }
  } catch (error) {
    console.error('❌ Debug script error:', error);
    console.error('❌ Error stack:', error.stack);
  }

  console.log('🔧 ===== OPEN NEW TAB DEBUG END =====');
}

// Auto-run the debug function
debugOpenNewTab();

// Also make it available globally
window.debugOpenNewTab = debugOpenNewTab;

console.log('🔧 Debug script loaded. You can also run debugOpenNewTab() manually.');
