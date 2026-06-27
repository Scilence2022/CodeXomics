/**
 * GenomicDataDownloader - genomic data downloader
 * Supports downloading genomic data from public databases such as NCBI, EMBL-EBI, and DDBJ
 */
class GenomicDataDownloader {
  constructor() {
    this.currentDownloadType = null;
    this.searchResults = [];
    this.selectedResults = new Set();
    this.outputDirectory = '';
    this.downloadQueue = [];
    this.isDownloading = false;
    this.currentProject = null;

    // API configuration
    this.apiConfig = {
      'ncbi-unified': {
        name: 'NCBI Databases',
        baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
        description: 'Search and download data from all NCBI databases (GenBank, RefSeq, SRA, Assembly)',
        searchDb: 'nucleotide', // Default, can be changed by user
        retmax: 100,
        supportedDbs: ['nucleotide', 'genome', 'sra', 'assembly', 'protein', 'pubmed'],
      },
      'embl-unified': {
        name: 'EMBL-EBI Databases',
        baseUrl: 'https://www.ebi.ac.uk/ena/browser/api/',
        description: 'Search and download data from EMBL-EBI databases (EMBL, Ensembl, ENA)',
        retmax: 50,
        supportedDbs: ['embl-sequences', 'ensembl-genomes', 'ena-archive'],
      },
      // Legacy individual database configs for backward compatibility
      'ncbi-genbank': {
        name: 'NCBI GenBank',
        baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
        description: 'Search and download nucleotide sequences from NCBI GenBank database',
        searchDb: 'nucleotide',
        retmax: 100,
      },
      'ncbi-refseq': {
        name: 'NCBI RefSeq',
        baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
        description: 'Download reference genome assemblies from NCBI RefSeq',
        searchDb: 'assembly',
        retmax: 50,
      },
      'ncbi-sra': {
        name: 'NCBI SRA',
        baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
        description: 'Search sequencing read archives from NCBI SRA database',
        searchDb: 'sra',
        retmax: 25,
      },
      'ncbi-assembly': {
        name: 'NCBI Assembly',
        baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
        description: 'Download genome assembly data from NCBI',
        searchDb: 'assembly',
        retmax: 50,
      },
      'embl-sequences': {
        name: 'EMBL Sequences',
        baseUrl: 'https://www.ebi.ac.uk/ena/browser/api/',
        description: 'Search and download sequences from EMBL-EBI database',
        retmax: 50,
      },
      'ensembl-genomes': {
        name: 'Ensembl Genomes',
        baseUrl: 'https://rest.ensembl.org/',
        description: 'Download genome data from Ensembl',
        retmax: 25,
      },
      'ena-archive': {
        name: 'ENA Archive',
        baseUrl: 'https://www.ebi.ac.uk/ena/portal/api/',
        description: 'European Nucleotide Archive data',
        retmax: 50,
      },
      'ddbj-sequences': {
        name: 'DDBJ Sequences',
        baseUrl: 'https://ddbj.nig.ac.jp/api/',
        description: 'DNA Data Bank of Japan sequences',
        retmax: 50,
      },
      'uniprot-proteins': {
        name: 'UniProt Proteins',
        baseUrl: 'https://rest.uniprot.org/',
        description: 'Protein sequence and annotation data',
        retmax: 100,
      },
      'kegg-pathways': {
        name: 'KEGG Pathways',
        baseUrl: 'https://rest.kegg.jp/',
        description: 'KEGG pathway and genome data',
        retmax: 50,
      },
    };

    this.initialize();
  }

  initialize() {
    console.log('🧬 Initializing Genomic Data Downloader...');
    this.setupEventListeners();
    this.setupIpcListeners();
  }

  setupEventListeners() {
    // Search form
    const searchForm = document.getElementById('searchForm');
    if (searchForm) {
      searchForm.addEventListener('submit', e => {
        e.preventDefault();
        this.performSearch();
      });
    }

    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearSearch());
    }

    // Directory selection
    const selectDirBtn = document.getElementById('selectDirBtn');
    if (selectDirBtn) {
      selectDirBtn.addEventListener('click', () => this.selectOutputDirectory());
    }

    // File-format selection - updates the category preview in real time
    const fileFormatSelect = document.getElementById('fileFormat');
    if (fileFormatSelect) {
      fileFormatSelect.addEventListener('change', () => this.updateCategoryPreviews());
    }

    // Download button
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    if (downloadSelectedBtn) {
      downloadSelectedBtn.addEventListener('click', () => this.downloadSelected());
    }

    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
      downloadAllBtn.addEventListener('click', () => this.downloadAll());
    }
  }

  // Update category previews when file format changes
  updateCategoryPreviews() {
    if (this.searchResults.length > 0) {
      this.displayResults(this.searchResults);
    }
  }

  setupIpcListeners() {
    if (window.electronAPI) {
      // Listen for download-type setting changes
      window.electronAPI.onSetDownloadType(downloadType => {
        console.log('📥 Received download type:', downloadType);
        this.setDownloadType(downloadType);
      });

      // Listen for current-project setting changes
      window.electronAPI.onSetActiveProject(projectInfo => {
        console.log('📥 Received project info:', projectInfo);
        this.setActiveProject(projectInfo);
      });

      // Listen for menu actions (Copy, Paste, Cut, Select All)
      if (window.electronAPI.ipcRenderer) {
        window.electronAPI.ipcRenderer.on('tool-menu-action', (event, action, ...args) => {
          console.log('📋 Menu action received:', action);
          this.handleMenuAction(action, ...args);
        });
      }

      // Get the current project info
      this.getCurrentProject();
    }
  }

  /**
   * Handle menu actions from Edit menu (Copy, Paste, Cut, Select All)
   */
  handleMenuAction(action, ...args) {
    const activeElement = document.activeElement;

    switch (action) {
      case 'copy':
        // If focused on input/textarea, let browser handle it
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          document.execCommand('copy');
        } else {
          // Copy selected text from anywhere
          const selection = window.getSelection();
          if (selection && selection.toString()) {
            navigator.clipboard.writeText(selection.toString());
            console.log('✅ Copied to clipboard:', selection.toString());
          }
        }
        break;

      case 'paste':
        // Only paste to input/textarea elements
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          navigator.clipboard
            .readText()
            .then(text => {
              document.execCommand('insertText', false, text);
              console.log('✅ Pasted from clipboard');
            })
            .catch(err => {
              console.error('Paste failed:', err);
            });
        }
        break;

      case 'cut':
        // If focused on input/textarea, let browser handle it
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          document.execCommand('cut');
        }
        break;

      case 'select-all':
        // If focused on input/textarea, select all in that field
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          activeElement.select();
        } else {
          // Select all text on page
          const range = document.createRange();
          range.selectNodeContents(document.body);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
        break;

      default:
        console.log('Unhandled menu action:', action);
    }
  }

  async getCurrentProject() {
    if (window.electronAPI && window.electronAPI.getCurrentProject) {
      try {
        const projectInfo = await window.electronAPI.getCurrentProject();
        if (projectInfo) {
          this.setActiveProject(projectInfo);
        }
      } catch (error) {
        console.error('Error getting current project:', error);
      }
    }
  }

  setActiveProject(projectInfo) {
    this.currentProject = projectInfo;
    console.log('🗂️ Active project set:', projectInfo);

    // Clear any existing project status banners first
    this.clearProjectStatusBanner();

    // Update default output directory to project folder or show default options
    if (projectInfo && projectInfo.dataFolderPath) {
      const genomesDir = `${projectInfo.dataFolderPath}/genomes`;
      this.outputDirectory = genomesDir;
      const outputDirElement = document.getElementById('outputDir');
      if (outputDirElement) {
        outputDirElement.value = genomesDir;
        outputDirElement.placeholder = 'Project genomes folder';
      }

      // Show project info in UI
      this.showProjectInfo(projectInfo);
    } else {
      // No active project - set default output directory options
      const outputDirElement = document.getElementById('outputDir');
      if (outputDirElement) {
        outputDirElement.value = '';
        outputDirElement.placeholder = 'Click "Select Directory" to choose download location';
      }

      // Show no project info
      this.showNoProjectInfo();
    }
  }

  clearProjectStatusBanner() {
    const databaseInfo = document.getElementById('databaseInfo');
    if (databaseInfo) {
      // Remove any existing project status banners (both active and no-project)
      const existingBanners = databaseInfo.querySelectorAll('[data-project-status-banner]');
      existingBanners.forEach(banner => banner.remove());
    }
  }

  showProjectInfo(projectInfo) {
    const databaseInfo = document.getElementById('databaseInfo');
    if (databaseInfo && projectInfo) {
      // Create project info banner with data attribute for easy identification
      const projectInfoHtml = `
                <div data-project-status-banner="active" style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #2e7d32;">📁 Active Project - Smart File Organization</h4>
                    <p style="margin: 0; color: #424242;"><strong>Name:</strong> ${projectInfo.name || 'Unnamed Project'}</p>
                    <p style="margin: 0; color: #424242;"><strong>Data Folder:</strong> ${projectInfo.dataFolderPath || 'Not set'}</p>
                    <div style="margin: 10px 0 0 0; padding: 10px; background: #f0f8f0; border-radius: 6px;">
                        <p style="margin: 0; color: #2e7d32; font-weight: bold; font-size: 13px;">🧠 Intelligent File Categorization Enabled</p>
                        <p style="margin: 5px 0 0 0; color: #666; font-size: 12px;">Files will be automatically organized into:</p>
                        <ul style="margin: 5px 0 0 20px; padding: 0; color: #666; font-size: 12px;">
                            <li><strong>genomes/</strong> - FASTA, GenBank, EMBL genome sequences</li>
                            <li><strong>proteins/</strong> - Protein sequences (.faa, UniProt data)</li>
                            <li><strong>annotations/</strong> - GFF, GTF annotation files</li>
                            <li><strong>variants/</strong> - VCF, BCF variant files</li>
                            <li><strong>sequencing_data/</strong> - FASTQ, SRA raw data</li>
                            <li><strong>transcripts/</strong> - mRNA, CDS sequences</li>
                            <li><strong>alignments/</strong> - SAM, BAM alignment files</li>
                            <li><strong>tracks/</strong> - BED, WIG track files</li>
                            <li><strong>metadata/</strong> - JSON, XML metadata</li>
                            <li><strong>literature/</strong> - PubMed articles</li>
                            <li><strong>Root directory</strong> - Unclassifiable files</li>
                        </ul>
                    </div>
                </div>
            `;

      // Insert project info at the beginning
      databaseInfo.insertAdjacentHTML('afterbegin', projectInfoHtml);
    }
  }

  showNoProjectInfo() {
    const databaseInfo = document.getElementById('databaseInfo');
    if (databaseInfo) {
      // Create no project info banner with data attribute for easy identification
      const noProjectInfoHtml = `
                <div data-project-status-banner="none" style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">📂 No Active Project</h4>
                    <p style="margin: 0; color: #856404;">You can download files without a project.</p>
                    <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 14px;">Select a download directory manually using the "Select Directory" button below.</p>
                </div>
            `;

      // Insert no project info at the beginning
      databaseInfo.insertAdjacentHTML('afterbegin', noProjectInfoHtml);
    }
  }

  setDownloadType(downloadType) {
    console.log('🔧 Setting download type:', downloadType);
    this.currentDownloadType = downloadType;
    const config = this.apiConfig[downloadType];

    if (config) {
      console.log('✅ Found config for download type:', config.name);
      // Update the title and description
      const titleElement = document.getElementById('downloadTitle');
      const descElement = document.getElementById('downloadDescription');
      const databaseInfo = document.getElementById('databaseInfo');

      if (titleElement) {
        titleElement.textContent = `🧬 ${config.name} Download`;
      }

      if (descElement) {
        descElement.textContent = config.description;
      }

      if (databaseInfo) {
        // Save existing project status banner before updating
        const existingBanner = databaseInfo.querySelector('[data-project-status-banner]');
        const bannerHTML = existingBanner ? existingBanner.outerHTML : '';

        // Update database info
        const dbInfoHTML = `
                    <h3>${config.name}</h3>
                    <p>${config.description}</p>
                    <p><strong>API Endpoint:</strong> ${config.baseUrl}</p>
                    <p><strong>Max Results:</strong> ${config.retmax}</p>
                `;

        // Restore project status banner + new database info
        databaseInfo.innerHTML = bannerHTML + dbInfoHTML;
      }

      // Set database-specific options
      this.setupDatabaseSpecificOptions(downloadType);

      console.log(`✅ Set download type to: ${config.name}`);
    } else {
      console.error('❌ No config found for download type:', downloadType);
      console.log('Available configs:', Object.keys(this.apiConfig));
    }
  }

  setupDatabaseSpecificOptions(downloadType) {
    const optionsContainer = document.getElementById('databaseSpecificOptions');
    if (!optionsContainer) return;

    let optionsHTML = '';

    switch (downloadType) {
      case 'ncbi-unified':
        optionsHTML = `
                    <label class="form-label">Database Type</label>
                    <select id="ncbiDatabase" class="form-select">
                        <option value="nucleotide">GenBank Nucleotide Sequences</option>
                        <option value="assembly">RefSeq Genomes</option>
                        <option value="sra">SRA Sequencing Data</option>
                        <option value="genome">Genome Records</option>
                        <option value="protein">Protein Sequences</option>
                        <option value="pubmed">PubMed Articles</option>
                    </select>
                    
                    <label class="form-label" style="margin-top: 15px;">Organism</label>
                    <input type="text" id="organism" class="form-input" placeholder="e.g., Escherichia coli">
                    <div class="help-text">Filter by organism name</div>
                    
                    <label class="form-label" style="margin-top: 15px;">Sequence Length</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="number" id="minLength" class="form-input" placeholder="Min length">
                        <input type="number" id="maxLength" class="form-input" placeholder="Max length">
                    </div>
                    
                    <label class="form-label" style="margin-top: 15px;">Platform (for SRA)</label>
                    <select id="platform" class="form-select">
                        <option value="">All platforms</option>
                        <option value="illumina">Illumina</option>
                        <option value="pacbio">PacBio</option>
                        <option value="nanopore">Oxford Nanopore</option>
                        <option value="454">454</option>
                    </select>
                `;
        break;

      case 'embl-unified':
        optionsHTML = `
                    <label class="form-label">Database Type</label>
                    <select id="emblDatabase" class="form-select">
                        <option value="embl-sequences">EMBL Sequences</option>
                        <option value="ensembl-genomes">Ensembl Genomes</option>
                        <option value="ena-archive">ENA Archive</option>
                    </select>
                    
                    <label class="form-label" style="margin-top: 15px;">Species Division (Ensembl)</label>
                    <select id="division" class="form-select">
                        <option value="vertebrates">Vertebrates</option>
                        <option value="plants">Plants</option>
                        <option value="fungi">Fungi</option>
                        <option value="protists">Protists</option>
                        <option value="bacteria">Bacteria</option>
                    </select>
                    
                    <label class="form-label" style="margin-top: 15px;">Data Type</label>
                    <select id="dataType" class="form-select">
                        <option value="genome">Genome sequence</option>
                        <option value="cdna">cDNA</option>
                        <option value="cds">CDS</option>
                        <option value="protein">Protein</option>
                    </select>
                `;
        break;

      case 'ncbi-genbank':
      case 'ncbi-refseq':
        optionsHTML = `
                    <label class="form-label">Organism</label>
                    <input type="text" id="organism" class="form-input" placeholder="e.g., Escherichia coli">
                    <div class="help-text">Filter by organism name</div>
                    
                    <label class="form-label" style="margin-top: 15px;">Sequence Length</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="number" id="minLength" class="form-input" placeholder="Min length">
                        <input type="number" id="maxLength" class="form-input" placeholder="Max length">
                    </div>
                `;
        break;

      case 'ncbi-sra':
        optionsHTML = `
                    <label class="form-label">Platform</label>
                    <select id="platform" class="form-select">
                        <option value="">All platforms</option>
                        <option value="illumina">Illumina</option>
                        <option value="pacbio">PacBio</option>
                        <option value="nanopore">Oxford Nanopore</option>
                        <option value="454">454</option>
                    </select>
                    
                    <label class="form-label" style="margin-top: 15px;">Study Type</label>
                    <select id="studyType" class="form-select">
                        <option value="">All study types</option>
                        <option value="WGS">Whole Genome Sequencing</option>
                        <option value="RNA-Seq">RNA-Seq</option>
                        <option value="ChIP-Seq">ChIP-Seq</option>
                        <option value="ATAC-Seq">ATAC-Seq</option>
                    </select>
                `;
        break;

      case 'ensembl-genomes':
        optionsHTML = `
                    <label class="form-label">Species Division</label>
                    <select id="division" class="form-select">
                        <option value="vertebrates">Vertebrates</option>
                        <option value="plants">Plants</option>
                        <option value="fungi">Fungi</option>
                        <option value="protists">Protists</option>
                        <option value="bacteria">Bacteria</option>
                    </select>
                    
                    <label class="form-label" style="margin-top: 15px;">Data Type</label>
                    <select id="dataType" class="form-select">
                        <option value="genome">Genome sequence</option>
                        <option value="cdna">cDNA</option>
                        <option value="cds">CDS</option>
                        <option value="protein">Protein</option>
                    </select>
                `;
        break;

      case 'uniprot-proteins':
        optionsHTML = `
                    <label class="form-label">Reviewed Status</label>
                    <select id="reviewed" class="form-select">
                        <option value="">All entries</option>
                        <option value="true">Reviewed (Swiss-Prot)</option>
                        <option value="false">Unreviewed (TrEMBL)</option>
                    </select>
                    
                    <label class="form-label" style="margin-top: 15px;">Annotation Score</label>
                    <select id="annotationScore" class="form-select">
                        <option value="">All scores</option>
                        <option value="5">Score ≥ 5</option>
                        <option value="4">Score ≥ 4</option>
                        <option value="3">Score ≥ 3</option>
                    </select>
                `;
        break;

      default:
        optionsHTML = `
                    <label class="form-label">Additional Filters</label>
                    <input type="text" id="additionalFilters" class="form-input" placeholder="Enter additional search filters">
                `;
    }

    optionsContainer.innerHTML = optionsHTML;
  }

  async performSearch() {
    const searchTerm = document.getElementById('searchTerm').value.trim();
    if (!searchTerm) {
      this.showStatusMessage('Please enter a search term', 'error');
      return;
    }

    console.log('🔍 Starting search with download type:', this.currentDownloadType);

    // Check if download type is set
    if (!this.currentDownloadType) {
      this.showStatusMessage('Download type not set. Please close and reopen the window.', 'error');
      console.error('❌ No download type set. Available types:', Object.keys(this.apiConfig));
      return;
    }

    this.showStatusMessage('Searching database...', 'info');
    this.clearResults();

    try {
      let results = [];

      switch (this.currentDownloadType) {
        case 'ncbi-unified': // Get the selected database type from the UI
        {
          const ncbiDb = document.getElementById('ncbiDatabase')?.value || 'nucleotide';
          results = await this.searchNCBIUnified(searchTerm, ncbiDb);
          break;
        }

        case 'embl-unified': // Get the selected database type from the UI
        {
          const emblDb = document.getElementById('emblDatabase')?.value || 'embl-sequences';
          results = await this.searchEMBLUnified(searchTerm, emblDb);
          break;
        }

        case 'ncbi-genbank':
        case 'ncbi-refseq':
        case 'ncbi-sra':
        case 'ncbi-assembly':
          results = await this.searchNCBI(searchTerm);
          break;

        case 'embl-sequences':
          results = await this.searchEMBL(searchTerm);
          break;

        case 'ensembl-genomes':
          results = await this.searchEnsembl(searchTerm);
          break;

        case 'ena-archive':
          results = await this.searchENA(searchTerm);
          break;

        case 'uniprot-proteins':
          results = await this.searchUniProt(searchTerm);
          break;

        case 'kegg-pathways':
          results = await this.searchKEGG(searchTerm);
          break;

        default:
          throw new Error('Unsupported download type');
      }

      this.searchResults = results;
      this.displayResults(results);

      if (results.length > 0) {
        this.showStatusMessage(`Found ${results.length} results`, 'success');
        this.enableDownloadButtons();
      } else {
        // Provide helpful suggestions based on download type and search term
        let helpMessage = 'No results found. ';

        if (this.currentDownloadType === 'ncbi-unified') {
          const ncbiDb = document.getElementById('ncbiDatabase')?.value;

          if (ncbiDb === 'genome' && /^\d+$/.test(searchTerm.trim())) {
            helpMessage +=
              'Try: (1) Switch to "RefSeq Genomes" database, or (2) Search "Escherichia coli" instead of strain number.';
          } else if (/^\d+$/.test(searchTerm.trim())) {
            helpMessage +=
              'For strain numbers like "1655", try searching the full organism name like "Escherichia coli K-12 MG1655".';
          } else {
            helpMessage += 'Try: (1) Use different search terms, (2) Switch database type, or (3) Add organism filter.';
          }
        } else {
          helpMessage += 'Try using different search terms or check your query.';
        }

        this.showStatusMessage(helpMessage, 'info');
      }
    } catch (error) {
      console.error('Search error:', error);
      this.showStatusMessage(`Search failed: ${error.message}`, 'error');
    }
  }

  async searchNCBI(searchTerm) {
    const config = this.apiConfig[this.currentDownloadType];
    const resultsLimit = document.getElementById('resultsLimit').value;

    // Build the search query
    let query = searchTerm;

    // Add specific filters
    const organism = document.getElementById('organism')?.value;
    if (organism) {
      query += ` AND "${organism}"[Organism]`;
    }

    const minLength = document.getElementById('minLength')?.value;
    const maxLength = document.getElementById('maxLength')?.value;
    if (minLength && maxLength) {
      query += ` AND ${minLength}:${maxLength}[SLEN]`;
    }

    // Special handling for genome database
    if (config.searchDb === 'genome') {
      console.warn('⚠️ NCBI Genome database in E-utilities is deprecated. Switching to NCBI Datasets API...');

      // Use the new NCBI Datasets API instead of E-utilities
      return await this.searchNCBIDatasets(searchTerm, resultsLimit);
    }

    // Special handling for assembly database (RefSeq genomes)
    if (config.searchDb === 'assembly') {
      // Optimize query for assembly database
      if (!query.includes('[Organism]') && !organism) {
        // Add organism filter for better assembly results
        query = `"${searchTerm}"[Organism] OR ${searchTerm}[Infraspecific name] OR ${searchTerm}[Assembly name]`;
      }
      // Add RefSeq filter for assembly database
      query += ' AND ("latest refseq"[Filter] OR "refseq"[Filter])';
    }

    // Special handling for nucleotide database with numeric-only searches
    if (config.searchDb === 'nucleotide' && /^\d+$/.test(searchTerm.trim())) {
      // Could be an accession number, GI, or taxonomy ID
      console.log('🔍 Numeric search in nucleotide database - searching as accession, GI, or taxonomy ID');
      // Search in multiple fields
      query = `${searchTerm}[Accession] OR ${searchTerm}[GI] OR txid${searchTerm}[Organism]`;
    }

    // NCBI E-utilities search
    const searchUrl = `${config.baseUrl}esearch.fcgi?db=${config.searchDb}&term=${encodeURIComponent(query)}&retmax=${resultsLimit}&retmode=json`;

    console.log('NCBI Search URL:', searchUrl); // Debug logging
    console.log('NCBI Search Query:', query); // Debug logging

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    console.log('NCBI Search Response:', searchData); // Debug logging

    if (!searchData.esearchresult?.idlist?.length) {
      // Provide helpful error message
      if (config.searchDb === 'genome' && /^\d+$/.test(searchTerm.trim())) {
        console.log(
          '⚠️ No results in genome database. Try searching "Escherichia coli" or using Assembly/Nucleotide database.'
        );
      }
      return [];
    }

    // Fetch detailed information
    const ids = searchData.esearchresult.idlist.join(',');
    const summaryUrl = `${config.baseUrl}esummary.fcgi?db=${config.searchDb}&id=${ids}&retmode=json`;

    const summaryResponse = await fetch(summaryUrl);
    const summaryData = await summaryResponse.json();

    console.log('NCBI Summary Response:', summaryData); // Debug logging

    const results = [];
    for (const id of searchData.esearchresult.idlist) {
      const summary = summaryData.result[id];
      if (summary) {
        // Enhanced result processing for different databases
        const result = this.processNCBIResult(summary, id, config.searchDb);
        results.push(result);
      }
    }

    return results;
  }

  processNCBIResult(summary, id, database) {
    // Base result structure
    const baseResult = {
      id: id,
      accession: summary.caption || summary.accessionversion || id,
      title: summary.title || 'No title available',
      organism: summary.organism || 'Unknown',
      length: summary.slen || 0,
      description: summary.extra || '',
      database: database,
      downloadUrl: this.getNCBIDownloadUrl(id, database),
    };

    // Database-specific processing
    switch (database) {
      case 'assembly': // Store FTP paths for proper file downloads
      {
        const ftpPath = summary.ftppath_refseq || summary.ftppath_genbank;
        const assemblyAccession = summary.assemblyaccession || summary.caption || id;

        return {
          ...baseResult,
          accession: assemblyAccession,
          title: summary.assemblyname || summary.title || summary.assemblydescription || 'No title available',
          organism: summary.speciesname || summary.organism || summary.infraspecificname || 'Unknown',
          length: parseInt(summary.totallength) || parseInt(summary.total_length) || parseInt(summary.slen) || 0,
          description: `Assembly: ${assemblyAccession} | Status: ${summary.assemblystatus || summary.status || 'Unknown'} | Level: ${summary.assemblylevel || summary.level || 'Unknown'}`,
          assemblyLevel: summary.assemblylevel || summary.level || 'Unknown',
          assemblyStatus: summary.assemblystatus || summary.status || 'Unknown',
          submitter: summary.submitterorganization || summary.submitter || 'Unknown',
          // Store FTP paths for download
          ftpPath_refseq: summary.ftppath_refseq || null,
          ftpPath_genbank: summary.ftppath_genbank || null,
          ftpPath: ftpPath || null,
          // Construct direct download URL for assembly
          downloadUrl: ftpPath
            ? this.constructAssemblyDownloadUrl(ftpPath, assemblyAccession, 'genbank')
            : baseResult.downloadUrl,
        };
      }

      case 'genome':
        return {
          ...baseResult,
          organism: summary.organism_name || summary.organism || 'Unknown',
          description: `Genome: ${summary.defline || summary.title || 'Unknown'} | Size: ${summary.total_length ? (summary.total_length / 1000000).toFixed(2) + ' Mb' : 'Unknown'}`,
          genomeSize: summary.total_length || 0,
        };

      case 'nucleotide':
        return {
          ...baseResult,
          description: `${summary.extra || summary.title || 'No description'} | GI: ${summary.gi || 'N/A'}`,
          gi: summary.gi || null,
        };

      case 'protein':
        return {
          ...baseResult,
          description: `${summary.extra || summary.title || 'No description'} | Length: ${summary.slen || 0} aa`,
          aaLength: summary.slen || 0,
        };

      case 'sra':
        return {
          ...baseResult,
          title: summary.title || summary.runs || 'No title available',
          description: `SRA: ${summary.runs || 'Unknown'} | Experiment: ${summary.expname || 'Unknown'} | Platform: ${summary.platform || 'Unknown'}`,
          platform: summary.platform || 'Unknown',
          runs: summary.runs || 'Unknown',
        };

      default:
        return baseResult;
    }
  }

  /**
   * Search using NCBI Datasets API v2 (modern API for genomes)
   * This replaces the deprecated E-utilities genome database
   */
  async searchNCBIDatasets(searchTerm, resultsLimit = 25) {
    console.log('🆕 Using NCBI Datasets API v2 for genome search...');

    try {
      let apiUrl;
      let taxonId = null;

      // Detect if search term is a taxonomy ID (numeric only)
      if (/^\d+$/.test(searchTerm.trim())) {
        taxonId = searchTerm.trim();
        console.log(`🔍 Detected taxonomy ID: ${taxonId}`);
        // Use taxon endpoint directly
        apiUrl = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon/${taxonId}/dataset_report?limit=${resultsLimit}`;
      } else {
        // Search by organism name - first get taxonomy ID
        console.log(`🔍 Searching for organism: ${searchTerm}`);
        const taxonSearchUrl = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/taxonomy/taxon_suggest/${encodeURIComponent(searchTerm)}`;

        const taxonResponse = await fetch(taxonSearchUrl);
        if (!taxonResponse.ok) {
          console.error('❌ Failed to search taxonomy:', taxonResponse.statusText);
          throw new Error(`Taxonomy search failed: ${taxonResponse.statusText}`);
        }

        const taxonData = await taxonResponse.json();
        console.log('Taxonomy search results:', taxonData);

        if (taxonData.sci_name_and_ids && taxonData.sci_name_and_ids.length > 0) {
          taxonId = taxonData.sci_name_and_ids[0].tax_id;
          console.log(`✅ Found taxonomy ID: ${taxonId} for ${taxonData.sci_name_and_ids[0].sci_name}`);
          apiUrl = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/taxon/${taxonId}/dataset_report?limit=${resultsLimit}`;
        } else {
          console.warn('⚠️ No taxonomy found for search term');
          return [];
        }
      }

      // Fetch genome data from Datasets API
      console.log('Datasets API URL:', apiUrl);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        console.error('❌ Datasets API request failed:', response.statusText);
        throw new Error(`Datasets API failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Datasets API Response:', data);

      if (!data.reports || data.reports.length === 0) {
        console.log('⚠️ No genome data found for this taxon');
        return [];
      }

      // Process results
      const results = [];
      for (const report of data.reports.slice(0, resultsLimit)) {
        const assembly = report.assembly_info || {};
        const organism = report.organism || {};
        const accession = assembly.assembly_accession || 'Unknown';

        results.push({
          id: accession,
          accession: accession,
          title: assembly.assembly_name || organism.organism_name || 'No title available',
          organism: organism.organism_name || 'Unknown',
          length: assembly.total_sequence_length || 0,
          description: `Assembly: ${accession} | Level: ${assembly.assembly_level || 'Unknown'} | Status: ${assembly.assembly_status || 'Unknown'}`,
          database: 'genome-datasets',
          assemblyLevel: assembly.assembly_level || 'Unknown',
          assemblyStatus: assembly.assembly_status || 'Unknown',
          submitter: assembly.submitter || 'Unknown',
          taxonId: organism.tax_id || taxonId,
          // Use Datasets API download URL
          downloadUrl: `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/${accession}/download?include_annotation_type=GENOME_FASTA&include_annotation_type=GENOME_GFF&include_annotation_type=RNA_FASTA&include_annotation_type=CDS_FASTA&include_annotation_type=PROT_FASTA&include_annotation_type=SEQUENCE_REPORT&filename=${accession}.zip`,
        });
      }

      console.log(`✅ Found ${results.length} genome(s) using Datasets API`);
      return results;
    } catch (error) {
      console.error('Error searching NCBI Datasets API:', error);
      throw new Error(`Datasets API search failed: ${error.message}`);
    }
  }

  async searchNCBIUnified(searchTerm, database) {
    // Use the existing searchNCBI method but override the database
    const originalDownloadType = this.currentDownloadType;

    // Temporarily set the config to use the selected database
    const config = { ...this.apiConfig['ncbi-unified'] };
    config.searchDb = database;

    // Temporarily update the current download type config
    this.apiConfig[this.currentDownloadType] = config;

    try {
      const results = await this.searchNCBI(searchTerm);
      return results;
    } finally {
      // Restore original config
      this.apiConfig[originalDownloadType] = this.apiConfig['ncbi-unified'];
    }
  }

  async searchEMBLUnified(searchTerm, database) {
    switch (database) {
      case 'embl-sequences':
        return await this.searchEMBL(searchTerm);
      case 'ensembl-genomes':
        return await this.searchEnsembl(searchTerm);
      case 'ena-archive':
        return await this.searchENA(searchTerm);
      default:
        return await this.searchEMBL(searchTerm);
    }
  }

  async searchEMBL(searchTerm) {
    // EMBL-EBI API search implementation
    const url = `https://www.ebi.ac.uk/ena/portal/api/search?result=sequence&query=${encodeURIComponent(searchTerm)}&format=json&limit=${document.getElementById('resultsLimit').value}`;

    const response = await fetch(url);
    const data = await response.json();

    return data.map(item => ({
      id: item.accession,
      accession: item.accession,
      title: item.description || 'No title available',
      organism: item.scientific_name || 'Unknown',
      length: item.base_count || 0,
      description: item.description || '',
      database: 'embl',
      downloadUrl: `https://www.ebi.ac.uk/ena/browser/api/fasta/${item.accession}`,
    }));
  }

  async searchEnsembl(searchTerm) {
    // Ensembl REST API search
    document.getElementById('division')?.value || 'vertebrates';
    const url = `https://rest.ensembl.org/taxonomy/name/${encodeURIComponent(searchTerm)}?content-type=application/json`;

    const response = await fetch(url);
    const data = await response.json();

    const results = [];
    if (Array.isArray(data)) {
      for (const item of data.slice(0, parseInt(document.getElementById('resultsLimit').value))) {
        results.push({
          id: item.id,
          accession: item.scientific_name,
          title: item.scientific_name,
          organism: item.scientific_name,
          length: 0,
          description: `Taxonomy ID: ${item.id}`,
          database: 'ensembl',
          downloadUrl: `https://rest.ensembl.org/sequence/id/${item.id}?content-type=text/x-fasta`,
        });
      }
    }

    return results;
  }

  async searchENA(searchTerm) {
    // ENA Portal API search
    const url = `https://www.ebi.ac.uk/ena/portal/api/search?result=read_run&query=${encodeURIComponent(searchTerm)}&format=json&limit=${document.getElementById('resultsLimit').value}`;

    const response = await fetch(url);
    const data = await response.json();

    return data.map(item => ({
      id: item.run_accession,
      accession: item.run_accession,
      title: item.experiment_title || 'No title available',
      organism: item.scientific_name || 'Unknown',
      length: item.base_count || 0,
      description: `Study: ${item.study_accession}, Sample: ${item.sample_accession}`,
      database: 'ena',
      downloadUrl: item.fastq_ftp ? `ftp://${item.fastq_ftp.split(';')[0]}` : null,
    }));
  }

  async searchUniProt(searchTerm) {
    // UniProt REST API search
    const reviewed = document.getElementById('reviewed')?.value;
    let query = searchTerm;

    if (reviewed === 'true') {
      query += ' AND reviewed:true';
    } else if (reviewed === 'false') {
      query += ' AND reviewed:false';
    }

    const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(query)}&format=json&size=${document.getElementById('resultsLimit').value}`;

    const response = await fetch(url);
    const data = await response.json();

    return data.results.map(item => ({
      id: item.primaryAccession,
      accession: item.primaryAccession,
      title: item.proteinDescription?.recommendedName?.fullName?.value || 'No title available',
      organism: item.organism?.scientificName || 'Unknown',
      length: item.sequence?.length || 0,
      description: item.proteinDescription?.recommendedName?.fullName?.value || '',
      database: 'uniprot',
      downloadUrl: `https://rest.uniprot.org/uniprotkb/${item.primaryAccession}.fasta`,
    }));
  }

  async searchKEGG(searchTerm) {
    // KEGG REST API search
    const url = `https://rest.kegg.jp/find/genome/${encodeURIComponent(searchTerm)}`;

    const response = await fetch(url);
    const text = await response.text();

    const results = [];
    const lines = text.split('\n').filter(line => line.trim());

    for (const line of lines.slice(0, parseInt(document.getElementById('resultsLimit').value))) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const id = parts[0];
        const description = parts[1];

        results.push({
          id: id,
          accession: id,
          title: description,
          organism: description.split(',')[0] || 'Unknown',
          length: 0,
          description: description,
          database: 'kegg',
          downloadUrl: `https://rest.kegg.jp/get/${id}/fasta`,
        });
      }
    }

    return results;
  }

  getNCBIDownloadUrl(id, database) {
    const formatMap = {
      nucleotide: 'fasta',
      genome: 'fasta',
      assembly: 'docsum', // Assembly uses docsum to get FTP links
      protein: 'fasta',
      sra: 'runinfo',
    };

    const format = formatMap[database] || 'fasta';

    // Special handling for assembly database
    if (database === 'assembly') {
      // Return assembly summary URL which contains FTP download links
      return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=${database}&id=${id}&retmode=json`;
    }

    return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=${database}&id=${id}&rettype=${format}&retmode=text`;
  }

  /**
   * Construct proper download URL for assembly files from FTP path
   * @param {string} ftpPath - FTP path from NCBI (e.g., ftp://ftp.ncbi.nlm.nih.gov/genomes/all/GCF/...)
   * @param {string} accession - Assembly accession (e.g., GCF_033344675.1)
   * @param {string} format - Desired format: 'genbank', 'fasta', 'gff'
   * @returns {string} HTTPS download URL
   */
  constructAssemblyDownloadUrl(ftpPath, accession, format = 'genbank') {
    if (!ftpPath) {
      console.warn('⚠️ No FTP path available for assembly download');
      return null;
    }

    // Convert FTP to HTTPS URL
    const httpsPath = ftpPath.replace('ftp://', 'https://');

    // Extract assembly name from FTP path (last part after the accession)
    // Example: ftp://...GCF_033344675.1_ASM3334467v1 -> ASM3334467v1
    const pathParts = ftpPath.split('/');
    const assemblyDir = pathParts[pathParts.length - 1]; // e.g., GCF_033344675.1_ASM3334467v1

    // File naming convention: {assemblyDir}_genomic.{extension}
    let filename;
    switch (format) {
      case 'genbank':
        filename = `${assemblyDir}_genomic.gbff.gz`;
        break;
      case 'fasta':
        filename = `${assemblyDir}_genomic.fna.gz`;
        break;
      case 'gff':
        filename = `${assemblyDir}_genomic.gff.gz`;
        break;
      case 'protein':
        filename = `${assemblyDir}_protein.faa.gz`;
        break;
      case 'cds':
        filename = `${assemblyDir}_cds_from_genomic.fna.gz`;
        break;
      default:
        filename = `${assemblyDir}_genomic.gbff.gz`;
    }

    const downloadUrl = `${httpsPath}/${filename}`;
    console.log(`🔗 Constructed assembly download URL: ${downloadUrl}`);

    return downloadUrl;
  }

  // Helper function to get file category preview
  getCategoryPreview(result) {
    const fileFormat = document.getElementById('fileFormat').value;
    const extension = this.getFileExtension(fileFormat);

    // Simulate the categorization logic from main.js
    const database = result.database;

    // Database-specific categorization (highest priority)
    if (database) {
      switch (database) {
        case 'protein':
        case 'uniprot':
          return { category: 'proteins', icon: '🧬', color: '#e91e63' };
        case 'sra':
          return { category: 'sequencing_data', icon: '🧬', color: '#9c27b0' };
        case 'assembly':
        case 'genome-datasets': // New Datasets API genomes
          return { category: 'genomes', icon: '🧬', color: '#4caf50' };
        case 'pubmed':
          return { category: 'literature', icon: '📚', color: '#ff9800' };
        default:
          break;
      }
    }

    // Extension-based categorization
    switch (extension.toLowerCase()) {
      case '.fasta':
      case '.fa':
        if (database === 'protein') {
          return { category: 'proteins', icon: '🧬', color: '#e91e63' };
        } else {
          return { category: 'genomes', icon: '🧬', color: '#4caf50' };
        }
      case '.gb':
      case '.gbk':
        return { category: 'genomes', icon: '🧬', color: '#4caf50' };
      case '.gff':
      case '.gff3':
      case '.gtf':
        return { category: 'annotations', icon: '📝', color: '#2196f3' };
      case '.vcf':
        return { category: 'variants', icon: '🔬', color: '#ff5722' };
      case '.fastq':
      case '.fq':
        return { category: 'sequencing_data', icon: '🧬', color: '#9c27b0' };
      case '.embl':
        return { category: 'genomes', icon: '🧬', color: '#4caf50' };
      default:
        return { category: 'root directory', icon: '📁', color: '#607d8b' };
    }
  }

  displayResults(results) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    if (results.length === 0) {
      resultsContainer.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 50px;">No results found</p>';
      return;
    }

    // Generate category distribution summary
    const categoryDistribution = {};
    results.forEach(result => {
      const categoryInfo = this.getCategoryPreview(result);
      categoryDistribution[categoryInfo.category] = (categoryDistribution[categoryInfo.category] || 0) + 1;
    });

    // Create category summary HTML
    let categorySummaryHtml =
      '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px;">';
    categorySummaryHtml += '<h4 style="margin: 0 0 10px 0; color: #495057;">📊 File Organization Preview</h4>';
    categorySummaryHtml += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';

    Object.entries(categoryDistribution).forEach(([category, count]) => {
      this.getCategoryPreview({ database: null }); // Get default info
      // Find the actual category info
      let actualInfo = { icon: '📁', color: '#607d8b' };
      for (const result of results) {
        const info = this.getCategoryPreview(result);
        if (info.category === category) {
          actualInfo = info;
          break;
        }
      }

      categorySummaryHtml += `
                <span style="display: inline-block; padding: 6px 12px; background: ${actualInfo.color}20; color: ${actualInfo.color}; border-radius: 16px; font-size: 13px; font-weight: bold;">
                    ${actualInfo.icon} ${category}: ${count} file${count > 1 ? 's' : ''}
                </span>
            `;
    });

    categorySummaryHtml += '</div></div>';

    let html = categorySummaryHtml;
    results.forEach((result, index) => {
      // Format length based on database type
      let lengthDisplay;
      if (result.database === 'assembly' && result.length > 1000000) {
        lengthDisplay = `${(result.length / 1000000).toFixed(2)} Mb`;
      } else if (result.database === 'protein') {
        lengthDisplay = `${result.length.toLocaleString()} aa`;
      } else {
        lengthDisplay = `${result.length.toLocaleString()} bp`;
      }

      // Get category preview for this result
      const categoryInfo = this.getCategoryPreview(result);

      // Enhanced details based on database type
      let extraDetails = '';
      if (result.database === 'assembly') {
        extraDetails = `
                    <div class="result-details">
                        <strong>Assembly Level:</strong> ${result.assemblyLevel || 'Unknown'} | 
                        <strong>Status:</strong> ${result.assemblyStatus || 'Unknown'}
                        ${result.submitter ? ` | <strong>Submitter:</strong> ${result.submitter}` : ''}
                    </div>
                `;
      } else if (result.database === 'sra') {
        extraDetails = `
                    <div class="result-details">
                        <strong>Platform:</strong> ${result.platform || 'Unknown'} | 
                        <strong>Runs:</strong> ${result.runs || 'Unknown'}
                    </div>
                `;
      }

      html += `
                <div class="result-item" data-result-index="${index}">
                    <div class="result-title">${result.title}</div>
                    <div class="result-details">
                        <strong>Accession:</strong> ${result.accession} | 
                        <strong>Organism:</strong> ${result.organism} | 
                        <strong>Size:</strong> ${lengthDisplay}
                    </div>
                    ${extraDetails}
                    <div class="result-details">${result.description}</div>
                    <div class="result-details" style="margin-top: 8px;">
                        <span style="display: inline-block; padding: 4px 8px; background: ${categoryInfo.color}20; color: ${categoryInfo.color}; border-radius: 12px; font-size: 12px; font-weight: bold;">
                            ${categoryInfo.icon} Will be saved to: ${categoryInfo.category}/
                        </span>
                    </div>
                    <div class="result-actions">
                        <input type="checkbox" class="result-checkbox" data-index="${index}" 
                               onchange="window.genomicDownloader.toggleResultSelection(${index})">
                        <label>Select for download</label>
                        <button class="btn" onclick="window.genomicDownloader.previewResult(${index})" 
                                style="margin-left: 10px;">👁️ Preview</button>
                    </div>
                </div>
            `;
    });

    resultsContainer.innerHTML = html;
  }

  toggleResultSelection(index) {
    if (this.selectedResults.has(index)) {
      this.selectedResults.delete(index);
    } else {
      this.selectedResults.add(index);
    }

    this.updateDownloadButtons();
  }

  updateDownloadButtons() {
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');

    if (downloadSelectedBtn) {
      downloadSelectedBtn.disabled = this.selectedResults.size === 0;
    }

    if (downloadAllBtn) {
      downloadAllBtn.disabled = this.searchResults.length === 0;
    }
  }

  enableDownloadButtons() {
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    if (downloadAllBtn) {
      downloadAllBtn.disabled = false;
    }
  }

  async previewResult(index) {
    const result = this.searchResults[index];
    if (!result) return;

    try {
      // Add CSS styles (if not already present)
      if (!document.querySelector('#modal-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `
                    .modal {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.5);
                        z-index: 10000;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .modal-content {
                        background: white;
                        border-radius: 12px;
                        max-width: 90%;
                        max-height: 90%;
                        overflow: auto;
                    }
                    .modal-header {
                        padding: 20px;
                        border-bottom: 1px solid #ecf0f1;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .modal-body {
                        padding: 20px;
                    }
                    .modal-footer {
                        padding: 20px;
                        border-top: 1px solid #ecf0f1;
                        text-align: right;
                    }
                `;
        document.head.appendChild(style);
      }

      // Show the preview modal
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
                <div class="modal-content" style="max-width: 800px;">
                    <div class="modal-header">
                        <h3>📄 Preview: ${result.title}</h3>
                        <button onclick="this.closest('.modal').remove()" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="status-info">
                            <strong>Accession:</strong> ${result.accession}<br>
                            <strong>Organism:</strong> ${result.organism}<br>
                            <strong>Length:</strong> ${result.length.toLocaleString()} bp<br>
                            <strong>Database:</strong> ${result.database.toUpperCase()}
                        </div>
                        <div style="margin-top: 15px;">
                            <strong>Description:</strong><br>
                            <p>${result.description}</p>
                        </div>
                        <div style="margin-top: 15px;">
                            <strong>Download URL:</strong><br>
                            <a href="${result.downloadUrl}" target="_blank" style="word-break: break-all;">${result.downloadUrl}</a>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                        <button class="btn btn-success" onclick="window.genomicDownloader.downloadSingle(${index}); this.closest('.modal').remove();">📥 Download This Item</button>
                    </div>
                </div>
            `;

      document.body.appendChild(modal);

      // Close the modal when clicking outside
      modal.addEventListener('click', e => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    } catch (error) {
      console.error('Error previewing result:', error);
      this.showStatusMessage('Failed to preview result', 'error');
    }
  }

  async selectOutputDirectory() {
    if (window.electronAPI && window.electronAPI.selectDirectory) {
      try {
        const result = await window.electronAPI.selectDirectory();
        if (result.success && !result.canceled) {
          this.outputDirectory = result.filePath;
          document.getElementById('outputDir').value = result.filePath;
        }
      } catch (error) {
        console.error('Error selecting directory:', error);
        this.showStatusMessage('Failed to select directory', 'error');
      }
    } else {
      this.showStatusMessage('Directory selection requires Electron environment', 'error');
    }
  }

  async downloadSelected() {
    if (this.selectedResults.size === 0) {
      this.showStatusMessage('Please select items to download', 'warning');
      return;
    }

    const selectedItems = Array.from(this.selectedResults).map(index => this.searchResults[index]);
    await this.startDownload(selectedItems);
  }

  async downloadAll() {
    if (this.searchResults.length === 0) {
      this.showStatusMessage('No results available for download', 'warning');
      return;
    }

    await this.startDownload(this.searchResults);
  }

  async downloadSingle(index) {
    const result = this.searchResults[index];
    if (!result) return;

    await this.startDownload([result]);
  }

  async startDownload(items) {
    if (this.isDownloading) {
      this.showStatusMessage('Download already in progress', 'warning');
      return;
    }

    if (!this.outputDirectory) {
      this.showStatusMessage('Please select an output directory', 'warning');
      return;
    }

    this.isDownloading = true;
    this.downloadQueue = [...items];

    const progressElement = document.getElementById('downloadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (progressElement) progressElement.style.display = 'block';

    this.showStatusMessage(`Starting download of ${items.length} item(s)...`, 'info');

    let completed = 0;
    const total = items.length;

    for (const item of items) {
      try {
        // Get category preview for progress display
        const categoryInfo = this.getCategoryPreview(item);

        if (progressText) {
          progressText.innerHTML = `${categoryInfo.icon} Downloading ${item.accession} to ${categoryInfo.category}/... (${completed + 1}/${total})`;
        }

        await this.downloadItem(item);
        completed++;

        const progress = (completed / total) * 100;
        if (progressBar) {
          progressBar.style.width = `${progress}%`;
        }

        this.showStatusMessage(
          `✅ Downloaded & categorized ${item.accession} → ${categoryInfo.category}/ (${completed}/${total})`,
          'success'
        );
      } catch (error) {
        console.error(`Failed to download ${item.accession}:`, error);
        this.showStatusMessage(`Failed to download ${item.accession}: ${error.message}`, 'error');
      }
    }

    this.isDownloading = false;

    if (progressElement) progressElement.style.display = 'none';

    // Generate download completion summary with project integration stats
    if (this.currentProject && completed > 0) {
      // Create detailed completion summary
      const categoryStats = {};
      for (const item of items) {
        if (items.indexOf(item) < completed) {
          // Only count completed downloads
          const categoryInfo = this.getCategoryPreview(item);
          categoryStats[categoryInfo.category] = (categoryStats[categoryInfo.category] || 0) + 1;
        }
      }

      let summaryHtml = `
                <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 10px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #155724;">🎉 Download Complete - Project Integration Summary</h4>
                    <p style="margin: 0 0 10px 0; color: #155724;"><strong>Successfully downloaded ${completed}/${total} files to project:</strong> ${this.currentProject.name}</p>
                    <p style="margin: 0 0 10px 0; color: #155724;"><strong>File organization:</strong></p>
                    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
            `;

      Object.entries(categoryStats).forEach(([category, count]) => {
        const categoryInfo = this.getCategoryPreview(
          items.find(item => this.getCategoryPreview(item).category === category)
        );
        summaryHtml += `
                    <span style="display: inline-block; padding: 4px 8px; background: ${categoryInfo.color}40; color: ${categoryInfo.color}; border-radius: 12px; font-size: 12px; font-weight: bold;">
                        ${categoryInfo.icon} ${category}: ${count} file${count > 1 ? 's' : ''}
                    </span>
                `;
      });

      summaryHtml += `
                    </div>
                    <p style="margin: 10px 0 0 0; color: #155724; font-size: 14px;">Files have been automatically indexed in your project and are ready to use!</p>
                </div>
            `;

      const statusContainer = document.getElementById('statusMessages');
      if (statusContainer) {
        const summaryElement = document.createElement('div');
        summaryElement.innerHTML = summaryHtml;
        statusContainer.appendChild(summaryElement);

        // Auto-remove summary after 10 seconds
        setTimeout(() => {
          if (summaryElement.parentNode) {
            summaryElement.parentNode.removeChild(summaryElement);
          }
        }, 10000);
      }
    }

    this.showStatusMessage(
      `🎉 Download completed! Downloaded & intelligently categorized ${completed}/${total} items into project folders.`,
      'success'
    );
  }

  async downloadItem(item) {
    if (!window.electronAPI || !window.electronAPI.downloadFile) {
      throw new Error('Download functionality requires Electron environment');
    }

    const fileFormat = document.getElementById('fileFormat').value;
    let extension = this.getFileExtension(fileFormat);
    let filename = `${item.accession}${extension}`;
    let outputPath = `${this.outputDirectory}/${filename}`;

    // Generate the correct download URL based on selected file format
    let downloadUrl = item.downloadUrl;

    // Special handling for assembly database - use FTP paths
    if (item.database === 'assembly' && item.ftpPath) {
      downloadUrl = this.constructAssemblyDownloadUrl(item.ftpPath, item.accession, fileFormat);
      // Assembly files are gzipped, update filename
      extension = this.getFileExtension(fileFormat) + '.gz';
      filename = `${item.accession}${extension}`;
      outputPath = `${this.outputDirectory}/${filename}`;
      console.log(`🔄 Using FTP path for assembly download: ${downloadUrl}`);
    }
    // For other NCBI databases, regenerate URL with correct format
    else if (
      (item.database === 'nucleotide' || item.database === 'protein' || item.database === 'genome') &&
      item.database !== 'genome-datasets'
    ) {
      downloadUrl = this.getNCBIDownloadUrlWithFormat(item.id, item.database, fileFormat);
      console.log(`🔄 Regenerated download URL for ${fileFormat} format:`, downloadUrl);
    }

    // Enhance project info with database context for better categorization
    const enhancedProjectInfo = {
      ...this.currentProject,
      downloadContext: {
        database: item.database,
        downloadType: this.currentDownloadType,
        fileFormat: fileFormat,
        sourceUrl: downloadUrl,
      },
    };

    // Use Electron's download API, passing enhanced project info
    const result = await window.electronAPI.downloadFile(downloadUrl, outputPath, enhancedProjectInfo);

    if (!result.success) {
      throw new Error(result.error || 'Download failed');
    }

    return result;
  }

  /**
   * Get NCBI download URL with specific format
   * This method generates the correct efetch URL based on user-selected file format
   */
  getNCBIDownloadUrlWithFormat(id, database, fileFormat) {
    const baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

    // Map user-selected format to NCBI rettype parameter
    const formatToRettype = {
      fasta: 'fasta',
      genbank: 'gb', // GenBank format
      gff: 'gff3', // GFF3 format
      embl: 'embl', // EMBL format
    };

    const rettype = formatToRettype[fileFormat] || 'fasta';

    // For some databases and formats, we need different parameters
    const retmode = 'text';

    // Assembly database doesn't support efetch, return FTP link instead
    if (database === 'assembly') {
      console.warn('⚠️ Assembly database requires FTP download, format may not be changeable');
      return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=${database}&id=${id}&retmode=json`;
    }

    const url = `${baseUrl}?db=${database}&id=${id}&rettype=${rettype}&retmode=${retmode}`;
    console.log(`🎯 Generated ${fileFormat} download URL:`, url);

    return url;
  }

  getFileExtension(format) {
    const extensions = {
      fasta: '.fasta',
      genbank: '.gb',
      gff: '.gff',
      embl: '.embl',
    };

    return extensions[format] || '.txt';
  }

  clearSearch() {
    document.getElementById('searchTerm').value = '';
    const additionalInputs = document.querySelectorAll(
      '#databaseSpecificOptions input, #databaseSpecificOptions select'
    );
    additionalInputs.forEach(input => {
      if (input.type === 'checkbox') {
        input.checked = false;
      } else {
        input.value = '';
      }
    });

    this.clearResults();
  }

  clearResults() {
    this.searchResults = [];
    this.selectedResults.clear();

    const resultsContainer = document.getElementById('searchResults');
    if (resultsContainer) {
      resultsContainer.innerHTML =
        '<p style="text-align: center; color: #6c757d; padding: 50px;">🔍 Enter search terms and click "Search Database" to find genomic data</p>';
    }

    this.updateDownloadButtons();
  }

  showStatusMessage(message, type = 'info') {
    const statusContainer = document.getElementById('statusMessages');
    if (!statusContainer) return;

    const messageElement = document.createElement('div');
    messageElement.className = `status-message status-${type}`;
    messageElement.textContent = message;

    statusContainer.appendChild(messageElement);

    // Automatically remove old messages
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.parentNode.removeChild(messageElement);
      }
    }, 5000);

    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

// Make GenomicDataDownloader available globally
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GenomicDataDownloader;
} else {
  window.GenomicDataDownloader = GenomicDataDownloader;
}
