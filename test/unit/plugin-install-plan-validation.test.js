import { describe, expect, it, vi } from 'vitest';
import { loadScript } from '../helpers/load-script';
const { exported: Validator } = loadScript('src/renderer/modules/PluginSecurityValidator.js');
describe('plugin installation plan approval', () => {
  it.each(['low', 'medium', 'high', 'critical'])('blocks an individually rejected %s plugin', async severity => {
    const validator = new Validator({ strictMode: true });
    vi.spyOn(validator, 'validatePlugin').mockResolvedValue({
      pluginId: 'refused',
      approved: false,
      severity,
      reason: 'Refused',
      issues: [],
      riskScore: 0,
    });
    await expect(validator.validateInstallPlan({ plugins: [{ id: 'refused' }] })).rejects.toThrow(
      'Security validation failed'
    );
    expect(validator.stats.blockedPlugins).toBe(1);
  });
  it('fails closed on a validation exception', async () => {
    const validator = new Validator();
    vi.spyOn(validator, 'validatePlugin').mockRejectedValue(new Error('Inspection failed'));
    await expect(validator.validateInstallPlan({ plugins: [{ id: 'missing' }] })).rejects.toThrow('critical issues');
  });
  it('approves a plan only when every plugin was approved', async () => {
    const validator = new Validator();
    vi.spyOn(validator, 'validatePlugin').mockResolvedValue({ approved: true, issues: [], riskScore: 0 });
    expect(await validator.validateInstallPlan({ plugins: [{ id: 'one' }, { id: 'two' }] })).toMatchObject({
      approved: true,
      summary: { approvedPlugins: 2 },
    });
  });
});
