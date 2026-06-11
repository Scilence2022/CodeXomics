'use strict';

const asar = require('@electron/asar');
const fs = require('fs/promises');
const fsSync = require('fs');
const os = require('os');
const path = require('path');

const runtimePackagesToPin = ['call-bind-apply-helpers'];

exports.default = async function afterPack(context) {
  const { appOutDir, packager } = context;
  const asarPath = await findAppAsar(appOutDir);

  if (!asarPath) {
    console.log('[after-pack] No app.asar found; skipping runtime dependency pinning.');
    return;
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codexomics-after-pack-'));
  const extractedDir = path.join(tempDir, 'app');

  try {
    asar.extractAll(asarPath, extractedDir);
    await fs.mkdir(path.join(extractedDir, 'node_modules'), { recursive: true });

    for (const packageName of runtimePackagesToPin) {
      const sourceDir = path.join(packager.projectDir, 'node_modules', packageName);
      const destinationDir = path.join(extractedDir, 'node_modules', packageName);

      if (!fsSync.existsSync(path.join(sourceDir, 'package.json'))) {
        throw new Error(`[after-pack] Missing runtime dependency source: ${sourceDir}`);
      }

      await fs.rm(destinationDir, { recursive: true, force: true });
      await fs.cp(sourceDir, destinationDir, { recursive: true });
    }

    await fs.rm(asarPath, { force: true });
    await asar.createPackage(extractedDir, asarPath);

    console.log(
      `[after-pack] Pinned runtime dependencies in ${path.relative(
        packager.projectDir,
        asarPath
      )}: ${runtimePackagesToPin.join(', ')}`
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

async function findAppAsar(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isFile() && entry.name === 'app.asar') {
      return fullPath;
    }

    if (entry.isDirectory() && entry.name !== 'app.asar.unpacked') {
      const foundPath = await findAppAsar(fullPath);
      if (foundPath) {
        return foundPath;
      }
    }
  }

  return null;
}
