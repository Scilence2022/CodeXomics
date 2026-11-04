/**
 * OperonLookupIndex - constant-time "which operon is this gene in?" lookups.
 *
 * GenomeBrowser.getGeneOperonInfo() used to scan every operon for every gene,
 * which is O(visible genes x operons x genes per operon). With ~1000 operons in
 * E. coli and ~1000 features in a 1 Mb view that is millions of comparisons per
 * pass, and the pass runs several times per navigation (row layout, canvas
 * render, operon panel, sequence colouring) and again on every canvas hover.
 *
 * The index answers the same question with the same precedence as the scan:
 * the FIRST operon, in array order, that matches the gene by any of
 *   1. identity     - the gene object is in operon.genes
 *   2. position     - an operon gene has the same start and end
 *   3. name + range - the gene lies inside the operon on the same strand and
 *                     its gene/locus_tag name matches an operon gene's name
 * Each method yields the lowest matching operon index; the answer is the
 * smallest of the three, which is exactly the scan's first hit.
 *
 * The index reads gene coordinates and names when it is built, so it is only
 * valid while those do not change. Callers keep it for one synchronous pass.
 */
class OperonLookupIndex {
  /**
   * @param {Array} operons - operon records ({ name, start, end, strand, genes })
   * @param {Function} getName - gene => its gene/locus_tag name, or '' when it has none
   */
  constructor(operons, getName) {
    this.operons = operons || [];
    this.getName = getName;
    this.byIdentity = new Map();
    this.byPosition = new Map();
    this.byName = new Map();

    this.operons.forEach((operon, index) => {
      const genes = operon && Array.isArray(operon.genes) ? operon.genes : [];
      for (const g of genes) {
        if (!g) continue;
        if (!this.byIdentity.has(g)) this.byIdentity.set(g, index);

        const key = OperonLookupIndex.positionKey(g);
        if (!this.byPosition.has(key)) this.byPosition.set(key, index);

        const name = getName(g);
        if (name) {
          let list = this.byName.get(name);
          if (!list) {
            list = [];
            this.byName.set(name, list);
          }
          // Operons are visited in order, so the list stays sorted; skip repeats
          // from an operon that names the same gene twice.
          if (list[list.length - 1] !== index) list.push(index);
        }
      }
    });
  }

  static positionKey(gene) {
    return `${gene.start}:${gene.end}`;
  }

  /**
   * @returns {Object|null} the first operon the gene belongs to, or null
   */
  find(gene) {
    let best = Infinity;

    const identity = this.byIdentity.get(gene);
    if (identity !== undefined) best = identity;

    const position = this.byPosition.get(OperonLookupIndex.positionKey(gene));
    if (position !== undefined && position < best) best = position;

    const name = this.getName(gene);
    const candidates = name ? this.byName.get(name) : undefined;
    if (candidates) {
      for (const index of candidates) {
        if (index >= best) break;
        const operon = this.operons[index];
        if (gene.start >= operon.start && gene.end <= operon.end && gene.strand === operon.strand) {
          best = index;
          break;
        }
      }
    }

    return best === Infinity ? null : this.operons[best];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OperonLookupIndex;
} else if (typeof window !== 'undefined') {
  window.OperonLookupIndex = OperonLookupIndex;
}
