// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';

const token = 'synthetic-marketplace-admin-token';
const metadata = {
  name: 'Fixture Plugin',
  version: '1.0.0',
  description: 'Integration fixture',
  author: 'Fixture',
  category: 'visualization',
  type: 'utility',
};

async function startServer(dataDir) {
  const child = spawn(process.execPath, ['packages/marketplace-server/plugin-marketplace-server.js'], {
    env: {
      ...process.env,
      PORT: '0',
      CODEXOMICS_MARKETPLACE_HOST: '127.0.0.1',
      CODEXOMICS_MARKETPLACE_DATA_DIR: dataDir,
      CODEXOMICS_MARKETPLACE_ADMIN_TOKEN: token,
      CODEXOMICS_MARKETPLACE_ADMIN_ID: 'fixture-admin',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let log = '';
      const timeout = setTimeout(() => reject(new Error(`Marketplace did not start: ${log}`)), 5000);
      child.stdout.on('data', chunk => {
        log += chunk;
        const match = /Server running on (http:\/\/127\.0\.0\.1:\d+)/.exec(log);
        if (match) {
          clearTimeout(timeout);
          resolve(`${match[1]}/api/v1`);
        }
      });
      child.stderr.on('data', chunk => {
        log += chunk;
      });
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', code => {
        clearTimeout(timeout);
        reject(new Error(`Marketplace exited (${code}): ${log}`));
      });
    });
    return { child, endpoint };
  } catch (error) {
    child.kill();
    throw error;
  }
}

describe('marketplace publication', () => {
  it('requires administrator credentials, matches the reviewed archive, and publishes once after durable metadata', async () => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codexomics-marketplace-test-'));
    let child;
    try {
      const server = await startServer(dataDir);
      child = server.child;
      const { endpoint } = server;
      const authorization = { Authorization: `Bearer ${token}` };
      const approval = (id, body, headers = authorization) =>
        fetch(`${endpoint}/submissions/${id}/approve`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      const list = () => fetch(`${endpoint}/submissions`, { headers: authorization }).then(response => response.json());

      expect((await fetch(`${endpoint}/submissions`)).status).toBe(401);
      expect((await approval('unknown', {}, {})).status).toBe(401);

      const zip = new AdmZip();
      zip.addFile('plugin.json', Buffer.from(JSON.stringify({ ...metadata, id: 'fixture-plugin' })));
      zip.addFile('index.js', Buffer.from('module.exports = {};'));
      const archive = zip.toBuffer();
      const sha256 = createHash('sha256').update(archive).digest('hex');

      const submit = async bytes => {
        const form = new FormData();
        form.append('metadata', JSON.stringify(metadata));
        form.append('files', new Blob([bytes]), 'fixture.zip');
        return fetch(`${endpoint}/plugins/submit`, { method: 'POST', body: form });
      };
      expect((await submit(Buffer.from('invalid zip'))).status).toBe(400);
      expect(await fs.readdir(path.join(dataDir, 'uploads'))).toEqual([]);
      const response = await submit(archive);
      expect(response.status).toBe(201);
      const { submissionId } = (await response.json()).data;
      const pending = (await list()).data.submissions[0];
      expect(pending.packageSha256).toBe(sha256);
      expect((await approval(submissionId, { sha256: '0'.repeat(64) })).status).toBe(409);

      const uploaded = path.join(dataDir, 'uploads', pending.archiveFilename);
      await fs.writeFile(uploaded, 'changed bytes');
      expect((await approval(submissionId, { sha256 })).status).toBe(422);
      await fs.writeFile(uploaded, archive);

      const metadataFile = path.join(dataDir, 'metadata.json');
      await fs.rename(metadataFile, `${metadataFile}.original`);
      await fs.mkdir(metadataFile);
      expect((await approval(submissionId, { sha256 })).status).toBe(500);
      expect((await list()).data.submissions).toHaveLength(1);
      await fs.rmdir(metadataFile);
      await fs.rename(`${metadataFile}.original`, metadataFile);

      const approved = await Promise.all([
        approval(submissionId, { sha256, approverEmail: 'untrusted@example.test' }),
        approval(submissionId, { sha256 }),
      ]);
      expect(approved.map(item => item.status)).toEqual([200, 200]);
      expect((await list()).data.submissions).toEqual([]);
      const saved = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
      expect(saved.plugins['fixture-plugin']).toMatchObject({
        approvedBy: 'fixture-admin',
        status: 'published',
        packageSha256: sha256,
      });
      expect(saved.stats.totalPlugins).toBe(2);

      const download = await fetch(`${endpoint}/plugins/fixture-plugin/1.0.0/download`);
      expect(download.status).toBe(200);
      expect(Buffer.from(await download.arrayBuffer())).toEqual(archive);
    } finally {
      if (child) {
        const exited = new Promise(resolve => child.once('exit', resolve));
        child.kill();
        await exited;
      }
      await fs.rm(dataDir, { recursive: true, force: true });
    }
  }, 15000);
});
