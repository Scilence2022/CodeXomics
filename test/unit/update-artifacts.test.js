import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');
const { validateUpdateArtifacts } = require('../../scripts/validate-update-artifacts');
const version = '0.723.0';
let directory;

async function fixture(platform, filenames, fixtureVersion = version) {
  const files = [];
  for (const filename of filenames) {
    const body = Buffer.from(`test installer ${filename}`);
    await fs.writeFile(path.join(directory, filename), body);
    files.push({ url: filename, sha512: createHash('sha512').update(body).digest('base64'), size: body.length });
  }
  const suffix = { mac: '-mac', win: '', linux: '-linux' }[platform];
  const manifest = { version: fixtureVersion, files, path: files[0].url, sha512: files[0].sha512 };
  const manifestFile = path.join(directory, `latest${suffix}.yml`);
  const save = () => fs.writeFile(manifestFile, yaml.dump(manifest));
  await save();
  return { manifest, save, manifestFile };
}

describe('Update release artifact validation', () => {
  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codexomics-update-test-'));
  });
  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('validates all native update artifacts and both macOS architectures', async () => {
    await fixture('mac', [`CodeXomics-${version}-mac-x64.zip`, `CodeXomics-${version}-mac-arm64.zip`]);
    await fs.writeFile(path.join(directory, `CodeXomics-${version}-x64.dmg`), 'dmg');
    await fs.writeFile(path.join(directory, `CodeXomics-${version}-arm64.dmg`), 'dmg');
    await fixture('win', [`CodeXomics-Setup-${version}-x64.exe`]);
    await fixture('linux', [`CodeXomics-${version}-linux-x64.AppImage`, `CodeXomics-${version}-linux-x64.deb`]);
    const results = await validateUpdateArtifacts({ directory, version });
    expect(results.map(result => result.platform)).toEqual(['mac', 'win', 'linux']);
  });

  it('detects a modified installer even when its size is unchanged', async () => {
    const filename = `CodeXomics-Setup-${version}-x64.exe`;
    await fixture('win', [filename]);
    const body = await fs.readFile(path.join(directory, filename));
    body[0] ^= 0xff;
    await fs.writeFile(path.join(directory, filename), body);
    await expect(validateUpdateArtifacts({ directory, version, platform: 'win' })).rejects.toThrow(
      'SHA512 checksum mismatch'
    );
  });

  it.each([
    [
      'version',
      manifest => {
        manifest.version = '0.700.0';
      },
      'expected version',
    ],
    [
      'size',
      manifest => {
        manifest.files[0].size++;
      },
      'size mismatch',
    ],
    [
      'checksum',
      manifest => {
        delete manifest.files[0].sha512;
      },
      'missing SHA512',
    ],
    [
      'traversal',
      manifest => {
        manifest.files[0].url = '../installer.exe';
      },
      'invalid artifact path',
    ],
    [
      'external URL',
      manifest => {
        manifest.files[0].url = 'https://evil.test/installer.exe';
      },
      'invalid artifact path',
    ],
    [
      'legacy path',
      manifest => {
        manifest.path = 'other.exe';
      },
      'legacy path',
    ],
    [
      'legacy checksum',
      manifest => {
        manifest.sha512 = 'wrong';
      },
      'legacy checksum',
    ],
  ])('rejects an invalid %s', async (_name, mutate, message) => {
    const { manifest, save } = await fixture('win', [`CodeXomics-Setup-${version}-x64.exe`]);
    mutate(manifest);
    await save();
    await expect(validateUpdateArtifacts({ directory, version, platform: 'win' })).rejects.toThrow(message);
  });

  it('rejects a portable executable in the Windows update manifest', async () => {
    await fixture('win', [`CodeXomics-Portable-${version}-x64.exe`]);
    await expect(validateUpdateArtifacts({ directory, version, platform: 'win' })).rejects.toThrow('NSIS');
  });

  it('rejects a macOS release missing the other architecture', async () => {
    await fixture('mac', [`CodeXomics-${version}-mac-x64.zip`]);
    await expect(validateUpdateArtifacts({ directory, version, platform: 'mac' })).rejects.toThrow('-arm64.zip');
  });

  it('rejects an incomplete Linux release', async () => {
    await fixture('linux', [`CodeXomics-${version}-linux-x64.AppImage`]);
    await expect(validateUpdateArtifacts({ directory, version, platform: 'linux' })).rejects.toThrow('-x64.deb');
  });

  it('validates a prerelease channel manifest', async () => {
    const prerelease = '0.723.0-beta.1';
    const { manifestFile } = await fixture('win', [`CodeXomics-Setup-${prerelease}-x64.exe`], prerelease);
    await fs.rename(manifestFile, path.join(directory, 'beta.yml'));
    expect(await validateUpdateArtifacts({ directory, version: prerelease, platform: 'win' })).toHaveLength(1);
  });
});
