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
        this.searchTerm = '';
        
        // 文件类型配置
        this.fileTypes = {
            'fasta': { icon: 'FA', color: '#28a745', extensions: ['.fasta', '.fa', '.fas'] },
            'gff': { icon: 'GFF', color: '#17a2b8', extensions: ['.gff', '.gff3', '.gtf'] },
            'vcf': { icon: 'VCF', color: '#ffc107', extensions: ['.vcf'] },
            'bam': { icon: 'BAM', color: '#6f42c1', extensions: ['.bam', '.sam'] },
            'wig': { icon: 'WIG', color: '#fd7e14', extensions: ['.wig', '.bw', '.bigwig'] },
            'bed': { icon: 'BED', color: '#dc3545', extensions: ['.bed'] },
            'genbank': { icon: 'GB', color: '#20c997', extensions: ['.gb', '.gbk', '.gbff'] },
            'folder': { icon: '📁', color: '#6c757d', extensions: [] }
        };
        
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
                    <button class="btn btn-primary" onclick="projectManager.createNewProject()" style="margin-top: 10px; font-size: 12px;">
                        Create Project
                    </button>
                </div>
            `;
        } else {
            this.projects.forEach((project, projectId) => {
                const isActive = this.currentProject && this.currentProject.id === projectId;
                html += `
                    <div class="tree-item project ${isActive ? 'active' : ''}" 
                         onclick="projectManager.selectProject('${projectId}')"
                         data-project-id="${projectId}">
                        <div class="tree-icon">📂</div>
                        <span title="${project.description || project.name}">${project.name}</span>
                    </div>
                `;
                
                // 显示文件夹结构（如果项目被选中）
                if (isActive && project.folders) {
                    project.folders.forEach(folder => {
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
                }
            });
        }
        
        projectTree.innerHTML = html;
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
        this.renderFileGrid();
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
        const container = document.getElementById('fileGrid');
        if (!container) return;

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
            if (window.electronAPI && window.electronAPI.openFileInMainWindow) {
                const result = await window.electronAPI.openFileInMainWindow(file.path);
                if (result.success) {
                    this.showNotification(`Opened "${file.name}" in GenomeExplorer`, 'success');
                } else {
                    throw new Error(result.error);
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
        const ext = '.' + fileName.toLowerCase().split('.').pop();
        for (const [type, config] of Object.entries(this.fileTypes)) {
            if (config.extensions.includes(ext)) {
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
        
        if (file && file.path) {
            if (window.electronAPI && window.electronAPI.openFileInExternalEditor) {
                window.electronAPI.openFileInExternalEditor(file.path);
                this.showNotification(`Opening "${file.name}" in external editor`, 'info');
            } else {
                this.showNotification('External editor not available in browser mode', 'warning');
            }
        } else {
            this.showNotification('File path not available', 'error');
        }
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
                    
                    // Set up project paths
                    project.projectFilePath = filePath;
                    const projectDir = filePath.substring(0, filePath.lastIndexOf('/'));
                    project.dataFolderPath = `${projectDir}/${project.name}`;
                    project.location = projectDir;
                    
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
}

// 确保类在全局范围内可用
if (typeof window !== 'undefined') {
    window.ProjectManagerWindow = ProjectManagerWindow;
} 