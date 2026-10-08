/** Semantic version operations shared by plugin resolution and updates. */
class PluginVersionUtils {
  static get engine() {
    return typeof module !== 'undefined' && module.exports ? require('semver') : window.nodeAPI.pluginVersions;
  }

  static compare(a, b) {
    return this.engine.compare(a, b);
  }
  static validRange(range) {
    return this.engine.validRange(range);
  }
  static satisfies(version, range) {
    return this.engine.satisfies(version, range);
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PluginVersionUtils;
} else {
  window.PluginVersionUtils = PluginVersionUtils;
}
