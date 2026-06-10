#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));
const versionInfo = require(path.join(root, 'src/version.js'));

const semanticVersion = packageJson.version;
const displayVersion = versionInfo.displayVersion;
const docsVersion = `v${semanticVersion}`;
const releaseNotesPath = `docs/release-notes/RELEASE_NOTES_v${versionInfo.major}.${versionInfo.minor}.md`;

const checks = [
  ['README.md', `Current source release: \`${semanticVersion}\``],
  ['README.md', `version-${displayVersion}`],
  ['Agents.md', `# CodeXomics AI Agent Rules - ${docsVersion}`],
  ['Memory.md', `# CodeXomics Project Memory - ${docsVersion}`],
  ['Memory.md', `\`package.json\`: \`${semanticVersion}\``],
  ['CHANGELOG.md', `## [${semanticVersion}]`],
  ['docs/index.md', `version-${semanticVersion}`],
  ['docs/index.md', `\`${semanticVersion}\` (\`${displayVersion}\` display)`],
  ['docs/user-guides/GETTING_STARTED.md', `CodeXomics \`${semanticVersion}\``],
  ['mkdocs.yml', `name: ${docsVersion}`],
  ['mkdocs.yml', `default: ${docsVersion}`],
  [releaseNotesPath, `# CodeXomics ${docsVersion} Release Notes`],
  [releaseNotesPath, `**Application version:** \`${semanticVersion}\``],
];

const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required documentation file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

for (const [relativePath, expectedText] of checks) {
  const content = read(relativePath);
  if (content && !content.includes(expectedText)) {
    errors.push(`${relativePath} is missing: ${expectedText}`);
  }
}

const packageLock = JSON.parse(read('package-lock.json'));
if (packageLock.version !== semanticVersion || packageLock.packages?.['']?.version !== semanticVersion) {
  errors.push('package-lock.json root versions do not match package.json');
}

const mkdocs = read('mkdocs.yml');
for (const match of mkdocs.matchAll(/^[ \t]+-[ \t]+[^:\n]+:[ \t]+([^#\n]+\.md)[ \t]*$/gm)) {
  const navPath = match[1].trim();
  if (!fs.existsSync(path.join(root, 'docs', navPath))) {
    errors.push(`mkdocs.yml nav target does not exist: docs/${navPath}`);
  }
}

const currentDocs = [
  'README.md',
  'Agents.md',
  'Memory.md',
  'docs/index.md',
  'docs/user-guides/GETTING_STARTED.md',
  'docs/user-guides/FAQ.md',
  'docs/user-guides/TROUBLESHOOTING_GUIDE.md',
  'docs/user-guides/USER_GUIDE.md',
  'docs/developer-guides/DEVELOPER_GUIDE.md',
  'docs/developer-guides/build-instructions.md',
  'docs/developer-guides/PLUGIN_DEVELOPMENT_GUIDE.md',
  'mkdocs.yml',
].map(relativePath => [relativePath, read(relativePath)]);

const staleVersions = ['0.7.0-beta', 'v0.7beta', 'Electron-42.4.0'];
for (const [relativePath, content] of currentDocs) {
  for (const staleVersion of staleVersions) {
    if (content.includes(staleVersion)) {
      errors.push(`${relativePath} still contains stale release text: ${staleVersion}`);
    }
  }
}

if (errors.length > 0) {
  console.error('Documentation validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Documentation metadata is consistent for ${semanticVersion} (${displayVersion}).`);
console.log(`Validated ${checks.length} release markers and all MkDocs navigation targets.`);
