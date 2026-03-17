#!/usr/bin/env node

/**
 * Version Update Script for CodeXomics
 *
 * This script ensures that the version in package.json stays in sync
 * with the unified version.js file.
 *
 * Usage: node scripts/update-version.js
 */

const fs = require('fs');
const path = require('path');

// Import version info from the unified version file
const versionPath = path.join(__dirname, '../src/version.js');
const packagePath = path.join(__dirname, '../package.json');

try {
  // Read the version.js file
  const versionContent = fs.readFileSync(versionPath, 'utf8');

  // Extract version components using regex
  const majorMatch = versionContent.match(/const VERSION_MAJOR = (\d+);/);
  const minorMatch = versionContent.match(/const VERSION_MINOR = (\d+);/);
  const patchMatch = versionContent.match(/const VERSION_PATCH = (\d+);/);
  const prereleaseMatch = versionContent.match(/const VERSION_PRERELEASE = '(.+)';/);

  if (!majorMatch || !minorMatch || !patchMatch) {
    throw new Error('Could not extract version components from version.js');
  }

  const major = majorMatch[1];
  const minor = minorMatch[1];
  const patch = patchMatch[1];
  const prerelease = prereleaseMatch ? prereleaseMatch[1] : null;

  // Build valid semantic version for package.json: X.YYY.Z-prerelease
  const versionString = prerelease ? `${major}.${minor}.${patch}-${prerelease}` : `${major}.${minor}.${patch}`;

  console.log(`📋 Unified version: ${versionString}`);

  // Read package.json
  const packageContent = fs.readFileSync(packagePath, 'utf8');
  const packageData = JSON.parse(packageContent);

  // Update version in package.json
  const oldVersion = packageData.version;
  packageData.version = versionString;

  // Write updated package.json
  fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');

  console.log(`✅ Updated package.json version: ${oldVersion} → ${versionString}`);

  // Also update the build title in package.json
  if (packageData.build && packageData.build.dmg) {
    packageData.build.dmg.title = `\${productName} \${version}`;
    fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n');
    console.log(`✅ Updated DMG title template`);
  }

  // Summary
  console.log('\n📄 Version Update Summary:');
  console.log(`   • Source: src/version.js`);
  console.log(`   • Version: ${versionString}`);
  console.log(`   • Updated: package.json`);
  console.log(`   • Status: ✅ Synchronized`);
} catch (error) {
  console.error('❌ Error updating version:', error.message);
  process.exit(1);
}
