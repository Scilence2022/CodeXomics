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
        
        // Get ConfigManager instance from app
        this.configManager = app.configManager || null;
        
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
        
        // Custom databases for this project
        this.customDatabases = new Map();
        this.projectGenomes = new Map();
        
        this.initializeUI();
        this.initializeLocalBlast();
        this.initializeDatabaseManagement().catch(error => {
            console.error('Failed to initialize database management:', error);
        });
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
            // Use the same logic as Install BLAST+ Tools - check version directly
            // This is more reliable than 'which' command, especially on Windows
            const command = 'blastn -version';
            console.log('BlastManager: Running command:', command);
            const result = await this.runCommand(command);
            console.log('BlastManager: blastn -version result:', result);
            
            // Parse version information like the installer does
            const versionMatch = result.match(/blastn: ([\d.]+)/);
            if (versionMatch) {
                const installedVersion = versionMatch[1];
                console.log(`BlastManager: Found BLAST+ installation: v${installedVersion}`);
                
                // Store version info for later use
                this.config.installedBlastVersion = installedVersion;
                return true;
            } else {
                console.warn('BlastManager: BLAST+ version could not be determined from output');
                return false;
            }
        } catch (error) {
            console.warn('BlastManager: BLAST+ not found or not accessible:', error.message);
            
            // Try fallback detection methods for different platforms
            return await this.tryFallbackBlastDetection();
        }
    }

    async tryFallbackBlastDetection() {
        console.log('BlastManager: Trying fallback BLAST+ detection methods...');
        
        // Try common installation paths
        const commonPaths = [
            'blastn', // Already in PATH
            '/usr/local/bin/blastn', // Common Unix installation
            '/usr/bin/blastn', // System installation
            '/opt/blast+/bin/blastn', // Custom installation
            'C:\\Program Files\\NCBI\\blast+\\bin\\blastn.exe', // Windows default
            'C:\\blast+\\bin\\blastn.exe' // Windows alternative
        ];
        
        for (const blastPath of commonPaths) {
            try {
                console.log(`BlastManager: Trying path: ${blastPath}`);
                const command = `"${blastPath}" -version`;
                const result = await this.runCommand(command);
                
                const versionMatch = result.match(/blastn: ([\d.]+)/);
                if (versionMatch) {
                    const installedVersion = versionMatch[1];
                    console.log(`BlastManager: Found BLAST+ at ${blastPath}: v${installedVersion}`);
                    
                    // Store the working path and version
                    this.config.blastExecutablePath = blastPath;
                    this.config.installedBlastVersion = installedVersion;
                    return true;
                }
            } catch (error) {
                // Continue trying other paths
                console.debug(`BlastManager: Path ${blastPath} not accessible:`, error.message);
            }
        }
        
        console.warn('BlastManager: BLAST+ not found in any common locations');
        return false;
    }

    async checkAndFixBlastDatabaseDirectory() {
        const fs = require('fs');
        const path = require('path');
        
        try {
            const localDbPath = this.config.localDbPath;
            
            // Check if directory exists
            if (!fs.existsSync(localDbPath)) {
                console.log('BlastManager: Creating BLAST database directory:', localDbPath);
                fs.mkdirSync(localDbPath, { recursive: true });
                return true;
            }
            
            // Check if directory is writable
            try {
                await fs.promises.access(localDbPath, fs.constants.W_OK);
                return true;
            } catch (error) {
                console.error('BlastManager: BLAST database directory not writable:', localDbPath);
                throw new Error(`BLAST database directory not writable: ${localDbPath}`);
            }
        } catch (error) {
            console.error('BlastManager: Error checking BLAST database directory:', error);
            throw error;
        }
    }

    async runCommand(command, workingDirectory = null) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            const path = require('path');
            const fs = require('fs');

            // Check if it's a BLAST-related command
            const isBlastCommand = ['blastdbcmd', 'makeblastdb', 'blastn', 'blastp', 'blastx', 'tblastn', 'tblastx'].some(cmd => command.startsWith(cmd));

            let finalCommand = command;
            if (isBlastCommand) {
                // Use detected BLAST executable path if available
                if (this.config.blastExecutablePath) {
                    // Replace the BLAST command with the full path
                    const blastCommands = ['blastdbcmd', 'makeblastdb', 'blastn', 'blastp', 'blastx', 'tblastn', 'tblastx'];
                    for (const cmd of blastCommands) {
                        if (command.startsWith(cmd)) {
                            const blastDir = path.dirname(this.config.blastExecutablePath);
                            const commandExe = path.join(blastDir, cmd + (process.platform === 'win32' ? '.exe' : ''));
                            finalCommand = command.replace(cmd, `"${commandExe}"`);
                            console.log(`BlastManager: Using detected BLAST path: ${commandExe}`);
                            break;
                        }
                    }
                }
                
                // Set BLASTDB environment variable for the command
                const localDbPath = this.config.localDbPath; // Use the configured localDbPath
                
                // Check if BLASTDB directory exists, create it if it doesn't
                if (!fs.existsSync(localDbPath)) {
                    try {
                        fs.mkdirSync(localDbPath, { recursive: true });
                        console.log('BlastManager: Created BLASTDB directory:', localDbPath);
                    } catch (error) {
                        console.error('BlastManager: Failed to create BLASTDB directory:', error);
                        reject(new Error(`Failed to create BLASTDB directory: ${error.message}`));
                        return;
                    }
                }
                
                // Properly escape the BLASTDB path for shell execution
                const escapedDbPath = localDbPath.replace(/"/g, '\\"');
                finalCommand = `BLASTDB="${escapedDbPath}" ${finalCommand}`;
                console.log('BlastManager: Running BLAST command with BLASTDB set:', finalCommand);
            }

            // Set execution options
            const execOptions = {};
            if (workingDirectory) {
                execOptions.cwd = workingDirectory;
                console.log('BlastManager: Setting working directory to:', workingDirectory);
            }

            exec(finalCommand, execOptions, (error, stdout, stderr) => {
                if (error) {
                    console.error('BlastManager: Command execution error:', error);
                    console.error('BlastManager: Command stderr:', stderr);
                    
                    // Provide more specific error messages for common BLAST issues
                    if (stderr && stderr.includes('Database memory map file error')) {
                        reject(new Error(`BLAST database error: The database directory may be corrupted or inaccessible. Please check permissions for: ${this.config.localDbPath}`));
                    } else if (stderr && stderr.includes('BLAST Database error')) {
                        reject(new Error(`BLAST database error: ${stderr.trim()}`));
                    } else if (stderr && stderr.includes('is empty')) {
                        reject(new Error(`makeblastdb failed: File appears empty or unreadable. Check file format and permissions. Error: ${stderr.trim()}`));
                    } else if (stderr && stderr.includes('No such file or directory')) {
                        reject(new Error(`makeblastdb failed: File not found in working directory. Error: ${stderr.trim()}`));
                    } else if (command.includes('makeblastdb')) {
                        // Enhanced error reporting for makeblastdb specifically
                        let errorMessage = `makeblastdb failed: ${error.message}`;
                        if (stderr) {
                            errorMessage += ` STDERR: ${stderr.trim()}`;
                        }
                        reject(new Error(errorMessage));
                    } else {
                        reject(error);
                    }
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

        // Add standard databases first
        databases.forEach(db => {
            const option = document.createElement('option');
            option.value = db.value;
            option.textContent = db.label;
            if (db.description) {
                option.title = db.description;
            }
            select.appendChild(option);
        });

        // Add custom databases that are compatible with current BLAST type
        this.addCustomDatabaseOptions(activeType);
    }

    addCustomDatabaseOptions(blastType) {
        const select = document.getElementById('blastDatabase');
        if (!select || !this.customDatabases) return;

        // Add a separator if there are custom databases
        const customDbs = Array.from(this.customDatabases.values()).filter(db => 
            db.status === 'ready' && this.isDatabaseCompatible(db, blastType)
        );

        if (customDbs.length > 0) {
            // Add separator
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '── Custom Databases ──';
            separator.style.fontStyle = 'italic';
            separator.style.backgroundColor = '#f5f5f5';
            select.appendChild(separator);

            // Add custom databases
            customDbs.forEach(database => {
                const option = document.createElement('option');
                option.value = `custom_${database.id}`;
                option.textContent = `${database.name} (${database.type === 'nucl' ? 'Nucleotide' : 'Protein'})`;
                option.title = `Custom database - ${database.source === 'project' ? 'from project genome' : 'from file'}`;
                select.appendChild(option);
            });
        }
    }

    isDatabaseCompatible(database, blastType) {
        // Check if database type is compatible with BLAST type
        const dbType = database.type;
        
        switch (blastType) {
            case 'blastn':
                return dbType === 'nucl';
            case 'blastp':
                return dbType === 'prot';
            case 'blastx':
                return dbType === 'prot';
            case 'tblastn':
                return dbType === 'nucl';
            case 'tblastx':
                return dbType === 'nucl';
            default:
                return true; // Allow all if unknown type
        }
    }

    initializeUI() {
        // Make this instance globally accessible for onclick handlers
        window.blastManager = this;
        
        // Use a timeout to ensure DOM is fully rendered
        setTimeout(() => {
            this.setupEventListeners();
            this.initializeModal();
            this.ensureModalFooterVisibility();
            this.selectBlastType('blastn'); // Set default BLAST type
            this.initializeResizable(); // Make BLAST modal resizable
        }, 100);
    }

    initializeResizable() {
        // Initialize resizable functionality for BLAST Search modal
        try {
            if (window.resizableModalManager) {
                window.resizableModalManager.makeResizable('#blastSearchModal');
                console.log('BlastManager: BLAST Search modal made resizable');
            } else {
                console.warn('BlastManager: ResizableModalManager not available');
            }
        } catch (error) {
            console.error('BlastManager: Error initializing resizable modal:', error);
        }
    }

    ensureModalFooterVisibility() {
        // Check if modal footer is properly styled and visible
        const modal = document.getElementById('blastSearchModal');
        const modalContent = modal?.querySelector('.modal-content');
        const modalFooter = modal?.querySelector('.modal-footer');
        const runBlastBtn = document.getElementById('runBlastBtn');
        
        if (modal && modalContent) {
            // Ensure modal uses flexbox layout
            modalContent.style.display = 'flex';
            modalContent.style.flexDirection = 'column';
            modalContent.style.maxHeight = '90vh';
            modalContent.style.overflow = 'hidden';
            
            console.log('✓ Modal layout fixed');
        }
        
        if (modalFooter) {
            // Ensure modal footer has proper styles and is always visible
            modalFooter.style.display = 'flex';
            modalFooter.style.justifyContent = 'flex-end';
            modalFooter.style.gap = '12px';
            modalFooter.style.padding = '20px';
            modalFooter.style.borderTop = '1px solid #e5e7eb';
            modalFooter.style.background = '#f9fafb';
            modalFooter.style.flexShrink = '0';
            modalFooter.style.position = 'relative';
            modalFooter.style.zIndex = '10';
            modalFooter.style.marginTop = 'auto';
            
            console.log('✓ Modal footer visibility ensured');
        }
        
        if (runBlastBtn) {
            // Ensure run button is visible and properly styled
            runBlastBtn.style.display = 'inline-flex';
            runBlastBtn.style.alignItems = 'center';
            runBlastBtn.style.gap = '6px';
            runBlastBtn.style.visibility = 'visible';
            runBlastBtn.style.opacity = '1';
            runBlastBtn.style.position = 'relative';
            runBlastBtn.style.zIndex = '11';
            
            console.log('✓ Run BLAST button visibility ensured');
        }

        // Force a reflow to ensure styles are applied
        if (modalFooter) {
            modalFooter.offsetHeight;
        }
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

    async initializeDatabaseManagement() {
        console.log('BlastManager: Initializing database management...');
        
        // Load existing custom databases from ConfigManager or localStorage
        await this.loadCustomDatabases();
        
        // Set up database management event listeners
        this.setupDatabaseManagementListeners();
        
        // Populate UI elements
        this.populateAvailableDatabasesList();
        this.updateDatabaseOptions();
        
        console.log('✓ Database management initialized');
    }

    // Project Genomes functionality removed - databases are now created from custom files only

    async loadCustomDatabases() {
        console.log('=== BlastManager.loadCustomDatabases Debug Start ===');
        
        try {
            if (this.configManager) {
                console.log('Using ConfigManager for loading BLAST databases');
                
                // Try to migrate from localStorage first if needed
                const migrationResult = await this.configManager.migrateBlastDatabasesFromLocalStorage();
                if (migrationResult.migrated > 0) {
                    console.log(`Migrated ${migrationResult.migrated} databases from localStorage to ConfigManager`);
                }
                
                // Load databases from ConfigManager
                const databasesObject = await this.configManager.getBlastDatabases();
                console.log('Retrieved BLAST databases from ConfigManager:', databasesObject);
                
                // Convert object format back to Map for BlastManager compatibility
                this.customDatabases = new Map();
                Object.entries(databasesObject).forEach(([id, data]) => {
                    this.customDatabases.set(id, data);
                });
                
                console.log(`Loaded ${this.customDatabases.size} custom databases from ConfigManager`);
                
                // Validate database files still exist
                await this.validateStoredDatabases();
                
            } else {
                console.log('ConfigManager not available, falling back to localStorage');
                await this.loadFromLocalStorageFallback();
            }
        } catch (error) {
            console.error('Error loading custom databases:', error);
            await this.loadFromLocalStorageFallback();
        }
        
        console.log('=== BlastManager.loadCustomDatabases Debug End ===');
    }

    async loadFromLocalStorageFallback() {
        try {
            const saved = localStorage.getItem('blast_custom_databases');
            if (saved) {
                const savedData = JSON.parse(saved);
                
                // Handle both old format (direct array) and new format (with metadata)
                let databases;
                if (Array.isArray(savedData)) {
                    // Old format - direct array
                    databases = savedData;
                    console.log('Loading databases from old localStorage format');
                } else if (savedData.databases) {
                    // New format - with metadata
                    databases = savedData.databases;
                    console.log(`Loading databases from new localStorage format (version: ${savedData.version}, saved: ${savedData.timestamp})`);
                } else {
                    throw new Error('Invalid database format');
                }
                
                this.customDatabases = new Map(databases);
                console.log(`Loaded ${this.customDatabases.size} custom databases from localStorage`);
                
                // Validate database files still exist
                await this.validateStoredDatabases();
            } else {
                console.log('No custom databases found in localStorage');
                this.customDatabases = new Map();
            }
        } catch (error) {
            console.warn('Failed to load custom databases from localStorage:', error);
            
            // Try to load from backup
            try {
                const backup = localStorage.getItem('blast_custom_databases_backup');
                if (backup) {
                    const backupData = JSON.parse(backup);
                    const databases = backupData.databases || backupData;
                    this.customDatabases = new Map(databases);
                    console.log(`Loaded ${this.customDatabases.size} custom databases from backup`);
                } else {
                    this.customDatabases = new Map();
                }
            } catch (backupError) {
                console.error('Failed to load from backup as well:', backupError);
                this.customDatabases = new Map();
            }
        }
    }

    async validateStoredDatabases() {
        const fs = require('fs').promises;
        let removedCount = 0;
        
        for (const [dbId, database] of this.customDatabases) {
            try {
                if (database.dbPath) {
                    // Check if database files still exist
                    const extensions = database.type === 'nucl' ? ['.nhr', '.nin', '.nsq'] : ['.phr', '.pin', '.psq'];
                    let foundFiles = 0;
                    
                    for (const ext of extensions) {
                        try {
                            await fs.access(database.dbPath + ext);
                            foundFiles++;
                        } catch (error) {
                            // File doesn't exist
                        }
                    }
                    
                    if (foundFiles === 0) {
                        console.warn(`Database files not found for ${database.name}, removing from storage`);
                        this.customDatabases.delete(dbId);
                        removedCount++;
                    } else {
                        // Update last validated timestamp
                        database.lastValidated = new Date().toISOString();
                    }
                }
            } catch (error) {
                console.error(`Error validating database ${database.name}:`, error);
            }
        }
        
        if (removedCount > 0) {
            console.log(`Removed ${removedCount} invalid databases from storage`);
            await this.saveCustomDatabases();
        }
    }

    async saveCustomDatabases() {
        console.log('=== BlastManager.saveCustomDatabases Debug Start ===');
        
        try {
            if (this.configManager) {
                console.log('Using ConfigManager for saving BLAST databases');
                
                // Convert Map to object format for ConfigManager
                const databasesObject = {};
                this.customDatabases.forEach((data, id) => {
                    databasesObject[id] = data;
                });
                
                // Save each database individually to ConfigManager
                for (const [id, data] of this.customDatabases.entries()) {
                    await this.configManager.setBlastDatabase(id, data);
                }
                
                console.log(`Custom databases saved to ConfigManager: ${this.customDatabases.size} databases`);
                
            } else {
                console.log('ConfigManager not available, falling back to localStorage');
                await this.saveToLocalStorageFallback();
            }
        } catch (error) {
            console.error('Failed to save custom databases to ConfigManager:', error);
            // Fallback to localStorage on error
            await this.saveToLocalStorageFallback();
        }
        
        console.log('=== BlastManager.saveCustomDatabases Debug End ===');
    }

    async saveToLocalStorageFallback() {
        try {
            const databases = Array.from(this.customDatabases.entries());
            const databaseData = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                databases: databases
            };
            localStorage.setItem('blast_custom_databases', JSON.stringify(databaseData));
            console.log(`Custom databases saved to localStorage: ${databases.length} databases`);
            
            // Also save to a backup key for safety
            localStorage.setItem('blast_custom_databases_backup', JSON.stringify(databaseData));
        } catch (error) {
            console.error('Failed to save custom databases to localStorage:', error);
        }
    }

    setupDatabaseManagementListeners() {
        // Browse custom file button
        const browseBtn = document.getElementById('browseCustomFileBtn');
        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.browseCustomFile();
            });
            console.log('✓ Browse custom file button listener added');
        }

        // Create custom database button
        const createCustomBtn = document.getElementById('createCustomDbBtn');
        if (createCustomBtn) {
            createCustomBtn.addEventListener('click', () => {
                this.createCustomDatabase();
            });
            console.log('✓ Create custom database button listener added');
        }

        // Quick database creation buttons
        const createNuclBtn = document.getElementById('createNuclDbBtn');
        if (createNuclBtn) {
            createNuclBtn.addEventListener('click', () => {
                this.createQuickDatabase('nucl');
            });
            console.log('✓ Create nucleotide database button listener added');
        }

        const createProtBtn = document.getElementById('createProtDbBtn');
        if (createProtBtn) {
            createProtBtn.addEventListener('click', () => {
                this.createQuickDatabase('prot');
            });
            console.log('✓ Create protein database button listener added');
        }

        // Auto-generate database name when file is selected
        const filePathInput = document.getElementById('customFilePath');
        if (filePathInput) {
            filePathInput.addEventListener('change', () => {
                this.autoGenerateDbName();
            });
        }

        // Add keyboard shortcut listener for BLAST modal
        this.setupKeyboardShortcuts();
    }

    setupKeyboardShortcuts() {
        // Add global keyboard listener for BLAST modal
        document.addEventListener('keydown', (event) => {
            // Check if BLAST modal is open
            const blastModal = document.getElementById('blastSearchModal');
            if (!blastModal || !blastModal.classList.contains('show')) {
                return;
            }

            // Check for Ctrl+Enter (or Cmd+Enter on Mac)
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                
                // Only trigger if we're on the BLAST Search tab
                const blastSearchTab = document.getElementById('blast-search-tab');
                if (blastSearchTab && blastSearchTab.classList.contains('active')) {
                    console.log('BlastManager: Keyboard shortcut triggered (Ctrl+Enter)');
                    this.runBlastSearch();
                    
                    // Show visual feedback
                    this.showNotification('BLAST search started via keyboard shortcut', 'info');
                }
            }
        });

        console.log('✓ Keyboard shortcuts set up (Ctrl+Enter to run BLAST)');
    }

    // populateProjectGenomesList method removed - Project Genomes functionality disabled

    populateAvailableDatabasesList() {
        const container = document.getElementById('availableDatabasesList');
        if (!container) return;

        let html = `
            <!-- Standard NCBI Databases -->
            <div class="database-item">
                <div class="database-info">
                    <div class="database-name">NCBI Nucleotide collection (nt)</div>
                    <div class="database-details">Remote database • Nucleotide sequences</div>
                </div>
                <div class="status-indicator status-success">
                    <i class="fas fa-check"></i> Available
                </div>
            </div>
            
            <div class="database-item">
                <div class="database-info">
                    <div class="database-name">NCBI Non-redundant protein sequences (nr)</div>
                    <div class="database-details">Remote database • Protein sequences</div>
                </div>
                <div class="status-indicator status-success">
                    <i class="fas fa-check"></i> Available
                </div>
            </div>
        `;

        // Add custom databases
        this.customDatabases.forEach((database, id) => {
            const locationInfo = database.location === 'source_directory' ? 
                `Located in source directory` : 
                `Custom file database`;
            html += `
                <div class="database-item">
                    <div class="database-info">
                        <div class="database-name">${this.escapeHtml(database.name)}</div>
                        <div class="database-details">Local database • ${locationInfo} • ${database.type === 'nucl' ? 'Nucleotide' : 'Protein'}</div>
                        ${database.sourceDirectory ? `<div class="database-path">Path: ${this.escapeHtml(database.sourceDirectory)}</div>` : ''}
                    </div>
                    <div class="database-actions">
                        <div class="status-indicator status-${database.status}">
                            <i class="fas fa-${database.status === 'ready' ? 'check' : database.status === 'creating' ? 'spinner fa-spin' : 'exclamation-triangle'}"></i>
                            ${database.status.charAt(0).toUpperCase() + database.status.slice(1)}
                        </div>
                        <button class="btn btn-sm btn-danger delete-custom-db-btn" data-db-id="${id}" title="Delete database">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;

        // Add event listeners for delete buttons
        container.querySelectorAll('.delete-custom-db-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const dbId = btn.dataset.dbId;
                const database = this.customDatabases.get(dbId);
                
                if (database && confirm(`Are you sure you want to delete the database "${database.name}"?\n\nThis will permanently remove the database files.`)) {
                    try {
                        btn.disabled = true;
                        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                        
                        await this.deleteCustomDatabase(dbId);
                        this.showNotification(`Database "${database.name}" deleted successfully`, 'success');
                    } catch (error) {
                        console.error('Error deleting database:', error);
                        this.showNotification(`Failed to delete database: ${error.message}`, 'error');
                        
                        // Restore button
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-trash"></i>';
                    }
                }
            });
        });
    }

    // createGenomeDatabase method removed - Project Genomes functionality disabled



    async browseCustomFile() {
        try {
            // Use IPC to show file dialog
            const result = await ipcRenderer.invoke('selectFastaFile');
            
            if (result.success && result.filePath) {
                document.getElementById('customFilePath').value = result.filePath;
                this.autoGenerateDbName();
            } else if (result.canceled) {
                // User canceled the dialog - no error needed
                return;
            } else {
                throw new Error(result.error || 'Failed to select file');
            }
        } catch (error) {
            console.error('Error browsing for custom file:', error);
            this.showNotification('Failed to browse for file', 'error');
        }
    }

    autoGenerateDbName() {
        const filePath = document.getElementById('customFilePath').value;
        const dbNameInput = document.getElementById('customDbName');
        
        if (filePath && dbNameInput && !dbNameInput.value) {
            // Extract filename without extension
            const filename = filePath.split('/').pop().replace(/\.(fasta|fa|fas|txt)$/i, '');
            const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            dbNameInput.value = `${filename}_${timestamp}`;
        }
    }

    // createGenomeDatabase method removed - Project Genomes functionality disabled

    async createCustomDatabase() {
        const filePath = document.getElementById('customFilePath').value.trim();
        const dbName = document.getElementById('customDbName').value.trim();
        const dbType = document.getElementById('customDbType').value;

        if (!filePath || !dbName) {
            this.showNotification('Please select a file and enter a database name', 'error');
            return;
        }

        const dbId = `custom_${dbName.replace(/[^a-zA-Z0-9_]/g, '_')}_${Date.now()}`;

        // Check if database name already exists
        const existingDb = Array.from(this.customDatabases.values()).find(db => db.name === dbName);
        if (existingDb) {
            this.showNotification(`Database with name "${dbName}" already exists`, 'error');
            return;
        }

        // Show operation log
        this.showOperationLog();
        this.appendLog(`Creating custom ${dbType === 'nucl' ? 'nucleotide' : 'protein'} database...`);

        try {
            // Add to custom databases with creating status
            this.customDatabases.set(dbId, {
                id: dbId,
                name: dbName,
                type: dbType,
                source: 'custom',
                filePath: filePath,
                status: 'creating',
                created: new Date().toISOString()
            });

            // Update UI
            this.populateAvailableDatabasesList();

            this.appendLog(`Source file: ${filePath}`);
            this.appendLog(`Database name: ${dbName}`);
            
            // Create database in the same directory as the source file
            const path = require('path');
            const sourceDirectory = path.dirname(filePath);
            const dbFileName = `${dbId}`;
            const outputPath = path.join(sourceDirectory, dbFileName);
            
            this.appendLog(`Creating database in source directory: ${sourceDirectory}`);
            this.appendLog(`Database output path: ${outputPath}`);
            
            this.appendLog(`Validating FASTA file format...`);
            
            // Check if BLAST+ is installed
            const isBlastInstalled = await this.checkBlastInstallation();
            if (!isBlastInstalled) {
                this.appendLog(`⚠ BLAST+ not installed. Creating database entry for future use.`, 'warning');
                
                // Mark as ready but note that BLAST+ is needed for actual searching
                this.customDatabases.get(dbId).status = 'ready';
                this.customDatabases.get(dbId).note = 'BLAST+ installation required for searching';
                
                this.appendLog(`✓ Database entry created: ${dbName}`, 'success');
                this.appendLog(`Note: Install BLAST+ to enable actual searching`, 'warning');
            } else {
                // Check and fix BLAST database directory
                try {
                    await this.checkAndFixBlastDatabaseDirectory();
                    this.appendLog(`✓ BLAST database directory verified: ${this.config.localDbPath}`, 'success');
                } catch (error) {
                    this.appendLog(`⚠ Database directory issue: ${error.message}`, 'warning');
                    this.appendLog(`Attempting to create database anyway...`, 'info');
                }
                this.appendLog(`Running: makeblastdb -in "${filePath}" -dbtype ${dbType} -out "${outputPath}"`);
                
                try {
                    // Create the actual BLAST database
                    // Use relative paths to avoid issues with spaces in absolute paths
                    const path = require('path');
                    const fileName = path.basename(filePath);
                    const sourceDirectory = path.dirname(filePath);
                    const outputName = path.basename(outputPath);
                    
                    // Check if source file exists and is readable
                    const fs = require('fs');
                    if (!fs.existsSync(filePath)) {
                        throw new Error(`Source file not found: ${filePath}`);
                    }
                    
                    // Validate file content
                    try {
                        const stats = await fs.promises.stat(filePath);
                        if (stats.size === 0) {
                            throw new Error(`Source file is empty: ${filePath}`);
                        }
                        
                        // Check if file has FASTA content
                        const fileContent = await fs.promises.readFile(filePath, 'utf8');
                        if (!fileContent.trim()) {
                            throw new Error(`Source file contains no content: ${filePath}`);
                        }
                        
                        // Enhanced FASTA format validation
                        const lines = fileContent.split('\n');
                        const firstLine = lines[0].trim();
                        
                        // Check if first line starts with '>' (proper FASTA header)
                        if (!firstLine.startsWith('>')) {
                            throw new Error(`File does not appear to be in FASTA format (first line should start with '>'): ${filePath}`);
                        }
                        
                        // Validate FASTA structure - should have headers and sequences
                        let headerCount = 0;
                        let hasSequenceData = false;
                        
                        for (let i = 0; i < Math.min(lines.length, 100); i++) { // Check first 100 lines
                            const line = lines[i].trim();
                            if (line.startsWith('>')) {
                                headerCount++;
                            } else if (line && /^[ACGTUNRYSWKMBDHV-]+$/i.test(line)) {
                                hasSequenceData = true;
                            } else if (line && line.length > 0 && !/^[ACGTUNRYSWKMBDHV-]+$/i.test(line)) {
                                // Check if it looks like GenBank or other format
                                if (line.includes('LOCUS') || line.includes('ACCESSION') || line.includes('VERSION')) {
                                    throw new Error(`File appears to be in GenBank format, not FASTA: ${filePath}`);
                                }
                            }
                        }
                        
                        if (headerCount === 0) {
                            throw new Error(`File does not contain valid FASTA headers: ${filePath}`);
                        }
                        
                        if (!hasSequenceData) {
                            throw new Error(`File does not contain valid nucleotide/protein sequence data: ${filePath}`);
                        }
                        
                        // Count total sequences for reporting
                        const sequences = fileContent.split('>').filter(seq => seq.trim()).length;
                        
                        this.appendLog(`✓ File validation passed: ${(stats.size / 1024).toFixed(2)} KB, ${sequences} sequences, first header: ${firstLine.substring(0, 50)}${firstLine.length > 50 ? '...' : ''}`);
                        
                    } catch (error) {
                        if (error.code === 'EACCES') {
                            throw new Error(`Cannot read source file (permission denied): ${filePath}`);
                        } else if (error.code === 'ENOENT') {
                            throw new Error(`Source file not found: ${filePath}`);
                        } else {
                            throw error;
                        }
                    }
                    
                    // Check if source directory is writable
                    try {
                        await fs.promises.access(sourceDirectory, fs.constants.W_OK);
                    } catch (error) {
                        throw new Error(`Cannot write to source directory: ${sourceDirectory}. Please check permissions.`);
                    }
                    
                    // Build command with properly escaped paths
                    const escapedFileName = fileName.replace(/"/g, '\\"');
                    const escapedOutputName = outputName.replace(/"/g, '\\"');
                    const escapedDbName = dbName.replace(/"/g, '\\"');
                    const makeblastdbCmd = `makeblastdb -in "${escapedFileName}" -dbtype ${dbType} -out "${escapedOutputName}" -title "${escapedDbName}"`;
                    
                    this.appendLog(`Executing: ${makeblastdbCmd} in directory: ${sourceDirectory}`);
                    
                    // Additional debugging - verify file is still accessible from working directory
                    const fileInWorkingDir = path.join(sourceDirectory, fileName);
                    if (!fs.existsSync(fileInWorkingDir)) {
                        throw new Error(`File not accessible from working directory: ${fileInWorkingDir}`);
                    }
                    
                    // Additional debugging - list files in working directory
                    try {
                        const filesInDir = await fs.promises.readdir(sourceDirectory);
                        this.appendLog(`Files in working directory: ${filesInDir.filter(f => f.includes('.fasta') || f.includes('.fa')).join(', ')}`);
                    } catch (error) {
                        this.appendLog(`⚠ Could not list directory contents: ${error.message}`, 'warning');
                    }
                    
                    // Execute command in the source directory
                    try {
                        await this.runCommand(makeblastdbCmd, sourceDirectory);
                    } catch (error) {
                        // If relative path fails, try absolute path as fallback
                        if (error.message.includes('is empty') || error.message.includes('No such file')) {
                            this.appendLog(`⚠ Relative path failed, trying absolute path...`, 'warning');
                            const escapedFilePath = filePath.replace(/"/g, '\\"');
                            const escapedOutputPath = outputPath.replace(/"/g, '\\"');
                            const escapedDbNameFallback = dbName.replace(/"/g, '\\"');
                            const absoluteCmd = `makeblastdb -in "${escapedFilePath}" -dbtype ${dbType} -out "${escapedOutputPath}" -title "${escapedDbNameFallback}"`;
                            this.appendLog(`Retrying with absolute paths: ${absoluteCmd}`);
                            await this.runCommand(absoluteCmd);
                        } else {
                            throw error;
                        }
                    }
                    
                    // Mark as ready and store additional metadata
                    const dbEntry = this.customDatabases.get(dbId);
                    dbEntry.status = 'ready';
                    dbEntry.dbPath = outputPath;
                    dbEntry.sourceDirectory = sourceDirectory;
                    dbEntry.location = 'source_directory';
                    dbEntry.lastUsed = new Date().toISOString();
                    
                    this.appendLog(`✓ Custom database created successfully: ${dbName}`, 'success');
                    
                    // Check which files were created
                    const extensions = dbType === 'nucl' ? ['.nhr', '.nin', '.nsq'] : ['.phr', '.pin', '.psq'];
                    const createdFiles = [];
                    for (const ext of extensions) {
                        try {
                            await require('fs').promises.access(outputPath + ext);
                            createdFiles.push(dbId + ext);
                        } catch (error) {
                            // File doesn't exist
                        }
                    }
                    
                    if (createdFiles.length > 0) {
                        this.appendLog(`Database files created: ${createdFiles.join(', ')}`, 'success');
                    }
                    
                } catch (error) {
                    throw new Error(`makeblastdb failed: ${error.message}`);
                }
            }
            
            // Save to ConfigManager
            await this.saveCustomDatabases();
            
            // Update UI
            this.populateAvailableDatabasesList();
            this.updateDatabaseOptions();
            
            // Clear form
            document.getElementById('customFilePath').value = '';
            document.getElementById('customDbName').value = '';
            
            this.showNotification(`Custom database "${dbName}" created successfully`, 'success');
            
        } catch (error) {
            console.error('Error creating custom database:', error);
            this.appendLog(`✗ Error creating database: ${error.message}`, 'error');
            
            // Remove from custom databases
            this.customDatabases.delete(dbId);
            
            // Update UI
            this.populateAvailableDatabasesList();
            
            this.showNotification(`Failed to create database: ${error.message}`, 'error');
        }
    }

    // Quick database creation for current genome
    async createQuickDatabase(dbType) {
        try {
            // Check if there's a currently loaded genome
            if (!this.app?.fileManager?.loadedGenomes) {
                this.showNotification('No genome data loaded. Please load a genome first.', 'error');
                return;
            }

            const loadedGenomes = this.app.fileManager.loadedGenomes;
            const genomeNames = Object.keys(loadedGenomes);

            if (genomeNames.length === 0) {
                this.showNotification('No genome data available. Please load a genome first.', 'error');
                return;
            }

            // Use the first loaded genome or let user choose if multiple
            const genomeName = genomeNames[0];
            const genome = loadedGenomes[genomeName];

            if (!genome || !genome.sequences) {
                this.showNotification('Invalid genome data structure.', 'error');
                return;
            }

            // Show status
            const statusDiv = document.getElementById('quickDbStatus');
            const statusContent = document.getElementById('quickDbStatusContent');
            if (statusDiv && statusContent) {
                statusDiv.style.display = 'block';
                statusContent.innerHTML = `<div class="alert alert-info">Creating ${dbType === 'nucl' ? 'nucleotide' : 'protein'} database for ${genomeName}...</div>`;
            }

            // Create database name
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
            const dbName = `${genomeName}_${dbType === 'nucl' ? 'nucleotide' : 'protein'}_${timestamp}`;

            // Get all sequences from the genome
            let fastaContent = '';
            Object.keys(genome.sequences).forEach(chromName => {
                const sequence = genome.sequences[chromName];
                if (sequence) {
                    fastaContent += `>${chromName}\n${sequence}\n`;
                }
            });

            if (!fastaContent) {
                throw new Error('No sequence data found in loaded genome');
            }

            // For protein database, we need to translate the sequences
            if (dbType === 'prot') {
                fastaContent = this.translateSequencesToProtein(fastaContent);
            }

            // Create temporary file
            const tempFile = await this.writeSequenceToFile(fastaContent, dbName, dbType);

            // Create the database
            await this.createLocalDatabase({
                inputFile: tempFile,
                dbName: dbName,
                dbType: dbType,
                title: `${genomeName} - ${dbType === 'nucl' ? 'Nucleotide' : 'Protein'} Database`
            });

            // Update status
            if (statusContent) {
                statusContent.innerHTML = `<div class="alert alert-success">Successfully created ${dbType === 'nucl' ? 'nucleotide' : 'protein'} database: ${dbName}</div>`;
            }

            // Refresh database list
            await this.loadLocalDatabases();
            this.populateAvailableDatabasesList();

            this.showNotification(`${dbType === 'nucl' ? 'Nucleotide' : 'Protein'} database created successfully: ${dbName}`, 'success');

        } catch (error) {
            console.error('Error creating quick database:', error);
            
            const statusContent = document.getElementById('quickDbStatusContent');
            if (statusContent) {
                statusContent.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
            }

            this.showNotification(`Failed to create database: ${error.message}`, 'error');
        }
    }

    // Translate nucleotide sequences to protein (simplified implementation)
    translateSequencesToProtein(fastaContent) {
        const codonTable = {
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

        const lines = fastaContent.split('\n');
        let translatedFasta = '';
        let currentHeader = '';
        let currentSequence = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('>')) {
                // Process previous sequence if exists
                if (currentHeader && currentSequence) {
                    const proteinSeq = this.translateToProtein(currentSequence.toUpperCase(), codonTable);
                    translatedFasta += `${currentHeader}_translated\n${proteinSeq}\n`;
                }
                
                // Start new sequence
                currentHeader = line;
                currentSequence = '';
            } else if (line) {
                currentSequence += line;
            }
        }

        // Process last sequence
        if (currentHeader && currentSequence) {
            const proteinSeq = this.translateToProtein(currentSequence.toUpperCase(), codonTable);
            translatedFasta += `${currentHeader}_translated\n${proteinSeq}\n`;
        }

        return translatedFasta;
    }

    translateToProtein(nucleotideSeq, codonTable) {
        let proteinSeq = '';
        
        // Find all possible reading frames and take the longest ORF
        let longestORF = '';
        
        for (let frame = 0; frame < 3; frame++) {
            let orf = '';
            for (let i = frame; i < nucleotideSeq.length - 2; i += 3) {
                const codon = nucleotideSeq.substring(i, i + 3);
                const aminoAcid = codonTable[codon] || 'X';
                
                if (aminoAcid === '*') {
                    if (orf.length > longestORF.length) {
                        longestORF = orf;
                    }
                    orf = '';
                } else {
                    orf += aminoAcid;
                }
            }
            
            // Check final ORF
            if (orf.length > longestORF.length) {
                longestORF = orf;
            }
        }

        return longestORF || 'XXXX'; // Return at least something if no valid translation
    }

    // Custom database deletion
    async deleteCustomDatabase(dbId) {
        console.log(`=== BlastManager.deleteCustomDatabase Debug Start: ${dbId} ===`);
        
        try {
            // Check if database exists
            if (!this.customDatabases.has(dbId)) {
                throw new Error('Custom database not found');
            }

            const database = this.customDatabases.get(dbId);
            console.log(`Deleting custom database: ${database.name}`);

            // Delete database files if they exist
            if (database.dbPath) {
                try {
                    const fs = require('fs').promises;
                    const extensions = database.type === 'nucl' ? ['.nhr', '.nin', '.nsq'] : ['.phr', '.pin', '.psq'];
                    
                    for (const ext of extensions) {
                        try {
                            await fs.unlink(database.dbPath + ext);
                            console.log(`Deleted database file: ${database.dbPath + ext}`);
                        } catch (error) {
                            console.warn(`Could not delete file ${database.dbPath + ext}:`, error.message);
                        }
                    }
                } catch (error) {
                    console.warn('Error deleting database files:', error);
                }
            }

            // Remove from memory
            this.customDatabases.delete(dbId);

            // Remove from ConfigManager
            if (this.configManager) {
                await this.configManager.removeBlastDatabase(dbId);
                console.log(`Removed database ${dbId} from ConfigManager`);
            } else {
                // Fallback to localStorage update
                await this.saveToLocalStorageFallback();
                console.log(`Updated localStorage after removing database ${dbId}`);
            }

            // Update UI
            this.populateAvailableDatabasesList();
            this.updateDatabaseOptions();

            console.log(`✓ Custom database ${database.name} deleted successfully`);
            return true;
            
        } catch (error) {
            console.error(`Error deleting custom database ${dbId}:`, error);
            throw error;
        } finally {
            console.log(`=== BlastManager.deleteCustomDatabase Debug End: ${dbId} ===`);
        }
    }

    // Helper methods
    hasDatabase(genomeId, dbType) {
        const dbId = `${genomeId}_${dbType}`;
        return this.customDatabases.has(dbId) && this.customDatabases.get(dbId).status === 'ready';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showOperationLog() {
        const logContainer = document.getElementById('dbOperationLog');
        if (logContainer) {
            logContainer.style.display = 'block';
            document.getElementById('dbLogContent').innerHTML = '';
        }
    }

    appendLog(message, type = 'info') {
        const logContent = document.getElementById('dbLogContent');
        if (!logContent) return;

        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${message}`;
        
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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

    // Inject necessary CSS styles
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tab-content-padding {
                padding: 15px;
            }
            
            #db-management-tab > * {
                padding-left: 15px;
                padding-right: 15px;
            }

            /* Modern BLAST Results Styles */
            .blast-results-modern {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                min-height: 100vh;
                padding: 20px;
            }

            /* Header Styles */
            .blast-results-header {
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                margin-bottom: 20px;
                overflow: hidden;
            }

            .header-title {
                padding: 20px 24px;
                border-bottom: 1px solid #e2e8f0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .header-title h3 {
                margin: 0;
                font-size: 1.5rem;
                font-weight: 600;
            }

            .header-badges {
                display: flex;
                gap: 8px;
            }

            .badge {
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.85rem;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .badge-source { background: rgba(255, 255, 255, 0.2); }
            .badge-database { background: rgba(255, 255, 255, 0.15); }
            .badge-type { background: rgba(255, 255, 255, 0.1); }

            .query-summary {
                padding: 20px 24px;
                display: grid;
                grid-template-columns: 1fr 2fr;
                gap: 24px;
            }

            .query-info h4 {
                margin: 0 0 16px 0;
                color: #374151;
                font-size: 1.1rem;
            }

            .query-details {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .query-detail {
                display: flex;
                justify-content: space-between;
                padding: 8px 0;
                border-bottom: 1px solid #f3f4f6;
            }

            .query-detail .label {
                font-weight: 500;
                color: #6b7280;
            }

            .query-detail .value {
                font-weight: 600;
                color: #111827;
            }

            .sequence-preview {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 16px;
            }

            .sequence-preview pre {
                margin: 0;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 0.85rem;
                line-height: 1.5;
                color: #374151;
                word-break: break-all;
                white-space: pre-wrap;
            }

            /* Controls Styles */
            .blast-results-controls {
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
                margin-bottom: 20px;
                padding: 20px 24px;
            }

            .controls-section {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr;
                gap: 24px;
                align-items: end;
            }

            .filter-controls, .sort-controls, .view-controls {
                display: flex;
                gap: 16px;
                align-items: end;
            }

            .control-group {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .control-group label {
                font-size: 0.85rem;
                font-weight: 500;
                color: #374151;
            }

            .form-control {
                padding: 8px 12px;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 0.9rem;
                transition: border-color 0.2s;
            }

            .form-control:focus {
                outline: none;
                border-color: #3b82f6;
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
            }

            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 0.9rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .btn-secondary {
                background: #6b7280;
                color: white;
            }

            .btn-secondary:hover {
                background: #4b5563;
            }

            .btn-success {
                background: #10b981;
                color: white;
            }

            .btn-success:hover {
                background: #059669;
            }

            .btn-outline-primary {
                background: white;
                color: #3b82f6;
                border: 1px solid #3b82f6;
            }

            .btn-outline-primary:hover,
            .btn-outline-primary.active {
                background: #3b82f6;
                color: white;
            }

            .btn-group {
                display: flex;
                border-radius: 6px;
                overflow: hidden;
            }

            .btn-group .btn {
                border-radius: 0;
                border-right: 1px solid #d1d5db;
            }

            .btn-group .btn:last-child {
                border-right: none;
            }

            /* Summary Stats */
            .blast-results-summary {
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
                margin-bottom: 20px;
                padding: 20px 24px;
            }

            .summary-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 16px;
                margin-bottom: 16px;
            }

            .stat-card {
                display: flex;
                align-items: center;
                gap: 16px;
                padding: 16px;
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                border-radius: 8px;
                border: 1px solid #e2e8f0;
            }

            .stat-icon {
                width: 48px;
                height: 48px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                font-size: 1.2rem;
            }

            .stat-content {
                flex: 1;
            }

            .stat-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: #111827;
                line-height: 1;
            }

            .stat-label {
                font-size: 0.85rem;
                color: #6b7280;
                margin-top: 4px;
            }

            .hits-counter {
                text-align: center;
                padding: 12px;
                background: #f3f4f6;
                border-radius: 6px;
                font-weight: 500;
                color: #374151;
            }

            /* Hits Container */
            .blast-hits-container {
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
                margin-bottom: 20px;
                overflow: hidden;
            }

            .hits-list {
                max-height: 800px;
                overflow-y: auto;
            }

            /* Hit Styles */
            .blast-hit {
                border-bottom: 1px solid #e2e8f0;
                transition: all 0.2s;
            }

            .blast-hit:last-child {
                border-bottom: none;
            }

            .blast-hit:hover {
                background: #f8fafc;
            }

            /* Compact Hit Styles */
            .blast-hit.compact .hit-header {
                padding: 16px 24px;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .hit-main-info {
                flex: 1;
                min-width: 0;
            }

            .hit-title {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 4px;
            }

            .hit-accession {
                font-weight: 600;
                color: #3b82f6;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            }

            .hit-description {
                color: #374151;
                font-size: 0.95rem;
            }

            .hit-organism {
                font-size: 0.85rem;
                color: #6b7280;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .hit-scores {
                display: flex;
                gap: 20px;
                margin-left: 20px;
            }

            .score-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 2px;
            }

            .score-label {
                font-size: 0.75rem;
                color: #6b7280;
                font-weight: 500;
            }

            .score-value {
                font-size: 0.9rem;
                font-weight: 600;
                color: #111827;
            }

            .hit-expand {
                margin-left: 20px;
                color: #6b7280;
                transition: transform 0.2s;
            }

            .blast-hit.expanded .hit-expand {
                transform: rotate(180deg);
            }

            .hit-details {
                max-height: 0;
                overflow: hidden;
                transition: max-height 0.3s ease-out;
            }

            .blast-hit.expanded .hit-details {
                max-height: 1000px;
            }

            /* Detailed Hit Styles */
            .blast-hit.detailed {
                margin-bottom: 16px;
            }

            .hit-card {
                margin: 16px 24px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                overflow: hidden;
            }

            .hit-card-header {
                padding: 20px;
                background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 20px;
            }

            .hit-title-section {
                flex: 1;
            }

            .hit-title {
                margin: 0 0 8px 0;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .external-link {
                color: #6b7280;
                text-decoration: none;
                transition: color 0.2s;
            }

            .external-link:hover {
                color: #3b82f6;
            }

            .hit-description {
                margin: 0 0 12px 0;
                color: #374151;
                line-height: 1.4;
            }

            .hit-meta {
                display: flex;
                flex-wrap: wrap;
                gap: 16px;
            }

            .meta-item {
                font-size: 0.85rem;
                color: #6b7280;
                display: flex;
                align-items: center;
                gap: 6px;
            }

            .hit-scores-detailed {
                flex-shrink: 0;
            }

            .score-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }

            .score-card {
                padding: 12px;
                border-radius: 6px;
                text-align: center;
                border: 1px solid #e2e8f0;
                background: white;
            }

            .score-card.primary {
                background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
                color: white;
                border-color: #3b82f6;
            }

            .score-card .score-value {
                font-size: 1.1rem;
                font-weight: 700;
                line-height: 1;
            }

            .score-card .score-label {
                font-size: 0.75rem;
                margin-top: 4px;
                opacity: 0.8;
            }

            .hit-card-body {
                padding: 20px;
            }

            /* Score Color Classes */
            .excellent { color: #059669; }
            .very-good { color: #0891b2; }
            .good { color: #0d9488; }
            .fair { color: #d97706; }
            .poor { color: #dc2626; }

            .score-card.excellent { border-color: #059669; background: #ecfdf5; }
            .score-card.very-good { border-color: #0891b2; background: #ecfeff; }
            .score-card.good { border-color: #0d9488; background: #f0fdfa; }
            .score-card.fair { border-color: #d97706; background: #fffbeb; }
            .score-card.poor { border-color: #dc2626; background: #fef2f2; }

            /* Hit Details Content */
            .hit-details-content {
                padding: 20px;
                border-top: 1px solid #e2e8f0;
            }

            .alignment-info h6,
            .alignment-display h6 {
                margin: 0 0 12px 0;
                color: #374151;
                font-size: 1rem;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .alignment-stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 12px;
                margin-bottom: 20px;
            }

            .alignment-stats .stat {
                display: flex;
                justify-content: space-between;
                padding: 8px 12px;
                background: #f8fafc;
                border-radius: 4px;
                border: 1px solid #e2e8f0;
            }

            .alignment-stats .stat-label {
                font-weight: 500;
                color: #6b7280;
            }

            .alignment-stats .stat-value {
                font-weight: 600;
                color: #111827;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            }

            .alignment-viewer {
                background: #1f2937;
                border-radius: 8px;
                overflow: hidden;
            }

            .alignment-controls {
                padding: 12px 16px;
                background: #374151;
                border-bottom: 1px solid #4b5563;
            }

            .alignment-text {
                padding: 16px;
                margin: 0;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 0.85rem;
                line-height: 1.4;
                color: #f9fafb;
                background: #1f2937;
                overflow-x: auto;
                white-space: pre;
            }

            .alignment-viewer.wrapped .alignment-text {
                white-space: pre-wrap;
                word-break: break-all;
            }

            /* Multiple HSPs */
            .multiple-hsps {
                margin-top: 20px;
                padding-top: 20px;
                border-top: 1px solid #e2e8f0;
            }

            .hsps-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .hsp-item {
                padding: 12px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
            }

            .hsp-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }

            .hsp-number {
                font-weight: 600;
                color: #374151;
            }

            .hsp-score,
            .hsp-evalue {
                font-size: 0.85rem;
                color: #6b7280;
            }

            .hsp-ranges {
                font-size: 0.85rem;
                color: #6b7280;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            }

            /* No Hits Message */
            .no-hits-message {
                padding: 60px 20px;
                text-align: center;
                color: #6b7280;
            }

            .no-hits-content i {
                font-size: 3rem;
                margin-bottom: 16px;
                opacity: 0.5;
            }

            .no-hits-content h4 {
                margin: 0 0 8px 0;
                color: #374151;
            }

            .no-hits-content p {
                margin: 0;
                font-size: 0.9rem;
            }

            /* Footer */
            .blast-results-footer {
                background: white;
                border-radius: 12px;
                box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.1);
                padding: 16px 24px;
                text-align: center;
            }

            .footer-info {
                color: #6b7280;
                font-size: 0.85rem;
            }

            /* Responsive Design */
            @media (max-width: 1024px) {
                .controls-section {
                    grid-template-columns: 1fr;
                    gap: 16px;
                }
                
                .query-summary {
                    grid-template-columns: 1fr;
                }
                
                .hit-scores {
                    flex-wrap: wrap;
                    gap: 12px;
                }
                
                .score-grid {
                    grid-template-columns: 1fr;
                }
            }

            @media (max-width: 768px) {
                .blast-results-modern {
                    padding: 12px;
                }
                
                .header-title {
                    flex-direction: column;
                    gap: 12px;
                    align-items: flex-start;
                }
                
                .filter-controls,
                .sort-controls,
                .view-controls {
                    flex-direction: column;
                    gap: 8px;
                }
                
                .hit-card-header {
                    flex-direction: column;
                    gap: 16px;
                }
                
                .alignment-stats {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    initializeModal() {
        // Initialize modal-specific functionality if needed
        // This can be expanded later for modal-specific features
        this.injectStyles(); // Inject styles when modal is initialized
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
        
        // Ensure run button is enabled when service changes
        this.updateRunButton(false);
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
        
        // Allow common DNA/RNA and protein characters, and ambiguous codes
        sequence = sequence.replace(/[^A-Z*]/gi, ''); // Basic filter for letters and stop codon
        
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
        try {
            console.log('Executing NCBI BLAST with parameters:', params);
            
            // Step 1: Submit BLAST job to NCBI
            const jobId = await this.submitNCBIBlastJob(params);
            console.log('BLAST job submitted with ID:', jobId);
            
            // Step 2: Poll for job completion
            const results = await this.pollNCBIBlastResults(jobId, params);
            
            // Mark as real results
            results.isRealResults = true;
            results.rawOutput = results.rawXML || 'Raw XML output available';
            
            return results;
        } catch (error) {
            console.error('NCBI BLAST error:', error);
            
            // Show warning that we're using mock results
            this.showNotification('NCBI BLAST failed. Using simulated results for demonstration. Error: ' + error.message, 'warning');
            
            // Generate enhanced mock results with clear indication
            const mockResults = this.generateEnhancedMockResults(params);
            mockResults.isRealResults = false;
            mockResults.errorMessage = error.message;
            mockResults.rawOutput = 'Mock results - no raw output available';
            
            return mockResults;
        }
    }

    async submitNCBIBlastJob(params) {
        // NCBI BLAST API endpoint
        const baseUrl = 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi';
        
        // Prepare form data
        const formData = new URLSearchParams();
        formData.append('CMD', 'Put');
        formData.append('PROGRAM', params.blastType.toUpperCase());
        formData.append('DATABASE', params.database);
        formData.append('QUERY', params.sequence);
        formData.append('EXPECT', params.evalue);
        formData.append('HITLIST_SIZE', params.maxTargets);
        formData.append('FORMAT_TYPE', 'XML');
        
        // Add program-specific parameters
        if (params.blastType === 'blastn') {
            formData.append('WORD_SIZE', params.wordSize || '11');
        } else if (params.blastType === 'blastp') {
            formData.append('MATRIX_NAME', params.matrix || 'BLOSUM62');
            formData.append('GAPCOSTS', `${params.gapOpen || 11} ${params.gapExtend || 1}`);
        }
        
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString()
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const responseText = await response.text();
        
        // Extract RID (Request ID) from response
        const ridMatch = responseText.match(/RID = ([A-Z0-9]+)/);
        if (!ridMatch) {
            throw new Error('Failed to submit BLAST job - no RID returned. Response: ' + responseText.substring(0, 500));
        }
        
        return ridMatch[1];
    }

    async pollNCBIBlastResults(jobId, params, maxAttempts = 60) {
        const baseUrl = 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi';
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            // Check job status
            const statusUrl = `${baseUrl}?CMD=Get&FORMAT_OBJECT=SearchInfo&RID=${jobId}`;
            const statusResponse = await fetch(statusUrl);
            
            if (!statusResponse.ok) {
                throw new Error(`Status check failed: ${statusResponse.status}`);
            }
            
            const statusText = await statusResponse.text();
            
            if (statusText.includes('Status=WAITING')) {
                console.log(`BLAST job ${jobId} still running... (attempt ${attempts}/${maxAttempts})`);
                this.updateSearchProgress(`Waiting for NCBI BLAST results... (${attempts}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
                continue;
            }
            
            if (statusText.includes('Status=FAILED')) {
                throw new Error('BLAST job failed on NCBI server');
            }
            
            if (statusText.includes('Status=UNKNOWN')) {
                throw new Error('BLAST job status unknown - may have expired');
            }
            
            if (statusText.includes('Status=READY')) {
                // Job completed, retrieve results
                const resultsUrl = `${baseUrl}?CMD=Get&FORMAT_TYPE=XML&RID=${jobId}`;
                const resultsResponse = await fetch(resultsUrl);
                
                if (!resultsResponse.ok) {
                    throw new Error(`Results retrieval failed: ${resultsResponse.status}`);
                }
                
                const resultsXml = await resultsResponse.text();
                
                // Also get text format for raw output
                const textResultsUrl = `${baseUrl}?CMD=Get&FORMAT_TYPE=Text&RID=${jobId}`;
                const textResultsResponse = await fetch(textResultsUrl);
                const textResults = textResultsResponse.ok ? await textResultsResponse.text() : 'Text format not available';
                
                // Parse XML results
                const parsedResults = this.parseNCBIBlastXML(resultsXml, params);
                parsedResults.rawXML = resultsXml;
                parsedResults.rawText = textResults;
                parsedResults.jobId = jobId;
                
                return parsedResults;
            }
        }
        
        throw new Error(`BLAST job timed out after ${maxAttempts} attempts - results may still be processing`);
    }

    parseNCBIBlastXML(xmlString, params) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
            
            // Check for parsing errors
            const parserError = xmlDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('XML parsing error: ' + parserError.textContent);
            }
            
            // Extract basic information
            const iterations = xmlDoc.getElementsByTagName('Iteration');
            if (iterations.length === 0) {
                return this.createEmptyResults(params);
            }
            
            const iteration = iterations[0];
            const hits = [];
            
            // Parse hits
            const hitElements = iteration.getElementsByTagName('Hit');
            for (let i = 0; i < hitElements.length; i++) {
                const hit = this.parseNCBIHit(hitElements[i], params);
                if (hit) hits.push(hit);
            }
            
            // Extract statistics
            const statistics = this.parseNCBIStatistics(xmlDoc);
            
            return {
                searchId: `NCBI_${Date.now()}`,
                queryInfo: {
                    sequence: params.sequence.substring(0, 100) + (params.sequence.length > 100 ? '...' : ''),
                    length: params.sequence.length,
                    type: this.detectSequenceType(params.sequence)
                },
                parameters: params,
                hits: hits,
                statistics: statistics,
                source: 'NCBI',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error parsing NCBI BLAST XML:', error);
            throw new Error('Failed to parse BLAST results: ' + error.message);
        }
    }

    parseNCBIHit(hitElement, params) {
        try {
            const hitId = hitElement.getElementsByTagName('Hit_id')[0]?.textContent || 'Unknown';
            const hitAccession = hitElement.getElementsByTagName('Hit_accession')[0]?.textContent || hitId;
            const hitDef = hitElement.getElementsByTagName('Hit_def')[0]?.textContent || 'No description';
            const hitLen = parseInt(hitElement.getElementsByTagName('Hit_len')[0]?.textContent || '0');
            
            // Get best HSP (High-scoring Segment Pair)
            const hsps = hitElement.getElementsByTagName('Hsp');
            if (hsps.length === 0) return null;
            
            const bestHsp = hsps[0]; // Usually sorted by score
            
            const hspScore = parseFloat(bestHsp.getElementsByTagName('Hsp_score')[0]?.textContent || '0');
            const hspBitScore = parseFloat(bestHsp.getElementsByTagName('Hsp_bit-score')[0]?.textContent || '0');
            const hspEvalue = bestHsp.getElementsByTagName('Hsp_evalue')[0]?.textContent || 'N/A';
            const hspIdentity = parseInt(bestHsp.getElementsByTagName('Hsp_identity')[0]?.textContent || '0');
            const hspAlignLen = parseInt(bestHsp.getElementsByTagName('Hsp_align-len')[0]?.textContent || '0');
            const hspQueryFrom = parseInt(bestHsp.getElementsByTagName('Hsp_query-from')[0]?.textContent || '0');
            const hspQueryTo = parseInt(bestHsp.getElementsByTagName('Hsp_query-to')[0]?.textContent || '0');
            const hspHitFrom = parseInt(bestHsp.getElementsByTagName('Hsp_hit-from')[0]?.textContent || '0');
            const hspHitTo = parseInt(bestHsp.getElementsByTagName('Hsp_hit-to')[0]?.textContent || '0');
            const hspQuerySeq = bestHsp.getElementsByTagName('Hsp_qseq')[0]?.textContent || '';
            const hspHitSeq = bestHsp.getElementsByTagName('Hsp_hseq')[0]?.textContent || '';
            const hspMidline = bestHsp.getElementsByTagName('Hsp_midline')[0]?.textContent || '';
            
            const identityPercent = hspAlignLen > 0 ? ((hspIdentity / hspAlignLen) * 100).toFixed(1) : '0';
            const coverage = this.calculateCoverage(hspAlignLen, params.sequence.length);
            
            return {
                id: hitId,
                accession: hitAccession,
                description: hitDef,
                length: hitLen,
                evalue: hspEvalue,
                score: `${hspBitScore.toFixed(1)} bits (${hspScore})`,
                bitScore: hspBitScore,
                identity: `${identityPercent}%`,
                identityCount: hspIdentity,
                coverage: coverage,
                alignmentLength: hspAlignLen,
                mismatches: hspAlignLen - hspIdentity,
                gaps: hspAlignLen - hspIdentity, // Approximate gaps
                queryRange: { from: hspQueryFrom, to: hspQueryTo },
                hitRange: { from: hspHitFrom, to: hspHitTo },
                alignment: {
                    query: hspQuerySeq || '',
                    subject: hspHitSeq || '',
                    match: hspMidline || ''
                },
                hsps: this.parseAllHSPs(hitElement) // Parse all HSPs for detailed view
            };
        } catch (error) {
            console.error('Error parsing NCBI hit:', error);
            return null;
        }
    }

    parseAllHSPs(hitElement) {
        const hsps = [];
        const hspElements = hitElement.getElementsByTagName('Hsp');
        
        for (let i = 0; i < hspElements.length; i++) {
            const hsp = hspElements[i];
            hsps.push({
                score: parseFloat(hsp.getElementsByTagName('Hsp_score')[0]?.textContent || '0'),
                bitScore: parseFloat(hsp.getElementsByTagName('Hsp_bit-score')[0]?.textContent || '0'),
                evalue: hsp.getElementsByTagName('Hsp_evalue')[0]?.textContent || 'N/A',
                identity: parseInt(hsp.getElementsByTagName('Hsp_identity')[0]?.textContent || '0'),
                alignLen: parseInt(hsp.getElementsByTagName('Hsp_align-len')[0]?.textContent || '0'),
                queryFrom: parseInt(hsp.getElementsByTagName('Hsp_query-from')[0]?.textContent || '0'),
                queryTo: parseInt(hsp.getElementsByTagName('Hsp_query-to')[0]?.textContent || '0'),
                hitFrom: parseInt(hsp.getElementsByTagName('Hsp_hit-from')[0]?.textContent || '0'),
                hitTo: parseInt(hsp.getElementsByTagName('Hsp_hit-to')[0]?.textContent || '0'),
                querySeq: hsp.getElementsByTagName('Hsp_qseq')[0]?.textContent || '',
                hitSeq: hsp.getElementsByTagName('Hsp_hseq')[0]?.textContent || '',
                midline: hsp.getElementsByTagName('Hsp_midline')[0]?.textContent || ''
            });
        }
        
        return hsps;
    }

    parseNCBIStatistics(xmlDoc) {
        try {
            const stats = xmlDoc.getElementsByTagName('Statistics')[0];
            if (!stats) return this.getDefaultStatistics();
            
            return {
                database: xmlDoc.getElementsByTagName('BlastOutput_db')[0]?.textContent || 'Unknown',
                totalSequences: stats.getElementsByTagName('Statistics_db-num')[0]?.textContent || 'Unknown',
                totalLetters: stats.getElementsByTagName('Statistics_db-len')[0]?.textContent || 'Unknown',
                searchTime: 'NCBI Remote',
                effectiveSearchSpace: stats.getElementsByTagName('Statistics_eff-space')[0]?.textContent || 'Unknown',
                kappa: stats.getElementsByTagName('Statistics_kappa')[0]?.textContent || 'Unknown',
                lambda: stats.getElementsByTagName('Statistics_lambda')[0]?.textContent || 'Unknown',
                entropy: stats.getElementsByTagName('Statistics_entropy')[0]?.textContent || 'Unknown'
            };
        } catch (error) {
            console.error('Error parsing statistics:', error);
            return this.getDefaultStatistics();
        }
    }

    createEmptyResults(params) {
        return {
            searchId: `NCBI_${Date.now()}`,
            queryInfo: {
                sequence: params.sequence.substring(0, 100) + (params.sequence.length > 100 ? '...' : ''),
                length: params.sequence.length,
                type: this.detectSequenceType(params.sequence)
            },
            parameters: params,
            hits: [],
            statistics: this.getDefaultStatistics(),
            source: 'NCBI'
        };
    }

    getDefaultStatistics() {
        return {
            database: 'Unknown',
            totalSequences: 'Unknown',
            totalLetters: 'Unknown',
            searchTime: 'Unknown',
            effectiveSearchSpace: 'Unknown',
            kappa: 'Unknown',
            lambda: 'Unknown',
            entropy: 'Unknown'
        };
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
            // Validate database exists before attempting search
            const databasePath = this.resolveDatabasePath(params.database);
            const isValidDatabase = await this.validateDatabase(databasePath, params.blastType);
            
            if (!isValidDatabase) {
                throw new Error(`Database not found or invalid: ${params.database}. Please create the database first.`);
            }
            
            // Create temporary FASTA file for query sequence
            const queryFile = await this.createTempFastaFile(params.sequence);
            
            // Build BLAST command
            const blastCommand = this.buildBlastCommand(params, queryFile);
            console.log('Executing local BLAST command:', blastCommand);
            
            // Execute BLAST search
            const blastOutput = await this.runCommand(blastCommand);
            console.log('Local BLAST output received:', blastOutput.length, 'characters');
            
            // Parse BLAST results
            const results = this.parseBlastOutput(blastOutput, params);
            
            // Mark as real results and store raw output
            results.isRealResults = true;
            results.rawOutput = blastOutput;
            results.rawText = blastOutput;
            results.blastCommand = blastCommand;
            
            // Clean up temporary file
            await this.cleanupTempFile(queryFile);
            
            return results;
        } catch (error) {
            console.error('Local BLAST search error:', error);
            
            // Show detailed error information
            this.showNotification(`Local BLAST failed: ${error.message}. Using simulated results for demonstration.`, 'warning');
            
            // Generate enhanced mock results with clear indication
            const mockResults = this.generateEnhancedMockResults(params);
            mockResults.isRealResults = false;
            mockResults.errorMessage = error.message;
            mockResults.rawOutput = 'Mock results - no raw output available';
            
            return mockResults;
        }
    }

    async validateDatabase(databasePath, blastType) {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            // Check if database files exist
            const expectedExtensions = ['.nhr', '.nin', '.nsq']; // For nucleotide databases
            if (blastType === 'blastp' || blastType === 'blastx') {
                expectedExtensions.splice(0, 3, '.phr', '.pin', '.psq'); // For protein databases
            }
            
            let foundFiles = 0;
            for (const ext of expectedExtensions) {
                try {
                    const filePath = databasePath + ext;
                    await fs.access(filePath);
                    foundFiles++;
                } catch (error) {
                    // File doesn't exist
                }
            }
            
            // At least one of the expected files should exist
            if (foundFiles === 0) {
                console.warn(`No BLAST database files found for ${databasePath}`);
                return false;
            }
            
            // Try to get database info to verify it's valid
            try {
                const result = await this.runCommand(`blastdbcmd -db "${databasePath}" -info`);
                return result.includes('sequences') || result.includes('Database');
            } catch (error) {
                console.warn(`Database validation failed for ${databasePath}:`, error.message);
                return false;
            }
            
        } catch (error) {
            console.error('Database validation error:', error);
            return false;
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
        
        // Resolve database path
        const databasePath = this.resolveDatabasePath(params.database);
        
        let command = `${blastExecutable} -query "${queryFile}" -db "${databasePath}"`;
        
        // Add common parameters
        command += ` -evalue ${params.evalue}`;
        command += ` -max_target_seqs ${params.maxTargets}`;
        
        // Use detailed output format that includes sequence alignment information
        // Format 6 with additional sequence fields: qseq (query sequence) and sseq (subject sequence)
        command += ` -outfmt "6 qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore stitle qseq sseq qcovs qcovhsp"`;
        
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

    resolveDatabasePath(databaseValue) {
        // Check if this is a custom database
        if (databaseValue.startsWith('custom_')) {
            const dbId = databaseValue.replace('custom_', '');
            const customDb = this.customDatabases.get(dbId);
            
            if (customDb) {
                // Check if we have a stored database path
                if (customDb.dbPath) {
                    return customDb.dbPath;
                }
                
                // Fallback to default path construction - use static directory name
                const path = require('path');
                const os = require('os');
                const documentsPath = os.homedir() + '/Documents';
                const blastDbPath = path.join(documentsPath, 'Genome AI Studio Projects', 'blast_databases', dbId);
                return blastDbPath;
            } else {
                throw new Error(`Custom database not found: ${dbId}`);
            }
        }
        
        // For standard databases, return as-is
        return databaseValue;
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
            if (!line.trim() || line.startsWith('#')) continue; // Skip empty lines and comments
            
            const parts = line.split('\t');
            if (parts.length < 15) continue; // Skip lines with insufficient columns (now expecting 17 fields)
            
            const [
                qseqid, sseqid, pident, length, mismatch, gapopen,
                qstart, qend, sstart, send, evalue, bitscore, stitle = 'No description available',
                qseq = '', sseq = '', qcovs = '0', qcovhsp = '0'
            ] = parts;
            
            console.log('BLAST hit parsed:', { sseqid, pident, length, evalue, bitscore, stitle, hasSequences: !!(qseq && sseq) });
            
            // Parse numeric values safely
            const alignmentLength = parseInt(length) || 0;
            const queryStart = parseInt(qstart) || 0;
            const queryEnd = parseInt(qend) || 0;
            const subjectStart = parseInt(sstart) || 0;
            const subjectEnd = parseInt(send) || 0;
            const identityPercent = parseFloat(pident) || 0;
            const bitScore = parseFloat(bitscore) || 0;
            const queryCovsPercent = parseFloat(qcovs) || 0;
            const queryCovsHspPercent = parseFloat(qcovhsp) || 0;
            const mismatches = parseInt(mismatch) || 0;
            const gaps = parseInt(gapopen) || 0;
            
            // Generate match string from real sequences if available
            let matchString = '';
            if (qseq && sseq && qseq.length === sseq.length) {
                matchString = this.generateRealMatchString(qseq, sseq);
            } else {
                // Fallback to approximation
                matchString = this.generateMatchString(alignmentLength, mismatches, gaps);
            }
            
            // Use real sequences if available, otherwise fallback to extracted sequences
            const querySequence = qseq || this.getAlignmentSequence(params.sequence, queryStart, queryEnd);
            const subjectSequence = sseq || this.generateSubjectSequence(querySequence, identityPercent, mismatches, gaps);
            
            hits.push({
                id: sseqid,
                accession: sseqid,
                description: stitle || sseqid || 'No description available',
                length: alignmentLength,
                evalue: evalue,
                score: `${bitScore.toFixed(1)} bits`,
                bitScore: bitScore,
                identity: `${identityPercent.toFixed(1)}%`,
                identityPercent: identityPercent,
                identityCount: Math.round(alignmentLength * identityPercent / 100),
                coverage: `${queryCovsPercent.toFixed(1)}%`,
                queryRange: { from: queryStart, to: queryEnd },
                hitRange: { from: subjectStart, to: subjectEnd },
                alignmentLength: alignmentLength,
                mismatches: mismatches,
                gaps: gaps,
                alignment: {
                    query: querySequence,
                    subject: subjectSequence,
                    match: matchString
                },
                hsps: [{
                    score: bitScore,
                    bitScore: bitScore,
                    evalue: evalue,
                    identity: Math.round(alignmentLength * identityPercent / 100),
                    alignLen: alignmentLength,
                    queryFrom: queryStart,
                    queryTo: queryEnd,
                    hitFrom: subjectStart,
                    hitTo: subjectEnd,
                    querySeq: querySequence,
                    hitSeq: subjectSequence,
                    midline: matchString
                }]
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
                searchTime: 'Local search',
                effectiveSearchSpace: 'Local database'
            },
            source: 'Local',
            timestamp: new Date().toISOString()
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
        // For a simple approximation, generate a match string
        // In real BLAST, this would be much more complex
        const matches = length - mismatch - gapopen;
        const totalLength = length;
        let matchString = '';
        
        for (let i = 0; i < totalLength; i++) {
            if (i < matches) {
                matchString += '|'; // match
            } else if (i < matches + mismatch) {
                matchString += ' '; // mismatch
            } else {
                matchString += '-'; // gap
            }
        }
        
        return matchString;
    }

    generateRealMatchString(querySeq, subjectSeq) {
        // Generate accurate match string from real sequences
        let matchString = '';
        const minLength = Math.min(querySeq.length, subjectSeq.length);
        
        for (let i = 0; i < minLength; i++) {
            const qBase = querySeq[i].toUpperCase();
            const sBase = subjectSeq[i].toUpperCase();
            
            if (qBase === '-' || sBase === '-') {
                matchString += ' '; // gap
            } else if (qBase === sBase) {
                matchString += '|'; // exact match
            } else if (this.isSimilarAminoAcid(qBase, sBase)) {
                matchString += '+'; // similar amino acids (for protein sequences)
            } else {
                matchString += ' '; // mismatch
            }
        }
        
        return matchString;
    }

    isSimilarAminoAcid(aa1, aa2) {
        // Define similar amino acid groups for protein sequences
        const similarGroups = [
            ['A', 'G'], // small
            ['I', 'L', 'V'], // hydrophobic aliphatic
            ['F', 'W', 'Y'], // aromatic
            ['K', 'R'], // basic
            ['D', 'E'], // acidic
            ['Q', 'N'], // amide
            ['S', 'T'], // hydroxyl
            ['C', 'M'] // sulfur
        ];
        
        for (const group of similarGroups) {
            if (group.includes(aa1) && group.includes(aa2)) {
                return true;
            }
        }
        return false;
    }

    generateSubjectSequence(querySeq, identityPercent, mismatches, gaps) {
        // Generate a realistic subject sequence based on identity percentage
        let subjectSeq = '';
        const targetIdentity = identityPercent / 100;
        const seqLength = querySeq.length;
        let identityCount = 0;
        
        // Determine bases/amino acids for substitution
        const isProtein = /[ARNDCQEGHILKMFPSTWYV]/i.test(querySeq);
        const substitutionChars = isProtein ? 
            ['A', 'R', 'N', 'D', 'C', 'Q', 'E', 'G', 'H', 'I', 'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V'] :
            ['A', 'T', 'C', 'G'];
        
        for (let i = 0; i < seqLength; i++) {
            const shouldMatch = (identityCount / (i + 1)) < targetIdentity;
            
            if (shouldMatch && Math.random() > 0.1) {
                // Keep original base/amino acid for identity
                subjectSeq += querySeq[i];
                identityCount++;
            } else {
                // Introduce variation
                if (gaps > 0 && Math.random() < 0.02) {
                    subjectSeq += '-'; // gap
                } else {
                    // Substitution
                    let newChar;
                    do {
                        newChar = substitutionChars[Math.floor(Math.random() * substitutionChars.length)];
                    } while (newChar === querySeq[i].toUpperCase());
                    subjectSeq += newChar;
                }
            }
        }
        
        return subjectSeq;
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

        // Store results for filtering and sorting
        this.currentResults = results;
        this.filteredHits = [...results.hits];

        container.innerHTML = `
            <div class="blast-results-modern">
                ${this.renderResultsHeader(results)}
                ${this.renderResultsControls(results)}
                ${this.renderResultsSummary(results)}
                ${this.renderHitsList(results)}
                ${this.renderResultsFooter(results)}
            </div>
        `;

        // Setup event listeners
        this.setupResultsEventListeners();
        
        // Initialize results
        this.updateHitsDisplay();
    }

    renderResultsHeader(results) {
        const sourceIcon = results.source === 'NCBI' ? 'fas fa-cloud' : 
                          results.source === 'Local' ? 'fas fa-desktop' : 'fas fa-flask';
        
        const databaseInfo = this.getDatabaseInfo(results.parameters.database);
        const dbTypeIcon = databaseInfo.type === 'protein' ? 'fas fa-dna' : 'fas fa-code-branch';
        
        return `
            <div class="blast-results-header">
                <div class="header-title">
                    <h3><i class="fas fa-search"></i> BLAST Search Results</h3>
                    <div class="header-badges">
                        <span class="badge badge-source">
                            <i class="${sourceIcon}"></i> ${results.source || 'Unknown'}
                        </span>
                        <span class="badge badge-database">
                            <i class="${dbTypeIcon}"></i> ${results.parameters.database}
                        </span>
                        <span class="badge badge-type">
                            <i class="fas fa-cog"></i> ${results.parameters.blastType.toUpperCase()}
                        </span>
                        <span class="badge badge-result-type ${results.isRealResults !== false ? 'real-results' : 'mock-results'}">
                            <i class="${results.isRealResults !== false ? 'fas fa-check-circle' : 'fas fa-exclamation-triangle'}"></i> 
                            ${results.isRealResults !== false ? 'Real Results' : 'Simulated'}
                        </span>
                    </div>
                </div>
                
                ${results.isRealResults === false && results.errorMessage ? `
                <div class="error-info">
                    <div class="alert alert-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Note:</strong> These are simulated results. Original error: ${results.errorMessage}
                    </div>
                </div>
                ` : ''}
                
                <div class="query-summary">
                    <div class="query-info">
                        <h4><i class="fas fa-dna"></i> Query Information</h4>
                        <div class="query-details">
                            <div class="query-detail">
                                <span class="label">Length:</span>
                                <span class="value">${results.queryInfo.length.toLocaleString()} ${results.queryInfo.type === 'Protein' ? 'aa' : 'bp'}</span>
                            </div>
                            <div class="query-detail">
                                <span class="label">Type:</span>
                                <span class="value">${results.queryInfo.type}</span>
                            </div>
                            <div class="query-detail">
                                <span class="label">Search Time:</span>
                                <span class="value">${results.timestamp ? new Date(results.timestamp).toLocaleString() : new Date().toLocaleString()}</span>
                            </div>
                            ${results.jobId ? `<div class="query-detail">
                                <span class="label">Job ID:</span>
                                <span class="value">${results.jobId}</span>
                            </div>` : ''}
                        </div>
                    </div>
                    
                    <div class="query-sequence">
                        <div class="sequence-preview">
                            <pre>${results.queryInfo.sequence}</pre>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderResultsControls(results) {
        return `
            <div class="blast-results-controls">
                <div class="controls-section">
                    <div class="filter-controls">
                        <div class="control-group">
                            <label for="evalueFilter">Max E-value:</label>
                            <select id="evalueFilter" class="form-control">
                                <option value="">All</option>
                                <option value="1e-10">≤ 1e-10</option>
                                <option value="1e-5">≤ 1e-5</option>
                                <option value="0.01">≤ 0.01</option>
                                <option value="1">≤ 1</option>
                            </select>
                        </div>
                        
                        <div class="control-group">
                            <label for="identityFilter">Min Identity:</label>
                            <select id="identityFilter" class="form-control">
                                <option value="">All</option>
                                <option value="95">≥ 95%</option>
                                <option value="90">≥ 90%</option>
                                <option value="80">≥ 80%</option>
                                <option value="70">≥ 70%</option>
                                <option value="50">≥ 50%</option>
                            </select>
                        </div>
                        
                        <div class="control-group">
                            <label for="organismFilter">Organism:</label>
                            <select id="organismFilter" class="form-control">
                                <option value="">All organisms</option>
                                ${this.getUniqueOrganisms(results.hits).map(org => 
                                    `<option value="${org}">${org}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                    
                    <div class="sort-controls">
                        <div class="control-group">
                            <label for="sortBy">Sort by:</label>
                            <select id="sortBy" class="form-control">
                                <option value="bitScore">Bit Score</option>
                                <option value="evalue">E-value</option>
                                <option value="identity">Identity</option>
                                <option value="coverage">Coverage</option>
                                <option value="length">Length</option>
                            </select>
                        </div>
                        
                        <div class="control-group">
                            <button id="sortOrder" class="btn btn-secondary">
                                <i class="fas fa-sort-amount-down"></i> Desc
                            </button>
                        </div>
                    </div>
                    
                    <div class="view-controls">
                        <div class="control-group">
                            <label>Display:</label>
                            <div class="btn-group" role="group">
                                <button id="viewCompact" class="btn btn-outline-primary active">
                                    <i class="fas fa-list"></i> Compact
                                </button>
                                <button id="viewDetailed" class="btn btn-outline-primary">
                                    <i class="fas fa-th-list"></i> Detailed
                                </button>
                            </div>
                        </div>
                        
                        <div class="control-group">
                            <button id="exportResults" class="btn btn-success">
                                <i class="fas fa-download"></i> Export
                            </button>
                        </div>
                        
                        <div class="control-group">
                            <button id="viewRawOutput" class="btn btn-info">
                                <i class="fas fa-file-alt"></i> Raw Output
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderResultsSummary(results) {
        const stats = results.statistics;
        
        return `
            <div class="blast-results-summary">
                <div class="summary-stats">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-bullseye"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${results.hits.length}</div>
                            <div class="stat-label">Hits Found</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-database"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${stats.totalSequences}</div>
                            <div class="stat-label">DB Sequences</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-font"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${this.formatLargeNumber(stats.totalLetters)}</div>
                            <div class="stat-label">DB Letters</div>
                        </div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-clock"></i></div>
                        <div class="stat-content">
                            <div class="stat-value">${stats.searchTime}</div>
                            <div class="stat-label">Search Time</div>
                        </div>
                    </div>
                </div>
                
                <div class="hits-counter">
                    <span id="hitsCounter">Showing ${results.hits.length} of ${results.hits.length} hits</span>
                </div>
            </div>
        `;
    }

    renderHitsList(results) {
        return `
            <div class="blast-hits-container">
                <div id="hitsList" class="hits-list">
                    <!-- Hits will be populated by updateHitsDisplay() -->
                </div>
                
                <div id="noHitsMessage" class="no-hits-message" style="display: none;">
                    <div class="no-hits-content">
                        <i class="fas fa-search"></i>
                        <h4>No hits found</h4>
                        <p>Try adjusting your search parameters or filters</p>
                    </div>
                </div>
            </div>
        `;
    }

    renderResultsFooter(results) {
        return `
            <div class="blast-results-footer">
                <div class="footer-info">
                    <small>
                        Search ID: ${results.searchId} | 
                        Generated: ${new Date().toLocaleString()} |
                        Database: ${results.parameters.database} |
                        E-value threshold: ${results.parameters.evalue}
                    </small>
                </div>
            </div>
        `;
    }

    updateHitsDisplay() {
        const hitsList = document.getElementById('hitsList');
        const noHitsMessage = document.getElementById('noHitsMessage');
        const hitsCounter = document.getElementById('hitsCounter');
        
        if (!hitsList) return;
        
        if (this.filteredHits.length === 0) {
            hitsList.style.display = 'none';
            noHitsMessage.style.display = 'block';
            hitsCounter.textContent = 'No hits match the current filters';
            return;
        }
        
        hitsList.style.display = 'block';
        noHitsMessage.style.display = 'none';
        hitsCounter.textContent = `Showing ${this.filteredHits.length} of ${this.currentResults.hits.length} hits`;
        
        // Render hits based on current view mode
        const isDetailed = document.getElementById('viewDetailed')?.classList.contains('active');
        
        hitsList.innerHTML = this.filteredHits.map((hit, index) => 
            isDetailed ? this.renderDetailedHit(hit, index) : this.renderCompactHit(hit, index)
        ).join('');
        
        // Setup hit event listeners
        this.setupHitEventListeners();
    }

    renderCompactHit(hit, index) {
        const evalueClass = this.getEvalueClass(hit.evalue);
        const identityClass = this.getIdentityClass(parseFloat(hit.identity));
        
        return `
            <div class="blast-hit compact" data-hit-index="${index}">
                <div class="hit-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <div class="hit-main-info">
                        <div class="hit-title">
                            <span class="hit-accession">${hit.accession}</span>
                            <span class="hit-description">${this.truncateDescription(hit.description, 80)}</span>
                        </div>
                        <div class="hit-organism">
                            <i class="fas fa-microscope"></i> ${hit.organism || 'Unknown organism'}
                        </div>
                    </div>
                    
                    <div class="hit-scores">
                        <div class="score-item">
                            <span class="score-label">Score:</span>
                            <span class="score-value">${hit.score}</span>
                        </div>
                        <div class="score-item ${evalueClass}">
                            <span class="score-label">E-value:</span>
                            <span class="score-value">${hit.evalue}</span>
                        </div>
                        <div class="score-item ${identityClass}">
                            <span class="score-label">Identity:</span>
                            <span class="score-value">${hit.identity}</span>
                        </div>
                        <div class="score-item">
                            <span class="score-label">Coverage:</span>
                            <span class="score-value">${hit.coverage}</span>
                        </div>
                    </div>
                    
                    <div class="hit-expand">
                        <i class="fas fa-chevron-down"></i>
                    </div>
                </div>
                
                <div class="hit-details">
                    ${this.renderHitDetails(hit)}
                </div>
            </div>
        `;
    }

    renderDetailedHit(hit, index) {
        const evalueClass = this.getEvalueClass(hit.evalue);
        const identityClass = this.getIdentityClass(parseFloat(hit.identity));
        
        return `
            <div class="blast-hit detailed" data-hit-index="${index}">
                <div class="hit-card">
                    <div class="hit-card-header">
                        <div class="hit-title-section">
                            <h5 class="hit-title">
                                <span class="hit-accession">${hit.accession}</span>
                                <a href="https://www.ncbi.nlm.nih.gov/protein/${hit.accession}" target="_blank" class="external-link">
                                    <i class="fas fa-external-link-alt"></i>
                                </a>
                            </h5>
                            <p class="hit-description">${hit.description}</p>
                            <div class="hit-meta">
                                <span class="meta-item">
                                    <i class="fas fa-microscope"></i> ${hit.organism || 'Unknown organism'}
                                </span>
                                <span class="meta-item">
                                    <i class="fas fa-ruler"></i> ${hit.length.toLocaleString()} ${this.currentResults.queryInfo.type === 'Protein' ? 'aa' : 'bp'}
                                </span>
                                ${hit.taxonomyId ? `<span class="meta-item">
                                    <i class="fas fa-sitemap"></i> TaxID: ${hit.taxonomyId}
                                </span>` : ''}
                            </div>
                        </div>
                        
                        <div class="hit-scores-detailed">
                            <div class="score-grid">
                                <div class="score-card primary">
                                    <div class="score-value">${hit.score}</div>
                                    <div class="score-label">Bit Score</div>
                                </div>
                                <div class="score-card ${evalueClass}">
                                    <div class="score-value">${hit.evalue}</div>
                                    <div class="score-label">E-value</div>
                                </div>
                                <div class="score-card ${identityClass}">
                                    <div class="score-value">${hit.identity}</div>
                                    <div class="score-label">Identity</div>
                                </div>
                                <div class="score-card">
                                    <div class="score-value">${hit.coverage}</div>
                                    <div class="score-label">Coverage</div>
                                </div>
                            </div>
                            
                            <div class="hit-actions">
                                <button class="btn btn-sm btn-outline-primary toggle-details" data-hit-index="${index}">
                                    <i class="fas fa-chevron-down"></i> More Details
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="hit-details-section" style="display: none;">
                        ${this.renderHitDetails(hit)}
                    </div>
                </div>
            </div>
        `;
    }

    renderHitDetails(hit) {
        return `
            <div class="hit-details-content">
                <div class="alignment-info">
                    <h6><i class="fas fa-align-left"></i> Alignment Information</h6>
                    <div class="alignment-stats">
                        <div class="stat">
                            <span class="stat-label">Query Range:</span>
                            <span class="stat-value">${hit.queryRange.from}-${hit.queryRange.to}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Subject Range:</span>
                            <span class="stat-value">${hit.hitRange.from}-${hit.hitRange.to}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Alignment Length:</span>
                            <span class="stat-value">${hit.alignmentLength}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Identities:</span>
                            <span class="stat-value">${hit.identityCount}/${hit.alignmentLength} (${hit.identity})</span>
                        </div>
                        ${hit.gaps ? `<div class="stat">
                            <span class="stat-label">Gaps:</span>
                            <span class="stat-value">${hit.gaps}/${hit.alignmentLength} (${((hit.gaps/hit.alignmentLength)*100).toFixed(1)}%)</span>
                        </div>` : ''}
                    </div>
                </div>
                
                <div class="alignment-display">
                    <h6><i class="fas fa-code"></i> Sequence Alignment</h6>
                    <div class="alignment-viewer">
                        <div class="alignment-controls">
                            <button class="btn btn-sm btn-outline-secondary" onclick="this.closest('.alignment-viewer').classList.toggle('wrapped')">
                                <i class="fas fa-text-width"></i> Toggle Wrap
                            </button>
                        </div>
                        <pre class="alignment-text">${this.formatAlignment(hit.alignment, hit.queryRange, hit.hitRange)}</pre>
                    </div>
                </div>
                
                ${hit.hsps && hit.hsps.length > 1 ? this.renderMultipleHSPs(hit.hsps) : ''}
            </div>
        `;
    }

    formatAlignment(alignment, queryRange, hitRange) {
        if (!alignment || !alignment.query || !alignment.subject) {
            return 'No alignment data available';
        }
        
        const lineLength = 60;
        const query = alignment.query || '';
        const subject = alignment.subject || '';
        const match = alignment.match || '';
        
        // Ensure all sequences have the same length
        const maxLength = Math.max(query.length, subject.length, match.length);
        const paddedQuery = query.padEnd(maxLength, ' ');
        const paddedSubject = subject.padEnd(maxLength, ' ');
        const paddedMatch = match.padEnd(maxLength, ' ');
        
        let formatted = '';
        let queryPos = queryRange.from;
        let hitPos = hitRange.from;
        
        for (let i = 0; i < maxLength; i += lineLength) {
            const queryLine = paddedQuery.substring(i, i + lineLength);
            const matchLine = paddedMatch.substring(i, i + lineLength);
            const subjectLine = paddedSubject.substring(i, i + lineLength);
            
            // Calculate actual positions excluding gaps
            const queryBasesInLine = queryLine.replace(/-/g, '').length;
            const subjectBasesInLine = subjectLine.replace(/-/g, '').length;
            
            const queryEndPos = queryPos + queryBasesInLine - 1;
            const hitEndPos = hitPos + subjectBasesInLine - 1;
            
            // Format with proper spacing and alignment
            formatted += `Query  ${queryPos.toString().padStart(6)} ${queryLine} ${queryEndPos.toString().padStart(6)}\n`;
            formatted += `       ${' '.repeat(6)} ${matchLine}\n`;
            formatted += `Sbjct  ${hitPos.toString().padStart(6)} ${subjectLine} ${hitEndPos.toString().padStart(6)}\n\n`;
            
            // Update positions for next line
            queryPos = queryEndPos + 1;
            hitPos = hitEndPos + 1;
        }
        
        return formatted;
    }

    renderMultipleHSPs(hsps) {
        return `
            <div class="multiple-hsps">
                <h6><i class="fas fa-layer-group"></i> Multiple HSPs (${hsps.length})</h6>
                <div class="hsps-list">
                    ${hsps.map((hsp, index) => `
                        <div class="hsp-item">
                            <div class="hsp-header">
                                <span class="hsp-number">HSP ${index + 1}</span>
                                <span class="hsp-score">Score: ${hsp.bitScore.toFixed(1)} bits</span>
                                <span class="hsp-evalue">E-value: ${hsp.evalue}</span>
                            </div>
                            <div class="hsp-ranges">
                                Query: ${hsp.queryFrom}-${hsp.queryTo}, Subject: ${hsp.hitFrom}-${hsp.hitTo}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    showSearchProgress() {
        const container = document.getElementById('blastResultsContainer');
        if (!container) return;

        container.innerHTML = `
            <div class="blast-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <h4>Running BLAST Search...</h4>
                <p id="progressMessage">Please wait while we search the database</p>
                <div class="blast-progress">
                    <div class="blast-progress-bar" style="width: 30%"></div>
                </div>
            </div>
        `;

        this.showResultsModal();
    }

    updateSearchProgress(message) {
        const progressMessage = document.getElementById('progressMessage');
        if (progressMessage) {
            progressMessage.textContent = message;
        }
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

    showRawOutput() {
        if (!this.searchResults) {
            this.showNotification('No results available', 'warning');
            return;
        }

        const rawOutput = this.searchResults.rawOutput || this.searchResults.rawText || 'No raw output available';
        const isRealResults = this.searchResults.isRealResults !== false;
        
        // Create modal for raw output
        const modal = document.createElement('div');
        modal.className = 'modal fade show';
        modal.style.display = 'block';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-file-alt"></i> 
                            Raw BLAST Output 
                            <span class="badge ${isRealResults ? 'badge-success' : 'badge-warning'}">
                                ${isRealResults ? 'Real Results' : 'Simulated Results'}
                            </span>
                        </h5>
                        <button type="button" class="btn-close" onclick="this.closest('.modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="raw-output-controls mb-3">
                            <div class="btn-group" role="group">
                                ${this.searchResults.rawText ? `
                                <button class="btn btn-outline-primary active" onclick="this.parentElement.parentElement.nextElementSibling.querySelector('.raw-text').style.display='block'; this.parentElement.parentElement.nextElementSibling.querySelector('.raw-xml').style.display='none'; this.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('active')); this.classList.add('active');">
                                    <i class="fas fa-align-left"></i> Text Format
                                </button>
                                ` : ''}
                                ${this.searchResults.rawXML ? `
                                <button class="btn btn-outline-primary ${!this.searchResults.rawText ? 'active' : ''}" onclick="this.parentElement.parentElement.nextElementSibling.querySelector('.raw-xml').style.display='block'; this.parentElement.parentElement.nextElementSibling.querySelector('.raw-text').style.display='none'; this.parentElement.querySelectorAll('.btn').forEach(b => b.classList.remove('active')); this.classList.add('active');">
                                    <i class="fas fa-code"></i> XML Format
                                </button>
                                ` : ''}
                                <button class="btn btn-outline-success" onclick="navigator.clipboard.writeText(this.parentElement.parentElement.nextElementSibling.querySelector('[style*=block] pre, pre').textContent); alert('Copied to clipboard!');">
                                    <i class="fas fa-copy"></i> Copy
                                </button>
                                <button class="btn btn-outline-info" onclick="
                                    const content = this.parentElement.parentElement.nextElementSibling.querySelector('[style*=block] pre, pre').textContent;
                                    const blob = new Blob([content], { type: 'text/plain' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = 'blast_raw_output.txt';
                                    a.click();
                                    URL.revokeObjectURL(url);
                                ">
                                    <i class="fas fa-download"></i> Download
                                </button>
                            </div>
                        </div>
                        <div class="raw-output-content">
                            ${this.searchResults.rawText ? `
                            <div class="raw-text" style="display: ${this.searchResults.rawXML ? 'block' : 'block'};">
                                <pre class="raw-output-pre">${this.escapeHtml(this.searchResults.rawText)}</pre>
                            </div>
                            ` : ''}
                            ${this.searchResults.rawXML ? `
                            <div class="raw-xml" style="display: ${this.searchResults.rawText ? 'none' : 'block'};">
                                <pre class="raw-output-pre">${this.escapeHtml(this.searchResults.rawXML)}</pre>
                            </div>
                            ` : ''}
                            ${!this.searchResults.rawText && !this.searchResults.rawXML ? `
                            <div class="no-raw-output">
                                <div class="alert alert-info">
                                    <i class="fas fa-info-circle"></i>
                                    <strong>No raw output available.</strong><br>
                                    ${isRealResults ? 'Raw output was not captured for this search.' : 'This is a simulated result - no actual BLAST output was generated.'}
                                    ${this.searchResults.blastCommand ? `<br><br><strong>Command used:</strong><br><code>${this.searchResults.blastCommand}</code>` : ''}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Add escape key listener
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
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
        // Use unified translation implementation
        if (window.UnifiedDNATranslation) {
            let fastaContent = '';
            const cleanSeq = dnaSequence.toUpperCase().replace(/[^ATGC]/g, '');

            // Forward frames (1, 2, 3)
            for (let frame = 0; frame < 3; frame++) {
                const result = window.UnifiedDNATranslation.translateDNA({
                    sequence: cleanSeq,
                    frame: frame,
                    strand: 1,
                    geneticCode: 'standard',
                    includeStops: false,
                    validateInput: false
                });
                
                if (result.success && result.protein.length > 10) {
                    fastaContent += `>${chromosome}_frame_+${frame + 1}\n${result.protein}\n`;
                }
            }

            // Reverse frames (4, 5, 6)
            const revSeq = window.UnifiedDNATranslation.reverseComplement(cleanSeq);
            for (let frame = 0; frame < 3; frame++) {
                const result = window.UnifiedDNATranslation.translateDNA({
                    sequence: revSeq,
                    frame: frame,
                    strand: 1,
                    geneticCode: 'standard',
                    includeStops: false,
                    validateInput: false
                });
                
                if (result.success && result.protein.length > 10) {
                    fastaContent += `>${chromosome}_frame_-${frame + 1}\n${result.protein}\n`;
                }
            }

            return fastaContent;
        }
        
        // Fallback to original implementation
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

    generateEnhancedMockResults(params) {
        // Generate more realistic and detailed mock BLAST results
        const sequenceType = this.detectSequenceType(params.sequence);
        const database = params.database;
        
        // Create realistic hits based on database type and sequence type
        const hits = this.generateRealisticHits(params, sequenceType, database);
        
        // Generate realistic statistics
        const statistics = this.generateRealisticStatistics(database, params);
        
        return {
            searchId: `Enhanced_BLAST_${Date.now()}`,
            queryInfo: {
                sequence: params.sequence.substring(0, 100) + (params.sequence.length > 100 ? '...' : ''),
                length: params.sequence.length,
                type: sequenceType,
                definition: 'Query sequence'
            },
            parameters: params,
            hits: hits,
            statistics: statistics,
            source: 'Enhanced Mock',
            timestamp: new Date().toISOString()
        };
    }

    generateRealisticHits(params, sequenceType, database) {
        const hits = [];
        const numHits = Math.min(parseInt(params.maxTargets), Math.floor(Math.random() * 15) + 5);
        
        for (let i = 0; i < numHits; i++) {
            const hit = this.createRealisticHit(i, params, sequenceType, database);
            if (hit) hits.push(hit);
        }
        
        // Sort hits by bit score (descending)
        hits.sort((a, b) => parseFloat(b.bitScore) - parseFloat(a.bitScore));
        
        return hits;
    }

    createRealisticHit(index, params, sequenceType, database) {
        const databaseInfo = this.getDatabaseInfo(database);
        const organisms = this.getOrganismsForDatabase(database);
        const organism = organisms[Math.floor(Math.random() * organisms.length)];
        
        // Generate realistic accession and description
        const accession = this.generateAccession(database, index);
        const description = this.generateDescription(sequenceType, organism, database);
        
        // Generate realistic scores (decreasing with index)
        const maxBitScore = 500;
        const bitScore = Math.max(50, maxBitScore - (index * 30) + (Math.random() * 20 - 10));
        const rawScore = Math.floor(bitScore * 2.2);
        const evalue = this.generateEvalue(bitScore, params.sequence.length);
        
        // Generate realistic alignment parameters
        const queryLen = params.sequence.length;
        const subjectLen = Math.floor(queryLen * (0.8 + Math.random() * 0.4));
        const alignLen = Math.floor(queryLen * (0.6 + Math.random() * 0.3));
        const identity = Math.floor(alignLen * (0.7 + Math.random() * 0.25));
        const gaps = Math.floor(alignLen * (0.02 + Math.random() * 0.05));
        
        // Generate alignment ranges
        const queryStart = Math.floor(Math.random() * (queryLen - alignLen));
        const queryEnd = queryStart + alignLen;
        const subjectStart = Math.floor(Math.random() * (subjectLen - alignLen));
        const subjectEnd = subjectStart + alignLen;
        
        // Generate alignment sequences
        const alignment = this.generateAlignment(params.sequence, queryStart, queryEnd, identity, gaps);
        
        return {
            id: `hit_${index + 1}`,
            accession: accession,
            description: description,
            organism: organism,
            length: subjectLen,
            evalue: evalue,
            score: `${bitScore.toFixed(1)} bits (${rawScore})`,
            bitScore: bitScore,
            identity: `${((identity / alignLen) * 100).toFixed(1)}%`,
            identityCount: identity,
            coverage: this.calculateCoverage(alignLen, queryLen),
            alignmentLength: alignLen,
            gaps: gaps,
            queryRange: { from: queryStart + 1, to: queryEnd },
            hitRange: { from: subjectStart + 1, to: subjectEnd },
            alignment: alignment,
            database: database,
            taxonomyId: Math.floor(Math.random() * 100000) + 1000,
            hsps: [
                {
                    score: rawScore,
                    bitScore: bitScore,
                    evalue: evalue,
                    identity: identity,
                    alignLen: alignLen,
                    queryFrom: queryStart + 1,
                    queryTo: queryEnd,
                    hitFrom: subjectStart + 1,
                    hitTo: subjectEnd,
                    querySeq: alignment.query,
                    hitSeq: alignment.subject,
                    midline: alignment.match
                }
            ]
        };
    }

    getDatabaseInfo(database) {
        const dbInfo = {
            'nt': { type: 'nucleotide', name: 'Nucleotide collection' },
            'nr': { type: 'protein', name: 'Non-redundant protein sequences' },
            'refseq_rna': { type: 'nucleotide', name: 'RefSeq RNA sequences' },
            'refseq_genomic': { type: 'nucleotide', name: 'RefSeq Genome sequences' },
            'refseq_protein': { type: 'protein', name: 'RefSeq Protein Database' },
            'swissprot': { type: 'protein', name: 'UniProtKB/Swiss-Prot' },
            'pdb': { type: 'protein', name: 'Protein Data Bank proteins' },
            'est': { type: 'nucleotide', name: 'Expressed Sequence Tags' }
        };
        
        return dbInfo[database] || { type: 'unknown', name: database };
    }

    getOrganismsForDatabase(database) {
        const organisms = {
            'nt': ['Escherichia coli', 'Homo sapiens', 'Mus musculus', 'Saccharomyces cerevisiae', 'Arabidopsis thaliana'],
            'nr': ['Escherichia coli str. K-12', 'Homo sapiens', 'Mus musculus', 'Rattus norvegicus', 'Drosophila melanogaster'],
            'refseq_rna': ['Homo sapiens', 'Mus musculus', 'Rattus norvegicus', 'Danio rerio', 'Caenorhabditis elegans'],
            'refseq_genomic': ['Escherichia coli', 'Bacillus subtilis', 'Pseudomonas aeruginosa', 'Staphylococcus aureus'],
            'swissprot': ['Homo sapiens', 'Mus musculus', 'Escherichia coli', 'Saccharomyces cerevisiae'],
            'pdb': ['Homo sapiens', 'Escherichia coli', 'Thermus thermophilus', 'Bacillus stearothermophilus']
        };
        
        return organisms[database] || ['Unknown organism'];
    }

    generateAccession(database, index) {
        const patterns = {
            'nt': () => `${['NC', 'NT', 'NW'][Math.floor(Math.random() * 3)]}_${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}.${Math.floor(Math.random() * 9) + 1}`,
            'nr': () => `${['NP', 'YP', 'WP', 'XP'][Math.floor(Math.random() * 4)]}_${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}.${Math.floor(Math.random() * 9) + 1}`,
            'refseq_rna': () => `${['NM', 'NR', 'XM', 'XR'][Math.floor(Math.random() * 4)]}_${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}.${Math.floor(Math.random() * 9) + 1}`,
            'swissprot': () => `${['P', 'Q', 'O'][Math.floor(Math.random() * 3)]}${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
            'pdb': () => `${Math.floor(Math.random() * 9999).toString(36).toUpperCase().padStart(4, '0')}_${['A', 'B', 'C'][Math.floor(Math.random() * 3)]}`
        };
        
        const generator = patterns[database] || (() => `ACC_${String(index).padStart(6, '0')}`);
        return generator();
    }

    generateDescription(sequenceType, organism, database) {
        const proteinFunctions = [
            'DNA-directed RNA polymerase subunit alpha',
            'ATP synthase subunit beta',
            'Ribosomal protein L1',
            'Heat shock protein 70',
            'Elongation factor Tu',
            'DNA gyrase subunit A',
            'Catalase',
            'Superoxide dismutase',
            'Cytochrome c oxidase subunit I',
            'NADH dehydrogenase subunit 1'
        ];
        
        const nucleotideFunctions = [
            '16S ribosomal RNA gene',
            'cytochrome oxidase subunit I gene',
            'internal transcribed spacer',
            'NADH dehydrogenase subunit 1 gene',
            'ATP synthase F0 subunit 6 gene',
            'small subunit ribosomal RNA gene',
            'large subunit ribosomal RNA gene',
            'elongation factor 1-alpha gene',
            'RNA polymerase II largest subunit gene',
            'actin gene'
        ];
        
        let functions;
        if (sequenceType === 'Protein' || database === 'nr' || database === 'swissprot' || database === 'pdb') {
            functions = proteinFunctions;
        } else {
            functions = nucleotideFunctions;
        }
        
        const func = functions[Math.floor(Math.random() * functions.length)];
        return `${func} [${organism}]`;
    }

    generateEvalue(bitScore, queryLength) {
        // E-value calculation approximation
        const K = 0.041;
        const lambda = 0.267;
        const m = queryLength;
        const n = 1000000; // Approximate database size
        
        const evalue = K * m * n * Math.exp(-lambda * bitScore);
        
        if (evalue < 1e-100) return '0.0';
        if (evalue < 1e-10) return evalue.toExponential(1);
        if (evalue < 0.01) return evalue.toExponential(1);
        return evalue.toFixed(2);
    }

    generateAlignment(querySeq, start, end, identity, gaps) {
        const alignLen = end - start;
        const queryPart = querySeq.substring(start, end);
        
        // Generate subject sequence with specified identity
        let subjectSeq = '';
        let matchString = '';
        let identityCount = 0;
        let gapCount = 0;
        
        for (let i = 0; i < alignLen; i++) {
            if (gapCount < gaps && Math.random() < 0.02) {
                // Insert gap
                subjectSeq += '-';
                matchString += ' ';
                gapCount++;
            } else if (identityCount < identity && Math.random() < 0.8) {
                // Match
                subjectSeq += queryPart[i];
                matchString += queryPart[i] === 'N' || queryPart[i] === 'X' ? '+' : '|';
                identityCount++;
            } else {
                // Mismatch
                const bases = queryPart[i].match(/[ATCG]/) ? ['A', 'T', 'C', 'G'] : ['A', 'R', 'N', 'D', 'C', 'Q', 'E', 'G', 'H', 'I', 'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V'];
                let newBase;
                do {
                    newBase = bases[Math.floor(Math.random() * bases.length)];
                } while (newBase === queryPart[i]);
                
                subjectSeq += newBase;
                matchString += ' ';
            }
        }
        
        return {
            query: queryPart,
            subject: subjectSeq,
            match: matchString
        };
    }

    generateRealisticStatistics(database, params) {
        const dbSizes = {
            'nt': { sequences: '67,823,451', letters: '542,696,987,123' },
            'nr': { sequences: '434,544,773', letters: '159,064,915,452' },
            'refseq_rna': { sequences: '18,567,234', letters: '23,445,678,901' },
            'refseq_genomic': { sequences: '234,567', letters: '876,543,210,987' },
            'swissprot': { sequences: '568,002', letters: '204,840,472' },
            'pdb': { sequences: '789,456', letters: '234,567,890' }
        };
        
        const dbInfo = dbSizes[database] || { sequences: '1,000,000', letters: '1,000,000,000' };
        
        return {
            database: database,
            totalSequences: dbInfo.sequences,
            totalLetters: dbInfo.letters,
            searchTime: `${(Math.random() * 30 + 5).toFixed(1)} seconds`,
            effectiveSearchSpace: (BigInt(params.sequence.length) * BigInt(dbInfo.letters.replace(/,/g, ''))).toString(),
            kappa: '0.041',
            lambda: '0.267',
            entropy: '0.14'
        };
    }

    // Helper functions for the enhanced results display
    getUniqueOrganisms(hits) {
        const organisms = new Set();
        hits.forEach(hit => {
            if (hit.organism) organisms.add(hit.organism);
        });
        return Array.from(organisms).sort();
    }

    getEvalueClass(evalue) {
        const evalueNum = parseFloat(evalue);
        if (evalueNum === 0 || evalueNum < 1e-50) return 'excellent';
        if (evalueNum < 1e-10) return 'very-good';
        if (evalueNum < 1e-5) return 'good';
        if (evalueNum < 0.01) return 'fair';
        return 'poor';
    }

    getIdentityClass(identity) {
        if (identity >= 95) return 'excellent';
        if (identity >= 90) return 'very-good';
        if (identity >= 80) return 'good';
        if (identity >= 70) return 'fair';
        return 'poor';
    }

    truncateDescription(description, maxLength) {
        if (description.length <= maxLength) return description;
        return description.substring(0, maxLength - 3) + '...';
    }

    formatLargeNumber(numStr) {
        if (!numStr || numStr === 'Unknown') return numStr;
        const num = parseInt(numStr.replace(/,/g, ''));
        if (isNaN(num)) return numStr;
        
        if (num >= 1e12) return (num / 1e12).toFixed(1) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
        return num.toLocaleString();
    }

    setupResultsEventListeners() {
        // Filter controls
        const evalueFilter = document.getElementById('evalueFilter');
        const identityFilter = document.getElementById('identityFilter');
        const organismFilter = document.getElementById('organismFilter');
        
        if (evalueFilter) evalueFilter.addEventListener('change', () => this.applyFilters());
        if (identityFilter) identityFilter.addEventListener('change', () => this.applyFilters());
        if (organismFilter) organismFilter.addEventListener('change', () => this.applyFilters());
        
        // Sort controls
        const sortBy = document.getElementById('sortBy');
        const sortOrder = document.getElementById('sortOrder');
        
        if (sortBy) sortBy.addEventListener('change', () => this.applySorting());
        if (sortOrder) {
            sortOrder.addEventListener('click', () => {
                this.toggleSortOrder();
                this.applySorting();
            });
        }
        
        // View controls
        const viewCompact = document.getElementById('viewCompact');
        const viewDetailed = document.getElementById('viewDetailed');
        
        if (viewCompact) {
            viewCompact.addEventListener('click', () => {
                viewCompact.classList.add('active');
                viewDetailed.classList.remove('active');
                this.updateHitsDisplay();
            });
        }
        
        if (viewDetailed) {
            viewDetailed.addEventListener('click', () => {
                viewDetailed.classList.add('active');
                viewCompact.classList.remove('active');
                this.updateHitsDisplay();
            });
        }
        
        // Export button
        const exportButton = document.getElementById('exportResults');
        if (exportButton) {
            exportButton.addEventListener('click', () => this.exportResults());
        }

        // Raw output button
        const rawOutputBtn = document.getElementById('viewRawOutput');
        if (rawOutputBtn) {
            rawOutputBtn.addEventListener('click', () => this.showRawOutput());
        }
    }

    setupHitEventListeners() {
        // Add click handlers for expandable hits in compact view
        document.querySelectorAll('.blast-hit.compact .hit-header').forEach(header => {
            header.addEventListener('click', (e) => {
                e.preventDefault();
                const hit = header.closest('.blast-hit');
                hit.classList.toggle('expanded');
                
                const icon = header.querySelector('.hit-expand i');
                if (hit.classList.contains('expanded')) {
                    icon.classList.remove('fa-chevron-down');
                    icon.classList.add('fa-chevron-up');
                } else {
                    icon.classList.remove('fa-chevron-up');
                    icon.classList.add('fa-chevron-down');
                }
            });
        });

        // Add click handlers for "More Details" buttons in detailed view
        document.querySelectorAll('.toggle-details').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const hitIndex = button.dataset.hitIndex;
                const hit = document.querySelector(`[data-hit-index="${hitIndex}"]`);
                const detailsSection = hit.querySelector('.hit-details-section');
                
                if (detailsSection.style.display === 'none') {
                    detailsSection.style.display = 'block';
                    button.innerHTML = '<i class="fas fa-chevron-up"></i> Less Details';
                } else {
                    detailsSection.style.display = 'none';
                    button.innerHTML = '<i class="fas fa-chevron-down"></i> More Details';
                }
            });
        });
    }

    applyFilters() {
        const evalueFilter = document.getElementById('evalueFilter')?.value;
        const identityFilter = document.getElementById('identityFilter')?.value;
        const organismFilter = document.getElementById('organismFilter')?.value;
        
        this.filteredHits = this.currentResults.hits.filter(hit => {
            // E-value filter
            if (evalueFilter) {
                const hitEvalue = parseFloat(hit.evalue);
                const filterEvalue = parseFloat(evalueFilter);
                if (hitEvalue > filterEvalue) return false;
            }
            
            // Identity filter
            if (identityFilter) {
                const hitIdentity = parseFloat(hit.identity);
                const filterIdentity = parseFloat(identityFilter);
                if (hitIdentity < filterIdentity) return false;
            }
            
            // Organism filter
            if (organismFilter && hit.organism !== organismFilter) {
                return false;
            }
            
            return true;
        });
        
        this.applySorting();
    }

    applySorting() {
        const sortBy = document.getElementById('sortBy')?.value || 'bitScore';
        const sortOrder = document.getElementById('sortOrder');
        const isDescending = sortOrder?.textContent.includes('Desc');
        
        this.filteredHits.sort((a, b) => {
            let valueA, valueB;
            
            switch (sortBy) {
                case 'bitScore':
                    valueA = parseFloat(a.bitScore) || 0;
                    valueB = parseFloat(b.bitScore) || 0;
                    break;
                case 'evalue':
                    valueA = parseFloat(a.evalue) || Infinity;
                    valueB = parseFloat(b.evalue) || Infinity;
                    break;
                case 'identity':
                    valueA = parseFloat(a.identity) || 0;
                    valueB = parseFloat(b.identity) || 0;
                    break;
                case 'coverage':
                    valueA = parseFloat(a.coverage) || 0;
                    valueB = parseFloat(b.coverage) || 0;
                    break;
                case 'length':
                    valueA = a.length || 0;
                    valueB = b.length || 0;
                    break;
                default:
                    valueA = parseFloat(a.bitScore) || 0;
                    valueB = parseFloat(b.bitScore) || 0;
            }
            
            if (sortBy === 'evalue') {
                // For E-value, smaller is better
                return isDescending ? valueB - valueA : valueA - valueB;
            } else {
                // For others, larger is better
                return isDescending ? valueB - valueA : valueA - valueB;
            }
        });
        
        this.updateHitsDisplay();
    }

    toggleSortOrder() {
        const sortOrder = document.getElementById('sortOrder');
        if (!sortOrder) return;
        
        const isDescending = sortOrder.textContent.includes('Desc');
        
        if (isDescending) {
            sortOrder.innerHTML = '<i class="fas fa-sort-amount-up"></i> Asc';
        } else {
            sortOrder.innerHTML = '<i class="fas fa-sort-amount-down"></i> Desc';
        }
    }
}
