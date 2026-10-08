import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';

export function loadScript(relativePath, extras = {}) {
  const filename = path.resolve(relativePath);
  const sandbox = {
    module: { exports: {} },
    window: {},
    console: { log() {}, warn() {}, error() {}, info() {} },
    require: createRequire(filename),
    setTimeout,
    clearTimeout,
    ...extras,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename, timeout: 5000 });
  return { exported: sandbox.module.exports, sandbox };
}
