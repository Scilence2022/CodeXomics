#!/usr/bin/env node

/**
 * Version Validation Script for CodeXomics
 *
 * This script validates that all version references across the codebase
 * are consistent and using the unified version system.
 *
 * Usage: node scripts/validate-versions.js
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Load version info from unified version file
const versionPath = path.join(__dirname, '../src/version.js');
const packagePath = path.join(__dirname, '../package.json');
const readmePath = path.join(__dirname, '../README.md');

function loadVersionInfo() {
  try {
    const versionContent = fs.readFileSync(versionPath, 'utf8');

    // Extract version components
    const majorMatch = versionContent.match(/const VERSION_MAJOR = (\d+);/);
    const minorMatch = versionContent.match(/const VERSION_MINOR = (\d+);/);
    const patchMatch = versionContent.match(/const VERSION_PATCH = (\d+);/);
    const prereleaseMatch = versionContent.match(/const VERSION_PRERELEASE = '(.+)';/);

    if (!majorMatch || !minorMatch || !patchMatch) {
      throw new Error('Could not extract version components from version.js');
    }

    const major = parseInt(majorMatch[1]);
    const minor = parseInt(minorMatch[1]);
    const patch = parseInt(patchMatch[1]);
    const prerelease = prereleaseMatch ? prereleaseMatch[1] : null;

    return {
      major,
      minor,
      patch,
      prerelease,
      fullVersion: prerelease ? `${major}.${minor}.${patch}-${prerelease}` : `${major}.${minor}.${patch}`,
      displayVersion: prerelease ? `v${major}.${minor}${prerelease}` : `v${major}.${minor}`,
    };
  } catch (error) {
    console.error('❌ Error loading version info:', error.message);
    return null;
  }
}

function validatePackageJson(versionInfo) {
  try {
    const packageContent = fs.readFileSync(packagePath, 'utf8');
    const packageData = JSON.parse(packageContent);

    if (packageData.version !== versionInfo.fullVersion) {
      console.error(`❌ package.json version mismatch: ${packageData.version} !== ${versionInfo.fullVersion}`);
      return false;
    }

    console.log(`✅ package.json version: ${packageData.version}`);
    return true;
  } catch (error) {
    console.error('❌ Error validating package.json:', error.message);
    return false;
  }
}

function validateReadme(versionInfo) {
  try {
    const readmeContent = fs.readFileSync(readmePath, 'utf8');

    // Check for version references in README
    const versionPattern = new RegExp(`${versionInfo.displayVersion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g');
    const matches = readmeContent.match(versionPattern);

    if (!matches || matches.length === 0) {
      console.warn(`⚠️  README.md may not contain current version: ${versionInfo.displayVersion}`);
      return false;
    }

    console.log(`✅ README.md contains version: ${versionInfo.displayVersion} (${matches.length} occurrences)`);
    return true;
  } catch (error) {
    console.error('❌ Error validating README.md:', error.message);
    return false;
  }
}

function checkHardcodedVersions() {
  return new Promise(resolve => {
    // Search for hardcoded version patterns
    const searchPatterns = [
      'v0\\.[0-9]\\.[0-9]',
      'Version [0-9]\\.[0-9]\\.[0-9]',
      'version.*[0-9]\\.[0-9]\\.[0-9].*beta',
      'CodeXomics v[0-9]\\.[0-9]',
    ];

    const command = `grep -r "${searchPatterns.join('\\|')}" --include="*.js" --include="*.html" --include="*.md" src/ README.md | grep -v "VERSION_INFO" | grep -v "about-version" | grep -v "@version" | grep -v "# CodeXomics" | head -10`;

    exec(command, (error, stdout, stderr) => {
      if (stdout && stdout.trim()) {
        console.warn('⚠️  Potential hardcoded version references found:');
        console.warn(stdout);
        resolve(false);
      } else {
        console.log('✅ No hardcoded version references found');
        resolve(true);
      }
    });
  });
}

function validateVersionInfoUsage() {
  return new Promise(resolve => {
    const command = `grep -r "VERSION_INFO" --include="*.js" --include="*.html" src/ | wc -l`;

    exec(command, (error, stdout, stderr) => {
      const count = parseInt(stdout.trim()) || 0;

      if (count > 0) {
        console.log(`✅ VERSION_INFO is used in ${count} locations`);
        resolve(true);
      } else {
        console.warn('⚠️  VERSION_INFO is not being used in the codebase');
        resolve(false);
      }
    });
  });
}

async function main() {
  console.log('🔍 Validating version consistency...\n');

  // Load version info
  const versionInfo = loadVersionInfo();
  if (!versionInfo) {
    process.exit(1);
  }

  console.log(`📋 Unified version: ${versionInfo.fullVersion}`);
  console.log(`📋 Display version: ${versionInfo.displayVersion}\n`);

  let allValid = true;

  // Validate package.json
  if (!validatePackageJson(versionInfo)) {
    allValid = false;
  }

  // Validate README.md
  if (!validateReadme(versionInfo)) {
    allValid = false;
  }

  // Check for hardcoded versions
  if (!(await checkHardcodedVersions())) {
    allValid = false;
  }

  // Validate VERSION_INFO usage
  if (!(await validateVersionInfoUsage())) {
    allValid = false;
  }

  // Summary
  console.log('\n📄 Version Validation Summary:');
  console.log(`   • Unified version: ${versionInfo.fullVersion}`);
  console.log(`   • Display version: ${versionInfo.displayVersion}`);
  console.log(`   • Status: ${allValid ? '✅ All validations passed' : '❌ Some validations failed'}`);

  if (!allValid) {
    console.log('\n💡 To fix version issues, run: npm run version-sync');
    process.exit(1);
  } else {
    console.log('\n🎉 All version references are consistent!');
  }
}

main().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
