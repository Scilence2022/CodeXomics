const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');

async function extractPluginArchive(zipPath, tempRoot) {
  const stat = await fs.stat(zipPath);
  if (stat.size > 32 * 1024 * 1024) throw new Error('Plugin archive exceeds size limit');
  const zip = new AdmZip(await fs.readFile(zipPath));
  const entries = zip.getEntries().filter(entry => !entry.isDirectory);
  if (!entries.length || entries.length > 500) throw new Error('Invalid plugin archive file count');
  let size = 0;
  const names = new Set();
  for (const entry of entries) {
    const name = entry.entryName;
    if (
      !name ||
      name.includes('\\') ||
      path.posix.isAbsolute(name) ||
      /^[A-Za-z]:/.test(name) ||
      name.split('/').some(part => part === '..' || part === '.') ||
      names.has(name) ||
      ((entry.header.attr >>> 16) & 0o170000) === 0o120000
    ) {
      throw new Error('Unsafe plugin archive entry');
    }
    size += entry.header.size;
    if (size > 32 * 1024 * 1024) throw new Error('Plugin archive exceeds expanded size limit');
    names.add(name);
  }
  const manifests = entries.filter(entry => path.posix.basename(entry.entryName) === 'plugin.json');
  const manifest =
    manifests.find(entry => entry.entryName === 'plugin.json') || (manifests.length === 1 ? manifests[0] : null);
  if (!manifest) throw new Error('Plugin archive must contain one plugin.json root');
  JSON.parse(manifest.getData().toString('utf8'));
  const destination = await fs.mkdtemp(path.join(tempRoot, 'codexomics-plugin-'));
  try {
    for (const entry of entries) {
      const filename = path.join(destination, entry.entryName);
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, entry.getData());
    }
    return { success: true, extractPath: path.join(destination, path.posix.dirname(manifest.entryName)) };
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true });
    throw error;
  }
}
module.exports = { extractPluginArchive };
