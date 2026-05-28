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
    this.activeFilter = 'all'; // 'all', 'active', 'completed'
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
   * Delete a task
   */
  async deleteTask(params) {
    try {
      const { id } = params;
      if (!id) {
        throw new Error('Missing required parameter: id');
      }

      const index = this.tasks.findIndex(t => t.id === id);
      if (index === -1) {
        throw new Error(`Task not found with ID: ${id}`);
      }

      const task = this.tasks[index];
      this.tasks.splice(index, 1);
      
      this.updateUI();

      return {
        success: true,
        message: `Task "${task.title}" deleted successfully.`,
        id
      };
    } catch (error) {
      console.error('[TaskService] deleteTask error:', error);
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

    // Calculate overall stats
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
      containerEl.style.display = this.isCollapsed ? 'none' : 'flex';
    }

    if (toggleIconEl) {
      toggleIconEl.className = this.isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-down';
    }

    // Filter display list
    let displayTasks = this.tasks;
    if (this.activeFilter === 'active') {
      displayTasks = this.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
    } else if (this.activeFilter === 'completed') {
      displayTasks = this.tasks.filter(t => t.status === 'completed');
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

      displayTasks.forEach(task => {
        const itemEl = document.createElement('div');
        itemEl.className = `task-item ${task.status}`;
        itemEl.setAttribute('data-id', task.id);

        itemEl.innerHTML = `
          <div class="task-checkbox-container" title="Change status">
            ${statusIcons[task.status] || statusIcons.pending}
          </div>
          <div class="task-content-wrapper">
            <div class="task-text" title="Double click to edit title">${this._escapeHTML(task.title)}</div>
          </div>
          ${task.progress !== undefined && task.status !== 'completed' && task.status !== 'pending' ? `<div class="task-progress-badge">${task.progress}%</div>` : ''}
          <div class="task-item-actions">
            <button class="task-action-btn edit-btn" title="Edit task"><i class="fas fa-pencil-alt"></i></button>
            <button class="task-action-btn delete-btn" title="Delete task"><i class="fas fa-trash-alt"></i></button>
          </div>
        `;

        // Click checkbox icon to trigger status floating dropdown
        const cbContainer = itemEl.querySelector('.task-checkbox-container');
        if (cbContainer) {
          cbContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.task-status-dropdown').forEach(d => d.remove());
            
            const dropdown = document.createElement('div');
            dropdown.className = 'task-status-dropdown';
            dropdown.innerHTML = `
              <div class="status-option pending ${task.status === 'pending' ? 'selected' : ''}" data-status="pending">
                <i class="far fa-circle"></i> Pending
              </div>
              <div class="status-option in_progress ${task.status === 'in_progress' ? 'selected' : ''}" data-status="in_progress">
                <i class="fas fa-spinner"></i> In Progress
              </div>
              <div class="status-option completed ${task.status === 'completed' ? 'selected' : ''}" data-status="completed">
                <i class="fas fa-check-circle"></i> Completed
              </div>
              <div class="status-option failed ${task.status === 'failed' ? 'selected' : ''}" data-status="failed">
                <i class="fas fa-times-circle"></i> Failed
              </div>
            `;
            
            itemEl.appendChild(dropdown);
            
            dropdown.querySelectorAll('.status-option').forEach(opt => {
              opt.addEventListener('click', (optEvent) => {
                optEvent.stopPropagation();
                const newStatus = opt.getAttribute('data-status');
                dropdown.remove();
                this.updateTask({ id: task.id, status: newStatus });
              });
            });
            
            const closeDropdown = () => {
              dropdown.remove();
              document.removeEventListener('click', closeDropdown);
            };
            setTimeout(() => {
              document.addEventListener('click', closeDropdown);
            }, 0);
          });
        }

        // Editing Title
        const textEl = itemEl.querySelector('.task-text');
        const editBtn = itemEl.querySelector('.edit-btn');
        const wrapper = itemEl.querySelector('.task-content-wrapper');

        const startEdit = () => {
          if (!wrapper || wrapper.querySelector('input')) return;
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'task-edit-input';
          input.value = task.title;
          
          wrapper.innerHTML = '';
          wrapper.appendChild(input);
          input.focus();
          
          const saveEdit = async () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== task.title) {
              await this.updateTask({ id: task.id, title: newTitle });
            } else {
              this.updateUI();
            }
          };
          
          input.addEventListener('blur', saveEdit);
          input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              saveEdit();
            } else if (e.key === 'Escape') {
              this.updateUI();
            }
          });
        };

        if (textEl) {
          textEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            startEdit();
          });
        }
        if (editBtn) {
          editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startEdit();
          });
        }

        // Delete button
        const deleteBtn = itemEl.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteTask({ id: task.id });
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
        <div class="tasks-toolbar">
          <div class="tasks-filters">
            <button class="task-filter-btn active" data-filter="all">All</button>
            <button class="task-filter-btn" data-filter="active">Active</button>
            <button class="task-filter-btn" data-filter="completed">Completed</button>
          </div>
          <button id="clearTasksBtn" class="tasks-clear-btn" title="Clear all tasks">
            <i class="fas fa-trash-alt"></i> Clear All
          </button>
        </div>
        
        <div class="tasks-add-form">
          <input type="text" id="inlineAddTaskInput" placeholder="Add a new task..." />
          <button id="inlineAddTaskBtn" class="btn-inline-add">
            <i class="fas fa-plus"></i> Add
          </button>
        </div>
        
        <div class="tasks-list" id="tasksList"></div>
      </div>
    `;

    // Insert directly above the chatMessages block
    chatMessages.parentNode.insertBefore(tasksPanel, chatMessages);

    // Expand/collapse click listener on header
    const header = tasksPanel.querySelector('.tasks-panel-header');
    if (header) {
      header.addEventListener('click', () => {
        this.isCollapsed = !this.isCollapsed;
        this.updateUI();
      });
    }

    // Inline Add task inputs
    const addBtn = tasksPanel.querySelector('#inlineAddTaskBtn');
    const addInput = tasksPanel.querySelector('#inlineAddTaskInput');
    if (addBtn && addInput) {
      const handleAdd = () => {
        const title = addInput.value.trim();
        if (title) {
          this.addTask({ title });
          addInput.value = '';
        }
      };
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleAdd();
      });
      addInput.addEventListener('keydown', (e) => {
        e.stopPropagation(); // prevent input bubbling to chat manager text input
        if (e.key === 'Enter') {
          handleAdd();
        }
      });
    }

    // Filters event listeners
    const filterBtns = tasksPanel.querySelectorAll('.task-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeFilter = btn.getAttribute('data-filter');
        this.updateUI();
      });
    });

    // Clear all click listener
    const clearBtn = tasksPanel.querySelector('#clearTasksBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearTasks();
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
