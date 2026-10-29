'use strict';

const fs = require('fs/promises');
const path = require('path');
const { execFileSync } = require('child_process');
const { validateUpdateArtifacts } = require('./validate-update-artifacts');

async function upload() {
  const version = require('../package.json').version;
  const tag = process.env.RELEASE_TAG;
  if (tag !== `v${version}`) throw new Error('Release tag must match package.json version');
  await validateUpdateArtifacts();
  const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  // Listing distinguishes a missing draft from an authentication failure.
  const releases = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/${process.env.GH_REPO}/releases`])).flat();
  const existing = releases.find(release => release.tag_name === tag);
  if (existing && !existing.draft) throw new Error('Refusing to change an already published release');
  if (!existing) {
    const args = [
      'release',
      'create',
      tag,
      '--verify-tag',
      '--draft',
      '--title',
      `CodeXomics ${tag}`,
      '--generate-notes',
    ];
    if (require('semver').prerelease(version)) args.push('--prerelease');
    gh(args);
  }
  const files = (await fs.readdir('dist')).filter(
    name => /\.(yml|dmg|zip|exe|AppImage|deb|blockmap)$/.test(name) && !name.startsWith('builder-')
  );
  gh(['release', 'upload', tag, ...files.map(file => path.join('dist', file)), '--clobber']);
  console.log(`Uploaded verified update artifacts to draft ${tag}. Publish only after native upgrade QA.`);
}

if (require.main === module) {
  upload().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
