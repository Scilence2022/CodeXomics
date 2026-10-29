'use strict';

const { UpdateService } = require('./update-service');
let service;

function getService() {
  if (!service) service = new UpdateService(require('electron'));
  return service;
}

function initUpdater() {
  return getService().init();
}

function checkForUpdates() {
  return getService().check(true);
}

module.exports = { initUpdater, checkForUpdates };
