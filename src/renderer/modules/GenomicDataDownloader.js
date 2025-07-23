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
                description: 'Download reference genome assemblies from NCBI RefSeq',
                searchDb: 'assembly',
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
        
        // 文件格式选择 - 实时更新类别预览
        const fileFormatSelect = document.getElementById('fileFormat');
        if (fileFormatSelect) {
            fileFormatSelect.addEventListener('change', () => this.updateCategoryPreviews());
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
    
    // Update category previews when file format changes
    updateCategoryPreviews() {
        if (this.searchResults.length > 0) {
            this.displayResults(this.searchResults);
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
        
        // NCBI E-utilities搜索
        const searchUrl = `${config.baseUrl}esearch.fcgi?db=${config.searchDb}&term=${encodeURIComponent(query)}&retmax=${resultsLimit}&retmode=json`;
        
        console.log('NCBI Search URL:', searchUrl); // Debug logging
        
        const searchResponse = await fetch(searchUrl);
        const searchData = await searchResponse.json();
        
        console.log('NCBI Search Response:', searchData); // Debug logging
        
        if (!searchData.esearchresult?.idlist?.length) {
            return [];
        }
        
        // 获取详细信息
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
            downloadUrl: this.getNCBIDownloadUrl(id, database)
        };

        // Database-specific processing
        switch (database) {
            case 'assembly':
                return {
                    ...baseResult,
                    accession: summary.assemblyaccession || summary.caption || id,
                    title: summary.title || summary.assemblydescription || 'No title available',
                    organism: summary.organism || summary.infraspecificname || 'Unknown',
                    length: summary.totallength || summary.slen || 0,
                    description: `Assembly: ${summary.assemblyaccession || 'Unknown'} | Status: ${summary.assemblystatus || 'Unknown'} | Level: ${summary.assemblylevel || 'Unknown'}`,
                    assemblyLevel: summary.assemblylevel || 'Unknown',
                    assemblyStatus: summary.assemblystatus || 'Unknown',
                    submitter: summary.submitterorganization || 'Unknown'
                };
                
            case 'genome':
                return {
                    ...baseResult,
                    organism: summary.organism_name || summary.organism || 'Unknown',
                    description: `Genome: ${summary.defline || summary.title || 'Unknown'} | Size: ${summary.total_length ? (summary.total_length / 1000000).toFixed(2) + ' Mb' : 'Unknown'}`,
                    genomeSize: summary.total_length || 0
                };
                
            case 'nucleotide':
                return {
                    ...baseResult,
                    description: `${summary.extra || summary.title || 'No description'} | GI: ${summary.gi || 'N/A'}`,
                    gi: summary.gi || null
                };
                
            case 'protein':
                return {
                    ...baseResult,
                    description: `${summary.extra || summary.title || 'No description'} | Length: ${summary.slen || 0} aa`,
                    aaLength: summary.slen || 0
                };
                
            case 'sra':
                return {
                    ...baseResult,
                    title: summary.title || summary.runs || 'No title available',
                    description: `SRA: ${summary.runs || 'Unknown'} | Experiment: ${summary.expname || 'Unknown'} | Platform: ${summary.platform || 'Unknown'}`,
                    platform: summary.platform || 'Unknown',
                    runs: summary.runs || 'Unknown'
                };
                
            default:
                return baseResult;
        }
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
            'assembly': 'docsum', // Assembly uses docsum to get FTP links
            'protein': 'fasta',
            'sra': 'runinfo'
        };
        
        const format = formatMap[database] || 'fasta';
        
        // Special handling for assembly database
        if (database === 'assembly') {
            // Return assembly summary URL which contains FTP download links
            return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=${database}&id=${id}&retmode=json`;
        }
        
        return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=${database}&id=${id}&rettype=${format}&retmode=text`;
    }
    
    // Helper function to get file category preview
    getCategoryPreview(result) {
        const fileFormat = document.getElementById('fileFormat').value;
        const extension = this.getFileExtension(fileFormat);
        const mockFilePath = `${result.accession}${extension}`;
        
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
        let categorySummaryHtml = '<div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin-bottom: 20px;">';
        categorySummaryHtml += '<h4 style="margin: 0 0 10px 0; color: #495057;">📊 File Organization Preview</h4>';
        categorySummaryHtml += '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
        
        Object.entries(categoryDistribution).forEach(([category, count]) => {
            const categoryInfo = this.getCategoryPreview({ database: null }); // Get default info
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
                
                this.showStatusMessage(`✅ Downloaded & categorized ${item.accession} → ${categoryInfo.category}/ (${completed}/${total})`, 'success');
                
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
                if (items.indexOf(item) < completed) { // Only count completed downloads
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
                const categoryInfo = this.getCategoryPreview(items.find(item => this.getCategoryPreview(item).category === category));
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
        
        this.showStatusMessage(`🎉 Download completed! Downloaded & intelligently categorized ${completed}/${total} items into project folders.`, 'success');
    }
    
    async downloadItem(item) {
        if (!window.electronAPI || !window.electronAPI.downloadFile) {
            throw new Error('Download functionality requires Electron environment');
        }
        
        const fileFormat = document.getElementById('fileFormat').value;
        const extension = this.getFileExtension(fileFormat);
        const filename = `${item.accession}${extension}`;
        const outputPath = `${this.outputDirectory}/${filename}`;
        
        // Enhance project info with database context for better categorization
        const enhancedProjectInfo = {
            ...this.currentProject,
            downloadContext: {
                database: item.database,
                downloadType: this.currentDownloadType,
                fileFormat: fileFormat,
                sourceUrl: item.downloadUrl
            }
        };
        
        // 使用Electron的下载API，传递增强的项目信息
        const result = await window.electronAPI.downloadFile(item.downloadUrl, outputPath, enhancedProjectInfo);
        
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
 