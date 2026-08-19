/* eslint-disable no-new-func */
/**
 * TaskService Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/TaskService.js');

function createTaskService() {
  const code = fs.readFileSync(SERVICE_PATH, 'utf-8').replace('window.TaskService = TaskService;', '');
  // Execute code to get TaskService class (safe mock environment since document is undefined)
  const fn = new Function(code + '; return TaskService;');
  const TaskService = fn();
  return new TaskService({}, {});
}

describe('TaskService - Core State and CRUD', () => {
  let taskService;

  beforeEach(() => {
    taskService = createTaskService();
  });

  it('should initialize with empty tasks list', () => {
    expect(taskService.tasks).toEqual([]);
    expect(taskService.isCollapsed).toBe(false);
  });

  it('should add a task successfully with default status', async () => {
    const result = await taskService.addTask({ title: 'Analyze thrC gene' });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.task.title).toBe('Analyze thrC gene');
    expect(result.task.status).toBe('pending');
    expect(result.task.progress).toBe(0);
    expect(taskService.tasks).toHaveLength(1);
  });

  it('should support adding task with custom status and progress', async () => {
    const result = await taskService.addTask({
      title: 'Run BLAST Search',
      status: 'in_progress',
      progress: 45,
    });
    expect(result.success).toBe(true);
    expect(result.task.status).toBe('in_progress');
    expect(result.task.progress).toBe(45);
  });

  it('should throw error when adding task without title', async () => {
    const result = await taskService.addTask({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter: title');
  });

  it('should update a task successfully', async () => {
    const addResult = await taskService.addTask({ title: 'Task to update' });
    const taskId = addResult.id;

    const updateResult = await taskService.updateTask({
      id: taskId,
      title: 'Updated Task Title',
      status: 'in_progress',
      progress: 60,
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.task.title).toBe('Updated Task Title');
    expect(updateResult.task.status).toBe('in_progress');
    expect(updateResult.task.progress).toBe(60);

    const taskInList = taskService.tasks.find(t => t.id === taskId);
    expect(taskInList.title).toBe('Updated Task Title');
  });

  it('should automatically set progress to 100 when status is completed', async () => {
    const addResult = await taskService.addTask({ title: 'Task' });
    const taskId = addResult.id;

    const updateResult = await taskService.updateTask({
      id: taskId,
      status: 'completed',
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.task.status).toBe('completed');
    expect(updateResult.task.progress).toBe(100);
  });

  it('should automatically set progress to 0 when status is pending', async () => {
    const addResult = await taskService.addTask({ title: 'Task', status: 'completed', progress: 100 });
    const taskId = addResult.id;

    const updateResult = await taskService.updateTask({
      id: taskId,
      status: 'pending',
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.task.status).toBe('pending');
    expect(updateResult.task.progress).toBe(0);
  });

  it('should automatically mark status as completed when progress is set to 100', async () => {
    const addResult = await taskService.addTask({ title: 'Task' });
    const taskId = addResult.id;

    const updateResult = await taskService.updateTask({
      id: taskId,
      progress: 100,
    });

    expect(updateResult.success).toBe(true);
    expect(updateResult.task.status).toBe('completed');
    expect(updateResult.task.progress).toBe(100);
  });

  it('should list tasks and support filtering by status', async () => {
    await taskService.addTask({ title: 'Task 1', status: 'pending' });
    await taskService.addTask({ title: 'Task 2', status: 'in_progress' });
    await taskService.addTask({ title: 'Task 3', status: 'completed' });

    const allTasks = await taskService.listTasks();
    expect(allTasks.tasks).toHaveLength(3);

    const pendingOnly = await taskService.listTasks({ status: 'pending' });
    expect(pendingOnly.tasks).toHaveLength(1);
    expect(pendingOnly.tasks[0].title).toBe('Task 1');

    const inProgressOnly = await taskService.listTasks({ status: 'in_progress' });
    expect(inProgressOnly.tasks).toHaveLength(1);
    expect(inProgressOnly.tasks[0].title).toBe('Task 2');
  });

  it('should clear all tasks', async () => {
    await taskService.addTask({ title: 'Task 1' });
    await taskService.addTask({ title: 'Task 2' });

    expect(taskService.tasks).toHaveLength(2);

    const result = await taskService.clearTasks();
    expect(result.success).toBe(true);
    expect(taskService.tasks).toHaveLength(0);
  });

  it('should toggle task status via toggleTaskStatus method', async () => {
    const addResult = await taskService.addTask({ title: 'Toggle Test' });
    const taskId = addResult.id;

    taskService.toggleTaskStatus(taskId);
    expect(taskService.tasks[0].status).toBe('completed');
    expect(taskService.tasks[0].progress).toBe(100);

    taskService.toggleTaskStatus(taskId);
    expect(taskService.tasks[0].status).toBe('pending');
    expect(taskService.tasks[0].progress).toBe(0);
  });

  it('should delete a task successfully', async () => {
    const addResult = await taskService.addTask({ title: 'Task to delete' });
    const taskId = addResult.id;

    expect(taskService.tasks).toHaveLength(1);
    const deleteResult = await taskService.deleteTask({ id: taskId });
    expect(deleteResult.success).toBe(true);
    expect(taskService.tasks).toHaveLength(0);
  });

  it('should throw error when deleting task with invalid ID', async () => {
    const result = await taskService.deleteTask({ id: 'non-existent' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Task not found');
  });
});

describe('TaskService - LLM prompt formatting', () => {
  let taskService;

  beforeEach(() => {
    taskService = createTaskService();
  });

  it('should return empty string for empty task list', () => {
    expect(taskService.getTasksContextString()).toBe('');
  });

  it('should format tasks correctly in markdown context string', async () => {
    const task1 = await taskService.addTask({ title: 'Task A', status: 'pending' });
    const task2 = await taskService.addTask({ title: 'Task B', status: 'in_progress', progress: 50 });
    const task3 = await taskService.addTask({ title: 'Task C', status: 'completed' });

    const contextStr = taskService.getTasksContextString();

    expect(contextStr).toContain('=== CURRENT TASK CHECKLIST ===');
    expect(contextStr).toContain(`- [ ] Task A [ID: ${task1.id}] (0%)`);
    expect(contextStr).toContain(`- [/] Task B [ID: ${task2.id}] (50%)`);
    expect(contextStr).toContain(`- [x] Task C [ID: ${task3.id}] (100%)`);
    expect(contextStr).toContain('==============================');
  });
});

describe('TaskService - Panel visibility toggle', () => {
  let taskService;

  beforeEach(() => {
    document.body.innerHTML = '<main class="main-content"></main>';
    taskService = createTaskService();
    // _setTasksDockVisible schedules a real window.setTimeout to fire a resize
    // event; fake timers let each test flush it deterministically instead of
    // leaking a callback that fires after jsdom's window is torn down.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('should be hidden by default when there are no tasks', () => {
    expect(taskService.isPanelVisible()).toBe(false);
  });

  it('should become visible automatically once a task is added', async () => {
    await taskService.addTask({ title: 'Task A' });
    expect(taskService.isPanelVisible()).toBe(true);
    expect(document.getElementById('tasksDockContainer').style.display).toBe('flex');
  });

  it('should open an empty panel when toggled on with no tasks', () => {
    expect(taskService.togglePanelVisibility()).toBe(true);
    expect(taskService.isCollapsed).toBe(false);
    expect(document.getElementById('tasksDockContainer').style.display).toBe('flex');
    expect(document.getElementById('tasksPanel').style.display).toBe('flex');
    expect(document.querySelector('.tasks-empty-state')).not.toBeNull();
  });

  it('should hide the panel when toggled off even though tasks exist', async () => {
    await taskService.addTask({ title: 'Task A' });

    expect(taskService.togglePanelVisibility()).toBe(false);
    expect(document.getElementById('tasksDockContainer').style.display).toBe('none');
    expect(document.getElementById('tasksPanel').style.display).toBe('none');

    expect(taskService.togglePanelVisibility()).toBe(true);
    expect(document.getElementById('tasksDockContainer').style.display).toBe('flex');
  });

  it('should re-show a manually hidden panel when a new task arrives', async () => {
    await taskService.addTask({ title: 'Task A' });
    taskService.setPanelVisible(false);
    expect(taskService.isPanelVisible()).toBe(false);

    await taskService.addTask({ title: 'Task B' });
    expect(taskService.panelVisibilityOverride).toBeNull();
    expect(taskService.isPanelVisible()).toBe(true);
  });

  it('should broadcast visibility changes for the ChatBox header toggle', async () => {
    const seen = [];
    const handler = e => seen.push(e.detail.visible);
    window.addEventListener('tasks-panel-visibility-changed', handler);

    await taskService.addTask({ title: 'Task A' });
    taskService.setPanelVisible(false);
    taskService.setPanelVisible(true);

    window.removeEventListener('tasks-panel-visibility-changed', handler);
    expect(seen).toEqual([true, false, true]);
  });
});
