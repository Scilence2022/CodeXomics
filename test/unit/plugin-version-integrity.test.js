import { describe, it, expect } from 'vitest';
import { loadScript } from '../helpers/load-script';
const { exported: Resolver } = loadScript('src/renderer/modules/PluginDependencyResolver.js');
const resolver = () =>
  new Resolver({
    searchPlugins: async () => [
      { id: 'dep', version: '2.0.0', downloadUrl: '/2/download' },
      { id: 'dep', version: '0.2.4', downloadUrl: '/0/download' },
    ],
  });
describe('plugin package and version integrity', () => {
  it.each([
    ['0.3.0', '^0.2.3', false],
    ['0.2.4', '^0.2.3', true],
    ['0.0.4', '^0.0.3', false],
    ['1.0.0-beta.1', '^1.0.0', false],
    ['1.5.0', '>=1.0.0 <2.0.0', true],
  ])('matches %s against %s', (version, range, matches) => {
    const r = resolver();
    expect(r.isVersionCompatible(version, r.parseVersionConstraint(range))).toBe(matches);
  });
  it('orders prereleases below releases', () => expect(resolver().compareVersions('1.0.0-beta.1', '1.0.0')).toBe(-1));
  it('uses actual compatible metadata', async () => {
    const result = await resolver().findCompatiblePlugin({ id: 'dep', version: '^0.2.3' });
    expect(result.version).toBe('0.2.4');
    expect(result.downloadUrl).toBe('/0/download');
  });
  it('rejects unavailable versions', async () => {
    await expect(resolver().findCompatiblePlugin({ id: 'dep', version: '^1.0.0' })).rejects.toThrow('No available');
  });
  it('uses edge ranges and preserves package identity in a diamond graph', async () => {
    const packages = [
      { id: 'dep', version: '1.5.0', downloadUrl: '/1.5', dependencies: [] },
      { id: 'left', version: '1.0.0', dependencies: [{ id: 'dep', version: '^1.0.0' }] },
      { id: 'right', version: '1.0.0', dependencies: [{ id: 'dep', version: '>=1.4.0 <2.0.0' }] },
    ];
    const r = new Resolver({ searchPlugins: async () => packages });
    const plan = await r.createInstallPlan({
      id: 'root',
      version: '1.0.0',
      dependencies: [
        { id: 'left', version: '*' },
        { id: 'right', version: '*' },
      ],
    });
    expect(plan.plugins.map(p => p.id)).toEqual(['dep', 'left', 'right', 'root']);
    expect(plan.plugins[0].downloadUrl).toBe('/1.5');
    expect(packages[0].isDependency).toBeUndefined();
  });
  it('rejects incompatible constraints rather than picking highest', () => {
    expect(() =>
      resolver().resolveVersionConflict('dep', [
        { version: '1.0.0', constraint: '^1.0.0' },
        { version: '2.0.0', constraint: '^2.0.0' },
      ])
    ).toThrow('satisfies all');
  });
});
