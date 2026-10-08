'use strict';

const semver = require('semver');

// This synchronous channel performs no I/O. Bound the input so a renderer cannot
// send arbitrary methods or unbounded range expressions to the main process.
const operations = new Map([
  ['compare', { arity: 2, run: semver.compare }],
  ['validRange', { arity: 1, run: semver.validRange }],
  ['satisfies', { arity: 2, run: semver.satisfies }],
]);

function registerPluginVersionIpc(ipcMain) {
  ipcMain.on('plugin-version-operation', (event, operation, args) => {
    try {
      const entry = operations.get(operation);
      if (
        !entry ||
        !Array.isArray(args) ||
        args.length !== entry.arity ||
        args.some(value => typeof value !== 'string' || value.length > 4096)
      ) {
        throw new Error('Invalid plugin version operation');
      }
      event.returnValue = { success: true, value: entry.run(...args) };
    } catch (error) {
      event.returnValue = { success: false, error: error.message };
    }
  });
}

module.exports = { registerPluginVersionIpc };
