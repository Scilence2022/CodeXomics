/**
 * GenomicDataDownloader - 基因组数据下载器
 * 支持从NCBI、EMBL-EBI、DDBJ等公共数据库下载基因组数据
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
        
        // API配置
        this.apiConfig = {
            'ncbi-unified': {
                name: 'NCBI Databases',
                baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
                description: 'Search and download data from all NCBI databases (GenBank, RefSeq, SRA, Assembly)',
                searchDb: 'nucleotide', // Default, can be changed by user
                retmax: 100,
                supportedDbs: ['nucleotide', 'genome', 'sra', 'assembly', 'protein', 'pubmed']
            },
            'embl-unified': {
                name: 'EMBL-EBI Databases',
                baseUrl: 'https://www.ebi.ac.uk/ena/browser/api/',
                description: 'Search and download data from EMBL-EBI databases (EMBL, Ensembl, ENA)',
                retmax: 50,
                supportedDbs: ['embl-sequences', 'ensembl-genomes', 'ena-archive']
            },
            // Legacy individual database configs for backward compatibility
            'ncbi-genbank': {
                name: 'NCBI GenBank',
                baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
                description: 'Search and download nucleotide sequences from NCBI GenBank database',
                searchDb: 'nucleotide',
                retmax: 100
            },
            'ncbi-refseq': {
                name: 'NCBI RefSeq',
                baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
                description: 'Download reference genome sequences from NCBI RefSeq',
                searchDb: 'genome',
                retmax: 50
            },
            'ncbi-sra': {
                name: 'NCBI SRA',
                baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
                description: 'Search sequencing read archives from NCBI SRA database',
                searchDb: 'sra',
                retmax: 25
            },
            'ncbi-assembly': {
                name: 'NCBI Assembly',
                baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
                description: 'Download genome assembly data from NCBI',
                searchDb: 'assembly',
                retmax: 50
            },
            'embl-sequences': {
                name: 'EMBL Sequences',
                baseUrl: 'https://www.ebi.ac.uk/ena/browser/api/',
                description: 'Search and download sequences from EMBL-EBI database',
                retmax: 50
            },
            'ensembl-genomes': {
                name: 'Ensembl Genomes',
                baseUrl: 'https://rest.ensembl.org/',
                description: 'Download genome data from Ensembl',
                retmax: 25
            },
            'ena-archive': {
                name: 'ENA Archive',
                baseUrl: 'https://www.ebi.ac.uk/ena/portal/api/',
                description: 'European Nucleotide Archive data',
                retmax: 50
            },
            'ddbj-sequences': {
                name: 'DDBJ Sequences',
                baseUrl: 'https://ddbj.nig.ac.jp/api/',
                description: 'DNA Data Bank of Japan sequences',
                retmax: 50
            },
            'uniprot-proteins': {
                name: 'UniProt Proteins',
                baseUrl: 'https://rest.uniprot.org/',
                description: 'Protein sequence and annotation data',
                retmax: 100
            },
            'kegg-pathways': {
                name: 'KEGG Pathways',
                baseUrl: 'https://rest.kegg.jp/',
                description: 'KEGG pathway and genome data',
                retmax: 50
            }
        };
        
        this.initialize();
    }
    
    initialize() {
        console.log('🧬 Initializing Genomic Data Downloader...');
        this.setupEventListeners();
        this.setupIpcListeners();
    }
    
    setupEventListeners() {
        // 搜索表单
        const searchForm = document.getElementById('searchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.performSearch();
            });
        }
        
        // 清除按钮
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearSearch());
        }
        
        // 目录选择
        const selectDirBtn = document.getElementById('selectDirBtn');
        if (selectDirBtn) {
            selectDirBtn.addEventListener('click', () => this.selectOutputDirectory());
        }
        
        // 下载按钮
        const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
        if (downloadSelectedBtn) {
            downloadSelectedBtn.addEventListener('click', () => this.downloadSelected());
        }
        
        const downloadAllBtn = document.getElementById('downloadAllBtn');
        if (downloadAllBtn) {
            downloadAllBtn.addEventListener('click', () => this.downloadAll());
        }
    }
    
    setupIpcListeners() {
        if (window.electronAPI) {
            // 监听下载类型设置
            window.electronAPI.onSetDownloadType((downloadType) => {
                console.log('📥 Received download type:', downloadType);
                this.setDownloadType(downloadType);
            });
            
            // 监听当前项目设置
            window.electronAPI.onSetActiveProject((projectInfo) => {
                console.log('📥 Received project info:', projectInfo);
                this.setActiveProject(projectInfo);
            });
            
            // 获取当前项目信息
            this.getCurrentProject();
            
            // If no project is available after a short delay, show no project info
            setTimeout(() => {
                if (!this.currentProject) {
                    this.setActiveProject(null);
                }
            }, 1000);
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
    
    showProjectInfo(projectInfo) {
        const databaseInfo = document.getElementById('databaseInfo');
        if (databaseInfo && projectInfo) {
            // Add project info to the database info panel
            const projectInfoHtml = `
                <div style="background: #e8f5e8; border: 1px solid #4caf50; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #2e7d32;">📁 Active Project</h4>
                    <p style="margin: 0; color: #424242;"><strong>Name:</strong> ${projectInfo.name || 'Unnamed Project'}</p>
                    <p style="margin: 0; color: #424242;"><strong>Data Folder:</strong> ${projectInfo.dataFolderPath || 'Not set'}</p>
                    <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">Downloaded files will be saved to: ${projectInfo.dataFolderPath}/genomes/</p>
                </div>
            `;
            
            // Insert project info before existing database info
            databaseInfo.innerHTML = projectInfoHtml + databaseInfo.innerHTML;
        }
    }
    
    showNoProjectInfo() {
        const databaseInfo = document.getElementById('databaseInfo');
        if (databaseInfo) {
            // Add no project info to the database info panel
            const noProjectInfoHtml = `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #856404;">📂 No Active Project</h4>
                    <p style="margin: 0; color: #856404;">You can download files without a project.</p>
                    <p style="margin: 5px 0 0 0; color: #6c757d; font-size: 14px;">Select a download directory manually using the "Select Directory" button below.</p>
                </div>
            `;
            
            // Insert no project info before existing database info
            databaseInfo.innerHTML = noProjectInfoHtml + databaseInfo.innerHTML;
        }
    }
    
    setDownloadType(downloadType) {
        console.log('🔧 Setting download type:', downloadType);
        this.currentDownloadType = downloadType;
        const config = this.apiConfig[downloadType];
        
        if (config) {
            console.log('✅ Found config for download type:', config.name);
            // 更新标题和描述
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
                databaseInfo.innerHTML = `
                    <h3>${config.name}</h3>
                    <p>${config.description}</p>
                    <p><strong>API Endpoint:</strong> ${config.baseUrl}</p>
                    <p><strong>Max Results:</strong> ${config.retmax}</p>
                `;
            }
            
            // 设置数据库特定选项
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
                        <option value="genome">RefSeq Genomes</option>
                        <option value="sra">SRA Sequencing Data</option>
                        <option value="assembly">Assembly Data</option>
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
                case 'ncbi-unified':
                    // Get the selected database type from the UI
                    const ncbiDb = document.getElementById('ncbiDatabase')?.value || 'nucleotide';
                    results = await this.searchNCBIUnified(searchTerm, ncbiDb);
                    break;
                    
                case 'embl-unified':
                    // Get the selected database type from the UI
                    const emblDb = document.getElementById('emblDatabase')?.value || 'embl-sequences';
                    results = await this.searchEMBLUnified(searchTerm, emblDb);
                    break;
                    
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
                this.showStatusMessage('No results found', 'info');
            }
            
        } catch (error) {
            console.error('Search error:', error);
            this.showStatusMessage(`Search failed: ${error.message}`, 'error');
        }
    }
    
    async searchNCBI(searchTerm) {
        const config = this.apiConfig[this.currentDownloadType];
        const resultsLimit = document.getElementById('resultsLimit').value;
        
        // 构建搜索查询
        let query = searchTerm;
        
        // 添加特定过滤器
        const organism = document.getElementById('organism')?.value;
        if (organism) {
            query += ` AND "${organism}"[Organism]`;
        }
        
        const minLength = document.getElementById('minLength')?.value;
        const maxLength = document.getElementById('maxLength')?.value;
        if (minLength && maxLength) {
            query += ` AND ${minLength}:${maxLength}[SLEN]`;
        }
        
        // NCBI E-utilities搜索
        const searchUrl = `${config.baseUrl}esearch.fcgi?db=${config.searchDb}&term=${encodeURIComponent(query)}&retmax=${resultsLimit}&retmode=json`;
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        if (!searchData.esearchresult?.idlist?.length) {
            return [];
        }
        
        // 获取详细信息
        const ids = searchData.esearchresult.idlist.join(',');
        const summaryUrl = `${config.baseUrl}esummary.fcgi?db=${config.searchDb}&id=${ids}&retmode=json`;
        
        const summaryResponse = await fetch(summaryUrl);
        const summaryData = await summaryResponse.json();
        
        const results = [];
        for (const id of searchData.esearchresult.idlist) {
            const summary = summaryData.result[id];
            if (summary) {
                results.push({
                    id: id,
                    accession: summary.caption || summary.accessionversion || id,
                    title: summary.title || 'No title available',
                    organism: summary.organism || 'Unknown',
                    length: summary.slen || 0,
                    description: summary.extra || '',
                    database: config.searchDb,
                    downloadUrl: this.getNCBIDownloadUrl(id, config.searchDb)
                });
            }
        }
        
        return results;
    }
    
    async searchNCBIUnified(searchTerm, database) {
        // Use the existing searchNCBI method but override the database
        const originalDownloadType = this.currentDownloadType;
        
        // Temporarily set the config to use the selected database
        const config = {...this.apiConfig['ncbi-unified']};
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
        // EMBL-EBI API搜索实现
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
            downloadUrl: `https://www.ebi.ac.uk/ena/browser/api/fasta/${item.accession}`
        }));
    }
    
    async searchEnsembl(searchTerm) {
        // Ensembl REST API搜索
        const division = document.getElementById('division')?.value || 'vertebrates';
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
                    downloadUrl: `https://rest.ensembl.org/sequence/id/${item.id}?content-type=text/x-fasta`
                });
            }
        }
        
        return results;
    }
    
    async searchENA(searchTerm) {
        // ENA Portal API搜索
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
            downloadUrl: item.fastq_ftp ? `ftp://${item.fastq_ftp.split(';')[0]}` : null
        }));
    }
    
    async searchUniProt(searchTerm) {
        // UniProt REST API搜索
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
            downloadUrl: `https://rest.uniprot.org/uniprotkb/${item.primaryAccession}.fasta`
        }));
    }
    
    async searchKEGG(searchTerm) {
        // KEGG REST API搜索
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
                    downloadUrl: `https://rest.kegg.jp/get/${id}/fasta`
                });
            }
        }
        
        return results;
    }
    
    getNCBIDownloadUrl(id, database) {
        const formatMap = {
            'nucleotide': 'fasta',
            'genome': 'fasta',
            'assembly': 'fasta',
            'sra': 'runinfo'
        };
        
        const format = formatMap[database] || 'fasta';
        return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=${database}&id=${id}&rettype=${format}&retmode=text`;
    }
    
    displayResults(results) {
        const resultsContainer = document.getElementById('searchResults');
        if (!resultsContainer) return;
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 50px;">No results found</p>';
            return;
        }
        
        let html = '';
        results.forEach((result, index) => {
            html += `
                <div class="result-item" data-result-index="${index}">
                    <div class="result-title">${result.title}</div>
                    <div class="result-details">
                        <strong>Accession:</strong> ${result.accession} | 
                        <strong>Organism:</strong> ${result.organism} | 
                        <strong>Length:</strong> ${result.length.toLocaleString()} bp
                    </div>
                    <div class="result-details">${result.description}</div>
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
            // 添加CSS样式（如果不存在）
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
            
            // 显示预览模态框
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
            
            // 点击外部关闭模态框
            modal.addEventListener('click', (e) => {
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
                if (progressText) {
                    progressText.textContent = `Downloading ${item.accession}... (${completed + 1}/${total})`;
                }
                
                await this.downloadItem(item);
                completed++;
                
                const progress = (completed / total) * 100;
                if (progressBar) {
                    progressBar.style.width = `${progress}%`;
                }
                
                this.showStatusMessage(`Downloaded ${item.accession} (${completed}/${total})`, 'success');
                
            } catch (error) {
                console.error(`Failed to download ${item.accession}:`, error);
                this.showStatusMessage(`Failed to download ${item.accession}: ${error.message}`, 'error');
            }
        }
        
        this.isDownloading = false;
        
        if (progressElement) progressElement.style.display = 'none';
        this.showStatusMessage(`Download completed! Downloaded ${completed}/${total} items.`, 'success');
    }
    
    async downloadItem(item) {
        if (!window.electronAPI || !window.electronAPI.downloadFile) {
            throw new Error('Download functionality requires Electron environment');
        }
        
        const fileFormat = document.getElementById('fileFormat').value;
        const extension = this.getFileExtension(fileFormat);
        const filename = `${item.accession}${extension}`;
        const outputPath = `${this.outputDirectory}/${filename}`;
        
        // 使用Electron的下载API，传递项目信息
        const result = await window.electronAPI.downloadFile(item.downloadUrl, outputPath, this.currentProject);
        
        if (!result.success) {
            throw new Error(result.error || 'Download failed');
        }
        
        return result;
    }
    
    getFileExtension(format) {
        const extensions = {
            'fasta': '.fasta',
            'genbank': '.gb',
            'gff': '.gff',
            'embl': '.embl'
        };
        
        return extensions[format] || '.txt';
    }
    
    clearSearch() {
        document.getElementById('searchTerm').value = '';
        const additionalInputs = document.querySelectorAll('#databaseSpecificOptions input, #databaseSpecificOptions select');
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
            resultsContainer.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 50px;">🔍 Enter search terms and click "Search Database" to find genomic data</p>';
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
        
        // 自动移除旧消息
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 5000);
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// 使GenomicDataDownloader在全局可用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GenomicDataDownloader;
} else {
    window.GenomicDataDownloader = GenomicDataDownloader;
}
 