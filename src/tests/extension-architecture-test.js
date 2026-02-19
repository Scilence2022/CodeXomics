/**
 * Extension Architecture Verification Test
 *
 * This test verifies that the VS Code-inspired extension architecture
 * is properly integrated and functioning correctly.
 *
 * @version 1.0.0
 */

class ExtensionArchitectureTest {
  constructor() {
    this.results = [];
    this.passCount = 0;
    this.failCount = 0;
  }

  /**
   * Run all verification tests
   * @returns {Object} Test results
   */
  async runAllTests() {
    console.log('Starting Extension Architecture Verification Tests...\n');

    // Core module tests
    await this.testDisposableModule();
    await this.testExtensionContextModule();
    await this.testExtensionHostModule();
    await this.testExtensionManifestModule();
    await this.testContributionRegistryModule();
    await this.testActivationEventsModule();
    await this.testCommandRegistryModule();
    await this.testExtensionServiceModule();

    // Integration tests
    await this.testPluginManagerIntegration();
    await this.testEnhancedPluginExample();

    this.printSummary();

    return {
      passed: this.passCount,
      failed: this.failCount,
      total: this.results.length,
      results: this.results,
    };
  }

  /**
   * Test helper method
   */
  async test(name, testFn) {
    try {
      await testFn();
      this.passCount++;
      this.results.push({ name, status: 'PASS' });
      console.log(`✅ ${name}`);
    } catch (error) {
      this.failCount++;
      this.results.push({ name, status: 'FAIL', error: error.message });
      console.log(`❌ ${name}: ${error.message}`);
    }
  }

  /**
   * Assert helper
   */
  assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  // ==================== CORE MODULE TESTS ====================

  async testDisposableModule() {
    console.log('\n--- Disposable Module Tests ---');

    await this.test('Disposable class exists', () => {
      this.assert(typeof Disposable !== 'undefined', 'Disposable class not found');
    });

    await this.test('DisposableStore class exists', () => {
      this.assert(typeof DisposableStore !== 'undefined', 'DisposableStore class not found');
    });

    await this.test('Disposable.create() works', async () => {
      let disposed = false;
      const disposable = Disposable.create(() => {
        disposed = true;
      });
      await disposable.dispose();
      this.assert(disposed, 'Dispose callback not called');
    });

    await this.test('DisposableStore manages multiple disposables', async () => {
      const store = new DisposableStore();
      let count = 0;
      store.add(Disposable.create(() => count++));
      store.add(Disposable.create(() => count++));
      await store.dispose();
      this.assert(count === 2, 'Not all disposables were disposed');
    });
  }

  async testExtensionContextModule() {
    console.log('\n--- ExtensionContext Module Tests ---');

    await this.test('ExtensionContext class exists', () => {
      this.assert(typeof ExtensionContext !== 'undefined', 'ExtensionContext class not found');
    });

    await this.test('ExtensionContext can be instantiated', () => {
      const context = new ExtensionContext({
        extension: { id: 'test', name: 'Test', version: '1.0.0' },
        extensionPath: '/test',
      });
      this.assert(context.extensionPath === '/test', 'Extension path not set');
    });

    await this.test('ExtensionContext provides subscriptions', () => {
      const context = new ExtensionContext({
        extension: { id: 'test', name: 'Test', version: '1.0.0' },
      });
      this.assert(Array.isArray(context.subscriptions), 'Subscriptions not available');
    });

    await this.test('ExtensionContext provides workspaceState', () => {
      const context = new ExtensionContext({
        extension: { id: 'test', name: 'Test', version: '1.0.0' },
      });
      this.assert(context.workspaceState !== undefined, 'WorkspaceState not available');
      this.assert(typeof context.workspaceState.get === 'function', 'workspaceState.get not a function');
    });

    await this.test('ExtensionContext provides globalState', () => {
      const context = new ExtensionContext({
        extension: { id: 'test', name: 'Test', version: '1.0.0' },
      });
      this.assert(context.globalState !== undefined, 'GlobalState not available');
    });
  }

  async testExtensionHostModule() {
    console.log('\n--- ExtensionHost Module Tests ---');

    await this.test('ExtensionHost class exists', () => {
      this.assert(typeof ExtensionHost !== 'undefined', 'ExtensionHost class not found');
    });

    await this.test('ExtensionHost can be instantiated', () => {
      const host = new ExtensionHost({ sandboxed: true });
      this.assert(host !== undefined, 'ExtensionHost instantiation failed');
    });

    await this.test('ExtensionHost provides sandboxed execution', () => {
      const host = new ExtensionHost({ sandboxed: true });
      this.assert(typeof host.executeInSandbox === 'function', 'executeInSandbox not available');
    });
  }

  async testExtensionManifestModule() {
    console.log('\n--- ExtensionManifest Module Tests ---');

    await this.test('ExtensionManifest class exists', () => {
      this.assert(typeof ExtensionManifest !== 'undefined', 'ExtensionManifest class not found');
    });

    await this.test('ManifestBuilder class exists', () => {
      this.assert(typeof ManifestBuilder !== 'undefined', 'ManifestBuilder class not found');
    });

    await this.test('ManifestBuilder creates valid manifest', () => {
      const builder = new ManifestBuilder();
      const manifest = builder
        .name('test-extension')
        .displayName('Test Extension')
        .version('1.0.0')
        .description('Test description')
        .addCommand('test.command', 'Test Command')
        .build();

      this.assert(manifest.name === 'test-extension', 'Manifest name incorrect');
      this.assert(manifest.contributes.commands.length === 1, 'Command not added');
    });

    await this.test('ExtensionManifest validates correctly', () => {
      const manifest = new ExtensionManifest({
        name: 'test',
        displayName: 'Test',
        version: '1.0.0',
        description: 'Test',
      });
      const result = manifest.validate();
      this.assert(result.valid, 'Valid manifest marked as invalid');
    });
  }

  async testContributionRegistryModule() {
    console.log('\n--- ContributionRegistry Module Tests ---');

    await this.test('ContributionRegistry class exists', () => {
      this.assert(typeof ContributionRegistry !== 'undefined', 'ContributionRegistry class not found');
    });

    await this.test('ContributionRegistry can register contributions', () => {
      const registry = new ContributionRegistry();
      registry.registerContributions('test-ext', {
        commands: [{ command: 'test.cmd', title: 'Test' }],
      });
      const contribs = registry.getContributions('test-ext');
      this.assert(contribs !== undefined, 'Contributions not registered');
    });

    await this.test('ContributionRegistry can query by type', () => {
      const registry = new ContributionRegistry();
      registry.registerContributions('ext1', {
        functions: { fn1: { name: 'fn1', description: 'Test' } },
      });
      const functions = registry.getContributionsByType('functions');
      this.assert(functions.length > 0, 'Functions not queryable');
    });

    await this.test('ContributionRegistry provides stats', () => {
      const registry = new ContributionRegistry();
      const stats = registry.getStats();
      this.assert(typeof stats.extensionCount === 'number', 'Stats not available');
    });
  }

  async testActivationEventsModule() {
    console.log('\n--- ActivationEventsService Module Tests ---');

    await this.test('ActivationEventsService class exists', () => {
      this.assert(typeof ActivationEventsService !== 'undefined', 'ActivationEventsService class not found');
    });

    await this.test('ActivationEventsService can register extensions', () => {
      const service = new ActivationEventsService();
      service.registerExtension('test-ext', {
        activationEvents: ['onCommand:test.cmd'],
      });
      this.assert(service.isEventRegistered('onCommand:test.cmd'), 'Event not registered');
    });

    await this.test('ActivationEventsService triggers activation', async () => {
      const service = new ActivationEventsService();
      let activated = false;
      service.setActivationHandler(() => {
        activated = true;
      });
      service.registerExtension('test-ext', {
        activationEvents: ['onCommand:test.trigger'],
      });
      await service.triggerEvent('onCommand:test.trigger');
      this.assert(activated, 'Activation not triggered');
    });
  }

  async testCommandRegistryModule() {
    console.log('\n--- CommandRegistry Module Tests ---');

    await this.test('CommandRegistry class exists', () => {
      this.assert(typeof CommandRegistry !== 'undefined', 'CommandRegistry class not found');
    });

    await this.test('CommandRegistry can register commands', () => {
      const registry = new CommandRegistry();
      const disposable = registry.registerCommand('test.cmd', () => 'result');
      this.assert(disposable !== undefined, 'Command registration failed');
      this.assert(registry.hasCommand('test.cmd'), 'Command not found after registration');
    });

    await this.test('CommandRegistry can execute commands', async () => {
      const registry = new CommandRegistry();
      registry.registerCommand('test.exec', (a, b) => a + b);
      const result = await registry.executeCommand('test.exec', 2, 3);
      this.assert(result === 5, 'Command execution returned wrong result');
    });

    await this.test('CommandRegistry throws on unknown command', async () => {
      const registry = new CommandRegistry();
      let threw = false;
      try {
        await registry.executeCommand('nonexistent.cmd');
      } catch (e) {
        threw = true;
      }
      this.assert(threw, 'Should throw on unknown command');
    });
  }

  async testExtensionServiceModule() {
    console.log('\n--- ExtensionService Module Tests ---');

    await this.test('ExtensionService class exists', () => {
      this.assert(typeof ExtensionService !== 'undefined', 'ExtensionService class not found');
    });

    await this.test('ExtensionService can be instantiated', () => {
      const service = new ExtensionService();
      this.assert(service !== undefined, 'ExtensionService instantiation failed');
    });

    await this.test('ExtensionService provides unified API', async () => {
      const service = new ExtensionService();
      await service.initialize();
      this.assert(typeof service.registerExtension === 'function', 'registerExtension not available');
      this.assert(typeof service.getExtension === 'function', 'getExtension not available');
      this.assert(typeof service.dispose === 'function', 'dispose not available');
    });
  }

  // ==================== INTEGRATION TESTS ====================

  async testPluginManagerIntegration() {
    console.log('\n--- PluginManagerV2 Integration Tests ---');

    await this.test('PluginManagerV2 class exists', () => {
      this.assert(typeof PluginManagerV2 !== 'undefined', 'PluginManagerV2 class not found');
    });

    await this.test('PluginManagerV2 has new architecture option', () => {
      const pm = new PluginManagerV2({}, null, { enableNewArchitecture: true });
      this.assert(pm.options.enableNewArchitecture === true, 'New architecture option not set');
    });

    await this.test('PluginManagerV2 creates extension contexts', async () => {
      const pm = new PluginManagerV2({}, null, {
        enableNewArchitecture: true,
        enableMarketplace: false,
      });
      await pm.initialize();
      this.assert(pm.extensionContexts instanceof Map, 'Extension contexts not initialized');
    });
  }

  async testEnhancedPluginExample() {
    console.log('\n--- Enhanced Plugin Example Tests ---');

    await this.test('BiologicalNetworksExtension exists', () => {
      this.assert(
        typeof BiologicalNetworksExtension !== 'undefined' || typeof window.BiologicalNetworksExtension !== 'undefined',
        'BiologicalNetworksExtension not found'
      );
    });

    await this.test('BiologicalNetworksManifest has required fields', () => {
      const manifest =
        typeof BiologicalNetworksManifest !== 'undefined'
          ? BiologicalNetworksManifest
          : window.BiologicalNetworksManifest;

      this.assert(manifest.name, 'Manifest missing name');
      this.assert(manifest.version, 'Manifest missing version');
      this.assert(manifest.contributes, 'Manifest missing contributes');
      this.assert(manifest.activationEvents, 'Manifest missing activationEvents');
    });

    await this.test('BiologicalNetworksManifest has functions', () => {
      const manifest =
        typeof BiologicalNetworksManifest !== 'undefined'
          ? BiologicalNetworksManifest
          : window.BiologicalNetworksManifest;

      const functions = manifest.contributes?.functions;
      this.assert(functions, 'No functions in manifest');
      this.assert(functions.buildProteinInteractionNetwork, 'Missing buildProteinInteractionNetwork');
      this.assert(functions.buildGeneRegulatoryNetwork, 'Missing buildGeneRegulatoryNetwork');
    });
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total: ${this.results.length}`);
    console.log(`Passed: ${this.passCount} ✅`);
    console.log(`Failed: ${this.failCount} ❌`);
    console.log(`Success Rate: ${((this.passCount / this.results.length) * 100).toFixed(1)}%`);
    console.log('='.repeat(50));

    if (this.failCount > 0) {
      console.log('\nFailed Tests:');
      this.results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
  }
}

/**
 * Quick verification - checks if modules are loadable
 */
function quickVerification() {
  const modules = [
    'Disposable',
    'DisposableStore',
    'ExtensionContext',
    'ExtensionHost',
    'ExtensionManifest',
    'ManifestBuilder',
    'ContributionRegistry',
    'ActivationEventsService',
    'CommandRegistry',
    'ExtensionService',
  ];

  console.log('Quick Module Verification:');
  console.log('-'.repeat(40));

  const results = modules.map(name => {
    const exists =
      typeof window !== 'undefined' ? typeof window[name] !== 'undefined' : typeof global[name] !== 'undefined';
    console.log(`${exists ? '✅' : '❌'} ${name}`);
    return { name, exists };
  });

  const loaded = results.filter(r => r.exists).length;
  console.log('-'.repeat(40));
  console.log(`Modules loaded: ${loaded}/${modules.length}`);

  return results;
}

/**
 * Run tests
 */
async function runVerification() {
  // Quick check first
  console.log('=== QUICK VERIFICATION ===\n');
  quickVerification();

  console.log('\n=== FULL TEST SUITE ===\n');
  const tester = new ExtensionArchitectureTest();
  return await tester.runAllTests();
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ExtensionArchitectureTest,
    quickVerification,
    runVerification,
  };
} else if (typeof window !== 'undefined') {
  window.ExtensionArchitectureTest = ExtensionArchitectureTest;
  window.quickVerification = quickVerification;
  window.runVerification = runVerification;
}
