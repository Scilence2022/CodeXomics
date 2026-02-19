/**
 * Plugin Disabled State Security Fix - Verification Script
 *
 * This script verifies that disabled plugins are properly blocked
 * from execution at all layers of the plugin system.
 */

// Test Results Tracking
const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function logTest(testName, passed, message) {
  const status = passed ? '✅' : '❌';
  const result = { testName, passed, message };
  testResults.tests.push(result);

  if (passed) {
    testResults.passed++;
    console.log(`${status} ${testName}: ${message}`);
  } else {
    testResults.failed++;
    console.error(`${status} ${testName}: ${message}`);
  }
}

async function verifyPluginDisabledStateSecurity() {
  console.log('🔒 Starting Plugin Disabled State Security Verification\n');

  try {
    // Verify PluginManagerV2 exists
    if (typeof window.pluginManager === 'undefined') {
      console.error('❌ PluginManager not available. Ensure the application is loaded.');
      return false;
    }

    const pluginManager = window.pluginManager;

    // Test 1: Verify validatePluginEnabled method exists
    if (typeof pluginManager.validatePluginEnabled !== 'function') {
      logTest('validatePluginEnabled method exists', false, 'Method not found in PluginManagerV2');
      return false;
    }
    logTest('validatePluginEnabled method exists', true, 'Security validation method available');

    // Test 2: Find a visualization plugin to test
    const vizPlugins = Array.from(pluginManager.pluginRegistry.visualization.entries());
    if (vizPlugins.length === 0) {
      logTest('Test plugin availability', false, 'No visualization plugins found for testing');
      return false;
    }

    const [testPluginId, testPlugin] = vizPlugins[0];
    console.log(`\n📦 Using test plugin: ${testPluginId} (${testPlugin.name})\n`);

    // Save original state
    const originalState = testPlugin.enabled;

    // Test 3: Verify enabled plugin passes validation
    testPlugin.enabled = true;
    try {
      pluginManager.validatePluginEnabled(testPluginId, testPlugin);
      logTest('Enabled plugin validation', true, 'Enabled plugin passed validation check');
    } catch (error) {
      logTest('Enabled plugin validation', false, `Enabled plugin incorrectly blocked: ${error.message}`);
    }

    // Test 4: Verify disabled plugin fails validation
    testPlugin.enabled = false;
    try {
      pluginManager.validatePluginEnabled(testPluginId, testPlugin);
      logTest('Disabled plugin validation', false, 'Disabled plugin was allowed to execute (SECURITY FAILURE)');
    } catch (error) {
      const correctError = error.message.includes('disabled') && error.message.includes('Plugin Management');
      logTest(
        'Disabled plugin validation',
        correctError,
        correctError
          ? 'Disabled plugin correctly blocked with user-friendly message'
          : `Wrong error message: ${error.message}`
      );
    }

    // Test 5: Verify isVisualizationTool checks enabled state
    testPlugin.enabled = false;
    const toolName = `${testPluginId}.visualize`;
    const isVisualizationTool = pluginManager.isVisualizationTool(toolName);

    logTest(
      'isVisualizationTool enabled check',
      !isVisualizationTool,
      isVisualizationTool
        ? 'Disabled plugin incorrectly detected as visualization tool (SECURITY FAILURE)'
        : 'Disabled plugin correctly excluded from tool detection'
    );

    // Test 6: Verify executeVisualizationTool blocks disabled plugin
    testPlugin.enabled = false;
    try {
      await pluginManager.executeVisualizationTool(toolName, {
        data: { nodes: [], edges: [] },
      });
      logTest(
        'executeVisualizationTool security',
        false,
        'Disabled visualization plugin was allowed to execute (SECURITY FAILURE)'
      );
    } catch (error) {
      const correctError = error.message.includes('disabled');
      logTest(
        'executeVisualizationTool security',
        correctError,
        correctError ? 'Disabled visualization plugin correctly blocked' : `Wrong error: ${error.message}`
      );
    }

    // Test 7: Verify PluginToolsBridge filters disabled plugins
    if (typeof window.pluginToolsBridge !== 'undefined') {
      testPlugin.enabled = false;
      window.pluginToolsBridge.invalidateCache();

      const allTools = window.pluginToolsBridge.getAllPluginTools();
      const hasDisabledPlugin = allTools.some(t => t.plugin_id === testPluginId);

      logTest(
        'PluginToolsBridge filtering',
        !hasDisabledPlugin,
        hasDisabledPlugin
          ? 'Disabled plugin incorrectly included in tool registry (SECURITY FAILURE)'
          : 'Disabled plugin correctly excluded from tool registry'
      );

      // Test 8: Verify re-enabling includes plugin in registry
      testPlugin.enabled = true;
      window.pluginToolsBridge.invalidateCache();

      const allToolsEnabled = window.pluginToolsBridge.getAllPluginTools();
      const hasEnabledPlugin = allToolsEnabled.some(t => t.plugin_id === testPluginId);

      logTest(
        'PluginToolsBridge re-enabling',
        hasEnabledPlugin,
        hasEnabledPlugin
          ? 'Re-enabled plugin correctly included in tool registry'
          : 'Re-enabled plugin missing from tool registry'
      );
    } else {
      console.warn('⚠️  PluginToolsBridge not available, skipping registry tests');
    }

    // Restore original state
    testPlugin.enabled = originalState;
    if (typeof window.pluginToolsBridge !== 'undefined') {
      window.pluginToolsBridge.invalidateCache();
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${testResults.tests.length}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`);

    if (testResults.failed === 0) {
      console.log('\n🎉 ALL SECURITY TESTS PASSED!');
      console.log('✅ Plugin disabled state security fix verified successfully.');
    } else {
      console.error('\n⚠️  SOME TESTS FAILED!');
      console.error('❌ Security vulnerability may still exist.');
      console.log('\nFailed Tests:');
      testResults.tests.filter(t => !t.passed).forEach(t => console.error(`  - ${t.testName}: ${t.message}`));
    }

    return testResults.failed === 0;
  } catch (error) {
    console.error('❌ Verification failed with error:', error);
    return false;
  }
}

// Auto-run verification when script is loaded
if (typeof window !== 'undefined') {
  console.log('🔒 Plugin Disabled State Security Verification Script Loaded');
  console.log('Run: verifyPluginDisabledStateSecurity()');
  console.log('');

  // Make function globally accessible
  window.verifyPluginDisabledStateSecurity = verifyPluginDisabledStateSecurity;
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { verifyPluginDisabledStateSecurity };
}
