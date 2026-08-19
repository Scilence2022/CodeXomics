/**
 * ProjectManagerWindow - core class for the standalone project manager window
 * A feature module designed specifically for the project manager window
 */
class ProjectManagerWindow {
  constructor() {
    this.projects = new Map();
    this.currentProject = null;
    this.currentPath = [];
    this.selectedFiles = new Set();
    this.recentProjects = []; // Track recent projects
    this.sortBy = 'name';
    this.showHiddenFiles = false;
    this.showFileExtensions = true;
    this.isCompactMode = false;
    this.compactTreeMode = false;
    this.ultraCompactMode = false;
    this.headerCollapsed = false;
    this.detailsOpen = false;
    this.statsVisible = true; // Track statistics panel visibility
    this.currentViewMode = 'grid'; // Add view mode tracking
    this.viewMode = 'grid'; // For compatibility

    // Enhanced project management features
    this.fileRelationships = new Map(); // Track file relationships
    this.searchIndex = new Map(); // Search index for files

    // File type configurations (single source of truth lives in ProjectUtils;
    // the extensions arrays are required for detectFileType to work)
    this.fileTypes = ProjectUtils.FILE_TYPES;

    this.expandedProjects = new Set();
    this.expandedFolders = new Set();
    this.currentContextFolderPath = null;
    this.clipboard = null;

    this.initialize();
  }

  async initialize() {
    console.log('Initializing Project Manager Window...');

    // Load the project data
    await this.loadProjects();

    // Initialize the UI
    this.setupEventListeners();
    this.renderProjectTree();
    this.updateStatusBar('Ready');

    // Initialize minimal mode
    this.initializeCompactMode();

    // Initialize tree-view events and settings
    this.initializeTreeViewEvents();

    // Initialize header events and settings
    this.initializeHeaderEvents();

    // Initialize the sidebar splitter
    this.initializeSidebarSplitter();

    // Re-apply the persisted sidebar visibility
    this.loadSidebarPreference();

    // Enable drag & drop file import
    this.setupDragAndDrop();

    console.log('Project Manager Window initialized successfully');
  }

  setupEventListeners() {
    // Search feature
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.addEventListener('input', e => {
        this.searchTerm = e.target.value.toLowerCase();
        this.renderProjectContent();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'n':
            e.preventDefault();
            if (e.shiftKey) {
              this.createFolder(); // Ctrl+Shift+N
            } else {
              this.createNewProject(); // Ctrl+N
            }
            break;
          case 'o':
            e.preventDefault();
            this.openProject(); // Ctrl+O
            break;
          case 's':
            e.preventDefault();
            if (e.shiftKey) {
              this.saveProjectAs(); // Ctrl+Shift+S
            } else {
              this.saveCurrentProject(); // Ctrl+S
            }
            break;
          case 'a':
            e.preventDefault();
            if (this.currentProject) {
              this.selectAllFiles(); // Ctrl+A
            } else {
              this.addFiles(); // Ctrl+A (when no project)
            }
            break;
        }
      } else {
        switch (e.key) {
          case 'F5':
            e.preventDefault();
            this.manualRefreshProjects();
            break;
          case 'F8':
            e.preventDefault();
            this.toggleSidebar();
            break;
          case 'F9':
            e.preventDefault();
            this.toggleDetailsPanel();
            break;
          case 'F1':
            e.preventDefault();
            this.showDocumentation();
            break;
          case 'Escape':
            e.preventDefault();
            this.clearSelection();
            break;
          case 'Delete':
            e.preventDefault();
            this.deleteSelectedFiles();
            break;
        }
      }
    });

    // Close the modal when clicking outside
    window.addEventListener('click', e => {
      const modals = document.querySelectorAll('.modal');
      modals.forEach(modal => {
        if (e.target === modal) {
          modal.style.display = 'none';
        }
      });
    });
  }

  // ====== Project management features ======

  async setDefaultProjectLocation() {
    try {
      if (window.electronAPI && window.electronAPI.getProjectDirectoryName && window.electronAPI.getDocumentsPath) {
        const [dirResult, documentsPath] = await Promise.all([
          window.electronAPI.getProjectDirectoryName(),
          window.electronAPI.getDocumentsPath(),
        ]);
        if (dirResult.success && documentsPath) {
          // `process.env`/`navigator.platform` are unavailable or deprecated in
          // a context-isolated renderer — paths come from the main process.
          const defaultLocation = ProjectUtils.joinPath(documentsPath, dirResult.directoryName);
          this.defaultProjectsDir = defaultLocation;
          const locationInput = document.getElementById('projectLocation');
          if (locationInput) locationInput.value = defaultLocation;
        }
      }
    } catch (error) {
      console.warn('Failed to set default project location:', error);
    }
  }

  async selectProjectLocation() {
    try {
      if (window.electronAPI && window.electronAPI.selectProjectDirectory) {
        const result = await window.electronAPI.selectProjectDirectory();
        if (result.success && !result.canceled) {
          document.getElementById('projectLocation').value = result.filePath;
        }
      } else {
        console.log('electronAPI selectProjectDirectory not available');
        // Fallback for the browser environment
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.onchange = e => {
          if (e.target.files.length > 0) {
            const path = e.target.files[0].webkitRelativePath.split('/')[0];
            document.getElementById('projectLocation').value = path;
          }
        };
        input.click();
      }
    } catch (error) {
      console.error('Error selecting project location:', error);
      this.showNotification('Failed to select project location', 'error');
    }
  }

  async createProject() {
    const name = document.getElementById('projectName').value.trim();
    const description = document.getElementById('projectDescription').value.trim();
    const location = document.getElementById('projectLocation').value.trim();

    if (!name) {
      this.showNotification('Project name is required', 'warning');
      return;
    }

    if (!location) {
      this.showNotification('Project location is required', 'warning');
      return;
    }

    try {
      const projectId = this.generateId();

      // Step 1: Create physical project structure
      console.log(`🏗️ Creating project structure for "${name}" at "${location}"`);

      if (window.electronAPI && window.electronAPI.createNewProjectStructure) {
        const structureResult = await window.electronAPI.createNewProjectStructure(location, name);

        if (!structureResult.success) {
          throw new Error(`Failed to create project structure: ${structureResult.error}`);
        }

        console.log(`✅ Project structure created: ${structureResult.projectFilePath}`);

        // Step 2: Create project object with correct paths
        const project = {
          id: projectId,
          name: name,
          description: description,
          location: location,
          projectFilePath: structureResult.projectFilePath,
          dataFolderPath: structureResult.dataFolderPath,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          files: [],
          folders: ProjectUtils.DEFAULT_PROJECT_FOLDERS.map(f => ({ ...f, path: [...f.path], files: [] })),
          metadata: {
            totalFiles: 0,
            totalSize: 0,
            lastOpened: new Date().toISOString(),
          },
          history: [
            {
              timestamp: new Date().toISOString(),
              action: 'created',
              description: `Project "${name}" created at ${location}`,
            },
          ],
        };

        // Step 3: Generate and save Project.GAI file
        console.log(`💾 Creating Project.GAI file...`);

        if (!this.xmlHandler) {
          this.xmlHandler = new ProjectXMLHandler();
        }

        const xmlContent = this.xmlHandler.projectToXML(project);
        const saveResult = await window.electronAPI.saveProjectToSpecificFile(
          structureResult.projectFilePath,
          xmlContent
        );

        if (!saveResult.success) {
          throw new Error(`Failed to save project file: ${saveResult.error}`);
        }

        console.log(`✅ Project.GAI file created: ${structureResult.projectFilePath}`);

        // Step 4: Add to project list and update UI
        this.projects.set(projectId, project);
        this.addToRecentProjects(projectId);
        await this.saveProjects();

        this.renderProjectTree();
        this.selectProject(projectId);
        this.closeModal('newProjectModal');

        this.showNotification(`Project "${name}" created successfully at ${location}`, 'success');

        console.log(`🎉 Project creation completed successfully!`);
        console.log(`📁 Project directory: ${structureResult.dataFolderPath}`);
        console.log(`📄 Project file: ${structureResult.projectFilePath}`);
      } else {
        throw new Error('Project creation API not available');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      this.showNotification(`Failed to create project: ${error.message}`, 'error');
    }
  }

  async openProject() {
    try {
      if (window.electronAPI && window.electronAPI.selectProjectFile) {
        const result = await window.electronAPI.selectProjectFile();
        if (result.success && !result.canceled) {
          await this.loadProjectFromFile(result.filePath);
        }
      } else {
        this.showNotification('Open project feature requires Electron API', 'warning');
      }
    } catch (error) {
      console.error('Error opening project:', error);
      this.showNotification('Failed to open project', 'error');
    }
  }

  // ====== UI rendering features ======

  renderProjectTree() {
    const projectTree = document.getElementById('projectTree');
    if (!projectTree) return;

    let html = '';

    if (this.projects.size === 0) {
      html = `
                <div style="padding: 20px; text-align: center; color: var(--pm-text-secondary);">
                    <div style="font-size: 2em; margin-bottom: 10px;">📂</div>
                    <div>No projects found</div>
                    <button class="btn btn-primary" onclick="projectManagerWindow.createNewProject()" style="margin-top: 10px; font-size: 12px;">
                        Create Project
                    </button>
                </div>
            `;
    } else {
      this.projects.forEach((project, projectId) => {
        const isActive = this.currentProject && this.currentProject.id === projectId;
        const isExpanded = this.expandedProjects && this.expandedProjects.has(projectId);
        const hasChildren = project.folders && project.folders.length > 0;

        // Combined icon: expand state + project icon
        let combinedIcon = '🗂️';
        if (hasChildren) {
          combinedIcon = isExpanded ? '📂' : '📁';
        }

        // Project names/descriptions/ids are user- or file-controlled —
        // escape them before interpolating into markup. Ids embedded in
        // inline handler strings need JS-string escaping AND HTML escaping.
        const safeProjectId = ProjectUtils.escapeHtml(projectId);
        const safeProjectIdJs = ProjectUtils.escapeHtml(ProjectUtils.escapeJsString(projectId));
        const safeProjectName = ProjectUtils.escapeHtml(project.name);
        const safeProjectTitle = ProjectUtils.escapeHtml(project.description || project.name);

        html += `
                    <div class="tree-item project ${isActive ? 'active' : ''}" 
                         data-project-id="${safeProjectId}">
                        <div class="tree-item-content" onclick="projectManagerWindow.selectProject('${safeProjectIdJs}')">
                            <div class="tree-icon tree-main-icon" onclick="event.stopPropagation(); projectManagerWindow.toggleProjectExpansion('${safeProjectIdJs}')"
                                 style="cursor: ${hasChildren ? 'pointer' : 'default'};">
                                ${combinedIcon}
                            </div>
                            <span class="tree-label" title="${safeProjectTitle}">${safeProjectName}</span>
                            <div class="tree-actions">
                                <button class="tree-action-btn" onclick="event.stopPropagation(); projectManagerWindow.showProjectContextMenu(event, '${safeProjectIdJs}')" title="More options">⋯</button>
                            </div>
                        </div>
                `;

        // Show the project content (if the project is selected and expanded)
        if (isActive && isExpanded && project.folders) {
          html += '<div class="tree-children">';
          html += this.renderFolderTree(project.folders, project.files, 1);
          html += '</div>';
        }

        html += '</div>';
      });
    }

    projectTree.innerHTML = html;
  }

  /**
   * Render the folder-tree structure
   */
  renderFolderTree(folders, files, level = 0) {
    let html = '';
    // Determine the indentation size based on the current mode - greatly reduced
    let baseIndent = 8; // reduced to 8px (about half an icon width)
    if (this.ultraCompactMode) {
      baseIndent = 4;
    } else if (this.compactTreeMode) {
      baseIndent = 6;
    }
    const indent = level * baseIndent;

    // Render folders first
    folders.forEach(folder => {
      const isCurrentPath = this.arraysEqual(this.currentPath, folder.path);
      const folderId = folder.path.join('/');
      const isExpanded = this.expandedFolders && this.expandedFolders.has(folderId);

      // Get the files under this folder
      const folderFiles = files.filter(file => file.folder && this.arraysEqual(file.folder, folder.path));

      // Get the subfolders under this folder
      const subFolders = folders.filter(
        f => f.path.length === folder.path.length + 1 && this.arraysEqual(f.path.slice(0, -1), folder.path)
      );

      const hasChildren = folderFiles.length > 0 || subFolders.length > 0;

      // Combined icon: expand state + folder icon
      let combinedIcon = folder.icon || '📁';
      if (hasChildren) {
        combinedIcon = isExpanded ? '📂' : '📁';
      }

      // Folder paths/names and file ids/names are user-controlled strings.
      // JSON payloads embedded in attributes are HTML-escaped; ids embedded
      // in inline handler strings get JS-string + HTML escaping.
      const folderPathJson = ProjectUtils.escapeHtml(JSON.stringify(folder.path));
      const safeFolderIdJs = ProjectUtils.escapeHtml(ProjectUtils.escapeJsString(folderId));
      const safeFolderName = ProjectUtils.escapeHtml(folder.name);

      html += `
                <div class="tree-item folder ${isCurrentPath ? 'active' : ''}" 
                     style="margin-left: ${indent}px;"
                     data-folder-path="${folderPathJson}">
                    <div class="tree-item-content">
                        <div class="tree-icon tree-main-icon" onclick="event.stopPropagation(); projectManagerWindow.toggleFolderExpansion('${safeFolderIdJs}', ${folderPathJson})"
                             style="cursor: ${hasChildren ? 'pointer' : 'default'};">
                            ${combinedIcon}
                        </div>
                        <span class="tree-label" onclick="${this.isCompactMode ? `projectManagerWindow.toggleFolderExpansion('${safeFolderIdJs}', ${folderPathJson})` : `projectManagerWindow.navigateToFolder(${folderPathJson})`}">${safeFolderName}</span>
                        <div class="tree-file-count">${folderFiles.length}</div>
                        <div class="tree-actions">
                            <button class="tree-action-btn" onclick="event.stopPropagation(); projectManagerWindow.showFolderContextMenu(event, ${folderPathJson})" title="More options">⋯</button>
                        </div>
                    </div>
            `;

      // If the folder is expanded, show its contents
      if (isExpanded && hasChildren) {
        html += '<div class="tree-children">';

        // Show subfolders
        if (subFolders.length > 0) {
          html += this.renderFolderTree(subFolders, files, level + 1);
        }

        // Show files
        folderFiles.forEach(file => {
          const fileType = this.detectFileType(file.name);
          const typeConfig = this.fileTypes[fileType] || { icon: '📄', color: 'var(--pm-text-secondary)' };
          const isSelected = this.selectedFiles && this.selectedFiles.has(file.id);
          const fileIndent = (level + 1) * baseIndent;

          // Dynamically adjust the file icon size
          let iconSize = '14px'; // slightly smaller icon
          let fontSize = '7px';
          if (this.ultraCompactMode) {
            iconSize = '10px';
            fontSize = '6px';
          } else if (this.compactTreeMode) {
            iconSize = '12px';
            fontSize = '6px';
          }

          const safeFileId = ProjectUtils.escapeHtml(file.id);
          const safeFileIdJs = ProjectUtils.escapeHtml(ProjectUtils.escapeJsString(file.id));
          const safeFileName = ProjectUtils.escapeHtml(file.name);
          const displayName = ProjectUtils.escapeHtml(this.getDisplayFileName(file));

          html += `
                        <div class="tree-item file ${isSelected ? 'selected' : ''}" 
                             style="margin-left: ${fileIndent}px;"
                             data-file-id="${safeFileId}">
                            <div class="tree-item-content" 
                                 onclick="projectManagerWindow.selectFile('${safeFileIdJs}', event.ctrlKey || event.metaKey)"
                                 ondblclick="projectManagerWindow.openFileInMainWindow('${safeFileIdJs}')">
                                <div class="tree-icon file-icon" style="background-color: ${typeConfig.color}; color: var(--pm-on-accent); font-size: ${fontSize}; width: ${iconSize}; height: ${iconSize}; border-radius: 3px; display: flex; align-items: center; justify-content: center;">${typeConfig.icon}</div>
                                <span class="tree-label" title="${safeFileName}">${displayName}</span>
                                <div class="tree-file-size">${this.formatFileSize(file.size || 0)}</div>
                                <div class="tree-actions">
                                    <button class="tree-action-btn" onclick="event.stopPropagation(); projectManagerWindow.showFilePreview('${safeFileIdJs}')" title="Preview">👁️</button>
                                </div>
                            </div>
                        </div>
                    `;
        });

        html += '</div>';
      }

      html += '</div>';
    });

    return html;
  }

  /**
   * Toggle the project expand state
   */
  toggleProjectExpansion(projectId) {
    if (!this.expandedProjects) {
      this.expandedProjects = new Set();
    }

    if (this.expandedProjects.has(projectId)) {
      this.expandedProjects.delete(projectId);
    } else {
      this.expandedProjects.add(projectId);
    }

    this.renderProjectTree();
  }

  /**
   * Toggle the folder expand state
   * In Simple Mode, clicking a folder automatically expands it and shows the files in the tree
   */
  toggleFolderExpansion(folderId, folderPath = null) {
    if (!this.expandedFolders) {
      this.expandedFolders = new Set();
    }

    if (this.expandedFolders.has(folderId)) {
      this.expandedFolders.delete(folderId);
    } else {
      this.expandedFolders.add(folderId);

      // In Simple Mode, navigate to the folder when expanding it
      if (this.isCompactMode && folderPath) {
        this.currentPath = folderPath;
        this.renderProjectContent();
        this.updateContentTitle();
      }
    }

    this.renderProjectTree();
  }

  /**
   * Auto-expand when a project is selected
   */
  selectProject(projectId) {
    this.currentProject = this.projects.get(projectId);
    this.currentPath = [];

    if (this.currentProject) {
      // Normalize older projects that may lack the metadata container
      ProjectUtils.normalizeProject(this.currentProject);
      this.currentProject.metadata.lastOpened = new Date().toISOString();

      // Add to recent projects
      this.addToRecentProjects(projectId);

      // Notify the rest of the app (main window, downloaders) about the
      // newly active project
      this.notifyProjectChange(this.currentProject);

      // Auto-expand the selected project
      if (!this.expandedProjects) {
        this.expandedProjects = new Set();
      }
      this.expandedProjects.add(projectId);

      // Update the UI
      this.renderProjectContent();
      this.updateActiveTreeItem(projectId);
      this.updateContentTitle();

      // Show the project content
      const overviewEl = document.getElementById('projectOverview');
      const contentEl = document.getElementById('projectContent');
      if (overviewEl) overviewEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'block';

      this.updateStatusBar(`Opened: ${this.currentProject.name}`);
      this.saveProjects(); // save the last-opened time

      // Update the details panel
      this.updateDetailsPanel();

      // Auto-refresh the Projects & Workspaces display
      this.autoRefreshProjectsAndWorkspaces();
    }
  }

  /**
   * Enhanced subfolder-creation feature
   */
  createSubfolderInPath(parentPath = null) {
    if (!this.currentProject) {
      this.showNotification('Please select a project first', 'warning');
      return;
    }

    const basePath = parentPath || this.currentPath;
    const folderName = prompt(`Enter new subfolder name${basePath.length > 0 ? ` in ${basePath.join('/')}` : ''}:`);

    if (!folderName || !folderName.trim()) return;

    // Create proper folder path
    const newPath = [...basePath, folderName.trim().toLowerCase()];

    const folder = {
      name: folderName.trim(),
      icon: '📁',
      path: newPath,
      files: [],
      created: new Date().toISOString(),
      custom: true,
      parent: basePath.length > 0 ? basePath : null,
    };

    // Check if folder already exists
    const existingFolder = this.currentProject.folders.find(f => this.arraysEqual(f.path, newPath));

    if (existingFolder) {
      this.showNotification(`Folder "${folderName}" already exists at this location`, 'warning');
      return;
    }

    this.currentProject.folders.push(folder);
    this.currentProject.modified = new Date().toISOString();

    // Auto-expand the parent folder
    if (basePath.length > 0) {
      if (!this.expandedFolders) {
        this.expandedFolders = new Set();
      }
      this.expandedFolders.add(basePath.join('/'));
    }

    // Add to project history
    if (!this.currentProject.history) {
      this.currentProject.history = [];
    }
    this.currentProject.history.unshift({
      timestamp: new Date().toISOString(),
      action: 'subfolder-created',
      description: `Created subfolder "${folderName}" in ${basePath.length > 0 ? basePath.join('/') : 'root'}`,
    });

    this.saveProjects();

    // Also save as XML if possible to ensure persistence (auto-save without dialog)
    if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
      this.saveProjectAsXML(true);
    }

    this.renderProjectTree();
    this.showNotification(`Subfolder "${folderName}" created successfully`, 'success');

    console.log(`📁 Created subfolder: ${folderName} at path: ${newPath.join('/')}`);
  }

  /**
   * Context-menu-related methods
   */
  showProjectContextMenu(event, projectId) {
    event.preventDefault();
    this.currentContextProjectId = projectId;
    const menu = document.getElementById('projectContextMenu');
    this.showContextMenu(menu, event);
  }

  showFolderContextMenu(event, folderPath) {
    event.preventDefault();
    this.currentContextFolderPath = folderPath;
    const menu = document.getElementById('folderContextMenu');
    this.showContextMenu(menu, event);
  }

  showContextMenu(menu, event) {
    if (!menu) return;

    // Hide all context menus
    document.querySelectorAll('.context-menu').forEach(m => (m.style.display = 'none'));

    // Show the specified menu
    menu.style.display = 'block';
    menu.style.left = event.clientX + 10 + 'px';
    menu.style.top = event.clientY + 10 + 'px';

    // Ensure the menu stays within the viewport
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      menu.style.left = event.clientX - rect.width + 'px';
    }
    if (rect.bottom > window.innerHeight) {
      menu.style.top = event.clientY - rect.height + 'px';
    }
  }

  hideContextMenus() {
    document.querySelectorAll('.context-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  }

  /**
   * Enhanced addSubfolder method
   */

  navigateToFolder(path) {
    this.currentPath = path;
    this.renderProjectContent();
    this.updateActiveTreeItem();
    this.updateContentTitle();
  }

  renderProjectContent() {
    const projectOverview = document.getElementById('projectOverview');
    const projectContent = document.getElementById('projectContent');

    if (!this.currentProject) {
      if (projectOverview) projectOverview.style.display = 'block';
      if (projectContent) projectContent.style.display = 'none';
      return;
    }

    if (projectOverview) projectOverview.style.display = 'none';
    if (projectContent) projectContent.style.display = 'block';

    this.renderProjectStats();
    this.renderFiles(); // Use renderFiles to support different view modes
    this.updateContentTitle();
  }

  renderProjectStats() {
    const statsElement = document.getElementById('projectStats');
    if (!statsElement || !this.currentProject) return;

    const currentFiles = this.getCurrentFolderFiles();
    const totalSize = this.currentProject.files.reduce((sum, file) => sum + (file.size || 0), 0);

    statsElement.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${currentFiles.length}</div>
                <div class="stat-label">Files in Folder</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.currentProject.files.length}</div>
                <div class="stat-label">Total Files</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.formatFileSize(totalSize)}</div>
                <div class="stat-label">Total Size</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${this.currentProject.folders.length}</div>
                <div class="stat-label">Folders</div>
            </div>
        `;
  }

  renderFileGrid() {
    this.hideAllViews(); // Hide other views first
    const container = document.getElementById('fileGrid');
    if (!container) return;

    container.style.display = 'grid'; // Ensure grid is visible

    const files = this.getCurrentFolderFiles();
    const filteredFiles = this.filterFiles(files);

    if (filteredFiles.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <h3>No files found</h3>
                    <p>Add files to your project or try a different search term</p>
                    ${this.currentProject ? '<button class="btn btn-primary" onclick="projectManagerWindow.addFiles()">Add Files</button>' : ''}
                </div>
            `;
      return;
    }

    // Use virtual scrolling for better performance with large file lists
    if (filteredFiles.length > 100) {
      this.renderVirtualFileGrid(container, filteredFiles);
    } else {
      this.renderFullFileGrid(container, filteredFiles);
    }
  }

  renderFullFileGrid(container, filteredFiles) {
    container.innerHTML = filteredFiles
      .map(file => {
        return this.generateFileCardHTML(file);
      })
      .join('');

    this.updateFileCountDisplay(filteredFiles.length);
  }

  /**
   * Render a large file list with virtual scrolling
   * @param {HTMLElement} container - the container element
   * @param {Array} filteredFiles - the filtered file list
   */
  renderVirtualFileGrid(container, filteredFiles) {
    // Measure the real grid geometry. The previous implementation assumed a
    // single column of 120px rows, which made the scrollable area several
    // times too tall for a multi-column grid.
    const geometry = this.measureGridGeometry(container, filteredFiles);
    if (!geometry) {
      // Container not measurable (e.g. hidden) — fall back to plain rendering
      this.renderFullFileGrid(container, filteredFiles);
      return;
    }

    this.virtualScrolling = {
      columns: geometry.columns,
      rowHeight: geometry.rowHeight,
      scrollTop: 0,
      startIndex: 0,
      endIndex: 0,
      totalItems: filteredFiles.length,
    };

    // Calculate the visible range
    this.updateVirtualScrollRange(container);

    const totalRows = Math.ceil(filteredFiles.length / geometry.columns);

    // Create the virtual-scroll container structure
    const virtualContainer = document.createElement('div');
    virtualContainer.className = 'virtual-scroll-container';
    virtualContainer.style.cssText = `
            height: 100%;
            overflow-y: auto;
            position: relative;
        `;

    // Create the content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'virtual-content-wrapper';
    contentWrapper.style.cssText = `
            height: ${totalRows * geometry.rowHeight}px;
            position: relative;
        `;

    // Create the visible-items container (a grid itself, so cards keep the
    // same multi-column layout as the plain grid)
    const visibleContainer = document.createElement('div');
    visibleContainer.className = 'virtual-visible-container';
    visibleContainer.style.cssText = `
            position: absolute;
            top: ${Math.floor(this.virtualScrolling.startIndex / geometry.columns) * geometry.rowHeight}px;
            width: 100%;
            display: grid;
            grid-template-columns: ${geometry.gridTemplateColumns};
            gap: ${geometry.gap};
        `;

    // Render the visible items
    const visibleFiles = filteredFiles.slice(this.virtualScrolling.startIndex, this.virtualScrolling.endIndex);

    visibleContainer.innerHTML = visibleFiles
      .map(file => {
        return this.generateFileCardHTML(file);
      })
      .join('');

    // Assemble the virtual-scroll structure
    contentWrapper.appendChild(visibleContainer);
    virtualContainer.appendChild(contentWrapper);

    // Add the scroll event listener
    virtualContainer.addEventListener('scroll', e => {
      this.handleVirtualScroll(e, container, filteredFiles);
    });

    // Clear the container and add the virtual-scroll structure
    container.innerHTML = '';
    container.appendChild(virtualContainer);

    this.updateFileCountDisplay(filteredFiles.length);
  }

  /**
   * Measure the grid's column count, row height and gap. Returns null when
   * the container is not laid out (zero size) so callers can fall back.
   */
  measureGridGeometry(container, files) {
    if (!container || !container.isConnected || container.clientHeight === 0 || container.clientWidth === 0) {
      return null;
    }

    const computed = window.getComputedStyle(container);
    const gridTemplateColumns = computed.gridTemplateColumns || 'none';
    const columns =
      gridTemplateColumns === 'none' ? 1 : gridTemplateColumns.split(' ').filter(track => track !== '').length || 1;
    const gap = parseFloat(computed.rowGap) || 0;

    // Probe the real card height with an offscreen sample card
    let cardHeight = 0;
    if (files.length > 0) {
      const probe = document.createElement('div');
      probe.style.cssText = 'visibility: hidden; position: absolute; pointer-events: none; width: 100%;';
      probe.innerHTML = this.generateFileCardHTML(files[0]);
      container.appendChild(probe);
      const card = probe.firstElementChild;
      if (card) {
        cardHeight = card.getBoundingClientRect().height;
      }
      probe.remove();
    }

    return {
      columns,
      rowHeight: (cardHeight > 0 ? cardHeight : 120) + gap,
      gap: computed.rowGap || '0px',
      gridTemplateColumns: gridTemplateColumns === 'none' ? '1fr' : gridTemplateColumns,
    };
  }

  /**
   * Update the virtual-scroll visible range (row-snapped for a grid layout)
   * @param {HTMLElement} container - the container element
   */
  updateVirtualScrollRange(container) {
    const vs = this.virtualScrolling;
    const containerHeight = container.clientHeight || 600;

    const startRow = Math.max(0, Math.floor(vs.scrollTop / vs.rowHeight) - 1);
    const visibleRows = Math.ceil(containerHeight / vs.rowHeight) + 2;

    vs.startIndex = startRow * vs.columns;
    vs.endIndex = Math.min(vs.totalItems, (startRow + visibleRows) * vs.columns);
  }

  /**
   * Handle the virtual-scroll event
   * @param {Event} e - the scroll event
   * @param {HTMLElement} container - the container element
   * @param {Array} filteredFiles - the file list
   */
  handleVirtualScroll(e, container, filteredFiles) {
    const scrollTop = e.target.scrollTop;

    // Throttle to avoid overly frequent re-rendering
    if (Math.abs(scrollTop - this.virtualScrolling.scrollTop) < 10) {
      return;
    }

    this.virtualScrolling.scrollTop = scrollTop;

    const oldStartIndex = this.virtualScrolling.startIndex;
    this.updateVirtualScrollRange(container);

    // Re-render when the visible range moved by at least one row
    if (Math.abs(this.virtualScrolling.startIndex - oldStartIndex) >= this.virtualScrolling.columns) {
      this.updateVirtualVisibleItems(e.target, filteredFiles);
    }
  }

  /**
   * Update the virtual-scroll visible items
   * @param {HTMLElement} scrollContainer - the scroll container
   * @param {Array} filteredFiles - the file list
   */
  updateVirtualVisibleItems(scrollContainer, filteredFiles) {
    const visibleContainer = scrollContainer.querySelector('.virtual-visible-container');
    if (!visibleContainer) return;

    const vs = this.virtualScrolling;

    // Update the container position (row-snapped)
    visibleContainer.style.top = `${Math.floor(vs.startIndex / vs.columns) * vs.rowHeight}px`;

    // Render the new visible items
    const visibleFiles = filteredFiles.slice(vs.startIndex, vs.endIndex);

    visibleContainer.innerHTML = visibleFiles
      .map(file => {
        return this.generateFileCardHTML(file);
      })
      .join('');
  }

  /**
   * Generate the file-card HTML
   * @param {Object} file - the file object
   * @returns {string} the HTML string
   */
  generateFileCardHTML(file) {
    const fileType = this.detectFileType(file.name);
    const typeConfig = this.fileTypes[fileType] || { icon: '📄', color: 'var(--pm-text-secondary)' };
    const isSelected = this.selectedFiles.has(file.id);
    const isDeleted = file.fileExists === false; // Check if file was marked as deleted

    const safeFileId = ProjectUtils.escapeHtml(file.id);
    const safeFileIdJs = ProjectUtils.escapeHtml(ProjectUtils.escapeJsString(file.id));
    const safeFileName = ProjectUtils.escapeHtml(file.name);
    const displayName = ProjectUtils.escapeHtml(this.getDisplayFileName(file));

    return `
            <div class="file-card ${isSelected ? 'selected' : ''} ${isDeleted ? 'file-deleted' : ''}" 
                 data-file-id="${safeFileId}"
                 onclick="projectManagerWindow.selectFile('${safeFileIdJs}', event.ctrlKey || event.metaKey)"
                 ondblclick="projectManagerWindow.showFilePreview('${safeFileIdJs}')"
                 oncontextmenu="projectManagerWindow.showFileContextMenu(event, '${safeFileIdJs}')">
                <div class="file-icon" style="background-color: ${isDeleted ? 'var(--pm-danger)' : typeConfig.color}">
                    ${isDeleted ? '⚠️' : typeConfig.icon}
                </div>
                <div class="file-info">
                    <div class="file-name" title="${safeFileName}${isDeleted ? ' (File not found on disk)' : ''}">
                        ${displayName}${isDeleted ? ' <span style="color: var(--pm-danger); font-size: 0.8em;">(Missing)</span>' : ''}
                    </div>
                    <div class="file-details">
                        <span class="file-size">${this.formatFileSize(file.size)}</span>
                        <span class="file-date">${this.formatDate(file.modified)}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="file-action-btn" onclick="event.stopPropagation(); projectManagerWindow.showFilePreview('${safeFileIdJs}')" title="Preview" ${isDeleted ? 'disabled' : ''}>
                        👁️
                    </button>
                    <button class="file-action-btn" onclick="event.stopPropagation(); projectManagerWindow.renameFile('${safeFileIdJs}')" title="Rename">
                        ✏️
                    </button>
                    <button class="file-action-btn" onclick="event.stopPropagation(); projectManagerWindow.deleteFile('${safeFileIdJs}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
        `;
  }

  // ====== File management features ======

  async addFiles(folderOverride = null) {
    if (!this.currentProject) {
      this.showNotification('Please select a project first', 'warning');
      return;
    }

    try {
      if (window.electronAPI && window.electronAPI.selectMultipleFiles) {
        const result = await window.electronAPI.selectMultipleFiles();
        if (result.success && !result.canceled && result.filePaths.length > 0) {
          // Stage the selection and the target folder, then let the user
          // choose copy vs. reference in the Add Files modal (confirmed via
          // processFilesWithOptions)
          this.pendingFilesToAdd = result.filePaths;
          this.pendingAddFolder = folderOverride ? [...folderOverride] : [...this.currentPath];
          this.populateAddFilesModal(result.filePaths);
          this.showModal('addFilesModal');
        }
      } else {
        // Fallback for the browser environment
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.fasta,.fa,.gff,.gtf,.vcf,.bam,.sam,.wig,.bed,.gb,.gbk';
        input.onchange = e => {
          const files = Array.from(e.target.files);
          this.processFileObjects(files);
        };
        input.click();
      }
    } catch (error) {
      console.error('Error adding files:', error);
      this.showNotification('Failed to add files', 'error');
    }
  }

  /**
   * Populate the Add Files modal with the staged selection
   */
  populateAddFilesModal(filePaths) {
    const listElement = document.getElementById('selectedFilesList');
    if (!listElement) return;

    listElement.innerHTML = filePaths
      .map(
        filePath =>
          `<div style="padding: 4px 0; border-bottom: 1px solid var(--pm-border-gray);">` +
          `📄 ${ProjectUtils.escapeHtml(ProjectUtils.getBaseName(filePath))}` +
          `<div style="font-size: 0.85em; color: var(--pm-text-secondary); word-break: break-all;">${ProjectUtils.escapeHtml(filePath)}</div>` +
          `</div>`
      )
      .join('');
  }

  /**
   * Confirm handler of the Add Files modal: add the staged files either by
   * copying them into the project data folder or by referencing them in place
   */
  async processFilesWithOptions() {
    const stagedFiles = this.pendingFilesToAdd;
    const stagedFolder = this.pendingAddFolder;
    this.pendingFilesToAdd = null;
    this.pendingAddFolder = null;
    this.closeModal('addFilesModal');

    if (!this.currentProject || !stagedFiles || stagedFiles.length === 0) {
      return;
    }

    const handlingOption = document.querySelector('input[name="fileHandling"]:checked');
    const handling = handlingOption ? handlingOption.value : 'reference';
    const targetPath = stagedFolder || this.currentPath;

    if (handling === 'copy' && window.electronAPI && window.electronAPI.copyFileToProject) {
      const copiedPaths = [];
      let failedCount = 0;
      const targetFolder = targetPath.join('/');

      for (const sourcePath of stagedFiles) {
        try {
          const copyResult = await window.electronAPI.copyFileToProject(
            sourcePath,
            this.currentProject.name,
            targetFolder
          );
          if (copyResult && copyResult.success && copyResult.newPath) {
            copiedPaths.push(copyResult.newPath);
          } else {
            failedCount++;
            console.error('Failed to copy file into project:', sourcePath, copyResult && copyResult.error);
          }
        } catch (error) {
          failedCount++;
          console.error('Failed to copy file into project:', sourcePath, error);
        }
      }

      if (copiedPaths.length > 0) {
        await this.processSelectedFiles(copiedPaths, targetPath);
      }
      if (failedCount > 0) {
        this.showNotification(`Failed to copy ${failedCount} file(s); ${copiedPaths.length} added`, 'warning');
      }
    } else {
      // Reference mode: register the files at their original location
      await this.processSelectedFiles(stagedFiles, targetPath);
    }
  }

  async processSelectedFiles(filePaths, folderOverride = null) {
    let addedCount = 0;
    ProjectUtils.normalizeProject(this.currentProject);
    const targetFolder = folderOverride ? [...folderOverride] : [...this.currentPath];

    for (const filePath of filePaths) {
      try {
        let fileInfo;
        if (window.electronAPI && window.electronAPI.getFileInfo) {
          const result = await window.electronAPI.getFileInfo(filePath);
          if (result.success) {
            fileInfo = result.info;
          }
        } else {
          // Extract basic info from the path
          const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
          fileInfo = {
            name: fileName,
            size: 0,
            modified: new Date().toISOString(),
          };
        }

        if (fileInfo) {
          const file = {
            id: this.generateId(),
            name: fileInfo.name,
            path: filePath,
            size: fileInfo.size || 0,
            type: this.detectFileType(fileInfo.name),
            folder: [...targetFolder],
            added: new Date().toISOString(),
            modified: fileInfo.modified || new Date().toISOString(),
          };

          this.currentProject.files.push(file);
          addedCount++;
        }
      } catch (error) {
        console.error('Error processing file:', filePath, error);
      }
    }

    if (addedCount > 0) {
      this.currentProject.modified = new Date().toISOString();
      this.currentProject.metadata.totalFiles = this.currentProject.files.length;

      await this.saveProjects();
      this.renderProjectContent();
      this.showNotification(`Added ${addedCount} file(s) to project`, 'success');
    }
  }

  async processFileObjects(files) {
    let addedCount = 0;
    ProjectUtils.normalizeProject(this.currentProject);

    for (const file of files) {
      const fileObj = {
        id: this.generateId(),
        name: file.name,
        path: file.name, // use the file name as the path in the browser environment
        size: file.size,
        type: this.detectFileType(file.name),
        folder: [...this.currentPath],
        added: new Date().toISOString(),
        modified: new Date(file.lastModified).toISOString(),
      };

      this.currentProject.files.push(fileObj);
      addedCount++;
    }

    if (addedCount > 0) {
      this.currentProject.modified = new Date().toISOString();
      this.currentProject.metadata.totalFiles = this.currentProject.files.length;

      await this.saveProjects();
      this.renderProjectContent();
      this.showNotification(`Added ${addedCount} file(s) to project`, 'success');
    }
  }

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

    // Also save as XML if possible to ensure persistence (auto-save without dialog)
    if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
      this.saveProjectAsXML(true);
    }

    this.renderProjectTree();
    this.showNotification(`Folder "${folderName}" created successfully`, 'success');

    console.log(`📁 Created folder: ${folderName} at path: ${newPath.join('/')}`);
  }

  async saveProjectAsXML(isAutoSave = false, forceDialog = false) {
    if (!this.currentProject) return;

    try {
      // Initialize XML handler if needed
      if (!this.xmlHandler) {
        this.xmlHandler = new ProjectXMLHandler();
      }

      // Generate XML content
      const xmlContent = this.xmlHandler.projectToXML(this.currentProject);

      if (window.electronAPI) {
        const existingPath = this.currentProject.xmlFilePath || this.currentProject.projectFilePath;

        // Save directly whenever we already know the target path — this
        // covers auto-save AND a plain manual Ctrl+S. A dialog is only shown
        // for an explicit "Save As" or when no path is known yet.
        if (!forceDialog && existingPath && window.electronAPI.saveProjectFileDirect) {
          const result = await window.electronAPI.saveProjectFileDirect(existingPath, xmlContent);

          if (result.success) {
            this.currentProject.xmlFilePath = result.filePath;
            this.currentProject.modified = new Date().toISOString();
            this.markProjectAsSaved();

            console.log(`✅ Project XML saved: ${result.filePath}`);
            if (!isAutoSave) {
              this.showNotification('Project saved successfully', 'success');
            }
            return result.filePath;
          } else {
            console.warn('Failed to save project XML directly:', result.error);
            if (isAutoSave) return null;
          }
        }

        if (window.electronAPI.saveProjectFile) {
          // Dialog save (explicit "Save As" or first-time save)
          const fileName = this.currentProject.xmlFileName || `${this.currentProject.name}.prj.GAI`;
          const result = await window.electronAPI.saveProjectFile(fileName, xmlContent);

          if (result.success) {
            this.currentProject.xmlFilePath = result.filePath;
            this.currentProject.xmlFileName = fileName;
            this.currentProject.modified = new Date().toISOString();
            this.markProjectAsSaved();

            console.log(`✅ Project XML saved: ${result.filePath}`);
            this.showNotification('Project saved successfully', 'success');
            return result.filePath;
          } else {
            console.warn('Failed to save project XML:', result.error);
          }
        }
      }
    } catch (error) {
      console.error('Error saving project as XML:', error);
      if (!isAutoSave) {
        this.showNotification(`Failed to save project: ${error.message}`, 'error');
      }
    }
    return null;
  }

  /**
   * Save current project (Ctrl+S handler)
   */
  async saveCurrentProject() {
    if (!this.currentProject) {
      this.showNotification('No project to save', 'warning');
      return;
    }

    try {
      // Update project modification time
      this.currentProject.modified = new Date().toISOString();

      // Save to localStorage
      await this.saveProjects();

      // Save to XML file (reuses the existing path when available)
      await this.saveProjectAsXML(false);

      console.log(`💾 Project saved: ${this.currentProject.name}`);
    } catch (error) {
      console.error('Error saving current project:', error);
      this.showNotification(`Failed to save project: ${error.message}`, 'error');
    }
  }

  /**
   * Save project as (for menu) — always shows the file dialog
   */
  async saveProjectAs() {
    if (!this.currentProject) {
      this.showNotification('No project to save', 'warning');
      return;
    }

    await this.saveProjectAsXML(false, true);
  }

  selectFile(fileId, ctrlKey = false) {
    if (ctrlKey) {
      if (this.selectedFiles.has(fileId)) {
        this.selectedFiles.delete(fileId);
      } else {
        this.selectedFiles.add(fileId);
      }
    } else {
      this.selectedFiles.clear();
      this.selectedFiles.add(fileId);
    }

    this.updateFileCardSelection();
    this.updateStatusBar();
    this.updateDetailsPanel();
  }

  /**
   * Select all files in the current folder view (Ctrl+A)
   */
  selectAllFiles() {
    if (!this.currentProject) {
      this.showNotification('Please select a project first', 'warning');
      return;
    }

    const visibleFiles = this.filterFiles(this.getCurrentFolderFiles());
    visibleFiles.forEach(file => this.selectedFiles.add(file.id));

    this.updateFileCardSelection();
    this.updateStatusBar();
    this.showNotification(`Selected ${visibleFiles.length} files`, 'info');
  }

  /**
   * Clear the current file selection (Escape)
   */
  clearSelection() {
    if (this.selectedFiles.size === 0) return;

    this.selectedFiles.clear();
    this.updateFileCardSelection();
    this.updateStatusBar();
  }

  /**
   * Delete the selected files from the project records (Delete key)
   */
  deleteSelectedFiles() {
    if (!this.currentProject) return;
    if (this.selectedFiles.size === 0) {
      this.showNotification('No files selected to delete', 'warning');
      return;
    }

    // Reuse the batch-delete flow (confirm dialog + record removal)
    this.batchDeleteFiles();
  }

  async openFileInMainWindow(fileId) {
    const file = this.findFileById(fileId);
    if (!file) return;

    try {
      if (window.electronAPI) {
        // Get the absolute path for file operations
        const filePath = this.getFileAbsolutePath(file);

        // First check if main window exists and its status
        const mainWindowStatus = await window.electronAPI.checkMainWindowStatus();

        if (mainWindowStatus.error && mainWindowStatus.error === 'Main window not available') {
          // No main window exists, create a new one
          console.log('No main window available, creating new window...');
          const result = await window.electronAPI.createNewMainWindow(filePath);
          if (result.success) {
            this.showNotification(`Opened "${file.name}" in new GenomeExplorer window`, 'success');
          } else {
            throw new Error(result.error);
          }
        } else if (window.electronAPI.openFileInMainWindow) {
          // Main window exists, try to open file in it
          const result = await window.electronAPI.openFileInMainWindow(filePath);
          if (result.success) {
            this.showNotification(`Opened "${file.name}" in GenomeExplorer`, 'success');
          } else {
            // If opening in existing window fails, try creating new window
            console.log('Failed to open in existing window, creating new window...');
            const newWindowResult = await window.electronAPI.createNewMainWindow(filePath);
            if (newWindowResult.success) {
              this.showNotification(`Opened "${file.name}" in new GenomeExplorer window`, 'success');
            } else {
              throw new Error(newWindowResult.error);
            }
          }
        } else {
          this.showNotification(`Would open "${file.name}" in main window`, 'info');
        }
      } else {
        this.showNotification(`Would open "${file.name}" in main window`, 'info');
      }
    } catch (error) {
      console.error('Error opening file in main window:', error);
      this.showNotification('Failed to open file in main window', 'error');
    }
  }

  // ====== Utility methods ======

  /**
   * Get the file's absolute path
   * @param {Object} file - the file object
   * @returns {string} the absolute path
   */
  getFileAbsolutePath(file) {
    if (!file || !this.currentProject) {
      return '';
    }

    // If the file has an absolute path, return it directly
    if (file.absolutePath) {
      return file.absolutePath;
    }

    // If the file path is already absolute, return it directly
    if (file.path && (file.path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(file.path))) {
      return file.path;
    }

    // If the file has a relative path, build the absolute path
    if (file.path && this.currentProject.dataFolderPath) {
      return ProjectUtils.joinPath(this.currentProject.dataFolderPath, file.path);
    }

    // Fallback: build from the cached default projects directory (populated
    // asynchronously via IPC; never from process.env, which is unavailable in
    // a context-isolated renderer)
    if (file.path && this.currentProject.name && this.defaultProjectsDir) {
      return ProjectUtils.joinPath(this.defaultProjectsDir, this.currentProject.name, file.path);
    }

    // The final fallback case
    return file.path || '';
  }

  /**
   * Get the file's project-relative path
   * @param {Object} file - the file object
   * @returns {string} the project-relative path
   */
  getFileProjectRelativePath(file) {
    if (!file) return '';

    // If there's already a project-relative path, return it directly
    if (file.path && !file.path.startsWith('/') && !file.path.includes(':\\')) {
      return file.path;
    }

    // If there's an absolute path, convert it to a relative path
    if (file.absolutePath && this.currentProject && this.currentProject.dataFolderPath) {
      // Use simple string operations instead of path.relative
      let relativePath = file.absolutePath;
      const basePath = this.currentProject.dataFolderPath;

      if (relativePath.startsWith(basePath)) {
        relativePath = relativePath.substring(basePath.length);
        // Remove the leading path separator
        if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
          relativePath = relativePath.substring(1);
        }
      }

      return relativePath.replace(/\\/g, '/');
    }

    return file.name || '';
  }

  /**
   * Normalize file-path storage
   * @param {Object} file - the file object
   * @returns {Object} the normalized file object
   */
  normalizeFilePaths(file) {
    if (!file || !this.currentProject) return file;

    const normalizedFile = { ...file };

    // Ensure there's a project-relative path
    normalizedFile.path = this.getFileProjectRelativePath(file);

    // If there's no absolute path, try to build one
    if (!normalizedFile.absolutePath && this.currentProject.dataFolderPath) {
      normalizedFile.absolutePath = ProjectUtils.joinPath(this.currentProject.dataFolderPath, normalizedFile.path);
    }

    return normalizedFile;
  }

  /**
   * Establish file relationships (e.g., paired reads files, annotation files)
   * @param {Array} files - the file array
   */
  buildFileRelationships(files) {
    if (!files || files.length === 0) return;

    this.fileRelationships.clear();

    files.forEach(file => {
      const relationships = this.detectFileRelationships(file, files);
      if (relationships.length > 0) {
        this.fileRelationships.set(file.id, relationships);
      }
    });
  }

  /**
   * Detect file relationships
   * @param {Object} file - the target file
   * @param {Array} allFiles - all files
   * @returns {Array} the list of related files
   */
  detectFileRelationships(file, allFiles) {
    const relationships = [];
    const fileName = file.name.toLowerCase();
    const baseName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension

    // Detect paired reads files (R1/R2, _1/_2) via literal token replacement
    const lowerCaseNames = new Set(allFiles.map(f => f.name.toLowerCase()));
    const mateName = ProjectUtils.findPairedReadName(file.name, lowerCaseNames);
    if (mateName) {
      const pair = allFiles.find(f => f.name.toLowerCase() === mateName.toLowerCase());
      if (pair && pair.id !== file.id) {
        relationships.push({ type: 'paired_reads', file: pair });
      }
    }

    // Detect annotation-file relationships (same name, different extension)
    const annotationExtensions = ['.gff', '.gff3', '.gtf', '.bed', '.vcf'];
    const genomeExtensions = ['.fasta', '.fa', '.fas', '.gb', '.gbk'];

    if (genomeExtensions.some(ext => fileName.endsWith(ext))) {
      annotationExtensions.forEach(ext => {
        const annotationFile = allFiles.find(
          f => f.name.toLowerCase().startsWith(baseName) && f.name.toLowerCase().endsWith(ext)
        );
        if (annotationFile) {
          relationships.push({ type: 'annotation', file: annotationFile });
        }
      });
    }

    // Detect index-file relationships
    const indexFile = allFiles.find(
      f =>
        f.name.toLowerCase() === fileName + '.fai' ||
        f.name.toLowerCase() === fileName + '.bai' ||
        f.name.toLowerCase() === fileName + '.idx'
    );
    if (indexFile) {
      relationships.push({ type: 'index', file: indexFile });
    }

    return relationships;
  }

  /**
   * Smart file classification
   * @param {Array} files - the file array
   * @returns {Object} the classification result
   */
  smartFileClassification(files) {
    const classification = {
      genomes: [],
      annotations: [],
      variants: [],
      reads: [],
      analysis: [],
      others: [],
    };

    files.forEach(file => {
      const fileName = file.name.toLowerCase();
      const fileType = file.type;

      // Genome files
      if (
        fileType === 'fasta' ||
        fileType === 'genbank' ||
        fileName.includes('genome') ||
        fileName.includes('reference')
      ) {
        classification.genomes.push(file);
      }
      // Annotation files
      else if (
        fileType === 'gff' ||
        fileType === 'bed' ||
        fileName.includes('annotation') ||
        fileName.includes('gene')
      ) {
        classification.annotations.push(file);
      }
      // Variant files
      else if (
        fileType === 'vcf' ||
        fileName.includes('variant') ||
        fileName.includes('snp') ||
        fileName.includes('indel')
      ) {
        classification.variants.push(file);
      }
      // Sequencing data
      else if (
        fileType === 'fastq' ||
        fileType === 'bam' ||
        fileType === 'sam' ||
        fileName.includes('read') ||
        fileName.includes('seq')
      ) {
        classification.reads.push(file);
      }
      // Analysis results
      else if (
        fileName.includes('result') ||
        fileName.includes('output') ||
        fileName.includes('analysis') ||
        fileName.includes('report')
      ) {
        classification.analysis.push(file);
      }
      // Other
      else {
        classification.others.push(file);
      }
    });

    return classification;
  }

  /**
   * Build the search index
   * @param {Array} files - the file array
   */
  buildSearchIndex(files) {
    this.searchIndex.clear();

    files.forEach(file => {
      const searchTerms = [
        file.name.toLowerCase(),
        file.type,
        ...(file.tags || []),
        ...(file.folder || []),
        file.path.toLowerCase(),
      ];

      // Add metadata search items
      if (file.metadata) {
        Object.values(file.metadata).forEach(value => {
          if (typeof value === 'string') {
            searchTerms.push(value.toLowerCase());
          }
        });
      }

      searchTerms.forEach(term => {
        if (!this.searchIndex.has(term)) {
          this.searchIndex.set(term, new Set());
        }
        this.searchIndex.get(term).add(file.id);
      });
    });
  }

  /**
   * Advanced search
   * @param {string} query - the search query
   * @returns {Array} the matching files
   */
  advancedSearch(query) {
    if (!query || query.trim() === '') return [];

    const searchTerms = query.toLowerCase().split(/\s+/);
    const matchingFileIds = new Set();

    searchTerms.forEach(term => {
      // Exact match
      if (this.searchIndex.has(term)) {
        this.searchIndex.get(term).forEach(fileId => matchingFileIds.add(fileId));
      }

      // Fuzzy match
      this.searchIndex.forEach((fileIds, indexTerm) => {
        if (indexTerm.includes(term)) {
          fileIds.forEach(fileId => matchingFileIds.add(fileId));
        }
      });
    });

    // Return the matching file objects
    return Array.from(matchingFileIds)
      .map(fileId => this.findFileById(fileId))
      .filter(file => file !== null);
  }

  getCurrentFolderFiles() {
    if (!this.currentProject) return [];

    return this.currentProject.files.filter(file => {
      if (this.currentPath.length === 0) {
        return !file.folder || file.folder.length === 0;
      }
      return file.folder && this.arraysEqual(file.folder, this.currentPath);
    });
  }

  filterFiles(files) {
    let result = files;

    // Honor the "show hidden files" toggle (dotfiles are hidden by default)
    if (!this.showHiddenFiles) {
      result = result.filter(file => !file.name.startsWith('.'));
    }

    if (this.searchTerm) {
      result = result.filter(file => file.name.toLowerCase().includes(this.searchTerm));
    }

    return this.sortFiles(result);
  }

  /**
   * Sort a file list according to the current sortBy setting
   * (the Sort menu previously stored the choice but never applied it)
   */
  sortFiles(files) {
    const sorted = [...files];
    const getTime = file => {
      const t = new Date(file.modified || file.added || file.created || 0).getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    switch (this.sortBy) {
      case 'size':
        sorted.sort((a, b) => (b.size || 0) - (a.size || 0));
        break;
      case 'type':
        sorted.sort((a, b) => (a.type || '').localeCompare(b.type || '') || a.name.localeCompare(b.name));
        break;
      case 'modified': // menu sends 'modified'
      case 'date':
        sorted.sort((a, b) => getTime(b) - getTime(a));
        break;
      case 'name':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }

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

  updateContentTitle() {
    const titleElement = document.getElementById('contentTitle');
    if (!titleElement || !this.currentProject) return;

    let title = this.currentProject.name;
    if (this.currentPath.length > 0) {
      title += ' / ' + this.currentPath.join(' / ');
    }

    titleElement.textContent = title;
  }

  updateActiveTreeItem(projectId = null) {
    const treeItems = document.querySelectorAll('.tree-item');
    treeItems.forEach(item => item.classList.remove('active'));

    if (projectId) {
      const activeItem = document.querySelector(`[data-project-id="${projectId}"]`);
      if (activeItem) activeItem.classList.add('active');
    }
  }

  updateStatusBar(message = 'Ready') {
    const statusText = document.getElementById('statusText');
    if (statusText) statusText.textContent = message;

    this.updateFileCountDisplay();
  }

  updateFileCountDisplay(count = null) {
    const fileCountElement = document.getElementById('fileCount');
    if (!fileCountElement) return;

    if (count === null && this.currentProject) {
      count = this.getCurrentFolderFiles().length;
    }

    let text = `${count || 0} items`;
    if (this.selectedFiles.size > 0) {
      text += ` (${this.selectedFiles.size} selected)`;
    }

    fileCountElement.textContent = text;
  }

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

  showSettings() {
    this.showNotification('Settings feature coming soon', 'info');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // ====== Data persistence ======

  async saveProjects() {
    try {
      const projectsData = {
        projects: Object.fromEntries(this.projects),
        recentProjects: this.recentProjects,
        lastSaved: new Date().toISOString(),
      };

      if (window.electronAPI && window.electronAPI.saveProjectsData) {
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
    }
  }

  async loadProjects() {
    try {
      let projectsData = null;

      if (window.electronAPI && window.electronAPI.loadProjectsData) {
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

      if (projectsData && projectsData.projects) {
        this.projects = new Map(Object.entries(projectsData.projects));
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

  // ====== Utility functions (delegating to the shared ProjectUtils module) ======

  generateId() {
    return ProjectUtils.generateId('pmw');
  }

  detectFileType(fileName) {
    return ProjectUtils.detectFileType(fileName);
  }

  formatFileSize(bytes) {
    return ProjectUtils.formatFileSize(bytes);
  }

  formatDate(dateString) {
    return ProjectUtils.formatDate(dateString);
  }

  /**
   * Display name honoring the "show file extensions" view toggle
   */
  getDisplayFileName(file) {
    if (this.showFileExtensions) return file.name;
    const ext = ProjectUtils.getExtension(file.name);
    return ext ? file.name.slice(0, file.name.length - ext.length) : file.name;
  }

  arraysEqual(a, b) {
    return a.length === b.length && a.every((val, i) => val === b[i]);
  }

  findFileById(fileId) {
    if (!this.currentProject) return null;
    return this.currentProject.files.find(f => f.id === fileId);
  }

  showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Simple notification implementation
    const notification = document.createElement('div');
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? 'var(--pm-danger)' : type === 'success' ? 'var(--pm-success)' : 'var(--pm-active)'};
            color: var(--pm-on-accent);
            border-radius: 6px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-size: 14px;
            max-width: 300px;
        `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * Auto-refresh the Projects & Workspaces display
   */
  autoRefreshProjectsAndWorkspaces() {
    console.log('🔄 Auto-refreshing Projects & Workspaces...');

    // Refresh the project tree view
    this.renderProjectTree();

    // If a project is currently selected, refresh its content too
    if (this.currentProject) {
      this.renderProjectContent();
    }

    // Update the status bar
    const projectCount = this.projects.size;
    const activeProjectName = this.currentProject ? this.currentProject.name : 'None';
    this.updateStatusBar(`Refreshed: ${projectCount} projects | Active: ${activeProjectName}`);

    // Notify the user that the refresh is complete
    console.log('✅ Projects & Workspaces refreshed successfully');

    // Restore the normal status bar after 3 seconds
    setTimeout(() => {
      if (this.currentProject) {
        this.updateStatusBar(`Opened: ${this.currentProject.name}`);
      } else {
        this.updateStatusBar('Ready');
      }
    }, 3000);
  }

  /**
   * Manual refresh-button feature
   */
  async manualRefreshProjects() {
    await this.loadProjects();

    // If a project is currently open, scan its folder for new files
    if (this.currentProject && this.currentProject.location) {
      // Check file existence for all files
      await this.checkFilesExistence();

      // Then scan for new files
      await this.scanAndAddNewFiles();
    }

    this.autoRefreshProjectsAndWorkspaces();
    this.showNotification('Projects refreshed manually', 'success');
  }

  /**
   * Check if files exist on disk and mark missing ones
   */
  async checkFilesExistence() {
    if (!this.currentProject || !this.currentProject.files) {
      return;
    }

    if (!window.electronAPI || (!window.electronAPI.checkFilesExist && !window.electronAPI.checkFileExists)) {
      console.warn('File existence check API not available');
      return;
    }

    // Resolve every path up front
    const entries = this.currentProject.files.map(file => ({
      file,
      path: this.getFileAbsolutePath(file),
    }));

    let missingCount = 0;

    if (window.electronAPI.checkFilesExist) {
      // Batch path: a single IPC round trip for the whole file list
      const paths = entries.filter(e => e.path).map(e => e.path);
      entries.forEach(e => {
        if (!e.path) {
          e.file.fileExists = false;
          missingCount++;
        }
      });

      try {
        const result = await window.electronAPI.checkFilesExist(paths);
        if (result.success) {
          entries.forEach(e => {
            if (!e.path) return;
            e.file.fileExists = result.results[e.path] === true;
            if (!e.file.fileExists) missingCount++;
          });
        } else {
          throw new Error(result.error || 'Batch existence check failed');
        }
      } catch (error) {
        console.error('Batch file existence check failed:', error);
        entries.forEach(e => {
          if (e.path && e.file.fileExists === undefined) {
            e.file.fileExists = false;
            missingCount++;
          }
        });
      }
    } else {
      // Fallback: sequential per-file checks (older preload)
      for (const { file, path: filePath } of entries) {
        if (!filePath) {
          file.fileExists = false;
          missingCount++;
          continue;
        }

        try {
          const result = await window.electronAPI.checkFileExists(filePath);
          file.fileExists = result.exists;
          if (!result.exists) {
            missingCount++;
          }
        } catch (error) {
          console.error(`Error checking file: ${file.name}`, error);
          file.fileExists = false;
          missingCount++;
        }
      }
    }

    if (missingCount > 0) {
      this.showNotification(`Warning: ${missingCount} file(s) not found on disk (marked in red)`, 'warning');
    }
  }

  /**
   * Scan the project folder and add new files and folders
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
            file.id = this.generateId();

            // Add metadata to indicate it was auto-discovered
            if (!file.metadata) {
              file.metadata = {};
            }
            file.metadata.autoDiscovered = true;
            file.metadata.discoveredDate = new Date().toISOString();

            // Normalize file paths to ensure consistent storage
            const normalizedFile = this.normalizeFilePaths(file);

            this.currentProject.files.push(normalizedFile);
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
          this.currentProject.metadata.totalFiles = this.currentProject.files.length;
          this.currentProject.metadata.totalSize = this.currentProject.files.reduce((sum, f) => sum + (f.size || 0), 0);
          this.projects.set(this.currentProject.id, this.currentProject);

          // Build enhanced project features
          this.buildFileRelationships(this.currentProject.files);
          this.buildSearchIndex(this.currentProject.files);

          // Mark the project as modified so the save button saves to the .prj.GAI file
          this.markProjectAsModified();

          // Save changes to both localStorage and XML
          await this.saveProjects();

          // Auto-save as XML to ensure persistence (without showing dialog)
          if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
            await this.saveProjectAsXML(true); // Pass true to indicate auto-save
          }

          // Update UI
          this.renderProjectTree();
          this.renderProjectContent();

          // Show smart classification summary
          const classification = this.smartFileClassification(this.currentProject.files);
          const classificationSummary = Object.entries(classification)
            .filter(([_, files]) => files.length > 0)
            .map(([category, files]) => `${category}: ${files.length}`)
            .join(', ');

          if (classificationSummary) {
            console.log(`📊 Smart Classification: ${classificationSummary}`);
          }

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

  // ====== Menu-system feature implementation ======

  // ==================== FILE MENU METHODS ====================

  async exportProjectAsXML() {
    if (!this.currentProject) {
      this.showNotification('No project to export', 'warning');
      return;
    }
    await this.saveProjectAsXML();
  }

  async exportProjectAsJSON() {
    if (!this.currentProject) {
      this.showNotification('No project to export', 'warning');
      return;
    }
    await this.exportCurrentProject();
  }

  /**
   * Export the current project as a JSON download
   */
  async exportCurrentProject() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    try {
      const exportData = JSON.stringify(this.currentProject, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `${this.currentProject.name}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showNotification(`Project "${this.currentProject.name}" exported as JSON`, 'success');
    } catch (error) {
      console.error('Error exporting project as JSON:', error);
      this.showNotification('Failed to export project as JSON', 'error');
    }
  }

  async importFiles(filePaths) {
    if (!this.currentProject) {
      this.showNotification('Please select a project first', 'warning');
      return;
    }

    try {
      await this.processSelectedFiles(filePaths);
      this.showNotification(`Imported ${filePaths.length} files`, 'success');
    } catch (error) {
      console.error('Error importing files:', error);
      this.showNotification('Failed to import some files', 'error');
    }
  }

  // ==================== EDIT MENU METHODS ====================

  cutSelectedFiles() {
    if (this.selectedFiles.size === 0) {
      this.showNotification('No files selected to cut', 'warning');
      return;
    }

    this.clipboard = {
      operation: 'cut',
      files: Array.from(this.selectedFiles)
        .map(id => this.findFileById(id))
        .filter(f => f),
    };

    this.showNotification(`Cut ${this.clipboard.files.length} files`, 'info');
  }

  copySelectedFiles() {
    if (this.selectedFiles.size === 0) {
      this.showNotification('No files selected to copy', 'warning');
      return;
    }

    this.clipboard = {
      operation: 'copy',
      files: Array.from(this.selectedFiles)
        .map(id => this.findFileById(id))
        .filter(f => f),
    };

    this.showNotification(`Copied ${this.clipboard.files.length} files`, 'info');
  }

  pasteFiles() {
    if (!this.clipboard || !this.clipboard.files || this.clipboard.files.length === 0) {
      this.showNotification('No files in clipboard to paste', 'warning');
      return;
    }

    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    try {
      this.clipboard.files.forEach(file => {
        if (this.clipboard.operation === 'cut') {
          // Move file to current location
          file.folder = this.currentPath.slice();
        } else {
          // Copy file (duplicate)
          const newFile = { ...file };
          newFile.id = this.generateId();
          newFile.name = `Copy of ${file.name}`;
          newFile.folder = this.currentPath.slice();
          newFile.created = new Date().toISOString();
          this.currentProject.files.push(newFile);
        }
      });

      if (this.clipboard.operation === 'cut') {
        this.clipboard = null; // Clear clipboard after cut
      }

      this.markProjectAsModified();
      this.renderProjectContent();
      this.showNotification(`Pasted ${this.clipboard ? this.clipboard.files.length : 'files'}`, 'success');
    } catch (error) {
      console.error('Error pasting files:', error);
      this.showNotification('Failed to paste files', 'error');
    }
  }

  showFindDialog() {
    const searchTerm = prompt('Enter search term to find files:');
    if (searchTerm && searchTerm.trim()) {
      this.searchFiles(searchTerm.trim());
    }
  }

  showFindReplaceDialog() {
    const findTerm = prompt('Enter term to find in file names:');
    if (!findTerm || !findTerm.trim()) return;

    const replaceTerm = prompt('Enter replacement term:');
    if (replaceTerm === null) return;

    this.findAndReplaceInFileNames(findTerm.trim(), replaceTerm.trim());
  }

  searchFiles(searchTerm) {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    const matchingFiles = this.currentProject.files.filter(file =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (matchingFiles.length === 0) {
      this.showNotification(`No files found matching "${searchTerm}"`, 'info');
    } else {
      // Select matching files
      this.selectedFiles.clear();
      matchingFiles.forEach(file => this.selectedFiles.add(file.id));
      this.updateFileCardSelection();
      this.showNotification(`Found ${matchingFiles.length} files matching "${searchTerm}"`, 'success');
    }
  }

  findAndReplaceInFileNames(findTerm, replaceTerm) {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    let replacedCount = 0;
    const findPattern = new RegExp(ProjectUtils.escapeRegExp(findTerm), 'g');
    this.currentProject.files.forEach(file => {
      if (file.name.includes(findTerm)) {
        file.name = file.name.replace(findPattern, replaceTerm);
        file.modified = new Date().toISOString();
        replacedCount++;
      }
    });

    if (replacedCount > 0) {
      this.markProjectAsModified();
      this.renderProjectContent();
      this.showNotification(`Replaced "${findTerm}" with "${replaceTerm}" in ${replacedCount} file names`, 'success');
    } else {
      this.showNotification(`No files found containing "${findTerm}"`, 'info');
    }
  }

  // ==================== VIEW MENU METHODS ====================

  setSortBy(sortBy) {
    this.sortBy = sortBy;
    this.renderProjectContent();
    this.showNotification(`Sorted by ${sortBy}`, 'info');
  }

  /**
   * Set view mode (grid, list, details)
   */
  setViewMode(mode) {
    if (this.currentViewMode === mode) return;

    this.currentViewMode = mode;
    this.viewMode = mode; // For compatibility

    // Update button states
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.view-mode-btn[data-mode="${mode}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // Re-render file view
    this.renderFiles();
    this.showNotification(`Switched to ${mode} view`, 'info');
  }

  /**
   * Render files based on current view mode
   */
  renderFiles() {
    if (!this.currentProject) return;

    switch (this.currentViewMode) {
      case 'list':
        this.renderFileList();
        break;
      case 'details':
        this.renderFileDetails();
        break;
      default:
        this.hideAllViews();
        this.renderFileGrid();
        break;
    }
  }

  /**
   * Hide all view containers
   */
  hideAllViews() {
    const fileGrid = document.getElementById('fileGrid');
    const fileList = document.getElementById('fileList');
    const fileDetails = document.getElementById('fileDetails');

    if (fileGrid) fileGrid.style.display = 'none';
    if (fileList) fileList.style.display = 'none';
    if (fileDetails) fileDetails.style.display = 'none';
  }

  /**
   * Render files in list view
   */
  renderFileList() {
    this.hideAllViews();
    const fileList = document.getElementById('fileList');
    if (!fileList) return;

    fileList.style.display = 'block';

    const currentFiles = this.getCurrentFolderFiles();
    const filteredFiles = this.filterFiles(currentFiles);

    if (filteredFiles.length === 0) {
      fileList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <h3>No files found</h3>
                    <p>Add files to your project or try a different search term</p>
                    ${this.currentProject ? '<button class="btn btn-primary" onclick="projectManagerWindow.addFiles()">Add Files</button>' : ''}
                </div>
            `;
      return;
    }

    let html = '';
    filteredFiles.forEach(file => {
      const fileType = this.detectFileType(file.name);
      const typeConfig = this.fileTypes[fileType] || { icon: '📄', color: 'var(--pm-text-secondary)' };
      const isSelected = this.selectedFiles && this.selectedFiles.has(file.id);

      const safeFileId = ProjectUtils.escapeHtml(file.id);
      const safeFileIdJs = ProjectUtils.escapeHtml(ProjectUtils.escapeJsString(file.id));
      const safeFileName = ProjectUtils.escapeHtml(file.name);
      const displayName = ProjectUtils.escapeHtml(this.getDisplayFileName(file));

      html += `
                <div class="file-list-item ${isSelected ? 'selected' : ''}" 
                     draggable="true"
                     onclick="projectManagerWindow.selectFile('${safeFileIdJs}', event.ctrlKey || event.metaKey)"
                     ondblclick="projectManagerWindow.openFileInMainWindow('${safeFileIdJs}')"
                     oncontextmenu="projectManagerWindow.showFileContextMenu(event, '${safeFileIdJs}')"
                     data-file-id="${safeFileId}">
                    <div class="file-icon-small" style="background-color: ${typeConfig.color}">
                        ${typeConfig.icon}
                    </div>
                    <div class="file-name" title="${safeFileName}">${displayName}</div>
                    <div class="file-size">${this.formatFileSize(file.size || 0)}</div>
                    <div class="file-date">${file.modified ? this.formatDate(file.modified) : 'Unknown'}</div>
                    <div class="file-actions-list">
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.showFilePreview('${safeFileIdJs}')" title="Preview">👁️</button>
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.renameFile('${safeFileIdJs}')" title="Rename">✏️</button>
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.deleteFile('${safeFileIdJs}')" title="Delete">🗑️</button>
                    </div>
                </div>
            `;
    });

    fileList.innerHTML = html;
    this.updateFileCountDisplay(filteredFiles.length);
  }

  /**
   * Render files in details view
   */
  renderFileDetails() {
    this.hideAllViews();
    const fileDetails = document.getElementById('fileDetails');
    if (!fileDetails) return;

    fileDetails.style.display = 'block';

    const currentFiles = this.getCurrentFolderFiles();
    const filteredFiles = this.filterFiles(currentFiles);

    if (filteredFiles.length === 0) {
      fileDetails.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📁</div>
                    <h3>No files found</h3>
                    <p>Add files to your project or try a different search term</p>
                    ${this.currentProject ? '<button class="btn btn-primary" onclick="projectManagerWindow.addFiles()">Add Files</button>' : ''}
                </div>
            `;
      return;
    }

    let html = `
            <div class="file-details-table-container">
                <table class="file-details-table">
                    <thead>
                        <tr>
                            <th style="width: 40px;"></th>
                            <th>Name</th>
                            <th style="width: 100px;">Type</th>
                            <th style="width: 80px;">Size</th>
                            <th style="width: 120px;">Modified</th>
                            <th style="width: 150px;">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

    filteredFiles.forEach(file => {
      const fileType = this.detectFileType(file.name);
      const typeConfig = this.fileTypes[fileType] || { icon: '📄', color: 'var(--pm-text-secondary)' };
      const isSelected = this.selectedFiles && this.selectedFiles.has(file.id);
      const isDeleted = file.fileExists === false;

      const safeFileId = ProjectUtils.escapeHtml(file.id);
      const safeFileIdJs = ProjectUtils.escapeHtml(ProjectUtils.escapeJsString(file.id));
      const safeFileName = ProjectUtils.escapeHtml(file.name);
      const displayName = ProjectUtils.escapeHtml(this.getDisplayFileName(file));

      html += `
                <tr class="${isSelected ? 'selected' : ''} ${isDeleted ? 'file-deleted' : ''}"
                    draggable="true"
                    onclick="projectManagerWindow.selectFile('${safeFileIdJs}', event.ctrlKey || event.metaKey)"
                    ondblclick="projectManagerWindow.openFileInMainWindow('${safeFileIdJs}')"
                    oncontextmenu="projectManagerWindow.showFileContextMenu(event, '${safeFileIdJs}')"
                    data-file-id="${safeFileId}">
                    <td>
                        <div class="file-icon-small" style="background-color: ${isDeleted ? 'var(--pm-danger)' : typeConfig.color}">
                            ${isDeleted ? '⚠️' : typeConfig.icon}
                        </div>
                    </td>
                    <td class="file-name" title="${safeFileName}${isDeleted ? ' (File not found on disk)' : ''}">
                        ${displayName}${isDeleted ? ' <span style="color: #dc3545; font-size: 0.8em;">(Missing)</span>' : ''}
                    </td>
                    <td>${fileType.toUpperCase()}</td>
                    <td>${this.formatFileSize(file.size || 0)}</td>
                    <td>${file.modified ? this.formatDate(file.modified) : 'Unknown'}</td>
                    <td class="file-actions-details">
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.showFilePreview('${safeFileIdJs}')" title="Preview" ${isDeleted ? 'disabled' : ''}>👁️</button>
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.renameFile('${safeFileIdJs}')" title="Rename">✏️</button>
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.deleteFile('${safeFileIdJs}')" title="Delete">🗑️</button>
                    </td>
                </tr>
            `;
    });

    html += `
                </tbody>
            </table>
            </div>
        `;

    fileDetails.innerHTML = html;
    this.updateFileCountDisplay(filteredFiles.length);
  }

  toggleHiddenFiles(show) {
    this.showHiddenFiles = show;
    this.renderProjectContent();
    this.showNotification(`Hidden files ${show ? 'shown' : 'hidden'}`, 'info');
  }

  toggleFileExtensions(show) {
    this.showFileExtensions = show;
    this.renderProjectContent();
    this.showNotification(`File extensions ${show ? 'shown' : 'hidden'}`, 'info');
  }

  /**
   * Show/hide the project sidebar (F8)
   */
  toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const splitter = document.querySelector('.sidebar-splitter');
    if (!sidebar) return;

    const show = sidebar.style.display === 'none';
    sidebar.style.display = show ? '' : 'none';
    if (splitter) splitter.style.display = show ? '' : 'none';

    localStorage.setItem('projectManager_sidebarHidden', show ? 'false' : 'true');
    this.showNotification(`Sidebar ${show ? 'shown' : 'hidden'}`, 'info');
  }

  /**
   * Re-apply the persisted sidebar visibility at startup
   */
  loadSidebarPreference() {
    if (localStorage.getItem('projectManager_sidebarHidden') !== 'true') return;

    const sidebar = document.querySelector('.sidebar');
    const splitter = document.querySelector('.sidebar-splitter');
    if (sidebar) sidebar.style.display = 'none';
    if (splitter) splitter.style.display = 'none';
  }

  // ==================== PROJECT MENU METHODS ====================

  /**
   * Compute the statistics displayed by showProjectStatistics
   */
  calculateProjectStatistics() {
    const project = this.currentProject;
    const stats = {
      fileTypes: {},
      totalFiles: 0,
      totalSize: 0,
      averageFileSize: 0,
      oldestFile: null,
      newestFile: null,
      folderCount: project ? project.folders.length : 0,
      rootFiles: 0,
      folderFiles: 0,
    };
    if (!project) return stats;

    let oldestTime = null;
    let newestTime = null;

    project.files.forEach(file => {
      stats.totalFiles++;
      stats.totalSize += Number(file.size) || 0;

      const type = file.type || this.detectFileType(file.name);
      stats.fileTypes[type] = (stats.fileTypes[type] || 0) + 1;

      if (file.folder && file.folder.length > 0) {
        stats.folderFiles++;
      } else {
        stats.rootFiles++;
      }

      const timestamp = file.added || file.created || file.modified;
      const time = timestamp ? new Date(timestamp).getTime() : NaN;
      if (!Number.isNaN(time)) {
        if (oldestTime === null || time < oldestTime) {
          oldestTime = time;
          stats.oldestFile = timestamp;
        }
        if (newestTime === null || time > newestTime) {
          newestTime = time;
          stats.newestFile = timestamp;
        }
      }
    });

    stats.averageFileSize = stats.totalFiles > 0 ? Math.round(stats.totalSize / stats.totalFiles) : 0;
    return stats;
  }

  showProjectStatistics() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    const stats = this.calculateProjectStatistics();
    const statsText = `
📊 Project Statistics

📁 Files by Type:
${Object.entries(stats.fileTypes)
  .map(([type, count]) => `• ${type}: ${count}`)
  .join('\n')}

📈 Storage:
• Total Files: ${stats.totalFiles}
• Total Size: ${this.formatFileSize(stats.totalSize)}
• Average File Size: ${this.formatFileSize(stats.averageFileSize)}

📅 Timeline:
• Oldest File: ${stats.oldestFile ? this.formatDate(stats.oldestFile) : 'N/A'}
• Newest File: ${stats.newestFile ? this.formatDate(stats.newestFile) : 'N/A'}

📂 Organization:
• Folders: ${stats.folderCount}
• Files in Root: ${stats.rootFiles}
• Files in Folders: ${stats.folderFiles}
        `.trim();

    alert(statsText);
  }

  autoOrganizeFiles() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    let movedCount = 0;
    this.currentProject.files.forEach(file => {
      const fileType = this.detectFileType(file.name);
      let targetFolder = null;

      // Auto-organize by file type. Target paths MUST match the canonical
      // lowercase folder paths created with the project — a case mismatch
      // makes files disappear from every folder view.
      switch (fileType) {
        case 'fasta':
        case 'genbank':
          targetFolder = ['genomes'];
          break;
        case 'gff':
        case 'bed':
          targetFolder = ['annotations'];
          break;
        case 'vcf':
          targetFolder = ['variants'];
          break;
        case 'bam':
        case 'sam':
        case 'fastq':
          targetFolder = ['reads'];
          break;
        case 'unknown':
          return; // leave unrecognized files where they are
        default:
          targetFolder = ['analysis'];
      }

      if (targetFolder && !this.arraysEqual(file.folder || [], targetFolder)) {
        file.folder = targetFolder;
        file.modified = new Date().toISOString();
        movedCount++;
      }
    });

    if (movedCount > 0) {
      this.markProjectAsModified();
      this.renderProjectContent();
      this.showNotification(`Auto-organized ${movedCount} files by type`, 'success');
    } else {
      this.showNotification('All files are already organized', 'info');
    }
  }

  groupFilesByDate() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    // Create date-based folders and move files. Files added through the UI
    // carry `added`, not `created` — accept both and skip invalid dates
    // instead of crashing on `new Date(undefined)`.
    const dateGroups = {};
    this.currentProject.files.forEach(file => {
      const rawDate = file.added || file.created || file.modified;
      const parsed = rawDate ? new Date(rawDate) : null;
      const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString().split('T')[0] : 'undated';
      if (!dateGroups[date]) {
        dateGroups[date] = [];
      }
      dateGroups[date].push(file);
    });

    // Create folders for each date and move files
    Object.entries(dateGroups).forEach(([date, files]) => {
      const folderName = `Files_${date}`;
      const folderPath = [folderName.toLowerCase()];

      // Check if folder exists, if not create it
      if (!this.currentProject.folders.find(f => this.arraysEqual(f.path, folderPath))) {
        this.currentProject.folders.push({
          name: folderName,
          icon: '📅',
          path: folderPath,
          files: [],
          created: new Date().toISOString(),
          custom: true,
          autoGenerated: true,
        });
      }

      // Move files to date folder
      files.forEach(file => {
        file.folder = folderPath;
        file.modified = new Date().toISOString();
      });
    });

    this.markProjectAsModified();
    this.renderProjectTree();
    this.renderProjectContent();
    this.showNotification(`Grouped files into ${Object.keys(dateGroups).length} date-based folders`, 'success');
  }

  cleanEmptyFolders() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    let removedCount = 0;
    this.currentProject.folders = this.currentProject.folders.filter(folder => {
      const hasFiles = this.currentProject.files.some(file => this.arraysEqual(file.folder || [], folder.path));

      if (!hasFiles && folder.custom) {
        removedCount++;
        return false;
      }
      return true;
    });

    if (removedCount > 0) {
      this.markProjectAsModified();
      this.renderProjectTree();
      this.showNotification(`Removed ${removedCount} empty folders`, 'success');
    } else {
      this.showNotification('No empty folders found', 'info');
    }
  }

  backupProject() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    try {
      const backupData = JSON.stringify(this.currentProject, null, 2);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `${this.currentProject.name}_backup_${timestamp}.json`;

      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = backupName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification(`Project backed up as ${backupName}`, 'success');
    } catch (error) {
      console.error('Error backing up project:', error);
      this.showNotification('Failed to backup project', 'error');
    }
  }

  restoreFromBackup() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (file) {
        try {
          const reader = new FileReader();
          reader.onload = event => {
            try {
              const projectData = JSON.parse(event.target.result);
              if (!projectData || typeof projectData !== 'object' || !projectData.name) {
                throw new Error('Not a project backup file');
              }
              const newId = this.generateId();
              projectData.id = newId;
              projectData.name += ' (Restored)';
              // Older backups may lack metadata/containers — normalize first
              ProjectUtils.normalizeProject(projectData);
              projectData.metadata.lastOpened = new Date().toISOString();

              this.projects.set(newId, projectData);
              this.saveProjects();
              this.renderProjectTree();
              this.selectProject(newId);
              this.showNotification('Project restored from backup', 'success');
            } catch (error) {
              console.error('Error parsing backup file:', error);
              this.showNotification(`Invalid backup file: ${error.message}`, 'error');
            }
          };
          reader.readAsText(file);
        } catch (error) {
          console.error('Error restoring backup:', error);
          this.showNotification('Failed to restore from backup', 'error');
        }
      }
    };
    input.click();
  }

  archiveProject() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    const confirm = window.confirm(
      `Archive project "${this.currentProject.name}"?\n\n` +
        'This will:\n' +
        '• Export the project as a backup\n' +
        '• Mark it as archived\n' +
        '• Remove it from active projects list'
    );

    if (confirm) {
      // Export backup first
      this.backupProject();

      // Mark as archived and remove
      this.currentProject.archived = true;
      this.currentProject.archivedDate = new Date().toISOString();

      const projectName = this.currentProject.name;
      this.projects.delete(this.currentProject.id);
      this.saveProjects();

      this.currentProject = null;
      this.renderProjectTree();
      this.renderProjectContent();

      this.showNotification(`Project "${projectName}" archived successfully`, 'success');
    }
  }

  deleteCurrentProject() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    const confirmed = window.confirm(
      `⚠️ DELETE PROJECT "${this.currentProject.name}"?\n\n` +
        'This action cannot be undone!\n\n' +
        'This will permanently delete:\n' +
        '• All project metadata\n' +
        '• File references (actual files remain on disk)\n' +
        '• Project configuration'
    );

    if (confirmed) {
      const projectName = this.currentProject.name;
      this.projects.delete(this.currentProject.id);
      this.saveProjects();

      this.currentProject = null;
      this.renderProjectTree();
      this.renderProjectContent();

      this.showNotification(`Project "${projectName}" deleted permanently`, 'success');
    } else {
      this.showNotification('Project deletion cancelled', 'info');
    }
  }

  /**
   * Analyze the current project and show a summary
   * (wired to the "Analyze Project" button in the overview)
   */
  analyzeProject() {
    if (!this.currentProject) {
      this.showNotification('Please select a project first', 'warning');
      return;
    }

    const stats = this.calculateProjectStatistics();
    const classification = this.smartFileClassification(this.currentProject.files);

    const report = `
🔬 Project Analysis: ${this.currentProject.name}

📊 Overview:
• Total Files: ${stats.totalFiles}
• Total Size: ${this.formatFileSize(stats.totalSize)}
• Folders: ${stats.folderCount}

🧬 Content Classification:
• Genomes: ${classification.genomes.length}
• Annotations: ${classification.annotations.length}
• Variants: ${classification.variants.length}
• Reads: ${classification.reads.length}
• Analysis Results: ${classification.analysis.length}
• Others: ${classification.others.length}

📂 Organization:
• Files in Root: ${stats.rootFiles}
• Files in Folders: ${stats.folderFiles}
        `.trim();

    alert(report);
  }

  /**
   * Import a project from a file (menu: Import Project). When the menu
   * already carries a file path, load it directly; otherwise ask.
   */
  async importProject(filePath = null) {
    if (filePath) {
      await this.loadProjectFromFile(filePath);
    } else {
      await this.openProject();
    }
  }

  /**
   * Close the current project and return to the overview
   */
  closeCurrentProject() {
    if (!this.currentProject) {
      this.showNotification('No project is currently open', 'warning');
      return;
    }

    const projectName = this.currentProject.name;
    this.currentProject.isCurrentlyOpen = false;
    this.currentProject = null;
    this.currentPath = [];
    this.selectedFiles.clear();

    // Clear the app-wide active project
    if (window.electronAPI && window.electronAPI.setActiveProject) {
      window.electronAPI.setActiveProject(null).catch(error => {
        console.error('Error clearing active project:', error);
      });
    }

    this.renderProjectTree();
    this.renderProjectContent();
    this.updateSaveButtonState();
    this.updateStatusBar('Ready');
    this.showNotification(`Project "${projectName}" closed`, 'info');
  }

  // ==================== TOOLS MENU METHODS ====================

  checkFileIntegrity() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    let checkedCount = 0;
    let issuesFound = 0;
    const issues = [];

    this.currentProject.files.forEach(file => {
      checkedCount++;

      // Check for common issues
      if (!file.name || file.name.trim() === '') {
        issues.push(`File ${file.id}: Missing or empty name`);
        issuesFound++;
      }

      if (!file.type || file.type === 'unknown') {
        issues.push(`File ${file.name}: Unknown or missing file type`);
        issuesFound++;
      }

      if (!file.size || file.size < 0) {
        issues.push(`File ${file.name}: Invalid file size`);
        issuesFound++;
      }

      if (!file.created || !file.modified) {
        issues.push(`File ${file.name}: Missing timestamp information`);
        issuesFound++;
      }
    });

    if (issuesFound === 0) {
      this.showNotification(`File integrity check complete: ${checkedCount} files, no issues found`, 'success');
    } else {
      const issueReport = `
File Integrity Check Results:

Checked: ${checkedCount} files
Issues Found: ${issuesFound}

Issues:
${issues.slice(0, 10).join('\n')}
${issues.length > 10 ? `\n... and ${issues.length - 10} more issues` : ''}
            `.trim();

      alert(issueReport);
      this.showNotification(`Integrity check found ${issuesFound} issues`, 'warning');
    }
  }

  /**
   * Validate that all files of the current project still exist on disk
   * (menu: Tools → Validate Files)
   */
  async validateFiles() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    this.updateStatusBar('Validating files...');
    try {
      await this.checkFilesExistence();

      const missingFiles = this.currentProject.files.filter(file => file.fileExists === false);
      if (missingFiles.length === 0) {
        this.showNotification(`Validation complete: all ${this.currentProject.files.length} files found`, 'success');
      } else {
        const report = `
File Validation Results:

Total Files: ${this.currentProject.files.length}
Missing Files: ${missingFiles.length}

Missing:
${missingFiles
  .slice(0, 15)
  .map(file => `• ${file.name}`)
  .join('\n')}
${missingFiles.length > 15 ? `\n... and ${missingFiles.length - 15} more` : ''}
            `.trim();
        alert(report);
        this.showNotification(`Validation found ${missingFiles.length} missing file(s)`, 'warning');
      }

      this.renderProjectContent();
    } finally {
      this.updateStatusBar('Ready');
    }
  }

  /**
   * Find duplicate files (same name and size) in the current project
   * (menu: Tools → Find Duplicates)
   */
  findDuplicateFiles() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    const groups = new Map();
    this.currentProject.files.forEach(file => {
      const key = `${file.name.toLowerCase()}|${file.size || 0}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(file);
    });

    const duplicates = Array.from(groups.values()).filter(group => group.length > 1);
    if (duplicates.length === 0) {
      this.showNotification('No duplicate files found', 'success');
      return;
    }

    // Select the redundant copies so the user can act on them directly
    this.selectedFiles.clear();
    duplicates.forEach(group => group.slice(1).forEach(file => this.selectedFiles.add(file.id)));
    this.updateFileCardSelection();

    const report = `
Duplicate Files Report:

Duplicate Groups: ${duplicates.length}
Redundant Copies (now selected): ${this.selectedFiles.size}

Groups:
${duplicates
  .slice(0, 10)
  .map(group => `• ${group[0].name} (${group.length} copies, ${this.formatFileSize(group[0].size || 0)} each)`)
  .join('\n')}
${duplicates.length > 10 ? `\n... and ${duplicates.length - 10} more groups` : ''}
        `.trim();

    alert(report);
    this.showNotification(`Found ${duplicates.length} duplicate group(s); redundant copies selected`, 'warning');
  }

  showBatchRenameDialog() {
    if (!this.currentProject || this.selectedFiles.size === 0) {
      this.showNotification('Please select files to rename', 'warning');
      return;
    }

    const pattern = prompt(
      `Batch Rename ${this.selectedFiles.size} files\n\n` +
        'Enter rename pattern (use {n} for number, {name} for original name):\n' +
        'Examples:\n' +
        '• "sample_{n}.fasta" → sample_1.fasta, sample_2.fasta\n' +
        '• "processed_{name}" → processed_original_name.ext'
    );

    if (pattern && pattern.trim()) {
      this.batchRenameFiles(pattern.trim());
    }
  }

  batchRenameFiles(pattern) {
    let renamedCount = 0;
    let counter = 1;

    Array.from(this.selectedFiles).forEach(fileId => {
      const file = this.findFileById(fileId);
      if (file) {
        const originalName = file.name;
        const nameWithoutExt = originalName.split('.').slice(0, -1).join('.');
        const extension = originalName.split('.').pop();

        let newName = pattern.replace(/{n}/g, counter).replace(/{name}/g, nameWithoutExt);

        if (!newName.includes('.') && extension) {
          newName += '.' + extension;
        }

        file.name = newName;
        file.modified = new Date().toISOString();
        renamedCount++;
        counter++;
      }
    });

    if (renamedCount > 0) {
      this.markProjectAsModified();
      this.renderProjectContent();
      this.showNotification(`Batch renamed ${renamedCount} files`, 'success');
    }
  }

  showBatchMoveDialog() {
    if (!this.currentProject || this.selectedFiles.size === 0) {
      this.showNotification('Please select files to move', 'warning');
      return;
    }

    if (!this.currentProject.folders || this.currentProject.folders.length === 0) {
      this.showNotification('No folders available. Create folders first.', 'warning');
      return;
    }

    const folderOptions = this.currentProject.folders
      .map(folder => `${folder.name} (${folder.path.join('/')})`)
      .join('\n');

    const choice = prompt(
      `Batch Move ${this.selectedFiles.size} files\n\n` +
        `Available folders:\n${folderOptions}\n\n` +
        'Enter target folder name:'
    );

    if (choice && choice.trim()) {
      this.batchMoveFiles(choice.trim());
    }
  }

  batchMoveFiles(targetFolderName) {
    const targetFolder = this.currentProject.folders.find(f => f.name === targetFolderName);
    if (!targetFolder) {
      this.showNotification('Target folder not found', 'error');
      return;
    }

    let movedCount = 0;
    Array.from(this.selectedFiles).forEach(fileId => {
      const file = this.findFileById(fileId);
      if (file) {
        file.folder = targetFolder.path.slice();
        file.modified = new Date().toISOString();
        movedCount++;
      }
    });

    if (movedCount > 0) {
      this.markProjectAsModified();
      this.renderProjectContent();
      this.showNotification(`Batch moved ${movedCount} files to "${targetFolder.name}"`, 'success');
    }
  }

  batchDeleteFiles() {
    if (!this.currentProject || this.selectedFiles.size === 0) {
      this.showNotification('Please select files to delete', 'warning');
      return;
    }

    const confirm = window.confirm(
      `Delete ${this.selectedFiles.size} selected files?\n\n` + 'This action cannot be undone!'
    );

    if (confirm) {
      let deletedCount = 0;
      Array.from(this.selectedFiles).forEach(fileId => {
        const fileIndex = this.currentProject.files.findIndex(f => f.id === fileId);
        if (fileIndex !== -1) {
          this.currentProject.files.splice(fileIndex, 1);
          deletedCount++;
        }
      });

      this.selectedFiles.clear();

      if (deletedCount > 0) {
        this.markProjectAsModified();
        this.renderProjectContent();
        this.showNotification(`Batch deleted ${deletedCount} files`, 'success');
      }
    }
  }

  async openInExternalEditor() {
    if (this.selectedFiles.size === 0) {
      this.showNotification('Please select a file to open', 'warning');
      return;
    }

    const fileId = Array.from(this.selectedFiles)[0];
    const file = this.findFileById(fileId);

    if (!file) {
      this.showNotification('File not found', 'error');
      return;
    }

    const filePath = this.getFileAbsolutePath(file);
    if (!filePath) {
      this.showNotification('File path not available', 'error');
      return;
    }

    if (!window.electronAPI || !window.electronAPI.openFileInExternalEditor) {
      this.showNotification('External editor not available in browser mode', 'warning');
      return;
    }

    try {
      const result = await window.electronAPI.openFileInExternalEditor(filePath);
      if (result && result.success) {
        this.showNotification(`Opening "${file.name}" in external editor`, 'info');
      } else {
        this.showNotification(`Failed to open externally: ${(result && result.error) || 'unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error opening file in external editor:', error);
      this.showNotification('Failed to open file in external editor', 'error');
    }
  }

  async openInGenomeViewer() {
    if (this.selectedFiles.size === 0) {
      this.showNotification('Please select a file to open in Genome Viewer', 'warning');
      return;
    }

    const fileId = Array.from(this.selectedFiles)[0];
    await this.openFileInMainWindow(fileId);
  }

  openProjectInExplorer() {
    if (!this.currentProject) {
      this.showNotification('No project selected', 'warning');
      return;
    }

    const folderPath = this.currentProject.dataFolderPath || this.currentProject.location;

    if (folderPath && window.electronAPI && window.electronAPI.openFolderInExplorer) {
      window.electronAPI.openFolderInExplorer(folderPath);
      this.showNotification('Opening project folder in file explorer', 'info');
    } else {
      this.showNotification('File explorer not available or project path not set', 'warning');
    }
  }

  showPreferences() {
    const preferences = `
⚙️ Project Manager Preferences

Current Settings:
• View Mode: ${this.viewMode || 'grid'}
• Sort By: ${this.sortBy || 'name'}
• Show Hidden Files: ${this.showHiddenFiles ? 'Yes' : 'No'}
• Show File Extensions: ${this.showFileExtensions ? 'Yes' : 'No'}
• Auto-save: ${this.autoSave ? 'Enabled' : 'Disabled'}

Default Locations:
• Projects Directory: ${this.defaultProjectLocation || 'Not set'}
• Data Directory: ${this.currentProject?.dataFolderPath || 'Not set'}

Note: Full preferences dialog coming soon!
        `.trim();

    alert(preferences);
  }

  // ==================== HELP MENU METHODS ====================

  showHelp() {
    const helpContent = `
📖 Project Manager Help

🎯 Quick Start:
1. Create a new project or open an existing one
2. Import files using drag & drop or File menu
3. Organize files into folders
4. Save your project regularly

⌨️ Essential Shortcuts:
• Ctrl+N - New Project
• Ctrl+O - Open Project
• Ctrl+S - Save Project
• Ctrl+I - Import Files
• Ctrl+F - Find Files
• F5 - Refresh
• F8 - Toggle Sidebar
• Del - Delete Selected

🔧 Features:
• File Management - Add, organize, and track files
• Project Organization - Folders and metadata
• Batch Operations - Rename, move, delete multiple files
• Export/Import - Backup and share projects
• File Validation - Check integrity and find duplicates

💡 Tips:
• Right-click for context menus
• Use Ctrl+Click for multiple selection
• Drag & drop files onto the workspace to import them
• Export projects regularly for backup

For more help, visit the User Guide or report issues.
        `.trim();

    alert(helpContent);
  }

  /**
   * Open the documentation (F1) — maps to the built-in user guide
   */
  showDocumentation() {
    this.showUserGuide();
  }

  /**
   * List the keyboard shortcuts that are actually implemented
   */
  showKeyboardShortcuts() {
    const shortcuts = `
⌨️ Keyboard Shortcuts

File Operations:
• Ctrl/Cmd+N — New Project
• Ctrl/Cmd+Shift+N — New Folder
• Ctrl/Cmd+O — Open Project
• Ctrl/Cmd+S — Save Project
• Ctrl/Cmd+Shift+S — Save Project As...

Editing:
• Ctrl/Cmd+A — Select All Files (with a project open)
• Delete — Delete Selected Files
• Escape — Clear Selection

View:
• F5 — Refresh Projects
• F8 — Toggle Sidebar
• F9 — Toggle Details Panel

Help:
• F1 — Documentation
        `.trim();

    alert(shortcuts);
  }

  showUserGuide() {
    const userGuide = `
📚 Project Manager User Guide

🚀 Getting Started:
1. PROJECT CREATION
   • File → New Project (Ctrl+N)
   • Choose project location and name
   • Project automatically creates standard folders

2. ADDING FILES
   • File → Import Files (Ctrl+I)
   • Drag & drop files directly
   • Files are automatically organized by type

3. PROJECT ORGANIZATION
   • Create custom folders (Project → Create Folder)
   • Move files with Edit → Cut/Paste or Batch Move
   • Use auto-organize features

📁 File Management:
• VIEW MODES: Grid, List, Details
• SORTING: Name, Date, Size, Type
• SEARCH: Find files by name (Ctrl+F)
• SELECTION: Single click, Ctrl+click, Select All (Ctrl+A)

🔧 Advanced Features:
• BATCH OPERATIONS: Rename, move, delete multiple files
• FILE VALIDATION: Check integrity and find duplicates
• PROJECT BACKUP: Export and import projects

⚙️ Project Settings:
• Project Properties: View metadata and statistics
• Preferences: Customize interface and behavior
• Auto-organize: Automatically sort files by type

🎯 Best Practices:
• Save projects regularly
• Use descriptive project names
• Organize files into logical folders
• Export backups before major changes
• Validate files periodically

For technical support, use Help → Report Issue
        `.trim();

    alert(userGuide);
  }

  showFileFormatsInfo() {
    const formats = `
📋 Supported File Formats

🧬 GENOME FILES:
• FASTA (.fasta, .fa, .fas) - Sequence data
• GenBank (.gb, .gbk, .gbff) - Annotated sequences
• EMBL (.embl) - European sequence format

📋 ANNOTATION FILES:
• GFF (.gff, .gff3) - Gene feature format
• GTF (.gtf) - Gene transfer format
• BED (.bed) - Browser extensible data
• PSL (.psl) - Pattern space layout

🔄 VARIANT FILES:
• VCF (.vcf) - Variant call format
• MAF (.maf) - Mutation annotation format

📊 READ/ALIGNMENT FILES:
• BAM (.bam) - Binary alignment map
• SAM (.sam) - Sequence alignment map
• FASTQ (.fastq, .fq) - Sequence with quality

📈 VISUALIZATION FILES:
• WIG (.wig) - Wiggle format
• BigWig (.bw, .bigwig) - Binary wiggle
• BedGraph (.bedgraph) - Graph data

📄 OTHER FORMATS:
• TSV (.tsv) - Tab-separated values
• CSV (.csv) - Comma-separated values
• TXT (.txt) - Plain text files
• JSON (.json) - Structured data

🔧 Conversion Support:
• FASTA ↔ GenBank
• GFF ↔ BED
• VCF → BED
• Custom conversions available

For format-specific help, consult the documentation.
        `.trim();

    alert(formats);
  }

  showBestPractices() {
    const practices = `
🌟 Project Manager Best Practices

📁 PROJECT ORGANIZATION:
• Use descriptive project names
• Create projects for each research topic
• Organize files into logical folders (Genomes, Annotations, etc.)
• Keep related files together

💾 DATA MANAGEMENT:
• Save projects frequently (Ctrl+S)
• Create backups before major changes
• Use version control for important projects
• Export archives for long-term storage

📋 FILE NAMING:
• Use consistent naming conventions
• Avoid spaces and special characters
• Include version numbers or dates
• Use descriptive, searchable names

🔍 QUALITY CONTROL:
• Validate files regularly (Tools → Validate Files)
• Check for duplicates periodically
• Verify file integrity before analysis
• Document file sources and processing

⚡ EFFICIENCY TIPS:
• Use batch operations for multiple files
• Set up auto-organization rules
• Utilize keyboard shortcuts
• Keep projects under 1000 files for performance

🔒 SECURITY & BACKUP:
• Export projects regularly
• Store backups in multiple locations
• Use meaningful project descriptions
• Document data provenance

🚀 COLLABORATION:
• Export projects for sharing
• Use standardized folder structures
• Include README files with descriptions
• Maintain consistent metadata

⚠️ TROUBLESHOOTING:
• Refresh project if files don't appear
• Check file permissions if imports fail
• Validate project integrity after crashes
• Report bugs with detailed information

Following these practices ensures reliable, efficient project management.
        `.trim();

    alert(practices);
  }

  sendFeedback() {
    const feedback = prompt(
      'Send Feedback\n\n' +
        'Please share your thoughts, suggestions, or feature requests:\n' +
        '(This will prepare an email for you to send)'
    );

    if (feedback && feedback.trim()) {
      const subject = 'Project Manager Feedback';
      const body = `
Project Manager Feedback:

${feedback.trim()}

---
System Information:
• User Agent: ${navigator.userAgent}
• Current Project: ${this.currentProject ? this.currentProject.name : 'None'}
• Projects Count: ${this.projects.size}
• Timestamp: ${new Date().toISOString()}
            `.trim();

      const mailtoLink = `mailto:support@codexomics.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      // Try to open email client
      const a = document.createElement('a');
      a.href = mailtoLink;
      a.click();

      this.showNotification('Feedback email prepared - please send when ready', 'info');
    }
  }

  // ==================== ADDITIONAL MENU METHODS ====================

  /**
   * Load project from file (for menu system)
   */
  async loadProjectFromFile(filePath) {
    if (!filePath) {
      this.showNotification('No file path provided', 'error');
      return;
    }

    try {
      if (window.electronAPI && window.electronAPI.loadProjectFile) {
        const result = await window.electronAPI.loadProjectFile(filePath);

        if (result.success) {
          // Parse the project file content
          let project;
          const content = result.content;
          // The IPC result may omit fileName — fall back to the path itself
          const fileName = result.fileName || ProjectUtils.getBaseName(filePath);

          // Unified format detection (file name + content based, case-insensitive)
          const format = ProjectUtils.detectProjectFormat(fileName, content);
          if (format === 'xml') {
            if (!this.xmlHandler) {
              this.xmlHandler = new ProjectXMLHandler();
            }
            project = this.xmlHandler.xmlToProject(content);
          } else {
            // JSON format (backward compatible)
            project = JSON.parse(content);
          }

          // Validate project data
          if (!project || !project.id || !project.name) {
            throw new Error('Invalid project data structure');
          }

          // Normalize containers/metadata so legacy files cannot crash the UI
          ProjectUtils.normalizeProject(project);

          // If there's a current project open, show dialog to ask user's choice
          if (this.currentProject && this.currentProject.name) {
            if (window.electronAPI.showProjectOpenDialog) {
              const dialogResult = await window.electronAPI.showProjectOpenDialog(project.name);

              if (!dialogResult.success) {
                throw new Error('Failed to show project open dialog');
              }

              // Handle user's choice
              switch (dialogResult.choice) {
                case 0: // Open in Current Window
                  break;

                case 1: // Open in New Window
                  if (window.electronAPI.openProjectInNewProcess) {
                    const newProcessResult = await window.electronAPI.openProjectInNewProcess(filePath);
                    if (newProcessResult.success) {
                      this.showNotification(`Opening "${project.name}" in new window...`, 'success');
                    } else {
                      throw new Error('Failed to open project in new window: ' + newProcessResult.error);
                    }
                  }
                  return; // Don't load in current window

                case 2: // Cancel
                default:
                  this.showNotification('Project opening cancelled', 'info');
                  return; // Don't load the project
              }
            }
          }

          // Set up project paths (separator-agnostic; the renderer cannot rely
          // on Node's path module under contextIsolation)
          project.projectFilePath = filePath;

          // New structure: Project.GAI inside the project directory
          // (name comparison is case-insensitive). Old structure:
          // <ProjectName>.prj.GAI alongside the data folder.
          const projectDir = ProjectUtils.getParentPath(filePath);
          if (fileName.toLowerCase() === 'project.gai') {
            project.dataFolderPath = projectDir;
            project.location = ProjectUtils.getParentPath(projectDir);
          } else {
            project.dataFolderPath = ProjectUtils.joinPath(projectDir, project.name);
            project.location = projectDir;
          }

          // Update project metadata
          project.xmlFileName = fileName;
          project.loadedFromFile = true;
          project.metadata.lastOpened = new Date().toISOString();
          project.isCurrentlyOpen = true;
          project.hasUnsavedChanges = false;
          project.justLoaded = true;

          // Close previous project
          if (this.currentProject) {
            this.currentProject.isCurrentlyOpen = false;
          }

          // Set as current project
          this.currentProject = project;
          this.projects.set(project.id, project);
          this.addToRecentProjects(project.id);
          await this.saveProjects();

          // Update UI
          this.renderProjectTree();
          this.selectProject(project.id);

          // Auto-scan the project directory after loading so the workspace
          // shows current files. The loaded project id is captured so the
          // delayed scan aborts if the user switched projects meanwhile.
          const loadedProjectId = project.id;
          setTimeout(async () => {
            if (!this.currentProject || this.currentProject.id !== loadedProjectId) {
              return; // user switched projects within the delay — do not clobber
            }
            try {
              await this.scanAndAddNewFiles();
            } catch (error) {
              console.error('Directory scan failed:', error);
              this.showNotification('Directory scan failed, but project loaded. Use manual refresh.', 'warning');
            }

            this.renderProjectTree();
            if (this.currentProject && this.currentProject.id === loadedProjectId) {
              this.renderProjectContent();
            }
          }, 300);

          this.showNotification(`Project "${project.name}" loaded successfully`, 'success');
        } else {
          throw new Error(result.error || 'Failed to load project file');
        }
      } else {
        this.showNotification('File loading not available in browser mode', 'warning');
      }
    } catch (error) {
      console.error('Error loading project from file:', error);
      this.showNotification(`Failed to load project: ${error.message}`, 'error');
    }
  }

  /**
   * Create new project (for menu system)
   */
  createNewProject() {
    this.showModal('newProjectModal');
  }

  /**
   * Drag & drop file import. Dropped File objects no longer carry a path
   * (Electron >= 32), so paths are resolved through webUtils in the preload.
   * The resolved files flow through the same staging + Add Files modal as
   * the file-picker path.
   */
  setupDragAndDrop() {
    const dropZone = document.querySelector('.main-container') || document.body;

    dropZone.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
    });

    dropZone.addEventListener('drop', async e => {
      e.preventDefault();
      e.stopPropagation();

      if (!this.currentProject) {
        this.showNotification('Please select a project first', 'warning');
        return;
      }

      if (!window.electronAPI || !window.electronAPI.getPathForFile) {
        this.showNotification('Drag & drop import is not available in this environment', 'warning');
        return;
      }

      const droppedFiles = Array.from(e.dataTransfer ? e.dataTransfer.files : []);
      if (droppedFiles.length === 0) return;

      const filePaths = [];
      for (const droppedFile of droppedFiles) {
        try {
          const resolvedPath = window.electronAPI.getPathForFile(droppedFile);
          if (resolvedPath) {
            filePaths.push(resolvedPath);
          }
        } catch (error) {
          console.error('Failed to resolve dropped file path:', droppedFile.name, error);
        }
      }

      if (filePaths.length === 0) {
        this.showNotification('Could not resolve any dropped file paths', 'warning');
        return;
      }

      this.pendingFilesToAdd = filePaths;
      this.pendingAddFolder = [...this.currentPath];
      this.populateAddFilesModal(filePaths);
      this.showModal('addFilesModal');
    });
  }

  /**
   * Show modal helper
   */
  showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'block';
    }
  }

  /**
   * Report issue (for help menu)
   */
  reportIssue() {
    const issueDetails = prompt(
      'Report an Issue\n\n' +
        'Please describe the issue you encountered:\n' +
        '(Include steps to reproduce, expected vs actual behavior)'
    );

    if (issueDetails && issueDetails.trim()) {
      const subject = 'Project Manager Issue Report';
      const body = `
Project Manager Issue Report:

Issue Description:
${issueDetails.trim()}

Steps to Reproduce:
1. 
2. 
3. 

Expected Behavior:


Actual Behavior:


---
System Information:
• User Agent: ${navigator.userAgent}
• Current Project: ${this.currentProject ? this.currentProject.name : 'None'}
• Projects Count: ${this.projects.size}
• Files in Current Project: ${this.currentProject ? this.currentProject.files?.length || 0 : 0}
• Timestamp: ${new Date().toISOString()}
• CodeXomics Version: 0.722.0
            `.trim();

      const mailtoLink = `mailto:support@codexomics.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

      // Try to open email client
      const a = document.createElement('a');
      a.href = mailtoLink;
      a.click();

      this.showNotification('Issue report email prepared - please complete and send', 'info');
    }
  }

  /**
   * Enhanced about dialog
   */
  showAbout() {
    const about = `
📁 Project Manager
Part of CodeXomics

Version: 0.722.0

🎯 Purpose:
Advanced project management for genomic data analysis and bioinformatics workflows.

✨ Key Features:
• Multi-format file support (FASTA, GenBank, GFF, VCF, BAM, etc.)
• Intelligent project organization
• Batch file operations
• Data validation and integrity checking
• Export/import capabilities
• Cross-platform compatibility

👥 Development Team:
CodeXomics Development Team

📖 Documentation:
Visit Help → User Guide for comprehensive documentation

🐛 Report Issues:
Use Help → Report Issue to submit bug reports

© 2026 CodeXomics. All rights reserved.

Built with ❤️ for the bioinformatics community.
        `.trim();

    alert(about);
  }

  // ====== Minimal-mode management ======

  toggleCompactMode() {
    this.isCompactMode = !this.isCompactMode;

    const body = document.body;
    const headerActions = document.getElementById('headerActions');
    const headerActionsCompact = document.getElementById('headerActionsCompact');
    const compactToggle = document.getElementById('compactModeToggle');

    if (this.isCompactMode) {
      // Enable minimal mode
      body.classList.add('compact-mode');
      if (headerActions) headerActions.style.display = 'none';
      if (headerActionsCompact) headerActionsCompact.style.display = 'flex';
      if (compactToggle) compactToggle.checked = true;

      // Update the status-bar info
      this.updateStatusBar('Simple Mode: Showing workspace only');

      // Save the minimal-mode state
      this.saveCompactModePreference(true);

      console.log('🎯 Compact mode enabled - showing workspace only');
    } else {
      // Disable minimal mode
      body.classList.remove('compact-mode');
      if (headerActions) headerActions.style.display = 'flex';
      if (headerActionsCompact) headerActionsCompact.style.display = 'none';
      if (compactToggle) compactToggle.checked = false;

      // Restore the normal status-bar info
      if (this.currentProject) {
        this.updateStatusBar(`Project: ${this.currentProject.name}`);
      } else {
        this.updateStatusBar('Ready');
      }

      // Save the minimal-mode state
      this.saveCompactModePreference(false);

      console.log('🎯 Compact mode disabled - showing full interface');
    }

    // Add visual feedback
    this.showNotification(this.isCompactMode ? 'Simple Mode enabled' : 'Full interface restored', 'info');
  }

  saveCompactModePreference(isCompact) {
    try {
      localStorage.setItem('projectManager_compactMode', JSON.stringify(isCompact));
    } catch (error) {
      console.error('Failed to save compact mode preference:', error);
    }
  }

  loadCompactModePreference() {
    try {
      const saved = localStorage.getItem('projectManager_compactMode');
      if (saved !== null) {
        const isCompact = JSON.parse(saved);
        if (isCompact !== this.isCompactMode) {
          // Delay applying the mode to ensure the DOM is loaded
          setTimeout(() => {
            this.toggleCompactMode();
          }, 100);
        }
      }
    } catch (error) {
      console.error('Failed to load compact mode preference:', error);
    }
  }

  initializeCompactMode() {
    // Apply the saved minimal-mode setting on page load
    this.loadCompactModePreference();

    // Ensure the toggle button is in the correct state
    setTimeout(() => {
      const compactToggle = document.getElementById('compactModeToggle');
      if (compactToggle) {
        compactToggle.checked = this.isCompactMode;
      }
    }, 200);
  }

  /**
   * Initialize the sidebar splitter drag functionality
   */
  initializeSidebarSplitter() {
    console.log('🔧 Initializing sidebar splitter...');

    const splitter = document.getElementById('sidebarSplitter');
    const sidebar = document.querySelector('.sidebar');
    const contentArea = document.querySelector('.content-area');

    if (!splitter || !sidebar || !contentArea) {
      console.warn('⚠️ Sidebar splitter elements not found:', {
        splitter: !!splitter,
        sidebar: !!sidebar,
        contentArea: !!contentArea,
      });
      return;
    }

    console.log('✅ Sidebar splitter elements found, setting up drag functionality');

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    const startResize = e => {
      isResizing = true;
      startX = e.clientX || (e.touches && e.touches[0].clientX);
      startWidth = sidebar.offsetWidth;

      // Add visual feedback
      splitter.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      console.log('🖱️ Splitter drag started at', startX, 'sidebar width:', startWidth);

      e.preventDefault();
    };

    const doResize = e => {
      if (!isResizing) return;

      const currentX = e.clientX || (e.touches && e.touches[0].clientX);
      const deltaX = currentX - startX;
      const requestedWidth = startWidth + deltaX;

      // Constrain sidebar width between 200px and 50% of window width
      const minWidth = 200;
      const maxWidth = window.innerWidth * 0.5;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, requestedWidth));

      // Update sidebar width
      sidebar.style.width = `${newWidth}px`;
      sidebar.style.flexBasis = `${newWidth}px`;

      e.preventDefault();
    };

    const stopResize = () => {
      if (!isResizing) return;

      isResizing = false;

      // Remove visual feedback
      splitter.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Save the new width to localStorage
      const finalWidth = sidebar.offsetWidth;
      localStorage.setItem('projectManager_sidebarWidth', `${finalWidth}px`);

      console.log('✅ Splitter drag ended, saved width:', finalWidth);

      // Trigger resize event for any dependent components
      window.dispatchEvent(new Event('resize'));
    };

    // Auto-reset to default width on double-click
    const autoResetWidth = () => {
      console.log('🔄 Resetting sidebar to default width');

      // Add visual feedback
      splitter.classList.add('auto-resetting');

      // Reset to default width with smooth transition
      sidebar.style.transition = 'width 0.3s ease, flex-basis 0.3s ease';
      sidebar.style.width = '320px';
      sidebar.style.flexBasis = '320px';

      // Save the reset width
      localStorage.setItem('projectManager_sidebarWidth', '320px');

      // Trigger resize event
      window.dispatchEvent(new Event('resize'));

      // Remove transition and animation classes after animation completes
      setTimeout(() => {
        sidebar.style.transition = '';
        splitter.classList.remove('auto-resetting');
      }, 300);
    };

    // Mouse events
    splitter.addEventListener('mousedown', startResize);
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);

    // Touch events for mobile/tablet
    splitter.addEventListener('touchstart', startResize, { passive: false });
    document.addEventListener('touchmove', doResize, { passive: false });
    document.addEventListener('touchend', stopResize);

    // Double-click for auto-reset
    splitter.addEventListener('dblclick', autoResetWidth);

    // Keyboard navigation for accessibility
    splitter.setAttribute('tabindex', '0');
    splitter.setAttribute('role', 'separator');
    splitter.setAttribute('aria-label', 'Resize sidebar');

    splitter.addEventListener('keydown', e => {
      const step = 10; // pixels to move per keypress
      let deltaX = 0;

      switch (e.key) {
        case 'ArrowLeft':
          deltaX = -step;
          break;
        case 'ArrowRight':
          deltaX = step;
          break;
        case 'Home':
          autoResetWidth();
          e.preventDefault();
          return;
        default:
          return;
      }

      e.preventDefault();

      // Apply keyboard movement
      const currentWidth = sidebar.offsetWidth;
      const requestedWidth = currentWidth + deltaX;
      const minWidth = 200;
      const maxWidth = window.innerWidth * 0.5;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, requestedWidth));

      sidebar.style.width = `${newWidth}px`;
      sidebar.style.flexBasis = `${newWidth}px`;
      localStorage.setItem('projectManager_sidebarWidth', `${newWidth}px`);
      window.dispatchEvent(new Event('resize'));
    });

    // Load saved sidebar width
    const savedWidth = localStorage.getItem('projectManager_sidebarWidth');
    if (savedWidth) {
      sidebar.style.width = savedWidth;
      sidebar.style.flexBasis = savedWidth;
      console.log('📏 Loaded saved sidebar width:', savedWidth);
    }

    console.log('✅ Sidebar splitter initialized successfully');
  }

  /**
   * Show the enhanced subfolder-creation modal
   */
  showCreateSubfolderModal(parentPath = null) {
    const basePath = parentPath || this.currentContextFolderPath || this.currentPath;

    // Update the current-path display in the modal
    const pathDisplay = document.getElementById('currentFolderPath');
    if (pathDisplay) {
      if (basePath && basePath.length > 0) {
        pathDisplay.textContent = `${this.currentProject.name}/${basePath.join('/')}`;
      } else {
        pathDisplay.textContent = `${this.currentProject.name} (root)`;
      }
    }

    // Clear the form
    document.getElementById('subfolderName').value = '';
    document.getElementById('subfolderIcon').value = '📁';
    document.getElementById('subfolderDescription').value = '';

    // Show the modal
    document.getElementById('createSubfolderModal').style.display = 'block';

    // Focus the name input field
    setTimeout(() => {
      document.getElementById('subfolderName').focus();
    }, 100);
  }

  /**
   * Create a subfolder from the enhanced modal
   */
  createSubfolderFromModal() {
    const folderName = document.getElementById('subfolderName').value.trim();
    const folderIcon = document.getElementById('subfolderIcon').value;
    const folderDescription = document.getElementById('subfolderDescription').value.trim();

    if (!folderName) {
      this.showNotification('Please enter a folder name', 'warning');
      return;
    }

    const basePath = this.currentContextFolderPath || this.currentPath;
    const newPath = [...basePath, folderName.toLowerCase()];

    const folder = {
      name: folderName,
      icon: folderIcon,
      path: newPath,
      files: [],
      description: folderDescription || null,
      created: new Date().toISOString(),
      custom: true,
      parent: basePath.length > 0 ? basePath : null,
    };

    // Check if folder already exists
    const existingFolder = this.currentProject.folders.find(f => this.arraysEqual(f.path, newPath));

    if (existingFolder) {
      this.showNotification(`Folder "${folderName}" already exists at this location`, 'warning');
      return;
    }

    this.currentProject.folders.push(folder);
    this.currentProject.modified = new Date().toISOString();

    // Auto-expand the parent folder
    if (basePath.length > 0) {
      if (!this.expandedFolders) {
        this.expandedFolders = new Set();
      }
      this.expandedFolders.add(basePath.join('/'));
    }

    // Add to project history
    if (!this.currentProject.history) {
      this.currentProject.history = [];
    }
    this.currentProject.history.unshift({
      timestamp: new Date().toISOString(),
      action: 'subfolder-created',
      description: `Created subfolder "${folderName}" (${folderIcon}) in ${basePath.length > 0 ? basePath.join('/') : 'root'}`,
    });

    this.saveProjects();

    // Also save as XML if possible to ensure persistence (auto-save without dialog)
    if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
      this.saveProjectAsXML(true);
    }

    this.closeModal('createSubfolderModal');
    this.renderProjectTree();
    this.showNotification(`Subfolder "${folderName}" created successfully`, 'success');

    console.log(`📁 Created enhanced subfolder: ${folderName} (${folderIcon}) at path: ${newPath.join('/')}`);
  }

  /**
   * Improved addSubfolder method that uses the enhanced modal
   */
  addSubfolder() {
    this.hideContextMenus();
    if (!this.currentContextFolderPath || !this.currentProject) return;

    this.showCreateSubfolderModal(this.currentContextFolderPath);
  }

  /**
   * File context menu
   */
  showFileContextMenu(event, fileId) {
    event.preventDefault();
    this.currentContextFileId = fileId;
    const menu = document.getElementById('fileContextMenu');
    this.showContextMenu(menu, event);
  }

  hideFileContextMenu() {
    const menu = document.getElementById('fileContextMenu');
    if (menu) menu.style.display = 'none';
  }

  /**
   * File-preview method
   */
  async previewFile(fileId) {
    const file = this.findFileById(fileId);
    if (!file) return;

    try {
      // Different preview methods can be called here depending on the file type
      const fileType = this.detectFileType(file.name);

      if (window.electronAPI && window.electronAPI.openFileInMainWindow) {
        // Use getFileAbsolutePath to resolve the correct absolute path
        const filePath = this.getFileAbsolutePath(file);
        console.log('🔍 previewFile Debug:');
        console.log('   File object:', file);
        console.log('   Resolved absolute path:', filePath);

        const result = await window.electronAPI.openFileInMainWindow(filePath);
        if (result.success) {
          this.showNotification(`Opened "${file.name}" for preview`, 'success');
        } else {
          throw new Error(result.error);
        }
      } else {
        this.showNotification(`Preview: ${file.name} (${fileType})`, 'info');
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      this.showNotification('Failed to preview file', 'error');
    }
  }

  /**
   * File-rename method
   */
  async renameFile(fileId) {
    const file = this.findFileById(fileId);
    if (!file) return;

    // Store the file ID and file reference for later use in confirmRenameFile
    this.currentRenameFileId = fileId;
    this.currentRenameFile = file;

    // Update modal with current file name
    const currentFileNameDisplay = document.getElementById('currentFileName');
    const renameFileNameInput = document.getElementById('renameFileName');

    if (currentFileNameDisplay) {
      currentFileNameDisplay.textContent = file.name;
    }

    if (renameFileNameInput) {
      renameFileNameInput.value = file.name;
    }

    // Show the modal
    document.getElementById('renameFileModal').style.display = 'block';

    // Focus on the input field after a short delay
    setTimeout(() => {
      if (renameFileNameInput) {
        renameFileNameInput.focus();
        renameFileNameInput.select();
      }
    }, 100);
  }

  /**
   * Confirm rename file from modal
   */
  async confirmRenameFile() {
    const newName = document.getElementById('renameFileName').value.trim();

    if (!newName) {
      this.showNotification('Please enter a file name', 'warning');
      return;
    }

    if (!this.currentRenameFile || newName === this.currentRenameFile.name) {
      this.closeModal('renameFileModal');
      return;
    }

    try {
      this.currentRenameFile.name = newName;
      this.currentRenameFile.modified = new Date().toISOString();

      this.currentProject.modified = new Date().toISOString();
      await this.saveProjects();

      // Auto-save as XML (without dialog)
      if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
        await this.saveProjectAsXML(true);
      }

      this.renderProjectTree();
      this.renderProjectContent();
      this.showNotification(`File renamed to "${newName}"`, 'success');

      // Close the modal and clean up
      this.closeModal('renameFileModal');
      this.currentRenameFileId = null;
      this.currentRenameFile = null;
    } catch (error) {
      console.error('Error renaming file:', error);
      this.showNotification('Failed to rename file', 'error');
    }
  }

  /**
   * File-delete method
   */
  async deleteFile(fileId) {
    const file = this.findFileById(fileId);
    if (!file) return;

    if (
      !confirm(
        `Are you sure you want to delete "${file.name}"?\n\nThis will delete both the project record AND the physical file from disk.`
      )
    ) {
      return;
    }

    try {
      // Get the absolute path of the file
      const filePath = this.getFileAbsolutePath(file);

      // Delete the physical file from disk
      if (window.electronAPI && window.electronAPI.deletePhysicalFile && filePath) {
        const deleteResult = await window.electronAPI.deletePhysicalFile(filePath);
        if (!deleteResult.success) {
          console.warn('Failed to delete physical file:', deleteResult.error);
          // Continue anyway to remove from project
        }
      }

      // Remove the file from the project
      this.currentProject.files = this.currentProject.files.filter(f => f.id !== fileId);

      // Remove it from the selection list
      this.selectedFiles.delete(fileId);

      this.currentProject.modified = new Date().toISOString();
      await this.saveProjects();

      // Auto-save as XML (without dialog)
      if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
        await this.saveProjectAsXML(true);
      }

      this.renderProjectTree();
      this.renderProjectContent();
      this.showNotification(`File "${file.name}" deleted from project and disk`, 'success');
    } catch (error) {
      console.error('Error deleting file:', error);
      this.showNotification('Failed to delete file', 'error');
    }
  }

  /**
   * File-copy method
   */
  async duplicateFile(fileId) {
    const file = this.findFileById(fileId);
    if (!file) return;

    try {
      const fileName = file.name;
      const fileExtension = fileName.lastIndexOf('.') > 0 ? fileName.substring(fileName.lastIndexOf('.')) : '';
      const baseName = fileExtension ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
      const newName = `${baseName}_copy${fileExtension}`;

      const duplicatedFile = {
        ...file,
        id: this.generateId(),
        name: newName,
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      };

      this.currentProject.files.push(duplicatedFile);
      this.currentProject.modified = new Date().toISOString();
      await this.saveProjects();

      // Auto-save as XML (without dialog)
      if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
        await this.saveProjectAsXML(true);
      }

      this.renderProjectTree();
      this.renderProjectContent();
      this.showNotification(`File duplicated as "${newName}"`, 'success');
    } catch (error) {
      console.error('Error duplicating file:', error);
      this.showNotification('Failed to duplicate file', 'error');
    }
  }

  /**
   * Enhanced folder-operation methods
   */
  renameProject() {
    this.hideContextMenus();
    if (!this.currentContextProjectId) return;

    const project = this.projects.get(this.currentContextProjectId);
    if (!project) return;

    const newName = prompt('Enter new project name:', project.name);
    if (newName && newName.trim() && newName.trim() !== project.name) {
      project.name = newName.trim();
      project.modified = new Date().toISOString();
      this.projects.set(this.currentContextProjectId, project);
      this.saveProjects();
      this.renderProjectTree();
      this.showNotification(`Project renamed to "${newName}"`, 'success');
    }
  }

  deleteProject() {
    this.hideContextMenus();
    if (!this.currentContextProjectId) return;

    const project = this.projects.get(this.currentContextProjectId);
    if (!project) return;

    if (confirm(`Are you sure you want to delete project "${project.name}"? This action cannot be undone.`)) {
      this.projects.delete(this.currentContextProjectId);

      // If deleting the current project, clear it
      if (this.currentProject && this.currentProject.id === this.currentContextProjectId) {
        this.currentProject = null;
        this.currentPath = [];
        this.selectedFiles.clear();

        // Show the project overview
        document.getElementById('projectOverview').style.display = 'block';
        document.getElementById('projectContent').style.display = 'none';
      }

      this.saveProjects();
      this.renderProjectTree();
      this.showNotification(`Project "${project.name}" deleted`, 'success');
    }
  }

  duplicateProject() {
    this.hideContextMenus();
    if (!this.currentContextProjectId) return;

    const project = this.projects.get(this.currentContextProjectId);
    if (!project) return;

    const newName = prompt('Enter name for duplicated project:', project.name + ' Copy');
    if (newName && newName.trim()) {
      // Deep-copy so the duplicate never shares files/folders/metadata arrays
      // with the original (a shallow {...project} copy mutates both projects)
      const newProject = ProjectUtils.deepClone(project);
      newProject.id = this.generateId();
      newProject.name = newName.trim();
      newProject.created = new Date().toISOString();
      newProject.modified = new Date().toISOString();

      this.projects.set(newProject.id, newProject);
      this.saveProjects();
      this.renderProjectTree();
      this.showNotification(`Project duplicated as "${newName}"`, 'success');
    }
  }

  exportProjectAs() {
    this.hideContextMenus();
    if (!this.currentContextProjectId) return;

    const project = this.projects.get(this.currentContextProjectId);
    if (!project) return;

    try {
      if (!this.xmlHandler) {
        this.xmlHandler = new ProjectXMLHandler();
      }

      const xmlContent = this.xmlHandler.projectToXML(project);
      this.downloadXMLFile(xmlContent, `${project.name}.prj.GAI`);
      this.showNotification(`Project "${project.name}" exported successfully`, 'success');
    } catch (error) {
      console.error('Error exporting project:', error);
      this.showNotification('Failed to export project', 'error');
    }
  }

  showProjectProperties() {
    this.hideContextMenus();
    if (!this.currentContextProjectId) return;

    const project = this.projects.get(this.currentContextProjectId);
    if (!project) return;

    const properties = `
Project: ${project.name}
Description: ${project.description || 'N/A'}
Location: ${project.location || 'N/A'}
Files: ${project.files?.length || 0}
Folders: ${project.folders?.length || 0}
Created: ${this.formatDate(project.created)}
Modified: ${this.formatDate(project.modified)}
        `.trim();

    alert(properties);
  }

  /**
   * XML-file download method
   */
  downloadXMLFile(xmlContent, filename) {
    try {
      if (window.electronAPI && window.electronAPI.saveProjectFile) {
        // Electron environment
        window.electronAPI.saveProjectFile(filename, xmlContent);
      } else {
        // Browser environment
        const blob = new Blob([xmlContent], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading XML file:', error);
      throw error;
    }
  }

  /**
   * Additional folder-related methods
   */
  renameFolder() {
    this.hideContextMenus();
    if (!this.currentContextFolderPath || !this.currentProject) return;

    const folder = this.currentProject.folders.find(f => this.arraysEqual(f.path, this.currentContextFolderPath));

    if (!folder) return;

    const newName = prompt('Enter new folder name:', folder.name);
    if (newName && newName.trim() && newName.trim() !== folder.name) {
      folder.name = newName.trim();
      this.currentProject.modified = new Date().toISOString();
      this.saveProjects();
      this.renderProjectTree();
      this.showNotification(`Folder renamed to "${newName}"`, 'success');
    }
  }

  deleteFolder() {
    this.hideContextMenus();
    if (!this.currentContextFolderPath || !this.currentProject) return;

    const folder = this.currentProject.folders.find(f => this.arraysEqual(f.path, this.currentContextFolderPath));

    if (!folder) return;

    // Check whether the folder contains files
    const filesInFolder = this.currentProject.files.filter(
      file => file.folder && this.arraysEqual(file.folder, this.currentContextFolderPath)
    );

    const confirmMessage =
      filesInFolder.length > 0
        ? `Are you sure you want to delete folder "${folder.name}" and its ${filesInFolder.length} file(s)? This action cannot be undone.`
        : `Are you sure you want to delete folder "${folder.name}"?`;

    if (confirm(confirmMessage)) {
      // Delete all files in the folder
      this.currentProject.files = this.currentProject.files.filter(
        file => !file.folder || !this.arraysEqual(file.folder, this.currentContextFolderPath)
      );

      // Delete the folder
      this.currentProject.folders = this.currentProject.folders.filter(
        f => !this.arraysEqual(f.path, this.currentContextFolderPath)
      );

      // If currently inside the deleted folder, return to the root directory
      if (this.arraysEqual(this.currentPath, this.currentContextFolderPath)) {
        this.currentPath = [];
      }

      this.currentProject.modified = new Date().toISOString();
      this.saveProjects();
      this.renderProjectTree();
      this.renderProjectContent();
      this.showNotification(`Folder "${folder.name}" deleted`, 'success');
    }
  }

  addFilesToFolder() {
    this.hideContextMenus();
    if (!this.currentContextFolderPath || !this.currentProject) return;

    // Stage the target folder WITHOUT mutating currentPath — the Add Files
    // modal confirms asynchronously, and restoring currentPath early would
    // both clobber user navigation and misplace the added files.
    this.addFiles(this.currentContextFolderPath);
  }

  openFolderInExplorer() {
    this.hideContextMenus();
    if (!this.currentContextFolderPath || !this.currentProject) return;

    const folder = this.currentProject.folders.find(f => this.arraysEqual(f.path, this.currentContextFolderPath));

    if (!folder) return;

    // Resolve the folder's on-disk path and open it via the main process
    const basePath = this.currentProject.dataFolderPath || this.currentProject.location;
    if (!basePath) {
      this.showNotification('Project path not available', 'warning');
      return;
    }

    const folderPath = ProjectUtils.joinPath(basePath, folder.path.join('/'));

    if (window.electronAPI && window.electronAPI.openFolderInExplorer) {
      window.electronAPI
        .openFolderInExplorer(folderPath)
        .then(result => {
          if (result && result.success === false) {
            this.showNotification(`Failed to open folder: ${result.error || 'unknown error'}`, 'error');
          }
        })
        .catch(error => {
          console.error('Error opening folder in explorer:', error);
          this.showNotification('Failed to open folder in file explorer', 'error');
        });
      this.showNotification(`Opening folder "${folder.name}" in file explorer`, 'info');
    } else {
      this.showNotification('File explorer not available in browser mode', 'warning');
    }
  }

  /**
   * File-preview method - shows the file-preview popup
   */
  async showFilePreview(fileId) {
    const file = this.findFileById(fileId);
    if (!file) return;

    try {
      const fileType = this.detectFileType(file.name);

      // Create the preview modal
      this.createPreviewModal(file, fileType);

      this.showNotification(`Previewing: ${file.name}`, 'info');
    } catch (error) {
      console.error('Error previewing file:', error);
      this.showNotification('Failed to preview file', 'error');
    }
  }

  /**
   * Create the file-preview modal
   */
  createPreviewModal(file, fileType) {
    // Remove any existing preview modal
    const existingModal = document.getElementById('filePreviewModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create the preview modal
    const modal = document.createElement('div');
    modal.id = 'filePreviewModal';
    modal.style.cssText = `
            display: block;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0,0,0,0.5);
            backdrop-filter: blur(5px);
        `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
            background-color: white;
            margin: 5% auto;
            padding: 0;
            border-radius: 12px;
            width: 80%;
            max-width: 800px;
            max-height: 80%;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        `;

    // Modal header
    const header = document.createElement('div');
    header.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

    const title = document.createElement('h3');
    title.textContent = `Preview: ${file.name}`;
    title.style.margin = '0';

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
    closeBtn.onclick = () => modal.remove();

    header.appendChild(title);
    header.appendChild(closeBtn);

    // File-info area
    const infoSection = document.createElement('div');
    infoSection.style.cssText = `
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #eee;
        `;

    infoSection.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; font-size: 14px;">
                <div><strong>File Name:</strong> ${ProjectUtils.escapeHtml(file.name)}</div>
                <div><strong>File Type:</strong> ${ProjectUtils.escapeHtml(fileType.toUpperCase())}</div>
                <div><strong>Size:</strong> ${this.formatFileSize(file.size || 0)}</div>
                <div><strong>Modified:</strong> ${file.modified ? this.formatDate(file.modified) : 'Unknown'}</div>
            </div>
        `;

    // Preview-content area
    const previewContent = document.createElement('div');
    previewContent.style.cssText = `
            padding: 20px;
            max-height: 400px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
        `;

    // Show different preview content depending on the file type
    this.generatePreviewContent(file, fileType, previewContent);

    // Button area
    const buttonSection = document.createElement('div');
    buttonSection.style.cssText = `
            padding: 20px;
            border-top: 1px solid #eee;
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        `;

    const openInMainBtn = document.createElement('button');
    openInMainBtn.textContent = 'Open in Main Window';
    openInMainBtn.style.cssText = `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
        `;
    openInMainBtn.onclick = () => {
      this.openFileInMainWindow(file.id);
      modal.remove();
    };

    const closeModalBtn = document.createElement('button');
    closeModalBtn.textContent = 'Close';
    closeModalBtn.style.cssText = `
            background: #6c757d;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 500;
        `;
    closeModalBtn.onclick = () => modal.remove();

    buttonSection.appendChild(openInMainBtn);
    buttonSection.appendChild(closeModalBtn);

    // Assemble the modal
    modalContent.appendChild(header);
    modalContent.appendChild(infoSection);
    modalContent.appendChild(previewContent);
    modalContent.appendChild(buttonSection);
    modal.appendChild(modalContent);

    // Add to the page
    document.body.appendChild(modal);

    // Close when clicking the background
    modal.onclick = e => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  }

  /**
   * Generate the preview content
   */
  generatePreviewContent(file, fileType, container) {
    const placeholderContent = {
      fasta: `>Sequence_1
ATGCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC
GATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC
GATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC
...

📄 This is a preview of what a FASTA file might contain.
To view the actual file content, click "Open in Main Window".`,

      gff: `##gff-version 3
##sequence-region ctg123 1 1497228
ctg123	.	gene	1000	9000	.	+	.	ID=gene00001;Name=EDEN
ctg123	.	mRNA	1050	9000	.	+	.	ID=mRNA00001;Parent=gene00001
ctg123	.	exon	1050	1500	.	+	.	ID=exon00001;Parent=mRNA00001
...

📄 This is a preview of what a GFF file might contain.
To view the actual file content, click "Open in Main Window".`,

      vcf: `##fileformat=VCFv4.2
##contig=<ID=20,length=62435964>
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
20	14370	rs6054257	G	A	29	PASS	NS=3;DP=14;AF=0.5
20	17330	.	T	A	3	q10	NS=3;DP=11;AF=0.017
...

📄 This is a preview of what a VCF file might contain.
To view the actual file content, click "Open in Main Window".`,

      genbank: `LOCUS       SCU49845     5028 bp    DNA     linear   PLN 21-JUN-1999
DEFINITION  Saccharomyces cerevisiae TCP1-beta gene, partial cds; and Axl2p
ACCESSION   U49845
VERSION     U49845.1  GI:1293613
FEATURES             Location/Qualifiers
     source          1..5028
                     /organism="Saccharomyces cerevisiae"
...

📄 This is a preview of what a GenBank file might contain.
To view the actual file content, click "Open in Main Window".`,
    };

    const content =
      placeholderContent[fileType] ||
      `📄 Preview not available for ${fileType.toUpperCase()} files.

File: ${ProjectUtils.escapeHtml(file.name)}
Type: ${fileType.toUpperCase()}
Size: ${this.formatFileSize(file.size || 0)}

To view this file, click "Open in Main Window".`;

    container.innerHTML = `<pre style="white-space: pre-wrap; margin: 0; color: #333;">${content}</pre>`;
  }

  /**
   * Toggle compact tree-view mode
   */
  toggleCompactTreeMode() {
    this.compactTreeMode = !this.compactTreeMode;

    const sidebar = document.querySelector('.sidebar-content');
    const compactToggle = document.getElementById('compactTreeToggle');

    if (this.compactTreeMode) {
      sidebar.classList.add('compact-tree-mode');
      if (compactToggle) compactToggle.checked = true;
      this.showNotification('Compact tree view enabled', 'success');
    } else {
      sidebar.classList.remove('compact-tree-mode');
      sidebar.classList.remove('ultra-compact-mode');
      if (compactToggle) compactToggle.checked = false;
      this.ultraCompactMode = false;
      this.showNotification('Normal tree view enabled', 'success');
    }

    // Save the setting to localStorage
    this.saveTreeViewPreference();

    console.log(`Tree view mode: ${this.compactTreeMode ? 'compact' : 'normal'}`);
  }

  /**
   * Toggle super-compact mode (triggered by double-clicking the compact-mode toggle button)
   */
  toggleUltraCompactMode() {
    if (!this.compactTreeMode) {
      this.toggleCompactTreeMode();
    }

    this.ultraCompactMode = !this.ultraCompactMode;
    const sidebar = document.querySelector('.sidebar-content');

    if (this.ultraCompactMode) {
      sidebar.classList.add('ultra-compact-mode');
      this.showNotification('Ultra compact tree view enabled', 'success');
    } else {
      sidebar.classList.remove('ultra-compact-mode');
      this.showNotification('Compact tree view enabled', 'success');
    }

    this.saveTreeViewPreference();
    console.log(`Ultra compact mode: ${this.ultraCompactMode ? 'enabled' : 'disabled'}`);
  }

  /**
   * Save the tree-view preferences
   */
  saveTreeViewPreference() {
    const preferences = {
      compactTreeMode: this.compactTreeMode,
      ultraCompactMode: this.ultraCompactMode,
    };
    localStorage.setItem('projectManagerTreeViewPreferences', JSON.stringify(preferences));
  }

  /**
   * Load the tree-view preferences
   */
  loadTreeViewPreference() {
    try {
      const stored = localStorage.getItem('projectManagerTreeViewPreferences');
      if (stored) {
        const preferences = JSON.parse(stored);
        this.compactTreeMode = preferences.compactTreeMode || false;
        this.ultraCompactMode = preferences.ultraCompactMode || false;

        // Apply the settings to the UI
        const sidebar = document.querySelector('.sidebar-content');
        const compactToggle = document.getElementById('compactTreeToggle');

        if (this.compactTreeMode) {
          sidebar.classList.add('compact-tree-mode');
          if (compactToggle) compactToggle.checked = true;
        }

        if (this.ultraCompactMode) {
          sidebar.classList.add('ultra-compact-mode');
        }
      }
    } catch (error) {
      console.warn('Failed to load tree view preferences:', error);
      this.compactTreeMode = false;
      this.ultraCompactMode = false;
    }
  }

  /**
   * Initialize compact-mode event listeners
   */
  initializeTreeViewEvents() {
    const compactToggle = document.getElementById('compactTreeToggle');
    if (compactToggle) {
      // Double-click to toggle super-compact mode
      compactToggle.addEventListener('dblclick', () => {
        this.toggleUltraCompactMode();
      });

      // Add keyboard-shortcut support (Ctrl+Shift+T)
      document.addEventListener('keydown', event => {
        if (event.ctrlKey && event.shiftKey && event.key === 'T') {
          event.preventDefault();
          this.toggleCompactTreeMode();
        }
      });
    }

    // Load the saved settings
    this.loadTreeViewPreference();
  }

  /**
   * Toggle the header collapsed state
   */
  toggleHeaderCollapse() {
    this.headerCollapsed = !this.headerCollapsed;

    const header = document.querySelector('.header');
    const mainContainer = document.querySelector('.main-container');
    const statusBar = document.querySelector('.status-bar');
    const toggleButton = document.getElementById('headerToggle');
    const body = document.body;

    if (this.headerCollapsed) {
      // Collapse the header
      header.classList.add('header-collapsed');
      mainContainer.classList.add('main-container-fullheight');
      statusBar.classList.add('status-bar-collapsed');
      body.classList.add('sidebar-collapsed-mode');

      if (toggleButton) {
        toggleButton.classList.add('collapsed');
        toggleButton.title = 'Show header';
        // Update the SVG icon to a downward triangle (expanded state)
        const svgIcon = toggleButton.querySelector('.btn-icon');
        if (svgIcon) {
          svgIcon.innerHTML = '<path d="M8 11L3 6h10z"/>';
        }
      }

      this.showNotification('Header collapsed - sidebar-only mode', 'success');
    } else {
      // Expand the header
      header.classList.remove('header-collapsed');
      mainContainer.classList.remove('main-container-fullheight');
      statusBar.classList.remove('status-bar-collapsed');
      body.classList.remove('sidebar-collapsed-mode');

      if (toggleButton) {
        toggleButton.classList.remove('collapsed');
        toggleButton.title = 'Hide header';
        // Update the SVG icon to an upward arrow (collapsed state)
        const svgIcon = toggleButton.querySelector('.btn-icon');
        if (svgIcon) {
          svgIcon.innerHTML =
            '<path d="m7.247 4.86-4.796 5.481c-.566.647-.106 1.659.753 1.659h9.592a1 1 0 0 0 .753-1.659l-4.796-5.48a1 1 0 0 0-1.506 0z"/>';
        }
      }

      this.showNotification('Header restored - full interface mode', 'success');
    }

    // Save the state
    this.saveHeaderCollapsePreference();

    console.log(`Header ${this.headerCollapsed ? 'collapsed' : 'expanded'}`);
  }

  /**
   * Save the header-collapse preferences
   */
  saveHeaderCollapsePreference() {
    localStorage.setItem('projectManagerHeaderCollapsed', JSON.stringify(this.headerCollapsed));
  }

  /**
   * Load the header-collapse preferences
   */
  loadHeaderCollapsePreference() {
    try {
      const stored = localStorage.getItem('projectManagerHeaderCollapsed');
      if (stored !== null) {
        this.headerCollapsed = JSON.parse(stored);

        // Apply the saved state
        if (this.headerCollapsed) {
          // Delay applying the state to ensure the DOM is loaded
          setTimeout(() => {
            this.toggleHeaderCollapse();
          }, 100);
        }
      }
    } catch (error) {
      console.warn('Failed to load header collapse preference:', error);
      this.headerCollapsed = false;
    }
  }

  /**
   * Initialize header-related event listeners
   */
  initializeHeaderEvents() {
    // Keyboard-shortcut support (Ctrl+Shift+H)
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.shiftKey && event.key === 'H') {
        event.preventDefault();
        this.toggleHeaderCollapse();
      }
    });

    // Load the saved settings
    this.loadHeaderCollapsePreference();
    this.loadStatsPanelPreference();
  }

  /**
   * Load statistics panel visibility preference from localStorage
   */
  loadStatsPanelPreference() {
    const saved = localStorage.getItem('projectManager-statsPanel');
    const statsPanel = document.getElementById('projectStats');
    const toggle = document.getElementById('statsPanelToggle');

    if (saved === 'hidden') {
      this.statsVisible = false;
      if (statsPanel) {
        statsPanel.classList.add('hidden');
      }
      if (toggle) {
        toggle.checked = false;
      }
    } else {
      // Default to visible
      this.statsVisible = true;
      if (statsPanel) {
        statsPanel.classList.remove('hidden');
      }
      if (toggle) {
        toggle.checked = true;
      }
    }
  }

  /**
   * Update details panel (compatibility method)
   */
  updateDetailsPanel() {
    // This is a compatibility method for details panel functionality
    // Currently, details panel is not fully implemented
    console.debug('updateDetailsPanel called - details panel not fully implemented');
  }

  /**
   * Toggle details panel (compatibility method)
   */
  toggleDetailsPanel() {
    // This is a compatibility method for details panel functionality
    const detailsPanel = document.getElementById('detailsPanel');
    const toggle = document.getElementById('detailsPanelToggle');

    if (detailsPanel && toggle) {
      const isVisible = detailsPanel.style.display !== 'none';
      detailsPanel.style.display = isVisible ? 'none' : 'block';
      toggle.checked = !isVisible;

      // Save preference
      localStorage.setItem('projectManager-detailsPanel', !isVisible ? 'open' : 'closed');

      this.showNotification(`Details panel ${!isVisible ? 'opened' : 'closed'}`, 'info');
    } else {
      console.log('toggleDetailsPanel called - details panel elements not found');
    }
  }

  /**
   * Toggle statistics panel
   */
  toggleStatsPanel() {
    const statsPanel = document.getElementById('projectStats');
    const toggle = document.getElementById('statsPanelToggle');

    if (statsPanel && toggle) {
      this.statsVisible = !this.statsVisible;

      if (this.statsVisible) {
        statsPanel.classList.remove('hidden');
      } else {
        statsPanel.classList.add('hidden');
      }

      toggle.checked = this.statsVisible;

      // Save preference
      localStorage.setItem('projectManager-statsPanel', this.statsVisible ? 'visible' : 'hidden');

      this.showNotification(`Statistics panel ${this.statsVisible ? 'shown' : 'hidden'}`, 'info');
    } else {
      console.log('toggleStatsPanel called - statistics panel elements not found');
    }
  }

  /**
   * Release every file lock recorded on project files. Called from the
   * window's beforeunload handler — must never reject.
   */
  async unlockAllProjectFiles() {
    if (!window.electronAPI || !window.electronAPI.unlockProjectFile) return;

    const unlockTasks = [];
    this.projects.forEach(project => {
      (project.files || []).forEach(file => {
        const lockId = file.lockInfo && file.lockInfo.lockId;
        if (!lockId) return;

        const filePath = this.getFileAbsolutePath(file);
        if (!filePath) return;

        unlockTasks.push(
          window.electronAPI
            .unlockProjectFile(filePath, lockId)
            .then(() => {
              delete file.lockInfo;
            })
            .catch(error => {
              console.warn(`Failed to unlock file ${file.name}:`, error);
            })
        );
      });
    });

    if (unlockTasks.length > 0) {
      await Promise.allSettled(unlockTasks);
    }
  }

  /**
   * Mark project as modified
   */
  markProjectAsModified() {
    if (this.currentProject) {
      this.currentProject.hasUnsavedChanges = true;
      this.currentProject.modified = new Date().toISOString();
      this.updateSaveButtonState();
    }
  }

  /**
   * Mark project as saved (clears the dirty flag)
   */
  markProjectAsSaved() {
    if (this.currentProject) {
      this.currentProject.hasUnsavedChanges = false;
      delete this.currentProject.justLoaded;
      this.updateSaveButtonState();
    }
  }

  /**
   * Reflect the dirty state on the save buttons (stable `.btn-save-project`
   * selector) and on the dedicated status-bar indicator.
   */
  updateSaveButtonState() {
    const hasChanges = !!(this.currentProject && this.currentProject.hasUnsavedChanges);

    document.querySelectorAll('.btn-save-project').forEach(btn => {
      btn.textContent = hasChanges ? '💾 Save *' : '💾 Save';
      btn.title = hasChanges
        ? 'Save project - You have unsaved changes (Ctrl/Cmd+S)'
        : 'Save current project (Ctrl/Cmd+S)';
      btn.classList.toggle('has-unsaved-changes', hasChanges);
    });

    const indicator = document.getElementById('saveStateIndicator');
    if (indicator) {
      indicator.textContent = hasChanges ? '● Unsaved changes' : '';
    }
  }

  /**
   * Notify the rest of the app (main window, genomic-data downloader, ...)
   * about the currently active project.
   */
  async notifyProjectChange(project) {
    if (!project || !window.electronAPI || !window.electronAPI.setActiveProject) return;

    try {
      const projectInfo = {
        id: project.id,
        name: project.name,
        location: project.location,
        dataFolderPath: project.dataFolderPath || (project.location ? `${project.location}/data` : null),
        projectFilePath: project.projectFilePath || project.filePath || null,
      };

      await window.electronAPI.setActiveProject(projectInfo);
    } catch (error) {
      console.error('Error notifying project change:', error);
    }
  }
}

// Ensure the class is available globally
if (typeof window !== 'undefined') {
  window.ProjectManagerWindow = ProjectManagerWindow;
}
