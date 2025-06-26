/**
 * ProjectManager - 独立项目管理器的核心类
 * 功能包括：项目创建、文件管理、工作空间组织、与主窗口通信
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
            viewMode: 'grid' // 'grid' or 'list'
        };
        
        // File type configurations
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
        
        this.selectedFiles = new Set();
        this.searchTerm = '';
        this.contextMenuTarget = null;
        
        // XML处理器
        this.xmlHandler = new ProjectXMLHandler();
        
        // Initialize
        this.loadSettings();
        this.loadProjects();
        this.initializeUI();
        this.setupEventListeners();
        
        console.log('ProjectManager initialized successfully');
    }

    /**
     * 初始化UI组件
     */
    initializeUI() {
        this.renderProjectTree();
        this.updateStatusBar();
        this.setupSearchFunctionality();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 搜索框事件
        const searchBox = document.getElementById('searchBox');
        if (searchBox) {
            searchBox.addEventListener('input', (e) => {
                this.searchTerm = e.target.value.toLowerCase();
                this.filterAndRenderFiles();
            });
        }

        // 文件拖拽支持
        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleFileDrop(e);
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // 窗口关闭事件
        if (window.electronAPI && window.electronAPI.onBeforeWindowClose) {
            window.electronAPI.onBeforeWindowClose(() => {
                this.saveProjects();
                this.saveSettings();
            });
        }
        
        // 使用标准的beforeunload事件作为备用
        window.addEventListener('beforeunload', () => {
            this.saveProjects();
            this.saveSettings();
        });
    }

    /**
     * 创建新项目模态框
     */
    createNewProject() {
        const modal = document.getElementById('newProjectModal');
        if (modal) {
            // 清空表单
            document.getElementById('projectName').value = '';
            document.getElementById('projectDescription').value = '';
            document.getElementById('projectLocation').value = this.settings.defaultProjectLocation || '';
            modal.style.display = 'block';
        }
    }

    /**
     * 选择项目位置
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
     * 创建项目
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
                    customAnnotations: []
                },
                metadata: {
                    totalFiles: 0,
                    totalSize: 0,
                    lastOpened: new Date().toISOString()
                }
            };

            // 创建项目目录结构
            if (window.electronAPI) {
                const result = await window.electronAPI.createProjectDirectory(location, name);
                if (!result.success) {
                    throw new Error(result.error);
                }
                project.location = result.projectPath;
            }

            // 添加到项目列表
            this.projects.set(projectId, project);
            this.addToRecentProjects(projectId);
            
            // 保存项目
            await this.saveProjects();
            
            // 更新UI
            this.renderProjectTree();
            this.selectProject(projectId);
            
            // 关闭模态框
            this.closeModal('newProjectModal');
            
            this.showNotification(`Project "${name}" created successfully`, 'success');
            this.updateStatusBar(`Project "${name}" created`);

        } catch (error) {
            console.error('Error creating project:', error);
            this.showNotification(`Failed to create project: ${error.message}`, 'error');
        }
    }

    /**
     * 打开现有项目
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
     * 从文件加载项目（支持JSON和XML格式）
     */
    async loadProjectFromFile(filePath) {
        try {
            if (window.electronAPI) {
                const result = await window.electronAPI.loadProjectFile(filePath);
                if (result.success) {
                    let project;
                    
                    // 根据文件扩展名或内容判断格式
                    if (filePath.endsWith('.xml') || result.content.trim().startsWith('<?xml') || result.content.includes('<GenomeExplorerProject')) {
                        // XML格式
                        const validation = this.xmlHandler.validateProjectXML(result.content);
                        if (!validation.valid) {
                            throw new Error(`Invalid XML project file: ${validation.error}`);
                        }
                        project = validation.project;
                    } else {
                        // JSON格式（向后兼容）
                        project = JSON.parse(result.content);
                        
                        // 验证项目数据
                        if (!project.id || !project.name) {
                            throw new Error('Invalid project file format');
                        }
                    }
                    
                    // 更新最后打开时间
                    if (!project.metadata) project.metadata = {};
                    project.metadata.lastOpened = new Date().toISOString();
                    
                    // 保存文件路径以便后续保存
                    project.filePath = filePath;
                    
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
     * 选择项目
     */
    selectProject(projectId) {
        this.currentProject = this.projects.get(projectId);
        this.currentPath = [];
        
        if (this.currentProject) {
            // 更新UI
            this.renderProjectContent();
            this.updateActiveTreeItem(projectId);
            this.updateContentTitle();
            this.updateProjectStats();
            
            // 显示项目内容区域
            document.getElementById('projectOverview').style.display = 'none';
            document.getElementById('projectContent').style.display = 'block';
            
            this.updateStatusBar(`Opened project: ${this.currentProject.name}`);
            
            // 通知全局项目状态更新
            this.notifyProjectChange(this.currentProject);
        }
    }
    
    /**
     * 通知项目状态变化
     */
    async notifyProjectChange(project) {
        if (window.electronAPI && window.electronAPI.setActiveProject) {
            try {
                const projectInfo = {
                    id: project.id,
                    name: project.name,
                    location: project.location,
                    dataFolderPath: project.location ? `${project.location}/data` : null,
                    projectFilePath: project.filePath || null
                };
                
                await window.electronAPI.setActiveProject(projectInfo);
                console.log('🗂️ Project change notified:', projectInfo);
            } catch (error) {
                console.error('Error notifying project change:', error);
            }
        }
    }

    /**
     * 渲染项目树
     */
    renderProjectTree() {
        const projectTree = document.getElementById('projectTree');
        if (!projectTree) return;

        let html = '';
        
        if (this.projects.size === 0) {
            html = '<div style="padding: 20px; text-align: center; color: #6c757d;">No projects found</div>';
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
                
                // 显示项目文件夹（如果项目被选中）
                if (isActive) {
                    html += this.renderProjectFolders(project);
                }
            });
        }
        
        projectTree.innerHTML = html;
    }

    /**
     * 渲染项目文件夹结构
     */
    renderProjectFolders(project) {
        let html = '';
        
        // 默认文件夹
        const defaultFolders = [
            { name: 'Genomes', icon: '🧬', path: ['genomes'] },
            { name: 'Annotations', icon: '📋', path: ['annotations'] },
            { name: 'Variants', icon: '🔄', path: ['variants'] },
            { name: 'Reads', icon: '📊', path: ['reads'] },
            { name: 'Analysis', icon: '📈', path: ['analysis'] }
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
     * 导航到文件夹
     */
    navigateToFolder(path) {
        this.currentPath = path;
        this.renderProjectContent();
        this.updateActiveTreeItem();
        this.updateContentTitle();
    }

    /**
     * 渲染项目内容
     */
    renderProjectContent() {
        if (!this.currentProject) return;

        this.updateProjectStats();
        this.renderFileGrid();
    }

    /**
     * 渲染文件网格
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
     * 获取当前文件夹的文件
     */
    getCurrentFolderFiles() {
        if (!this.currentProject) return [];
        
        // 根据当前路径筛选文件
        return this.currentProject.files.filter(file => {
            if (this.currentPath.length === 0) return true;
            return file.folder && this.arraysEqual(file.folder, this.currentPath);
        });
    }

    /**
     * 过滤文件
     */
    filterFiles(files) {
        if (!this.searchTerm) return files;
        
        return files.filter(file => 
            file.name.toLowerCase().includes(this.searchTerm) ||
            (file.description && file.description.toLowerCase().includes(this.searchTerm))
        );
    }

    /**
     * 添加文件到项目
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
     * 处理选择的文件
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
                            modified: fileInfo.info.modified
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
     * 创建文件夹
     */
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
            this.saveProjectAsXML(this.currentProject.id);
        }
        
        this.renderProjectContent();
        this.showNotification(`Folder "${folderName}" created successfully`, 'success');
        
        console.log(`📁 Created folder: ${folderName} at path: ${newPath.join('/')}`);
    }

    /**
     * 选择文件
     */
    selectFile(fileId, ctrlKey = false) {
        if (ctrlKey) {
            // 多选模式
            if (this.selectedFiles.has(fileId)) {
                this.selectedFiles.delete(fileId);
            } else {
                this.selectedFiles.add(fileId);
            }
        } else {
            // 单选模式
            this.selectedFiles.clear();
            this.selectedFiles.add(fileId);
        }
        
        this.updateFileCardSelection();
    }

    /**
     * 更新文件卡片选择状态
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
     * 打开文件在主窗口
     */
    async openFileInMainWindow(fileId) {
        const file = this.findFileById(fileId);
        if (!file) return;

        try {
            if (window.electronAPI) {
                // 检查主窗口状态
                const mainWindowStatus = await window.electronAPI.checkMainWindowStatus();
                
                if (mainWindowStatus.hasOpenFile) {
                    // 主窗口已有文件，创建新窗口
                    const result = await window.electronAPI.createNewMainWindow(file.path);
                    if (result.success) {
                        this.showNotification(`Opened "${file.name}" in new window`, 'success');
                    } else {
                        throw new Error(result.error);
                    }
                } else {
                    // 主窗口没有文件，在当前主窗口打开
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
     * 显示文件上下文菜单
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
            { icon: '🗑️', text: 'Remove from Project', action: 'remove' }
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
     * 处理上下文菜单动作
     */
    async handleContextMenuAction(action) {
        if (!this.contextMenuTarget) return;
        
        const file = this.findFileById(this.contextMenuTarget);
        if (!file) return;

        // 隐藏上下文菜单
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
     * 重命名文件
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
     * 从项目中移除文件
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
     * 更新项目统计
     */
    updateProjectStats() {
        const statsElement = document.getElementById('projectStats');
        if (!statsElement || !this.currentProject) return;

        const stats = {
            totalFiles: this.currentProject.files.length,
            currentFolderFiles: this.getCurrentFolderFiles().length,
            totalSize: this.currentProject.files.reduce((sum, file) => sum + (file.size || 0), 0),
            fileTypes: this.getFileTypeStats()
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
     * 获取文件类型统计
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
     * 更新内容标题
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
     * 更新状态栏
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
     * 处理键盘快捷键
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
     * 选择所有文件
     */
    selectAllFiles() {
        this.selectedFiles.clear();
        const currentFiles = this.getCurrentFolderFiles();
        currentFiles.forEach(file => this.selectedFiles.add(file.id));
        this.updateFileCardSelection();
        this.updateStatusBar();
    }

    /**
     * 删除选中的文件
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
     * 刷新项目
     */
    async refreshProjects() {
        // 如果有当前项目，扫描其目录并添加新文件/文件夹
        if (this.currentProject && this.currentProject.location) {
            await this.scanAndAddNewFiles();
            this.renderProjectTree();
            this.renderProjectContent();
            this.showNotification('🔄 Project directory scanned and refreshed', 'success');
        } else {
            // 如果没有当前项目，则正常加载项目列表
            await this.loadProjects();
            this.renderProjectTree();
            this.showNotification('📂 Projects list refreshed', 'success');
        }
    }

    /**
     * 扫描项目文件夹并添加新文件
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

                    // 标记项目为已修改，这样保存按钮就会保存到.prj.GAI文件
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

    /**
     * 显示设置
     */
    showSettings() {
        // TODO: 实现设置界面
        this.showNotification('Settings feature coming soon', 'info');
    }

    /**
     * 关闭模态框
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // ====== 工具方法 ======

    /**
     * 生成项目ID
     */
    generateProjectId() {
        return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 生成文件ID
     */
    generateFileId() {
        return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 检测文件类型
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
     * 格式化文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    /**
     * 格式化日期
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }

    /**
     * 数组比较
     */
    arraysEqual(a, b) {
        return a.length === b.length && a.every((val, i) => val === b[i]);
    }

    /**
     * 根据ID查找文件
     */
    findFileById(fileId) {
        if (!this.currentProject) return null;
        return this.currentProject.files.find(f => f.id === fileId);
    }

    /**
     * 复制到剪贴板
     */
    copyToClipboard(text) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            this.showNotification('Path copied to clipboard', 'success');
        }
    }

    /**
     * 显示通知
     */
    showNotification(message, type = 'info') {
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // TODO: 实现更好的通知系统
        if (type === 'error') {
            alert(`Error: ${message}`);
        }
    }

    /**
     * 添加到最近项目
     */
    addToRecentProjects(projectId) {
        this.recentProjects = this.recentProjects.filter(id => id !== projectId);
        this.recentProjects.unshift(projectId);
        this.recentProjects = this.recentProjects.slice(0, 10); // 只保留最近10个
    }

    /**
     * 更新活动树项目
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
     * 设置搜索功能
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
     * 过滤并渲染文件
     */
    filterAndRenderFiles() {
        this.renderFileGrid();
    }

    /**
     * 处理文件拖拽
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
     * 预览文件
     */
    previewFile(file) {
        // TODO: 实现文件预览功能
        this.showNotification(`Preview for ${file.name} coming soon`, 'info');
    }

    /**
     * 保存项目数据
     */
    async saveProjects() {
        try {
            const projectsData = {
                projects: Object.fromEntries(this.projects),
                recentProjects: this.recentProjects,
                lastSaved: new Date().toISOString()
            };
            
            if (window.electronAPI) {
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
            this.showNotification('Failed to save projects', 'error');
        }
    }

    /**
     * 导出项目为XML格式
     */
    async exportProjectAsXML(projectId) {
        try {
            const project = this.projects.get(projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            // 生成XML内容
            const xmlContent = this.xmlHandler.projectToXML(project);
            
            // 创建下载
            if (window.electronAPI) {
                const fileName = `${project.name.replace(/[^\w\s-]/g, '')}_project.xml`;
                const result = await window.electronAPI.saveFile(fileName, xmlContent);
                if (result.success) {
                    this.showNotification(`Project exported to ${result.filePath}`, 'success');
                } else {
                    throw new Error(result.error);
                }
            } else {
                // 浏览器环境下载
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
     * 保存单个项目为XML文件
     */
    async saveProjectAsXML(projectId) {
        try {
            const project = this.projects.get(projectId);
            if (!project) {
                throw new Error('Project not found');
            }

            // 生成XML内容
            const xmlContent = this.xmlHandler.projectToXML(project);
            
            if (window.electronAPI && window.electronAPI.saveProjectToSpecificFile) {
                // 直接保存到项目文件路径，不弹出对话框
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
                    // 如果没有现有路径，使用saveProjectFile（会弹出对话框）
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
     * 保存当前项目
     */
    async saveCurrentProject() {
        if (!this.currentProject) {
            this.showNotification('No project to save', 'warning');
            return;
        }
        
        try {
            // 更新项目修改时间
            this.currentProject.modified = new Date().toISOString();
            
            // 确保项目数据是最新的
            this.projects.set(this.currentProject.id, this.currentProject);
            
            // 保存到localStorage
            await this.saveProjects();
            
            // 保存到XML文件
            await this.saveProjectAsXML(this.currentProject.id);
            
            // 标记项目为已保存
            this.markProjectAsSaved();
            
            this.showNotification(`✅ Project "${this.currentProject.name}" saved successfully`, 'success');
            console.log(`💾 Project saved: ${this.currentProject.name}`);
            
        } catch (error) {
            console.error('Error saving current project:', error);
            this.showNotification(`Failed to save project: ${error.message}`, 'error');
        }
    }

    /**
     * 加载项目数据
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
                // 浏览器环境下从localStorage加载
                const data = localStorage.getItem('genomeExplorer_projects');
                if (data) {
                    projectsData = JSON.parse(data);
                }
            }
            
            if (projectsData) {
                this.projects = new Map(Object.entries(projectsData.projects || {}));
                this.recentProjects = projectsData.recentProjects || [];
            }
            
            console.log(`Loaded ${this.projects.size} projects`);
        } catch (error) {
            console.error('Error loading projects:', error);
            this.projects = new Map();
            this.recentProjects = [];
        }
    }

    /**
     * 保存设置
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
     * 加载设置
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
}

// 确保在全局范围内可用
if (typeof window !== 'undefined') {
    window.ProjectManager = ProjectManager;
} 