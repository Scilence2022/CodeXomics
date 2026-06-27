/**
 * ProjectManager - core class for the standalone project manager
 * Features include: project creation, file management, workspace organization, and communication with the main window
 */
class ProjectManager {
  constructor() {
    this.projects = new Map();
    this.currentProject = null;
    this.currentPath = [];
    this.workspaces = new Map();
    this.recentProjects = [];
    this.settings = {
      defaultProjectLocation: '',
      autoSave: true,
      showHiddenFiles: false,
      viewMode: 'grid', // 'grid' or 'list'
    };

    // File type configurations
    this.fileTypes = {
      fasta: { icon: 'FA', color: '#28a745', extensions: ['.fasta', '.fa', '.fas'] },
      gff: { icon: 'GFF', color: '#17a2b8', extensions: ['.gff', '.gff3', '.gtf'] },
      vcf: { icon: 'VCF', color: '#ffc107', extensions: ['.vcf'] },
      bam: { icon: 'BAM', color: '#6f42c1', extensions: ['.bam', '.sam'] },
      wig: { icon: 'WIG', color: '#fd7e14', extensions: ['.wig', '.bw', '.bigwig'] },
      bed: { icon: 'BED', color: '#dc3545', extensions: ['.bed'] },
      genbank: { icon: 'GB', color: '#20c997', extensions: ['.gb', '.gbk', '.gbff'] },
      folder: { icon: '📁', color: '#6c757d', extensions: [] },
    };

    this.selectedFiles = new Set();
    this.searchTerm = '';
    this.contextMenuTarget = null;

    // XML handler
    this.xmlHandler = new ProjectXMLHandler();

    // Initialize
    this.loadSettings();
    this.loadProjects();
    this.initializeUI();
    this.setupEventListeners();

    console.log('ProjectManager initialized successfully');
  }

  /**
   * Initialize the UI components
   */
  initializeUI() {
    this.renderProjectTree();
    this.updateStatusBar();
    this.setupSearchFunctionality();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Search-box events
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.addEventListener('input', e => {
        this.searchTerm = e.target.value.toLowerCase();
        this.filterAndRenderFiles();
      });
    }

    // File drag-and-drop support
    document.addEventListener('dragover', e => e.preventDefault());
    document.addEventListener('drop', e => {
      e.preventDefault();
      this.handleFileDrop(e);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      this.handleKeyboardShortcuts(e);
    });

    // Window-close event
    if (window.electronAPI && window.electronAPI.onBeforeWindowClose) {
      window.electronAPI.onBeforeWindowClose(() => {
        this.saveProjects();
        this.saveSettings();
      });
    }

    // Use the standard beforeunload event as a fallback
    window.addEventListener('beforeunload', () => {
      this.saveProjects();
      this.saveSettings();
    });
  }

  /**
   * New-project modal
   */
  createNewProject() {
    const modal = document.getElementById('newProjectModal');
    if (modal) {
      // Clear the form
      document.getElementById('projectName').value = '';
      document.getElementById('projectDescription').value = '';
      document.getElementById('projectLocation').value = this.settings.defaultProjectLocation || '';
      modal.style.display = 'block';
    }
  }

  /**
   * Select the project location
   */
  async selectProjectLocation() {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectProjectDirectory();
        if (result.success && !result.canceled) {
          document.getElementById('projectLocation').value = result.filePath;
        }
      } else {
        console.log('electronAPI not available for directory selection');
      }
    } catch (error) {
      console.error('Error selecting project location:', error);
      this.showNotification('Failed to select project location', 'error');
    }
  }

  /**
   * Create a project
   */
  async createProject() {
    const name = document.getElementById('projectName').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const location = document.getElementById('projectLocation').value.trim();

    if (!name) {
      this.showNotification('Project name is required', 'warning');
      return;
    }

    try {
      const projectId = this.generateProjectId();
      const project = {
        id: projectId,
        name: name,
        description: description,
        location: location,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        files: [],
        folders: [],
        settings: {
          fileFilters: [],
          customAnnotations: [],
        },
        metadata: {
          totalFiles: 0,
          totalSize: 0,
          lastOpened: new Date().toISOString(),
        },
      };

      // Create the project directory structure
      if (window.electronAPI) {
        const result = await window.electronAPI.createProjectDirectory(location, name);
        if (!result.success) {
          throw new Error(result.error);
        }
        project.location = result.projectPath;
      }

      // Add to the project list
      this.projects.set(projectId, project);
      this.addToRecentProjects(projectId);

      // Save the project
      await this.saveProjects();

      // Update the UI
      this.renderProjectTree();
      this.selectProject(projectId);

      // Close the modal
      this.closeModal('newProjectModal');

      this.showNotification(`Project "${name}" created successfully`, 'success');
      this.updateStatusBar(`Project "${name}" created`);
    } catch (error) {
      console.error('Error creating project:', error);
      this.showNotification(`Failed to create project: ${error.message}`, 'error');
    }
  }

  /**
   * Open an existing project
   */
  async openProject() {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectProjectFile();
        if (result.success && !result.canceled) {
          await this.loadProjectFromFile(result.filePath);
        }
      } else {
        console.log('electronAPI not available for file selection');
      }
    } catch (error) {
      console.error('Error opening project:', error);
      this.showNotification('Failed to open project', 'error');
    }
  }

  /**
   * Load a project from a file (supports JSON and XML formats)
   */
  async loadProjectFromFile(filePath) {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.loadProjectFile(filePath);
        if (result.success) {
          let project;

          // Determine the format from the file extension or content
          if (
            filePath.endsWith('.xml') ||
            result.content.trim().startsWith('<?xml') ||
            result.content.includes('<GenomeExplorerProject')
          ) {
            // XML format
            const validation = this.xmlHandler.validateProjectXML(result.content);
            if (!validation.valid) {
              throw new Error(`Invalid XML project file: ${validation.error}`);
            }
            project = validation.project;
          } else {
            // JSON format (backward compatible)
            project = JSON.parse(result.content);

            // Validate the project data
            if (!project.id || !project.name) {
              throw new Error('Invalid project file format');
            }
          }

          // Update the last-opened time
          if (!project.metadata) project.metadata = {};
          project.metadata.lastOpened = new Date().toISOString();

          // Save the file path for later saving
          project.filePath = filePath;
          // Also set the appropriate path properties for XML save operations
          if (filePath.endsWith('.GAI') || filePath.endsWith('.xml')) {
            project.projectFilePath = filePath;
            project.xmlFilePath = filePath;
          }

          // Mark project as loaded (not modified) to prevent unnecessary save dialogs
          project.hasUnsavedChanges = false;
          project.justLoaded = true; // Flag to indicate this project was just loaded

          this.projects.set(project.id, project);
          this.addToRecentProjects(project.id);

          this.renderProjectTree();
          this.selectProject(project.id);

          this.showNotification(`Project "${project.name}" loaded successfully`, 'success');
        } else {
          throw new Error(result.error);
        }
      }
    } catch (error) {
      console.error('Error loading project file:', error);
      this.showNotification(`Failed to load project: ${error.message}`, 'error');
    }
  }

  /**
   * Select a project
   */
  selectProject(projectId) {
    this.currentProject = this.projects.get(projectId);
    this.currentPath = [];

    if (this.currentProject) {
      // Update the UI
      this.renderProjectContent();
      this.updateActiveTreeItem(projectId);
      this.updateContentTitle();
      this.updateProjectStats();

      // Show the project content area
      document.getElementById('projectOverview').style.display = 'none';
      document.getElementById('projectContent').style.display = 'block';

      this.updateStatusBar(`Opened project: ${this.currentProject.name}`);

      // Notify the global project-state update
      this.notifyProjectChange(this.currentProject);
    }
  }

  /**
   * Notify a project-state change
   */
  async notifyProjectChange(project) {
    if (window.electronAPI && window.electronAPI.setActiveProject) {
      try {
        const projectInfo = {
          id: project.id,
          name: project.name,
          location: project.location,
          dataFolderPath: project.location ? `${project.location}/data` : null,
          projectFilePath: project.filePath || null,
        };

        await window.electronAPI.setActiveProject(projectInfo);
        console.log('🗂️ Project change notified:', projectInfo);
      } catch (error) {
        console.error('Error notifying project change:', error);
      }
    }
  }

  /**
   * Render the project tree
   */
  renderProjectTree() {
    const projectTree = document.getElementById('projectTree');
    if (!projectTree) return;

    let html = '';

    if (this.projects.size === 0) {
      html = '<div style="padding: 20px; text-align: center; color: var(--pm-text-secondary);">No projects found</div>';
    } else {
      this.projects.forEach((project, projectId) => {
        const isActive = this.currentProject && this.currentProject.id === projectId;
        html += `
                    <div class="tree-item project ${isActive ? 'active' : ''}" 
                         onclick="projectManager.selectProject('${projectId}')"
                         data-project-id="${projectId}">
                        <div class="tree-icon">📂</div>
                        <span>${project.name}</span>
                    </div>
                `;

        // Show the project folders (if the project is selected)
        if (isActive) {
          html += this.renderProjectFolders(project);
        }
      });
    }

    projectTree.innerHTML = html;
  }

  /**
   * Render the project folder structure
   */
  renderProjectFolders(project) {
    let html = '';

    // Default folders
    const defaultFolders = [
      { name: 'Genomes', icon: '🧬', path: ['genomes'] },
      { name: 'Annotations', icon: '📋', path: ['annotations'] },
      { name: 'Variants', icon: '🔄', path: ['variants'] },
      { name: 'Reads', icon: '📊', path: ['reads'] },
      { name: 'Analysis', icon: '📈', path: ['analysis'] },
    ];

    defaultFolders.forEach(folder => {
      const isCurrentPath = this.arraysEqual(this.currentPath, folder.path);
      html += `
                <div class="tree-item folder ${isCurrentPath ? 'active' : ''}" 
                     onclick="projectManager.navigateToFolder(${JSON.stringify(folder.path).replace(/"/g, '&quot;')})"
                     style="margin-left: 20px;">
                    <div class="tree-icon">${folder.icon}</div>
                    <span>${folder.name}</span>
                </div>
            `;
    });

    return html;
  }

  /**
   * Navigate to a folder
   */
  navigateToFolder(path) {
    this.currentPath = path;
    this.renderProjectContent();
    this.updateActiveTreeItem();
    this.updateContentTitle();
  }

  /**
   * Render the project content
   */
  renderProjectContent() {
    if (!this.currentProject) return;

    this.updateProjectStats();
    this.renderFileGrid();
  }

  /**
   * Render the file grid
   */
  renderFileGrid() {
    const fileGrid = document.getElementById('fileGrid');
    if (!fileGrid) return;

    const currentFiles = this.getCurrentFolderFiles();
    const filteredFiles = this.filterFiles(currentFiles);

    if (filteredFiles.length === 0) {
      fileGrid.innerHTML = `
                <div style="grid-column: 1 / -1;">
                    <div class="empty-state">
                        <div class="empty-state-icon">📄</div>
                        <h3>No files found</h3>
                        <p>Add some files to get started.</p>
                        <button class="btn btn-primary" onclick="projectManager.addFiles()">
                            Add Files
                        </button>
                    </div>
                </div>
            `;
      return;
    }

    let html = '';
    filteredFiles.forEach(file => {
      const fileType = this.detectFileType(file.name);
      const typeConfig = this.fileTypes[fileType] || this.fileTypes.folder;
      const isSelected = this.selectedFiles.has(file.id);

      html += `
                <div class="file-card ${isSelected ? 'selected' : ''}" 
                     onclick="projectManager.selectFile('${file.id}')"
                     ondblclick="projectManager.openFileInMainWindow('${file.id}')"
                     oncontextmenu="projectManager.showFileContextMenu(event, '${file.id}')"
                     data-file-id="${file.id}">
                    <div class="file-icon ${fileType}" 
                         style="background-color: ${typeConfig.color}">
                        ${typeConfig.icon}
                    </div>
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-info">
                        ${this.formatFileSize(file.size || 0)}
                        ${file.modified ? `• ${this.formatDate(file.modified)}` : ''}
                    </div>
                </div>
            `;
    });

    fileGrid.innerHTML = html;
  }

  /**
   * Get the files in the current folder
   */
  getCurrentFolderFiles() {
    if (!this.currentProject) return [];

    // Filter files by the current path
    return this.currentProject.files.filter(file => {
      if (this.currentPath.length === 0) return true;
      return file.folder && this.arraysEqual(file.folder, this.currentPath);
    });
  }

  /**
   * Filter files
   */
  filterFiles(files) {
    if (!this.searchTerm) return files;

    return files.filter(
      file =>
        file.name.toLowerCase().includes(this.searchTerm) ||
        (file.description && file.description.toLowerCase().includes(this.searchTerm))
    );
  }

  /**
   * Add a file to the project
   */
  async addFiles() {
    if (!this.currentProject) {
      this.showNotification('Please select a project first', 'warning');
      return;
    }

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.selectMultipleFiles();
        if (result.success && !result.canceled && result.filePaths.length > 0) {
          await this.processSelectedFiles(result.filePaths);
        }
      }
    } catch (error) {
      console.error('Error adding files:', error);
      this.showNotification('Failed to add files', 'error');
    }
  }

  /**
   * Handle the selected files
   */
  async processSelectedFiles(filePaths) {
    try {
      let addedCount = 0;

      for (const filePath of filePaths) {
        if (window.electronAPI) {
          const fileInfo = await window.electronAPI.getFileInfo(filePath);
          if (fileInfo.success) {
            const file = {
              id: this.generateFileId(),
              name: fileInfo.info.name,
              path: filePath,
              size: fileInfo.info.size,
              type: this.detectFileType(fileInfo.info.name),
              folder: [...this.currentPath],
              added: new Date().toISOString(),
              modified: fileInfo.info.modified,
            };

            this.currentProject.files.push(file);
            addedCount++;
          }
        }
      }

      if (addedCount > 0) {
        this.currentProject.modified = new Date().toISOString();
        this.currentProject.metadata.totalFiles = this.currentProject.files.length;

        await this.saveProjects();
        this.renderProjectContent();
        this.showNotification(`Added ${addedCount} file(s) to project`, 'success');
      }
    } catch (error) {
      console.error('Error processing files:', error);
      this.showNotification('Failed to process selected files', 'error');
    }
  }

  /**
   * Create a folder
   */
  createFolder() {
    if (!this.currentProject) {
      this.showNotification('Please select a project first', 'warning');
      return;
    }

    const folderName = prompt('Enter folder name:');
    if (!folderName || !folderName.trim()) return;

    // Create proper folder path based on current path
    const newPath =
      this.currentPath.length > 0
        ? [...this.currentPath, folderName.trim().toLowerCase()]
        : [folderName.trim().toLowerCase()];

    const folder = {
      name: folderName.trim(),
      icon: '📁',
      path: newPath,
      files: [], // Ensure files array is present
      created: new Date().toISOString(),
      custom: true, // Mark as user-created folder
    };

    // Check if folder already exists
    const existingFolder = this.currentProject.folders.find(f => this.arraysEqual(f.path, newPath));

    if (existingFolder) {
      this.showNotification(`Folder "${folderName}" already exists at this location`, 'warning');
      return;
    }

    this.currentProject.folders.push(folder);
    this.currentProject.modified = new Date().toISOString();

    // Add to project history
    if (!this.currentProject.history) {
      this.currentProject.history = [];
    }
    this.currentProject.history.unshift({
      timestamp: new Date().toISOString(),
      action: 'folder-created',
      description: `Created folder "${folderName}" at ${newPath.join('/')}`,
    });

    this.saveProjects();

    // Also save as XML if possible to ensure persistence
    if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
      this.saveProjectAsXML(this.currentProject.id);
    }

    this.renderProjectContent();
    this.showNotification(`Folder "${folderName}" created successfully`, 'success');

    console.log(`📁 Created folder: ${folderName} at path: ${newPath.join('/')}`);
  }

  /**
   * Select a file
   */
  selectFile(fileId, ctrlKey = false) {
    if (ctrlKey) {
      // Multi-select mode
      if (this.selectedFiles.has(fileId)) {
        this.selectedFiles.delete(fileId);
      } else {
        this.selectedFiles.add(fileId);
      }
    } else {
      // Single-select mode
      this.selectedFiles.clear();
      this.selectedFiles.add(fileId);
    }

    this.updateFileCardSelection();
  }

  /**
   * Update the file-card selection state
   */
  updateFileCardSelection() {
    const fileCards = document.querySelectorAll('.file-card');
    fileCards.forEach(card => {
      const fileId = card.dataset.fileId;
      if (this.selectedFiles.has(fileId)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  /**
   * Open a file in the main window
   */
  async openFileInMainWindow(fileId) {
    const file = this.findFileById(fileId);
    if (!file) return;

    try {
      if (window.electronAPI) {
        // Check the main-window state
        const mainWindowStatus = await window.electronAPI.checkMainWindowStatus();

        if (mainWindowStatus.hasOpenFile) {
          // The main window already has a file; create a new window
          const result = await window.electronAPI.createNewMainWindow(file.path);
          if (result.success) {
            this.showNotification(`Opened "${file.name}" in new window`, 'success');
          } else {
            throw new Error(result.error);
          }
        } else {
          // The main window has no file; open it in the current main window
          const result = await window.electronAPI.openFileInMainWindow(file.path);
          if (result.success) {
            this.showNotification(`Opened "${file.name}" in GenomeExplorer`, 'success');
          } else {
            throw new Error(result.error);
          }
        }
      }
    } catch (error) {
      console.error('Error opening file in main window:', error);
      this.showNotification('Failed to open file in main window', 'error');
    }
  }

  /**
   * Show the file context menu
   */
  showFileContextMenu(event, fileId) {
    event.preventDefault();
    event.stopPropagation();

    this.contextMenuTarget = fileId;
    const file = this.findFileById(fileId);
    if (!file) return;

    const contextMenu = document.getElementById('contextMenu');
    if (!contextMenu) return;

    const menuItems = [
      { icon: '📖', text: 'Open in GenomeExplorer', action: 'openInMain' },
      { icon: '👁️', text: 'Preview', action: 'preview' },
      { icon: '📋', text: 'Copy Path', action: 'copyPath' },
      { icon: '✏️', text: 'Rename', action: 'rename' },
      { icon: '🗑️', text: 'Remove from Project', action: 'remove' },
    ];

    let html = '';
    menuItems.forEach(item => {
      html += `
                <div class="context-menu-item" onclick="projectManager.handleContextMenuAction('${item.action}')">
                    <span>${item.icon}</span>
                    <span>${item.text}</span>
                </div>
            `;
    });

    contextMenu.innerHTML = html;
    contextMenu.style.display = 'block';
    contextMenu.style.left = event.clientX + 'px';
    contextMenu.style.top = event.clientY + 'px';
  }

  /**
   * Handle context-menu actions
   */
  async handleContextMenuAction(action) {
    if (!this.contextMenuTarget) return;

    const file = this.findFileById(this.contextMenuTarget);
    if (!file) return;

    // Hide the context menu
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) contextMenu.style.display = 'none';

    switch (action) {
      case 'openInMain':
        await this.openFileInMainWindow(file.id);
        break;
      case 'preview':
        this.previewFile(file);
        break;
      case 'copyPath':
        this.copyToClipboard(file.path);
        break;
      case 'rename':
        this.renameFile(file);
        break;
      case 'remove':
        this.removeFileFromProject(file.id);
        break;
    }

    this.contextMenuTarget = null;
  }

  /**
   * Rename a file
   */
  renameFile(file) {
    const newName = prompt('Enter new name:', file.name);
    if (!newName || newName.trim() === file.name) return;

    file.name = newName.trim();
    this.currentProject.modified = new Date().toISOString();

    this.saveProjects();
    this.renderProjectContent();
    this.showNotification(`File renamed to "${newName}"`, 'success');
  }

  /**
   * Remove a file from the project
   */
  removeFileFromProject(fileId) {
    if (!confirm('Are you sure you want to remove this file from the project?')) return;

    this.currentProject.files = this.currentProject.files.filter(f => f.id !== fileId);
    this.currentProject.modified = new Date().toISOString();
    this.currentProject.metadata.totalFiles = this.currentProject.files.length;

    this.selectedFiles.delete(fileId);

    this.saveProjects();
    this.renderProjectContent();
    this.showNotification('File removed from project', 'success');
  }

  /**
   * Update the project statistics
   */
  updateProjectStats() {
    const statsElement = document.getElementById('projectStats');
    if (!statsElement || !this.currentProject) return;

    const stats = {
      totalFiles: this.currentProject.files.length,
      currentFolderFiles: this.getCurrentFolderFiles().length,
      totalSize: this.currentProject.files.reduce((sum, file) => sum + (file.size || 0), 0),
      fileTypes: this.getFileTypeStats(),
    };

    statsElement.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.currentFolderFiles}</div>
                <div class="stat-label">Files in Folder</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.totalFiles}</div>
                <div class="stat-label">Total Files</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.formatFileSize(stats.totalSize)}</div>
                <div class="stat-label">Total Size</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Object.keys(stats.fileTypes).length}</div>
                <div class="stat-label">File Types</div>
            </div>
        `;
  }

  /**
   * Get the file-type statistics
   */
  getFileTypeStats() {
    const stats = {};
    this.currentProject.files.forEach(file => {
      const type = file.type || 'unknown';
      stats[type] = (stats[type] || 0) + 1;
    });
    return stats;
  }

  /**
   * Update the content title
   */
  updateContentTitle() {
    const titleElement = document.getElementById('contentTitle');
    if (!titleElement || !this.currentProject) return;

    let title = this.currentProject.name;
    if (this.currentPath.length > 0) {
      title += ' / ' + this.currentPath.join(' / ');
    }

    titleElement.textContent = title;
  }

  /**
   * Update the status bar
   */
  updateStatusBar(message = 'Ready') {
    const statusText = document.getElementById('statusText');
    const fileCount = document.getElementById('fileCount');

    if (statusText) statusText.textContent = message;

    if (fileCount && this.currentProject) {
      const currentFiles = this.getCurrentFolderFiles();
      const selectedCount = this.selectedFiles.size;
      let text = `${currentFiles.length} items`;
      if (selectedCount > 0) {
        text += ` (${selectedCount} selected)`;
      }
      fileCount.textContent = text;
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyboardShortcuts(event) {
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'n':
          event.preventDefault();
          this.createNewProject();
          break;
        case 'o':
          event.preventDefault();
          this.openProject();
          break;
        case 'a':
          event.preventDefault();
          this.selectAllFiles();
          break;
        case 's':
          event.preventDefault();
          this.saveProjects();
          break;
      }
    }

    if (event.key === 'Delete') {
      this.deleteSelectedFiles();
    }
  }

  /**
   * Select all files
   */
  selectAllFiles() {
    this.selectedFiles.clear();
    const currentFiles = this.getCurrentFolderFiles();
    currentFiles.forEach(file => this.selectedFiles.add(file.id));
    this.updateFileCardSelection();
    this.updateStatusBar();
  }

  /**
   * Delete the selected files
   */
  deleteSelectedFiles() {
    if (this.selectedFiles.size === 0) return;

    const count = this.selectedFiles.size;
    if (!confirm(`Are you sure you want to remove ${count} file(s) from the project?`)) return;

    this.selectedFiles.forEach(fileId => {
      this.currentProject.files = this.currentProject.files.filter(f => f.id !== fileId);
    });

    this.selectedFiles.clear();
    this.currentProject.modified = new Date().toISOString();
    this.currentProject.metadata.totalFiles = this.currentProject.files.length;

    this.saveProjects();
    this.renderProjectContent();
    this.showNotification(`Removed ${count} file(s) from project`, 'success');
  }

  /**
   * Refresh the project
   */
  async refreshProjects() {
    // If there's a current project, scan its directory and add new files/folders
    if (this.currentProject && this.currentProject.location) {
      await this.scanAndAddNewFiles();
      this.renderProjectTree();
      this.renderProjectContent();
      this.showNotification('🔄 Project directory scanned and refreshed', 'success');
    } else {
      // If there's no current project, load the project list normally
      await this.loadProjects();
      this.renderProjectTree();
      this.showNotification('📂 Projects list refreshed', 'success');
    }
  }

  /**
   * Scan the project folder and add new files
   */
  async scanAndAddNewFiles() {
    if (!this.currentProject || !window.electronAPI || !window.electronAPI.scanProjectFolder) {
      console.warn('Cannot scan project folder: missing project or API');
      return;
    }

    try {
      // Determine project path
      let projectPath;
      if (this.currentProject.dataFolderPath) {
        projectPath = this.currentProject.dataFolderPath;
      } else if (this.currentProject.location && this.currentProject.name) {
        projectPath = `${this.currentProject.location}/${this.currentProject.name}`;
      } else {
        console.warn('Cannot determine project path for scanning');
        return;
      }

      // Get existing file paths for comparison
      const existingFilePaths = (this.currentProject.files || []).map(file => file.path);

      // Get existing folder structure for comparison
      const existingFolderStructure = this.currentProject.folders || [];

      console.log(`🔍 Scanning project folder: ${projectPath}`);
      console.log(`📋 Existing files: ${existingFilePaths.length}`);
      console.log(`📂 Existing folders: ${existingFolderStructure.length}`);

      // Scan project folder for both files and folders
      const scanResult = await window.electronAPI.scanProjectFolder(
        projectPath,
        existingFilePaths,
        existingFolderStructure
      );

      if (scanResult.success) {
        const newFiles = scanResult.newFiles || [];
        const newFolders = scanResult.newFolders || [];
        const totalNewItems = newFiles.length + newFolders.length;

        if (totalNewItems > 0) {
          console.log(`🆕 Found ${newFiles.length} new files and ${newFolders.length} new folders`);

          // Initialize arrays if they don't exist
          if (!this.currentProject.files) {
            this.currentProject.files = [];
          }
          if (!this.currentProject.folders) {
            this.currentProject.folders = [];
          }

          // Add new files to the project
          newFiles.forEach(file => {
            // Generate proper project-unique ID
            file.id = this.generateFileId();

            // Add metadata to indicate it was auto-discovered
            if (!file.metadata) {
              file.metadata = {};
            }
            file.metadata.autoDiscovered = true;
            file.metadata.discoveredDate = new Date().toISOString();

            this.currentProject.files.push(file);
          });

          // Add new folders to the project
          newFolders.forEach(folder => {
            // Ensure folder has proper structure
            if (!folder.files) {
              folder.files = [];
            }

            this.currentProject.folders.push(folder);
          });

          // Update project metadata
          this.currentProject.modified = new Date().toISOString();
          this.projects.set(this.currentProject.id, this.currentProject);

          // Mark the project as modified so the save button saves to the .prj.GAI file
          this.markProjectAsModified();

          // Save changes to both localStorage and XML
          await this.saveProjects();

          // Auto-save as XML to ensure persistence
          if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
            await this.saveProjectAsXML(this.currentProject.id);
          }

          // Update UI
          this.renderProjectTree();
          this.renderProjectContent();

          // Create detailed summary message
          let summaryMessage = `✅ Auto-scan completed: `;
          const parts = [];
          if (newFiles.length > 0) {
            parts.push(`${newFiles.length} new file${newFiles.length === 1 ? '' : 's'}`);
          }
          if (newFolders.length > 0) {
            parts.push(`${newFolders.length} new folder${newFolders.length === 1 ? '' : 's'}`);
          }
          summaryMessage += parts.join(' and ') + ' added to project';

          this.showNotification(summaryMessage, 'success');

          // Add to project history
          if (!this.currentProject.history) {
            this.currentProject.history = [];
          }
          this.currentProject.history.unshift({
            timestamp: new Date().toISOString(),
            action: 'auto-scan-enhanced',
            description: `Auto-discovered ${totalNewItems} new item${totalNewItems === 1 ? '' : 's'}: ${newFiles.length} files, ${newFolders.length} folders`,
            details: {
              files: newFiles.length,
              folders: newFolders.length,
              total: totalNewItems,
              scanPath: projectPath,
            },
          });

          console.log(`📊 Scan Summary:`, {
            newFiles: newFiles.length,
            newFolders: newFolders.length,
            totalAdded: totalNewItems,
            projectPath: projectPath,
          });
        } else {
          console.log('✅ No new files or folders found during scan');
          this.showNotification('No new files or folders found in project directory', 'info');
        }
      } else {
        console.error('Failed to scan project folder:', scanResult.error);
        this.showNotification(`Failed to scan project folder: ${scanResult.error}`, 'error');
      }
    } catch (error) {
      console.error('Error during enhanced project folder scan:', error);
      this.showNotification(`Error scanning project folder: ${error.message}`, 'error');
    }
  }

  /**
   * Show settings
   */
  showSettings() {
    // TODO: implement the settings interface
    this.showNotification('Settings feature coming soon', 'info');
  }

  /**
   * Close the modal
   */
  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // ====== Utility methods ======

  /**
   * Generate a project ID
   */
  generateProjectId() {
    return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate a file ID
   */
  generateFileId() {
    return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Detect the file type
   */
  detectFileType(fileName) {
    const ext = fileName.toLowerCase().split('.').pop();
    for (const [type, config] of Object.entries(this.fileTypes)) {
      if (config.extensions.some(e => e.substring(1) === ext)) {
        return type;
      }
    }
    return 'unknown';
  }

  /**
   * Format the file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
  }

  /**
   * Format the date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  /**
   * Compare arrays
   */
  arraysEqual(a, b) {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  /**
   * Find a file by ID
   */
  findFileById(fileId) {
    if (!this.currentProject) return null;
    return this.currentProject.files.find(f => f.id === fileId);
  }

  /**
   * Copy to the clipboard
   */
  copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.showNotification('Path copied to clipboard', 'success');
    }
  }

  /**
   * Show a notification
   */
  showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    // TODO: implement a better notification system
    if (type === 'error') {
      alert(`Error: ${message}`);
    }
  }

  /**
   * Add to recent projects
   */
  addToRecentProjects(projectId) {
    this.recentProjects = this.recentProjects.filter(id => id !== projectId);
    this.recentProjects.unshift(projectId);
    this.recentProjects = this.recentProjects.slice(0, 10); // keep only the 10 most recent
  }

  /**
   * Clear recent projects
   */
  async clearRecentProjects() {
    this.recentProjects = [];
    await this.saveProjects();
    this.showNotification('Recent projects cleared', 'success');
    console.log('Recent projects cleared');
  }

  /**
   * Update the recent-projects menu
   */
  async updateRecentProjectsMenu() {
    try {
      if (!window.electronAPI || !window.electronAPI.updateRecentProjects) {
        return;
      }

      // Convert recent project IDs to project objects with needed info
      const recentProjectsData = this.recentProjects
        .map(id => this.projects.get(id))
        .filter(project => project != null)
        .map(project => ({
          id: project.id,
          name: project.name,
          filePath: project.filePath || project.projectFilePath || project.xmlFilePath,
          location: project.location,
        }));

      await window.electronAPI.updateRecentProjects(recentProjectsData);
      console.log('Recent projects menu updated');
    } catch (error) {
      console.error('Error updating recent projects menu:', error);
    }
  }

  /**
   * Update the active tree item
   */
  updateActiveTreeItem(projectId = null) {
    const treeItems = document.querySelectorAll('.tree-item');
    treeItems.forEach(item => {
      item.classList.remove('active');
    });

    if (projectId) {
      const activeItem = document.querySelector(`[data-project-id="${projectId}"]`);
      if (activeItem) activeItem.classList.add('active');
    }
  }

  /**
   * Set up the search feature
   */
  setupSearchFunctionality() {
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.addEventListener('input', () => {
        this.filterAndRenderFiles();
      });
    }
  }

  /**
   * Filter and render files
   */
  filterAndRenderFiles() {
    this.renderFileGrid();
  }

  /**
   * Handle file drag-and-drop
   */
  handleFileDrop(event) {
    if (!this.currentProject) {
      this.showNotification('Please select a project first', 'warning');
      return;
    }

    const files = Array.from(event.dataTransfer.files);
    const filePaths = files.map(file => file.path);

    if (filePaths.length > 0) {
      this.processSelectedFiles(filePaths);
    }
  }

  /**
   * Preview a file
   */
  previewFile(file) {
    // TODO: implement the file-preview feature
    this.showNotification(`Preview for ${file.name} coming soon`, 'info');
  }

  /**
   * Save the project data
   */
  async saveProjects() {
    try {
      const projectsData = {
        projects: Object.fromEntries(this.projects),
        recentProjects: this.recentProjects,
        lastSaved: new Date().toISOString(),
      };

      if (window.electronAPI) {
        const result = await window.electronAPI.saveProjectsData(projectsData);
        if (!result.success) {
          throw new Error(result.error);
        }

        // Update the menu with recent projects
        await this.updateRecentProjectsMenu();
      } else {
        // In a browser environment, save to localStorage
        localStorage.setItem('genomeExplorer_projects', JSON.stringify(projectsData));
      }

      console.log('Projects saved successfully');
    } catch (error) {
      console.error('Error saving projects:', error);
      this.showNotification('Failed to save projects', 'error');
    }
  }

  /**
   * Export the project as XML
   */
  async exportProjectAsXML(projectId) {
    try {
      const project = this.projects.get(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Generate the XML content
      const xmlContent = this.xmlHandler.projectToXML(project);

      // Create the download
      if (window.electronAPI) {
        const fileName = `${project.name.replace(/[^\w\s-]/g, '')}_project.xml`;
        const result = await window.electronAPI.saveFile(fileName, xmlContent);
        if (result.success) {
          this.showNotification(`Project exported to ${result.filePath}`, 'success');
        } else {
          throw new Error(result.error);
        }
      } else {
        // Browser-environment download
        const blob = new Blob([xmlContent], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/[^\w\s-]/g, '')}_project.xml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showNotification('Project XML file downloaded', 'success');
      }
    } catch (error) {
      console.error('Error exporting project as XML:', error);
      this.showNotification(`Failed to export project: ${error.message}`, 'error');
    }
  }

  /**
   * Save a single project as an XML file
   */
  async saveProjectAsXML(projectId) {
    try {
      const project = this.projects.get(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Generate the XML content
      const xmlContent = this.xmlHandler.projectToXML(project);

      if (window.electronAPI && window.electronAPI.saveProjectToSpecificFile) {
        // Save directly to the project file path, without a dialog
        const filePath = project.projectFilePath || project.xmlFilePath;
        if (filePath) {
          const result = await window.electronAPI.saveProjectToSpecificFile(filePath, xmlContent);
          if (result.success) {
            project.modified = new Date().toISOString();
            console.log(`✅ Project XML saved to: ${filePath}`);
            this.showNotification(`Project saved to XML file`, 'success');
          } else {
            throw new Error(result.error);
          }
        } else {
          // Check if this is a just-loaded project to avoid unnecessary save dialogs
          if (project.justLoaded) {
            console.log(`Skipping auto-save for just-loaded project: ${project.name}`);
            // Clear the justLoaded flag after first save attempt
            delete project.justLoaded;
            return;
          }

          // If there's no existing path and the project wasn't just loaded, use saveProjectFile (which shows a dialog)
          const defaultPath = `${project.name}.prj.GAI`;
          const result = await window.electronAPI.saveProjectFile(defaultPath, xmlContent);
          if (result.success) {
            project.projectFilePath = result.filePath;
            project.modified = new Date().toISOString();
            console.log(`✅ Project XML saved to: ${result.filePath}`);
            this.showNotification(`Project saved to ${result.filePath}`, 'success');
          } else {
            throw new Error(result.error);
          }
        }
      } else {
        console.warn('XML save API not available');
      }
    } catch (error) {
      console.error('Error saving project as XML:', error);
      this.showNotification(`Failed to save project: ${error.message}`, 'error');
    }
  }

  /**
   * Save the current project
   */
  async saveCurrentProject() {
    if (!this.currentProject) {
      this.showNotification('No project to save', 'warning');
      return;
    }

    try {
      // Update the project's modification time
      this.currentProject.modified = new Date().toISOString();

      // Ensure the project data is up to date
      this.projects.set(this.currentProject.id, this.currentProject);

      // Save to localStorage
      await this.saveProjects();

      // Save to an XML file
      await this.saveProjectAsXML(this.currentProject.id);

      // Mark the project as saved
      this.markProjectAsSaved();

      this.showNotification(`✅ Project "${this.currentProject.name}" saved successfully`, 'success');
      console.log(`💾 Project saved: ${this.currentProject.name}`);
    } catch (error) {
      console.error('Error saving current project:', error);
      this.showNotification(`Failed to save project: ${error.message}`, 'error');
    }
  }

  /**
   * Load the project data
   */
  async loadProjects() {
    try {
      let projectsData = null;

      if (window.electronAPI) {
        const result = await window.electronAPI.loadProjectsData();
        if (result.success && result.data) {
          projectsData = JSON.parse(result.data);
        }
      } else {
        // In a browser environment, load from localStorage
        const data = localStorage.getItem('genomeExplorer_projects');
        if (data) {
          projectsData = JSON.parse(data);
        }
      }

      if (projectsData) {
        this.projects = new Map(Object.entries(projectsData.projects || {}));
        this.recentProjects = projectsData.recentProjects || [];

        // Update the menu with recent projects
        await this.updateRecentProjectsMenu();
      }

      console.log(`Loaded ${this.projects.size} projects`);
    } catch (error) {
      console.error('Error loading projects:', error);
      this.projects = new Map();
      this.recentProjects = [];
    }
  }

  /**
   * Save settings
   */
  async saveSettings() {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.saveProjectSettings(this.settings);
        if (!result.success) {
          throw new Error(result.error);
        }
      } else {
        localStorage.setItem('genomeExplorer_projectSettings', JSON.stringify(this.settings));
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  /**
   * Load settings
   */
  async loadSettings() {
    try {
      let settings = null;

      if (window.electronAPI) {
        const result = await window.electronAPI.loadProjectSettings();
        if (result.success && result.data) {
          settings = JSON.parse(result.data);
        }
      } else {
        const data = localStorage.getItem('genomeExplorer_projectSettings');
        if (data) {
          settings = JSON.parse(data);
        }
      }

      if (settings) {
        this.settings = { ...this.settings, ...settings };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  // ====== Project state-management methods ======

  /**
   * Mark the project as modified
   */
  markProjectAsModified() {
    if (!this.currentProject) return;

    // Clear the justLoaded flag when project is actually modified
    if (this.currentProject.justLoaded) {
      delete this.currentProject.justLoaded;
    }

    this.currentProject.hasUnsavedChanges = true;
    this.currentProject.modified = new Date().toISOString();

    // Save to local storage
    this.projects.set(this.currentProject.id, this.currentProject);
    this.saveProjects();

    // Update the save-button state
    this.updateSaveButtonState();

    console.log('📝 Project marked as modified (changes buffered)');
  }

  /**
   * Mark the project as saved
   */
  markProjectAsSaved() {
    if (!this.currentProject) return;

    this.currentProject.hasUnsavedChanges = false;

    // Save to local storage
    this.projects.set(this.currentProject.id, this.currentProject);
    this.saveProjects();

    this.updateSaveButtonState();

    console.log('💾 Project marked as saved');
  }

  /**
   * Update the save-button state
   */
  updateSaveButtonState() {
    const saveBtn =
      document.querySelector('[onclick*="saveCurrentProject"]') ||
      document.querySelector('.save-btn') ||
      document.querySelector('[title*="Save"]');

    if (!saveBtn) return;

    const hasChanges = this.currentProject && this.currentProject.hasUnsavedChanges;

    if (hasChanges) {
      saveBtn.style.background = 'var(--pm-save-unsaved-gradient)';
      saveBtn.style.boxShadow = '0 4px 15px rgba(255, 107, 107, 0.4)';
      saveBtn.innerHTML = saveBtn.innerHTML.includes('💾') ? '💾 Save *' : 'Save *';
      saveBtn.title = 'Save project - You have unsaved changes';

      // Add a pulse animation
      saveBtn.style.animation = 'pulse 2s infinite';
    } else {
      saveBtn.style.background = 'var(--pm-save-saved-gradient)';
      saveBtn.style.boxShadow = '0 4px 15px rgba(54, 209, 220, 0.4)';
      saveBtn.innerHTML = saveBtn.innerHTML.includes('💾') ? '💾 Save' : 'Save';
      saveBtn.title = 'Save current project';
      saveBtn.style.animation = '';
    }
  }
}

// Ensure it's available globally
if (typeof window !== 'undefined') {
  window.ProjectManager = ProjectManager;
}
