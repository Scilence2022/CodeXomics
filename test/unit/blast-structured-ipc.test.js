import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const IPC_HANDLERS = path.join(process.cwd(), 'src/main/ipc-handlers.js');
const BLAST_MANAGER = path.join(process.cwd(), 'src/renderer/modules/BlastManager.js');
const BLAST_CONFIG_MANAGER = path.join(process.cwd(), 'src/renderer/modules/BlastConfigManager.js');

function readFile(relPath) {
  return fs.readFileSync(relPath, 'utf8');
}

describe('BLAST structured IPC hardening', () => {
  it('accepts structured executable and args in main BLAST command IPC', () => {
    const source = readFile(IPC_HANDLERS);

    expect(source).toContain("ipcMain.handle('blast:run-command'");
    expect(source).toContain('options.executable');
    expect(source).toContain('Array.isArray(options.args)');
    expect(source).toContain('resolveBlastExecutable(app, executableToken');
    expect(source).toContain('execFile(executable, args');
  });

  it('sends structured BLAST command data from BlastManager renderer IPC calls', () => {
    const source = readFile(BLAST_MANAGER);
    const ipcCallStart = source.indexOf('window.electronAPI.blast.runCommand({');
    const ipcCallEnd = source.indexOf('});', ipcCallStart);
    const ipcCall = source.slice(ipcCallStart, ipcCallEnd);

    expect(source).toContain('parseBlastCommand(command)');
    expect(ipcCall).toContain('executable,');
    expect(ipcCall).toContain('args,');
    expect(ipcCall).not.toMatch(/\bcommand\s*,/);
  });

  it('detects companion BLAST tools with structured IPC arguments', () => {
    const source = readFile(BLAST_CONFIG_MANAGER);

    expect(source).toContain('executable: tool');
    expect(source).toContain("args: ['-version']");
    expect(source).not.toContain('command: `${tool} -version`');
  });
});
