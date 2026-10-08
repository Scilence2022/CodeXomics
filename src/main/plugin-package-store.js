const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { inspectPluginPackage } = require('./plugin-package-inspector');

async function replaceDirectory(staged, target) {
  const previous = `${target}.previous-${crypto.randomUUID()}`;
  let moved = false;
  try {
    try {
      await fs.rename(target, previous);
      moved = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await fs.rename(staged, target);
  } catch (error) {
    if (moved) await fs.rename(previous, target);
    throw error;
  }
  if (moved) await fs.rm(previous, { recursive: true, force: true });
}

async function installPackage(options) {
  const evidence = inspectPluginPackage({ ...options, version: options.manifest?.version });
  if (options.packageSha256 && evidence.sha256 !== options.packageSha256) {
    throw new Error('Plugin package changed after validation');
  }
  await fs.mkdir(path.dirname(options.installPath), { recursive: true });
  const staged = await fs.mkdtemp(`${options.installPath}.staged-`);
  try {
    const write = async (name, content) => {
      const destination = path.join(staged, name);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, content);
    };
    if (Array.isArray(options.data) || options.data instanceof ArrayBuffer || ArrayBuffer.isView(options.data)) {
      const data = Array.isArray(options.data)
        ? Buffer.from(options.data)
        : ArrayBuffer.isView(options.data)
          ? Buffer.from(options.data.buffer, options.data.byteOffset, options.data.byteLength)
          : Buffer.from(options.data);
      for (const entry of new AdmZip(data).getEntries()) {
        if (!entry.isDirectory) await write(entry.entryName, entry.getData());
      }
    } else {
      for (const [name, content] of Object.entries(options.data || {})) {
        await write(name, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
      }
    }
    await write('plugin.json', JSON.stringify(evidence.manifest, null, 2));
    try {
      await fs.access(path.join(staged, 'index.js'));
    } catch {
      await write('index.js', `module.exports = ${JSON.stringify(evidence.manifest)};\n`);
    }
    await replaceDirectory(staged, options.installPath);
    return { success: true, installPath: options.installPath, files: await fs.readdir(options.installPath) };
  } finally {
    await fs.rm(staged, { recursive: true, force: true });
  }
}

async function backupPackage(installPath, backupRoot, pluginId, version) {
  const manifest = JSON.parse(await fs.readFile(path.join(installPath, 'plugin.json'), 'utf8'));
  if (manifest.id !== pluginId || manifest.version !== version) throw new Error('Installed package identity mismatch');
  const snapshotId = crypto.randomUUID();
  const destination = path.join(backupRoot, snapshotId);
  await fs.mkdir(destination, { recursive: true });
  try {
    await fs.cp(installPath, path.join(destination, 'package'), { recursive: true, errorOnExist: true, force: false });
    await fs.writeFile(path.join(destination, 'identity.json'), JSON.stringify({ pluginId, version }));
    return { success: true, snapshotId };
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true });
    throw error;
  }
}

async function restorePackage(installPath, backupRoot, pluginId, snapshotId) {
  if (typeof snapshotId !== 'string' || !/^[a-f0-9-]{36}$/.test(snapshotId)) {
    throw new Error('Invalid rollback snapshot');
  }
  const source = path.join(backupRoot, snapshotId);
  const identity = JSON.parse(await fs.readFile(path.join(source, 'identity.json'), 'utf8'));
  if (identity.pluginId !== pluginId) throw new Error('Rollback plugin identity mismatch');
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'package', 'plugin.json'), 'utf8'));
  if (manifest.id !== pluginId || manifest.version !== identity.version) throw new Error('Rollback manifest mismatch');
  const staged = await fs.mkdtemp(`${installPath}.restore-`);
  try {
    await fs.cp(path.join(source, 'package'), staged, { recursive: true });
    await replaceDirectory(staged, installPath);
    return { success: true, manifest };
  } finally {
    await fs.rm(staged, { recursive: true, force: true });
  }
}
module.exports = { installPackage, backupPackage, restorePackage };
