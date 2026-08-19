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
    // Manual show/hide override for the Tasks dock.
    // null = automatic (visible whenever there is at least one task),
    // true/false = user forced the panel open/closed from the ChatBox header.
    this.panelVisibilityOverride = null;
    this._lastNotifiedVisibility = null;
    this._dockWidthApplied = false;
  }

  // --- Panel visibility (driven by the ChatBox header toggle) ---

  /**
   * Whether the Tasks dock should currently be on screen.
   * @returns {boolean}
   */
  isPanelVisible() {
    if (this.panelVisibilityOverride !== null) return this.panelVisibilityOverride;
    return this.tasks.length > 0;
  }

  /**
   * Explicitly show or hide the Tasks dock.
   * @param {boolean} visible
   * @returns {boolean} the resulting visibility
   */
  setPanelVisible(visible) {
    this.panelVisibilityOverride = !!visible;
    if (this.panelVisibilityOverride) {
      // Opening the panel should always reveal the list, not a collapsed header
      this.isCollapsed = false;
    }
    this.updateUI();
    return this.isPanelVisible();
  }

  /**
   * Toggle the Tasks dock open/closed.
   * @returns {boolean} the resulting visibility
   */
  togglePanelVisibility() {
    return this.setPanelVisible(!this.isPanelVisible());
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

      // Auto-expand panel when a new task is added, and drop any manual
      // hide so freshly created tasks are never silently invisible
      this.isCollapsed = false;
      this.panelVisibilityOverride = null;

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
        id,
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
    str +=
      'The following checklist tracks your execution progress. ' +
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

    const tasksDock = document.getElementById('tasksDockContainer');
    const tasksPanel = document.getElementById('tasksPanel');
    if (!tasksPanel) return;

    if (!this.isPanelVisible()) {
      tasksPanel.style.display = 'none';
      this._setTasksDockVisible(tasksDock, false);
      this._notifyVisibilityChange(false);
      return;
    }

    this._setTasksDockVisible(tasksDock, true);
    tasksPanel.style.display = 'flex';
    this._notifyVisibilityChange(true);

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

      if (displayTasks.length === 0) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'tasks-empty-state';
        emptyEl.innerHTML = `
          <i class="fas fa-clipboard-list"></i>
          <span>${
            this.tasks.length === 0
              ? 'No tasks yet. Add one below, or ask the assistant to plan a workflow.'
              : 'No tasks match this filter.'
          }</span>
        `;
        listEl.appendChild(emptyEl);
      }

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
          cbContainer.addEventListener('click', e => {
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
              opt.addEventListener('click', optEvent => {
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
          input.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              saveEdit();
            } else if (e.key === 'Escape') {
              this.updateUI();
            }
          });
        };

        if (textEl) {
          textEl.addEventListener('dblclick', e => {
            e.stopPropagation();
            startEdit();
          });
        }
        if (editBtn) {
          editBtn.addEventListener('click', e => {
            e.stopPropagation();
            startEdit();
          });
        }

        // Delete button
        const deleteBtn = itemEl.querySelector('.delete-btn');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', e => {
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
    if (document.getElementById('tasksPanel')) return;

    const tasksDock = this._ensureTasksDockContainer();
    if (!tasksDock) return;

    const tasksPanel = document.createElement('div');
    tasksPanel.id = 'tasksPanel';
    tasksPanel.className = 'tasks-panel';
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

    tasksDock.appendChild(tasksPanel);

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
      addBtn.addEventListener('click', e => {
        e.stopPropagation();
        handleAdd();
      });
      addInput.addEventListener('keydown', e => {
        e.stopPropagation(); // prevent input bubbling to chat manager text input
        if (e.key === 'Enter') {
          handleAdd();
        }
      });
    }

    // Filters event listeners
    const filterBtns = tasksPanel.querySelectorAll('.task-filter-btn');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', e => {
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
      clearBtn.addEventListener('click', e => {
        e.stopPropagation();
        this.clearTasks();
      });
    }
  }

  /**
   * Ensure the independent Tasks dock exists outside the ChatBox DOM.
   */
  _ensureTasksDockContainer() {
    let tasksDock = document.getElementById('tasksDockContainer');
    if (!tasksDock) {
      const mainContent = document.querySelector('.main-content');
      if (!mainContent) return null;

      tasksDock = document.createElement('div');
      tasksDock.id = 'tasksDockContainer';
      tasksDock.className = 'tasks-dock-container';
      tasksDock.style.display = 'none';

      const chatDockSplitter = document.getElementById('chatDockSplitter');
      mainContent.insertBefore(tasksDock, chatDockSplitter || null);
    }

    this._ensureTasksDockSplitter(tasksDock);
    this._applySavedDockWidth(tasksDock);

    return tasksDock;
  }

  /**
   * Ensure the drag handle that resizes the Tasks dock exists and is wired up.
   * Lives immediately before the dock so dragging left widens the panel.
   */
  _ensureTasksDockSplitter(tasksDock) {
    if (!tasksDock || !tasksDock.parentNode) return null;

    let splitter = document.getElementById('tasksDockSplitter');
    if (!splitter) {
      splitter = document.createElement('div');
      splitter.id = 'tasksDockSplitter';
      splitter.className = 'tasks-dock-splitter';
      splitter.style.display = 'none';
      splitter.innerHTML = '<div class="tasks-dock-splitter-handle">\u22ee</div>';
      tasksDock.parentNode.insertBefore(splitter, tasksDock);
    }

    this._setupSplitterDragging(splitter, tasksDock);

    return splitter;
  }

  /**
   * Restore the width the user last dragged the Tasks dock to.
   */
  _applySavedDockWidth(tasksDock) {
    if (!tasksDock || this._dockWidthApplied) return;
    this._dockWidthApplied = true;

    const savedWidth = this._getConfig('tasks.dockWidth', null);
    if (typeof savedWidth === 'number' && savedWidth > 0) {
      tasksDock.style.width = `${this._clampDockWidth(savedWidth)}px`;
    }
  }

  /**
   * Keep the dock within the same bounds the CSS declares, so a stale saved
   * width or a smaller window can never squeeze out the genome viewer.
   */
  _clampDockWidth(width) {
    const mainContent = typeof document !== 'undefined' ? document.querySelector('.main-content') : null;
    const available = mainContent?.offsetWidth || 0;
    const maxWidth = available > 0 ? Math.max(TaskService.MIN_DOCK_WIDTH, available * 0.5) : Infinity;

    return Math.round(Math.max(TaskService.MIN_DOCK_WIDTH, Math.min(maxWidth, width)));
  }

  /**
   * Drag-to-resize behaviour for the Tasks dock, mirroring the ChatBox dock splitter.
   */
  _setupSplitterDragging(splitter, tasksDock) {
    if (!splitter || !tasksDock || splitter.dataset.resizeBound === 'true') return;
    splitter.dataset.resizeBound = 'true';

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    const onMouseDown = e => {
      if (e.button !== 0) return;

      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(tasksDock.style.width, 10) || tasksDock.offsetWidth;

      splitter.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      e.preventDefault();
    };

    const onMouseMove = e => {
      if (!isResizing) return;
      // Dragging left (smaller clientX) widens the right-hand dock
      tasksDock.style.width = `${this._clampDockWidth(startWidth + (startX - e.clientX))}px`;
    };

    const onMouseUp = () => {
      if (!isResizing) return;
      isResizing = false;

      splitter.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      const finalWidth = parseInt(tasksDock.style.width, 10);
      if (finalWidth > 0) this._setConfig('tasks.dockWidth', finalWidth);

      this._notifyLayoutChanged();
    };

    splitter.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  /**
   * Read a persisted setting, tolerating a ChatManager without a ConfigManager
   */
  _getConfig(key, defaultValue) {
    const configManager = this.chatManager?.configManager;
    if (!configManager || typeof configManager.get !== 'function') return defaultValue;

    try {
      return configManager.get(key, defaultValue);
    } catch (error) {
      console.warn('[TaskService] Failed to read config:', key, error);
      return defaultValue;
    }
  }

  /**
   * Persist a setting, tolerating a ChatManager without a ConfigManager
   */
  _setConfig(key, value) {
    const configManager = this.chatManager?.configManager;
    if (!configManager || typeof configManager.set !== 'function') return;

    try {
      configManager.set(key, value);
    } catch (error) {
      console.warn('[TaskService] Failed to persist config:', key, error);
    }
  }

  /**
   * Show/hide the Tasks dock and notify canvas-based viewers when layout changes.
   */
  _setTasksDockVisible(tasksDock, visible) {
    if (!tasksDock) return;

    const nextDisplay = visible ? 'flex' : 'none';
    if (tasksDock.style.display === nextDisplay) return;

    tasksDock.style.display = nextDisplay;

    // The splitter is only meaningful while the dock it resizes is on screen
    const splitter = document.getElementById('tasksDockSplitter');
    if (splitter) splitter.style.display = nextDisplay;

    this._notifyLayoutChanged();
  }

  /**
   * Let canvas-based viewers re-measure after the dock changes the layout width.
   */
  _notifyLayoutChanged() {
    if (typeof window === 'undefined') return;

    window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }

  /**
   * Broadcast panel visibility so the ChatBox header toggle can stay in sync
   * when tasks appear or are cleared without user interaction.
   */
  _notifyVisibilityChange(visible) {
    if (this._lastNotifiedVisibility === visible) return;
    this._lastNotifiedVisibility = visible;

    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    if (typeof CustomEvent !== 'function') return;

    window.dispatchEvent(new CustomEvent('tasks-panel-visibility-changed', { detail: { visible } }));
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

// Matches the min-width the stylesheet declares for .tasks-dock-container
TaskService.MIN_DOCK_WIDTH = 260;

window.TaskService = TaskService;
