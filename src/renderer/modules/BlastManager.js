/**
 * BlastManager - Handles BLAST search functionality
 * Supports NCBI remote BLAST searches with comprehensive parameter control
 */
class BlastManager {
    constructor(app) {
        this.app = app;
        this.currentSearchId = null;
        this.searchResults = null;
        this.isSearching = false;
        
        // BLAST configuration
        this.config = {
            ncbiBaseUrl: 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi',
            maxWaitTime: 300000, // 5 minutes max wait
            pollInterval: 5000,   // Check every 5 seconds
            supportedFormats: ['fasta', 'fa', 'fas', 'txt'],
            // Local BLAST configuration
            localBlastPath: '/usr/local/bin', // Default BLAST+ installation path
            localDbPath: '/Users/song/blast/db', // User-specific local database path
            localDatabases: new Map(), // Will store local database information
            supportedLocalFormats: ['fasta', 'fa', 'fas', 'txt', 'gb', 'gbk', 'genbank']
        };
        
        this.initializeUI();
        this.initializeLocalBlast();
    }

    async initializeLocalBlast() {
        console.log('BlastManager: Initializing local BLAST...');
        try {
            // Check if BLAST+ is installed
            const isInstalled = await this.checkBlastInstallation();
            console.log('BlastManager: BLAST+ installed status:', isInstalled);
            
            // Enable local BLAST UI even if BLAST+ is not installed
            // Users can still create databases from loaded genomes
            this.enableLocalBlast();
            
            if (isInstalled) {
                // Load local databases only if BLAST+ is installed
                await this.loadLocalDatabases();
            } else {
                console.warn('BLAST+ is not installed. Local database creation is available, but searching requires BLAST+ installation.');
            }
        } catch (error) {
            console.error('Error initializing local BLAST:', error);
            // Still enable the UI for database creation
            this.enableLocalBlast();
        }
    }

    async checkBlastInstallation() {
        console.log('BlastManager: Checking BLAST+ installation...');
        try {
            // Check for blastn executable
            const command = 'which blastn';
            console.log('BlastManager: Running command:', command);
            const result = await this.runCommand(command);
            console.log('BlastManager: which blastn result:', result.trim());
            return result.trim().length > 0;
        } catch (error) {
            console.error('BlastManager: Error checking BLAST+ installation:', error);
            return false;
        }
    }

    async runCommand(command) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            const path = require('path');

            // Check if it's a BLAST-related command
            const isBlastCommand = ['blastdbcmd', 'makeblastdb', 'blastn', 'blastp', 'blastx', 'tblastn', 'tblastx'].some(cmd => command.startsWith(cmd));

            let finalCommand = command;
            if (isBlastCommand) {
                // Set BLASTDB environment variable for the command
                const localDbPath = this.config.localDbPath; // Use the configured localDbPath
                finalCommand = `export BLASTDB=${localDbPath} && ${command}`;
                console.log('BlastManager: Running BLAST command with BLASTDB set:', finalCommand);
            }

            exec(finalCommand, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            });
        });
    }

    enableLocalBlast() {
        // Use setTimeout to ensure DOM elements are available
        setTimeout(() => {
            const localTab = document.querySelector('.service-tab[data-service="local"]');
            if (localTab) {
                localTab.disabled = false;
                localTab.classList.remove('disabled');
                const description = localTab.querySelector('.service-description');
                if (description) {
                    description.textContent = 'Local database search';
                }
                console.log('BlastManager: Local BLAST service enabled');
            } else {
                console.warn('BlastManager: Local BLAST service tab not found');
            }
        }, 100);
    }

    async loadLocalDatabases() {
        try {
            const path = require('path');
            // Get list of local databases
            const result = await this.runCommand(`blastdbcmd -list ${this.config.localDbPath}`);
            const lines = result.split('\n');
            
            for (const line of lines) {
                if (line.trim()) {
                    const parts = line.trim().split(' ');
                    if (parts.length >= 2) {
                        const dbTypeRaw = parts.pop(); // Last part is the type
                        // Map database types to BLAST program types
                        let dbType;
                        if (dbTypeRaw.toLowerCase() === 'nucleotide') {
                            dbType = 'blastn'; // Nucleotide databases work with blastn and tblastn
                        } else if (dbTypeRaw.toLowerCase() === 'protein') {
                            dbType = 'blastp'; // Protein databases work with blastp and blastx
                        } else {
                            dbType = dbTypeRaw.toLowerCase();
                        }
                        const dbPathFull = parts.join(' '); // Remaining parts form the full path
                        const dbName = path.basename(dbPathFull);

                        if (dbName && dbType) {
                            console.log(`Found local database: ${dbName}, Type: ${dbType}, Path: ${dbPathFull}`);
                            // Get database statistics - Use the base name for getting stats
                            const stats = await this.getDatabaseStats(dbName);

                            this.config.localDatabases.set(dbName, {
                                name: dbName,
                                type: dbType,
                                path: path.dirname(dbPathFull), // Store the directory path
                                description: `Local ${dbTypeRaw} database`,
                                sequences: stats.sequences,
                                letters: stats.letters,
                                lastUpdated: stats.lastUpdated
                            });
                        }
                    }
                }
            }
            
            // Update database options in UI
            this.updateDatabaseOptions();
        } catch (error) {
            console.error('Error loading local databases:', error);
        }
    }

    async getDatabaseStats(dbName) {
        try {
            // Get database statistics using blastdbcmd
            const result = await this.runCommand(`blastdbcmd -db ${dbName} -info`);
            
            // Parse the output to extract statistics
            const stats = {
                sequences: 'Unknown',
                letters: 'Unknown',
                lastUpdated: 'Unknown'
            };
            
            const lines = result.split('\n');
            for (const line of lines) {
                if (line.includes('Number of sequences:')) {
                    stats.sequences = line.split(':')[1].trim();
                } else if (line.includes('Number of letters:')) {
                    stats.letters = line.split(':')[1].trim();
                } else if (line.includes('Last updated:')) {
                    stats.lastUpdated = line.split(':')[1].trim();
                }
            }
            
            return stats;
        } catch (error) {
            console.error(`Error getting stats for database ${dbName}:`, error);
            return {
                sequences: 'Unknown',
                letters: 'Unknown',
                lastUpdated: 'Unknown'
            };
        }
    }

    async createLocalDatabase(params) {
        try {
            // Validate input file
            if (!params.inputFile || !this.config.supportedLocalFormats.includes(params.inputFile.split('.').pop().toLowerCase())) {
                throw new Error('Invalid input file format');
            }

            // Create database directory if it doesn't exist
            await this.runCommand(`mkdir -p ${this.config.localDbPath}`);

            // Build makeblastdb command
            const command = this.buildMakeBlastDbCommand(params);

            // Execute makeblastdb
            await this.runCommand(command);

            // Reload databases
            await this.loadLocalDatabases();

            return true;
        } catch (error) {
            throw new Error(`Failed to create local database: ${error.message}`);
        }
    }

    buildMakeBlastDbCommand(params) {
        const { inputFile, dbName, dbType, title, parseSeqids } = params;
        
        let command = `makeblastdb -in "${inputFile}" -dbtype ${dbType} -out "${this.config.localDbPath}/${dbName}"`;
        
        if (title) {
            command += ` -title "${title}"`;
        }
        
        if (parseSeqids) {
            command += ' -parse_seqids';
        }
        
        return command;
    }

    async deleteLocalDatabase(dbName) {
        try {
            // Check if database exists
            if (!this.config.localDatabases.has(dbName)) {
                throw new Error('Database not found');
            }

            // Delete database files
            const dbPath = this.config.localDatabases.get(dbName).path;
            await this.runCommand(`rm -f ${dbPath}/${dbName}.*`);

            // Remove from local databases map
            this.config.localDatabases.delete(dbName);

            // Update database options in UI
            this.updateDatabaseOptions();

            return true;
        } catch (error) {
            throw new Error(`Failed to delete local database: ${error.message}`);
        }
    }

    async updateLocalDatabase(dbName) {
        try {
            // Check if database exists
            if (!this.config.localDatabases.has(dbName)) {
                throw new Error('Database not found');
            }

            const dbInfo = this.config.localDatabases.get(dbName);
            
            // Get the original input file
            const inputFile = await this.getDatabaseInputFile(dbName);
            if (!inputFile) {
                throw new Error('Could not find original input file');
            }

            // Delete old database
            await this.deleteLocalDatabase(dbName);

            // Create new database
            await this.createLocalDatabase({
                inputFile,
                dbName,
                dbType: dbInfo.type,
                title: dbInfo.description,
                parseSeqids: true
            });

            return true;
        } catch (error) {
            throw new Error(`Failed to update local database: ${error.message}`);
        }
    }

    async getDatabaseInputFile(dbName) {
        try {
            // Try to find the original input file
            const result = await this.runCommand(`find ${this.config.localDbPath} -name "${dbName}.fasta" -o -name "${dbName}.fa" -o -name "${dbName}.fas"`);
            return result.trim();
        } catch (error) {
            console.error(`Error finding input file for database ${dbName}:`, error);
            return null;
        }
    }

    updateDatabaseOptions(blastType = null) {
        const select = document.getElementById('blastDatabase');
        if (!select) return;

        const activeType = blastType || document.querySelector('.blast-type-tabs .tab-button.active')?.dataset.blastType || 'blastn';
        const activeService = document.querySelector('.service-tabs .service-tab.active')?.dataset.service;

        // Clear existing options
        select.innerHTML = '';

        let databases = [];
        
        // Add local databases if local service is selected
        if (activeService === 'local') {
            for (const [name, info] of this.config.localDatabases) {
                // Check if database is compatible with the selected BLAST type
                let isCompatible = false;
                if (info.type === 'blastn' && (activeType === 'blastn' || activeType === 'tblastn')) {
                    isCompatible = true;
                } else if (info.type === 'blastp' && (activeType === 'blastp' || activeType === 'blastx')) {
                    isCompatible = true;
                }
                
                if (isCompatible) {
                    databases.push({
                        value: name,
                        label: `Local: ${name}`,
                        description: info.description
                    });
                }
            }
        } else {
            // Add NCBI databases
            switch (activeType) {
                case 'blastn':
                    databases = [
                        { value: 'nt', label: 'Nucleotide collection (nt)' },
                        { value: 'refseq_rna', label: 'RefSeq RNA sequences' },
                        { value: 'refseq_genomic', label: 'RefSeq Genome sequences' },
                        { value: 'est', label: 'EST (Expressed Sequence Tags)' },
                        { value: 'gss', label: 'GSS (Genome Survey Sequences)' }
                    ];
                    break;
                case 'blastp':
                    databases = [
                        { value: 'nr', label: 'Non-redundant protein sequences (nr)' },
                        { value: 'swissprot', label: 'UniProtKB/Swiss-Prot' },
                        { value: 'pdb', label: 'Protein Data Bank proteins' },
                        { value: 'refseq_protein', label: 'RefSeq Protein Database' }
                    ];
                    break;
                case 'blastx':
                    databases = [
                        { value: 'nr', label: 'Non-redundant protein sequences (nr)' },
                        { value: 'swissprot', label: 'UniProtKB/Swiss-Prot' },
                        { value: 'pdb', label: 'Protein Data Bank proteins' }
                    ];
                    break;
                case 'tblastn':
                    databases = [
                        { value: 'nt', label: 'Nucleotide collection (nt)' },
                        { value: 'refseq_genomic', label: 'RefSeq Genome sequences' },
                        { value: 'est', label: 'EST (Expressed Sequence Tags)' }
                    ];
                    break;
            }
        }

        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db.value;
            option.textContent = db.label;
            if (db.description) {
                option.title = db.description;
            }
            select.appendChild(option);
        });
    }

    initializeUI() {
        // Use a timeout to ensure DOM is fully rendered
        setTimeout(() => {
            this.setupEventListeners();
            this.initializeModal();
            this.selectBlastType('blastn'); // Set default BLAST type
        }, 100);
    }

    setupEventListeners() {
        // Wait for elements to be available with retries
        this.waitForElementAndSetupListeners();
    }

    waitForElementAndSetupListeners(retryCount = 0) {
        const maxRetries = 10;
        const retryDelay = 500;

        // Check if critical elements exist
        const blastBtn = document.getElementById('blastBtn');
        const runBlastBtn = document.getElementById('runBlastBtn');
        const blastModal = document.getElementById('blastSearchModal');

        if (!blastBtn || !runBlastBtn || !blastModal) {
            if (retryCount < maxRetries) {
                console.log(`BlastManager: Waiting for DOM elements... (attempt ${retryCount + 1}/${maxRetries})`);
                setTimeout(() => {
                    this.waitForElementAndSetupListeners(retryCount + 1);
                }, retryDelay);
                return;
            } else {
                console.error('BlastManager: Failed to find required DOM elements after maximum retries');
                return;
            }
        }

        // Now set up all event listeners
        this.setupAllEventListeners();
    }

    setupAllEventListeners() {
        console.log('BlastManager: Setting up event listeners...');

        // BLAST button in header
        const blastBtn = document.getElementById('blastBtn');
        if (blastBtn) {
            blastBtn.addEventListener('click', () => {
                console.log('BlastManager: BLAST button clicked');
                this.showBlastModal();
            });
            console.log('✓ BLAST button listener added');
        } else {
            console.warn('✗ BLAST button not found');
        }

        // Modal close handlers
        const searchModalCloseButtons = document.querySelectorAll('#blastSearchModal .modal-close');
        searchModalCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.hideBlastModal());
        });
        console.log(`✓ Search modal close buttons: ${searchModalCloseButtons.length}`);

        const resultsModalCloseButtons = document.querySelectorAll('#blastResultsModal .modal-close');
        resultsModalCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => this.hideResultsModal());
        });
        console.log(`✓ Results modal close buttons: ${resultsModalCloseButtons.length}`);

        // BLAST type tabs
        const typeTabButtons = document.querySelectorAll('.blast-type-tabs .tab-button');
        typeTabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('BlastManager: BLAST type tab clicked:', e.target.closest('.tab-button').dataset.blastType);
                this.selectBlastType(e.target.closest('.tab-button').dataset.blastType);
            });
        });
        console.log(`✓ BLAST type tab buttons: ${typeTabButtons.length}`);

        // Input source tabs
        const sourceTabButtons = document.querySelectorAll('.input-source-tabs .source-tab');
        sourceTabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('BlastManager: Input source tab clicked:', e.target.dataset.source);
                this.selectInputSource(e.target.dataset.source);
            });
        });
        console.log(`✓ Input source tab buttons: ${sourceTabButtons.length}`);

        // Service tabs
        const serviceTabButtons = document.querySelectorAll('.service-tabs .service-tab');
        serviceTabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (!e.target.closest('.service-tab').disabled) {
                    console.log('BlastManager: Service tab clicked:', e.target.closest('.service-tab').dataset.service);
                    this.selectService(e.target.closest('.service-tab').dataset.service);
                }
            });
        });
        console.log(`✓ Service tab buttons: ${serviceTabButtons.length}`);

        // Query sequence input
        const querySequence = document.getElementById('blastQuerySequence');
        if (querySequence) {
            querySequence.addEventListener('input', () => {
                this.validateSequence();
            });
            console.log('✓ Query sequence input listener added');
        } else {
            console.warn('✗ Query sequence input not found');
        }

        // Paste button
        const pasteBtn = document.getElementById('pasteSequenceBtn');
        if (pasteBtn) {
            pasteBtn.addEventListener('click', async () => {
                console.log('BlastManager: Paste button clicked');
                try {
                    const text = await navigator.clipboard.readText();
                    const textarea = document.getElementById('blastQuerySequence');
                    if (textarea) {
                        textarea.value = text;
                        this.validateSequence();
                    }
                } catch (error) {
                    console.error('Failed to paste from clipboard:', error);
                    this.showNotification('Failed to paste from clipboard. Please check clipboard permissions.', 'error');
                }
            });
            console.log('✓ Paste button listener added');
        } else {
            console.warn('✗ Paste button not found');
        }

        // Load current region button
        const loadRegionBtn = document.getElementById('loadCurrentRegionBtn');
        if (loadRegionBtn) {
            loadRegionBtn.addEventListener('click', () => {
                console.log('BlastManager: Load current region button clicked');
                this.loadCurrentRegion();
            });
            console.log('✓ Load current region button listener added');
        } else {
            console.warn('✗ Load current region button not found');
        }

        // File upload
        const fileInput = document.getElementById('blastFileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                console.log('BlastManager: File input changed');
                this.handleFileUpload(e.target.files[0]);
            });
            console.log('✓ File input listener added');
        } else {
            console.warn('✗ File input not found');
        }

        const uploadZone = document.getElementById('blastUploadZone');
        if (uploadZone) {
            uploadZone.addEventListener('click', () => {
                console.log('BlastManager: Upload zone clicked');
                const fileInput = document.getElementById('blastFileInput');
                if (fileInput) fileInput.click();
            });

            // Drag and drop for file upload
            uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadZone.classList.add('dragover');
            });

            uploadZone.addEventListener('dragleave', () => {
                uploadZone.classList.remove('dragover');
            });

            uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadZone.classList.remove('dragover');
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileUpload(e.dataTransfer.files[0]);
                }
            });
            console.log('✓ Upload zone listeners added');
        } else {
            console.warn('✗ Upload zone not found');
        }

        // Run BLAST button
        const runBlastBtn = document.getElementById('runBlastBtn');
        if (runBlastBtn) {
            runBlastBtn.addEventListener('click', () => {
                console.log('BlastManager: Run BLAST button clicked');
                this.runBlastSearch();
            });
            console.log('✓ Run BLAST button listener added');
        } else {
            console.warn('✗ Run BLAST button not found');
        }

        // Export results button
        const exportBtn = document.getElementById('exportBlastBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                console.log('BlastManager: Export button clicked');
                this.exportResults();
            });
            console.log('✓ Export button listener added');
        } else {
            console.warn('✗ Export button not found');
        }

        // Advanced parameters toggle
        const advancedDetails = document.querySelector('.advanced-parameters details');
        if (advancedDetails) {
            advancedDetails.addEventListener('toggle', (e) => {
                const icon = e.target.querySelector('summary i');
                if (icon) {
                    icon.style.transform = e.target.open ? 'rotate(90deg)' : 'rotate(0deg)';
                }
            });
            console.log('✓ Advanced parameters toggle listener added');
        } else {
            console.warn('✗ Advanced parameters toggle not found');
        }

        // Modal tab switching
        const modalTabButtons = document.querySelectorAll('.modal-tabs .tab-button');
        modalTabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                console.log('BlastManager: Modal tab clicked:', tabName);
                this.switchModalTab(tabName);
            });
        });
        console.log(`✓ Modal tab buttons: ${modalTabButtons.length}`);

        // Create Local Database button
        const createDbBtn = document.getElementById('createLocalDbBtn');
        if (createDbBtn) {
            createDbBtn.addEventListener('click', () => {
                console.log('BlastManager: Create local database button clicked');
                this.createDatabaseFromLoadedGenome();
            });
            console.log('✓ Create local database button listener added');
        } else {
            console.warn('✗ Create local database button not found');
        }

        console.log('BlastManager: All event listeners setup completed');
    }

    // Add a notification method for user feedback
    showNotification(message, type = 'info') {
        // Try to use the app's notification system if available
        if (this.app && this.app.uiManager && this.app.uiManager.showNotification) {
            this.app.uiManager.showNotification(message, type);
        } else {
            // Fallback to console or alert
            console.log(`[${type.toUpperCase()}] ${message}`);
            if (type === 'error') {
                alert(message);
            }
        }
    }

    initializeModal() {
        // Initialize modal-specific functionality if needed
        // This can be expanded later for modal-specific features
    }

    showBlastModal() {
        const modal = document.getElementById('blastSearchModal');
        if (modal) {
            modal.classList.add('show');
            this.updateCurrentRegionDisplay();
            // Populate loaded genome list when modal is opened
            this.updateLoadedGenomeList();
        }
    }

    hideBlastModal() {
        const modal = document.getElementById('blastSearchModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    showResultsModal() {
        const modal = document.getElementById('blastResultsModal');
        if (modal) {
            modal.classList.add('show');
        }
    }

    hideResultsModal() {
        const modal = document.getElementById('blastResultsModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    selectBlastType(blastType) {
        // Update active tab
        document.querySelectorAll('.blast-type-tabs .tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-blast-type="${blastType}"]`).classList.add('active');

        // Update database options based on BLAST type
        this.updateDatabaseOptions(blastType);
    }

    selectInputSource(source) {
        // Update active tab
        document.querySelectorAll('.input-source-tabs .source-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-source="${source}"]`).classList.add('active');

        // Update active panel
        document.querySelectorAll('.input-source-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.querySelector(`.input-source-panel[data-source="${source}"]`).classList.add('active');

        if (source === 'current') {
            this.updateCurrentRegionDisplay();
        }
    }

    selectService(service) {
        // Update active tab
        document.querySelectorAll('.service-tabs .service-tab').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-service="${service}"]`).classList.add('active');
        
        // Update database options when service changes
        this.updateDatabaseOptions();
    }

    updateCurrentRegionDisplay() {
        if (!this.app?.genomeBrowser?.currentState) return;

        const state = this.app.genomeBrowser.currentState;
        
        document.getElementById('currentChromDisplay').textContent = state.currentChromosome || '-';
        document.getElementById('currentStartDisplay').textContent = 
            state.currentPosition?.start ? state.currentPosition.start.toLocaleString() : '-';
        document.getElementById('currentEndDisplay').textContent = 
            state.currentPosition?.end ? state.currentPosition.end.toLocaleString() : '-';
        
        const length = state.currentPosition?.start && state.currentPosition?.end 
            ? state.currentPosition.end - state.currentPosition.start + 1 
            : 0;
        document.getElementById('currentLengthDisplay').textContent = length ? length.toLocaleString() : '-';
    }

    async loadCurrentRegion() {
        try {
            if (!this.app?.genomeBrowser?.currentState) {
                throw new Error('No genome data loaded');
            }

            const state = this.app.genomeBrowser.currentState;
            if (!state.currentChromosome || !state.currentPosition) {
                throw new Error('No current region selected');
            }

            // Get sequence from the current region
            const sequenceData = await this.getSequenceFromRegion(
                state.currentChromosome,
                state.currentPosition.start,
                state.currentPosition.end
            );

            // Set the sequence in the textarea
            document.getElementById('blastQuerySequence').value = sequenceData;
            
            // Switch to manual input tab to show the loaded sequence
            this.selectInputSource('manual');
            
            // Validate the sequence
            this.validateSequence();

        } catch (error) {
            console.error('Error loading current region:', error);
            this.showNotification('Error loading current region: ' + error.message, 'error');
        }
    }

    async getSequenceFromRegion(chromosome, start, end) {
        // This should interface with your genome browser's sequence data
        // For now, we'll create a placeholder implementation
        try {
            if (this.app.chatManager) {
                const result = await this.app.chatManager.getSequence({
                    chromosome: chromosome,
                    start: start,
                    end: end
                });
                return result.sequence || '';
            }
            
            // Fallback: generate placeholder sequence
            const length = end - start + 1;
            const bases = ['A', 'T', 'G', 'C'];
            return Array.from({ length }, () => bases[Math.floor(Math.random() * 4)]).join('');
            
        } catch (error) {
            throw new Error('Could not retrieve sequence data');
        }
    }

    validateSequence() {
        const textarea = document.getElementById('blastQuerySequence');
        const lengthSpan = document.getElementById('sequenceLength');
        const typeSpan = document.getElementById('sequenceType');
        
        if (!textarea || !lengthSpan || !typeSpan) return;

        const sequence = this.cleanSequence(textarea.value);
        
        if (!sequence) {
            lengthSpan.textContent = 'Length: 0 bp';
            typeSpan.textContent = 'Type: Not detected';
            return;
        }

        lengthSpan.textContent = `Length: ${sequence.length.toLocaleString()} bp`;
        
        // Detect sequence type
        const sequenceType = this.detectSequenceType(sequence);
        typeSpan.textContent = `Type: ${sequenceType}`;
        
        // Update visual feedback
        if (sequence.length < 10) {
            textarea.style.borderColor = '#ef4444';
            typeSpan.style.color = '#ef4444';
        } else {
            textarea.style.borderColor = '#10b981';
            typeSpan.style.color = '#10b981';
        }
    }

    cleanSequence(rawSequence) {
        if (!rawSequence) return '';
        
        // Remove FASTA header if present
        let sequence = rawSequence.replace(/^>.*$/gm, '');
        
        // Remove whitespace, numbers, and non-sequence characters
        sequence = sequence.replace(/[^ATGCRYSWKMBDHVN]/gi, '');
        
        return sequence.toUpperCase();
    }

    detectSequenceType(sequence) {
        if (!sequence) return 'Unknown';
        
        const dnaPattern = /^[ATGCRYSWKMBDHVN]+$/i;
        const proteinPattern = /[EFILPQZ]/i;
        
        if (proteinPattern.test(sequence)) {
            return 'Protein';
        } else if (dnaPattern.test(sequence)) {
            const atgcCount = (sequence.match(/[ATGC]/gi) || []).length;
            const totalCount = sequence.length;
            
            if (atgcCount / totalCount > 0.85) {
                return 'DNA';
            } else {
                return 'DNA/RNA (with ambiguous bases)';
            }
        } else {
            return 'Unknown';
        }
    }

    async handleFileUpload(file) {
        if (!file) return;

        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!this.config.supportedFormats.includes(fileExtension)) {
            this.showNotification(`Unsupported file format: .${fileExtension}`, 'error');
            return;
        }

        try {
            const text = await this.readFileAsText(file);
            document.getElementById('blastQuerySequence').value = text;
            this.selectInputSource('manual');
            this.validateSequence();
            this.showNotification(`File "${file.name}" loaded successfully`, 'success');
        } catch (error) {
            this.showNotification(`Error reading file: ${error.message}`, 'error');
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    async runBlastSearch() {
        if (this.isSearching) {
            this.showNotification('A BLAST search is already in progress', 'warning');
            return;
        }

        try {
            // Validate inputs
            const searchParams = this.collectSearchParameters();
            this.validateSearchParameters(searchParams);

            // Show loading state
            this.isSearching = true;
            this.updateRunButton(true);
            this.hideBlastModal();
            this.showSearchProgress();

            // Run the search
            const results = await this.executeBlastSearch(searchParams);
            
            // Display results
            this.searchResults = results;
            this.displayResults(results);
            this.showResultsModal();

        } catch (error) {
            console.error('BLAST search error:', error);
            this.showNotification(`BLAST search failed: ${error.message}`, 'error');
        } finally {
            this.isSearching = false;
            this.updateRunButton(false);
            this.hideSearchProgress();
        }
    }

    collectSearchParameters() {
        const sequence = this.cleanSequence(document.getElementById('blastQuerySequence').value);
        const blastType = document.querySelector('.blast-type-tabs .tab-button.active')?.dataset.blastType;
        const database = document.getElementById('blastDatabase').value;
        const evalue = document.getElementById('blastEvalue').value;
        const maxTargets = document.getElementById('blastMaxTargets').value;
        const wordSize = document.getElementById('blastWordSize').value;
        const matrix = document.getElementById('blastMatrix').value;
        const gapOpen = document.getElementById('blastGapOpen').value;
        const gapExtend = document.getElementById('blastGapExtend').value;
        const lowComplexity = document.getElementById('blastLowComplexity').checked;
        const service = document.querySelector('.service-tabs .service-tab.active')?.dataset.service;

        return {
            sequence,
            blastType,
            database,
            evalue,
            maxTargets,
            wordSize,
            matrix,
            gapOpen,
            gapExtend,
            lowComplexity,
            service
        };
    }

    validateSearchParameters(params) {
        if (!params.sequence || params.sequence.length < 10) {
            throw new Error('Query sequence must be at least 10 characters long');
        }

        if (!params.blastType) {
            throw new Error('Please select a BLAST type');
        }

        if (!params.database) {
            throw new Error('Please select a database');
        }

        if (!params.service) {
            throw new Error('Please select a search service');
        }

        // Validate sequence type matches BLAST type
        const sequenceType = this.detectSequenceType(params.sequence);
        if (params.blastType === 'blastp' && sequenceType !== 'Protein') {
            throw new Error('BLASTP requires a protein sequence');
        }
        if ((params.blastType === 'blastn' || params.blastType === 'blastx' || params.blastType === 'tblastn') && 
            sequenceType === 'Protein') {
            throw new Error(`${params.blastType.toUpperCase()} cannot be used with protein sequences`);
        }
    }

    async executeBlastSearch(params) {
        if (params.service === 'ncbi') {
            return await this.executeNCBIBlast(params);
        } else if (params.service === 'local') {
            return await this.executeLocalBlast(params);
        } else {
            throw new Error('Unsupported BLAST service');
        }
    }

    async executeNCBIBlast(params) {
        // This is a simplified implementation
        // In a real application, you would need to handle NCBI's actual BLAST API
        // which involves submitting a job, polling for completion, and retrieving results
        
        console.log('Executing NCBI BLAST with parameters:', params);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Return mock results for demonstration
        return this.generateMockResults(params);
    }

    generateMockResults(params) {
        // Generate realistic mock BLAST results for demonstration
        const results = {
            searchId: `BLAST_${Date.now()}`,
            queryInfo: {
                sequence: params.sequence.substring(0, 100) + (params.sequence.length > 100 ? '...' : ''),
                length: params.sequence.length,
                type: this.detectSequenceType(params.sequence)
            },
            parameters: params,
            hits: [
                {
                    id: 'hit_1',
                    accession: 'NP_414542.1',
                    description: 'DNA-directed RNA polymerase subunit alpha [Escherichia coli str. K-12]',
                    length: 329,
                    evalue: '2e-85',
                    score: '265 bits (677)',
                    identity: '98.5%',
                    coverage: '95%',
                    alignment: {
                        query: 'ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCGATTAAAGAATACGGCATTGAAGTTGCGCTGGCTTACACTTACCAGCAGAAAGAGCTGCTGATTGAAAAACTGCTGGAAGAAAACATTCCGGAAATTGTTGAAGAAAAACTGGTTTGGGAAGCTCTGAAACTGAAA',
                        subject: 'ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCGATTAAAGAATACGGCATTGAAGTTGCGCTGGCTTACACTTACCAGCAGAAAGAGCTGCTGATTGAAAAACTGCTGGAAGAAAACATTCCGGAAATTGTTGAAGAAAAACTGGTTTGGGAAGCTCTGAAACTGAAA',
                        match: '||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||'
                    }
                },
                {
                    id: 'hit_2',
                    accession: 'WP_000219193.1',
                    description: 'DNA-directed RNA polymerase subunit alpha [Enterobacteriaceae]',
                    length: 329,
                    evalue: '5e-80',
                    score: '248 bits (633)',
                    identity: '96.2%',
                    coverage: '93%',
                    alignment: {
                        query: 'ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCGATTAAAGAATACGGCATTGAAGTTGCGCTGGCTTACACTTACCAGCAGAAAGAGCTGCTGATTGAAAAACTGCTGGAAGAAAACATTCCGGAAATTGTTGAAGAAAAACTGGTTTGGGAAGCTCTGAAACTGAAA',
                        subject: 'ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCGATTAAAGAATACGGCATTGAAGTTGCGCTGGCTTACACTTACCAGCAGAAAGAGCTGCTGATTGAAAAACTGCTGGAAGAAAACATTCCGGAAATTGTTGAAGAAAAACTGGTTTGGGAAGCTCTGAAACTGAAA',
                        match: '||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||||'
                    }
                }
            ],
            statistics: {
                database: params.database,
                totalSequences: '1,234,567',
                totalLetters: '987,654,321',
                searchTime: '3.2 seconds'
            }
        };

        return results;
    }

    async executeLocalBlast(params) {
        try {
            // Create temporary FASTA file for query sequence
            const queryFile = await this.createTempFastaFile(params.sequence);
            
            // Build BLAST command
            const blastCommand = this.buildBlastCommand(params, queryFile);
            
            // Execute BLAST search
            const blastOutput = await this.runCommand(blastCommand);
            
            // Parse BLAST results
            const results = this.parseBlastOutput(blastOutput, params);
            
            // Clean up temporary file
            await this.cleanupTempFile(queryFile);
            
            return results;
        } catch (error) {
            throw new Error(`Local BLAST search failed: ${error.message}`);
        }
    }

    async createTempFastaFile(sequence) {
        const tempDir = require('os').tmpdir();
        const tempFile = require('path').join(tempDir, `blast_query_${Date.now()}.fa`);
        
        const fastaContent = `>Query_sequence\n${sequence}`;
        await require('fs').promises.writeFile(tempFile, fastaContent);
        
        return tempFile;
    }

    buildBlastCommand(params, queryFile) {
        const blastType = params.blastType;
        const blastExecutable = this.getBlastExecutable(blastType);
        
        let command = `${blastExecutable} -query "${queryFile}" -db "${params.database}"`;
        
        // Add common parameters
        command += ` -evalue ${params.evalue}`;
        command += ` -max_target_seqs ${params.maxTargets}`;
        command += ` -outfmt "6 qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore stitle"`;
        
        // Add type-specific parameters
        if (blastType === 'blastn') {
            command += ` -word_size ${params.wordSize || '11'}`;
        } else if (blastType === 'blastp') {
            command += ` -matrix ${params.matrix || 'BLOSUM62'}`;
            command += ` -gapopen ${params.gapOpen || '11'}`;
            command += ` -gapextend ${params.gapExtend || '1'}`;
        }
        
        // Add filtering options
        if (params.lowComplexity) {
            command += ' -soft_masking true';
        }
        
        return command;
    }

    getBlastExecutable(blastType) {
        const executables = {
            'blastn': 'blastn',
            'blastp': 'blastp',
            'blastx': 'blastx',
            'tblastn': 'tblastn'
        };
        
        const executable = executables[blastType];
        if (!executable) {
            throw new Error(`Unsupported BLAST type: ${blastType}`);
        }
        
        return executable;
    }

    parseBlastOutput(output, params) {
        const lines = output.trim().split('\n');
        const hits = [];
        
        for (const line of lines) {
            if (!line.trim()) continue;
            
            const [
                qseqid, sseqid, pident, length, mismatch, gapopen,
                qstart, qend, sstart, send, evalue, bitscore, stitle
            ] = line.split('\t');
            
            hits.push({
                id: sseqid,
                accession: sseqid,
                description: stitle,
                length: parseInt(length),
                evalue: evalue,
                score: `${bitscore} bits`,
                identity: `${pident}%`,
                coverage: this.calculateCoverage(parseInt(length), params.sequence.length),
                alignment: {
                    query: this.getAlignmentSequence(params.sequence, parseInt(qstart), parseInt(qend)),
                    subject: this.getAlignmentSequence(params.sequence, parseInt(sstart), parseInt(send)),
                    match: this.generateMatchString(parseInt(length), parseInt(mismatch), parseInt(gapopen))
                }
            });
        }
        
        return {
            searchId: `local_blast_${Date.now()}`,
            queryInfo: {
                sequence: params.sequence.substring(0, 100) + (params.sequence.length > 100 ? '...' : ''),
                length: params.sequence.length,
                type: this.detectSequenceType(params.sequence)
            },
            parameters: params,
            hits: hits,
            statistics: {
                database: params.database,
                totalSequences: this.config.localDatabases.get(params.database)?.sequences || 'Unknown',
                totalLetters: this.config.localDatabases.get(params.database)?.letters || 'Unknown',
                searchTime: 'Local search'
            }
        };
    }

    calculateCoverage(alignedLength, queryLength) {
        const coverage = (alignedLength / queryLength) * 100;
        return `${coverage.toFixed(1)}%`;
    }

    getAlignmentSequence(sequence, start, end) {
        return sequence.substring(start - 1, end);
    }

    generateMatchString(length, mismatch, gapopen) {
        const matches = length - mismatch - gapopen;
        return '|'.repeat(matches) + ' '.repeat(mismatch) + '-'.repeat(gapopen);
    }

    async cleanupTempFile(file) {
        try {
            await require('fs').promises.unlink(file);
        } catch (error) {
            console.warn('Failed to clean up temporary file:', error);
        }
    }

    displayResults(results) {
        const container = document.getElementById('blastResultsContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="blast-results-header">
                <h4>BLAST Search Results</h4>
                <div class="blast-query-info">
                    <h5><i class="fas fa-dna"></i> Query Information</h5>
                    <p><strong>Sequence:</strong> ${results.queryInfo.sequence}</p>
                    <p><strong>Length:</strong> ${results.queryInfo.length.toLocaleString()} ${results.queryInfo.type === 'Protein' ? 'aa' : 'bp'}</p>
                    <p><strong>Type:</strong> ${results.queryInfo.type}</p>
                    <p><strong>Database:</strong> ${results.parameters.database}</p>
                    <p><strong>Search performed:</strong> ${new Date().toLocaleString()}</p>
                </div>
            </div>
            
            <div class="blast-hits-section">
                <h5><i class="fas fa-bullseye"></i> Hits Found: ${results.hits.length}</h5>
                ${results.hits.map(hit => this.renderHit(hit)).join('')}
            </div>
            
            <div class="blast-statistics">
                <h5><i class="fas fa-chart-bar"></i> Search Statistics</h5>
                <div class="blast-stats">
                    <div class="blast-stat">
                        <div class="blast-stat-label">Database:</div>
                        <div class="blast-stat-value">${results.statistics.database}</div>
                    </div>
                    <div class="blast-stat">
                        <div class="blast-stat-label">Total Sequences:</div>
                        <div class="blast-stat-value">${results.statistics.totalSequences}</div>
                    </div>
                    <div class="blast-stat">
                        <div class="blast-stat-label">Total Letters:</div>
                        <div class="blast-stat-value">${results.statistics.totalLetters}</div>
                    </div>
                    <div class="blast-stat">
                        <div class="blast-stat-label">Search Time:</div>
                        <div class="blast-stat-value">${results.statistics.searchTime}</div>
                    </div>
                </div>
            </div>
        `;

        // Add click handlers for expandable hits
        container.querySelectorAll('.blast-hit-header').forEach(header => {
            header.addEventListener('click', () => {
                const hit = header.closest('.blast-hit');
                hit.classList.toggle('expanded');
            });
        });
    }

    renderHit(hit) {
        return `
            <div class="blast-hit">
                <div class="blast-hit-header">
                    <div class="blast-hit-title">${hit.description}</div>
                    <div class="blast-hit-score">Score: ${hit.score}</div>
                </div>
                <div class="blast-hit-details">
                    <div class="blast-stats">
                        <div class="blast-stat">
                            <div class="blast-stat-label">Accession:</div>
                            <div class="blast-stat-value">${hit.accession}</div>
                        </div>
                        <div class="blast-stat">
                            <div class="blast-stat-label">Length:</div>
                            <div class="blast-stat-value">${hit.length} aa</div>
                        </div>
                        <div class="blast-stat">
                            <div class="blast-stat-label">E-value:</div>
                            <div class="blast-stat-value">${hit.evalue}</div>
                        </div>
                        <div class="blast-stat">
                            <div class="blast-stat-label">Identity:</div>
                            <div class="blast-stat-value">${hit.identity}</div>
                        </div>
                        <div class="blast-stat">
                            <div class="blast-stat-label">Coverage:</div>
                            <div class="blast-stat-value">${hit.coverage}</div>
                        </div>
                    </div>
                    <div class="blast-alignment">
<strong>Alignment:</strong>
Query:   ${hit.alignment.query}
         ${hit.alignment.match}
Subject: ${hit.alignment.subject}
                    </div>
                </div>
            </div>
        `;
    }

    showSearchProgress() {
        const container = document.getElementById('blastResultsContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="blast-loading">
                <i class="fas fa-spinner"></i>
                <h4>Running BLAST Search...</h4>
                <p>Please wait while we search the database</p>
                <div class="blast-progress">
                    <div class="blast-progress-bar" style="width: 30%"></div>
                </div>
            </div>
        `;

        this.showResultsModal();
    }

    hideSearchProgress() {
        // Progress will be replaced by results or error message
    }

    updateRunButton(isRunning) {
        const button = document.getElementById('runBlastBtn');
        if (!button) return;

        if (isRunning) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
        } else {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-play"></i> Run BLAST Search';
        }
    }

    exportResults() {
        if (!this.searchResults) {
            this.showNotification('No results to export', 'warning');
            return;
        }

        try {
            const exportData = this.formatResultsForExport();
            this.downloadFile('blast_results.txt', exportData);
            this.showNotification('Results exported successfully', 'success');
        } catch (error) {
            this.showNotification('Error exporting results: ' + error.message, 'error');
        }
    }

    formatResultsForExport() {
        const results = this.searchResults;
        let output = '';
        // ... existing code ...
        return output;
    }

    switchModalTab(tabName) {
        // Switch tab buttons
        document.querySelectorAll('.modal-tabs .tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Switch tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // Update loaded genome list when switching to database management tab
        if (tabName === 'db-management') {
            this.updateLoadedGenomeList();
            this.updateExistingLocalDatabases();
        }
    }

    updateLoadedGenomeList() {
        const select = document.getElementById('loadedGenomeSelect');
        if (!select) {
            console.warn('BlastManager: loadedGenomeSelect not found');
            return;
        }

        // Clear existing options
        select.innerHTML = '<option value="">-- Select a loaded genome --</option>';

        // Get loaded genomes from the app
        const loadedFiles = this.app?.loadedFiles || [];
        const currentSequence = this.app?.currentSequence || {};
        
        console.log('BlastManager: Loaded files:', loadedFiles);
        console.log('BlastManager: Current sequence:', Object.keys(currentSequence));

        // Add chromosomes from current sequence
        if (Object.keys(currentSequence).length > 0) {
            Object.keys(currentSequence).forEach(chromosome => {
                if (currentSequence[chromosome] && currentSequence[chromosome].length > 0) {
                    const option = document.createElement('option');
                    option.value = chromosome;
                    option.textContent = `${chromosome} (${currentSequence[chromosome].length.toLocaleString()} bp)`;
                    select.appendChild(option);
                }
            });
        }

        // Also try to get from file manager if available
        if (this.app?.fileManager?.loadedGenomes) {
            Object.keys(this.app.fileManager.loadedGenomes).forEach(genomeName => {
                const genome = this.app.fileManager.loadedGenomes[genomeName];
                if (genome && genome.sequences) {
                    Object.keys(genome.sequences).forEach(chromosome => {
                        const option = document.createElement('option');
                        option.value = `${genomeName}:${chromosome}`;
                        option.textContent = `${genomeName} - ${chromosome} (${genome.sequences[chromosome].length.toLocaleString()} bp)`;
                        select.appendChild(option);
                    });
                }
            });
        }

        const optionCount = select.options.length - 1; // Subtract the default option
        console.log(`BlastManager: Added ${optionCount} genome options to dropdown`);
    }

    updateExistingLocalDatabases() {
        const list = document.getElementById('existingLocalDbList');
        if (!list) return;

        list.innerHTML = '';

        if (this.config.localDatabases.size === 0) {
            const li = document.createElement('li');
            li.textContent = 'No local databases found.';
            li.className = 'no-databases';
            list.appendChild(li);
        } else {
            this.config.localDatabases.forEach((dbInfo, dbName) => {
                const li = document.createElement('li');
                li.className = 'database-item';
                li.innerHTML = `
                    <div class="db-info">
                        <strong>${dbName}</strong> 
                        <span class="db-type">(${dbInfo.type})</span>
                        <div class="db-details">
                            Sequences: ${dbInfo.sequences}, Letters: ${dbInfo.letters}
                        </div>
                    </div>
                    <button class="btn btn-sm btn-danger delete-db-btn" data-db-name="${dbName}">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
                list.appendChild(li);
            });

            // Add delete button listeners
            list.querySelectorAll('.delete-db-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const dbName = e.target.closest('.delete-db-btn').dataset.dbName;
                    this.deleteLocalDatabase(dbName);
                });
            });
        }
    }

    async createDatabaseFromLoadedGenome() {
        try {
            const selectedGenome = document.getElementById('loadedGenomeSelect').value;
            const dbName = document.getElementById('newDbName').value.trim();
            const dbType = document.getElementById('newDbType').value;

            // Validation
            if (!selectedGenome) {
                this.showNotification('Please select a loaded genome', 'error');
                return;
            }

            if (!dbName) {
                this.showNotification('Please enter a database name', 'error');
                return;
            }

            // Get sequence data
            let sequenceData = '';
            let chromosome = selectedGenome;

            // Handle genome:chromosome format
            if (selectedGenome.includes(':')) {
                const [genomeName, chromName] = selectedGenome.split(':');
                chromosome = chromName;
                // Try to get from file manager
                if (this.app?.fileManager?.loadedGenomes?.[genomeName]?.sequences?.[chromName]) {
                    sequenceData = this.app.fileManager.loadedGenomes[genomeName].sequences[chromName];
                }
            } else {
                // Get from current sequence
                if (this.app?.currentSequence?.[chromosome]) {
                    sequenceData = this.app.currentSequence[chromosome];
                }
            }

            if (!sequenceData) {
                this.showNotification('Could not retrieve sequence data for selected genome', 'error');
                return;
            }

            console.log(`BlastManager: Creating ${dbType} database "${dbName}" from ${chromosome} (${sequenceData.length} bp)`);

            // Create FASTA content
            let fastaContent = '';
            if (dbType === 'nucl') {
                fastaContent = `>${chromosome}\n${sequenceData}`;
            } else if (dbType === 'prot') {
                // For protein database, we need to translate the DNA sequence
                const proteinSequences = this.translateDNAToProteins(sequenceData, chromosome);
                fastaContent = proteinSequences;
            }

            // Write to temporary file
            const tempFile = await this.writeSequenceToFile(fastaContent, dbName, dbType);

            // Create database using makeblastdb
            await this.createLocalDatabase({
                inputFile: tempFile,
                dbName: dbName,
                dbType: dbType,
                title: `${dbName} - ${chromosome}`,
                parseSeqids: true
            });

            // Clean up temporary file
            await this.cleanupTempFile(tempFile);

            // Update UI
            this.updateExistingLocalDatabases();
            this.updateDatabaseOptions();

            // Clear form
            document.getElementById('newDbName').value = '';
            document.getElementById('loadedGenomeSelect').value = '';

            this.showNotification(`Database "${dbName}" created successfully`, 'success');

        } catch (error) {
            console.error('BlastManager: Error creating database:', error);
            this.showNotification(`Error creating database: ${error.message}`, 'error');
        }
    }

    translateDNAToProteins(dnaSequence, chromosome) {
        // Simple 6-frame translation (3 forward, 3 reverse)
        const geneticCode = {
            'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
            'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
            'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
            'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
            'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
            'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
            'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
            'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
            'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
            'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
            'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
            'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
            'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
            'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
            'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
            'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
        };

        const reverseComplement = (seq) => {
            const complement = {'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G'};
            return seq.split('').reverse().map(base => complement[base] || base).join('');
        };

        const translate = (seq, frame, strand) => {
            const startPos = frame;
            let protein = '';
            
            for (let i = startPos; i < seq.length - 2; i += 3) {
                const codon = seq.substring(i, i + 3);
                if (codon.length === 3) {
                    protein += geneticCode[codon] || 'X';
                }
            }
            
            return protein;
        };

        let fastaContent = '';
        const cleanSeq = dnaSequence.toUpperCase().replace(/[^ATGC]/g, '');

        // Forward frames (1, 2, 3)
        for (let frame = 0; frame < 3; frame++) {
            const protein = translate(cleanSeq, frame, '+');
            if (protein.length > 10) { // Only include proteins longer than 10 amino acids
                fastaContent += `>${chromosome}_frame_+${frame + 1}\n${protein}\n`;
            }
        }

        // Reverse frames (4, 5, 6)
        const revSeq = reverseComplement(cleanSeq);
        for (let frame = 0; frame < 3; frame++) {
            const protein = translate(revSeq, frame, '-');
            if (protein.length > 10) { // Only include proteins longer than 10 amino acids
                fastaContent += `>${chromosome}_frame_-${frame + 1}\n${protein}\n`;
            }
        }

        return fastaContent;
    }

    async writeSequenceToFile(fastaContent, dbName, dbType) {
        const fs = require('fs').promises;
        const path = require('path');
        const os = require('os');

        const tempDir = os.tmpdir();
        const fileName = `${dbName}_${dbType}_${Date.now()}.fasta`;
        const filePath = path.join(tempDir, fileName);

        await fs.writeFile(filePath, fastaContent);
        console.log(`BlastManager: Wrote sequence to ${filePath}`);

        return filePath;
    }
}
