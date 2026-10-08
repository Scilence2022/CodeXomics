// Read-only audit probes. Run from the repository root with Node.js.
// These assertions reproduce the audited defects; they are not regression tests.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '../..');
const quietConsole = { log() {}, warn() {}, error() {}, info() {} };

function load(relativePath, extras = {}) {
  const sandbox = {
    module: { exports: {} },
    console: quietConsole,
    window: {},
    Math: Object.create(Math),
    setTimeout,
    ...extras,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, relativePath), 'utf8'), sandbox, {
    filename: relativePath,
    timeout: 5000,
  });
  return { value: sandbox.module.exports, sandbox };
}

async function main() {
  const output = {};
  const ToolsIntegrator = require(path.join(root, 'src/mcp-tools/ToolsIntegrator'));
  let delegated = 0;
  const integrator = new ToolsIntegrator({
    mode: 'tools',
    async executeToolOnClient() {
      delegated++;
      throw new Error('Unexpected delegation');
    },
  });
  const blastParams = { sequence: 'ACGTACGTACGT', blastType: 'blastn', database: 'nt', maxTargets: 1 };
  const oldRandom = Math.random;
  const oldLog = console.log;
  let first;
  let second;
  try {
    console.log = () => {};
    Math.random = () => 0.1;
    first = await integrator.executeTool('blast_search', blastParams);
    Math.random = () => 0.9;
    second = await integrator.executeTool('blast_search', blastParams);
  } finally {
    Math.random = oldRandom;
    console.log = oldLog;
  }
  assert.notEqual(first.results[0].identity, second.results[0].identity);
  assert.equal(delegated, 0);
  output.mcpBlast = {
    identicalInputIdentities: [first.results[0].identity, second.results[0].identity],
    delegatedCalls: delegated,
    simulationFlagPresent: 'isRealResults' in first || 'simulated' in first,
    fixedStatistics: first.statistics,
  };

  const security = load('src/renderer/modules/PluginSecurityValidator.js');
  const plugin = { id: 'audit-plugin', version: '1.0.0', source: { id: 'official' }, category: 'sequence' };
  security.sandbox.Math.random = () => 0.1;
  const accepted = await new security.value().validatePlugin(plugin);
  security.sandbox.Math.random = () => 0.9;
  const rejected = await new security.value().validatePlugin(plugin);
  assert.equal(accepted.approved, true);
  assert.equal(rejected.approved, false);
  security.sandbox.Math.random = () => 0.6;
  const plan = await new security.value({ strictMode: true }).validateInstallPlan({ plugins: [plugin] });
  assert.equal(plan.results[0].approved, false);
  assert.equal(plan.approved, true);
  output.pluginSecurity = {
    samePluginDecisionsWithDifferentRandom: [accepted.approved, rejected.approved],
    rejectedIndividualApprovedPlan: { individual: plan.results[0].approved, plan: plan.approved },
  };

  const seq = require(path.join(root, 'src/mcp-tools/sequence/SequenceTools'));
  const microbe = load('src/renderer/modules/MicrobeGenomicsFunctions.js');
  const unified = load('src/renderer/modules/UnifiedSequenceProcessing.js');
  output.reverseComplement = {
    input: 'ARYN',
    mcp: new seq({}).reverseComplement('ARYN'),
    rendererDefaultFallback: microbe.value.reverseComplement('ARYN'),
    unified: unified.value.reverseComplement('ARYN').sequence,
  };
  assert.equal(output.reverseComplement.unified, 'NRYT');
  assert.notEqual(output.reverseComplement.mcp, output.reverseComplement.unified);
  assert.notEqual(output.reverseComplement.rendererDefaultFallback, output.reverseComplement.unified);

  const blast = load('src/renderer/modules/BlastManager.js');
  const blastManager = Object.create(blast.value.prototype);
  blastManager.app = {};
  blastManager.config = { localDatabases: new Map() };
  blast.sandbox.Math.random = () => 0.1;
  const regionA = await blastManager.getSequenceFromRegion('chr1', 1, 8);
  blast.sandbox.Math.random = () => 0.9;
  const regionB = await blastManager.getSequenceFromRegion('chr1', 1, 8);
  assert.equal(regionA, 'AAAAAAAA');
  assert.equal(regionB, 'CCCCCCCC');
  const tabular = [
    'q1',
    's1',
    '0',
    '4',
    '4',
    '0',
    '1',
    '4',
    '1',
    '4',
    '1e-5',
    '10',
    'subject',
    'ACGT',
    '',
    '100',
    '100',
  ].join('\t');
  blast.sandbox.Math.random = () => 0.15;
  const parsedA = blastManager.parseBlastOutput(tabular, { sequence: 'ACGT', database: 'nt' });
  blast.sandbox.Math.random = () => 0.9;
  const parsedB = blastManager.parseBlastOutput(tabular, { sequence: 'ACGT', database: 'nt' });
  assert.equal(parsedA.hits[0].alignment.subject, 'DDDD');
  assert.equal(parsedB.hits[0].alignment.subject, 'YYYY');
  output.blastFallbacks = {
    sameRegionWithoutChatManager: [regionA, regionB],
    sameTabularRowMissingSubjectSequence: [parsedA.hits[0].alignment.subject, parsedB.hits[0].alignment.subject],
    sourceLabel: parsedA.source,
  };

  const dependency = load('src/renderer/modules/PluginDependencyResolver.js');
  const resolver = new dependency.value({});
  output.pluginDependencies = {
    unknownPluginVersions: await resolver.getAllVersionsForPlugin('audit-real-plugin'),
    inventedExampleVersions: await resolver.getAllVersionsForPlugin('sequence-utils'),
    caretAcceptsZeroMinorUpgrade: resolver.isVersionCompatible('0.2.0', resolver.parseVersionConstraint('^0.1.0')),
  };
  assert.equal(output.pluginDependencies.caretAcceptsZeroMinorUpgrade, true);

  const updater = load('src/renderer/modules/PluginUpdateManager.js', {
    setTimeout: callback => {
      callback();
      return 0;
    },
  });
  const updaterInstance = Object.create(updater.value.prototype);
  let saved = 0;
  updaterInstance.marketplace = {
    installedPlugins: new Map([['audit-plugin', { version: '1.0.0' }]]),
    async saveInstalledPluginsRegistry() {
      saved++;
    },
  };
  await updaterInstance.performUpdate('audit-plugin', { latestVersion: '2.0.0' });
  assert.equal(updaterInstance.marketplace.installedPlugins.get('audit-plugin').version, '2.0.0');
  output.pluginUpdate = {
    resultingRegistryVersion: updaterInstance.marketplace.installedPlugins.get('audit-plugin').version,
    registrySaves: saved,
    providedCapabilities: ['installedPlugins', 'saveInstalledPluginsRegistry'],
  };

  const electronStub = {
    Menu: { buildFromTemplate: template => template, setApplicationMenu() {} },
    dialog: {},
    app: { getName: () => 'CodeXomics' },
    BrowserWindow: {},
    ipcMain: { on() {}, handle() {} },
  };
  const fakeRequire = name => {
    if (name === 'electron') return electronStub;
    if (name === './security-utils' || name === './workspace-host-manager') return {};
    return require(name);
  };
  const windowManagement = load('src/main/window-management.js', {
    require: fakeRequire,
    process,
    __dirname: path.join(root, 'src/main'),
  });
  const menu = load('src/main/menu-builder.js', { require: fakeRequire, process });
  menu.value.setMenuDependencies({ createGenomicDownloadWindow: windowManagement.value.createGenomicDownloadWindow });
  const template = menu.value.createProjectManagerMenu({ webContents: {}, setMenu() {} });
  const downloadItem = template.find(item => item.label === '📥 Download').submenu[0];
  let menuError;
  try {
    downloadItem.click();
  } catch (error) {
    menuError = error.message;
  }
  assert.match(menuError, /createGenomicDownloadWindow is not a function/);
  output.downloadMenu = {
    exportedFactoryType: typeof windowManagement.value.createGenomicDownloadWindow,
    clickError: menuError,
  };

  const Policy = require(path.join(root, 'src/renderer/modules/chat/services/ToolCapabilityPolicy'));
  const actualNames = new Set(Object.values(new Policy().policies).flatMap(policy => policy.tools));
  const contextSource = fs.readFileSync(
    path.join(root, 'src/renderer/modules/chat/services/LLMContextService.js'),
    'utf8'
  );
  output.policyValidator = {
    obsoleteAnchorFound: contextSource.includes('const toolPolicies ='),
    actualUniquePolicyTools: actualNames.size,
  };
  assert.equal(output.policyValidator.obsoleteAnchorFound, false);
  assert.equal(actualNames.size, 195);

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
