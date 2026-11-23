// @ts-check
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
    this.localBlastStatus = 'checking';
    this.databaseSelections = new Map();
    this.queryRevision = 0;

    // Rate limiting properties
    this.lastBlastSubmission = 0; // Track last submission time for rate limiting
    this.submissionCount = 0; // Track submission count for rate limiting
    this.rateLimitWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.maxSubmissionsPerDay = 100; // NCBI recommended limit
    this.minSubmissionInterval = 10000; // 10 seconds between submissions
    this.minNCBIPollInterval = 60000; // NCBI asks clients not to poll one RID more than once a minute

    // Get ConfigManager instance from app
    this.configManager = app.configManager || null;

    // Load saved BLAST configuration if available
    const savedBlastConfig = this.loadSavedBlastConfig();

    // BLAST configuration
    this.config = {
      ncbiBaseUrl: 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi',
      maxWaitTime: 300000, // 5 minutes max wait for a whole online search, retries included
      commandTimeout: 600000, // 10 minutes max for a single local BLAST subprocess
      pollInterval: 5000, // Check every 5 seconds
      ncbiPollInterval: 60000,
      ncbiTool: 'CodeXomics',
      ncbiEmail: savedBlastConfig?.ncbiEmail || null,
      supportedFormats: ['fasta', 'fa', 'fas', 'txt'],
      // Local BLAST configuration
      localBlastPath: this.getPlatformBlastPath(), // Platform-specific BLAST+ path
      localDbPath: this.getPlatformDbPath(), // Platform-specific database path
      localDatabases: new Map(), // Will store local database information
      supportedLocalFormats: ['fasta', 'fa', 'fas', 'txt', 'gb', 'gbk', 'genbank'],
      // Load saved configuration
      blastExecutablePath: savedBlastConfig?.blastExecutablePath || null,
      installedBlastVersion: savedBlastConfig?.blastVersion || null,
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

  canUseRendererFileSystem() {
    return false;
  }

  canUseLocalBlastRuntime() {
    return !!(typeof window !== 'undefined' && window.electronAPI?.blast?.runCommand);
  }

  /**
   * Load saved BLAST configuration from file
   */
  loadSavedBlastConfig() {
    try {
      const storedConfig = localStorage.getItem('blast-config');
      if (storedConfig) {
        const config = JSON.parse(storedConfig);
        console.log('BlastManager: Loaded BLAST configuration from localStorage:', config);
        return config;
      }
    } catch (error) {
      console.warn('BlastManager: Failed to load localStorage BLAST configuration:', error.message);
    }

    console.debug('BlastManager: File-backed BLAST config unavailable in hardened renderer');
    return null;
  }

  /**
   * Get platform-specific BLAST+ installation path
   */
  getPlatformBlastPath() {
    const platform = this.getPlatformName();

    switch (platform) {
      case 'win32':
        return 'C:\\Program Files\\NCBI\\blast+\\bin';
      case 'darwin':
        return '/usr/local/bin';
      case 'linux':
        return '/usr/local/bin';
      default:
        return '/usr/local/bin';
    }
  }

  /**
   * Get platform-specific database path
   * Prioritizes current file directory, falls back to user data directory
   */
  getPlatformDbPath() {
    const path = this.getPathModule();
    const platform = this.getPlatformName();
    const homeDir = this.getHomeDirectoryFallback();

    // Try to get current file directory first
    const currentFileDir = this.getCurrentFileDirectory();
    if (currentFileDir) {
      return path.join(currentFileDir, 'blast_db');
    }

    if (this.defaultLocalDbPath) return this.defaultLocalDbPath;
    // Sandboxed renderers deliberately have no home directory. Do not invent
    // an application-data path under /tmp; resolve it through main before use.
    if (!homeDir) return null;

    // Fallback to platform-specific user data directory
    switch (platform) {
      case 'win32': {
        const appData = path.join(homeDir, 'AppData', 'Local');
        return path.join(appData, 'GenomeAIStudio', 'blast', 'db');
      }
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'GenomeAIStudio', 'blast', 'db');
      case 'linux':
        return path.join(homeDir, '.local', 'share', 'GenomeAIStudio', 'blast', 'db');
      default:
        return path.join(homeDir, '.genome-ai-studio', 'blast', 'db');
    }
  }

  /**
   * Get the directory of the loaded genome, used to co-locate created databases.
   * Resolves from the genome source only - a track or annotation file loaded
   * afterwards must not relocate the database.
   */
  getCurrentFileDirectory() {
    const genomeFilePath = this.getCurrentGenomeFilePath();
    if (!genomeFilePath) {
      return null;
    }

    const path = this.getPathModule();
    return path.dirname(genomeFilePath);
  }

  parseBlastCommand(command) {
    const args = [];
    let current = '';
    let quote = null;
    let escaped = false;

    for (const char of String(command || '')) {
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (quote) {
        if (char === quote) {
          quote = null;
        } else {
          current += char;
        }
        continue;
      }

      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }

      if (/\s/.test(char)) {
        if (current) {
          args.push(current);
          current = '';
        }
        continue;
      }

      current += char;
    }

    if (escaped) current += '\\';
    if (current) args.push(current);
    return args;
  }

  /**
   * Create directory using cross-platform method
   */
  async createDirectoryAsync(dirPath) {
    if (typeof window !== 'undefined' && window.electronAPI?.ensureDirectory) {
      const result = await window.electronAPI.ensureDirectory(dirPath);
      if (!result?.success) {
        throw new Error(result?.error || `Failed to create directory ${dirPath}`);
      }
      console.log(`BlastManager: Created directory via main process: ${result.path || dirPath}`);
      return true;
    }

    throw new Error('Main-process directory API is unavailable');
  }

  async initializeLocalBlast() {
    try {
      if (!this.canUseLocalBlastRuntime()) {
        this.localBlastStatus = 'unavailable';
        return;
      }

      await this.initializeLocalDatabasePath();
      const installed = await this.checkBlastInstallation();
      if (installed) await this.loadLocalDatabases();
      this.localBlastStatus = installed ? 'ready' : 'missing';
    } catch (error) {
      this.localBlastStatus = 'unavailable';
      console.warn('Error initializing local BLAST:', error.message);
    } finally {
      this.updateDatabaseOptions();
    }
  }

  async initializeLocalDatabasePath() {
    if (typeof window !== 'undefined' && window.electronAPI?.getAppPaths) {
      const result = await window.electronAPI.getAppPaths();
      if (!result?.success || !result.paths?.userData) {
        throw new Error(result?.error || 'Application data directory is unavailable for local BLAST');
      }
      this.defaultLocalDbPath = this.getPathModule().join(result.paths.userData, 'blast', 'db');
    }
    this.config.localDbPath = this.getPlatformDbPath();
    if (!this.config.localDbPath) throw new Error('Local BLAST database directory is unavailable');
  }

  async checkBlastInstallation() {
    console.log('BlastManager: Checking BLAST+ installation...');
    if (typeof window !== 'undefined' && window.electronAPI?.blast?.detectInstallation) {
      const detection = await window.electronAPI.blast.detectInstallation();
      if (detection?.installed || detection?.found) {
        this.config.blastExecutablePath = detection.path;
        this.config.installedBlastVersion = detection.version;
        console.log(`BlastManager: Found BLAST+ via main process at ${detection.path}: v${detection.version}`);
        return true;
      }
      console.warn('BlastManager: BLAST+ not detected by main process:', detection?.error || detection?.message);
      return false;
    }

    try {
      // First try direct command execution
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
    console.debug('BlastManager: Skipping renderer fallback BLAST+ detection; main-process detection is required');
    return false;
  }

  async checkAndFixBlastDatabaseDirectory() {
    try {
      // Get current database path (may change based on current file location)
      const localDbPath = this.getCurrentDatabasePath();
      this.config.localDbPath = localDbPath; // Update config with current path

      await this.createDirectoryAsync(localDbPath);
      return true;
    } catch (error) {
      console.error('BlastManager: Error checking BLAST database directory:', error);
      throw error;
    }
  }

  /**
   * Get current database path, prioritizing current file directory
   */
  getCurrentDatabasePath() {
    const currentFileDir = this.getCurrentFileDirectory();
    if (currentFileDir) {
      const path = this.getPathModule();
      return path.join(currentFileDir, 'blast_db');
    }
    return this.config.localDbPath; // Fallback to configured path
  }

  async runCommand(command, workingDirectory = null, options = {}) {
    if (typeof window !== 'undefined' && window.electronAPI?.blast?.runCommand) {
      const tokens = this.parseBlastCommand(command);
      const executable = tokens[0];
      const args = tokens.slice(1);
      if (!executable) {
        throw new Error('BLAST command is required');
      }

      const localDbPath =
        options.localDbPath || workingDirectory || this.config.localDbPath || this.getCurrentDatabasePath();
      const result = await window.electronAPI.blast.runCommand({
        executable,
        args,
        workingDirectory,
        localDbPath,
        blastExecutablePath: this.config.blastExecutablePath,
        timeoutMs: options.timeoutMs ?? this.config.commandTimeout,
      });

      if (result?.success) {
        return result.stdout || '';
      }

      const stderr = result?.stderr || '';
      if (stderr.includes('Database memory map file error')) {
        throw new Error(
          `BLAST database error: The database directory may be corrupted or inaccessible. Please check permissions for: ${localDbPath}`
        );
      }
      if (stderr.includes('BLAST Database error')) {
        throw new Error(`BLAST database error: ${stderr.trim()}`);
      }
      if (stderr.includes('is empty')) {
        throw new Error(
          `makeblastdb failed: File appears empty or unreadable. Check file format and permissions. Error: ${stderr.trim()}`
        );
      }
      if (stderr.includes('No such file or directory')) {
        throw new Error(`makeblastdb failed: File not found in working directory. Error: ${stderr.trim()}`);
      }
      if (command.includes('makeblastdb')) {
        throw new Error(
          `makeblastdb failed: ${result?.error || 'Command failed'}${stderr ? ' STDERR: ' + stderr.trim() : ''}`
        );
      }
      throw new Error(result?.error || 'BLAST command failed');
    }

    throw new Error('Local BLAST command execution requires main-process IPC in the hardened renderer');
  }

  async loadLocalDatabases() {
    try {
      const path = this.getPathModule();
      // Get list of local databases - properly quote the path to handle spaces
      const dbPath = this.config.localDbPath;
      const result = await this.runCommand(`blastdbcmd -list "${dbPath}"`);
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
              const dbDirectory = path.dirname(dbPathFull);
              const stats = await this.getDatabaseStats(dbPathFull, dbDirectory);

              this.config.localDatabases.set(dbName, {
                name: dbName,
                type: dbType,
                path: dbDirectory, // Store the directory path
                description: `Local ${dbTypeRaw} database`,
                sequences: stats.sequences,
                letters: stats.letters,
                lastUpdated: stats.lastUpdated,
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

  async getDatabaseStats(dbName, dbDirectory = null) {
    try {
      // Get database statistics using blastdbcmd
      const escapedDbName = String(dbName).replace(/"/g, '\\"');
      const result = await this.runCommand(`blastdbcmd -db "${escapedDbName}" -info`, null, {
        localDbPath: dbDirectory || this.config.localDbPath,
      });

      // Parse the output to extract statistics
      const stats = {
        sequences: 'Unknown',
        letters: 'Unknown',
        lastUpdated: 'Unknown',
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
        lastUpdated: 'Unknown',
      };
    }
  }

  async createLocalDatabase(params) {
    try {
      // Validate input file
      if (
        !params.inputFile ||
        !this.config.supportedLocalFormats.includes(params.inputFile.split('.').pop().toLowerCase())
      ) {
        throw new Error('Invalid input file format');
      }

      // Get target directory (prefer current file directory or use params.outputDir)
      const requestedDir = params.outputDir || this.getCurrentDatabasePath();

      // Create database directory if it doesn't exist using cross-platform method.
      // If the requested directory is blocked by the CodeXomics file-access policy
      // (e.g. a genome loaded from outside the approved roots), fall back to the app
      // temp directory instead of failing outright. This keeps every database-creation
      // path resilient rather than relying on each caller to pre-resolve a writable dir.
      let targetDir = requestedDir;
      try {
        await this.createDirectoryAsync(requestedDir);
      } catch (dirError) {
        const fallbackDir = await this.getAppTempDirectory();
        if (fallbackDir === requestedDir) {
          throw dirError;
        }
        console.warn(
          `BlastManager: Database directory "${requestedDir}" is not writable through the security policy (${dirError.message}); using temp directory: ${fallbackDir}`
        );
        await this.createDirectoryAsync(fallbackDir);
        targetDir = fallbackDir;
      }

      // Update config to use the resolved target directory
      this.config.localDbPath = targetDir;

      // Build makeblastdb command against the resolved directory
      const command = this.buildMakeBlastDbCommand({ ...params, outputDir: targetDir });

      // Execute makeblastdb
      await this.runCommand(command, null, { localDbPath: targetDir });

      // Reload databases
      await this.loadLocalDatabases();

      return true;
    } catch (error) {
      throw new Error(`Failed to create local database: ${error.message}`);
    }
  }

  /**
   * True when no human is available to answer a modal prompt (benchmark runs,
   * headless automation). Callers must fail closed rather than block on a dialog.
   */
  static isUnattended() {
    return typeof window !== 'undefined' && window.__codexomicsUnattendedMode === true;
  }

  /**
   * Mark the app as running without a user present. Returns a restore function so a
   * caller can nest/unwind cleanly rather than assuming it owns the flag.
   */
  static setUnattended(enabled) {
    if (typeof window === 'undefined') return () => {};
    const previous = window.__codexomicsUnattendedMode;
    window.__codexomicsUnattendedMode = enabled === true;
    return () => {
      window.__codexomicsUnattendedMode = previous;
    };
  }

  /**
   * Request write permission for an explicitly chosen BLAST database directory.
   *
   * The CodeXomics file-access policy only auto-allows the default writable roots
   * (userData/temp/downloads/documents) plus paths the user has already selected
   * through a dialog. When a caller targets a directory outside that set, this
   * method asks the main process to approve it; if approval needs explicit consent
   * and `promptIfNeeded` is set, a native folder picker is shown so the user can
   * confirm (or pick) the destination, which grants it for the rest of the session.
   *
   * @param {string} directoryPath - The directory the caller wants to write into.
   * @param {{ promptIfNeeded?: boolean }} options
   * @returns {Promise<{ approved: boolean, path: string|null, cancelled?: boolean }>}
   */
  async approveDatabaseDirectory(directoryPath, options = {}) {
    const { promptIfNeeded = false } = options;
    const api = typeof window !== 'undefined' ? window.electronAPI : null;

    if (!directoryPath || typeof directoryPath !== 'string') {
      return { approved: false, path: null };
    }

    // Step 1: try to approve directly. Succeeds when the directory is inside a
    // default writable root or already covered by a prior user grant.
    if (api?.approveWorkingDirectory) {
      try {
        const result = await api.approveWorkingDirectory(directoryPath, { createIfMissing: true });
        if (result?.success) {
          return { approved: true, path: result.path || directoryPath };
        }
      } catch (error) {
        console.warn(`BlastManager: Direct directory approval failed for "${directoryPath}":`, error.message);
      }
    }

    // Step 2: the directory needs explicit user consent. Pop up a folder picker so
    // the user can confirm the destination (selecting it issues a recursive grant
    // via rememberApprovedDialogPaths in the main process).
    //
    // A native dialog has no timeout and blocks until someone clicks it, so it must
    // never be opened in an unattended run (benchmarks, headless automation) — there
    // it hangs the caller indefinitely. Fail closed instead.
    if (promptIfNeeded && BlastManager.isUnattended()) {
      console.warn(
        `BlastManager: Skipping directory permission prompt for "${directoryPath}" (unattended mode); denying instead of blocking.`
      );
      return { approved: false, path: null, unattended: true };
    }

    if (promptIfNeeded && api?.showDirectoryDialog) {
      try {
        const picked = await api.showDirectoryDialog({
          title: 'Approve a folder to store the BLAST database',
          defaultPath: directoryPath,
        });

        if (picked?.canceled || !picked?.filePaths?.length) {
          return { approved: false, path: null, cancelled: true };
        }

        const chosen = picked.filePaths[0];
        const confirmed = await api.approveWorkingDirectory(chosen, { createIfMissing: true });
        if (confirmed?.success) {
          return { approved: true, path: confirmed.path || chosen };
        }
        return { approved: false, path: chosen };
      } catch (error) {
        console.warn(`BlastManager: Directory permission prompt failed for "${directoryPath}":`, error.message);
        return { approved: false, path: null };
      }
    }

    return { approved: false, path: directoryPath };
  }

  buildMakeBlastDbCommand(params) {
    const { inputFile, dbName, dbType, title, parseSeqids, outputDir } = params;

    // Use custom output directory if provided, otherwise use current database path
    const targetDir = outputDir || this.getCurrentDatabasePath();
    const path = this.getPathModule();
    const outputPath = path.join(targetDir, dbName);

    // Build command - will be parsed into arguments for execFile
    let command = `makeblastdb -in "${inputFile}" -dbtype ${dbType} -out "${outputPath}"`;

    if (title) {
      // Sanitize title: replace hyphens and spaces with underscores to prevent argument parsing errors
      const sanitizedTitle = title.replace(/[-\s]+/g, '_');
      command += ` -title "${sanitizedTitle}"`;
    }

    if (parseSeqids) {
      command += ' -parse_seqids';
    }

    console.log('BlastManager: Built makeblastdb command:', command);
    console.log('BlastManager: Target directory:', targetDir);

    return command;
  }

  async deleteLocalDatabase(dbName) {
    try {
      // Check if database exists
      if (!this.config.localDatabases.has(dbName)) {
        throw new Error('Database not found');
      }

      const path = this.getPathModule();
      const dbInfo = this.config.localDatabases.get(dbName);
      const dbBasePath = dbInfo.dbPath || path.join(dbInfo.path, dbInfo.name || dbName);
      const dbType = dbInfo.type === 'blastp' || dbInfo.type === 'prot' ? 'prot' : 'nucl';
      const extensions =
        dbType === 'prot'
          ? ['.pdb', '.phr', '.pin', '.pog', '.pos', '.pot', '.psq', '.ptf', '.pto']
          : ['.ndb', '.nhr', '.nin', '.nog', '.nos', '.not', '.nsq', '.ntf', '.nto'];

      if (typeof window === 'undefined' || !window.electronAPI?.deletePhysicalFile) {
        throw new Error('Main-process file delete API is unavailable');
      }

      for (const ext of extensions) {
        const deleteResult = await window.electronAPI.deletePhysicalFile(dbBasePath + ext);
        if (deleteResult && deleteResult.success === false) {
          console.warn(`BlastManager: Could not delete database file ${dbBasePath + ext}: ${deleteResult.error}`);
        }
      }

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
        parseSeqids: true,
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to update local database: ${error.message}`);
    }
  }

  async getDatabaseInputFile(dbName) {
    try {
      // Try to find the original input file
      const result = await this.runCommand(
        `find ${this.config.localDbPath} -name "${dbName}.fasta" -o -name "${dbName}.fa" -o -name "${dbName}.fas"`
      );
      return result.trim();
    } catch (error) {
      console.error(`Error finding input file for database ${dbName}:`, error);
      return null;
    }
  }

  updateDatabaseOptions(blastType = null) {
    const select = typeof document !== 'undefined' && document.getElementById('blastDatabase');
    if (!select) return;

    const activeType = blastType || this.searchProgram;
    const activeService = this.searchService;

    const selectionKey = `${activeService}:${activeType}`;
    const proteinDatabase = activeType === 'blastp' || activeType === 'blastx';
    let databases = [];

    if (activeService === 'local') {
      for (const [name, info] of this.config.localDatabases) {
        if (info.type === (proteinDatabase ? 'blastp' : 'blastn')) {
          databases.push({ value: name, label: name, description: info.description });
        }
      }
      const discoveredNames = new Set(databases.map(database => database.value));
      for (const [id, database] of this.customDatabases) {
        if (
          database.status === 'ready' &&
          database.type === (proteinDatabase ? 'prot' : 'nucl') &&
          !discoveredNames.has(database.name) &&
          !discoveredNames.has(id)
        ) {
          databases.push({ value: id, label: database.name });
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
            { value: 'gss', label: 'GSS (Genome Survey Sequences)' },
          ];
          break;
        case 'blastp':
          databases = [
            { value: 'nr', label: 'Non-redundant protein sequences (nr)' },
            { value: 'swissprot', label: 'UniProtKB/Swiss-Prot' },
            { value: 'pdb', label: 'Protein Data Bank proteins' },
            { value: 'refseq_protein', label: 'RefSeq Protein Database' },
          ];
          break;
        case 'blastx':
          databases = [
            { value: 'nr', label: 'Non-redundant protein sequences (nr)' },
            { value: 'swissprot', label: 'UniProtKB/Swiss-Prot' },
            { value: 'pdb', label: 'Protein Data Bank proteins' },
          ];
          break;
        case 'tblastn':
          databases = [
            { value: 'nt', label: 'Nucleotide collection (nt)' },
            { value: 'refseq_genomic', label: 'RefSeq Genome sequences' },
            { value: 'est', label: 'EST (Expressed Sequence Tags)' },
          ];
          break;
      }
    }

    const remembered = this.databaseSelections?.get(selectionKey);
    const options = databases.map(({ value, label, description }) => {
      const option = new Option(label, value);
      if (description) option.title = description;
      return option;
    });
    if (!options.length) options.push(new Option('No compatible database', ''));
    select.replaceChildren(...options);
    select.disabled = databases.length === 0;
    if (databases.some(database => database.value === remembered)) select.value = remembered;

    const local = activeService === 'local';
    const hint = document.getElementById('blastDatabaseHint');
    hint.textContent = local
      ? {
          checking: 'Checking BLAST+ and local databases…',
          unavailable: 'Local BLAST is unavailable in this session.',
          missing: 'Install or configure BLAST+ to run local searches.',
          ready: databases.length
            ? `${databases.length} compatible ${databases.length === 1 ? 'database' : 'databases'}`
            : `Create a ${proteinDatabase ? 'protein' : 'nucleotide'} database to search locally.`,
        }[this.localBlastStatus] || ''
      : '';
    document.getElementById('manageBlastDatabasesBtn').hidden = !local;
    document.getElementById('configureBlastBtn').hidden = !local || this.localBlastStatus !== 'missing';
    this.updateSearchAvailability();
  }

  refreshDatabaseUi(options = {}) {
    const { service, blastType } = options;
    this.populateAvailableDatabasesList();
    this.updateExistingLocalDatabases();
    if (service) this.selectService(service);
    if (blastType) this.selectBlastType(blastType);
    else if (!service) this.updateDatabaseOptions();
  }

  initializeUI() {
    window.blastManager = this;
    this.setupAllEventListeners();
    this.updateSearchControls();
    this.validateSequence();
    this.updateDatabaseOptions();

    // The shared resize manager is initialized after renderer modules start.
    setTimeout(() => this.initializeResizable(), 100);
  }

  initializeResizable() {
    // Initialize resizable functionality for BLAST Search and Results modals
    try {
      if (window.resizableModalManager) {
        window.resizableModalManager.makeResizable('#blastSearchModal');
        window.resizableModalManager.makeResizable('#blastResultsModal');
        console.log('BlastManager: BLAST modals made resizable');
      } else {
        console.warn('BlastManager: ResizableModalManager not available');
      }
    } catch (error) {
      console.error('BlastManager: Error initializing resizable modals:', error);
    }
  }

  async initializeDatabaseManagement() {
    console.log('BlastManager: Initializing database management...');

    this.setupDatabaseManagementListeners();
    await this.loadCustomDatabases();

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
          console.log(
            `Loading databases from new localStorage format (version: ${savedData.version}, saved: ${savedData.timestamp})`
          );
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
    if (typeof window === 'undefined' || !window.electronAPI?.checkFileExists) {
      console.debug('BlastManager: Skipping local database file validation without renderer fs access');
      return;
    }

    let removedCount = 0;

    for (const [dbId, database] of this.customDatabases) {
      try {
        if (database.dbPath) {
          // Check if database files still exist
          const extensions = database.type === 'nucl' ? ['.nhr', '.nin', '.nsq'] : ['.phr', '.pin', '.psq'];
          let foundFiles = 0;

          for (const ext of extensions) {
            try {
              if (await this.fileExistsViaMain(database.dbPath + ext)) {
                foundFiles++;
              }
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
        databases: databases,
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
  }

  populateAvailableDatabasesList() {
    const container = document.getElementById('availableDatabasesList');
    if (!container) return;

    const managedNames = new Set([...this.customDatabases.values()].map(database => database.name));
    let html = [...this.config.localDatabases.values()]
      .filter(database => !managedNames.has(database.name))
      .map(
        database => `
        <div class="database-item">
          <div class="database-info">
            <div class="database-name">${this.escapeHtml(database.name)}</div>
            <div class="database-details">${database.type === 'blastn' ? 'Nucleotide' : 'Protein'} · Discovered locally</div>
          </div>
        </div>
      `
      )
      .join('');

    // Add custom databases
    this.customDatabases.forEach((database, id) => {
      let locationInfo = '';
      if (database.source === 'quick') {
        locationInfo = `Created from loaded genome: ${database.sourceGenome || 'Unknown'}`;
      } else if (database.location === 'source_directory') {
        locationInfo = `Located in source directory`;
      } else {
        locationInfo = `Custom file database`;
      }

      html += `
                <div class="database-item">
                    <div class="database-info">
                        <div class="database-name">${this.escapeHtml(database.name)}</div>
                        <div class="database-details">Local database • ${this.escapeHtml(locationInfo)} • ${database.type === 'nucl' ? 'Nucleotide' : 'Protein'}</div>
                        ${database.sourceDirectory ? `<div class="database-path">Path: ${this.escapeHtml(database.sourceDirectory)}</div>` : ''}
                        ${database.note ? `<div class="database-note">${this.escapeHtml(database.note)}</div>` : ''}
                    </div>
                    <div class="database-actions">
                        <div class="status-indicator status-${this.escapeHtml(database.status)}">
                            <i class="fas fa-${database.status === 'ready' ? 'check' : database.status === 'creating' ? 'spinner fa-spin' : 'exclamation-triangle'}"></i>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${this.escapeHtml(database.status.charAt(0).toUpperCase() + database.status.slice(1))}</span>
                        </div>
                        <button class="btn btn-sm btn-secondary view-db-details-btn" data-db-id="${this.escapeHtml(id)}" title="View database details" aria-label="View database details">
                            <i class="fas fa-info-circle"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-custom-db-btn" data-db-id="${this.escapeHtml(id)}" title="Delete database" aria-label="Delete database">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
    });

    container.innerHTML = html || '<p class="blast-help">No local databases found.</p>';

    // Add event listeners for view details buttons
    container.querySelectorAll('.view-db-details-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();

        const dbId = btn.dataset.dbId;
        const database = this.customDatabases.get(dbId);

        if (database) {
          this.showDatabaseDetails(dbId, database);
        }
      });
    });

    // Add event listeners for delete buttons
    container.querySelectorAll('.delete-custom-db-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.preventDefault();
        e.stopPropagation();

        const dbId = btn.dataset.dbId;
        const database = this.customDatabases.get(dbId);

        if (
          database &&
          confirm(
            `Are you sure you want to delete the database "${database.name}"?\n\nThis will permanently remove the database files.`
          )
        ) {
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
      const filename = filePath
        .split('/')
        .pop()
        .replace(/\.(fasta|fa|fas|txt)$/i, '');
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
        created: new Date().toISOString(),
      });

      // Update UI
      this.populateAvailableDatabasesList();

      this.appendLog(`Source file: ${filePath}`);
      this.appendLog(`Database name: ${dbName}`);

      // Create database in the same directory as the source file
      const path = this.getPathModule();
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
          // Create the actual BLAST database through main-process IPC.
          const path = this.getPathModule();
          const sourceDirectory = path.dirname(filePath);
          let databaseDirectory = sourceDirectory;
          let databaseOutputPath = outputPath;

          // Validate file content
          const fileInfo = await window.electronAPI?.getSelectedFileInfo?.(filePath);
          if (!fileInfo?.success) {
            throw new Error(fileInfo?.error || `Source file not found: ${filePath}`);
          }
          if (fileInfo.info?.size === 0) {
            throw new Error(`Source file is empty: ${filePath}`);
          }

          // Check if file has FASTA content
          const fileContentResult = await window.electronAPI?.readFile?.(filePath);
          const fileContent = fileContentResult?.data || '';
          if (!fileContentResult?.success || !fileContent.trim()) {
            throw new Error(`Source file contains no content: ${filePath}`);
          }

          // Enhanced FASTA format validation
          const lines = fileContent.split('\n');
          const firstLine = lines[0].trim();

          // Check if first line starts with '>' (proper FASTA header)
          if (!firstLine.startsWith('>')) {
            throw new Error(
              `File does not appear to be in FASTA format (first line should start with '>'): ${filePath}`
            );
          }

          // Validate FASTA structure - should have headers and sequences
          let headerCount = 0;
          let hasSequenceData = false;

          for (let i = 0; i < Math.min(lines.length, 100); i++) {
            // Check first 100 lines
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

          this.appendLog(
            `✓ File validation passed: ${((fileInfo.info?.size || 0) / 1024).toFixed(2)} KB, ${sequences} sequences, first header: ${firstLine.substring(0, 50)}${firstLine.length > 50 ? '...' : ''}`
          );

          try {
            await this.createDirectoryAsync(sourceDirectory);
          } catch (error) {
            databaseDirectory = await this.getAppTempDirectory();
            databaseOutputPath = path.join(databaseDirectory, dbFileName);
            this.appendLog(
              `⚠ Source directory is not writable through CodeXomics security policy; using temp directory: ${databaseDirectory}`,
              'warning'
            );
          }

          // Build command with absolute paths so it can run from the main process without renderer fs access.
          const escapedFilePath = filePath.replace(/"/g, '\\"');
          const escapedOutputPath = databaseOutputPath.replace(/"/g, '\\"');
          const escapedDbName = dbName.replace(/"/g, '\\"');
          const makeblastdbCmd = `makeblastdb -in "${escapedFilePath}" -dbtype ${dbType} -out "${escapedOutputPath}" -title "${escapedDbName}"`;

          this.appendLog(`Executing: ${makeblastdbCmd}`);

          // Execute command in the source directory
          await this.runCommand(makeblastdbCmd, null, { localDbPath: databaseDirectory });

          // Mark as ready and store additional metadata
          const dbEntry = this.customDatabases.get(dbId);
          dbEntry.status = 'ready';
          dbEntry.dbPath = databaseOutputPath;
          dbEntry.sourceDirectory = databaseDirectory;
          dbEntry.location = databaseDirectory === sourceDirectory ? 'source_directory' : 'temp_directory';
          dbEntry.lastUsed = new Date().toISOString();

          // Also add to config.localDatabases so it appears in BLAST search dropdown
          this.config.localDatabases.set(dbId, {
            name: dbId,
            type: dbType === 'nucl' ? 'blastn' : 'blastp', // Convert to BLAST type format
            path: databaseDirectory,
            description: `Custom ${dbType === 'nucl' ? 'Nucleotide' : 'Protein'} Database: ${dbName}`,
            sequences: 'Unknown', // Will be updated if stats are available
            letters: 'Unknown',
            lastUpdated: new Date().toISOString(),
          });

          this.appendLog(`✓ Custom database created successfully: ${dbName}`, 'success');

          // Check which files were created
          const extensions = dbType === 'nucl' ? ['.nhr', '.nin', '.nsq'] : ['.phr', '.pin', '.psq'];
          const createdFiles = [];
          for (const ext of extensions) {
            try {
              if (await this.fileExistsViaMain(databaseOutputPath + ext)) {
                createdFiles.push(dbId + ext);
              }
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
  async createQuickDatabase(dbType, preferredDbName = null) {
    let dbId; // Define at function scope for error handler

    try {
      // Check if there's a currently loaded genome in currentSequence
      if (!this.app?.currentSequence || Object.keys(this.app.currentSequence).length === 0) {
        this.showNotification('No genome data loaded. Please load a genome first.', 'error');
        return;
      }

      const sequences = this.app.currentSequence;
      const chromosomeNames = Object.keys(sequences);

      if (chromosomeNames.length === 0) {
        this.showNotification('No genome data available. Please load a genome first.', 'error');
        return;
      }

      // Use first chromosome name as genome name, or use a default name
      const genomeName = this.app.currentChromosome || chromosomeNames[0] || 'genome';

      // Show status
      const statusDiv = document.getElementById('quickDbStatus');
      const statusContent = document.getElementById('quickDbStatusContent');
      if (statusDiv && statusContent) {
        statusDiv.style.display = 'block';
        statusContent.innerHTML = `<div class="alert alert-info">Creating ${dbType === 'nucl' ? 'nucleotide' : 'protein'} database for ${genomeName}...</div>`;
      }

      // Use the generated FASTA basename as the database name so user-facing
      // database entries match the files created on disk. When the caller
      // explicitly names the database (genomeName in the quick tool), honor
      // that exact name instead so a later blast_search_local can target it.
      const dbName = preferredDbName || this.getQuickDatabaseBaseName(genomeName, dbType);
      dbId = dbName;

      // Generate FASTA content based on database type
      let fastaContent = '';

      if (dbType === 'nucl') {
        // Nucleotide database: use genomic sequences directly
        Object.keys(sequences).forEach(chromName => {
          const sequence = sequences[chromName];
          if (sequence) {
            fastaContent += `>${chromName}\n`;
            // Split sequence into lines of 80 characters (FASTA standard)
            for (let i = 0; i < sequence.length; i += 80) {
              fastaContent += sequence.substring(i, i + 80) + '\n';
            }
          }
        });
      } else if (dbType === 'prot') {
        // Protein database: use exportManager's tested protein export functionality
        if (!this.app?.currentAnnotations || Object.keys(this.app.currentAnnotations).length === 0) {
          throw new Error('No annotation data loaded. Protein database requires CDS features.');
        }

        if (!this.app?.exportManager) {
          throw new Error('Export manager not available');
        }

        console.log('Using tested exportProteinFasta functionality for protein database creation');

        // Use the same algorithm as exportProteinAsFasta in ExportManager
        const chromosomes = Object.keys(this.app.currentAnnotations);
        const processedFeatures = new Set(); // Track processed features to avoid duplicates

        chromosomes.forEach(chr => {
          const sequence = this.app.currentSequence[chr];
          const features = this.app.currentAnnotations[chr] || [];

          features.forEach(feature => {
            // Only process CDS features, skip gene features to avoid duplication
            if (feature.type === 'CDS') {
              // Create unique identifier to avoid duplicates
              const featureId = `${chr}_${feature.start}_${feature.end}_${feature.strand}`;

              if (!processedFeatures.has(featureId)) {
                processedFeatures.add(featureId);

                const cleanProteinSequence = this.app.exportManager.extractFeatureProtein(sequence, feature);

                const header = `${feature.name || feature.id || 'unknown'}_${chr}_${feature.start}-${feature.end}`;

                fastaContent += `>${header}\n`;

                // Split sequence into lines of 80 characters
                for (let i = 0; i < cleanProteinSequence.length; i += 80) {
                  fastaContent += cleanProteinSequence.substring(i, i + 80) + '\n';
                }
              }
            }
          });
        });

        if (!fastaContent) {
          throw new Error('No protein-coding features (CDS) found in annotations');
        }

        console.log(`Generated protein FASTA from ${processedFeatures.size} CDS features`);
      }

      if (!fastaContent) {
        throw new Error('No sequence data found in loaded genome');
      }

      console.log(`Generated FASTA content: ${fastaContent.length} characters`);

      // Add to custom databases with creating status
      this.customDatabases.set(dbId, {
        id: dbId,
        name: dbName,
        type: dbType,
        source: 'quick',
        status: 'creating',
        location: 'memory', // Created from loaded genome data
        created: new Date().toISOString(),
        sourceGenome: genomeName,
      });

      // Update UI to show creating status
      this.populateAvailableDatabasesList();

      // Check if we need to create a FASTA file from GBK source (only for nucleotide)
      let tempFile = null;
      if (dbType === 'nucl') {
        tempFile = await this.createFastaFileIfNeeded(genomeName, fastaContent, dbName);
      }

      // Create FASTA file used by makeblastdb. For GBK nucleotide sources this
      // reuses the generated source-adjacent FASTA file above.
      if (!tempFile) {
        tempFile = await this.writeSequenceToFile(fastaContent, dbName, dbType, {
          fileName: `${dbName}.fasta`,
        });
      }

      // Check if BLAST+ is installed
      const isBlastInstalled = await this.checkBlastInstallation();
      if (!isBlastInstalled) {
        // Mark as ready but note that BLAST+ is needed for actual searching
        this.customDatabases.get(dbId).status = 'ready';
        this.customDatabases.get(dbId).note = 'BLAST+ installation required for searching';
        this.customDatabases.get(dbId).tempFile = tempFile; // Store temp file path for later use

        console.log(`Database entry created without BLAST+: ${dbName}`);
      } else {
        // Create the actual BLAST database
        try {
          const path = this.getPathModule();
          const outputDir = path.dirname(tempFile);
          console.log(`BlastManager: Creating database in sequence file directory: ${outputDir}`);

          await this.createLocalDatabase({
            inputFile: tempFile,
            dbName: dbId,
            dbType: dbType,
            title: `${genomeName} - ${dbType === 'nucl' ? 'Nucleotide' : 'Protein'} Database`,
            outputDir: outputDir,
          });

          // Update database info with success status
          this.customDatabases.get(dbId).status = 'ready';
          this.customDatabases.get(dbId).dbPath = path.join(outputDir, dbId); // Store actual database path
          this.customDatabases.get(dbId).outputDir = outputDir; // Store output directory for reference

          // Also add to config.localDatabases so it appears in BLAST search dropdown
          this.config.localDatabases.set(dbId, {
            name: dbId,
            type: dbType === 'nucl' ? 'blastn' : 'blastp', // Convert to BLAST type format
            path: outputDir,
            description: `${genomeName} - ${dbType === 'nucl' ? 'Nucleotide' : 'Protein'} Database`,
            sequences: 'Unknown', // Will be updated if stats are available
            letters: 'Unknown',
            lastUpdated: new Date().toISOString(),
          });
        } catch (error) {
          // Mark as failed
          this.customDatabases.get(dbId).status = 'failed';
          this.customDatabases.get(dbId).error = error.message;
          throw error;
        }
      }

      // Save custom databases to storage
      await this.saveCustomDatabases();

      const createdDatabase = this.customDatabases.get(dbId);
      const createdBlastType = dbType === 'nucl' ? 'blastn' : 'blastp';

      // Update status
      if (statusContent) {
        statusContent.innerHTML = `<div class="alert alert-success">Successfully created ${dbType === 'nucl' ? 'nucleotide' : 'protein'} database: ${dbName}</div>`;
      }

      // Update UI
      this.refreshDatabaseUi({ service: 'local', blastType: createdBlastType });

      this.showNotification(
        `${dbType === 'nucl' ? 'Nucleotide' : 'Protein'} database created successfully: ${dbName}`,
        'success'
      );

      return {
        success: true,
        database: {
          id: dbId,
          name: dbName,
          type: dbType,
          blastType: createdBlastType,
          dbPath: createdDatabase?.dbPath || null,
          outputDir: createdDatabase?.outputDir || null,
          tempFile: tempFile || null,
        },
      };
    } catch (error) {
      console.error('Error creating quick database:', error);

      // Update database status to failed if it was created
      if (dbId && this.customDatabases.has(dbId)) {
        this.customDatabases.get(dbId).status = 'failed';
        this.customDatabases.get(dbId).error = error.message;
        await this.saveCustomDatabases();
        this.populateAvailableDatabasesList();
      }

      const statusContent = document.getElementById('quickDbStatusContent');
      if (statusContent) {
        statusContent.innerHTML = `<div class="alert alert-danger">Error: ${error.message}</div>`;
      }

      this.showNotification(`Failed to create database: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message,
        databaseId: dbId || null,
      };
    }
  }

  // Show detailed information about a database
  showDatabaseDetails(dbId, database) {
    // Create modal HTML for database details
    const modalHtml = `
            <div class="modal fade" id="databaseDetailsModal" tabindex="-1" role="dialog" aria-labelledby="databaseDetailsModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-lg" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="databaseDetailsModalLabel">
                                <i class="fas fa-database"></i> Database Details: ${this.escapeHtml(database.name)}
                            </h5>
                            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                                <span aria-hidden="true">&times;</span>
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="database-details-content">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-info-circle"></i> Basic Information</h6>
                                        <table class="table table-sm table-borderless">
                                            <tr>
                                                <td><strong>Database Name:</strong></td>
                                                <td>${this.escapeHtml(database.name)}</td>
                                            </tr>
                                            <tr>
                                                <td><strong>Database ID:</strong></td>
                                                <td><code>${this.escapeHtml(dbId)}</code></td>
                                            </tr>
                                            <tr>
                                                <td><strong>Type:</strong></td>
                                                <td>
                                                    <span class="badge badge-${database.type === 'nucl' ? 'primary' : 'info'}">
                                                        ${database.type === 'nucl' ? 'Nucleotide' : 'Protein'}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td><strong>Status:</strong></td>
                                                <td>
                                                    <span class="badge badge-${database.status === 'ready' ? 'success' : database.status === 'creating' ? 'warning' : 'danger'}">
                                                        <i class="fas fa-${database.status === 'ready' ? 'check' : database.status === 'creating' ? 'spinner fa-spin' : 'exclamation-triangle'}"></i>
                                                        ${database.status.charAt(0).toUpperCase() + database.status.slice(1)}
                                                    </span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td><strong>Source:</strong></td>
                                                <td>
                                                    ${
                                                      database.source === 'quick'
                                                        ? '<span class="badge badge-success">Quick Creation</span>'
                                                        : '<span class="badge badge-secondary">Custom File</span>'
                                                    }
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                                    <div class="col-md-6">
                                        <h6><i class="fas fa-calendar-alt"></i> Timestamps</h6>
                                        <table class="table table-sm table-borderless">
                                            <tr>
                                                <td><strong>Created:</strong></td>
                                                <td>${database.created ? new Date(database.created).toLocaleString() : 'Unknown'}</td>
                                            </tr>
                                        </table>
                                        
                                        ${
                                          database.sourceGenome
                                            ? `
                                            <h6><i class="fas fa-dna"></i> Source Information</h6>
                                            <table class="table table-sm table-borderless">
                                                <tr>
                                                    <td><strong>Source Genome:</strong></td>
                                                    <td>${this.escapeHtml(database.sourceGenome)}</td>
                                                </tr>
                                            </table>
                                        `
                                            : ''
                                        }
                                    </div>
                                </div>
                                
                                ${
                                  database.dbPath || database.outputDir
                                    ? `
                                    <div class="row mt-3">
                                        <div class="col-12">
                                            <h6><i class="fas fa-folder-open"></i> File Locations</h6>
                                            <table class="table table-sm table-borderless">
                                                ${
                                                  database.outputDir
                                                    ? `
                                                    <tr>
                                                        <td><strong>Database Directory:</strong></td>
                                                         <td><code>${this.escapeHtml(database.outputDir)}</code></td>
                                                    </tr>
                                                `
                                                    : ''
                                                }
                                                ${
                                                  database.dbPath
                                                    ? `
                                                    <tr>
                                                        <td><strong>Database Path:</strong></td>
                                                        <td><code>${this.escapeHtml(database.dbPath)}</code></td>
                                                    </tr>
                                                `
                                                    : ''
                                                }
                                            </table>
                                        </div>
                                    </div>
                                `
                                    : ''
                                }
                                
                                ${
                                  database.note || database.error
                                    ? `
                                    <div class="row mt-3">
                                        <div class="col-12">
                                            <h6><i class="fas fa-sticky-note"></i> Additional Information</h6>
                                            ${
                                              database.note
                                                ? `
                                                <div class="alert alert-info">
                                                    <i class="fas fa-info-circle"></i> ${this.escapeHtml(database.note)}
                                                </div>
                                            `
                                                : ''
                                            }
                                            ${
                                              database.error
                                                ? `
                                                <div class="alert alert-danger">
                                                    <i class="fas fa-exclamation-triangle"></i> <strong>Error:</strong> ${this.escapeHtml(database.error)}
                                                </div>
                                            `
                                                : ''
                                            }
                                        </div>
                                    </div>
                                `
                                    : ''
                                }
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-dismiss="modal">
                                <i class="fas fa-times"></i> Close
                            </button>
                            ${
                              database.outputDir && database.status === 'ready'
                                ? `
                                <button type="button" class="btn btn-primary" onclick="window.blastManager.openDatabaseDirectory('${dbId}')">
                                    <i class="fas fa-folder-open"></i> Open Directory
                                </button>
                            `
                                : ''
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;

    // Remove existing modal if present
    const existingModal = document.getElementById('databaseDetailsModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show modal using Bootstrap
    const modal = document.getElementById('databaseDetailsModal');
    if (modal) {
      // Try to use Bootstrap modal if available
      if (window.$ && window.$.fn.modal) {
        window.$(modal).modal('show');

        // Clean up modal when hidden
        window.$(modal).on('hidden.bs.modal', () => {
          modal.remove();
        });
      } else {
        // Fallback: show modal manually
        modal.style.display = 'block';
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');

        // Add click handlers for close buttons
        modal.querySelectorAll('[data-dismiss="modal"], .close').forEach(btn => {
          btn.addEventListener('click', () => {
            modal.style.display = 'none';
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            setTimeout(() => modal.remove(), 300);
          });
        });

        // Close on backdrop click
        modal.addEventListener('click', e => {
          if (e.target === modal) {
            modal.style.display = 'none';
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
            setTimeout(() => modal.remove(), 300);
          }
        });
      }
    }
  }

  // Open database directory in file explorer
  openDatabaseDirectory(dbId) {
    const database = this.customDatabases.get(dbId);
    if (database && database.outputDir) {
      // Use Electron API to open directory
      if (window.electronAPI && window.electronAPI.openPath) {
        window.electronAPI.openPath(database.outputDir);
      } else {
        console.warn('Electron API not available for opening directory');
        // Copy path to clipboard as fallback
        if (navigator.clipboard) {
          navigator.clipboard.writeText(database.outputDir).then(() => {
            this.showNotification('Database directory path copied to clipboard', 'info');
          });
        }
      }
    }
  }

  // Translate nucleotide sequences to protein (simplified implementation)
  translateSequencesToProtein(fastaContent) {
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
          const extensions = database.type === 'nucl' ? ['.nhr', '.nin', '.nsq'] : ['.phr', '.pin', '.psq'];

          for (const ext of extensions) {
            try {
              if (typeof window !== 'undefined' && window.electronAPI?.deletePhysicalFile) {
                await window.electronAPI.deletePhysicalFile(database.dbPath + ext);
              }
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

      // Also remove from config.localDatabases if it exists there
      // (This can happen if a custom database was later scanned by loadLocalDatabases)
      if (this.config.localDatabases.has(database.name)) {
        this.config.localDatabases.delete(database.name);
        console.log(`Removed database ${database.name} from config.localDatabases`);
      }
      if (this.config.localDatabases.has(dbId)) {
        this.config.localDatabases.delete(dbId);
        console.log(`Removed database ${dbId} from config.localDatabases`);
      }

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

  /**
   * Sequence-bearing file formats, matching the genome filter of the open dialog.
   * Track, annotation, variant and alignment files are excluded on purpose: they
   * carry no sequence, so they can never be the source of a BLAST database.
   */
  isGenomeSequenceFilePath(filePath) {
    return /\.(fasta|fa|fas|fna|gb|gbk|gbff|genbank)(\.gz)?$/i.test(String(filePath || '').trim());
  }

  /**
   * Path of the genome the databases are built from.
   *
   * `fileManager.currentFile` holds the most recently loaded file of ANY type -
   * loading a WIG track after a genome leaves it pointing at the track. Prefer
   * `loadedGenomePath`, which is only written when a FASTA/GenBank source is
   * parsed, and accept the fallbacks solely when they name a sequence file.
   */
  getCurrentGenomeFilePath() {
    if (this.app?.loadedGenomePath) return this.app.loadedGenomePath;

    const currentFile = this.app?.fileManager?.currentFile;
    const candidates = [currentFile?.path, currentFile?.info?.path, this.app?.currentFilePath];
    return candidates.find(candidate => candidate && this.isGenomeSequenceFilePath(candidate)) || null;
  }

  stripGenomeFileExtension(fileName) {
    return String(fileName || '')
      .replace(/\.gz$/i, '')
      .replace(/\.(fasta|fa|fas|fna|txt|gbk|gb|gbff|genbank)$/i, '');
  }

  getQuickDatabaseBaseName(genomeName, dbType) {
    const path = this.getPathModule();
    const currentFilePath = this.getCurrentGenomeFilePath();
    const sourceName = currentFilePath ? path.basename(currentFilePath) : genomeName || 'genome';
    const sourceBaseName = this.stripGenomeFileExtension(sourceName);
    const sanitizedBaseName = this.sanitizeFileNamePart(sourceBaseName) || 'genome';

    return dbType === 'prot' ? `${sanitizedBaseName}_protein` : sanitizedBaseName;
  }

  // Create FASTA file from GBK if needed
  async createFastaFileIfNeeded(genomeName, fastaContent, fastaBaseName = null) {
    try {
      // Check if the current loaded file is a GBK file
      const currentPath = this.getCurrentGenomeFilePath();
      if (!currentPath) {
        console.log('No current file path available, skipping FASTA file creation');
        return null;
      }

      const isGbkFile =
        currentPath.toLowerCase().endsWith('.gbk') ||
        currentPath.toLowerCase().endsWith('.gb') ||
        currentPath.toLowerCase().endsWith('.genbank');

      if (!isGbkFile) {
        console.log('Current file is not a GBK file, skipping FASTA file creation');
        return;
      }

      const path = this.getPathModule();
      const gbkDir = path.dirname(currentPath);
      const gbkBasename = fastaBaseName || this.stripGenomeFileExtension(path.basename(currentPath));
      const sanitizedBasename = this.sanitizeFileNamePart(gbkBasename) || 'genome';
      const fastaPath = path.join(gbkDir, `${sanitizedBasename}.fasta`);

      // Check if FASTA file already exists
      if (await this.fileExistsViaMain(fastaPath)) {
        console.log(`FASTA file already exists: ${fastaPath}`);
        this.appendLog(`✓ FASTA file already exists: ${path.basename(fastaPath)}`, 'info');
        return fastaPath;
      }

      let writtenPath = fastaPath;
      try {
        writtenPath = await this.writeTextFileViaMain(fastaPath, fastaContent);
      } catch (writeError) {
        const tempDir = await this.getAppTempDirectory();
        const fallbackPath = path.join(tempDir, `${sanitizedBasename}.fasta`);
        console.warn(
          `BlastManager: Could not write FASTA next to GBK (${writeError.message}); retrying in temp directory`
        );
        writtenPath = await this.writeTextFileViaMain(fallbackPath, fastaContent);
      }

      console.log(`Created FASTA file: ${writtenPath}`);
      this.appendLog(`✓ Created FASTA file: ${path.basename(writtenPath)}`, 'success');

      return writtenPath;
    } catch (error) {
      console.error('Error creating FASTA file:', error);
      this.appendLog(`⚠ Could not create FASTA file: ${error.message}`, 'warning');
      return null;
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
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
    const search = document.getElementById('blastSearchModal');
    const results = document.getElementById('blastResultsModal');
    if (!search || !results) return;

    document.getElementById('blastBtn')?.addEventListener('click', () => this.showBlastModal());
    for (const [modal, close] of [
      [search, () => this.hideBlastModal()],
      [results, () => this.hideResultsModal()],
    ]) {
      const collapse = modal.querySelector('.modal-collapse');
      modal.querySelector('.modal-close').addEventListener('click', close);
      collapse.addEventListener('click', () => {
        const collapsed = modal.classList.toggle('collapsed');
        collapse.setAttribute('aria-expanded', String(!collapsed));
        collapse.title = collapsed ? 'Expand window' : 'Collapse window';
        collapse.setAttribute('aria-label', collapse.title);
        collapse.querySelector('i').className = collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
      });
    }

    for (const button of search.querySelectorAll('[data-blast-type]')) {
      button.addEventListener('click', () => this.selectBlastType(button.dataset.blastType));
    }
    for (const button of search.querySelectorAll('[data-service]')) {
      button.addEventListener('click', () => this.selectService(button.dataset.service));
    }
    for (const button of search.querySelectorAll('.blast-workspace-tabs button')) {
      button.addEventListener('click', () => this.switchModalTab(button.dataset.tab));
    }

    const query = document.getElementById('blastQuerySequence');
    const fileInput = document.getElementById('blastFileInput');
    const upload = document.getElementById('blastUploadZone');
    query.addEventListener('input', () => this.setQueryOrigin());
    document.getElementById('clearBlastQueryBtn').addEventListener('click', () => this.setQuery(''));
    document.getElementById('pasteSequenceInputBtn').addEventListener('click', async () => {
      const request = ++this.queryRevision;
      try {
        const sequence = await navigator.clipboard.readText();
        if (request === this.queryRevision && sequence.trim()) this.setQuery(sequence, 'Pasted from clipboard');
      } catch (error) {
        this.showNotification('Clipboard could not be read. Paste directly into the query editor.', 'error');
      }
    });

    const loadRegion = document.getElementById('loadCurrentRegionBtn');
    loadRegion.addEventListener('click', () => this.loadCurrentRegion());
    loadRegion.addEventListener('pointerenter', () => this.updateCurrentRegionDisplay());
    loadRegion.addEventListener('focus', () => this.updateCurrentRegionDisplay());
    upload.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      this.handleFileUpload(fileInput.files[0]);
      fileInput.value = '';
    });
    for (const target of [upload, query]) {
      target.addEventListener('dragover', event => {
        if (!event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        target.classList.add('dragover');
      });
      target.addEventListener('dragleave', () => target.classList.remove('dragover'));
      target.addEventListener('drop', event => {
        target.classList.remove('dragover');
        if (!event.dataTransfer.files.length) return;
        event.preventDefault();
        this.handleFileUpload(event.dataTransfer.files[0]);
      });
    }

    const database = document.getElementById('blastDatabase');
    database.addEventListener('change', () => {
      this.databaseSelections.set(`${this.searchService}:${this.searchProgram}`, database.value);
      this.updateSearchAvailability();
    });
    for (const id of ['blastGapOpen', 'blastGapExtend']) {
      document.getElementById(id).addEventListener('input', () => this.updateSearchAvailability());
    }
    document.getElementById('manageBlastDatabasesBtn').addEventListener('click', () => {
      this.switchModalTab('db-management');
      search.querySelector('[data-tab="db-management"]').focus();
    });
    document.getElementById('configureBlastBtn').addEventListener('click', () => {
      window.ipcRenderer?.send?.('open-blast-config-window');
    });
    window.addEventListener('storage', event => {
      if (event.key === 'blast-config' && this.canUseLocalBlastRuntime()) this.initializeLocalBlast();
    });

    const run = document.getElementById('runBlastBtn');
    run.addEventListener('click', () => this.runBlastSearch());
    search.addEventListener('keydown', event => {
      if (
        event.key !== 'Enter' ||
        !(event.ctrlKey || event.metaKey) ||
        run.disabled ||
        document.getElementById('blast-search-tab').hidden ||
        search.classList.contains('collapsed')
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      this.runBlastSearch();
    });

    document.getElementById('showLastBlastResultsBtn').addEventListener('click', () => this.showResultsModal());
    document.getElementById('exportBlastBtn').addEventListener('click', () => this.exportResults());
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

  showBlastModal() {
    const modal = document.getElementById('blastSearchModal');
    if (modal) {
      modal.classList.add('show');
      window.modalDragManager?.raiseFloatingWindow(modal);
      this.updateCurrentRegionDisplay();
      this.updateSearchAvailability();
      modal.querySelector('.blast-workspace-tabs .active')?.focus();
    }
  }

  hideBlastModal() {
    const modal = document.getElementById('blastSearchModal');
    if (modal) {
      modal.classList.remove('show');
      document.getElementById('blastBtn')?.focus();
    }
  }

  showResultsModal() {
    const modal = document.getElementById('blastResultsModal');
    if (modal) {
      modal.classList.add('show');
      window.modalDragManager?.raiseFloatingWindow(modal);
      modal.querySelector('.modal-close')?.focus();
    }
  }

  hideResultsModal() {
    const modal = document.getElementById('blastResultsModal');
    if (modal) {
      modal.classList.remove('show');
      const search = document.getElementById('blastSearchModal');
      const target = search?.classList.contains('show')
        ? search.querySelector('.blast-workspace-tabs .active')
        : document.getElementById('blastBtn');
      target?.focus();
    }
  }

  get searchProgram() {
    return document.querySelector('#blastSearchModal [data-blast-type].active')?.dataset.blastType || 'blastn';
  }

  get searchService() {
    return document.querySelector('#blastSearchModal [data-service].active')?.dataset.service || 'local';
  }

  selectBlastType(blastType) {
    this.selectSearchOption('[data-blast-type]', 'blastType', blastType);
    this.updateSearchControls();
    this.validateSequence();
    this.updateDatabaseOptions();
  }

  selectService(service) {
    this.selectSearchOption('[data-service]', 'service', service);
    this.updateSearchControls();
    this.updateDatabaseOptions();
  }

  selectSearchOption(selector, key, value) {
    const buttons = document.querySelectorAll(`#blastSearchModal ${selector}`);
    if (![...buttons].some(button => button.dataset[key] === value)) return;
    for (const button of buttons) {
      const active = button.dataset[key] === value;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  updateSearchControls() {
    if (!document.getElementById('blastSearchModal')) return;
    const program = this.searchProgram;
    const local = this.searchService === 'local';
    document.getElementById('blastProgramHint').textContent = {
      blastn: 'Nucleotide query × nucleotide database',
      blastp: 'Protein query × protein database',
      blastx: 'Translated nucleotide query × protein database',
      tblastn: 'Protein query × translated nucleotide database',
    }[program];
    document.getElementById('blastServiceHint').textContent = local
      ? 'Search a BLAST+ database on this computer.'
      : 'Submits the query sequence to NCBI. Results may take a few minutes.';
    document.getElementById('blastWordSizeField').hidden = program !== 'blastn';
    const scoring = program === 'blastp' || (!local && program !== 'blastn');
    for (const id of ['blastMatrixField', 'blastGapOpenField', 'blastGapExtendField']) {
      document.getElementById(id).hidden = !scoring;
    }
    document.getElementById('blastLowComplexityLabel').textContent = local
      ? 'Use soft masking'
      : 'Filter low-complexity regions';
  }

  getCurrentQueryRegion() {
    const { currentChromosome: chromosome, currentPosition } = this.app;
    if (!chromosome || !currentPosition) return null;
    // The viewport uses zero-based, half-open bounds. The sequence provider uses one-based, inclusive coordinates.
    const start = Math.floor(currentPosition.start) + 1;
    const end = Math.floor(currentPosition.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) return null;
    return { chromosome, start, end };
  }

  updateCurrentRegionDisplay() {
    const button = document.getElementById('loadCurrentRegionBtn');
    if (!button) return;
    const region = this.getCurrentQueryRegion();
    button.title = region
      ? `Use ${region.chromosome}:${region.start.toLocaleString()}–${region.end.toLocaleString()}`
      : 'Load a genome to use the visible region';
  }

  async loadCurrentRegion() {
    const region = this.getCurrentQueryRegion();
    if (!region) {
      this.showNotification('Load a genome before using the visible region.', 'warning');
      return;
    }

    const request = ++this.queryRevision;
    const { chromosome, start, end } = region;
    try {
      const sequence = await this.getSequenceFromRegion(chromosome, start, end);
      if (request === this.queryRevision) {
        this.setQuery(sequence, `Visible region · ${chromosome}:${start.toLocaleString()}–${end.toLocaleString()}`);
      }
    } catch (error) {
      if (request === this.queryRevision) {
        this.showNotification(`Could not load the visible region: ${error.message}`, 'error');
      }
    }
  }

  setQuery(sequence, origin = '') {
    const query = document.getElementById('blastQuerySequence');
    query.value = sequence;
    this.setQueryOrigin(origin);
    query.focus();
  }

  setQueryOrigin(origin = '') {
    this.queryRevision++;
    const label = document.getElementById('blastQueryOrigin');
    label.textContent = origin;
    label.hidden = !origin;
    this.validateSequence();
  }

  async getSequenceFromRegion(chromosome, start, end) {
    if (!this.app?.chatManager?.getSequence) {
      throw new Error('Sequence provider unavailable; load a genome before retrieving a BLAST query');
    }
    const result = await this.app.chatManager.getSequence({ chromosome, start, end });
    if (result?.success === false || typeof result?.sequence !== 'string' || !result.sequence) {
      throw new Error(result?.error || 'No sequence available for the requested region');
    }
    return result.sequence;
  }

  validateSequence() {
    const textarea = document.getElementById('blastQuerySequence');
    if (!textarea) return;
    const { sequence, error } = this.parseSearchQuery(textarea.value);
    this.queryError = error;

    const proteinQuery = this.searchProgram === 'blastp' || this.searchProgram === 'tblastn';
    const detectedType = sequence ? this.detectSequenceType(sequence) : 'No sequence';
    const unit = error ? 'residues' : proteinQuery ? 'aa' : 'nt';
    document.getElementById('blastQueryLength').textContent = `${sequence.length.toLocaleString()} ${unit}`;
    document.getElementById('blastQueryType').textContent = detectedType;
    document.getElementById('clearBlastQueryBtn').hidden = !textarea.value;
    const feedback = document.getElementById('blastQueryFeedback');
    feedback.textContent = textarea.value.trim() ? error : '';
    feedback.hidden = !feedback.textContent;
    textarea.setAttribute('aria-invalid', String(!feedback.hidden));
    this.updateSearchAvailability();
  }

  parseSearchQuery(rawSequence, program = this.searchProgram) {
    const input = rawSequence.trim();
    const headers = input.match(/^[^\S\r\n]*>[^\r\n]*/gm) || [];
    if (headers.length > 1 || (headers.length && !input.startsWith('>'))) {
      return { sequence: '', error: 'Enter exactly one FASTA record or one raw sequence.' };
    }

    const residues = headers.length ? input.replace(/^>[^\r\n]*/, '') : input;
    const sequence = residues.replace(/\s/g, '').toUpperCase();
    if (/[^A-Z*]/.test(sequence)) {
      return { sequence, error: 'Remove characters other than sequence letters, whitespace and protein stop symbols.' };
    }
    if (sequence.length < 10) {
      return { sequence, error: 'Enter a query of at least 10 residues.' };
    }

    const proteinQuery = program === 'blastp' || program === 'tblastn';
    const nucleotide = /^[ACGTURYSWKMBDHVN]+$/.test(sequence);
    if (proteinQuery && nucleotide) {
      return { sequence, error: `${program.toUpperCase()} requires a protein query.` };
    }
    if (!proteinQuery && !nucleotide) {
      return { sequence, error: `${program.toUpperCase()} requires a nucleotide query.` };
    }
    return { sequence, error: '' };
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

    const dnaPattern = /^[ACGTURYSWKMBDHVN]+$/i;
    const proteinPattern = /^[A-Z*]+$/i;

    if (dnaPattern.test(sequence)) {
      if (/U/i.test(sequence)) return 'DNA/RNA';
      const atgcCount = (sequence.match(/[ATGC]/gi) || []).length;
      const totalCount = sequence.length;

      if (atgcCount / totalCount > 0.85) {
        return 'DNA';
      } else {
        return 'DNA/RNA (with ambiguous bases)';
      }
    }
    return proteinPattern.test(sequence) ? 'Protein' : 'Unknown';
  }

  async handleFileUpload(file) {
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!this.config.supportedFormats.includes(fileExtension)) {
      this.showNotification(`Unsupported file format: .${fileExtension}`, 'error');
      return;
    }

    const request = ++this.queryRevision;
    try {
      const text = await this.readFileAsText(file);
      if (request === this.queryRevision) this.setQuery(text, `Imported · ${file.name}`);
    } catch (error) {
      if (request === this.queryRevision) this.showNotification(`Could not read file: ${error.message}`, 'error');
    }
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async runBlastSearch() {
    if (this.isSearching) return;

    this.validateSequence();
    const issue = this.getSearchBlocker();
    if (issue) {
      this.updateSearchAvailability();
      return;
    }

    const searchParams = this.collectSearchParameters();
    const startedAt = performance.now();
    const previousResults = this.searchResults;
    this.isSearching = true;
    this.showSearchProgress(searchParams);
    const searchWindow = document.getElementById('blastSearchModal');

    try {
      const results = await this.executeBlastSearch(searchParams);
      if (!results.isError) {
        results.statistics = { ...results.statistics, elapsedSeconds: (performance.now() - startedAt) / 1000 };
      }
      this.displayResults(results);
      this.searchResults = results;

      if (
        searchWindow.classList.contains('show') &&
        !searchWindow.classList.contains('collapsed') &&
        !document.getElementById('blast-search-tab').hidden
      ) {
        this.showResultsModal();
      }
      if (!results.isError) this.refreshBlastTrack();
      this.searchOutcome = results.isError
        ? 'Search failed. Open results for details.'
        : `${results.hits.length.toLocaleString()} ${results.hits.length === 1 ? 'hit' : 'hits'} found.`;
    } catch (error) {
      console.error('BLAST search error:', error);
      this.searchOutcome = `Search failed: ${error.message}`;
      this.searchResults = previousResults;
      if (previousResults) {
        this.displayResults(previousResults);
      } else {
        const container = document.getElementById('blastResultsContainer');
        container.textContent = this.searchOutcome;
      }
    } finally {
      this.isSearching = false;
      this.updateSearchAvailability();
    }
  }

  collectSearchParameters() {
    const value = id => document.getElementById(id).value;
    const readAdvanced = id => (document.getElementById(`${id}Field`).hidden ? undefined : value(id));
    return {
      sequence: this.parseSearchQuery(value('blastQuerySequence')).sequence,
      blastType: this.searchProgram,
      service: this.searchService,
      database: value('blastDatabase'),
      evalue: value('blastEvalue'),
      maxTargets: value('blastMaxTargets'),
      wordSize: readAdvanced('blastWordSize'),
      matrix: readAdvanced('blastMatrix'),
      gapOpen: readAdvanced('blastGapOpen'),
      gapExtend: readAdvanced('blastGapExtend'),
      lowComplexity: document.getElementById('blastLowComplexity').checked,
    };
  }

  getSearchBlocker() {
    if (this.searchService === 'local' && this.localBlastStatus !== 'ready') {
      return document.getElementById('blastDatabaseHint').textContent;
    }
    if (!document.getElementById('blastDatabase').value) return 'Select a compatible database.';
    if (this.queryError) return this.queryError;

    const gapOpen = document.getElementById('blastGapOpen');
    const gapExtend = document.getElementById('blastGapExtend');
    if (
      !document.getElementById('blastGapOpenField').hidden &&
      (!gapOpen.validity.valid || !gapExtend.validity.valid || Boolean(gapOpen.value) !== Boolean(gapExtend.value))
    ) {
      return 'Enter both gap penalties as whole numbers in range, or leave both blank.';
    }
    return '';
  }

  updateSearchAvailability() {
    const button = document.getElementById('runBlastBtn');
    if (!button) return;
    const blocker = this.getSearchBlocker();
    button.disabled = this.isSearching || Boolean(blocker);
    button.innerHTML = this.isSearching
      ? '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Searching…'
      : '<i class="fas fa-play" aria-hidden="true"></i> Run BLAST';
    const status = document.getElementById('blastSearchStatus');
    status.textContent = this.isSearching ? this.searchProgress : blocker || this.searchOutcome || '';
    status.hidden = !status.textContent;
    document.getElementById('blastShortcut').hidden = !status.hidden;
    const viewResults = document.getElementById('showLastBlastResultsBtn');
    viewResults.hidden = !this.isSearching && !this.searchResults;
    viewResults.textContent = this.isSearching ? 'View progress' : 'View results';
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

  async executeNCBIBlast(params, retryCount = 0, deadline = null) {
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds base delay
    // maxWaitTime is a budget for the whole search, not for one attempt. Anchoring an
    // absolute deadline on the first call stops retries from multiplying the ceiling
    // (previously 4 x maxWaitTime, plus backoff and an uncounted RTOE delay).
    const effectiveDeadline = deadline ?? Date.now() + Number(this.config?.maxWaitTime || 300000);

    try {
      console.log('Executing NCBI BLAST with parameters:', params);

      // Step 1: Submit BLAST job to NCBI with retry logic
      const submittedJob = await this.submitNCBIBlastJobWithRetry(params, retryCount, effectiveDeadline);
      const jobId = typeof submittedJob === 'string' ? submittedJob : submittedJob.rid;
      console.log('BLAST job submitted with ID:', jobId);

      // Step 2: Poll for job completion
      const results = await this.pollNCBIBlastResults(submittedJob, params, null, effectiveDeadline);

      // Mark as real results
      results.isRealResults = true;
      results.rawOutput = results.rawXML || 'Raw XML output available';
      results.searchId = jobId;
      results.jobId = jobId;

      // Store results for track rendering
      this.searchResults = results;

      this.refreshBlastTrack();

      return results;
    } catch (error) {
      console.error('NCBI BLAST error:', error);

      // Retry logic for network errors, but never past the overall deadline.
      if (retryCount < maxRetries && this.isRetryableError(error)) {
        const delay = baseDelay * Math.pow(2, retryCount); // Exponential backoff
        if (Date.now() + delay < effectiveDeadline) {
          console.log(`Retrying BLAST submission in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);

          await new Promise(resolve => setTimeout(resolve, delay));
          return this.executeNCBIBlast(params, retryCount + 1, effectiveDeadline);
        }
        console.warn('NCBI BLAST retry budget exhausted: overall deadline reached');
      }

      // Show error directly instead of simulated results
      this.showNotification(`NCBI BLAST failed: ${error.message}`, 'error');

      // Return error result instead of mock results
      return {
        searchId: `NCBI_ERROR_${Date.now()}`,
        source: 'NCBI',
        isRealResults: false,
        isError: true,
        errorMessage: error.message,
        errorType: 'NCBI_BLAST_ERROR',
        timestamp: new Date().toISOString(),
        queryInfo: {
          length: params.sequence.length,
          type: this.detectSequenceType(params.sequence),
        },
        hits: [],
        statistics: {
          searchTime: '0 seconds',
          databaseSize: '0 sequences',
          effectiveSearchSpace: '0',
        },
        rawOutput: `Error: ${error.message}`,
        rawText: `Error: ${error.message}`,
      };
    }
  }

  isRetryableError(error) {
    // Check if error is retryable (network issues, temporary server errors)
    const retryablePatterns = [
      'network',
      'timeout',
      'connection',
      'fetch',
      'HTTP error! status: 5',
      'HTTP error! status: 429', // Too Many Requests
      'HTTP error! status: 503', // Service Unavailable
      'HTTP error! status: 502', // Bad Gateway
      'HTTP error! status: 504', // Gateway Timeout
    ];

    const errorMessage = error.message.toLowerCase();
    return retryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  async submitNCBIBlastJobWithRetry(params, retryCount = 0, deadline = null) {
    try {
      return await this.submitNCBIBlastJob(params, deadline);
    } catch (error) {
      // This retry loop is nested inside executeNCBIBlast's own retry loop, so without a
      // deadline check an outage multiplies out to ~9 submit attempts and overruns the
      // overall budget. Stop as soon as the next attempt could not finish in time.
      if (retryCount < 2 && this.isRetryableError(error)) {
        const delay = 1000 * (retryCount + 1); // 1s, 2s delays
        if (!deadline || Date.now() + delay < deadline) {
          console.log(`Retrying BLAST job submission in ${delay}ms (attempt ${retryCount + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.submitNCBIBlastJobWithRetry(params, retryCount + 1, deadline);
        }
        console.warn('NCBI BLAST submission retries stopped: overall deadline reached');
      }
      throw error;
    }
  }

  // Rate limiting methods
  checkRateLimit() {
    const now = Date.now();

    // Reset counter if 24 hours have passed
    if (now - this.lastBlastSubmission > this.rateLimitWindow) {
      this.submissionCount = 0;
    }

    // Check daily limit
    if (this.submissionCount >= this.maxSubmissionsPerDay) {
      throw new Error(
        `Daily submission limit reached (${this.maxSubmissionsPerDay} submissions per day). Please try again tomorrow.`
      );
    }

    // Check minimum interval between submissions
    const timeSinceLastSubmission = now - this.lastBlastSubmission;
    if (timeSinceLastSubmission < this.minSubmissionInterval) {
      const waitTime = this.minSubmissionInterval - timeSinceLastSubmission;
      throw new Error(`Please wait ${Math.ceil(waitTime / 1000)} seconds before submitting another BLAST job.`);
    }
  }

  updateSubmissionTracking() {
    this.lastBlastSubmission = Date.now();
    this.submissionCount++;
  }

  // Enhanced debugging and error reporting
  logBlastDebugInfo(params, responseText = null, error = null) {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      parameters: {
        blastType: params.blastType,
        database: params.database,
        sequenceLength: params.sequence?.length || 0,
        evalue: params.evalue,
        maxTargets: params.maxTargets,
      },
      rateLimit: {
        submissionCount: this.submissionCount,
        lastSubmission: this.lastBlastSubmission,
        timeSinceLastSubmission: Date.now() - this.lastBlastSubmission,
      },
    };

    if (responseText) {
      debugInfo.response = {
        length: responseText.length,
        preview: responseText.substring(0, 500),
        containsRID: /RID\s*=\s*[A-Z0-9]+/i.test(responseText),
        containsError: /error/i.test(responseText),
        isHTML: responseText.includes('<!DOCTYPE html') || responseText.includes('<html'),
      };
    }

    if (error) {
      debugInfo.error = {
        message: error.message,
        stack: error.stack,
        isRetryable: this.isRetryableError(error),
      };
    }

    console.log('BLAST Debug Info:', debugInfo);
    return debugInfo;
  }

  appendNCBIContactParams(params) {
    const toolName = this.config?.ncbiTool || 'CodeXomics';
    if (toolName) {
      params.append('TOOL', toolName);
    }

    const email = this.config?.ncbiEmail;
    if (email) {
      params.append('EMAIL', email);
    }
  }

  appendNCBIFilterParam(formData, params) {
    if (params.lowComplexity === undefined || params.lowComplexity === null) {
      return;
    }

    formData.append('FILTER', params.lowComplexity ? 'L' : 'F');
  }

  parseNCBIBlastSubmission(responseText) {
    const text = String(responseText || '');
    const ridPatterns = [
      /\bRID\s*=\s*([A-Z0-9-]+)/i,
      /name=["']RID["'][^>]*value=["']([^"']+)["']/i,
      /[?&]RID=([^&"'<>\\\s]+)/i,
    ];
    const rtoePatterns = [/\bRTOE\s*=\s*(\d+)/i, /name=["']RTOE["'][^>]*value=["'](\d+)["']/i, /[?&]RTOE=(\d+)/i];

    const ridMatch = ridPatterns.map(pattern => text.match(pattern)).find(Boolean);
    const rtoeMatch = rtoePatterns.map(pattern => text.match(pattern)).find(Boolean);
    const rid = ridMatch ? ridMatch[1].trim() : null;
    const rtoe = rtoeMatch ? Number.parseInt(rtoeMatch[1], 10) : null;

    return {
      rid,
      rtoe: Number.isFinite(rtoe) && rtoe >= 0 ? rtoe : null,
    };
  }

  parseNCBIStatusResponse(statusText) {
    const text = String(statusText || '');
    const statusMatch = text.match(/\bStatus\s*=\s*([A-Z]+)/i);
    const hitsMatch = text.match(/\bThereAreHits\s*=\s*(yes|no|true|false|0|1)/i);

    return {
      status: statusMatch ? statusMatch[1].toUpperCase() : null,
      hasHits: hitsMatch ? /^(yes|true|1)$/i.test(hitsMatch[1]) : null,
      error: this.extractNCBIErrorMessage(text),
    };
  }

  extractNCBIErrorMessage(responseText) {
    const text = String(responseText || '');
    const plainText = text
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\s+/g, ' ')
      .trim();

    const patterns = [
      /\b(?:error|message)\s*[:=]\s*([^.;]+[.;]?)/i,
      /\bMessage\s+ID#[^:]*:\s*([^.;]+[.;]?)/i,
      /\b(Invalid\s+(?:database|program|query)[^.;]*[.;]?)/i,
      /\b(Query\s+too\s+long[^.;]*[.;]?)/i,
      /\b(No\s+valid\s+letters\s+to\s+be\s+searched[^.;]*[.;]?)/i,
    ];

    const match = patterns.map(pattern => plainText.match(pattern)).find(Boolean);
    return match ? match[1].trim() : null;
  }

  buildNCBIGetUrl(params) {
    const baseUrl = this.config?.ncbiBaseUrl || 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi';
    const query = new URLSearchParams(params);
    this.appendNCBIContactParams(query);
    return `${baseUrl}?${query.toString()}`;
  }

  getNCBIPollInterval() {
    const configuredInterval = Number(this.config?.ncbiPollInterval || this.minNCBIPollInterval || 60000);
    return Math.max(configuredInterval, this.minNCBIPollInterval || 60000);
  }

  async waitForNCBIPollDelay(delayMs) {
    if (delayMs <= 0) return;
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  async submitNCBIBlastJob(params, deadline = null) {
    // Check rate limits before submission
    this.checkRateLimit();

    // NCBI BLAST API endpoint
    const baseUrl = 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi';

    // Validate required parameters
    if (!params.sequence || !params.blastType || !params.database) {
      throw new Error('Missing required parameters: sequence, blastType, or database');
    }

    // Clean and validate sequence
    const cleanSequence = this.cleanSequence(params.sequence);
    if (cleanSequence.length < 10) {
      throw new Error('Sequence too short (minimum 10 characters)');
    }

    const blastType = String(params.blastType).toLowerCase();
    const maxTargets = Number.parseInt(params.maxTargets || '100', 10);

    // Prepare form data with URL API supported parameters.
    const formData = new URLSearchParams();
    formData.append('CMD', 'Put');
    formData.append('PROGRAM', blastType);
    formData.append('DATABASE', params.database);
    formData.append('QUERY', cleanSequence);
    formData.append('EXPECT', params.evalue || '10');
    formData.append('HITLIST_SIZE', Number.isFinite(maxTargets) && maxTargets > 0 ? String(maxTargets) : '100');
    this.appendNCBIContactParams(formData);

    // Add program-specific parameters
    if (blastType === 'blastn') {
      if (params.wordSize) {
        formData.append('WORD_SIZE', params.wordSize);
      }
      this.appendNCBIFilterParam(formData, params);
    } else if (blastType === 'blastp' || blastType === 'blastx' || blastType === 'tblastn' || blastType === 'tblastx') {
      formData.append('MATRIX', params.matrix || 'BLOSUM62');
      if (blastType !== 'tblastx' && params.gapOpen !== '' && params.gapExtend !== '') {
        formData.append('GAPCOSTS', `${params.gapOpen ?? 11} ${params.gapExtend ?? 1}`);
      }
      this.appendNCBIFilterParam(formData, params);
    }

    console.log('Submitting BLAST job with parameters:', {
      program: blastType,
      database: params.database,
      sequenceLength: cleanSequence.length,
      evalue: params.evalue || '10',
      maxTargets: formData.get('HITLIST_SIZE'),
    });

    try {
      const response = await this.fetchWithDeadline(
        baseUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'text/plain, text/html, application/xml;q=0.9, */*;q=0.8',
          },
          body: formData.toString(),
        },
        deadline
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      console.log('BLAST submission response length:', responseText.length);

      // Log debug information
      this.logBlastDebugInfo(params, responseText);

      const submittedJob = this.parseNCBIBlastSubmission(responseText);
      if (!submittedJob.rid) {
        // Enhanced error reporting
        this.logBlastDebugInfo(params, responseText);

        // Check if response contains error messages
        const ncbiError = this.extractNCBIErrorMessage(responseText);
        if (ncbiError) {
          throw new Error(`NCBI BLAST error: ${ncbiError}`);
        }

        // Check if response is HTML (indicates a web page instead of API response)
        if (responseText.includes('<!DOCTYPE html') || responseText.includes('<html')) {
          throw new Error(
            'Received HTML response instead of API response. This may indicate server issues or incorrect request ' +
              'format. Please check NCBI BLAST service status.'
          );
        }

        // Check for specific NCBI error patterns
        if (responseText.includes('Query too long') || responseText.includes('query too long')) {
          throw new Error(
            'Query sequence is too long for NCBI BLAST. Please use a shorter sequence or try local BLAST.'
          );
        }

        if (responseText.includes('Invalid database') || responseText.includes('invalid database')) {
          throw new Error('Invalid database selected. Please check the database name and try again.');
        }

        if (responseText.includes('Invalid program') || responseText.includes('invalid program')) {
          throw new Error('Invalid BLAST program selected. Please check the program type and try again.');
        }

        throw new Error(
          'Failed to submit BLAST job - no RID returned. This may be due to server issues, invalid parameters, ' +
            `or rate limiting. Response preview: ${responseText.substring(0, 500)}`
        );
      }

      const rid = submittedJob.rid;
      console.log('BLAST job submitted successfully with RID:', rid);

      // Update submission tracking
      this.updateSubmissionTracking();

      return submittedJob;
    } catch (error) {
      console.error('BLAST submission error:', error);
      this.logBlastDebugInfo(params, null, error);
      throw error;
    }
  }

  /**
   * fetch() with no timeout never settles when a connection stalls, which defeats any
   * caller-side deadline. Abort each request at the smaller of a per-request cap and
   * the remaining overall budget.
   */
  async fetchWithDeadline(url, options = {}, deadline = null) {
    const perRequestCap = Number(this.config?.requestTimeout || 60000);
    const remaining = deadline ? deadline - Date.now() : perRequestCap;
    if (remaining <= 0) {
      throw new Error('NCBI BLAST request budget exhausted before the request was issued');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(perRequestCap, remaining));
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`NCBI BLAST request timed out: ${url}`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async pollNCBIBlastResults(job, params, maxAttempts = null, deadline = null) {
    const jobId = typeof job === 'string' ? job : job?.rid;
    if (!jobId) {
      throw new Error('Cannot poll NCBI BLAST results without a valid RID');
    }

    const pollInterval = this.getNCBIPollInterval();
    const maxWaitTime = Number(this.config?.maxWaitTime || 300000);
    const effectiveDeadline = deadline ?? Date.now() + maxWaitTime;
    const effectiveMaxAttempts =
      maxAttempts === null || maxAttempts === undefined
        ? Math.max(1, Math.ceil(maxWaitTime / pollInterval))
        : maxAttempts;
    const initialDelaySeconds = typeof job === 'object' && Number.isFinite(job.rtoe) ? job.rtoe : 0;
    const initialDelayMs = Math.max(0, initialDelaySeconds * 1000);
    let attempts = 0;

    if (initialDelayMs > 0) {
      // NCBI's RTOE hint used to be awaited outside the wait budget entirely; clamp it
      // so a large RTOE cannot blow past the deadline before polling even starts.
      const boundedInitialDelay = Math.max(0, Math.min(initialDelayMs, effectiveDeadline - Date.now()));
      if (boundedInitialDelay > 0) {
        this.updateSearchProgress(
          `NCBI BLAST job submitted. Waiting ${Math.round(boundedInitialDelay / 1000)} seconds before first status check...`
        );
        await this.waitForNCBIPollDelay(boundedInitialDelay);
      }
    }

    while (attempts < effectiveMaxAttempts) {
      if (Date.now() >= effectiveDeadline) {
        throw new Error(
          `NCBI BLAST timed out after ${maxWaitTime} ms waiting for RID ${jobId}. ` +
            'The job may still be running on the NCBI server.'
        );
      }
      attempts++;

      // Check job status
      const statusUrl = this.buildNCBIGetUrl({
        CMD: 'Get',
        FORMAT_OBJECT: 'SearchInfo',
        RID: jobId,
      });
      const statusResponse = await this.fetchWithDeadline(statusUrl, {}, effectiveDeadline);

      if (!statusResponse.ok) {
        throw new Error(`Status check failed for NCBI BLAST RID ${jobId}: ${statusResponse.status}`);
      }

      const statusText = await statusResponse.text();
      const searchInfo = this.parseNCBIStatusResponse(statusText);

      if (searchInfo.error && searchInfo.status !== 'READY') {
        throw new Error(`NCBI BLAST status error for RID ${jobId}: ${searchInfo.error}`);
      }

      if (searchInfo.status === 'WAITING') {
        console.log(`BLAST job ${jobId} still running... (attempt ${attempts}/${effectiveMaxAttempts})`);
        this.updateSearchProgress(`Waiting for NCBI BLAST results... (${attempts}/${effectiveMaxAttempts})`);
        if (attempts >= effectiveMaxAttempts) {
          break;
        }
        await this.waitForNCBIPollDelay(pollInterval);
        continue;
      }

      if (searchInfo.status === 'FAILED') {
        throw new Error(`BLAST job ${jobId} failed on NCBI server`);
      }

      if (searchInfo.status === 'UNKNOWN') {
        throw new Error(
          `BLAST job status UNKNOWN for RID ${jobId}. The RID may be invalid, expired, or rejected by NCBI.`
        );
      }

      if (searchInfo.status === 'READY') {
        // Job completed, retrieve results
        const maxTargets = Number.parseInt(params.maxTargets || '100', 10);
        const resultParams = {
          CMD: 'Get',
          FORMAT_TYPE: 'XML',
          RID: jobId,
        };
        if (Number.isFinite(maxTargets) && maxTargets > 0) {
          resultParams.DESCRIPTIONS = String(maxTargets);
          resultParams.ALIGNMENTS = String(maxTargets);
        }

        const resultsUrl = this.buildNCBIGetUrl(resultParams);
        const resultsResponse = await this.fetchWithDeadline(resultsUrl);

        if (!resultsResponse.ok) {
          throw new Error(`Results retrieval failed for NCBI BLAST RID ${jobId}: ${resultsResponse.status}`);
        }

        const resultsXml = await resultsResponse.text();

        // Also get text format for raw output
        const textResultsUrl = this.buildNCBIGetUrl({
          ...resultParams,
          FORMAT_TYPE: 'Text',
        });
        const textResultsResponse = await this.fetchWithDeadline(textResultsUrl);
        const textResults = textResultsResponse.ok ? await textResultsResponse.text() : 'Text format not available';

        // Parse XML results
        const parsedResults = this.parseNCBIBlastXML(resultsXml, params);
        parsedResults.rawXML = resultsXml;
        parsedResults.rawText = textResults;
        parsedResults.jobId = jobId;

        return parsedResults;
      }

      const responsePreview = statusText.replace(/\s+/g, ' ').trim().substring(0, 300);
      throw new Error(`Unable to determine NCBI BLAST status for RID ${jobId}. Response preview: ${responsePreview}`);
    }

    throw new Error(
      `BLAST job ${jobId} timed out after ${effectiveMaxAttempts} status checks - results may still be processing`
    );
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
          type: this.detectSequenceType(params.sequence),
        },
        parameters: params,
        hits: hits,
        statistics: statistics,
        source: 'NCBI',
        timestamp: new Date().toISOString(),
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
          match: hspMidline || '',
        },
        hsps: this.parseAllHSPs(hitElement), // Parse all HSPs for detailed view
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
        midline: hsp.getElementsByTagName('Hsp_midline')[0]?.textContent || '',
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
        entropy: stats.getElementsByTagName('Statistics_entropy')[0]?.textContent || 'Unknown',
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
        type: this.detectSequenceType(params.sequence),
      },
      parameters: params,
      hits: [],
      statistics: this.getDefaultStatistics(),
      source: 'NCBI',
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
      entropy: 'Unknown',
    };
  }

  async executeLocalBlast(params) {
    let queryFile;
    try {
      // Validate database exists before attempting search
      const databasePath = this.resolveDatabasePath(params.database);
      const isValidDatabase = await this.validateDatabase(databasePath, params.blastType);

      if (!isValidDatabase) {
        throw new Error(`Database not found or invalid: ${params.database}. Please create the database first.`);
      }

      // Create temporary FASTA file for query sequence
      queryFile = await this.createTempFastaFile(params.sequence);

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

      // Store results for track rendering
      this.searchResults = results;

      this.refreshBlastTrack();

      return results;
    } catch (error) {
      console.error('Local BLAST search error:', error);

      // Return error result instead of mock results
      return {
        searchId: `LOCAL_ERROR_${Date.now()}`,
        source: 'Local',
        isRealResults: false,
        isError: true,
        errorMessage: error.message,
        errorType: 'LOCAL_BLAST_ERROR',
        timestamp: new Date().toISOString(),
        queryInfo: {
          length: params.sequence.length,
          type: this.detectSequenceType(params.sequence),
        },
        hits: [],
        statistics: {
          searchTime: '0 seconds',
          databaseSize: '0 sequences',
          effectiveSearchSpace: '0',
        },
        rawOutput: `Error: ${error.message}`,
        rawText: `Error: ${error.message}`,
        blastCommand: 'Command failed',
      };
    } finally {
      if (queryFile) await this.cleanupTempFile(queryFile);
    }
  }

  async validateDatabase(databasePath, blastType) {
    try {
      // Check if database files exist
      const expectedExtensions = ['.nhr', '.nin', '.nsq']; // For nucleotide databases
      if (blastType === 'blastp' || blastType === 'blastx') {
        expectedExtensions.splice(0, 3, '.phr', '.pin', '.psq'); // For protein databases
      }

      let foundFiles = 0;
      for (const ext of expectedExtensions) {
        try {
          const filePath = databasePath + ext;
          if (typeof window !== 'undefined' && window.electronAPI?.checkFileExists) {
            const result = await window.electronAPI.checkFileExists(filePath);
            if (result?.exists) foundFiles++;
          }
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

  refreshBlastTrack() {
    const genomeBrowser = this.app?.genomeBrowser || this.app;
    if (genomeBrowser?.trackRenderer?.refreshTrack) {
      genomeBrowser.trackRenderer.refreshTrack('blast');
    }
  }

  getPathModule() {
    if (typeof window !== 'undefined' && window.path) {
      return window.path;
    }
    return {
      join: (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
      dirname: filePath =>
        String(filePath || '')
          .replace(/\\/g, '/')
          .split('/')
          .slice(0, -1)
          .join('/') || '/',
      basename: filePath =>
        String(filePath || '')
          .replace(/\\/g, '/')
          .split('/')
          .filter(Boolean)
          .pop() || '',
    };
  }

  getPlatformName() {
    if (typeof window !== 'undefined' && window.os && typeof window.os.platform === 'function') {
      return window.os.platform();
    }
    return 'linux';
  }

  getHomeDirectoryFallback() {
    if (typeof window !== 'undefined' && window.os && typeof window.os.homedir === 'function') {
      const homeDir = window.os.homedir();
      if (homeDir) return homeDir;
    }
    return '';
  }

  sanitizeFileNamePart(value, fallback = 'blast') {
    const safeValue = String(value || fallback)
      .replace(/[^A-Za-z0-9._-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return safeValue || fallback;
  }

  async getAppTempDirectory() {
    if (typeof window !== 'undefined' && window.electronAPI?.getAppPaths) {
      const result = await window.electronAPI.getAppPaths();
      if (result?.success && result.paths) {
        return result.paths.temp || result.paths.userData;
      }
    }
    return '/tmp';
  }

  async fileExistsViaMain(filePath) {
    if (typeof window !== 'undefined' && window.electronAPI?.checkFileExists) {
      const result = await window.electronAPI.checkFileExists(filePath);
      return !!result?.exists;
    }

    return false;
  }

  async writeTextFileViaMain(filePath, content) {
    if (!window.electronAPI?.writeFile) {
      throw new Error('Main-process file write API is unavailable');
    }
    const result = await window.electronAPI.writeFile(filePath, content);
    if (!result?.success) {
      throw new Error(result?.error || `Failed to write file: ${filePath}`);
    }
    return result.filePath || filePath;
  }

  async createTempFastaFile(sequence) {
    const path = this.getPathModule();
    const tempDir = await this.getAppTempDirectory();
    const tempFile = path.join(tempDir, `blast_query_${Date.now()}.fa`);
    const fastaContent = `>Query_sequence\n${sequence}`;
    return await this.writeTextFileViaMain(tempFile, fastaContent);
  }

  buildBlastCommand(params, queryFile) {
    const blastType = params.blastType;
    const blastExecutable = this.getBlastExecutable(blastType);

    // Resolve database path
    const databasePath = this.resolveDatabasePath(params.database);

    let command = `${blastExecutable} -query "${queryFile}" -db "${databasePath}"`;

    // Add common parameters
    command += ` -evalue ${params.evalue || '0.01'}`;
    command += ` -max_target_seqs ${params.maxTargets || 50}`;

    // Use detailed output format that includes sequence alignment information
    // Format 6 with additional sequence fields: qseq (query sequence) and sseq (subject sequence)
    command += ` -outfmt "6 qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore stitle qseq sseq qcovs qcovhsp"`;

    // Add type-specific parameters
    if (blastType === 'blastn') {
      const wordSize = params.wordSize ?? '11';
      if (wordSize) command += ` -word_size ${wordSize}`;
    } else if (blastType === 'blastp') {
      command += ` -matrix ${params.matrix || 'BLOSUM62'}`;
      if (params.gapOpen !== '' && params.gapExtend !== '') {
        command += ` -gapopen ${params.gapOpen ?? '11'} -gapextend ${params.gapExtend ?? '1'}`;
      }
    }

    // Add filtering options
    if (typeof params.lowComplexity === 'boolean') {
      command += ` -soft_masking ${params.lowComplexity}`;
    }

    return command;
  }

  resolveDatabasePath(databaseValue) {
    const path = this.getPathModule();
    if (!databaseValue) {
      throw new Error('Database value is required');
    }

    const directCustomDb = this.customDatabases.get(databaseValue);
    if (directCustomDb) {
      if (directCustomDb.dbPath) return directCustomDb.dbPath;
      if (directCustomDb.outputDir) return path.join(directCustomDb.outputDir, databaseValue);
      if (directCustomDb.path) return directCustomDb.path;
    }

    const localDb = this.config.localDatabases.get(databaseValue);
    if (localDb) {
      if (localDb.dbPath) return localDb.dbPath;
      if (localDb.path) return path.join(localDb.path, localDb.name || databaseValue);
    }

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
        const blastDbPath = path.join(this.config.localDbPath || this.getPlatformDbPath(), dbId);
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
      blastn: 'blastn',
      blastp: 'blastp',
      blastx: 'blastx',
      tblastn: 'tblastn',
      tblastx: 'tblastx',
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
      if (parts.length < 17) {
        throw new Error('Incomplete BLAST output: expected 17 columns including aligned query and subject sequences');
      }

      const [
        ,
        sseqid,
        pident,
        length,
        mismatch,
        gapopen,
        qstart,
        qend,
        sstart,
        send,
        evalue,
        bitscore,
        stitle = 'No description available',
        qseq = '',
        sseq = '',
        qcovs = '0',
        qcovhsp = '0',
      ] = parts;

      console.log('BLAST hit parsed:', {
        sseqid,
        pident,
        length,
        evalue,
        bitscore,
        stitle,
        hasSequences: !!(qseq && sseq),
      });

      // Parse numeric values safely
      const alignmentLength = parseInt(length) || 0;
      const queryStart = parseInt(qstart) || 0;
      const queryEnd = parseInt(qend) || 0;
      const subjectStart = parseInt(sstart) || 0;
      const subjectEnd = parseInt(send) || 0;
      const identityPercent = parseFloat(pident) || 0;
      const bitScore = parseFloat(bitscore) || 0;
      const queryCovsPercent = parseFloat(qcovs) || 0;
      parseFloat(qcovhsp) || 0;
      const mismatches = parseInt(mismatch) || 0;
      const gaps = parseInt(gapopen) || 0;

      if (!qseq || !sseq || qseq.length !== sseq.length || qseq.length !== alignmentLength) {
        throw new Error(`Incomplete BLAST alignment for ${sseqid}: aligned query and subject sequences are required`);
      }
      const querySequence = qseq;
      const subjectSequence = sseq;
      const matchString = this.generateRealMatchString(
        querySequence,
        subjectSequence,
        Boolean(params.blastType && params.blastType !== 'blastn')
      );

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
        identityCount: Math.round((alignmentLength * identityPercent) / 100),
        coverage: `${queryCovsPercent.toFixed(1)}%`,
        queryRange: { from: queryStart, to: queryEnd },
        hitRange: { from: subjectStart, to: subjectEnd },
        alignmentLength: alignmentLength,
        mismatches: mismatches,
        gaps: gaps,
        alignment: {
          query: querySequence,
          subject: subjectSequence,
          match: matchString,
        },
        hsps: [
          {
            score: bitScore,
            bitScore: bitScore,
            evalue: evalue,
            identity: Math.round((alignmentLength * identityPercent) / 100),
            alignLen: alignmentLength,
            queryFrom: queryStart,
            queryTo: queryEnd,
            hitFrom: subjectStart,
            hitTo: subjectEnd,
            querySeq: querySequence,
            hitSeq: subjectSequence,
            midline: matchString,
          },
        ],
      });
    }

    return {
      searchId: `local_blast_${Date.now()}`,
      queryInfo: {
        sequence: params.sequence.substring(0, 100) + (params.sequence.length > 100 ? '...' : ''),
        length: params.sequence.length,
        type: this.detectSequenceType(params.sequence),
      },
      parameters: params,
      hits: hits,
      statistics: {
        database: params.database,
        totalSequences: this.config.localDatabases.get(params.database)?.sequences || 'Unknown',
        totalLetters: this.config.localDatabases.get(params.database)?.letters || 'Unknown',
        searchTime: 'Local search',
        effectiveSearchSpace: 'Local database',
      },
      source: 'Local',
      timestamp: new Date().toISOString(),
    };
  }

  calculateCoverage(alignedLength, queryLength) {
    const coverage = (alignedLength / queryLength) * 100;
    return `${coverage.toFixed(1)}%`;
  }

  getAlignmentSequence(sequence, start, end) {
    return sequence.substring(start - 1, end);
  }

  generateRealMatchString(querySeq, subjectSeq, allowProteinSimilarity = true) {
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
      } else if (allowProteinSimilarity && this.isSimilarAminoAcid(qBase, sBase)) {
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
      ['C', 'M'], // sulfur
    ];

    for (const group of similarGroups) {
      if (group.includes(aa1) && group.includes(aa2)) {
        return true;
      }
    }
    return false;
  }

  async cleanupTempFile(file) {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.deletePhysicalFile) {
        await window.electronAPI.deletePhysicalFile(file);
      }
    } catch (error) {
      console.warn('Failed to clean up temporary file:', error);
    }
  }

  displayResults(results) {
    const container = document.getElementById('blastResultsContainer');
    if (!container) return;

    document.getElementById('exportBlastBtn').disabled = Boolean(results.isError);
    // Store results for filtering and sorting
    this.currentResults = results;
    this.filteredHits = [...results.hits];

    // Handle error cases - show only header and error message
    if (results.isError) {
      container.innerHTML = `
                <div class="blast-results-modern">
                    ${this.renderResultsHeader(results)}
                </div>
            `;
      return;
    }

    container.innerHTML = `
            <div class="blast-results-modern">
                ${this.renderResultsHeader(results)}
                ${this.renderResultsControls(results)}
                ${this.renderResultsSummary(results)}
                ${this.renderHitsList()}
                ${this.renderResultsFooter(results)}
            </div>
        `;

    // Setup event listeners
    this.setupResultsEventListeners();

    this.applySorting();
  }

  renderResultsHeader(results) {
    const parameters = results.parameters || {};
    const { queryInfo = {}, source, isError, jobId } = results;
    const program = parameters.blastType;
    const unit =
      program === 'blastp' || program === 'tblastn' || (!program && queryInfo.type === 'Protein') ? 'aa' : 'nt';
    const metadata = [
      source,
      program?.toUpperCase(),
      parameters.database,
      Number.isFinite(queryInfo.length) ? `${queryInfo.length.toLocaleString()} ${unit}` : '',
      jobId ? `RID ${jobId}` : '',
    ].filter(Boolean);

    return `
      <div class="blast-results-header">
        <div class="header-badges">
          ${metadata.map(value => `<span class="badge">${this.escapeHtml(value)}</span>`).join('')}
        </div>
        ${
          isError
            ? `<p class="blast-result-message" role="alert">${this.escapeHtml(results.errorMessage || 'BLAST search failed.')}</p>`
            : ''
        }
        ${
          !isError && results.isRealResults === false
            ? `<p class="blast-result-message">Simulated results ${this.escapeHtml(results.errorMessage || '')}</p>`
            : ''
        }
        ${
          queryInfo.sequence
            ? `<details class="blast-result-query"><summary>${queryInfo.sequence.endsWith('...') ? 'Query preview' : 'Query sequence'}</summary><pre>${this.escapeHtml(queryInfo.sequence)}</pre></details>`
            : ''
        }
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
                                ${this.getUniqueOrganisms(results.hits)
                                  .map(
                                    org => `<option value="${this.escapeHtml(org)}">${this.escapeHtml(org)}</option>`
                                  )
                                  .join('')}
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
                            <button id="sortOrder" class="btn btn-secondary" data-direction="desc">
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
                            <button id="resetBlastFilters" class="btn btn-secondary">Reset filters</button>
                        </div>
                        
                        <div class="control-group">
                            <button id="viewRawOutput" class="btn btn-secondary" ${results.rawText || results.rawOutput || results.rawXML ? '' : 'disabled'}>
                                <i class="fas fa-file-alt"></i> Raw Output
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  renderResultsSummary(results) {
    const { totalSequences, totalLetters, elapsedSeconds } = results.statistics || {};
    const databaseStats = [
      ['DB sequences', totalSequences],
      ['DB letters', totalLetters],
      ['Elapsed', Number.isFinite(elapsedSeconds) ? `${elapsedSeconds.toFixed(1)} s` : ''],
    ].filter(([, value]) => value && value !== 'Unknown');

    return `
      <div class="blast-results-summary">
        ${
          databaseStats.length
            ? `<dl class="summary-stats">
          ${databaseStats
            .map(
              ([label, value]) => `
            <div class="stat-card">
              <dt class="stat-label">${label}</dt>
              <dd class="stat-value">${this.escapeHtml(value)}</dd>
            </div>
          `
            )
            .join('')}
        </dl>`
            : ''
        }
        <div class="hits-counter">
          <span id="hitsCounter" role="status">Showing ${results.hits.length} of ${results.hits.length} hits</span>
        </div>
      </div>
    `;
  }

  renderHitsList() {
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
    const metadata = [
      results.searchId ? `Search ID ${results.searchId}` : '',
      results.timestamp ? new Date(results.timestamp).toLocaleString() : '',
      results.parameters?.evalue ? `E-value threshold ${results.parameters.evalue}` : '',
    ].filter(Boolean);
    return metadata.length
      ? `<div class="blast-results-footer"><small>${this.escapeHtml(metadata.join(' · '))}</small></div>`
      : '';
  }

  updateHitsDisplay() {
    const hitsList = document.getElementById('hitsList');
    const noHitsMessage = document.getElementById('noHitsMessage');
    const hitsCounter = document.getElementById('hitsCounter');

    if (!hitsList) return;

    if (this.filteredHits.length === 0) {
      hitsList.style.display = 'none';
      noHitsMessage.style.display = 'block';
      hitsList.replaceChildren();
      const noResults = this.currentResults.hits.length === 0;
      noHitsMessage.querySelector('h4').textContent = noResults ? 'No hits found' : 'No hits match the current filters';
      noHitsMessage.querySelector('p').textContent = noResults
        ? 'Try a different database or adjust the search parameters.'
        : 'Reset or adjust the filters to see more hits.';
      hitsCounter.textContent = `Showing 0 of ${this.currentResults.hits.length} hits`;
      return;
    }

    hitsList.style.display = 'block';
    noHitsMessage.style.display = 'none';
    hitsCounter.textContent = `Showing ${this.filteredHits.length} of ${this.currentResults.hits.length} hits`;

    // Render hits based on current view mode
    const isDetailed = document.getElementById('viewDetailed')?.classList.contains('active');

    hitsList.innerHTML = this.filteredHits
      .map((hit, index) => (isDetailed ? this.renderDetailedHit(hit, index) : this.renderCompactHit(hit, index)))
      .join('');

    // Setup hit event listeners
    this.setupHitEventListeners();
  }

  renderCompactHit(hit, index) {
    const evalueClass = this.getEvalueClass(hit.evalue);
    const identityClass = this.getIdentityClass(parseFloat(hit.identity));

    return `
            <div class="blast-hit compact" data-hit-index="${index}">
                <button type="button" class="hit-header" aria-expanded="false">
                    <span class="hit-main-info">
                        <span class="hit-title">
                            <span class="hit-accession">${this.escapeHtml(hit.accession)}</span>
                            <span class="hit-description">${this.escapeHtml(this.truncateDescription(hit.description, 120))}</span>
                        </span>
                        <span class="hit-organism">
                            <i class="fas fa-microscope"></i> ${this.escapeHtml(hit.organism || 'Unknown organism')}
                        </span>
                    </span>
                    
                    <span class="hit-scores">
                        <span class="score-item">
                            <span class="score-label">Score:</span>
                            <span class="score-value">${this.escapeHtml(hit.score)}</span>
                        </span>
                        <span class="score-item ${evalueClass}">
                            <span class="score-label">E-value:</span>
                            <span class="score-value">${this.escapeHtml(hit.evalue)}</span>
                        </span>
                        <span class="score-item ${identityClass}">
                            <span class="score-label">Identity:</span>
                            <span class="score-value">${this.escapeHtml(hit.identity)}</span>
                        </span>
                        <span class="score-item">
                            <span class="score-label">Coverage:</span>
                            <span class="score-value">${this.escapeHtml(hit.coverage)}</span>
                        </span>
                    </span>
                    
                    <span class="hit-expand">
                        <i class="fas fa-chevron-down"></i>
                    </span>
                </button>
                <div class="hit-details"></div>
            </div>
        `;
  }

  renderDetailedHit(hit, index) {
    const evalueClass = this.getEvalueClass(hit.evalue);
    const identityClass = this.getIdentityClass(parseFloat(hit.identity));

    const program = this.currentResults.parameters?.blastType;
    const proteinSubject = program === 'blastp' || program === 'blastx';

    return `
            <div class="blast-hit detailed" data-hit-index="${index}">
                <div class="hit-card">
                    <div class="hit-card-header">
                        <div class="hit-title-section">
                            <h5 class="hit-title">
                                <span class="hit-accession">${this.escapeHtml(hit.accession)}</span>
                                ${
                                  this.currentResults.source === 'NCBI' && hit.accession
                                    ? `<a href="https://www.ncbi.nlm.nih.gov/${proteinSubject ? 'protein' : 'nuccore'}/${encodeURIComponent(hit.accession)}" target="_blank" rel="noopener noreferrer" class="external-link" aria-label="Open accession at NCBI">
                                    <i class="fas fa-external-link-alt"></i>
                                </a>`
                                    : ''
                                }
                            </h5>
                            <p class="hit-description">${this.escapeHtml(hit.description)}</p>
                            <div class="hit-meta">
                                <span class="meta-item">
                                    <i class="fas fa-microscope"></i> ${this.escapeHtml(hit.organism || 'Unknown organism')}
                                </span>
                                <span class="meta-item">
                                    <i class="fas fa-ruler"></i> ${hit.length.toLocaleString()} ${proteinSubject ? 'aa' : 'nt'}
                                </span>
                                ${
                                  hit.taxonomyId
                                    ? `<span class="meta-item">
                                    <i class="fas fa-sitemap"></i> TaxID: ${this.escapeHtml(hit.taxonomyId)}
                                </span>`
                                    : ''
                                }
                            </div>
                        </div>
                        
                        <div class="hit-scores-detailed">
                            <div class="score-grid">
                                <div class="score-card primary">
                                    <div class="score-value">${this.escapeHtml(hit.score)}</div>
                                    <div class="score-label">Bit Score</div>
                                </div>
                                <div class="score-card ${evalueClass}">
                                    <div class="score-value">${this.escapeHtml(hit.evalue)}</div>
                                    <div class="score-label">E-value</div>
                                </div>
                                <div class="score-card ${identityClass}">
                                    <div class="score-value">${this.escapeHtml(hit.identity)}</div>
                                    <div class="score-label">Identity</div>
                                </div>
                                <div class="score-card">
                                    <div class="score-value">${this.escapeHtml(hit.coverage)}</div>
                                    <div class="score-label">Coverage</div>
                                </div>
                            </div>
                            
                            <div class="hit-actions">
                                <button class="btn btn-sm btn-secondary toggle-details" type="button" aria-expanded="false">
                                    Show alignment
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="hit-details-section" hidden></div>
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
                            <span class="stat-value">${this.escapeHtml(hit.queryRange.from)}-${this.escapeHtml(hit.queryRange.to)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Subject Range:</span>
                            <span class="stat-value">${this.escapeHtml(hit.hitRange.from)}-${this.escapeHtml(hit.hitRange.to)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Alignment Length:</span>
                            <span class="stat-value">${this.escapeHtml(hit.alignmentLength)}</span>
                        </div>
                        <div class="stat">
                            <span class="stat-label">Identities:</span>
                            <span class="stat-value">${this.escapeHtml(hit.identityCount)}/${this.escapeHtml(hit.alignmentLength)} (${this.escapeHtml(hit.identity)})</span>
                        </div>
                        ${
                          hit.gaps
                            ? `<div class="stat">
                            <span class="stat-label">Gaps:</span>
                            <span class="stat-value">${this.escapeHtml(hit.gaps)}/${this.escapeHtml(hit.alignmentLength)} (${((hit.gaps / hit.alignmentLength) * 100).toFixed(1)}%)</span>
                        </div>`
                            : ''
                        }
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
                        <pre class="alignment-text">${this.escapeHtml(this.formatAlignment(hit.alignment, hit.queryRange, hit.hitRange))}</pre>
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

    // Detect if alignment is in reverse orientation (subject range is reversed)
    const isReverseAlignment = hitRange.from > hitRange.to;

    for (let i = 0; i < maxLength; i += lineLength) {
      const queryLine = paddedQuery.substring(i, i + lineLength);
      const matchLine = paddedMatch.substring(i, i + lineLength);
      const subjectLine = paddedSubject.substring(i, i + lineLength);

      // Calculate actual positions excluding gaps
      const queryBasesInLine = queryLine.replace(/-/g, '').length;
      const subjectBasesInLine = subjectLine.replace(/-/g, '').length;

      const queryEndPos = queryPos + queryBasesInLine - 1;

      let hitEndPos;
      if (isReverseAlignment) {
        // For reverse alignments, decrement the position
        hitEndPos = hitPos - subjectBasesInLine + 1;
      } else {
        // For forward alignments, increment as before
        hitEndPos = hitPos + subjectBasesInLine - 1;
      }

      // Format with proper spacing and alignment
      formatted += `Query  ${queryPos.toString().padStart(6)} ${queryLine} ${queryEndPos.toString().padStart(6)}\n`;
      formatted += `       ${' '.repeat(6)} ${matchLine}\n`;
      formatted += `Sbjct  ${hitPos.toString().padStart(6)} ${subjectLine} ${hitEndPos.toString().padStart(6)}\n\n`;

      // Update positions for next line
      queryPos = queryEndPos + 1;
      if (isReverseAlignment) {
        hitPos = hitEndPos - 1;
      } else {
        hitPos = hitEndPos + 1;
      }
    }

    return formatted;
  }

  renderMultipleHSPs(hsps) {
    return `
            <div class="multiple-hsps">
                <h6><i class="fas fa-layer-group"></i> Multiple HSPs (${hsps.length})</h6>
                <div class="hsps-list">
                    ${hsps
                      .map(
                        (hsp, index) => `
                        <div class="hsp-item">
                            <div class="hsp-header">
                                <span class="hsp-number">HSP ${index + 1}</span>
                                <span class="hsp-score">Score: ${hsp.bitScore.toFixed(1)} bits</span>
                                <span class="hsp-evalue">E-value: ${this.escapeHtml(hsp.evalue)}</span>
                            </div>
                            <div class="hsp-ranges">
                                Query: ${this.escapeHtml(hsp.queryFrom)}-${this.escapeHtml(hsp.queryTo)}, Subject: ${this.escapeHtml(hsp.hitFrom)}-${this.escapeHtml(hsp.hitTo)}
                            </div>
                        </div>
                    `
                      )
                      .join('')}
                </div>
            </div>
        `;
  }

  showSearchProgress(params) {
    const container = document.getElementById('blastResultsContainer');
    document.getElementById('exportBlastBtn').disabled = true;
    container.innerHTML = `
      <div class="blast-loading" role="status">
        <i class="fas fa-spinner fa-spin" aria-hidden="true"></i>
        <h4>Running BLAST search</h4>
        <p id="progressMessage"></p>
      </div>
    `;
    const service = params.service === 'ncbi' ? 'NCBI BLAST' : 'Local BLAST';
    this.updateSearchProgress(`${service} · ${params.blastType.toUpperCase()} · ${params.database}`);
    this.updateSearchAvailability();
  }

  updateSearchProgress(message) {
    if (!this.isSearching) return;
    this.searchProgress = message;
    const progressMessage = document.getElementById('progressMessage');
    if (progressMessage) progressMessage.textContent = message;
    document.getElementById('blastSearchStatus').textContent = message;
  }

  exportResults() {
    if (!this.searchResults || this.searchResults.isError || this.isSearching) {
      this.showNotification('No results to export', 'warning');
      return;
    }

    try {
      const exportData = this.formatResultsForExport();
      this.downloadFile('blast_results.txt', exportData, 'text/plain');
      this.showNotification('Results exported successfully', 'success');
    } catch (error) {
      this.showNotification('Error exporting results: ' + error.message, 'error');
    }
  }

  /**
   * Save BLAST results to JSON file
   */
  saveBlastResults() {
    if (!this.searchResults) {
      this.showNotification('No results to save', 'warning');
      return;
    }

    try {
      // Create a clean copy of results for saving
      const resultsToSave = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        query:
          this.searchResults.parameters?.sequence || this.searchResults.query || this.searchResults.queryInfo?.sequence,
        queryInfo: this.searchResults.queryInfo,
        database: this.searchResults.database || this.searchResults.parameters?.database,
        source: this.searchResults.source,
        statistics: this.searchResults.statistics,
        parameters: this.searchResults.parameters,
        hits: this.searchResults.hits || [],
      };

      const jsonContent = JSON.stringify(resultsToSave, null, 2);
      const fileName = `blast_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      this.downloadFile(fileName, jsonContent, 'application/json');
      this.showNotification('BLAST results saved successfully', 'success');
    } catch (error) {
      this.showNotification('Error saving BLAST results: ' + error.message, 'error');
    }
  }

  /**
   * Download file helper method
   */
  downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Update the Blast results display after loading new results
   */
  updateBlastResultsDisplay() {
    if (!this.searchResults) return;
    this.displayResults(this.searchResults);
    this.updateSearchAvailability();
    this.showResultsModal();
  }

  /**
   * Load Blast results from a JSON file
   * @param {Object} blastResults - The Blast results data from JSON file
   */
  loadBlastResults(blastResults) {
    if (!Array.isArray(blastResults?.hits)) throw new Error('BLAST results must contain a hits array');

    const sequence =
      [blastResults.queryInfo?.sequence, blastResults.query, blastResults.parameters?.sequence].find(
        sequence => typeof sequence === 'string'
      ) || '';
    const parameters = { database: blastResults.database, ...blastResults.parameters };
    this.searchResults = {
      ...blastResults,
      parameters,
      queryInfo: {
        ...blastResults.queryInfo,
        sequence,
        length: blastResults.queryInfo?.length ?? sequence.length,
        type: blastResults.queryInfo?.type || this.detectSequenceType(sequence),
      },
    };
    this.updateBlastResultsDisplay();
    this.refreshBlastTrack();
  }

  showRawOutput() {
    const { rawOutput, rawText, rawXML } = this.searchResults || {};
    const formats = new Map();
    if (rawText || rawOutput) formats.set('Text', rawText || rawOutput);
    if (rawXML) formats.set('XML', rawXML);
    if (!formats.size) return;

    const opener = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'blast-raw-dialog';
    dialog.setAttribute('aria-labelledby', 'blastRawTitle');
    dialog.innerHTML = `
      <div class="blast-raw-header">
        <h3 id="blastRawTitle">Raw BLAST output</h3>
        <form method="dialog"><button class="btn btn-secondary" autofocus>Close</button></form>
      </div>
      <div class="blast-raw-actions">
        <label for="blastRawFormat">Format</label>
        <select id="blastRawFormat"></select>
        <button type="button" class="btn btn-secondary" data-action="copy">Copy</button>
        <button type="button" class="btn btn-secondary" data-action="download">Download</button>
        <span role="status"></span>
      </div>
      <pre tabindex="0"></pre>
    `;

    const format = dialog.querySelector('select');
    format.replaceChildren(...Array.from(formats.keys(), name => new Option(name, name)));
    const output = dialog.querySelector('pre');
    const status = dialog.querySelector('[role="status"]');
    const renderOutput = () => {
      output.textContent = formats.get(format.value);
      status.textContent = '';
    };
    format.addEventListener('change', renderOutput);
    dialog.querySelector('[data-action="copy"]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(output.textContent);
        status.textContent = 'Copied';
      } catch (error) {
        status.textContent = 'Clipboard unavailable';
      }
    });
    dialog.querySelector('[data-action="download"]').addEventListener('click', () => {
      const xml = format.value === 'XML';
      this.downloadFile(
        xml ? 'blast_raw_output.xml' : 'blast_raw_output.txt',
        output.textContent,
        xml ? 'application/xml' : 'text/plain'
      );
    });
    dialog.addEventListener(
      'close',
      () => {
        dialog.remove();
        opener?.focus();
      },
      { once: true }
    );

    renderOutput();
    document.body.appendChild(dialog);
    dialog.showModal();
  }

  /**
   * Format Blast results for export to text file
   */
  formatResultsForExport() {
    const results = this.searchResults;
    if (!results) return '';

    let output = '';

    // Add header with query information
    output += 'BLAST SEARCH RESULTS\n';
    output += '='.repeat(40) + '\n\n';

    output += 'QUERY INFORMATION:\n';
    output += '-----------------\n';
    output += `Query: ${results.parameters?.sequence || results.query || results.queryInfo?.sequence || 'Unavailable'}\n`;
    output += `Database: ${results.database || results.parameters?.database || 'Unknown'}\n`;
    output += `BLAST Type: ${results.parameters?.blastType?.toUpperCase() || 'Unknown'}\n`;
    output += `E-value Threshold: ${results.parameters?.evalue || 'Unknown'}\n`;
    output += `Hits Found: ${results.hits.length}\n\n`;

    // Add results statistics
    if (results.statistics) {
      output += 'STATISTICS:\n';
      output += '-----------\n';
      output += `Total Sequences in Database: ${results.statistics.totalSequences}\n`;
      output += `Total Letters in Database: ${this.formatLargeNumber(results.statistics.totalLetters)}\n`;
      output += `Search Time: ${results.statistics.searchTime || 'Unknown'}\n\n`;
    }

    // Add hits details
    output += 'HITS DETAILS:\n';
    output += '-------------\n\n';

    results.hits.forEach((hit, index) => {
      output += `HIT ${index + 1}:\n`;
      output += `- Accession: ${hit.accession}\n`;
      output += `- Description: ${hit.description}\n`;
      output += `- Organism: ${hit.organism || 'Unknown'}\n`;
      output += `- Score: ${hit.score}\n`;
      output += `- E-value: ${hit.evalue}\n`;
      output += `- Identity: ${hit.identity}\n`;
      output += `- Coverage: ${hit.coverage}\n`;
      output += `- Alignment Length: ${hit.alignmentLength}\n`;
      output += `- Query Range: ${hit.queryRange.from}-${hit.queryRange.to}\n`;
      output += `- Subject Range: ${hit.hitRange.from}-${hit.hitRange.to}\n\n`;

      // Add alignment if available
      if (hit.alignment) {
        output += 'Alignment:\n';
        output += this.formatAlignment(hit.alignment, hit.queryRange, hit.hitRange) + '\n';
      }

      output += '='.repeat(60) + '\n\n';
    });

    return output;
  }

  switchModalTab(tabName) {
    this.selectSearchOption('.blast-workspace-tabs button', 'tab', tabName);
    const managing = tabName === 'db-management';
    document.getElementById('blast-search-tab').hidden = managing;
    document.getElementById('db-management-tab').hidden = !managing;
    document.getElementById('blastSearchFooter').hidden = managing;
    if (managing) {
      this.populateAvailableDatabasesList();
    } else {
      this.updateCurrentRegionDisplay();
      this.updateSearchAvailability();
    }
  }

  updateLoadedGenomeList() {
    const select = document.getElementById('loadedGenomeSelect');
    if (!select) {
      // Element doesn't exist in current UI design, skip silently
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
        btn.addEventListener('click', e => {
          const dbName = e.target.closest('.delete-db-btn').dataset.dbName;
          this.deleteLocalDatabase(dbName);
        });
      });
    }
  }

  async createDatabaseFromLoadedGenome() {
    try {
      const selectedGenomeElement = document.getElementById('loadedGenomeSelect');
      const dbNameElement = document.getElementById('newDbName');
      const dbTypeElement = document.getElementById('newDbType');

      // Check if required elements exist
      if (!selectedGenomeElement || !dbNameElement || !dbTypeElement) {
        console.warn('BlastManager: Required form elements not found for database creation');
        this.showNotification('Database creation form not available', 'error');
        return;
      }

      const selectedGenome = selectedGenomeElement.value;
      const dbName = dbNameElement.value.trim();
      const dbType = dbTypeElement.value;

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

      console.log(
        `BlastManager: Creating ${dbType} database "${dbName}" from ${chromosome} (${sequenceData.length} bp)`
      );

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

      // Create database using makeblastdb in the same directory where the generated FASTA was actually written.
      const path = this.getPathModule();
      const outputDir = path.dirname(tempFile);
      console.log(`BlastManager: Creating database in sequence file directory: ${outputDir}`);

      await this.createLocalDatabase({
        inputFile: tempFile,
        dbName: dbName,
        dbType: dbType,
        title: `${dbName} - ${chromosome}`,
        parseSeqids: true,
        outputDir: outputDir,
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
      // Six-frame translation reads the genome with the code it is annotated with.
      const geneticCode = window.GeneticCodes
        ? window.GeneticCodes.forContext(null, this.app?.currentAnnotations?.[chromosome]).id
        : 'standard';

      // Forward frames (1, 2, 3)
      for (let frame = 0; frame < 3; frame++) {
        const result = window.UnifiedDNATranslation.translateDNA({
          sequence: cleanSeq,
          frame: frame,
          strand: 1,
          geneticCode,
          includeStops: false,
          validateInput: false,
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
          geneticCode,
          includeStops: false,
          validateInput: false,
        });

        if (result.success && result.protein.length > 10) {
          fastaContent += `>${chromosome}_frame_-${frame + 1}\n${result.protein}\n`;
        }
      }

      return fastaContent;
    }

    // Fallback to original implementation
    const geneticCode = {
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

    const reverseComplement = seq => {
      const complement = { A: 'T', T: 'A', G: 'C', C: 'G' };
      return seq
        .split('')
        .reverse()
        .map(base => complement[base] || base)
        .join('');
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
      if (protein.length > 10) {
        // Only include proteins longer than 10 amino acids
        fastaContent += `>${chromosome}_frame_+${frame + 1}\n${protein}\n`;
      }
    }

    // Reverse frames (4, 5, 6)
    const revSeq = reverseComplement(cleanSeq);
    for (let frame = 0; frame < 3; frame++) {
      const protein = translate(revSeq, frame, '-');
      if (protein.length > 10) {
        // Only include proteins longer than 10 amino acids
        fastaContent += `>${chromosome}_frame_-${frame + 1}\n${protein}\n`;
      }
    }

    return fastaContent;
  }

  async writeSequenceToFile(fastaContent, dbName, dbType, options = {}) {
    const path = this.getPathModule();

    // Write next to the genome source when one is known, otherwise fall back to
    // the main-process temp directory.
    let targetDir = await this.getAppTempDirectory();
    const currentFilePath = this.getCurrentGenomeFilePath();

    if (currentFilePath) {
      // Use the same directory as the loaded genome file
      targetDir = path.dirname(currentFilePath);
      console.log(`BlastManager: Using genome directory: ${targetDir}`);
    } else {
      console.log('BlastManager: Current file path not available, using temp directory');
    }

    const fileName =
      options.fileName ||
      `${this.sanitizeFileNamePart(dbName)}_${this.sanitizeFileNamePart(dbType)}_${Date.now()}.fasta`;
    let filePath = path.join(targetDir, fileName);

    try {
      filePath = await this.writeTextFileViaMain(filePath, fastaContent);
    } catch (error) {
      if (!currentFilePath) {
        throw error;
      }

      const fallbackDir = await this.getAppTempDirectory();
      const fallbackPath = path.join(fallbackDir, fileName);
      console.warn(
        `BlastManager: Genome directory write failed (${error.message}); retrying in temp directory: ${fallbackDir}`
      );
      filePath = await this.writeTextFileViaMain(fallbackPath, fastaContent);
    }

    console.log(`BlastManager: Wrote sequence to ${filePath}`);

    return filePath;
  }

  getDatabaseInfo(database) {
    const dbInfo = {
      nt: { type: 'nucleotide', name: 'Nucleotide collection' },
      nr: { type: 'protein', name: 'Non-redundant protein sequences' },
      refseq_rna: { type: 'nucleotide', name: 'RefSeq RNA sequences' },
      refseq_genomic: { type: 'nucleotide', name: 'RefSeq Genome sequences' },
      refseq_protein: { type: 'protein', name: 'RefSeq Protein Database' },
      swissprot: { type: 'protein', name: 'UniProtKB/Swiss-Prot' },
      pdb: { type: 'protein', name: 'Protein Data Bank proteins' },
      est: { type: 'nucleotide', name: 'Expressed Sequence Tags' },
    };

    return dbInfo[database] || { type: 'unknown', name: database };
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

    document.getElementById('resetBlastFilters')?.addEventListener('click', () => {
      for (const filter of [evalueFilter, identityFilter, organismFilter]) filter.value = '';
      this.applyFilters();
    });

    // Sort controls
    const sortBy = document.getElementById('sortBy');
    const sortOrder = document.getElementById('sortOrder');

    if (sortBy) {
      sortBy.addEventListener('change', () => {
        this.setSortOrder(sortBy.value !== 'evalue');
        this.applySorting();
      });
    }
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

    // Raw output button
    const rawOutputBtn = document.getElementById('viewRawOutput');
    if (rawOutputBtn) {
      rawOutputBtn.addEventListener('click', () => this.showRawOutput());
    }
  }

  setupHitEventListeners() {
    const list = document.getElementById('hitsList');
    list.querySelectorAll('.hit-header, .toggle-details').forEach(button => {
      button.addEventListener('click', () => {
        const hit = button.closest('.blast-hit');
        const details = hit.querySelector('.hit-details, .hit-details-section');
        const expanded = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(expanded));
        hit.classList.toggle('expanded', expanded);
        details.hidden = !expanded;
        if (expanded && !details.hasChildNodes()) {
          details.innerHTML = this.renderHitDetails(this.filteredHits[hit.dataset.hitIndex]);
        }
        if (button.classList.contains('toggle-details')) {
          button.textContent = expanded ? 'Hide alignment' : 'Show alignment';
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
    const descending = document.getElementById('sortOrder')?.dataset.direction !== 'asc';

    this.filteredHits.sort((a, b) => {
      const valueA = parseFloat(a[sortBy]);
      const valueB = parseFloat(b[sortBy]);
      if (!Number.isFinite(valueA)) return Number.isFinite(valueB) ? 1 : 0;
      if (!Number.isFinite(valueB)) return -1;
      return descending ? valueB - valueA : valueA - valueB;
    });

    this.updateHitsDisplay();
  }

  setSortOrder(descending) {
    const sortOrder = document.getElementById('sortOrder');
    if (!sortOrder) return;
    sortOrder.dataset.direction = descending ? 'desc' : 'asc';
    sortOrder.innerHTML = descending
      ? '<i class="fas fa-sort-amount-down" aria-hidden="true"></i> Desc'
      : '<i class="fas fa-sort-amount-up" aria-hidden="true"></i> Asc';
  }

  toggleSortOrder() {
    this.setSortOrder(document.getElementById('sortOrder')?.dataset.direction === 'asc');
  }

  /**
   * Get all BLAST results for the current search
   * @param {string} chromosome - Chromosome name (currently not used, but kept for consistency)
   * @returns {array} - All BLAST results
   */
  getAllBlastResults(chromosome) {
    console.log(`🔍 [BLAST Manager] Getting all results for chromosome: ${chromosome}`);

    if (!this.searchResults || !this.searchResults.hits) {
      console.log(`🔍 [BLAST Manager] No search results available`);
      return [];
    }

    console.log(`🔍 [BLAST Manager] Returning ${this.searchResults.hits.length} total hits`);
    return this.searchResults.hits;
  }

  /**
   * Get BLAST results in specified chromosome and viewport range
   * @param {string} chromosome - Chromosome name
   * @param {object} viewport - Viewport object with start and end properties
   * @returns {array} - Filtered BLAST results
   */
  getBlastResultsInRange(chromosome, viewport) {
    console.log(
      `🔍 [BLAST Manager] Getting results for chromosome: ${chromosome}, viewport: ${viewport.start}-${viewport.end}`
    );

    if (!this.searchResults || !this.searchResults.hits) {
      console.log(`🔍 [BLAST Manager] No search results available`);
      return [];
    }

    console.log(`🔍 [BLAST Manager] Total hits available: ${this.searchResults.hits.length}`);

    // Filter hits that match the current chromosome and are within the viewport
    const filteredHits = this.searchResults.hits.filter(hit => {
      console.log(
        `🔍 [BLAST Manager] Checking hit: ${hit.accession}, hitRange: ${hit.hitRange.from}-${hit.hitRange.to}`
      );

      // For now, skip chromosome matching as we might be dealing with different data formats
      // This is a common issue with BLAST results where chromosome info is not standard
      // We'll assume all hits are for the current chromosome since we're showing BLAST results for the current sequence

      // Check if hit range overlaps with viewport
      const hitStart = hit.hitRange.from;
      const hitEnd = hit.hitRange.to;

      const isInViewport = hitStart <= viewport.end && hitEnd >= viewport.start;
      console.log(`🔍 [BLAST Manager] Hit ${hit.accession} in viewport: ${isInViewport}`);

      return isInViewport;
    });

    console.log(`🔍 [BLAST Manager] Returning ${filteredHits.length} filtered hits`);
    return filteredHits;
  }

  /**
   * Show detailed information for a specific BLAST result
   * @param {object} result - BLAST hit result object
   */
  showResultDetails(result) {
    // You can implement this to show a modal with detailed information about the hit
    console.log('BLAST Result Details:', result);

    // Example: Scroll to the hit position in the genome browser
    if (this.app && this.app.genomeBrowser) {
      const chromosome = result.accession.split('.')[0];
      const resultStart = result.hitRange.from;
      const resultEnd = result.hitRange.to;

      // Calculate appropriate viewport to show the result
      const currentViewport = this.app.genomeBrowser.currentPosition;
      const viewportSize = currentViewport.end - currentViewport.start;
      const newStart = Math.max(0, Math.min(resultStart - viewportSize / 3, resultEnd - viewportSize));
      const newEnd = newStart + viewportSize;

      // Navigate to the new position
      this.app.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
      if (this.app.genomeBrowser.currentSequence && this.app.genomeBrowser.currentSequence[chromosome]) {
        this.app.genomeBrowser.displayGenomeView(chromosome, this.app.genomeBrowser.currentSequence[chromosome]);
        if (this.app.genomeBrowser.genomeNavigationBar) {
          this.app.genomeBrowser.genomeNavigationBar.update();
        }
        if (this.app.genomeBrowser.tabManager) {
          this.app.genomeBrowser.tabManager.updateCurrentTabPosition(chromosome, newStart + 1, newEnd, {
            source: 'navigation',
          });
        }
      }
    }

    // Example: Show detailed information in a modal
    const modalContent = `
            <div class="blast-result-details">
                <h4>${result.accession} - ${result.description}</h4>
                <div class="blast-details-section">
                    <strong>Score:</strong> ${result.score}<br>
                    <strong>E-value:</strong> ${result.evalue}<br>
                    <strong>Identity:</strong> ${result.identity}%<br>
                    <strong>Coverage:</strong> ${result.coverage}%<br>
                    <strong>Length:</strong> ${result.length} bp<br>
                    <strong>Position:</strong> ${result.hitRange.from} - ${result.hitRange.to}
                </div>
                ${result.alignment ? `<div class="blast-alignment"><h5>Alignment:</h5><pre>${result.alignment}</pre></div>` : ''}
            </div>
        `;

    this.app.utils.showModal('BLAST Result Details', modalContent, 'modal-lg');
  }
}

// Export for Node/test environments; in the renderer this class is loaded as a script-tag global.
// A top-level `class` declaration is a lexical binding, so it is NOT reachable as
// window.BlastManager — attach it explicitly for callers that look it up that way.
if (typeof window !== 'undefined') {
  window.BlastManager = BlastManager;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlastManager;
}
