/**
 * AdvancedSearchManager - Handles advanced search functionality with multiple search modes
 */
class AdvancedSearchManager {
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;
    this.modal = null;
    this.activeTab = 'gene';
    this.searchResults = [];
    this.searchHistory = [];
    this.maxHistoryItems = 20;

    // IUPAC nucleotide codes for motif search
    this.iupacCodes = {
      A: 'A',
      C: 'C',
      G: 'G',
      T: 'T',
      R: '[AG]',
      Y: '[CT]',
      S: '[GC]',
      W: '[AT]',
      K: '[GT]',
      M: '[AC]',
      B: '[CGT]',
      D: '[AGT]',
      H: '[ACT]',
      V: '[ACG]',
      N: '[ACGT]',
    };

    // Common motif presets
    this.motifPresets = [
      { name: 'TATA Box', pattern: 'TATAAA' },
      { name: 'Kozak', pattern: 'GCCGCCACCATGG' },
      { name: 'Shine-Dalgarno', pattern: 'AGGAGG' },
      { name: 'Promoter -10', pattern: 'TATAAT' },
      { name: 'Promoter -35', pattern: 'TTGACA' },
    ];

    this.initializeModal();
    this.initializeKeyboardShortcuts();
    this.loadSearchHistory();
  }

  /**
   * Initialize the advanced search modal
   */
  initializeModal() {
    // Check if modal already exists
    if (document.getElementById('advancedSearchModal')) {
      this.modal = document.getElementById('advancedSearchModal');
      this.attachEventListeners();
      return;
    }

    // Create modal HTML
    const modalHtml = this.createModalHtml();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    this.modal = document.getElementById('advancedSearchModal');
    this.attachEventListeners();

    // Make modal draggable using ModalDragManager
    if (window.modalDragManager) {
      window.modalDragManager.makeDraggable('#advancedSearchModal');
    } else if (typeof ModalDragManager !== 'undefined') {
      // Fallback: create new instance if global not available
      setTimeout(() => {
        if (window.modalDragManager) {
          window.modalDragManager.makeDraggable('#advancedSearchModal');
        }
      }, 200);
    }
  }

  /**
   * Create the modal HTML structure
   */
  createModalHtml() {
    return `
        <div id="advancedSearchModal" class="modal">
            <div class="modal-content large">
                <div class="modal-header">
                    <h3><i class="fas fa-search-plus"></i> Advanced Search</h3>
                    <div class="modal-controls">
                        <span class="keyboard-shortcut-hint">
                            <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd>
                        </span>
                        <button class="modal-close" onclick="window.advancedSearchManager?.hideModal()">&times;</button>
                    </div>
                </div>
                <div class="modal-body">
                    <!-- Search Type Tabs -->
                    <div class="search-tabs">
                        <button class="search-tab active" data-tab="gene">
                            <i class="fas fa-dna"></i> Gene Search
                        </button>
                        <button class="search-tab" data-tab="sequence">
                            <i class="fas fa-align-left"></i> Sequence Search
                        </button>
                        <button class="search-tab" data-tab="protein">
                            <i class="fas fa-flask"></i> Protein Search
                        </button>
                        <button class="search-tab" data-tab="motif">
                            <i class="fas fa-puzzle-piece"></i> Motif Search
                        </button>
                        <button class="search-tab" data-tab="regex">
                            <i class="fas fa-asterisk"></i> Regex Search
                        </button>
                    </div>
                    
                    <!-- Gene Search Tab -->
                    <div class="search-tab-content active" data-tab="gene">
                        <div class="search-main-input">
                            <input type="text" id="geneSearchInput" placeholder="Enter gene name, locus tag, or product keyword...">
                            <button class="btn btn-primary btn-search" onclick="window.advancedSearchManager?.performSearch('gene')">
                                <i class="fas fa-search"></i> Search
                            </button>
                        </div>
                        
                        <div class="search-options">
                            <div class="search-options-header">
                                <h4><i class="fas fa-sliders-h"></i> Search Options</h4>
                                <i class="fas fa-chevron-down"></i>
                            </div>
                            <div class="search-options-grid">
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="geneSearchCaseSensitive">
                                        Case sensitive
                                    </label>
                                </div>
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="geneSearchExactMatch">
                                        Exact match only
                                    </label>
                                </div>
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="geneSearchProduct" checked>
                                        Search in product descriptions
                                    </label>
                                </div>
                                <div class="search-scope-select">
                                    <label for="geneSearchScope">Scope:</label>
                                    <select id="geneSearchScope">
                                        <option value="current">Current chromosome</option>
                                        <option value="all">All chromosomes</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Results Preview -->
                        <div class="search-results-preview" id="geneResultsPreview">
                            <div class="search-results-preview-empty">
                                <i class="fas fa-dna"></i>
                                <p>Enter a search term to find genes</p>
                            </div>
                        </div>
                        
                        <!-- Search History -->
                        <div class="search-history">
                            <div class="search-history-header">
                                <h4><i class="fas fa-history"></i> Recent Searches</h4>
                                <button class="btn-clear-history" onclick="window.advancedSearchManager?.clearHistory()">Clear</button>
                            </div>
                            <div class="search-history-list" id="geneSearchHistory">
                                <div class="search-history-empty">No recent searches</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Sequence Search Tab -->
                    <div class="search-tab-content" data-tab="sequence">
                        <div class="search-main-input">
                            <input type="text" id="sequenceSearchInput" placeholder="Enter DNA sequence (e.g., ATGATG)...">
                            <button class="btn btn-primary btn-search" onclick="window.advancedSearchManager?.performSearch('sequence')">
                                <i class="fas fa-search"></i> Search
                            </button>
                        </div>
                        
                        <div class="search-options">
                            <div class="search-options-header">
                                <h4><i class="fas fa-sliders-h"></i> Search Options</h4>
                            </div>
                            <div class="search-options-grid">
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="seqSearchCaseSensitive">
                                        Case sensitive
                                    </label>
                                </div>
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="seqSearchReverseComplement" checked>
                                        Include reverse complement
                                    </label>
                                </div>
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="seqSearchHighlight" checked>
                                        Highlight matches in view
                                    </label>
                                </div>
                                <div class="search-scope-select">
                                    <label for="seqSearchScope">Scope:</label>
                                    <select id="seqSearchScope">
                                        <option value="current">Current chromosome</option>
                                        <option value="all">All chromosomes</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="search-results-preview" id="sequenceResultsPreview">
                            <div class="search-results-preview-empty">
                                <i class="fas fa-align-left"></i>
                                <p>Enter a DNA sequence to search</p>
                            </div>
                        </div>
                        
                        <div class="search-history">
                            <div class="search-history-header">
                                <h4><i class="fas fa-history"></i> Recent Searches</h4>
                            </div>
                            <div class="search-history-list" id="sequenceSearchHistory">
                                <div class="search-history-empty">No recent searches</div>
                            </div>
                        </div>
                    </div>

                    <!-- Protein Search Tab -->
                    <div class="search-tab-content" data-tab="protein">
                        <div class="search-main-input">
                            <input type="text" id="proteinSearchInput" placeholder="Enter protein sequence (e.g., MKTAYIAKQRQISFVKSHFSRQ)...">
                            <button class="btn btn-primary btn-search" onclick="window.advancedSearchManager?.performSearch('protein')">
                                <i class="fas fa-search"></i> Search
                            </button>
                        </div>

                        <div class="search-options">
                            <div class="search-options-header">
                                <h4><i class="fas fa-sliders-h"></i> Search Options</h4>
                            </div>
                            <div class="search-options-grid">
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="proteinSearchCaseSensitive">
                                        Case sensitive
                                    </label>
                                </div>
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="proteinSearchHighlight" checked>
                                        Highlight coding region
                                    </label>
                                </div>
                                <div class="search-scope-select">
                                    <label for="proteinSearchScope">Scope:</label>
                                    <select id="proteinSearchScope">
                                        <option value="current">Current chromosome</option>
                                        <option value="all">All chromosomes</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="search-results-preview" id="proteinResultsPreview">
                            <div class="search-results-preview-empty">
                                <i class="fas fa-flask"></i>
                                <p>Enter a protein sequence to search translated CDS features</p>
                            </div>
                        </div>

                        <div class="search-history">
                            <div class="search-history-header">
                                <h4><i class="fas fa-history"></i> Recent Searches</h4>
                            </div>
                            <div class="search-history-list" id="proteinSearchHistory">
                                <div class="search-history-empty">No recent searches</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Motif Search Tab -->
                    <div class="search-tab-content" data-tab="motif">
                        <div class="search-main-input">
                            <input type="text" id="motifSearchInput" placeholder="Enter motif using IUPAC codes (e.g., TATAWW for TATA box)...">
                            <button class="btn btn-primary btn-search" onclick="window.advancedSearchManager?.performSearch('motif')">
                                <i class="fas fa-search"></i> Search
                            </button>
                        </div>
                        
                        <div class="motif-options">
                            <span style="font-size: 12px; color: var(--text-secondary); margin-right: 8px;">Quick presets:</span>
                            ${this.motifPresets
                              .map(
                                preset => `
                                <button class="motif-preset" data-pattern="${preset.pattern}" title="${preset.pattern}">
                                    ${preset.name}
                                </button>
                            `
                              )
                              .join('')}
                        </div>
                        
                        <div class="search-options">
                            <div class="search-options-header">
                                <h4><i class="fas fa-sliders-h"></i> Search Options</h4>
                            </div>
                            <div class="search-options-grid">
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="motifSearchReverseComplement" checked>
                                        Include reverse complement
                                    </label>
                                </div>
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="motifSearchHighlight" checked>
                                        Highlight matches
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div class="search-results-preview" id="motifResultsPreview">
                            <div class="search-results-preview-empty">
                                <i class="fas fa-puzzle-piece"></i>
                                <p>Enter a motif pattern to search</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Regex Search Tab -->
                    <div class="search-tab-content" data-tab="regex">
                        <div class="search-main-input">
                            <input type="text" id="regexSearchInput" placeholder="Enter regular expression pattern...">
                            <button class="btn btn-primary btn-search" onclick="window.advancedSearchManager?.performSearch('regex')">
                                <i class="fas fa-search"></i> Search
                            </button>
                        </div>
                        
                        <div class="regex-help">
                            <h5><i class="fas fa-info-circle"></i> Regex Quick Reference</h5>
                            <div class="regex-examples">
                                <div class="regex-example"><code>ATG.*TAA</code> Start to stop codon</div>
                                <div class="regex-example"><code>[AT]{6,}</code> AT-rich region (6+ bp)</div>
                                <div class="regex-example"><code>GC{3,5}</code> G followed by 3-5 Cs</div>
                                <div class="regex-example"><code>(CAG){10,}</code> CAG repeat expansion</div>
                            </div>
                        </div>
                        
                        <div class="search-options">
                            <div class="search-options-header">
                                <h4><i class="fas fa-sliders-h"></i> Search Options</h4>
                            </div>
                            <div class="search-options-grid">
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="regexSearchCaseInsensitive" checked>
                                        Case insensitive
                                    </label>
                                </div>
                                <div class="search-option">
                                    <label>
                                        <input type="checkbox" id="regexSearchHighlight" checked>
                                        Highlight matches
                                    </label>
                                </div>
                            </div>
                        </div>
                        
                        <div class="search-results-preview" id="regexResultsPreview">
                            <div class="search-results-preview-empty">
                                <i class="fas fa-asterisk"></i>
                                <p>Enter a regex pattern to search</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Loading State -->
                    <div class="search-loading" id="searchLoading">
                        <div class="spinner"></div>
                        <span>Searching...</span>
                    </div>
                </div>
            </div>
        </div>
        `;
  }

  /**
   * Attach event listeners to modal elements
   */
  attachEventListeners() {
    // Tab switching
    this.modal.querySelectorAll('.search-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        this.switchTab(e.target.closest('.search-tab').dataset.tab);
      });
    });

    // Close on backdrop click
    this.modal.addEventListener('click', e => {
      if (e.target === this.modal) {
        this.hideModal();
      }
    });

    // Enter key to search
    this.modal.querySelectorAll('input[type="text"]').forEach(input => {
      input.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          this.performSearch(this.activeTab);
        }
      });
    });

    // Motif preset buttons
    this.modal.querySelectorAll('.motif-preset').forEach(btn => {
      btn.addEventListener('click', e => {
        const pattern = e.target.dataset.pattern;
        document.getElementById('motifSearchInput').value = pattern;
        this.performSearch('motif');
      });
    });

    // Close on Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.modal.classList.contains('show')) {
        this.hideModal();
      }
    });
  }

  /**
   * Initialize keyboard shortcuts
   */
  initializeKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      // Ctrl+Shift+F to open advanced search
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        this.showModal();
      }
      // Ctrl+F to focus quick search (if not in modal)
      if (e.ctrlKey && !e.shiftKey && e.key === 'f' && !this.modal.classList.contains('show')) {
        e.preventDefault();
        const quickSearch = document.getElementById('searchInput');
        if (quickSearch) {
          quickSearch.focus();
          quickSearch.select();
        }
      }
    });
  }

  /**
   * Switch between search tabs
   */
  switchTab(tabName) {
    this.activeTab = tabName;

    // Update tab buttons
    this.modal.querySelectorAll('.search-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content panels
    this.modal.querySelectorAll('.search-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tab === tabName);
    });

    // Focus the input for the active tab
    const inputId = `${tabName}SearchInput`;
    const input = document.getElementById(inputId);
    if (input) {
      setTimeout(() => input.focus(), 100);
    }
  }

  /**
   * Show the advanced search modal
   */
  showModal() {
    this.modal.classList.add('show');
    this.updateHistoryDisplay();

    // Focus the current tab's input
    const inputId = `${this.activeTab}SearchInput`;
    const input = document.getElementById(inputId);
    if (input) {
      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);
    }
  }

  /**
   * Hide the advanced search modal
   */
  hideModal() {
    this.modal.classList.remove('show');
  }

  /**
   * Perform search based on active tab
   */
  performSearch(searchType) {
    const inputId = `${searchType}SearchInput`;
    const input = document.getElementById(inputId);
    if (!input || !input.value.trim()) return;

    const query = input.value.trim();

    // Show loading state
    this.showLoading(true);

    // Add to history
    this.addToHistory(query, searchType);

    // Perform search based on type
    setTimeout(() => {
      let results = [];

      switch (searchType) {
        case 'gene':
          results = this.searchByGene(query);
          break;
        case 'sequence':
          results = this.searchBySequence(query);
          break;
        case 'protein':
          results = this.searchByProtein(query);
          break;
        case 'motif':
          results = this.searchByMotif(query);
          break;
        case 'regex':
          results = this.searchByRegex(query);
          break;
      }

      this.searchResults = results;
      this.showLoading(false);
      this.displayResults(results, searchType);

      // Also populate NavigationManager results for sidebar display
      if (results.length > 0 && this.genomeBrowser.navigationManager) {
        this.genomeBrowser.navigationManager.searchResults = results;
        this.genomeBrowser.navigationManager.populateSearchResults(results, query);
      }
    }, 100);
  }

  /**
   * Search by gene name, locus tag, or product
   */
  searchByGene(query) {
    const results = [];
    const currentChr = document.getElementById('chromosomeSelect')?.value;
    const annotations = this.genomeBrowser.currentAnnotations;

    if (!annotations) return results;

    const caseSensitive = document.getElementById('geneSearchCaseSensitive')?.checked || false;
    const exactMatch = document.getElementById('geneSearchExactMatch')?.checked || false;
    const searchProduct = document.getElementById('geneSearchProduct')?.checked !== false;
    const scope = document.getElementById('geneSearchScope')?.value || 'current';

    const searchTerm = caseSensitive ? query : query.toUpperCase();
    const chromosomes = scope === 'all' ? Object.keys(annotations) : [currentChr];

    chromosomes.forEach(chr => {
      if (!annotations[chr]) return;

      annotations[chr].forEach(annotation => {
        if (!annotation.qualifiers) return;

        const geneName = this.genomeBrowser.getQualifierValue(annotation.qualifiers, 'gene') || '';
        const locusTag = this.genomeBrowser.getQualifierValue(annotation.qualifiers, 'locus_tag') || '';
        const product = searchProduct
          ? this.genomeBrowser.getQualifierValue(annotation.qualifiers, 'product') || ''
          : '';

        const searchFields = [geneName, locusTag, product].join(' ');
        const fieldToSearch = caseSensitive ? searchFields : searchFields.toUpperCase();

        let isMatch = false;
        if (exactMatch) {
          isMatch = fieldToSearch.split(/\s+/).some(word => word === searchTerm);
        } else {
          isMatch = fieldToSearch.includes(searchTerm);
        }

        if (isMatch) {
          results.push({
            type: 'gene',
            position: annotation.start,
            end: annotation.end,
            name: geneName || locusTag || annotation.type,
            details: `${annotation.type}: ${product || 'No description'}`,
            chromosome: chr,
            annotation: annotation,
          });
        }
      });
    });

    return results.sort((a, b) => a.position - b.position);
  }

  /**
   * Search by DNA sequence
   */
  searchBySequence(query) {
    const results = [];
    const currentChr = document.getElementById('chromosomeSelect')?.value;
    const sequences = this.genomeBrowser.currentSequence;

    if (!sequences || !currentChr) return results;

    const caseSensitive = document.getElementById('seqSearchCaseSensitive')?.checked || false;
    const includeRC = document.getElementById('seqSearchReverseComplement')?.checked !== false;
    const scope = document.getElementById('seqSearchScope')?.value || 'current';

    const chromosomes = scope === 'all' ? Object.keys(sequences) : [currentChr];
    const searchTerm = caseSensitive ? query : query.toUpperCase();

    chromosomes.forEach(chr => {
      const sequence = sequences[chr];
      if (!sequence) return;

      const seqToSearch = caseSensitive ? sequence : sequence.toUpperCase();

      // Forward strand
      let index = seqToSearch.indexOf(searchTerm);
      while (index !== -1 && results.length < 1000) {
        results.push({
          type: 'sequence',
          position: index,
          end: index + searchTerm.length,
          name: `Sequence match`,
          details: `Forward strand at position ${index + 1}`,
          chromosome: chr,
          strand: '+',
        });
        index = seqToSearch.indexOf(searchTerm, index + 1);
      }

      // Reverse complement
      if (includeRC && query.match(/^[ATGCN]+$/i)) {
        const rc = this.getReverseComplement(searchTerm);
        let rcIndex = seqToSearch.indexOf(rc);
        while (rcIndex !== -1 && results.length < 1000) {
          results.push({
            type: 'sequence',
            position: rcIndex,
            end: rcIndex + rc.length,
            name: `Reverse complement`,
            details: `Reverse strand at position ${rcIndex + 1}`,
            chromosome: chr,
            strand: '-',
          });
          rcIndex = seqToSearch.indexOf(rc, rcIndex + 1);
        }
      }
    });

    return results.sort((a, b) => a.position - b.position);
  }

  /**
   * Search translated CDS protein sequences and map peptide hits to genomic coordinates
   */
  searchByProtein(query) {
    const results = [];
    const currentChr = document.getElementById('chromosomeSelect')?.value;
    const sequences = this.genomeBrowser.currentSequence || {};
    const annotations = this.genomeBrowser.currentAnnotations;

    if (!annotations || !currentChr) return results;

    const normalizedQuery = this.normalizeProteinSequence(query);
    if (!normalizedQuery) {
      this.genomeBrowser.updateStatus?.('Enter a valid protein sequence to search');
      return results;
    }

    const caseSensitive = document.getElementById('proteinSearchCaseSensitive')?.checked || false;
    const scope = document.getElementById('proteinSearchScope')?.value || 'current';
    const searchTerm = caseSensitive ? normalizedQuery : normalizedQuery.toUpperCase();
    const chromosomes = scope === 'all' ? Object.keys(annotations) : [currentChr];
    const processedFeatures = new Set();
    const maxResults = 1000;

    for (const chr of chromosomes) {
      const features = annotations[chr] || [];
      const chromosomeSequence = sequences[chr] || '';

      for (const feature of features) {
        if (results.length >= maxResults) break;
        if (!this.isProteinSearchFeature(feature)) continue;

        const featureId = `${chr}_${feature.start}_${feature.end}_${feature.strand || '+'}`;
        if (processedFeatures.has(featureId)) continue;
        processedFeatures.add(featureId);

        const proteinSequences = this.getProteinSequencesForFeature(chromosomeSequence, feature);
        if (proteinSequences.length === 0) continue;

        for (const proteinCandidate of proteinSequences) {
          if (results.length >= maxResults) break;

          const proteinSequence = proteinCandidate.sequence;
          const proteinToSearch = caseSensitive ? proteinSequence : proteinSequence.toUpperCase();
          let index = proteinToSearch.indexOf(searchTerm);

          while (index !== -1 && results.length < maxResults) {
            const genomicRange = this.mapProteinHitToGenomicRange(feature, index, searchTerm.length);
            if (genomicRange) {
              const geneName =
                this.getFeatureQualifier(feature, 'gene') || this.getFeatureQualifier(feature, 'locus_tag');
              const product = this.getFeatureQualifier(feature, 'product') || feature.product || 'Translated CDS';
              const label = geneName || feature.name || feature.id || product;
              const proteinStart = index + 1;
              const proteinEnd = index + searchTerm.length;
              const matchedProteinSequence = proteinSequence.substring(index, index + searchTerm.length);

              results.push({
                type: 'protein',
                position: genomicRange.start,
                end: genomicRange.end,
                name: `${label} protein match`,
                details: `${product}; aa ${proteinStart}-${proteinEnd} (${matchedProteinSequence}) on ${feature.strand || '+'} strand`,
                chromosome: chr,
                strand: feature.strand || '+',
                annotation: feature,
                proteinStart,
                proteinEnd,
                matchedProteinSequence,
                proteinSequence,
                proteinSource: proteinCandidate.source,
              });
            }

            index = proteinToSearch.indexOf(searchTerm, index + 1);
          }
        }
      }
    }

    return results.sort((a, b) => {
      const chrCompare = String(a.chromosome || '').localeCompare(String(b.chromosome || ''));
      return chrCompare || a.position - b.position;
    });
  }

  /**
   * Normalize pasted protein text, including FASTA records, into a searchable sequence
   */
  normalizeProteinSequence(sequence) {
    return String(sequence || '')
      .split(/\r?\n/)
      .filter(line => !line.trim().startsWith('>'))
      .join('')
      .replace(/[^A-Za-z*]/g, '');
  }

  /**
   * Return true when a feature can provide a protein sequence
   */
  isProteinSearchFeature(feature) {
    if (!feature) return false;
    return feature.type === 'CDS' || !!this.getFeatureQualifier(feature, 'translation');
  }

  /**
   * Get searchable protein sequence candidates for a CDS feature
   */
  getProteinSequencesForFeature(chromosomeSequence, feature) {
    const candidates = [];
    const addCandidate = (sequence, source) => {
      const normalizedSequence = this.normalizeProteinSequence(sequence).replace(/\*+$/, '');
      const normalizedKey = normalizedSequence.toUpperCase();
      if (!normalizedSequence || candidates.some(candidate => candidate.sequence.toUpperCase() === normalizedKey)) {
        return;
      }
      candidates.push({ sequence: normalizedSequence, source });
    };

    if (chromosomeSequence && Number.isFinite(Number(feature.start)) && Number.isFinite(Number(feature.end))) {
      try {
        const cdsSequence = this.extractFeatureSequence(chromosomeSequence, feature);
        addCandidate(this.translateDNA(cdsSequence), 'computed');
      } catch (error) {
        console.warn('Could not translate CDS for protein search:', error);
      }
    }

    addCandidate(this.getFeatureQualifier(feature, 'translation') || '', 'qualifier');

    return candidates;
  }

  /**
   * Extract feature DNA in coding orientation
   */
  extractFeatureSequence(sequence, feature) {
    const start = Math.max(0, feature.start - 1);
    const end = Math.min(sequence.length, feature.end);
    let featureSequence = sequence.substring(start, end);

    if (this.isReverseStrand(feature.strand)) {
      featureSequence = this.getReverseComplement(featureSequence);
    }

    return featureSequence;
  }

  /**
   * Translate DNA using the app's unified translator when available
   */
  translateDNA(sequence) {
    if (window.UnifiedDNATranslation) {
      const result = window.UnifiedDNATranslation.translateDNA({
        sequence,
        frame: 0,
        strand: 1,
        geneticCode: 'standard',
        includeStops: false,
        validateInput: true,
      });

      return result.success ? result.protein : '';
    }

    const codonTable = {
      TTT: 'F',
      TTC: 'F',
      TTA: 'L',
      TTG: 'L',
      TCT: 'S',
      TCC: 'S',
      TCA: 'S',
      TCG: 'S',
      TAT: 'Y',
      TAC: 'Y',
      TAA: '*',
      TAG: '*',
      TGT: 'C',
      TGC: 'C',
      TGA: '*',
      TGG: 'W',
      CTT: 'L',
      CTC: 'L',
      CTA: 'L',
      CTG: 'L',
      CCT: 'P',
      CCC: 'P',
      CCA: 'P',
      CCG: 'P',
      CAT: 'H',
      CAC: 'H',
      CAA: 'Q',
      CAG: 'Q',
      CGT: 'R',
      CGC: 'R',
      CGA: 'R',
      CGG: 'R',
      ATT: 'I',
      ATC: 'I',
      ATA: 'I',
      ATG: 'M',
      ACT: 'T',
      ACC: 'T',
      ACA: 'T',
      ACG: 'T',
      AAT: 'N',
      AAC: 'N',
      AAA: 'K',
      AAG: 'K',
      AGT: 'S',
      AGC: 'S',
      AGA: 'R',
      AGG: 'R',
      GTT: 'V',
      GTC: 'V',
      GTA: 'V',
      GTG: 'V',
      GCT: 'A',
      GCC: 'A',
      GCA: 'A',
      GCG: 'A',
      GAT: 'D',
      GAC: 'D',
      GAA: 'E',
      GAG: 'E',
      GGT: 'G',
      GGC: 'G',
      GGA: 'G',
      GGG: 'G',
    };

    let protein = '';
    const normalizedSequence = String(sequence || '')
      .toUpperCase()
      .replace(/U/g, 'T');

    for (let i = 0; i < normalizedSequence.length - 2; i += 3) {
      const aminoAcid = codonTable[normalizedSequence.substring(i, i + 3)] || 'X';
      if (aminoAcid === '*') break;
      protein += aminoAcid;
    }

    return protein;
  }

  /**
   * Convert amino-acid hit coordinates back to a genomic nucleotide interval
   */
  mapProteinHitToGenomicRange(feature, proteinStartIndex, proteinLength) {
    const featureStart = Number(feature.start);
    const featureEnd = Number(feature.end);

    if (!Number.isFinite(featureStart) || !Number.isFinite(featureEnd) || proteinLength <= 0) {
      return null;
    }

    const aaStart = proteinStartIndex;
    const aaEnd = proteinStartIndex + proteinLength;
    let range;

    if (this.isReverseStrand(feature.strand)) {
      range = {
        start: Math.max(featureStart - 1, featureEnd - aaEnd * 3),
        end: Math.min(featureEnd, featureEnd - aaStart * 3),
      };
    } else {
      const codingStart = featureStart - 1;
      range = {
        start: Math.max(codingStart, codingStart + aaStart * 3),
        end: Math.min(featureEnd, codingStart + aaEnd * 3),
      };
    }

    if (range.start >= range.end) {
      return { start: featureStart - 1, end: featureEnd };
    }

    return range;
  }

  /**
   * Determine whether a feature strand is reverse-oriented
   */
  isReverseStrand(strand) {
    return strand === '-' || strand === -1 || strand === '-1';
  }

  /**
   * Safely read a feature qualifier value
   */
  getFeatureQualifier(feature, key) {
    if (this.genomeBrowser.getQualifierValue) {
      return this.genomeBrowser.getQualifierValue(feature.qualifiers, key) || '';
    }

    const value = feature.qualifiers?.[key];
    if (Array.isArray(value)) {
      return value[0] || '';
    }

    return value || '';
  }

  /**
   * Search by motif pattern (IUPAC codes)
   */
  searchByMotif(query) {
    // Convert IUPAC to regex
    let regexPattern = '';
    for (const char of query.toUpperCase()) {
      regexPattern += this.iupacCodes[char] || char;
    }

    return this.searchByRegex(regexPattern);
  }

  /**
   * Search by regular expression
   */
  searchByRegex(pattern) {
    const results = [];
    const currentChr = document.getElementById('chromosomeSelect')?.value;
    const sequences = this.genomeBrowser.currentSequence;

    if (!sequences || !currentChr) return results;

    const caseInsensitive = document.getElementById('regexSearchCaseInsensitive')?.checked !== false;
    const flags = caseInsensitive ? 'gi' : 'g';

    try {
      const regex = new RegExp(pattern, flags);
      const sequence = sequences[currentChr];

      if (!sequence) return results;

      let match;
      while ((match = regex.exec(sequence)) !== null && results.length < 1000) {
        results.push({
          type: 'regex',
          position: match.index,
          end: match.index + match[0].length,
          name: `Pattern match`,
          details: `"${match[0]}" at position ${match.index + 1}`,
          chromosome: currentChr,
          matchedText: match[0],
        });

        // Prevent infinite loop for zero-length matches
        if (match[0].length === 0) regex.lastIndex++;
      }
    } catch (e) {
      console.error('Invalid regex pattern:', e);
      this.genomeBrowser.updateStatus(`Invalid regex pattern: ${e.message}`);
    }

    return results.sort((a, b) => a.position - b.position);
  }

  /**
   * Get reverse complement of a sequence
   */
  getReverseComplement(sequence) {
    const complement = {
      A: 'T',
      T: 'A',
      G: 'C',
      C: 'G',
      a: 't',
      t: 'a',
      g: 'c',
      c: 'g',
      N: 'N',
      n: 'n',
    };

    return sequence
      .split('')
      .reverse()
      .map(base => complement[base] || base)
      .join('');
  }

  /**
   * Display search results in preview panel
   */
  displayResults(results, searchType) {
    const previewId = `${searchType}ResultsPreview`;
    const preview = document.getElementById(previewId);

    if (!preview) return;

    if (results.length === 0) {
      preview.innerHTML = `
                <div class="search-results-preview-empty">
                    <i class="fas fa-search"></i>
                    <p>No matches found</p>
                </div>
            `;
      return;
    }

    const iconClass = {
      gene: 'fas fa-dna',
      sequence: 'fas fa-align-left',
      protein: 'fas fa-flask',
      motif: 'fas fa-puzzle-piece',
      regex: 'fas fa-asterisk',
    };

    preview.innerHTML = `
            <div class="search-results-preview-header">
                <span>Results</span>
                <span class="search-results-preview-count">${results.length} found</span>
            </div>
            <div class="search-results-preview-list">
                ${results
                  .slice(0, 50)
                  .map(
                    (result, index) => `
                    <div class="search-results-preview-item" data-index="${index}">
                        <div class="search-result-icon ${result.type}">
                            <i class="${iconClass[result.type] || 'fas fa-circle'}"></i>
                        </div>
                        <div class="search-result-info">
                            <div class="search-result-name">${result.name}</div>
                            <div class="search-result-details">${result.details}</div>
                        </div>
                        <div class="search-result-position">${result.position + 1}-${result.end}</div>
                    </div>
                `
                  )
                  .join('')}
                ${
                  results.length > 50
                    ? `
                    <div style="text-align: center; padding: 12px; color: var(--text-secondary); font-size: 12px;">
                        Showing 50 of ${results.length} results
                    </div>
                `
                    : ''
                }
            </div>
        `;

    // Add click handlers to navigate to results
    preview.querySelectorAll('.search-results-preview-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        this.navigateToResult(index);

        // Mark as selected
        preview.querySelectorAll('.search-results-preview-item').forEach(i => i.classList.remove('selected'));
        item.classList.add('selected');
      });
    });
  }

  /**
   * Navigate to a specific search result
   */
  navigateToResult(index) {
    if (index < 0 || index >= this.searchResults.length) return;

    const result = this.searchResults[index];
    const currentChr = document.getElementById('chromosomeSelect')?.value;
    const sequence = this.genomeBrowser.currentSequence?.[result.chromosome || currentChr];

    if (!sequence) return;

    // Switch chromosome if needed
    if (result.chromosome && result.chromosome !== currentChr) {
      const chrSelect = document.getElementById('chromosomeSelect');
      if (chrSelect) {
        chrSelect.value = result.chromosome;
        chrSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // Calculate view range with context
    const start = Math.max(0, result.position - 500);
    const end = Math.min(sequence.length, result.end + 500);

    this.genomeBrowser.currentPosition = { start, end };
    this.genomeBrowser.updateStatistics(result.chromosome || currentChr, sequence);
    this.genomeBrowser.displayGenomeView(result.chromosome || currentChr, sequence);

    if (this.genomeBrowser.genomeNavigationBar) {
      this.genomeBrowser.genomeNavigationBar.update();
    }

    // Highlight the match
    if (this.genomeBrowser.navigationManager) {
      this.genomeBrowser.navigationManager.highlightSearchMatches([result]);
    }

    this.genomeBrowser.updateStatus(`Navigated to: ${result.name} at position ${result.position + 1}`);
  }

  /**
   * Show/hide loading state
   */
  showLoading(show) {
    const loading = document.getElementById('searchLoading');
    if (loading) {
      loading.classList.toggle('active', show);
    }
  }

  /**
   * Load search history from storage
   */
  loadSearchHistory() {
    try {
      const stored = localStorage.getItem('advancedSearchHistory');
      if (stored) {
        this.searchHistory = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Could not load search history:', e);
      this.searchHistory = [];
    }
  }

  /**
   * Save search history to storage
   */
  saveSearchHistory() {
    try {
      localStorage.setItem('advancedSearchHistory', JSON.stringify(this.searchHistory));
    } catch (e) {
      console.warn('Could not save search history:', e);
    }
  }

  /**
   * Add query to search history
   */
  addToHistory(query, type) {
    // Remove duplicates
    this.searchHistory = this.searchHistory.filter(item => !(item.query === query && item.type === type));

    // Add to beginning
    this.searchHistory.unshift({
      query: query,
      type: type,
      timestamp: Date.now(),
    });

    // Limit size
    if (this.searchHistory.length > this.maxHistoryItems) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistoryItems);
    }

    this.saveSearchHistory();
    this.updateHistoryDisplay();
  }

  /**
   * Clear search history
   */
  clearHistory() {
    this.searchHistory = [];
    this.saveSearchHistory();
    this.updateHistoryDisplay();
  }

  /**
   * Update the history display in the modal
   */
  updateHistoryDisplay() {
    const historyContainers = ['geneSearchHistory', 'sequenceSearchHistory', 'proteinSearchHistory'];
    const historyIcons = {
      gene: 'dna',
      sequence: 'align-left',
      protein: 'flask',
      motif: 'puzzle-piece',
      regex: 'asterisk',
    };

    historyContainers.forEach(containerId => {
      const container = document.getElementById(containerId);
      if (!container) return;

      const relevantHistory = this.searchHistory.slice(0, 10);

      if (relevantHistory.length === 0) {
        container.innerHTML = '<div class="search-history-empty">No recent searches</div>';
        return;
      }

      container.innerHTML = relevantHistory
        .map(
          item => `
                <div class="search-history-item" data-query="${item.query}" data-type="${item.type}">
                    <i class="fas fa-${historyIcons[item.type] || 'search'}"></i>
                    ${item.query}
                </div>
            `
        )
        .join('');

      // Add click handlers
      container.querySelectorAll('.search-history-item').forEach(item => {
        item.addEventListener('click', () => {
          const query = item.dataset.query;
          const type = item.dataset.type;
          const inputId = `${type}SearchInput`;
          const input = document.getElementById(inputId);
          if (input) {
            input.value = query;
            this.switchTab(type);
            this.performSearch(type);
          }
        });
      });
    });
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdvancedSearchManager;
}
