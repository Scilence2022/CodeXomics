/** Pure parameter normalization and similarity shared by chat and memory. */
class ParameterUtils {
  static normalizeParams(params) {
    if (!params || typeof params !== 'object') return {};
    if (Array.isArray(params)) {
      return params.map(value => (value && typeof value === 'object' ? this.normalizeParams(value) : value));
    }
    const sorted = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        const val = params[key];
        if (val !== undefined) {
          sorted[key] = val && typeof val === 'object' ? this.normalizeParams(val) : val;
        }
      });
    if (sorted.primerSequence && (!sorted.sequence || sorted.sequence === sorted.primerSequence)) {
      sorted.sequence = sorted.primerSequence;
      delete sorted.primerSequence;
    }
    return sorted;
  }
  static calculateParameterSimilarity(params1, params2) {
    const keys1 = Object.keys(params1);
    const keys2 = Object.keys(params2);
    const commonKeys = keys1.filter(key => keys2.includes(key));

    if (commonKeys.length === 0) return 0;

    let similarity = 0;
    for (const key of commonKeys) {
      if (params1[key] === params2[key]) {
        similarity += 1;
      }
    }

    return similarity / commonKeys.length;
  }
}
if (typeof module !== 'undefined' && module.exports) module.exports = ParameterUtils;
else window.ParameterUtils = ParameterUtils;
