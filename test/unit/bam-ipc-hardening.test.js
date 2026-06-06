import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const BAM_READER = path.join(process.cwd(), 'src/renderer/modules/BamReader.js');
const IPC_HANDLERS = path.join(process.cwd(), 'src/main/ipc-handlers.js');

describe('BAM IPC hardening', () => {
  it('keeps BamReader defined when direct @gmod/bam access is blocked in the renderer', () => {
    const source = fs.readFileSync(BAM_READER, 'utf8');
    const importFailureBlock = source.slice(source.indexOf('} catch (error) {'), source.indexOf('class BamReader'));

    expect(source).toContain("require('@gmod/bam')");
    expect(source).toContain('useIpcBamBackend = true');
    expect(source).toContain('!BamFile && hasIpcBamBackend()');
    expect(importFailureBlock).not.toContain("throw new Error('@gmod/bam library is required");
  });

  it('returns only IPC-safe BAM initialization data from main process handlers', () => {
    const source = fs.readFileSync(IPC_HANDLERS, 'utf8');
    const handlerStart = source.indexOf("ipcMain.handle('bam-reader:initialize'");
    const handlerEnd = source.indexOf("ipcMain.handle('bam-reader:get-records-for-range'", handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain('const state = getBamReaderState(reader)');
    expect(handler).toContain('return toIpcSafeValue({');
    expect(handler).not.toContain('...result');
  });

  it('sanitizes queried BAM reads and state before IPC serialization', () => {
    const source = fs.readFileSync(IPC_HANDLERS, 'utf8');
    const handlerStart = source.indexOf("ipcMain.handle('bam-reader:get-records-for-range'");
    const handlerEnd = source.indexOf("ipcMain.handle('bam-reader:destroy'", handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    expect(handler).toContain('return toIpcSafeValue({');
    expect(handler).toContain('reads: toIpcSafeValue(reads)');
    expect(handler).toContain('state: getBamReaderState(reader)');
  });
});
