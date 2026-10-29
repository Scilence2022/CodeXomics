'use strict';

const fs = require('fs/promises');
const { createReadStream } = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const yaml = require('js-yaml');
const semver = require('semver');

const TARGETS = {
  mac: { suffix: '-mac', required: ['-x64.zip', '-arm64.zip'], installers: ['-x64.dmg', '-arm64.dmg'] },
  win: { suffix: '', required: ['-x64.exe'], installers: [] },
  linux: { suffix: '-linux', required: ['-x64.AppImage', '-x64.deb'], installers: [] },
};

async function hashFile(file) {
  const hash = createHash('sha512');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('base64');
}

async function validateUpdateArtifacts({
  directory = 'dist',
  platform = 'all',
  version = require('../package.json').version,
} = {}) {
  const targets = platform === 'all' ? Object.entries(TARGETS) : [[platform, TARGETS[platform]]];
  if (targets.some(([, target]) => !target)) throw new Error(`Unknown platform: ${platform}`);
  if (!semver.valid(version)) throw new Error(`Invalid release version: ${version}`);
  const channel = semver.prerelease(version)?.[0] || 'latest';
  const checked = [];
  const names = await fs.readdir(directory);
  for (const [name, target] of targets) {
    const manifestName = `${channel}${target.suffix}.yml`;
    const manifest = yaml.load(await fs.readFile(path.join(directory, manifestName), 'utf8'), {
      schema: yaml.JSON_SCHEMA,
    });
    if (manifest?.version !== version) throw new Error(`${manifestName}: expected version ${version}`);
    if (!Array.isArray(manifest.files) || !manifest.files.length) {
      throw new Error(`${manifestName}: missing update files`);
    }
    const files = [];
    for (const file of manifest.files) {
      const filename = typeof file.url === 'string' ? decodeURIComponent(file.url) : '';
      if (
        !filename ||
        filename.includes('/') ||
        filename.includes('\\') ||
        filename === '..' ||
        !filename.includes(version)
      ) {
        throw new Error(`${manifestName}: invalid artifact path ${filename}`);
      }
      if (!/^[A-Za-z0-9+/]{86}==$/.test(file.sha512 || '')) throw new Error(`${filename}: missing SHA512 checksum`);
      const artifact = path.join(directory, filename);
      const stat = await fs.stat(artifact);
      if (!stat.isFile() || stat.size === 0 || (file.size !== undefined && stat.size !== file.size)) {
        throw new Error(`${filename}: artifact size mismatch`);
      }
      if ((await hashFile(artifact)) !== file.sha512) throw new Error(`${filename}: SHA512 checksum mismatch`);
      files.push(filename);
    }
    for (const suffix of target.required) {
      if (!files.some(file => file.endsWith(suffix))) {
        throw new Error(`${manifestName}: missing ${suffix} update artifact`);
      }
    }
    if (name === 'win' && files.some(file => !file.startsWith('CodeXomics-Setup-'))) {
      throw new Error(
        `${manifestName}: Windows updates must reference the NSIS installer, not the portable executable`
      );
    }
    for (const suffix of target.installers) {
      if (!names.some(file => file.includes(version) && file.endsWith(suffix))) {
        throw new Error(`${manifestName}: missing ${suffix} installer`);
      }
    }
    if (manifest.path && !files.includes(decodeURIComponent(manifest.path))) {
      throw new Error(`${manifestName}: legacy path does not match files`);
    }
    if (manifest.sha512 && !manifest.files.some(file => file.sha512 === manifest.sha512)) {
      throw new Error(`${manifestName}: legacy checksum does not match files`);
    }
    checked.push({ platform: name, manifest: manifestName, files });
  }
  return checked;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = { '--dir': 'directory', '--platform': 'platform', '--version': 'version' }[args[i]];
    if (!key || !args[i + 1]) {
      throw new Error(
        'Usage: npm run updates:validate -- [--dir dist] [--platform all|mac|win|linux] [--version x.y.z]'
      );
    }
    options[key] = args[i + 1];
  }
  validateUpdateArtifacts(options)
    .then(results => {
      for (const result of results) {
        console.log(`Validated ${result.manifest}: ${result.files.length} artifacts, version and SHA512 checks passed`);
      }
    })
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

module.exports = { validateUpdateArtifacts };
