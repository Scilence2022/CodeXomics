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
                    this.renderProjectContent();
                    this.updateDetailsPanel();

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
                            scanPath: projectPath
                        }
                    });
                    
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

    /**
     * File菜单功能
     */
    openRecentProject() {
        // 显示最近项目列表
        if (this.projects.size === 0) {
            this.showNotification('No recent projects available', 'info');
            return;
        }
        
        const recentProjects = Array.from(this.projects.values())
            .sort((a, b) => new Date(b.metadata.lastOpened) - new Date(a.metadata.lastOpened))
            .slice(0, 5);
            
        const projectList = recentProjects.map(project => 
            `${project.name} (${this.formatDate(project.metadata.lastOpened)})`
        ).join('\n');
        
        const choice = prompt(`Recent Projects:\n${projectList}\n\nEnter project name to open:`);
        if (choice) {
            const selectedProject = recentProjects.find(p => p.name === choice.trim());
            if (selectedProject) {
                this.selectProject(selectedProject.id);
                this.showNotification(`Opened project: ${selectedProject.name}`, 'success');
            } else {
                this.showNotification('Project not found', 'warning');
            }
        }
    }

    async saveCurrentProject() {
        if (!this.currentProject) {
            this.showNotification('No project to save', 'warning');
            return;
        }
        
        try {
            // 更新项目修改时间
            this.currentProject.modified = new Date().toISOString();
            
            // 保存到localStorage
            await this.saveProjects();
            
            // 如果有XML文件路径，也保存到XML文件
            if (this.currentProject.xmlFilePath || this.currentProject.projectFilePath) {
                await this.saveProjectAsXML();
            }
            
            // 标记项目为已保存
            this.markProjectAsSaved();
            
            this.showNotification(`✅ Project "${this.currentProject.name}" saved successfully`, 'success');
            console.log(`💾 Project saved: ${this.currentProject.name}`);
            
        } catch (error) {
            console.error('Error saving current project:', error);
            this.showNotification(`Failed to save project: ${error.message}`, 'error');
        }
    }

    async saveProjectAs() {
        if (!this.currentProject) {
            this.showNotification('No project to save', 'warning');
            return;
        }
        
        const newName = prompt('Enter new project name:', this.currentProject.name + '_copy');
        if (!newName || newName.trim() === '') return;
        
        try {
            // 创建项目副本
            const newId = this.generateId();
            const projectCopy = {
                ...this.currentProject,
                id: newId,
                name: newName.trim(),
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
                metadata: {
                    ...this.currentProject.metadata,
                    lastOpened: new Date().toISOString()
                }
            };
            
            this.projects.set(newId, projectCopy);
            await this.saveProjects();
            
            this.renderProjectTree();
            this.selectProject(newId);
            this.showNotification(`Project saved as "${newName}"`, 'success');
            
        } catch (error) {
            console.error('Error saving project as:', error);
            this.showNotification('Failed to save project copy', 'error');
        }
    }

    async importProject() {
        try {
            if (window.electronAPI && window.electronAPI.selectProjectFile) {
                const result = await window.electronAPI.selectProjectFile();
                if (result.success && !result.canceled && result.filePath) {
                    await this.loadProjectFromFile(result.filePath);
                }
            } else {
                // 浏览器环境下的文件导入
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json,.xml,.prj.GAI';
                input.onchange = async (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                            try {
                                const projectData = JSON.parse(event.target.result);
                                const newId = this.generateId();
                                projectData.id = newId;
                                projectData.metadata.lastOpened = new Date().toISOString();
                                
                                this.projects.set(newId, projectData);
                                await this.saveProjects();
                                this.renderProjectTree();
                                this.selectProject(newId);
                                this.showNotification('Project imported successfully', 'success');
                            } catch (error) {
                                console.error('Error importing project:', error);
                                this.showNotification('Failed to import project file', 'error');
                            }
                        };
                        reader.readAsText(file);
                    }
                };
                input.click();
            }
        } catch (error) {
            console.error('Error importing project:', error);
            this.showNotification('Failed to import project', 'error');
        }
    }

    async exportCurrentProject() {
        if (!this.currentProject) {
            this.showNotification('No project to export', 'warning');
            return;
        }
        
        try {
            const projectData = JSON.stringify(this.currentProject, null, 2);
            const blob = new Blob([projectData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `${this.currentProject.name}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification(`Project "${this.currentProject.name}" exported successfully`, 'success');
            
        } catch (error) {
            console.error('Error exporting project:', error);
            this.showNotification('Failed to export project', 'error');
        }
    }

    closeCurrentProject() {
        if (!this.currentProject) {
            this.showNotification('No project to close', 'warning');
            return;
        }
        
        const confirm = window.confirm(`Close project "${this.currentProject.name}"?`);
        if (confirm) {
            const projectName = this.currentProject.name;
            this.currentProject = null;
            this.currentPath = [];
            this.selectedFiles.clear();
            
            this.renderProjectTree();
            this.renderProjectContent();
            this.updateStatusBar('Ready');
            this.showNotification(`Project "${projectName}" closed`, 'info');
        }
    }

    /**
     * Edit菜单功能
     */
    selectAllFiles() {
        if (!this.currentProject) return;
        
        const currentFiles = this.getCurrentFolderFiles();
        this.selectedFiles.clear();
        currentFiles.forEach(file => this.selectedFiles.add(file.id));
        
        this.updateFileCardSelection();
        this.updateFileCountDisplay();
        this.updateDetailsPanel();
        this.showNotification(`Selected ${this.selectedFiles.size} files`, 'info');
    }

    clearSelection() {
        this.selectedFiles.clear();
        this.updateFileCardSelection();
        this.updateFileCountDisplay();
        this.updateDetailsPanel();
        this.showNotification('Selection cleared', 'info');
    }

    deleteSelectedFiles() {
        if (!this.currentProject || this.selectedFiles.size === 0) {
            this.showNotification('No files selected for deletion', 'warning');
            return;
        }
        
        const selectedCount = this.selectedFiles.size;
        const confirm = window.confirm(`Delete ${selectedCount} selected file(s)? This action cannot be undone.`);
        
        if (confirm) {
            // 从项目中删除选定的文件
            const deletedFiles = [];
            this.selectedFiles.forEach(fileId => {
                const fileIndex = this.currentProject.files.findIndex(f => f.id === fileId);
                if (fileIndex !== -1) {
                    deletedFiles.push(this.currentProject.files[fileIndex].name);
                    this.currentProject.files.splice(fileIndex, 1);
                }
            });
            
            this.selectedFiles.clear();
            this.currentProject.modified = new Date().toISOString();
            this.saveProjects();
            this.renderProjectContent();
            this.updateDetailsPanel();
            
            this.showNotification(`Deleted ${deletedFiles.length} file(s): ${deletedFiles.join(', ')}`, 'success');
        }
    }

    /**
     * View菜单功能
     */
    setViewMode(mode) {
        this.viewMode = mode;
        
        // 更新视图模式按钮状态
        document.querySelectorAll('.view-mode-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });
        
        // 重新渲染文件视图
        this.renderFileGrid();
        this.showNotification(`View mode: ${mode}`, 'info');
    }

    /**
     * Toggle详细信息面板
     */
    toggleDetailsPanel() {
        const panel = document.getElementById('detailsPanel');
        const toggle = document.getElementById('detailsPanelToggle');
        
        if (panel.style.display === 'none' || !panel.style.display) {
            panel.style.display = 'block';
            toggle.checked = true;
            this.updateDetailsPanel();
            this.showNotification('Details panel opened', 'info');
        } else {
            panel.style.display = 'none';
            toggle.checked = false;
            this.showNotification('Details panel closed', 'info');
        }
    }

    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar.style.display === 'none') {
            sidebar.style.display = 'flex';
            this.showNotification('Sidebar opened', 'info');
        } else {
            sidebar.style.display = 'none';
            this.showNotification('Sidebar closed', 'info');
        }
    }

    /**
     * Tools菜单功能
     */
    analyzeProject() {
        if (!this.currentProject) {
            this.showNotification('No project to analyze', 'warning');
            return;
        }

        const stats = this.calculateProjectStatistics();
        const analysis = `
Project Analysis for "${this.currentProject.name}":

📊 File Statistics:
- Total Files: ${stats.totalFiles}
- Total Size: ${this.formatFileSize(stats.totalSize)}
- Average File Size: ${this.formatFileSize(stats.averageSize)}

🏷️ File Types:
${Object.entries(stats.fileTypes).map(([type, count]) => `- ${type}: ${count} files`).join('\n')}

📁 Folder Distribution:
${this.currentProject.folders.map(folder => `- ${folder.name}: ${stats.folderFiles[folder.name] || 0} files`).join('\n')}
        `.trim();

        alert(analysis);
    }

    calculateProjectStatistics() {
        if (!this.currentProject) return {};
        
        const files = this.currentProject.files || [];
        const totalFiles = files.length;
        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
        const averageSize = totalFiles > 0 ? totalSize / totalFiles : 0;
        
        const fileTypes = {};
        const folderFiles = {};
        
        files.forEach(file => {
            const type = this.detectFileType(file.name);
            fileTypes[type] = (fileTypes[type] || 0) + 1;
            
            const folder = file.folder || 'root';
            folderFiles[folder] = (folderFiles[folder] || 0) + 1;
        });
        
        return {
            totalFiles,
            totalSize,
            averageSize,
            fileTypes,
            folderFiles
        };
    }

    validateFiles() {
        if (!this.currentProject) {
            this.showNotification('No project to validate', 'warning');
            return;
        }
        
        const missingFiles = [];
        const invalidFiles = [];
        
        this.currentProject.files.forEach(file => {
            if (!file.name || !file.id) {
                invalidFiles.push(file);
            }
            // 这里可以添加更多文件验证逻辑
        });
        
        if (missingFiles.length === 0 && invalidFiles.length === 0) {
            this.showNotification('All files are valid', 'success');
        } else {
            const message = `Validation complete:\n- ${invalidFiles.length} invalid files found`;
            alert(message);
        }
    }

    findDuplicateFiles() {
        if (!this.currentProject) {
            this.showNotification('No project to check', 'warning');
            return;
        }
        
        const fileNames = {};
        const duplicates = [];
        
        this.currentProject.files.forEach(file => {
            if (fileNames[file.name]) {
                duplicates.push(file.name);
            } else {
                fileNames[file.name] = true;
            }
        });
        
        if (duplicates.length === 0) {
            this.showNotification('No duplicate files found', 'success');
        } else {
            alert(`Found ${duplicates.length} duplicate file names:\n${duplicates.join('\n')}`);
        }
    }

    openInGenomeViewer() {
        this.showNotification('Opening in Genome Viewer...', 'info');
        // 这里可以添加与主窗口通信的逻辑
    }

    runGenomicAnalysis() {
        this.showNotification('Genomic analysis feature coming soon', 'info');
    }

    /**
     * Help菜单功能
     */
    showDocumentation() {
        const docContent = `
📖 Project Manager Documentation

🔧 Basic Operations:
• Ctrl+N: Create new project
• Ctrl+O: Open project
• Ctrl+S: Save project
• F5: Refresh projects
• F8: Toggle sidebar
• F9: Toggle details panel

📁 File Management:
• Drag & drop files to add them to project
• Right-click for context menu
• Use Ctrl+Click for multiple selection

🎯 Tips:
• Projects are automatically saved to localStorage
• Use the details panel for quick project statistics
• Export projects as JSON for backup
        `.trim();
        
        alert(docContent);
    }

    showKeyboardShortcuts() {
        const shortcuts = `
⌨️ Keyboard Shortcuts

File Operations:
• Ctrl+N - New Project
• Ctrl+O - Open Project
• Ctrl+S - Save Project
• Ctrl+Shift+S - Save As
• Ctrl+A - Add Files
• Ctrl+Shift+N - New Folder

View Controls:
• F5 - Refresh
• F8 - Toggle Sidebar
• F9 - Toggle Details Panel
• Esc - Clear Selection
• Del - Delete Selected

Selection:
• Ctrl+A - Select All
• Ctrl+Click - Multi-select
• Shift+Click - Range select
        `.trim();
        
        alert(shortcuts);
    }

    reportBug() {
        const bugReport = `
Please send bug reports to: support@genomeaistudio.com

Include the following information:
• Project Manager version
• Steps to reproduce the issue
• Expected vs actual behavior
• Browser/OS information
        `.trim();
        
        alert(bugReport);
    }

    showAbout() {
        const aboutInfo = `
📁 Project Manager v0.2 Beta

Part of Genome AI Studio
A comprehensive genomic data management solution

Features:
• Project organization and management
• Multi-format file support
• Advanced file operations
• Integration with genome viewer

© 2024 Genome AI Studio
        `.trim();
        
        alert(aboutInfo);
    }

    /**
     * 更新详细信息面板内容
     */
    updateDetailsPanel() {
        if (!this.currentProject) return;
        
        // 更新选择信息
        const selectionInfo = document.getElementById('selectionInfo');
        if (selectionInfo) {
            if (this.selectedFiles.size === 0) {
                selectionInfo.innerHTML = '<p>No files selected</p>';
            } else {
                const selectedFilesList = Array.from(this.selectedFiles)
                    .map(fileId => this.findFileById(fileId))
                    .filter(file => file)
                    .map(file => `<div class="selected-file-item">${file.name}</div>`)
                    .join('');
                    
                selectionInfo.innerHTML = `
                    <p><strong>${this.selectedFiles.size} files selected</strong></p>
                    <div class="selected-files-list">${selectedFilesList}</div>
                `;
            }
        }
        
        // 更新项目统计
        const stats = this.calculateProjectStatistics();
        document.getElementById('totalFilesCount').textContent = stats.totalFiles;
        document.getElementById('totalSizeValue').textContent = this.formatFileSize(stats.totalSize);
        document.getElementById('fileTypesCount').textContent = Object.keys(stats.fileTypes).length;
        
        // 更新文件类型分布
        const fileTypeDistribution = document.getElementById('fileTypeDistribution');
        if (fileTypeDistribution && stats.fileTypes) {
            const typeItems = Object.entries(stats.fileTypes)
                .map(([type, count]) => {
                    const typeConfig = this.fileTypes[type] || this.fileTypes['unknown'];
                    return `
                        <div class="file-type-item">
                            <div class="file-type-name">
                                <div class="file-type-icon" style="background-color: ${typeConfig.color}">
                                    ${typeConfig.icon}
                                </div>
                                <span>${type}</span>
                            </div>
                            <span class="file-type-count">${count}</span>
                        </div>
                    `;
                })
                .join('');
                
            fileTypeDistribution.innerHTML = typeItems || '<p>No data available</p>';
        }
        
        // 更新最近活动
        const recentActivity = document.getElementById('recentActivity');
        if (recentActivity) {
            const activities = [
                `Project opened: ${this.formatDate(this.currentProject.metadata.lastOpened)}`,
                `Last modified: ${this.formatDate(this.currentProject.modified)}`,
                `Created: ${this.formatDate(this.currentProject.created)}`
            ];
            
            recentActivity.innerHTML = activities
                .map(activity => `<div class="activity-item">${activity}</div>`)
                .join('');
        }
    }

    // 文件重命名功能
    async renameFile(fileId) {
        const file = this.findFileById(fileId);
        if (!file) {
            this.showNotification('File not found', 'error');
            return;
        }
        
        const newName = prompt('Enter new file name:', file.name);
        if (!newName || newName.trim() === '' || newName === file.name) {
            return;
        }
        
        // 检查文件名是否已存在
        const existingFile = this.currentProject.files.find(f => f.name === newName.trim() && f.id !== fileId);
        if (existingFile) {
            this.showNotification('A file with this name already exists', 'warning');
            return;
        }
        
        try {
            const oldName = file.name;
            file.name = newName.trim();
            file.modified = new Date().toISOString();
            
            // 尝试重命名物理文件（如果在Electron环境中）
            if (window.electronAPI && window.electronAPI.renameFile && file.path) {
                const result = await window.electronAPI.renameFile(file.path, newName.trim());
                if (result.success) {
                    file.path = result.newPath;
                }
            }
            
            this.currentProject.modified = new Date().toISOString();
            this.saveProjects();
            
            this.showNotification(`File renamed from "${oldName}" to "${newName.trim()}"`, 'success');
            
        } catch (error) {
            console.error('Error renaming file:', error);
            this.showNotification('Failed to rename file', 'error');
        }
    }

    // 文件预览功能
    async previewFile(fileId) {
        const file = this.findFileById(fileId);
        if (!file) {
            this.showNotification('File not found', 'error');
            return;
        }
        
        // 创建预览模态框
        this.createFilePreviewModal(file);
    }

    createFilePreviewModal(file) {
        // 移除现有的预览模态框
        const existingModal = document.getElementById('filePreviewModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = 'filePreviewModal';
        modal.className = 'modal';
        modal.style.display = 'block';
        
        const isTextFile = this.isTextFile(file.name);
        const canEdit = isTextFile && file.size < 1024 * 1024; // 限制编辑文件大小为1MB
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 80%; max-height: 80%;">
                <div class="modal-header">
                    <h3>📄 ${file.name}</h3>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        ${canEdit ? '<button class="btn btn-sm btn-secondary" onclick="projectManagerWindow.toggleEditMode()">✏️ Edit</button>' : ''}
                        <button class="btn btn-sm btn-secondary" onclick="projectManagerWindow.downloadFile(\'${file.id}\')">⬇️ Download</button>
                        <button class="modal-close" onclick="projectManagerWindow.closeFilePreview()">&times;</button>
                    </div>
                </div>
                <div class="modal-body" style="max-height: 60vh; overflow-y: auto;">
                    <div class="file-info" style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <strong>Size:</strong> ${this.formatFileSize(file.size)} | 
                        <strong>Type:</strong> ${file.type || 'Unknown'} | 
                        <strong>Modified:</strong> ${this.formatDate(file.modified)}
                    </div>
                    <div id="fileContent" style="background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; overflow-x: auto;">
                        ${isTextFile ? 'Loading...' : 'Binary file preview not available'}
                    </div>
                    ${canEdit ? `
                        <textarea id="fileEditor" style="display: none; width: 100%; height: 400px; font-family: monospace; border: 1px solid #ddd; border-radius: 5px; padding: 10px;"></textarea>
                        <div id="editControls" style="display: none; margin-top: 10px; text-align: right;">
                            <button class="btn btn-secondary" onclick="projectManagerWindow.cancelEdit()">Cancel</button>
                            <button class="btn btn-success" onclick="projectManagerWindow.saveFileContent('${file.id}')">Save Changes</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // 加载文件内容
        if (isTextFile) {
            this.loadFileContent(file);
        }
    }

    async loadFileContent(file) {
        try {
            let content = '';
            
            if (window.electronAPI && window.electronAPI.readFileContent && file.path) {
                const result = await window.electronAPI.readFileContent(file.path);
                content = result.success ? result.content : 'Error loading file content';
            } else {
                // 模拟文件内容（实际应用中应该从实际文件读取）
                content = this.generateSampleContent(file);
            }
            
            const fileContentDiv = document.getElementById('fileContent');
            if (fileContentDiv) {
                // 限制显示的内容长度
                const maxDisplayLength = 10000;
                if (content.length > maxDisplayLength) {
                    content = content.substring(0, maxDisplayLength) + '\n\n... (content truncated)';
                }
                fileContentDiv.textContent = content;
            }
            
            // 同时设置编辑器内容
            const fileEditor = document.getElementById('fileEditor');
            if (fileEditor) {
                fileEditor.value = content;
            }
            
        } catch (error) {
            console.error('Error loading file content:', error);
            const fileContentDiv = document.getElementById('fileContent');
            if (fileContentDiv) {
                fileContentDiv.textContent = 'Error loading file content';
            }
        }
    }

    toggleEditMode() {
        const fileContent = document.getElementById('fileContent');
        const fileEditor = document.getElementById('fileEditor');
        const editControls = document.getElementById('editControls');
        
        if (fileContent && fileEditor && editControls) {
            if (fileContent.style.display !== 'none') {
                // 切换到编辑模式
                fileContent.style.display = 'none';
                fileEditor.style.display = 'block';
                editControls.style.display = 'block';
                fileEditor.value = fileContent.textContent;
                fileEditor.focus();
            } else {
                // 切换到预览模式
                fileContent.style.display = 'block';
                fileEditor.style.display = 'none';
                editControls.style.display = 'none';
            }
        }
    }

    cancelEdit() {
        this.toggleEditMode();
    }

    async saveFileContent(fileId) {
        const file = this.findFileById(fileId);
        const fileEditor = document.getElementById('fileEditor');
        
        if (!file || !fileEditor) {
            this.showNotification('Error saving file', 'error');
            return;
        }
        
        try {
            const newContent = fileEditor.value;
            
            // 尝试保存到物理文件（如果在Electron环境中）
            if (window.electronAPI && window.electronAPI.writeFileContent && file.path) {
                const result = await window.electronAPI.writeFileContent(file.path, newContent);
                if (!result.success) {
                    throw new Error(result.error);
                }
            }
            
            // 更新文件元数据
            file.modified = new Date().toISOString();
            file.size = new Blob([newContent]).size;
            
            this.currentProject.modified = new Date().toISOString();
            this.saveProjects();
            
            // 更新预览内容
            const fileContent = document.getElementById('fileContent');
            if (fileContent) {
                fileContent.textContent = newContent;
            }
            
            this.toggleEditMode();
            this.showNotification(`File "${file.name}" saved successfully`, 'success');
            
        } catch (error) {
            console.error('Error saving file content:', error);
            this.showNotification('Failed to save file content', 'error');
        }
    }

    downloadFile(fileId) {
        const file = this.findFileById(fileId);
        if (!file) {
            this.showNotification('File not found', 'error');
            return;
        }
        
        // 创建下载链接（实际应用中应该访问真实文件）
        const content = this.generateSampleContent(file);
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification(`File "${file.name}" downloaded`, 'success');
    }

    closeFilePreview() {
        const modal = document.getElementById('filePreviewModal');
        if (modal) {
            modal.remove();
        }
    }

    isTextFile(fileName) {
        const textExtensions = ['.txt', '.md', '.json', '.xml', '.csv', '.tsv', '.fasta', '.fa', '.gff', '.gtf', '.bed', '.vcf', '.sam', '.wig'];
        const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
        return textExtensions.includes(ext);
    }

    generateSampleContent(file) {
        // 根据文件类型生成示例内容
        const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        switch (ext) {
            case '.fasta':
            case '.fa':
                return `>sequence_1 Example DNA sequence
ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG
ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG
>sequence_2 Another example sequence
GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCT`;
                
            case '.gff':
            case '.gtf':
                return `##gff-version 3
chr1	HAVANA	gene	11869	14409	.	+	.	ID=ENSG00000223972.5;gene_id=ENSG00000223972.5;gene_type=transcribed_unprocessed_pseudogene;gene_name=DDX11L1;level=2;havana_gene=OTTHUMG00000000961.2
chr1	HAVANA	transcript	11869	14409	.	+	.	ID=ENST00000456328.2;Parent=ENSG00000223972.5;gene_id=ENSG00000223972.5;transcript_id=ENST00000456328.2;gene_type=transcribed_unprocessed_pseudogene;gene_name=DDX11L1;transcript_type=processed_transcript;transcript_name=DDX11L1-202;level=2;transcript_support_level=1;tag=basic;havana_gene=OTTHUMG00000000961.2;havana_transcript=OTTHUMT00000362751.1`;
                
            case '.bed':
                return `track name=example description="Example BED track"
chr1	1000	2000	feature1	100	+
chr1	3000	4000	feature2	200	-
chr2	5000	6000	feature3	150	+`;
                
            case '.vcf':
                return `##fileformat=VCFv4.2
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">
#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	SAMPLE1
chr1	12345	.	A	T	60	PASS	DP=30	GT	0/1
chr1	23456	.	G	C	80	PASS	DP=40	GT	1/1`;
                
            default:
                return `This is a preview of file: ${file.name}
File size: ${this.formatFileSize(file.size)}
Last modified: ${this.formatDate(file.modified)}

[Preview content would be loaded from the actual file]`;
        }
    }

    // 显示文件右键菜单
    showFileContextMenu(event, fileId) {
        event.preventDefault();
        event.stopPropagation();
        
        // 移除现有的上下文菜单
        const existingMenu = document.getElementById('fileContextMenu');
        if (existingMenu) {
            existingMenu.remove();
        }
        
        const file = this.findFileById(fileId);
        if (!file) return;
        
        // 选择当前文件（如果未选择）
        if (!this.selectedFiles.has(fileId)) {
            this.selectFile(fileId, false);
        }
        
        const menu = document.createElement('div');
        menu.id = 'fileContextMenu';
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        menu.style.zIndex = '1000';
        menu.style.display = 'block';
        
        const isTextFile = this.isTextFile(file.name);
        
        menu.innerHTML = `
            <div class="context-menu-item" onclick="projectManagerWindow.previewFile('${fileId}')">
                <span class="menu-icon">👁️</span>
                Preview File
            </div>
            ${isTextFile ? `
                <div class="context-menu-item" onclick="projectManagerWindow.previewFile('${fileId}'); setTimeout(() => projectManagerWindow.toggleEditMode(), 100)">
                    <span class="menu-icon">✏️</span>
                    Edit File
                </div>
            ` : ''}
            <div class="context-menu-item" onclick="projectManagerWindow.renameFile('${fileId}')">
                <span class="menu-icon">📝</span>
                Rename File
            </div>
            <div class="context-menu-item" onclick="projectManagerWindow.downloadFile('${fileId}')">
                <span class="menu-icon">⬇️</span>
                Download File
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" onclick="projectManagerWindow.duplicateFile('${fileId}')">
                <span class="menu-icon">📋</span>
                Duplicate File
            </div>
            <div class="context-menu-item" onclick="projectManagerWindow.moveFileToFolder('${fileId}')">
                <span class="menu-icon">📁</span>
                Move to Folder
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item danger" onclick="projectManagerWindow.deleteFile('${fileId}')">
                <span class="menu-icon">🗑️</span>
                Delete File
            </div>
        `;
        
        document.body.appendChild(menu);
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
        }, 0);
    }
    
    hideContextMenu() {
        const menu = document.getElementById('fileContextMenu');
        if (menu) {
            menu.remove();
        }
    }

    // 删除单个文件
    deleteFile(fileId) {
        this.hideContextMenu();
        
        const file = this.findFileById(fileId);
        if (!file) {
            this.showNotification('File not found', 'error');
            return;
        }
        
        const confirm = window.confirm(`Delete "${file.name}"? This action cannot be undone.`);
        if (confirm) {
            const fileIndex = this.currentProject.files.findIndex(f => f.id === fileId);
            if (fileIndex !== -1) {
                this.currentProject.files.splice(fileIndex, 1);
                this.selectedFiles.delete(fileId);
                
                this.currentProject.modified = new Date().toISOString();
                this.saveProjects();
                this.renderProjectContent();
                this.updateDetailsPanel();
                
                this.showNotification(`File "${file.name}" deleted successfully`, 'success');
            }
        }
    }

    // 复制文件
    duplicateFile(fileId) {
        this.hideContextMenu();
        
        const file = this.findFileById(fileId);
        if (!file) {
            this.showNotification('File not found', 'error');
            return;
        }
        
        const newName = prompt('Enter name for the duplicate file:', file.name.replace(/(\.[^.]+)$/, '_copy$1'));
        if (!newName || newName.trim() === '') return;
        
        // 检查文件名是否已存在
        const existingFile = this.currentProject.files.find(f => f.name === newName.trim());
        if (existingFile) {
            this.showNotification('A file with this name already exists', 'warning');
            return;
        }
        
        try {
            const duplicateFile = {
                ...file,
                id: this.generateId(),
                name: newName.trim(),
                created: new Date().toISOString(),
                modified: new Date().toISOString()
            };
            
            this.currentProject.files.push(duplicateFile);
            this.currentProject.modified = new Date().toISOString();
            this.saveProjects();
            this.renderProjectContent();
            
            this.showNotification(`File duplicated as "${newName.trim()}"`, 'success');
            
        } catch (error) {
            console.error('Error duplicating file:', error);
            this.showNotification('Failed to duplicate file', 'error');
        }
    }

    // 移动文件到文件夹
    moveFileToFolder(fileId) {
        this.hideContextMenu();
        
        const file = this.findFileById(fileId);
        if (!file) {
            this.showNotification('File not found', 'error');
            return;
        }
        
        if (!this.currentProject.folders || this.currentProject.folders.length === 0) {
            this.showNotification('No folders available. Create a folder first.', 'warning');
            return;
        }
        
        const folderOptions = this.currentProject.folders.map(folder => 
            `${folder.name} (${folder.path.join('/')})`
        ).join('\n');
        
        const choice = prompt(`Select target folder:\n${folderOptions}\n\nEnter folder name:`);
        if (!choice) return;
        
        const targetFolder = this.currentProject.folders.find(f => f.name === choice.trim());
        if (targetFolder) {
            file.folder = targetFolder.path;
            file.modified = new Date().toISOString();
            
            this.currentProject.modified = new Date().toISOString();
            this.saveProjects();
            this.renderProjectContent();
            
            this.showNotification(`File "${file.name}" moved to "${targetFolder.name}"`, 'success');
        } else {
            this.showNotification('Folder not found', 'warning');
        }
    }

    // 创建测试项目（用于演示和测试）
    createTestProject() {
        const projectId = this.generateId();
        const testProject = {
            id: projectId,
            name: 'Test Project',
            description: 'A sample project with test files for demonstration',
            location: 'Test Location',
            created: new Date().toISOString(),
            modified: new Date().toISOString(),
            files: [
                {
                    id: this.generateId(),
                    name: 'sample_genome.fasta',
                    type: 'fasta',
                    size: 1024000,
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    folder: ['Genomes']
                },
                {
                    id: this.generateId(),
                    name: 'annotations.gff',
                    type: 'gff',
                    size: 512000,
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    folder: ['Annotations']
                },
                {
                    id: this.generateId(),
                    name: 'variants.vcf',
                    type: 'vcf',
                    size: 256000,
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    folder: ['Variants']
                },
                {
                    id: this.generateId(),
                    name: 'readme.txt',
                    type: 'txt',
                    size: 2048,
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    folder: []
                },
                {
                    id: this.generateId(),
                    name: 'analysis_results.bed',
                    type: 'bed',
                    size: 128000,
                    created: new Date().toISOString(),
                    modified: new Date().toISOString(),
                    folder: ['Analysis']
                }
            ],
            folders: [
                { name: 'Genomes', icon: '🧬', path: ['Genomes'], files: [] },
                { name: 'Annotations', icon: '📋', path: ['Annotations'], files: [] },
                { name: 'Variants', icon: '🔄', path: ['Variants'], files: [] },
                { name: 'Reads', icon: '📊', path: ['Reads'], files: [] },
                { name: 'Analysis', icon: '📈', path: ['Analysis'], files: [] }
            ],
            metadata: {
                totalFiles: 5,
                totalSize: 1922048,
                lastOpened: new Date().toISOString()
            }
        };

        this.projects.set(projectId, testProject);
        this.saveProjects();
        this.renderProjectTree();
        this.selectProject(projectId);

        this.showNotification('✅ Test project created with sample files! Try right-clicking on files to see the context menu.', 'success');
    }

    // ====== 项目状态管理方法 ======
    
    /**
     * 标记项目为已修改
     */
    markProjectAsModified() {
        if (!this.currentProject) return;
        
        this.currentProject.hasUnsavedChanges = true;
        this.currentProject.modified = new Date().toISOString();
        
        // 保存到本地存储
        this.projects.set(this.currentProject.id, this.currentProject);
        this.saveProjects();
        
        // 更新保存按钮状态
        this.updateSaveButtonState();
        
        console.log('📝 Project marked as modified (changes buffered)');
    }
    
    /**
     * 标记项目为已保存
     */
    markProjectAsSaved() {
        if (!this.currentProject) return;
        
        this.currentProject.hasUnsavedChanges = false;
        
        // 保存到本地存储
        this.projects.set(this.currentProject.id, this.currentProject);
        this.saveProjects();
        
        this.updateSaveButtonState();
        
        console.log('💾 Project marked as saved');
    }
    
    /**
     * 更新保存按钮状态
     */
    updateSaveButtonState() {
        const saveBtn = document.querySelector('[onclick*="saveCurrentProject"]') || 
                       document.querySelector('.save-btn') ||
                       document.querySelector('[title*="Save"]');
        
        if (!saveBtn) return;
        
        const hasChanges = this.currentProject && this.currentProject.hasUnsavedChanges;
        
        if (hasChanges) {
            saveBtn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
            saveBtn.style.boxShadow = '0 4px 15px rgba(255, 107, 107, 0.4)';
            saveBtn.innerHTML = saveBtn.innerHTML.includes('💾') ? '💾 Save *' : 'Save *';
            saveBtn.title = 'Save project - You have unsaved changes';
            
            // 添加脉冲动画
            saveBtn.style.animation = 'pulse 2s infinite';
        } else {
            saveBtn.style.background = 'linear-gradient(135deg, #36d1dc 0%, #5b86e5 100%)';
            saveBtn.style.boxShadow = '0 4px 15px rgba(54, 209, 220, 0.4)';
            saveBtn.innerHTML = saveBtn.innerHTML.includes('💾') ? '💾 Save' : 'Save';
            saveBtn.title = 'Save current project';
            saveBtn.style.animation = '';
        }
    }

    // ====== 菜单系统功能实现 ======
}

// 确保类在全局范围内可用
if (typeof window !== 'undefined') {
    window.ProjectManagerWindow = ProjectManagerWindow;
} 