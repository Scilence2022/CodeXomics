/**
 * DNAMarkerDatabase - Localized commercial DNA marker/ladder database
 * Covers NEB, Thermo Fisher, Takara, and common Chinese domestic brands.
 */
class DNAMarkerDatabase {
  constructor() {
    this._markers = new Map();
    this._populateMarkers();
  }

  _populateMarkers() {
    const markers = [
      // === NEB (New England Biolabs) ===
      {
        id: 'neb_1kb_ladder',
        name: 'NEB 1 kb DNA Ladder',
        brand: 'NEB',
        category: 'ladder',
        sizeRange: [1000, 10000],
        sizes: [1000, 2000, 3000, 4000, 5000, 6000, 8000, 10000],
        recommendedGel: [0.7, 1.2],
        description: 'Standard 1 kb ladder, 8 bands from 1–10 kb',
        tags: ['quick-load', 'pre-stained'],
      },
      {
        id: 'neb_1kb_plus',
        name: 'NEB 1 kb Plus DNA Ladder',
        brand: 'NEB',
        category: 'ladder',
        sizeRange: [100, 12000],
        sizes: [
          100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7000, 8000,
          9000, 10000, 11000, 12000,
        ],
        recommendedGel: [0.8, 1.5],
        description: 'Dense ladder, 24 bands from 100 bp–12 kb, wide range',
        tags: ['quick-load', 'tri-dye'],
      },
      {
        id: 'neb_100bp_ladder',
        name: 'NEB 100 bp DNA Ladder',
        brand: 'NEB',
        category: 'ladder',
        sizeRange: [100, 1500],
        sizes: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1200, 1500],
        recommendedGel: [1.5, 2.5],
        description: '100 bp ladder, ideal for PCR products',
        tags: ['quick-load', 'pre-stained'],
      },
      {
        id: 'neb_50bp_ladder',
        name: 'NEB 50 bp DNA Ladder',
        brand: 'NEB',
        category: 'ladder',
        sizeRange: [50, 1000],
        sizes: [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000],
        recommendedGel: [2.0, 3.0],
        description: 'Low range ladder for small fragments',
        tags: ['quick-load'],
      },
      {
        id: 'neb_lambda_hindiii',
        name: 'NEB Lambda DNA/HindIII Marker',
        brand: 'NEB',
        category: 'digest_marker',
        sizeRange: [125, 23130],
        sizes: [125, 564, 2027, 2322, 4361, 6557, 9416, 23130],
        recommendedGel: [0.5, 0.8],
        description: 'Classic Lambda HindIII digest marker',
        tags: ['classic'],
      },

      // === Thermo Fisher (Invitrogen / Fermentas) ===
      {
        id: 'thermo_trackit_1kb_plus',
        name: 'TrackIt 1 Kb Plus DNA Ladder',
        brand: 'Thermo Fisher',
        category: 'ladder',
        sizeRange: [100, 12000],
        sizes: [
          100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 7000, 8000,
          9000, 10000, 11000, 12000,
        ],
        recommendedGel: [0.8, 1.5],
        description: 'Ready-to-use pre-stained ladder, 100 bp–12 kb',
        tags: ['pre-stained', 'ready-to-use'],
      },
      {
        id: 'thermo_generuler_50bp',
        name: 'GeneRuler 50 bp DNA Ladder',
        brand: 'Thermo Fisher',
        category: 'ladder',
        sizeRange: [50, 1000],
        sizes: [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000],
        recommendedGel: [2.0, 3.0],
        description: 'GeneRuler low range, 50–1000 bp',
        tags: ['pre-stained'],
      },
      {
        id: 'thermo_generuler_100bp_plus',
        name: 'GeneRuler 100 bp Plus DNA Ladder',
        brand: 'Thermo Fisher',
        category: 'ladder',
        sizeRange: [100, 10000],
        sizes: [
          100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
          10000,
        ],
        recommendedGel: [0.8, 1.5],
        description: 'GeneRuler mid range, 100 bp–10 kb',
        tags: ['pre-stained'],
      },
      {
        id: 'thermo_generuler_1kb',
        name: 'GeneRuler 1 kb DNA Ladder',
        brand: 'Thermo Fisher',
        category: 'ladder',
        sizeRange: [250, 10000],
        sizes: [250, 500, 750, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
        recommendedGel: [0.7, 1.2],
        description: 'GeneRuler 1 kb ladder, 250 bp–10 kb',
        tags: ['pre-stained'],
      },
      {
        id: 'thermo_generuler_1kb_plus',
        name: 'GeneRuler 1 kb Plus DNA Ladder',
        brand: 'Thermo Fisher',
        category: 'ladder',
        sizeRange: [75, 20000],
        sizes: [
          75, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000,
          10000, 12000, 15000, 20000,
        ],
        recommendedGel: [0.5, 1.2],
        description: 'GeneRuler wide range, 75 bp–20 kb',
        tags: ['pre-stained'],
      },
      {
        id: 'thermo_lambda_hindiii',
        name: 'Lambda DNA/HindIII Marker',
        brand: 'Thermo Fisher',
        category: 'digest_marker',
        sizeRange: [125, 23130],
        sizes: [125, 564, 2027, 2322, 4361, 6557, 9416, 23130],
        recommendedGel: [0.5, 0.8],
        description: 'Classic Lambda HindIII digest marker (Fermentas)',
        tags: ['classic'],
      },

      // === Takara (Takara Bio) ===
      {
        id: 'takara_dl2000',
        name: 'Takara DL2000 DNA Marker',
        brand: 'Takara',
        category: 'ladder',
        sizeRange: [100, 2000],
        sizes: [100, 250, 500, 750, 1000, 2000],
        recommendedGel: [1.0, 2.0],
        description: 'Most commonly used PCR marker in China, 100–2000 bp',
        tags: ['common', 'pcr'],
      },
      {
        id: 'takara_dl2000_plus',
        name: 'Takara DL2000 Plus DNA Marker',
        brand: 'Takara',
        category: 'ladder',
        sizeRange: [50, 2000],
        sizes: [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000],
        recommendedGel: [1.2, 2.5],
        description: 'Extended DL2000, more bands in small fragment range',
        tags: ['common', 'pcr'],
      },
      {
        id: 'takara_dl5000',
        name: 'Takara DL5000 DNA Marker',
        brand: 'Takara',
        category: 'ladder',
        sizeRange: [100, 5000],
        sizes: [100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000, 5000],
        recommendedGel: [0.8, 1.5],
        description: 'Mid-range marker for restriction fragments, 100–5000 bp',
        tags: [],
      },
      {
        id: 'takara_dl15000',
        name: 'Takara DL15000 DNA Marker',
        brand: 'Takara',
        category: 'ladder',
        sizeRange: [250, 15000],
        sizes: [250, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000],
        recommendedGel: [0.5, 0.8],
        description: 'Large fragment marker for plasmid/lambda analysis',
        tags: ['large-fragment'],
      },
      {
        id: 'takara_dl10000',
        name: 'Takara DL10000 DNA Marker',
        brand: 'Takara',
        category: 'ladder',
        sizeRange: [500, 10000],
        sizes: [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000],
        recommendedGel: [0.6, 1.0],
        description: 'Standard marker 500 bp–10 kb',
        tags: [],
      },

      // === Chinese Domestic Brands ===
      {
        id: 'trans2k',
        name: 'Trans2K DNA Marker',
        brand: 'TransGen (全式金)',
        category: 'ladder',
        sizeRange: [100, 2000],
        sizes: [100, 250, 500, 750, 1000, 2000],
        recommendedGel: [1.0, 2.0],
        description: 'Equivalent to DL2000, clear bands, cost-effective',
        tags: ['common', 'cost-effective'],
      },
      {
        id: 'trans2k_plus',
        name: 'Trans2K Plus DNA Marker',
        brand: 'TransGen (全式金)',
        category: 'ladder',
        sizeRange: [50, 3000],
        sizes: [50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 800, 900, 1000, 1500, 2000, 3000],
        recommendedGel: [1.0, 2.5],
        description: 'Extended Trans2K with more small-fragment bands',
        tags: ['cost-effective'],
      },
      {
        id: 'vazyme_dl2000',
        name: 'Vazyme DL2000 DNA Marker',
        brand: 'Vazyme (诺唯赞)',
        category: 'ladder',
        sizeRange: [100, 2000],
        sizes: [100, 250, 500, 750, 1000, 2000],
        recommendedGel: [1.0, 2.0],
        description: 'Vazyme DL2000, routine lab choice',
        tags: ['common', 'cost-effective'],
      },
      {
        id: 'vazyme_dl5000',
        name: 'Vazyme DL5000 DNA Marker',
        brand: 'Vazyme (诺唯赞)',
        category: 'ladder',
        sizeRange: [100, 5000],
        sizes: [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000],
        recommendedGel: [0.8, 1.5],
        description: 'Vazyme mid-range marker',
        tags: ['cost-effective'],
      },
      {
        id: 'biomade_bm2000',
        name: 'BM2000 DNA Marker',
        brand: 'BioMaded (博迈德)',
        category: 'ladder',
        sizeRange: [100, 2000],
        sizes: [100, 250, 500, 750, 1000, 2000],
        recommendedGel: [1.0, 2.0],
        description: 'BioMaded BM2000, routine lab standard',
        tags: ['common', 'cost-effective'],
      },
      {
        id: 'biomade_bm5000',
        name: 'BM5000 DNA Marker',
        brand: 'BioMaded (博迈德)',
        category: 'ladder',
        sizeRange: [100, 5000],
        sizes: [100, 250, 500, 750, 1000, 1500, 2000, 3000, 5000],
        recommendedGel: [0.8, 1.5],
        description: 'BioMaded BM5000, mid-range marker',
        tags: ['cost-effective'],
      },
      {
        id: 'sangon_d2000',
        name: 'D2000 DNA Marker',
        brand: 'Sangon (生工)',
        category: 'ladder',
        sizeRange: [100, 2000],
        sizes: [100, 250, 500, 750, 1000, 2000],
        recommendedGel: [1.0, 2.0],
        description: 'Sangon D2000, cost-effective routine marker',
        tags: ['cost-effective'],
      },
      {
        id: 'sangon_d15000',
        name: 'D15000 DNA Marker',
        brand: 'Sangon (生工)',
        category: 'ladder',
        sizeRange: [250, 15000],
        sizes: [250, 500, 750, 1000, 1500, 2000, 3000, 5000, 7000, 10000, 15000],
        recommendedGel: [0.5, 0.8],
        description: 'Sangon large-fragment marker',
        tags: ['large-fragment', 'cost-effective'],
      },

      // === Generic / Legacy (kept for backward compat with gel tool) ===
      {
        id: '1kb',
        name: '1 kb DNA Ladder (Generic)',
        brand: 'Generic',
        category: 'ladder',
        sizeRange: [100, 10000],
        sizes: [10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000, 700, 500, 400, 300, 200, 100],
        recommendedGel: [0.7, 1.5],
        description: 'Generic 1 kb ladder (legacy default)',
        tags: ['legacy'],
      },
      {
        id: '100bp',
        name: '100 bp DNA Ladder (Generic)',
        brand: 'Generic',
        category: 'ladder',
        sizeRange: [100, 2000],
        sizes: [2000, 1500, 1000, 900, 800, 700, 600, 500, 400, 300, 200, 100],
        recommendedGel: [1.5, 2.5],
        description: 'Generic 100 bp ladder (legacy default)',
        tags: ['legacy'],
      },
      {
        id: '2log',
        name: '2-Log DNA Ladder (Generic)',
        brand: 'Generic',
        category: 'ladder',
        sizeRange: [100, 10000],
        sizes: [10000, 8000, 6000, 5000, 4000, 3000, 2500, 2000, 1500, 1000, 750, 500, 250, 100],
        recommendedGel: [0.7, 1.5],
        description: 'Generic 2-Log ladder (legacy default)',
        tags: ['legacy'],
      },
      {
        id: 'lambda_hindiii',
        name: 'Lambda HindIII Ladder (Generic)',
        brand: 'Generic',
        category: 'digest_marker',
        sizeRange: [125, 23130],
        sizes: [23130, 9416, 6557, 4361, 2322, 2027, 564, 125],
        recommendedGel: [0.5, 0.8],
        description: 'Generic Lambda HindIII digest ladder (legacy default)',
        tags: ['legacy', 'classic'],
      },
      {
        id: 'lambda_ecori',
        name: 'Lambda EcoRI Ladder (Generic)',
        brand: 'Generic',
        category: 'digest_marker',
        sizeRange: [3530, 21226],
        sizes: [21226, 7421, 5804, 5643, 4878, 3530],
        recommendedGel: [0.5, 0.8],
        description: 'Generic Lambda EcoRI digest ladder (legacy default)',
        tags: ['legacy'],
      },
    ];

    for (const marker of markers) {
      this._markers.set(marker.id, marker);
    }
  }

  get(id) {
    return this._markers.get(id) || null;
  }

  has(id) {
    return this._markers.has(id);
  }

  getAll() {
    return Array.from(this._markers.values());
  }

  getIds() {
    return Array.from(this._markers.keys());
  }

  getByBrand(brand) {
    return this.getAll().filter(m => m.brand === brand);
  }

  getByCategory(category) {
    return this.getAll().filter(m => m.category === category);
  }

  getBrands() {
    return [...new Set(this.getAll().map(m => m.brand))];
  }

  search(query) {
    const q = query.toLowerCase();
    return this.getAll().filter(
      m =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.tags && m.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  findBySizeRange(minSize, maxSize) {
    return this.getAll().filter(m => m.sizeRange[0] <= maxSize && m.sizeRange[1] >= minSize);
  }

  getLegacyMappings() {
    return {
      '1kb': '1kb',
      '100bp': '100bp',
      '2log': '2log',
      lambda_hindiii: 'lambda_hindiii',
      lambda_ecori: 'lambda_ecori',
    };
  }
}

if (typeof window !== 'undefined') {
  window.DNAMarkerDatabase = DNAMarkerDatabase;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DNAMarkerDatabase;
}
