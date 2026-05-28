// @ts-check
/**
 * TaskService - Handles Task Tracking operations in CodeXomics
 * All built-in task management tools route here.
 */
class TaskService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
    this.tasks = [];
    this.isCollapsed = false;
  }

  // --- Core CRUD operations ---

  /**
   * Add a new task to the list
   */
  async addTask(params) {
    try {
      const { title, status = 'pending', progress = 0, parentId = null } = params;

      if (!title) {
        throw new Error('Missing required parameter: title');
      }

      // Generate a unique ID
      const id = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const newTask = {
        id,
        title,
        status,
        progress: status === 'completed' ? 100 : progress,
        parentId,
        createdAt: new Date().toISOString(),
      };

      this.tasks.push(newTask);
      
      // Auto-expand panel when a new task is added
      this.isCollapsed = false;

      this.updateUI();
      
      return {
        success: true,
        message: `Task "${title}" added successfully.`,
        id,
        task: newTask,
      };
    } catch (error) {
      console.error('[TaskService] addTask error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update properties of an existing task
   */
  async updateTask(params) {
    try {
      const { id, title, status, progress } = params;

      if (!id) {
        throw new Error('Missing required parameter: id');
      }

      const task = this.tasks.find(t => t.id === id);
      if (!task) {
        throw new Error(`Task not found with ID: ${id}`);
      }

      if (title !== undefined) task.title = title;
      if (status !== undefined) {
        task.status = status;
        if (status === 'completed' && progress === undefined) {
          task.progress = 100;
        } else if (status === 'pending' && progress === undefined) {
          task.progress = 0;
        }
      }
      if (progress !== undefined) {
        task.progress = Number(progress);
        if (task.progress === 100 && status === undefined) {
          task.status = 'completed';
        }
      }

      this.updateUI();

      return {
        success: true,
        message: `Task "${task.title}" updated successfully.`,
        id,
        task,
      };
    } catch (error) {
      console.error('[TaskService] updateTask error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * List current tasks, optionally filtering by status
   */
  async listTasks(params = {}) {
    try {
      const statusFilter = params.status || 'all';
      let filtered = this.tasks;

      if (statusFilter !== 'all') {
        filtered = this.tasks.filter(t => t.status === statusFilter);
      }

      return {
        success: true,
        tasks: filtered,
      };
    } catch (error) {
      console.error('[TaskService] listTasks error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all tasks
   */
  async clearTasks(params = {}) {
    try {
      this.tasks = [];
      this.updateUI();
      return {
        success: true,
        message: 'All tasks cleared successfully.',
      };
    } catch (error) {
      console.error('[TaskService] clearTasks error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Interactive UI helper: toggle task between completed and pending
   */
  toggleTaskStatus(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      const newProgress = newStatus === 'completed' ? 100 : 0;
      this.updateTask({ id, status: newStatus, progress: newProgress });
    }
  }

  /**
   * Generate a formatted text block of current tasks for LLM context
   */
  getTasksContextString() {
    if (this.tasks.length === 0) return '';

    let str = '\n=== CURRENT TASK CHECKLIST ===\n';
    str += 'The following checklist tracks your execution progress. ' +
      'Keep it updated using the update_task tool as you work.\n';
    
    this.tasks.forEach(t => {
      let mark = ' ';
      if (t.status === 'completed') mark = 'x';
      else if (t.status === 'in_progress') mark = '/';
      else if (t.status === 'failed') mark = '!';

      const progressStr = t.progress !== undefined ? ` (${t.progress}%)` : '';
      str += `- [${mark}] ${t.title} [ID: ${t.id}]${progressStr}\n`;
    });

    str += '==============================\n';
    return str;
  }

  /**
   * Update the tasks UI panel dynamically
   */
  updateUI() {
    if (typeof document === 'undefined') return;
    // Ensure container exists
    this.ensureUIContainer();

    const tasksPanel = document.getElementById('chatTasksPanel');
    if (!tasksPanel) return;

    if (this.tasks.length === 0) {
      tasksPanel.style.display = 'none';
      return;
    }

    tasksPanel.style.display = 'flex';

    // Calculate progress
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.status === 'completed').length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Update summary text and progress bar
    const progressTextEl = tasksPanel.querySelector('.tasks-progress-text');
    if (progressTextEl) {
      progressTextEl.textContent = `(${completed}/${total})`;
    }

    const progressBarEl = tasksPanel.querySelector('.tasks-progress-bar');
    if (progressBarEl) {
      progressBarEl.style.width = `${progressPercent}%`;
    }

    // Toggle collapse class and toggle icon
    const containerEl = document.getElementById('tasksListContainer');
    const toggleIconEl = tasksPanel.querySelector('#toggleTasksCollapseBtn i');
    
    if (containerEl) {
      containerEl.style.display = this.isCollapsed ? 'none' : 'block';
    }

    if (toggleIconEl) {
      toggleIconEl.className = this.isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down';
    }

    // Render task items
    const listEl = document.getElementById('tasksList');
    if (listEl) {
      listEl.innerHTML = '';
      
      const statusIcons = {
        pending: '<i class="far fa-circle task-status-icon"></i>',
        in_progress: '<i class="fas fa-spinner task-status-icon"></i>',
        completed: '<i class="fas fa-check-circle task-status-icon"></i>',
        failed: '<i class="fas fa-times-circle task-status-icon"></i>',
      };

      this.tasks.forEach(task => {
        const itemEl = document.createElement('div');
        itemEl.className = `task-item ${task.status}`;
        itemEl.setAttribute('data-id', task.id);

        itemEl.innerHTML = `
          <div class="task-checkbox-container">
            ${statusIcons[task.status] || statusIcons.pending}
          </div>
          <div class="task-text">${this._escapeHTML(task.title)}</div>
          ${task.progress !== undefined ? `<div class="task-progress-badge">${task.progress}%</div>` : ''}
        `;

        // Click checkbox or text to toggle completion
        const cbContainer = itemEl.querySelector('.task-checkbox-container');
        if (cbContainer) {
          cbContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleTaskStatus(task.id);
          });
        }

        listEl.appendChild(itemEl);
      });
    }
  }

  /**
   * Helper to ensure the Tasks HTML panel is injected
   */
  ensureUIContainer() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('chatTasksPanel')) return;

    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const tasksPanel = document.createElement('div');
    tasksPanel.id = 'chatTasksPanel';
    tasksPanel.className = 'chat-tasks-panel';
    tasksPanel.style.display = 'none';

    tasksPanel.innerHTML = `
      <div class="tasks-panel-header" id="tasksPanelHeader">
        <div class="tasks-summary">
          <i class="fas fa-tasks"></i>
          <span class="tasks-title">Active Tasks</span>
          <span class="tasks-progress-text">(0/0)</span>
          <div class="tasks-progress-bar-container">
            <div class="tasks-progress-bar" style="width: 0%;"></div>
          </div>
        </div>
        <div class="tasks-controls">
          <button id="toggleTasksCollapseBtn" class="btn-icon" title="Toggle Tasks list">
            <i class="fas fa-chevron-down"></i>
          </button>
        </div>
      </div>
      <div class="tasks-list-container" id="tasksListContainer" style="display: none;">
        <div class="tasks-list" id="tasksList"></div>
      </div>
    `;

    // Insert directly above the chatMessages block
    chatMessages.parentNode.insertBefore(tasksPanel, chatMessages);

    // Bind expand/collapse events
    const header = tasksPanel.querySelector('.tasks-panel-header');
    if (header) {
      header.addEventListener('click', () => {
        this.isCollapsed = !this.isCollapsed;
        this.updateUI();
      });
    }
  }

  /**
   * Helper to escape HTML characters
   */
  _escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

window.TaskService = TaskService;
