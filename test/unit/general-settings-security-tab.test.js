import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const readSource = relativePath => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('General Settings security tab', () => {
  it('adds Security as a first-class General Settings tab', () => {
    const html = readSource('src/renderer/index.html');

    expect(html).toContain('data-tab="security"');
    expect(html).toContain('id="security-tab"');
    expect(html).toContain('Renderer Node.js Guard');
    expect(html).toContain('File Permission Broker');
    expect(html).toContain('HTML Sanitization');
  });

  it('defines persistent security settings in ConfigManager defaults', () => {
    const source = readSource('src/renderer/modules/ConfigManager.js');

    expect(source).toContain("securityProfile: 'balanced'");
    expect(source).toContain('disableAiSecurityRestrictions: false');
    expect(source).toContain('warnBeforeAiFileWrites: true');
    expect(source).toContain('warnBeforeInternetDownloads: true');
    expect(source).toContain('showSecurityNotifications: true');
    expect(source).toContain('enablePluginSecurityValidation: false');
    expect(source).toContain('enablePluginSandboxMode: true');
    expect(source).toContain('blockUntrustedPluginSources: true');
  });

  it('loads, saves, and applies security settings through GeneralSettingsManager', () => {
    const source = readSource('src/renderer/modules/GeneralSettingsManager.js');

    expect(source).toContain('securityProfile');
    expect(source).toContain('disableAiSecurityRestrictions');
    expect(source).toContain('warnBeforeAiFileWrites');
    expect(source).toContain('warnBeforeInternetDownloads');
    expect(source).toContain('showSecurityNotifications');
    expect(source).toContain('enablePluginSecurityValidation');
    expect(source).toContain('enablePluginSandboxMode');
    expect(source).toContain('blockUntrustedPluginSources');
    expect(source).toContain('applySecuritySettings()');
    expect(source).toContain('securitySettingsChanged');
    expect(source).toContain('pluginManagerV2.options.enableSecurityValidation');
  });
});
