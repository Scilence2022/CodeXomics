/**
 * ProjectManagerWindow - 独立项目管理器窗口的核心类
 * 专门为项目管理器窗口设计的功能模块
 */
class ProjectManagerWindow {
    constructor() {
        this.projects = new Map();
        this.currentProject = null;
        this.currentPath = [];
        this.selectedFiles = new Set();
        this.sortBy = 'name';
        this.showHiddenFiles = false;
        this.showFileExtensions = true;
        this.isCompactMode = false;
        this.compactTreeMode = false;
        this.ultraCompactMode = false;
        this.headerCollapsed = false;
        this.detailsOpen = false;
        this.currentViewMode = 'grid'; // Add view mode tracking
        this.viewMode = 'grid'; // For compatibility
        
        // Enhanced project management features
        this.fileRelationships = new Map(); // Track file relationships
        this.projectTemplates = new Map(); // Store project templates
        this.searchIndex = new Map(); // Search index for files
        this.fileWatcher = null; // File system watcher
        
        // File type configurations
        this.fileTypes = {
            'fasta': { icon: 'FA', color: '#28a745' },
            'genbank': { icon: 'GB', color: '#17a2b8' },
            'gff': { icon: 'GFF', color: '#007bff' },
            'bed': { icon: 'BED', color: '#fd7e14' },
            'vcf': { icon: 'VCF', color: '#6f42c1' },
            'sam': { icon: 'SAM', color: '#e83e8c' },
            'bam': { icon: 'BAM', color: '#dc3545' },
            'fastq': { icon: 'FQ', color: '#20c997' },
            'txt': { icon: 'TXT', color: '#6c757d' },
            'csv': { icon: 'CSV', color: '#198754' },
            'json': { icon: 'JS', color: '#ffc107' },
            'xml': { icon: 'XML', color: '#0d6efd' },
            'html': { icon: 'HTM', color: '#fd7e14' },
            'pdf': { icon: 'PDF', color: '#dc3545' },
            'log': { icon: 'LOG', color: '#6c757d' },
            'tsv': { icon: 'TSV', color: '#198754' }
        };
        
        this.expandedProjects = new Set();
        this.expandedFolders = new Set();
        this.currentContextFolderPath = null;
        this.clipboard = null;
        
        this.initialize();
    }

    async initialize() {
        console.log('Initializing Project Manager Window...');
        
        // 加载项目数据
        await this.loadProjects();
        
        // 初始化UI
        this.setupEventListeners();
        this.renderProjectTree();
        this.updateStatusBar('Ready');
        
        // 初始化简约模式
        this.initializeCompactMode();
        
        // 初始化树视图事件和设置
        this.initializeTreeViewEvents();
        
        // 初始化Header事件和设置
        this.initializeHeaderEvents();
        
        console.log('Project Manager Window initialized successfully');
    }

    setupEventListeners() {
        // 搜索功能
        const searchBox = document.getElementById('searchBox');
        if (searchBox) {
            searchBox.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.renderProjectContent();
            });
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
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
                switch(e.key) {
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

        // 点击外部关闭模态框
        window.addEventListener('click', (e) => {
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    // ====== 项目管理功能 ======

    createNewProject() {
        const modal = document.getElementById('newProjectModal');
        if (modal) {
            // 清空表单
            document.getElementById('projectName').value = '';
            document.getElementById('projectDescription').value = '';
            document.getElementById('projectLocation').value = '';
            modal.style.display = 'block';
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
                // 浏览器环境下的回退方案
                const input = document.createElement('input');
                input.type = 'file';
                input.webkitdirectory = true;
                input.onchange = (e) => {
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

        try {
            const projectId = this.generateId();
            const project = {
                id: projectId,
                name: name,
                description: description,
                location: location || 'Default',
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                files: [],
                folders: [
                    { name: 'Genomes', icon: '🧬', path: ['genomes'], files: [] },
                    { name: 'Annotations', icon: '📋', path: ['annotations'], files: [] },
                    { name: 'Variants', icon: '🔄', path: ['variants'], files: [] },
                    { name: 'Reads', icon: '📊', path: ['reads'], files: [] },
                    { name: 'Analysis', icon: '📈', path: ['analysis'], files: [] }
                ],
                metadata: {
                    totalFiles: 0,
                    totalSize: 0,
                    lastOpened: new Date().toISOString()
                }
            };

            this.projects.set(projectId, project);
            await this.saveProjects();
            
            this.renderProjectTree();
            this.selectProject(projectId);
            this.closeModal('newProjectModal');
            
            this.showNotification(`Project "${name}" created successfully`, 'success');
            
        } catch (error) {
            console.error('Error creating project:', error);
            this.showNotification('Failed to create project', 'error');
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

    selectProject(projectId) {
        this.currentProject = this.projects.get(projectId);
        this.currentPath = [];
        
        if (this.currentProject) {
            this.currentProject.metadata.lastOpened = new Date().toISOString();
            
            // 更新UI
            this.renderProjectContent();
            this.updateActiveTreeItem(projectId);
            this.updateContentTitle();
            
            // 显示项目内容
            document.getElementById('projectOverview').style.display = 'none';
            document.getElementById('projectContent').style.display = 'block';
            
            this.updateStatusBar(`Opened: ${this.currentProject.name}`);
            this.saveProjects(); // 保存最后打开时间
            
            // 更新详细信息面板
            this.updateDetailsPanel();
            
            // 自动刷新Projects & Workspaces显示
            this.autoRefreshProjectsAndWorkspaces();
        }
    }

    // ====== UI渲染功能 ======

    renderProjectTree() {
        const projectTree = document.getElementById('projectTree');
        if (!projectTree) return;

        let html = '';
        
        if (this.projects.size === 0) {
            html = `
                <div style="padding: 20px; text-align: center; color: #6c757d;">
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
                
                // 整合图标：展开状态 + 项目图标
                let combinedIcon = '🗂️';
                if (hasChildren) {
                    combinedIcon = isExpanded ? '📂' : '📁';
                }
                
                html += `
                    <div class="tree-item project ${isActive ? 'active' : ''}" 
                         data-project-id="${projectId}">
                        <div class="tree-item-content" onclick="projectManagerWindow.selectProject('${projectId}')">
                            <div class="tree-icon tree-main-icon" onclick="event.stopPropagation(); projectManagerWindow.toggleProjectExpansion('${projectId}')"
                                 style="cursor: ${hasChildren ? 'pointer' : 'default'};">
                                ${combinedIcon}
                            </div>
                            <span class="tree-label" title="${project.description || project.name}">${project.name}</span>
                            <div class="tree-actions">
                                <button class="tree-action-btn" onclick="event.stopPropagation(); projectManagerWindow.showProjectContextMenu(event, '${projectId}')" title="More options">⋯</button>
                            </div>
                        </div>
                `;
                
                // 显示项目内容（如果项目被选中和展开）
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
     * 渲染文件夹树结构
     */
    renderFolderTree(folders, files, level = 0) {
        let html = '';
        // 根据当前模式决定缩进大小 - 大幅减少缩进
        let baseIndent = 8; // 减少到8px（约半个图标宽度）
        if (this.ultraCompactMode) {
            baseIndent = 4;
        } else if (this.compactTreeMode) {
            baseIndent = 6;
        }
        const indent = level * baseIndent;
        
        // 首先渲染文件夹
        folders.forEach(folder => {
            const isCurrentPath = this.arraysEqual(this.currentPath, folder.path);
            const folderId = folder.path.join('/');
            const isExpanded = this.expandedFolders && this.expandedFolders.has(folderId);
            
            // 获取该文件夹下的文件
            const folderFiles = files.filter(file => 
                file.folder && this.arraysEqual(file.folder, folder.path)
            );
            
            // 获取该文件夹下的子文件夹
            const subFolders = folders.filter(f => 
                f.path.length === folder.path.length + 1 && 
                this.arraysEqual(f.path.slice(0, -1), folder.path)
            );
            
            const hasChildren = folderFiles.length > 0 || subFolders.length > 0;
            
            // 整合图标：展开状态 + 文件夹图标
            let combinedIcon = folder.icon || '📁';
            if (hasChildren) {
                combinedIcon = isExpanded ? '📂' : '📁';
            }
            
            html += `
                <div class="tree-item folder ${isCurrentPath ? 'active' : ''}" 
                     style="margin-left: ${indent}px;"
                     data-folder-path="${JSON.stringify(folder.path).replace(/"/g, '&quot;')}">
                    <div class="tree-item-content">
                        <div class="tree-icon tree-main-icon" onclick="event.stopPropagation(); projectManagerWindow.toggleFolderExpansion('${folderId}')"
                             style="cursor: ${hasChildren ? 'pointer' : 'default'};">
                            ${combinedIcon}
                        </div>
                        <span class="tree-label" onclick="projectManagerWindow.navigateToFolder(${JSON.stringify(folder.path).replace(/"/g, '&quot;')})">${folder.name}</span>
                        <div class="tree-file-count">${folderFiles.length}</div>
                        <div class="tree-actions">
                            <button class="tree-action-btn" onclick="event.stopPropagation(); projectManagerWindow.showFolderContextMenu(event, ${JSON.stringify(folder.path).replace(/"/g, '&quot;')})" title="More options">⋯</button>
                        </div>
                    </div>
            `;
            
            // 如果文件夹展开，显示其内容
            if (isExpanded && hasChildren) {
                html += '<div class="tree-children">';
                
                // 显示子文件夹
                if (subFolders.length > 0) {
                    html += this.renderFolderTree(subFolders, files, level + 1);
                }
                
                // 显示文件
                folderFiles.forEach(file => {
                    const fileType = this.detectFileType(file.name);
                    const typeConfig = this.fileTypes[fileType] || { icon: '📄', color: '#6c757d' };
                    const isSelected = this.selectedFiles && this.selectedFiles.has(file.id);
                    const fileIndent = (level + 1) * baseIndent;
                    
                    // 动态调整文件图标大小
                    let iconSize = '14px'; // 稍微减小图标
                    let fontSize = '7px';
                    if (this.ultraCompactMode) {
                        iconSize = '10px';
                        fontSize = '6px';
                    } else if (this.compactTreeMode) {
                        iconSize = '12px';
                        fontSize = '6px';
                    }
                    
                    html += `
                        <div class="tree-item file ${isSelected ? 'selected' : ''}" 
                             style="margin-left: ${fileIndent}px;"
                             data-file-id="${file.id}">
                            <div class="tree-item-content" 
                                 onclick="projectManagerWindow.selectFile('${file.id}', event.ctrlKey || event.metaKey)"
                                 ondblclick="projectManagerWindow.openFileInMainWindow('${file.id}')">
                                <div class="tree-icon file-icon" style="background-color: ${typeConfig.color}; color: white; font-size: ${fontSize}; width: ${iconSize}; height: ${iconSize}; border-radius: 3px; display: flex; align-items: center; justify-content: center;">${typeConfig.icon}</div>
                                <span class="tree-label" title="${file.name}">${file.name}</span>
                                <div class="tree-file-size">${this.formatFileSize(file.size || 0)}</div>
                                <div class="tree-actions">
                                    <button class="tree-action-btn" onclick="event.stopPropagation(); projectManagerWindow.showFilePreview('${file.id}')" title="Preview">👁️</button>
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
     * 切换项目展开状态
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
     * 切换文件夹展开状态
     */
    toggleFolderExpansion(folderId) {
        if (!this.expandedFolders) {
            this.expandedFolders = new Set();
        }
        
        if (this.expandedFolders.has(folderId)) {
            this.expandedFolders.delete(folderId);
        } else {
            this.expandedFolders.add(folderId);
        }
        
        this.renderProjectTree();
    }

    /**
     * 选择项目时自动展开
     */
    selectProject(projectId) {
        this.currentProject = this.projects.get(projectId);
        this.currentPath = [];
        
        if (this.currentProject) {
            this.currentProject.metadata.lastOpened = new Date().toISOString();
            
            // 自动展开选中的项目
            if (!this.expandedProjects) {
                this.expandedProjects = new Set();
            }
            this.expandedProjects.add(projectId);
            
            // 更新UI
            this.renderProjectContent();
            this.updateActiveTreeItem(projectId);
            this.updateContentTitle();
            
            // 显示项目内容
            document.getElementById('projectOverview').style.display = 'none';
            document.getElementById('projectContent').style.display = 'block';
            
            this.updateStatusBar(`Opened: ${this.currentProject.name}`);
            this.saveProjects(); // 保存最后打开时间
            
            // 更新详细信息面板
            this.updateDetailsPanel();
            
            // 自动刷新Projects & Workspaces显示
            this.autoRefreshProjectsAndWorkspaces();
        }
    }

    /**
     * 增强的创建子文件夹功能
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
            parent: basePath.length > 0 ? basePath : null
        };

        // Check if folder already exists
        const existingFolder = this.currentProject.folders.find(f => 
            this.arraysEqual(f.path, newPath)
        );
        
        if (existingFolder) {
            this.showNotification(`Folder "${folderName}" already exists at this location`, 'warning');
            return;
        }

        this.currentProject.folders.push(folder);
        this.currentProject.modified = new Date().toISOString();
        
        // 自动展开父文件夹
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
            description: `Created subfolder "${folderName}" in ${basePath.length > 0 ? basePath.join('/') : 'root'}`
        });
        
        this.saveProjects();
        
        // Also save as XML if possible to ensure persistence
        if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
            this.saveProjectAsXML();
        }
        
        this.renderProjectTree();
        this.showNotification(`Subfolder "${folderName}" created successfully`, 'success');
        
        console.log(`📁 Created subfolder: ${folderName} at path: ${newPath.join('/')}`);
    }

    /**
     * 右键菜单相关方法
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
        // 隐藏所有上下文菜单
        document.querySelectorAll('.context-menu').forEach(m => m.style.display = 'none');
        
        // 显示指定菜单
        menu.style.display = 'block';
        menu.style.left = (event.clientX + 10) + 'px';
        menu.style.top = (event.clientY + 10) + 'px';

        // 确保菜单在视窗内
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (event.clientX - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (event.clientY - rect.height) + 'px';
        }
    }

    hideContextMenus() {
        document.querySelectorAll('.context-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }

    /**
     * 增强的addSubfolder方法
     */
    addSubfolder() {
        this.hideContextMenus();
        if (!this.currentContextFolderPath || !this.currentProject) return;
        
        this.createSubfolderInPath(this.currentContextFolderPath);
    }

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
        
        container.style.display = 'block'; // Ensure grid is visible

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

        container.innerHTML = filteredFiles.map(file => {
            const fileType = this.detectFileType(file.name);
            const typeConfig = this.fileTypes[fileType] || { icon: '📄', color: '#6c757d' };
            const isSelected = this.selectedFiles.has(file.id);

            return `
                <div class="file-card ${isSelected ? 'selected' : ''}" 
                     data-file-id="${file.id}"
                     onclick="projectManagerWindow.selectFile('${file.id}', event.ctrlKey || event.metaKey)"
                     ondblclick="projectManagerWindow.previewFile('${file.id}')"
                     oncontextmenu="projectManagerWindow.showFileContextMenu(event, '${file.id}')">
                    <div class="file-icon" style="background-color: ${typeConfig.color}">
                        ${typeConfig.icon}
                    </div>
                    <div class="file-info">
                        <div class="file-name" title="${file.name}">${file.name}</div>
                        <div class="file-details">
                            <span class="file-size">${this.formatFileSize(file.size)}</span>
                            <span class="file-date">${this.formatDate(file.modified)}</span>
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="file-action-btn" onclick="event.stopPropagation(); projectManagerWindow.previewFile('${file.id}')" title="Preview">
                            👁️
                        </button>
                        <button class="file-action-btn" onclick="event.stopPropagation(); projectManagerWindow.renameFile('${file.id}')" title="Rename">
                            ✏️
                        </button>
                        <button class="file-action-btn" onclick="event.stopPropagation(); projectManagerWindow.deleteFile('${file.id}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        this.updateFileCountDisplay(filteredFiles.length);
    }

    // ====== 文件管理功能 ======

    async addFiles() {
        if (!this.currentProject) {
            this.showNotification('Please select a project first', 'warning');
            return;
        }

        try {
            if (window.electronAPI && window.electronAPI.selectMultipleFiles) {
                const result = await window.electronAPI.selectMultipleFiles();
                if (result.success && !result.canceled && result.filePaths.length > 0) {
                    await this.processSelectedFiles(result.filePaths);
                }
            } else {
                // 浏览器环境的回退方案
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = '.fasta,.fa,.gff,.gtf,.vcf,.bam,.sam,.wig,.bed,.gb,.gbk';
                input.onchange = (e) => {
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

    async processSelectedFiles(filePaths) {
        let addedCount = 0;
        
        for (const filePath of filePaths) {
            try {
                let fileInfo;
                if (window.electronAPI && window.electronAPI.getFileInfo) {
                    const result = await window.electronAPI.getFileInfo(filePath);
                    if (result.success) {
                        fileInfo = result.info;
                    }
                } else {
                    // 从路径提取基本信息
                    const fileName = filePath.split('/').pop() || filePath.split('\\').pop();
                    fileInfo = {
                        name: fileName,
                        size: 0,
                        modified: new Date().toISOString()
                    };
                }
                
                if (fileInfo) {
                    const file = {
                        id: this.generateId(),
                        name: fileInfo.name,
                        path: filePath,
                        size: fileInfo.size || 0,
                        type: this.detectFileType(fileInfo.name),
                        folder: [...this.currentPath],
                        added: new Date().toISOString(),
                        modified: fileInfo.modified || new Date().toISOString()
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
        
        for (const file of files) {
            const fileObj = {
                id: this.generateId(),
                name: file.name,
                path: file.name, // 在浏览器环境中使用文件名作为路径
                size: file.size,
                type: this.detectFileType(file.name),
                folder: [...this.currentPath],
                added: new Date().toISOString(),
                modified: new Date(file.lastModified).toISOString()
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
        const newPath = this.currentPath.length > 0 
            ? [...this.currentPath, folderName.trim().toLowerCase()]
            : [folderName.trim().toLowerCase()];
            
        const folder = {
            name: folderName.trim(),
            icon: '📁',
            path: newPath,
            files: [],  // Ensure files array is present
            created: new Date().toISOString(),
            custom: true  // Mark as user-created folder
        };

        // Check if folder already exists
        const existingFolder = this.currentProject.folders.find(f => 
            this.arraysEqual(f.path, newPath)
        );
        
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
            description: `Created folder "${folderName}" at ${newPath.join('/')}`
        });
        
        this.saveProjects();
        
        // Also save as XML if possible to ensure persistence
        if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
            this.saveProjectAsXML();
        }
        
        this.renderProjectTree();
        this.showNotification(`Folder "${folderName}" created successfully`, 'success');
        
        console.log(`📁 Created folder: ${folderName} at path: ${newPath.join('/')}`);
    }

    async saveProjectAsXML() {
        if (!this.currentProject) return;
        
        try {
            // Initialize XML handler if needed
            if (!this.xmlHandler) {
                this.xmlHandler = new ProjectXMLHandler();
            }
            
            // Generate XML content
            const xmlContent = this.xmlHandler.projectToXML(this.currentProject);
            
            if (window.electronAPI && window.electronAPI.saveProjectFile) {
                // Use existing file path or create new one
                const fileName = this.currentProject.xmlFileName || `${this.currentProject.name}.prj.GAI`;
                const result = await window.electronAPI.saveProjectFile(fileName, xmlContent);
                
                if (result.success) {
                    this.currentProject.xmlFilePath = result.filePath;
                    this.currentProject.xmlFileName = fileName;
                    this.currentProject.modified = new Date().toISOString();
                    
                    console.log(`✅ Project XML saved: ${result.filePath}`);
                    return result.filePath;
                } else {
                    console.warn('Failed to save project XML:', result.error);
                }
            }
        } catch (error) {
            console.error('Error saving project as XML:', error);
        }
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

    // ====== 工具方法 ======

    /**
     * 获取文件的绝对路径
     * @param {Object} file - 文件对象
     * @returns {string} 绝对路径
     */
    getFileAbsolutePath(file) {
        if (!file || !this.currentProject) return '';
        
        // 如果文件有绝对路径，直接返回
        if (file.absolutePath) {
            return file.absolutePath;
        }
        
        // 如果文件有相对路径，构建绝对路径
        if (file.path && this.currentProject.dataFolderPath) {
            const path = require('path');
            // 确保使用正确的路径分隔符
            const normalizedRelativePath = file.path.replace(/\\/g, '/');
            return path.resolve(this.currentProject.dataFolderPath, normalizedRelativePath);
        }
        
        // 兜底情况 - 使用动态项目目录名称构建路径
        if (file.path && this.currentProject.name) {
            const path = require('path');
            const os = require('os');
            
            // 使用动态项目目录名称
            const documentsPath = path.join(os.homedir(), 'Documents');
            const projectsDir = path.join(documentsPath, 'Genome AI Studio Projects');
            const projectDataPath = path.join(projectsDir, this.currentProject.name);
            
            const normalizedRelativePath = file.path.replace(/\\/g, '/');
            return path.resolve(projectDataPath, normalizedRelativePath);
        }
        
        // 最后的兜底情况
        return file.path || '';
    }

    /**
     * 获取文件的项目相对路径
     * @param {Object} file - 文件对象
     * @returns {string} 项目相对路径
     */
    getFileProjectRelativePath(file) {
        if (!file) return '';
        
        // 如果已有项目相对路径，直接返回
        if (file.path && !file.path.startsWith('/') && !file.path.includes(':\\')) {
            return file.path;
        }
        
        // 如果有绝对路径，转换为相对路径
        if (file.absolutePath && this.currentProject && this.currentProject.dataFolderPath) {
            const path = require('path');
            const relativePath = path.relative(this.currentProject.dataFolderPath, file.absolutePath);
            return relativePath.replace(/\\/g, '/');
        }
        
        return file.name || '';
    }

    /**
     * 规范化文件路径存储
     * @param {Object} file - 文件对象
     * @returns {Object} 规范化后的文件对象
     */
    normalizeFilePaths(file) {
        if (!file || !this.currentProject) return file;
        
        const normalizedFile = { ...file };
        
        // 确保有项目相对路径
        normalizedFile.path = this.getFileProjectRelativePath(file);
        
        // 如果没有绝对路径，尝试构建
        if (!normalizedFile.absolutePath && this.currentProject.dataFolderPath) {
            const path = require('path');
            normalizedFile.absolutePath = path.resolve(this.currentProject.dataFolderPath, normalizedFile.path);
        }
        
        return normalizedFile;
    }

    /**
     * 建立文件关系（如配对的reads文件、注释文件等）
     * @param {Array} files - 文件数组
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
     * 检测文件关系
     * @param {Object} file - 目标文件
     * @param {Array} allFiles - 所有文件
     * @returns {Array} 相关文件列表
     */
    detectFileRelationships(file, allFiles) {
        const relationships = [];
        const fileName = file.name.toLowerCase();
        const baseName = fileName.replace(/\.[^/.]+$/, ''); // Remove extension
        
        // 检测配对的reads文件 (R1/R2, _1/_2, forward/reverse)
        if (fileName.includes('_r1') || fileName.includes('_1') || fileName.includes('forward')) {
            const pairPattern = fileName.replace(/(_r1|_1|forward)/, '(_r2|_2|reverse)');
            const pair = allFiles.find(f => f.name.toLowerCase().match(new RegExp(pairPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
            if (pair) {
                relationships.push({ type: 'paired_reads', file: pair });
            }
        }
        
        // 检测注释文件关系 (同名不同扩展名)
        const annotationExtensions = ['.gff', '.gff3', '.gtf', '.bed', '.vcf'];
        const genomeExtensions = ['.fasta', '.fa', '.fas', '.gb', '.gbk'];
        
        if (genomeExtensions.some(ext => fileName.endsWith(ext))) {
            annotationExtensions.forEach(ext => {
                const annotationFile = allFiles.find(f => 
                    f.name.toLowerCase().startsWith(baseName) && 
                    f.name.toLowerCase().endsWith(ext)
                );
                if (annotationFile) {
                    relationships.push({ type: 'annotation', file: annotationFile });
                }
            });
        }
        
        // 检测索引文件关系
        const indexFile = allFiles.find(f => 
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
     * 智能文件分类
     * @param {Array} files - 文件数组
     * @returns {Object} 分类结果
     */
    smartFileClassification(files) {
        const classification = {
            genomes: [],
            annotations: [],
            variants: [],
            reads: [],
            analysis: [],
            others: []
        };
        
        files.forEach(file => {
            const fileName = file.name.toLowerCase();
            const fileType = file.type;
            
            // 基因组文件
            if (fileType === 'fasta' || fileType === 'genbank' || 
                fileName.includes('genome') || fileName.includes('reference')) {
                classification.genomes.push(file);
            }
            // 注释文件
            else if (fileType === 'gff' || fileType === 'bed' || 
                     fileName.includes('annotation') || fileName.includes('gene')) {
                classification.annotations.push(file);
            }
            // 变异文件
            else if (fileType === 'vcf' || fileName.includes('variant') || 
                     fileName.includes('snp') || fileName.includes('indel')) {
                classification.variants.push(file);
            }
            // 测序数据
            else if (fileType === 'fastq' || fileType === 'bam' || fileType === 'sam' ||
                     fileName.includes('read') || fileName.includes('seq')) {
                classification.reads.push(file);
            }
            // 分析结果
            else if (fileName.includes('result') || fileName.includes('output') ||
                     fileName.includes('analysis') || fileName.includes('report')) {
                classification.analysis.push(file);
            }
            // 其他
            else {
                classification.others.push(file);
            }
        });
        
        return classification;
    }

    /**
     * 构建搜索索引
     * @param {Array} files - 文件数组
     */
    buildSearchIndex(files) {
        this.searchIndex.clear();
        
        files.forEach(file => {
            const searchTerms = [
                file.name.toLowerCase(),
                file.type,
                ...(file.tags || []),
                ...(file.folder || []),
                file.path.toLowerCase()
            ];
            
            // 添加元数据搜索项
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
     * 高级搜索
     * @param {string} query - 搜索查询
     * @returns {Array} 匹配的文件
     */
    advancedSearch(query) {
        if (!query || query.trim() === '') return [];
        
        const searchTerms = query.toLowerCase().split(/\s+/);
        const matchingFileIds = new Set();
        
        searchTerms.forEach(term => {
            // 精确匹配
            if (this.searchIndex.has(term)) {
                this.searchIndex.get(term).forEach(fileId => matchingFileIds.add(fileId));
            }
            
            // 模糊匹配
            this.searchIndex.forEach((fileIds, indexTerm) => {
                if (indexTerm.includes(term)) {
                    fileIds.forEach(fileId => matchingFileIds.add(fileId));
                }
            });
        });
        
        // 返回匹配的文件对象
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
        if (!this.searchTerm) return files;
        
        return files.filter(file => 
            file.name.toLowerCase().includes(this.searchTerm)
        );
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
        // 如果有当前项目，扫描其目录并添加新文件/文件夹
        if (this.currentProject && this.currentProject.location) {
            await this.scanAndAddNewFiles();
            this.renderProjectTree();
            this.renderProjectContent();
            this.showNotification('🔄 Project directory scanned and refreshed', 'success');
        } else {
            // 如果没有当前项目，则正常加载项目列表
            this.loadProjects();
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

    // ====== 数据持久化 ======

    async saveProjects() {
        try {
            const projectsData = {
                projects: Object.fromEntries(this.projects),
                lastSaved: new Date().toISOString()
            };
            
            if (window.electronAPI && window.electronAPI.saveProjectsData) {
                const result = await window.electronAPI.saveProjectsData(projectsData);
                if (!result.success) {
                    throw new Error(result.error);
                }
            } else {
                // 浏览器环境下保存到localStorage
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
                // 浏览器环境下从localStorage加载
                const data = localStorage.getItem('genomeExplorer_projects');
                if (data) {
                    projectsData = JSON.parse(data);
                }
            }
            
            if (projectsData && projectsData.projects) {
                this.projects = new Map(Object.entries(projectsData.projects));
            }
            
            console.log(`Loaded ${this.projects.size} projects`);
        } catch (error) {
            console.error('Error loading projects:', error);
            this.projects = new Map();
        }
    }

    // ====== 工具函数 ======

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    detectFileType(fileName) {
        if (!fileName || typeof fileName !== 'string') {
            return 'unknown';
        }
        
        const parts = fileName.toLowerCase().split('.');
        if (parts.length < 2) {
            return 'text'; // 没有扩展名的文件默认为文本文件
        }
        
        const ext = '.' + parts.pop();
        
        for (const [type, config] of Object.entries(this.fileTypes)) {
            if (config.extensions && config.extensions.includes(ext)) {
                return type;
            }
        }
        
        return 'unknown';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 10) / 10 + ' ' + sizes[i];
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
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
        
        // 简单的通知实现
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
            color: white;
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
     * 自动刷新Projects & Workspaces显示
     */
    autoRefreshProjectsAndWorkspaces() {
        console.log('🔄 Auto-refreshing Projects & Workspaces...');
        
        // 刷新项目树视图
        this.renderProjectTree();
        
        // 如果当前有选中的项目，也刷新其内容
        if (this.currentProject) {
            this.renderProjectContent();
        }
        
        // 更新状态栏
        const projectCount = this.projects.size;
        const activeProjectName = this.currentProject ? this.currentProject.name : 'None';
        this.updateStatusBar(`Refreshed: ${projectCount} projects | Active: ${activeProjectName}`);
        
        // 通知用户刷新完成
        console.log('✅ Projects & Workspaces refreshed successfully');
        
        // 3秒后恢复正常状态栏
        setTimeout(() => {
            if (this.currentProject) {
                this.updateStatusBar(`Opened: ${this.currentProject.name}`);
            } else {
                this.updateStatusBar('Ready');
            }
        }, 3000);
    }

    /**
     * 手动刷新按钮功能
     */
    async manualRefreshProjects() {
        await this.loadProjects();
        
        // If a project is currently open, scan its folder for new files
        if (this.currentProject && this.currentProject.location) {
            await this.scanAndAddNewFiles();
        }
        
        this.autoRefreshProjectsAndWorkspaces();
        this.showNotification('Projects refreshed manually', 'success');
    }

    /**
     * 扫描项目文件夹并添加新文件和文件夹
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

                    // 标记项目为已修改，这样保存按钮就会保存到.prj.GAI文件
                    this.markProjectAsModified();

                    // Save changes to both localStorage and XML
                    await this.saveProjects();
                    
                    // Auto-save as XML to ensure persistence
                    if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
                        await this.saveProjectAsXML();
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
                        projectPath: projectPath
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

    // ====== 菜单系统功能实现 ======

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

    async exportProjectArchive() {
        if (!this.currentProject) {
            this.showNotification('No project to export', 'warning');
            return;
        }
        
        try {
            if (window.electronAPI && window.electronAPI.selectDirectory) {
                const result = await window.electronAPI.selectDirectory();
                if (result.success && !result.canceled) {
                    // Create archive with project files and data
                    this.showNotification(`Project archive export initiated to: ${result.filePath}`, 'info');
                    // TODO: Implement actual archive creation
                }
            } else {
                this.showNotification('Archive export not available in browser mode', 'warning');
            }
        } catch (error) {
            console.error('Error exporting project archive:', error);
            this.showNotification('Failed to export project archive', 'error');
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
    
    undoLastAction() {
        if (!this.currentProject || !this.currentProject.history) {
            this.showNotification('No actions to undo', 'info');
            return;
        }
        
        if (this.currentProject.history.length === 0) {
            this.showNotification('No actions to undo', 'info');
            return;
        }
        
        const lastAction = this.currentProject.history.shift();
        this.showNotification(`Undid: ${lastAction.description}`, 'info');
        // TODO: Implement actual undo logic based on action type
    }

    redoLastAction() {
        // TODO: Implement redo functionality with redo stack
        this.showNotification('Redo functionality coming soon', 'info');
    }

    cutSelectedFiles() {
        if (this.selectedFiles.size === 0) {
            this.showNotification('No files selected to cut', 'warning');
            return;
        }
        
        this.clipboard = {
            operation: 'cut',
            files: Array.from(this.selectedFiles).map(id => this.findFileById(id)).filter(f => f)
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
            files: Array.from(this.selectedFiles).map(id => this.findFileById(id)).filter(f => f)
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
        this.currentProject.files.forEach(file => {
            if (file.name.includes(findTerm)) {
                file.name = file.name.replace(new RegExp(findTerm, 'g'), replaceTerm);
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
            const typeConfig = this.fileTypes[fileType] || { icon: '📄', color: '#6c757d' };
            const isSelected = this.selectedFiles && this.selectedFiles.has(file.id);

            html += `
                <div class="file-list-item ${isSelected ? 'selected' : ''}" 
                     draggable="true"
                     onclick="projectManagerWindow.selectFile('${file.id}', event.ctrlKey || event.metaKey)"
                     ondblclick="projectManagerWindow.openFileInMainWindow('${file.id}')"
                     oncontextmenu="projectManagerWindow.showFileContextMenu(event, '${file.id}')"
                     data-file-id="${file.id}">
                    <div class="file-icon-small" style="background-color: ${typeConfig.color}">
                        ${typeConfig.icon}
                    </div>
                    <div class="file-name" title="${file.name}">${file.name}</div>
                    <div class="file-size">${this.formatFileSize(file.size || 0)}</div>
                    <div class="file-date">${file.modified ? this.formatDate(file.modified) : 'Unknown'}</div>
                    <div class="file-actions-list">
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.showFilePreview('${file.id}')" title="Preview">👁️</button>
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.renameFile('${file.id}')" title="Rename">✏️</button>
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.deleteFile('${file.id}')" title="Delete">🗑️</button>
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
            const typeConfig = this.fileTypes[fileType] || { icon: '📄', color: '#6c757d' };
            const isSelected = this.selectedFiles && this.selectedFiles.has(file.id);

            html += `
                <tr class="${isSelected ? 'selected' : ''}"
                    draggable="true"
                    onclick="projectManagerWindow.selectFile('${file.id}', event.ctrlKey || event.metaKey)"
                    ondblclick="projectManagerWindow.openFileInMainWindow('${file.id}')"
                    oncontextmenu="projectManagerWindow.showFileContextMenu(event, '${file.id}')"
                    data-file-id="${file.id}">
                    <td>
                        <div class="file-icon-small" style="background-color: ${typeConfig.color}">
                            ${typeConfig.icon}
                        </div>
                    </td>
                    <td class="file-name" title="${file.name}">${file.name}</td>
                    <td>${fileType.toUpperCase()}</td>
                    <td>${this.formatFileSize(file.size || 0)}</td>
                    <td>${file.modified ? this.formatDate(file.modified) : 'Unknown'}</td>
                    <td class="file-actions-details">
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.showFilePreview('${file.id}')" title="Preview">👁️</button>
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.renameFile('${file.id}')" title="Rename">✏️</button>
                        <button class="file-action-btn-small" onclick="event.stopPropagation(); projectManagerWindow.deleteFile('${file.id}')" title="Delete">🗑️</button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
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

    // ==================== PROJECT MENU METHODS ====================
    
    showProjectProperties() {
        if (!this.currentProject) {
            this.showNotification('No project selected', 'warning');
            return;
        }
        
        const properties = `
📁 Project Properties

Name: ${this.currentProject.name}
Description: ${this.currentProject.description || 'No description'}
Location: ${this.currentProject.location || 'Unknown'}
Created: ${this.formatDate(this.currentProject.created)}
Modified: ${this.formatDate(this.currentProject.modified)}

📊 Statistics:
Files: ${this.currentProject.files?.length || 0}
Folders: ${this.currentProject.folders?.length || 0}
Total Size: ${this.formatFileSize(this.currentProject.metadata?.totalSize || 0)}

🔧 Status:
Has Unsaved Changes: ${this.currentProject.hasUnsavedChanges ? 'Yes' : 'No'}
Project File: ${this.currentProject.projectFilePath || 'Not set'}
Data Folder: ${this.currentProject.dataFolderPath || 'Not set'}
        `.trim();
        
        alert(properties);
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
${Object.entries(stats.fileTypes).map(([type, count]) => `• ${type}: ${count}`).join('\n')}

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
            
            // Auto-organize by file type
            switch (fileType) {
                case 'fasta':
                case 'genbank':
                    targetFolder = ['Genomes'];
                    break;
                case 'gff':
                case 'bed':
                    targetFolder = ['Annotations'];
                    break;
                case 'vcf':
                    targetFolder = ['Variants'];
                    break;
                case 'bam':
                case 'sam':
                    targetFolder = ['Reads'];
                    break;
                default:
                    targetFolder = ['Analysis'];
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
        
        // Create date-based folders and move files
        const dateGroups = {};
        this.currentProject.files.forEach(file => {
            const date = new Date(file.created).toISOString().split('T')[0]; // YYYY-MM-DD
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
                    autoGenerated: true
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
            const hasFiles = this.currentProject.files.some(file => 
                this.arraysEqual(file.folder || [], folder.path)
            );
            
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
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        try {
                            const projectData = JSON.parse(event.target.result);
                            const newId = this.generateId();
                            projectData.id = newId;
                            projectData.name += ' (Restored)';
                            projectData.metadata.lastOpened = new Date().toISOString();
                            
                            this.projects.set(newId, projectData);
                            this.saveProjects();
                            this.renderProjectTree();
                            this.selectProject(newId);
                            this.showNotification('Project restored from backup', 'success');
                        } catch (error) {
                            console.error('Error parsing backup file:', error);
                            this.showNotification('Invalid backup file format', 'error');
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
        
        const confirm = window.confirm(
            `⚠️ DELETE PROJECT "${this.currentProject.name}"?\n\n` +
            'This action cannot be undone!\n\n' +
            'This will permanently delete:\n' +
            '• All project metadata\n' +
            '• File references (actual files may remain on disk)\n' +
            '• Project configuration\n\n' +
            'Type "DELETE" to confirm:'
        );
        
        if (confirm === 'DELETE') {
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

    convertFastaToGenBank() {
        this.showNotification('FASTA to GenBank conversion: Feature coming soon', 'info');
        // TODO: Implement actual conversion
    }

    convertGffToBed() {
        this.showNotification('GFF to BED conversion: Feature coming soon', 'info');
        // TODO: Implement actual conversion
    }

    showCustomConversionDialog() {
        const conversionOptions = [
            'FASTA to GenBank',
            'GenBank to FASTA',
            'GFF to BED',
            'BED to GFF',
            'VCF to BED',
            'Custom script...'
        ].join('\n');
        
        const choice = prompt(`Select conversion type:\n${conversionOptions}\n\nEnter conversion name:`);
        if (choice) {
            this.showNotification(`Custom conversion "${choice}": Feature coming soon`, 'info');
        }
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
                
                let newName = pattern
                    .replace(/{n}/g, counter)
                    .replace(/{name}/g, nameWithoutExt);
                
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
        
        const folderOptions = this.currentProject.folders.map(folder => 
            `${folder.name} (${folder.path.join('/')})`
        ).join('\n');
        
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
            `Delete ${this.selectedFiles.size} selected files?\n\n` +
            'This action cannot be undone!'
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

    openInExternalEditor() {
        if (this.selectedFiles.size === 0) {
            this.showNotification('Please select a file to open', 'warning');
            return;
        }
        
        const fileId = Array.from(this.selectedFiles)[0];
        const file = this.findFileById(fileId);
        
        if (file) {
            const filePath = this.getFileAbsolutePath(file);
            if (filePath && window.electronAPI && window.electronAPI.openFileInExternalEditor) {
                window.electronAPI.openFileInExternalEditor(filePath);
                this.showNotification(`Opening "${file.name}" in external editor`, 'info');
            } else if (!filePath) {
                this.showNotification('File path not available', 'error');
            } else {
                this.showNotification('External editor not available in browser mode', 'warning');
            }
        } else {
            this.showNotification('File not found', 'error');
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
• F5 - Refresh
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
• Drag files between folders to organize
• Export projects regularly for backup

For more help, visit the User Guide or report issues.
        `.trim();
        
        alert(helpContent);
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
   • Drag files between folders
   • Use auto-organize features

📁 File Management:
• VIEW MODES: Grid, List, Details
• SORTING: Name, Date, Size, Type
• SEARCH: Find files by name (Ctrl+F)
• SELECTION: Single click, Ctrl+click, range select

🔧 Advanced Features:
• BATCH OPERATIONS: Rename, move, delete multiple files
• FILE VALIDATION: Check integrity and find duplicates
• PROJECT BACKUP: Export and import projects
• CONVERSION TOOLS: Transform file formats

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
            
            const mailtoLink = `mailto:support@genomeaistudio.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
            // Try to open email client
            const a = document.createElement('a');
            a.href = mailtoLink;
            a.click();
            
            this.showNotification('Feedback email prepared - please send when ready', 'info');
        }
    }

    // Initialize clipboard for cut/copy/paste operations
    clipboard = null;

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
                    const fileName = result.fileName;
                    
                    // Determine file format and parse accordingly
                    if (fileName.toLowerCase().endsWith('.prj.gai') || fileName.toLowerCase().endsWith('.xml')) {
                        // XML format
                        if (!this.xmlHandler) {
                            this.xmlHandler = new ProjectXMLHandler();
                        }
                        project = this.xmlHandler.xmlToProject(content);
                    } else if (fileName.toLowerCase().endsWith('.json') || fileName.toLowerCase().endsWith('.genomeproj')) {
                        // JSON format
                        project = JSON.parse(content);
                    } else {
                        throw new Error(`Unsupported file format: ${fileName}`);
                    }
                    
                    // Validate project data
                    if (!project || !project.id || !project.name) {
                        throw new Error('Invalid project data structure');
                    }
                    
                    // Set up project paths for new directory structure
                    project.projectFilePath = filePath;
                    
                    // 检查是否为新结构（Project.GAI 在项目目录内）
                    if (fileName === 'Project.GAI') {
                        // 新结构：Project.GAI 在项目目录内
                        const projectDir = filePath.substring(0, filePath.lastIndexOf('/'));
                        project.dataFolderPath = projectDir;
                        project.location = projectDir.substring(0, projectDir.lastIndexOf('/'));
                    } else {
                        // 旧结构：ProjectName.prj.GAI 与项目目录平级
                        const projectDir = filePath.substring(0, filePath.lastIndexOf('/'));
                        project.dataFolderPath = `${projectDir}/${project.name}`;
                        project.location = projectDir;
                    }
                    
                    // Update project metadata
                    project.xmlFileName = fileName;
                    project.loadedFromFile = true;
                    project.lastOpened = new Date().toISOString();
                    project.isCurrentlyOpen = true;
                    project.hasUnsavedChanges = false;
                    
                    // Close previous project
                    if (this.currentProject) {
                        this.currentProject.isCurrentlyOpen = false;
                    }
                    
                    // Set as current project
                    this.currentProject = project;
                    this.projects.set(project.id, project);
                    await this.saveProjects();
                    
                    // Update UI
                    this.renderProjectTree();
                    this.selectProject(project.id);
                    
                    // Auto-scan project directory after loading to ensure workspace shows current files
                    setTimeout(async () => {
                        console.log('🔄 Auto-scanning project directory after loading...');
                        console.log('🔍 Current project:', this.currentProject?.name);
                        console.log('🔍 Project location:', this.currentProject?.location);
                        console.log('🔍 Data folder path:', this.currentProject?.dataFolderPath);
                        console.log('🔍 ElectronAPI available:', !!window.electronAPI);
                        console.log('🔍 scanProjectFolder available:', !!window.electronAPI?.scanProjectFolder);
                        
                        // Force scan execution even if initial state is empty
                        if (this.currentProject) {
                            // Ensure project has basic array structures
                            if (!this.currentProject.files) {
                                this.currentProject.files = [];
                                console.log('📁 Initialized empty files array');
                            }
                            if (!this.currentProject.folders) {
                                this.currentProject.folders = [];
                                console.log('📁 Initialized empty folders array');
                            }
                            
                            // Execute scan
                            try {
                                await this.scanAndAddNewFiles();
                                console.log('✅ Directory scan completed');
                            } catch (error) {
                                console.error('❌ Directory scan failed:', error);
                                // If scan fails, at least ensure basic structure is displayed
                                this.showNotification('Directory scan failed, but project loaded. Use manual refresh.', 'warning');
                            }
                        }
                        
                        // Force UI refresh regardless of scan success
                        this.renderProjectTree();
                        if (this.currentProject) {
                            this.selectProject(this.currentProject.id);
                            this.renderProjectContent(); // Ensure workspace content is also refreshed
                        }
                        
                        console.log('🎯 UI refresh completed - check workspace for files/folders');
                        console.log('📊 Final project state:', {
                            files: this.currentProject?.files?.length || 0,
                            folders: this.currentProject?.folders?.length || 0
                        });
                    }, 300);
                    
                    this.showNotification(`✅ Project "${project.name}" loaded successfully`, 'success');
                    
                    console.log('📊 Project loaded successfully:', {
                        id: project.id,
                        name: project.name,
                        files: project.files?.length || 0,
                        folders: project.folders?.length || 0,
                        projectFile: project.projectFilePath,
                        dataFolder: project.dataFolderPath
                    });
                    
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
• Files in Current Project: ${this.currentProject ? (this.currentProject.files?.length || 0) : 0}
• Timestamp: ${new Date().toISOString()}
• Project Manager Version: 1.0.0
            `.trim();
            
            const mailtoLink = `mailto:support@genomeaistudio.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            
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
Part of Genome AI Studio

Version: 1.0.0 Beta
Build: ${new Date().toISOString().split('T')[0]}

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
Genome AI Studio Development Team

📧 Support:
support@genomeaistudio.com

📖 Documentation:
Visit Help → User Guide for comprehensive documentation

🐛 Report Issues:
Use Help → Report Issue to submit bug reports

© 2024 Genome AI Studio. All rights reserved.

Built with ❤️ for the bioinformatics community.
        `.trim();
        
        alert(about);
    }
    
    // ====== 简约模式管理 ======
    
    toggleCompactMode() {
        this.isCompactMode = !this.isCompactMode;
        
        const body = document.body;
        const headerActions = document.getElementById('headerActions');
        const headerActionsCompact = document.getElementById('headerActionsCompact');
        const compactToggle = document.getElementById('compactModeToggle');
        
        if (this.isCompactMode) {
            // 启用简约模式
            body.classList.add('compact-mode');
            headerActions.style.display = 'none';
            headerActionsCompact.style.display = 'flex';
            compactToggle.checked = true;
            
            // 更新状态栏信息
            this.updateStatusBar('Simple Mode: Showing workspace only');
            
            // 保存简约模式状态
            this.saveCompactModePreference(true);
            
            console.log('🎯 Compact mode enabled - showing workspace only');
        } else {
            // 禁用简约模式
            body.classList.remove('compact-mode');
            headerActions.style.display = 'flex';
            headerActionsCompact.style.display = 'none';
            compactToggle.checked = false;
            
            // 恢复正常状态栏信息
            if (this.currentProject) {
                this.updateStatusBar(`Project: ${this.currentProject.name}`);
            } else {
                this.updateStatusBar('Ready');
            }
            
            // 保存简约模式状态
            this.saveCompactModePreference(false);
            
            console.log('🎯 Compact mode disabled - showing full interface');
        }
        
        // 添加视觉反馈
        this.showNotification(
            this.isCompactMode ? 'Simple Mode enabled' : 'Full interface restored', 
            'info'
        );
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
                    // 延迟应用模式，确保DOM已加载
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
        // 在页面加载时应用保存的简约模式设置
        this.loadCompactModePreference();
        
        // 确保toggle按钮状态正确
        setTimeout(() => {
            const compactToggle = document.getElementById('compactModeToggle');
            if (compactToggle) {
                compactToggle.checked = this.isCompactMode;
            }
        }, 200);
    }

    /**
     * 显示增强的子文件夹创建模态框
     */
    showCreateSubfolderModal(parentPath = null) {
        const basePath = parentPath || this.currentContextFolderPath || this.currentPath;
        
        // 更新模态框中的当前路径显示
        const pathDisplay = document.getElementById('currentFolderPath');
        if (pathDisplay) {
            if (basePath && basePath.length > 0) {
                pathDisplay.textContent = `${this.currentProject.name}/${basePath.join('/')}`;
            } else {
                pathDisplay.textContent = `${this.currentProject.name} (root)`;
            }
        }
        
        // 清空表单
        document.getElementById('subfolderName').value = '';
        document.getElementById('subfolderIcon').value = '📁';
        document.getElementById('subfolderDescription').value = '';
        
        // 显示模态框
        document.getElementById('createSubfolderModal').style.display = 'block';
        
        // 聚焦到名称输入框
        setTimeout(() => {
            document.getElementById('subfolderName').focus();
        }, 100);
    }

    /**
     * 从增强模态框创建子文件夹
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
            parent: basePath.length > 0 ? basePath : null
        };

        // Check if folder already exists
        const existingFolder = this.currentProject.folders.find(f => 
            this.arraysEqual(f.path, newPath)
        );
        
        if (existingFolder) {
            this.showNotification(`Folder "${folderName}" already exists at this location`, 'warning');
            return;
        }

        this.currentProject.folders.push(folder);
        this.currentProject.modified = new Date().toISOString();
        
        // 自动展开父文件夹
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
            description: `Created subfolder "${folderName}" (${folderIcon}) in ${basePath.length > 0 ? basePath.join('/') : 'root'}`
        });
        
        this.saveProjects();
        
        // Also save as XML if possible to ensure persistence
        if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
            this.saveProjectAsXML();
        }
        
        this.closeModal('createSubfolderModal');
        this.renderProjectTree();
        this.showNotification(`Subfolder "${folderName}" created successfully`, 'success');
        
        console.log(`📁 Created enhanced subfolder: ${folderName} (${folderIcon}) at path: ${newPath.join('/')}`);
    }

    /**
     * 改进的addSubfolder方法，使用增强模态框
     */
    addSubfolder() {
        this.hideContextMenus();
        if (!this.currentContextFolderPath || !this.currentProject) return;
        
        this.showCreateSubfolderModal(this.currentContextFolderPath);
    }

    /**
     * 文件右键菜单
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
     * 预览文件方法
     */
    async previewFile(fileId) {
        const file = this.findFileById(fileId);
        if (!file) return;

        try {
            // 这里可以根据文件类型调用不同的预览方法
            const fileType = this.detectFileType(file.name);
            
            if (window.electronAPI && window.electronAPI.openFileInMainWindow) {
                const result = await window.electronAPI.openFileInMainWindow(file.path);
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
     * 重命名文件方法
     */
    async renameFile(fileId) {
        const file = this.findFileById(fileId);
        if (!file) return;

        const newName = prompt(`Rename file "${file.name}" to:`, file.name);
        if (!newName || newName.trim() === file.name) return;

        try {
            file.name = newName.trim();
            file.modified = new Date().toISOString();
            
            this.currentProject.modified = new Date().toISOString();
            this.saveProjects();
            
            this.renderProjectTree();
            this.renderProjectContent(); // 更新主视图
            this.showNotification(`File renamed to "${newName}"`, 'success');
            
        } catch (error) {
            console.error('Error renaming file:', error);
            this.showNotification('Failed to rename file', 'error');
        }
    }

    /**
     * 删除文件方法
     */
    async deleteFile(fileId) {
        const file = this.findFileById(fileId);
        if (!file) return;

        if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;

        try {
            // 从项目中移除文件
            this.currentProject.files = this.currentProject.files.filter(f => f.id !== fileId);
            
            // 从选择列表中移除
            this.selectedFiles.delete(fileId);
            
            this.currentProject.modified = new Date().toISOString();
            this.saveProjects();
            
            this.renderProjectTree();
            this.renderProjectContent(); // 更新主视图
            this.showNotification(`File "${file.name}" deleted`, 'success');
            
        } catch (error) {
            console.error('Error deleting file:', error);
            this.showNotification('Failed to delete file', 'error');
        }
    }

    /**
     * 复制文件方法
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
                modified: new Date().toISOString()
            };
            
            this.currentProject.files.push(duplicatedFile);
            this.currentProject.modified = new Date().toISOString();
            this.saveProjects();
            
            this.renderProjectTree();
            this.renderProjectContent(); // 更新主视图
            this.showNotification(`File duplicated as "${newName}"`, 'success');
            
        } catch (error) {
            console.error('Error duplicating file:', error);
            this.showNotification('Failed to duplicate file', 'error');
        }
    }

    /**
     * 增强的文件夹操作方法
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
            
            // 如果删除的是当前项目，清空当前项目
            if (this.currentProject && this.currentProject.id === this.currentContextProjectId) {
                this.currentProject = null;
                this.currentPath = [];
                this.selectedFiles.clear();
                
                // 显示项目概览
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
            const newProject = {
                ...project,
                id: this.generateId(),
                name: newName.trim(),
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            };
            
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
     * 下载XML文件方法
     */
    downloadXMLFile(xmlContent, filename) {
        try {
            if (window.electronAPI && window.electronAPI.saveProjectFile) {
                // Electron环境
                window.electronAPI.saveProjectFile(filename, xmlContent);
            } else {
                // 浏览器环境
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
     * 文件夹相关的附加方法
     */
    renameFolder() {
        this.hideContextMenus();
        if (!this.currentContextFolderPath || !this.currentProject) return;
        
        const folder = this.currentProject.folders.find(f => 
            this.arraysEqual(f.path, this.currentContextFolderPath)
        );
        
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
        
        const folder = this.currentProject.folders.find(f => 
            this.arraysEqual(f.path, this.currentContextFolderPath)
        );
        
        if (!folder) return;
        
        // 检查文件夹是否包含文件
        const filesInFolder = this.currentProject.files.filter(file => 
            file.folder && this.arraysEqual(file.folder, this.currentContextFolderPath)
        );
        
        const confirmMessage = filesInFolder.length > 0 
            ? `Are you sure you want to delete folder "${folder.name}" and its ${filesInFolder.length} file(s)? This action cannot be undone.`
            : `Are you sure you want to delete folder "${folder.name}"?`;
        
        if (confirm(confirmMessage)) {
            // 删除文件夹中的所有文件
            this.currentProject.files = this.currentProject.files.filter(file => 
                !file.folder || !this.arraysEqual(file.folder, this.currentContextFolderPath)
            );
            
            // 删除文件夹
            this.currentProject.folders = this.currentProject.folders.filter(f => 
                !this.arraysEqual(f.path, this.currentContextFolderPath)
            );
            
            // 如果当前在被删除的文件夹中，回到根目录
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
        
        // 临时设置当前路径为文件夹路径，然后调用添加文件
        const originalPath = this.currentPath;
        this.currentPath = this.currentContextFolderPath;
        
        this.addFiles().then(() => {
            // 恢复原始路径
            this.currentPath = originalPath;
        });
    }

    openFolderInExplorer() {
        this.hideContextMenus();
        if (!this.currentContextFolderPath || !this.currentProject) return;
        
        const folder = this.currentProject.folders.find(f => 
            this.arraysEqual(f.path, this.currentContextFolderPath)
        );
        
        if (!folder) return;
        
        // 这里可以添加打开系统文件管理器的逻辑
        this.showNotification(`Would open folder "${folder.name}" in file explorer`, 'info');
    }

    /**
     * 文件预览方法 - 显示文件预览弹窗
     */
    async showFilePreview(fileId) {
        const file = this.findFileById(fileId);
        if (!file) return;

        try {
            const fileType = this.detectFileType(file.name);
            
            // 创建预览模态框
            this.createPreviewModal(file, fileType);
            
            this.showNotification(`Previewing: ${file.name}`, 'info');
        } catch (error) {
            console.error('Error previewing file:', error);
            this.showNotification('Failed to preview file', 'error');
        }
    }

    /**
     * 创建文件预览模态框
     */
    createPreviewModal(file, fileType) {
        // 移除现有的预览模态框
        const existingModal = document.getElementById('filePreviewModal');
        if (existingModal) {
            existingModal.remove();
        }

        // 创建预览模态框
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

        // 模态框头部
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

        // 文件信息区域
        const infoSection = document.createElement('div');
        infoSection.style.cssText = `
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #eee;
        `;
        
        infoSection.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; font-size: 14px;">
                <div><strong>File Name:</strong> ${file.name}</div>
                <div><strong>File Type:</strong> ${fileType.toUpperCase()}</div>
                <div><strong>Size:</strong> ${this.formatFileSize(file.size || 0)}</div>
                <div><strong>Modified:</strong> ${file.modified ? this.formatDate(file.modified) : 'Unknown'}</div>
            </div>
        `;

        // 预览内容区域
        const previewContent = document.createElement('div');
        previewContent.style.cssText = `
            padding: 20px;
            max-height: 400px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.4;
        `;

        // 根据文件类型显示不同的预览内容
        this.generatePreviewContent(file, fileType, previewContent);

        // 按钮区域
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

        // 组装模态框
        modalContent.appendChild(header);
        modalContent.appendChild(infoSection);
        modalContent.appendChild(previewContent);
        modalContent.appendChild(buttonSection);
        modal.appendChild(modalContent);

        // 添加到页面
        document.body.appendChild(modal);

        // 点击背景关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };
    }

    /**
     * 生成预览内容
     */
    generatePreviewContent(file, fileType, container) {
        const placeholderContent = {
            'fasta': `>Sequence_1
ATGCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC
GATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC
GATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATC
...

📄 This is a preview of what a FASTA file might contain.
To view the actual file content, click "Open in Main Window".`,
            
            'gff': `##gff-version 3
##sequence-region ctg123 1 1497228
ctg123	.	gene	1000	9000	.	+	.	ID=gene00001;Name=EDEN
ctg123	.	mRNA	1050	9000	.	+	.	ID=mRNA00001;Parent=gene00001
ctg123	.	exon	1050	1500	.	+	.	ID=exon00001;Parent=mRNA00001
...

📄 This is a preview of what a GFF file might contain.
To view the actual file content, click "Open in Main Window".`,
            
            'vcf': `##fileformat=VCFv4.2
##contig=<ID=20,length=62435964>
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO
20	14370	rs6054257	G	A	29	PASS	NS=3;DP=14;AF=0.5
20	17330	.	T	A	3	q10	NS=3;DP=11;AF=0.017
...

📄 This is a preview of what a VCF file might contain.
To view the actual file content, click "Open in Main Window".`,
            
            'genbank': `LOCUS       SCU49845     5028 bp    DNA     linear   PLN 21-JUN-1999
DEFINITION  Saccharomyces cerevisiae TCP1-beta gene, partial cds; and Axl2p
ACCESSION   U49845
VERSION     U49845.1  GI:1293613
FEATURES             Location/Qualifiers
     source          1..5028
                     /organism="Saccharomyces cerevisiae"
...

📄 This is a preview of what a GenBank file might contain.
To view the actual file content, click "Open in Main Window".`
        };

        const content = placeholderContent[fileType] || `📄 Preview not available for ${fileType.toUpperCase()} files.

File: ${file.name}
Type: ${fileType.toUpperCase()}
Size: ${this.formatFileSize(file.size || 0)}

To view this file, click "Open in Main Window".`;

        container.innerHTML = `<pre style="white-space: pre-wrap; margin: 0; color: #333;">${content}</pre>`;
    }

    /**
     * 切换紧凑树视图模式
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
        
        // 保存设置到localStorage
        this.saveTreeViewPreference();
        
        console.log(`Tree view mode: ${this.compactTreeMode ? 'compact' : 'normal'}`);
    }

    /**
     * 切换超级紧凑模式（双击紧凑模式切换按钮触发）
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
     * 保存树视图偏好设置
     */
    saveTreeViewPreference() {
        const preferences = {
            compactTreeMode: this.compactTreeMode,
            ultraCompactMode: this.ultraCompactMode
        };
        localStorage.setItem('projectManagerTreeViewPreferences', JSON.stringify(preferences));
    }

    /**
     * 加载树视图偏好设置
     */
    loadTreeViewPreference() {
        try {
            const stored = localStorage.getItem('projectManagerTreeViewPreferences');
            if (stored) {
                const preferences = JSON.parse(stored);
                this.compactTreeMode = preferences.compactTreeMode || false;
                this.ultraCompactMode = preferences.ultraCompactMode || false;
                
                // 应用设置到UI
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
     * 初始化紧凑模式相关事件监听
     */
    initializeTreeViewEvents() {
        const compactToggle = document.getElementById('compactTreeToggle');
        if (compactToggle) {
            // 双击切换超级紧凑模式
            compactToggle.addEventListener('dblclick', () => {
                this.toggleUltraCompactMode();
            });
            
            // 添加键盘快捷键支持 (Ctrl+Shift+T)
            document.addEventListener('keydown', (event) => {
                if (event.ctrlKey && event.shiftKey && event.key === 'T') {
                    event.preventDefault();
                    this.toggleCompactTreeMode();
                }
            });
        }
        
        // 加载保存的设置
        this.loadTreeViewPreference();
    }

    /**
     * 切换Header折叠状态
     */
    toggleHeaderCollapse() {
        this.headerCollapsed = !this.headerCollapsed;
        
        const header = document.querySelector('.header');
        const mainContainer = document.querySelector('.main-container');
        const statusBar = document.querySelector('.status-bar');
        const toggleButton = document.getElementById('headerToggle');
        const body = document.body;
        
        if (this.headerCollapsed) {
            // 折叠header
            header.classList.add('header-collapsed');
            mainContainer.classList.add('main-container-fullheight');
            statusBar.classList.add('status-bar-collapsed');
            body.classList.add('sidebar-collapsed-mode');
            
            if (toggleButton) {
                toggleButton.classList.add('collapsed');
                toggleButton.title = 'Show header';
                // 更新SVG图标为向上箭头（展开状态）
                const svgIcon = toggleButton.querySelector('.btn-icon');
                if (svgIcon) {
                    svgIcon.innerHTML = '<path d="M8 12l-4.5-4.5L5 6l3 3 3-3 1.5 1.5z"/>';
                }
            }
            
            this.showNotification('Header collapsed - sidebar-only mode', 'success');
        } else {
            // 展开header
            header.classList.remove('header-collapsed');
            mainContainer.classList.remove('main-container-fullheight');
            statusBar.classList.remove('status-bar-collapsed');
            body.classList.remove('sidebar-collapsed-mode');
            
            if (toggleButton) {
                toggleButton.classList.remove('collapsed');
                toggleButton.title = 'Hide header';
                // 更新SVG图标为向下箭头（折叠状态）
                const svgIcon = toggleButton.querySelector('.btn-icon');
                if (svgIcon) {
                    svgIcon.innerHTML = '<path d="M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z"/>';
                }
            }
            
            this.showNotification('Header restored - full interface mode', 'success');
        }
        
        // 保存状态
        this.saveHeaderCollapsePreference();
        
        console.log(`Header ${this.headerCollapsed ? 'collapsed' : 'expanded'}`);
    }

    /**
     * 保存Header折叠偏好设置
     */
    saveHeaderCollapsePreference() {
        localStorage.setItem('projectManagerHeaderCollapsed', JSON.stringify(this.headerCollapsed));
    }

    /**
     * 加载Header折叠偏好设置
     */
    loadHeaderCollapsePreference() {
        try {
            const stored = localStorage.getItem('projectManagerHeaderCollapsed');
            if (stored !== null) {
                this.headerCollapsed = JSON.parse(stored);
                
                // 应用保存的状态
                if (this.headerCollapsed) {
                    // 延迟应用状态，确保DOM已加载
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
     * 初始化Header相关事件监听
     */
    initializeHeaderEvents() {
        // 键盘快捷键支持 (Ctrl+Shift+H)
        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.shiftKey && event.key === 'H') {
                event.preventDefault();
                this.toggleHeaderCollapse();
            }
        });
        
        // 加载保存的设置
        this.loadHeaderCollapsePreference();
    }

    /**
     * Update details panel (compatibility method)
     */
    updateDetailsPanel() {
        // This is a compatibility method for details panel functionality
        // Currently, details panel is not fully implemented
        console.log('updateDetailsPanel called - details panel not fully implemented');
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
     * Mark project as modified
     */
    markProjectAsModified() {
        if (this.currentProject) {
            this.currentProject.hasUnsavedChanges = true;
            this.currentProject.modified = new Date().toISOString();
        }
    }
}

// 确保类在全局范围内可用
if (typeof window !== 'undefined') {
    window.ProjectManagerWindow = ProjectManagerWindow;
} 