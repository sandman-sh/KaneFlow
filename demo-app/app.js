/**
 * TaskFlow Pro — Core Application Logic
 * Verified with Kane CLI & KaneFlow Closed Loop
 */

const DEFAULT_TASKS = [
  {
    id: 'task-1',
    title: 'Setup Kane CLI automation runner',
    desc: 'Configure NDJSON streaming and browser session',
    priority: 'Urgent',
    status: 'done',
    createdAt: Date.now() - 3600000 * 5
  },
  {
    id: 'task-2',
    title: 'Implement priority filter buttons',
    desc: 'Filter tasks by Urgent, High, Medium, Low tags',
    priority: 'High',
    status: 'in-progress',
    createdAt: Date.now() - 3600000 * 3
  },
  {
    id: 'task-3',
    title: 'Add closed-loop self-healing agent',
    desc: 'Parse Kane failure trace and apply automated code patches',
    priority: 'Urgent',
    status: 'todo',
    createdAt: Date.now() - 3600000 * 1
  }
];

class TaskFlowApp {
  constructor() {
    this.tasks = this.loadTasks();
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.hasInjectedBug = false;

    this.initElements();
    this.attachEvents();
    this.render();
  }

  loadTasks() {
    try {
      const saved = localStorage.getItem('taskflow_items');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Storage read error, using defaults', e);
    }
    return [...DEFAULT_TASKS];
  }

  saveTasks() {
    try {
      localStorage.setItem('taskflow_items', JSON.stringify(this.tasks));
    } catch (e) {
      console.error('Storage write error', e);
    }
    this.render();
  }

  initElements() {
    this.listTodo = document.getElementById('list-todo');
    this.listProgress = document.getElementById('list-in-progress');
    this.listDone = document.getElementById('list-done');
    
    this.countTodo = document.getElementById('count-todo');
    this.countProgress = document.getElementById('count-in-progress');
    this.countDone = document.getElementById('count-done');
    this.statTotal = document.getElementById('stat-total');
    this.statCompleted = document.getElementById('stat-completed');

    this.searchInput = document.getElementById('search-input');
    this.filterPills = document.getElementById('filter-pills');
    this.filterIndicator = document.getElementById('active-filter-indicator');
    this.currentFilterName = document.getElementById('current-filter-name');
    this.btnClearFilter = document.getElementById('btn-clear-filter');

    this.modal = document.getElementById('task-modal');
    this.taskForm = document.getElementById('task-form');
    this.modalTitle = document.getElementById('modal-title');
    this.btnOpenCreate = document.getElementById('btn-open-create-modal');
    this.btnCloseModal = document.getElementById('btn-close-modal');
    this.btnCancelModal = document.getElementById('btn-cancel-modal');
    this.btnClearDone = document.getElementById('btn-clear-done');

    this.inputTitle = document.getElementById('task-title');
    this.inputDesc = document.getElementById('task-desc');
    this.inputPriority = document.getElementById('task-priority');
    this.inputStatus = document.getElementById('task-status');
    this.inputId = document.getElementById('task-id');

    this.btnInjectBug = document.getElementById('btn-inject-filter-bug');
    this.btnResetDemo = document.getElementById('btn-reset-demo');
  }

  attachEvents() {
    // Modal Open/Close
    this.btnOpenCreate.addEventListener('click', () => this.openCreateModal());
    this.btnCloseModal.addEventListener('click', () => this.closeModal());
    this.btnCancelModal.addEventListener('click', () => this.closeModal());
    
    // Quick Add Buttons on Columns
    document.querySelectorAll('.btn-add-quick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const status = e.currentTarget.getAttribute('data-status') || 'todo';
        this.openCreateModal(status);
      });
    });

    // Form Submit
    this.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    // Search
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.render();
    });

    // Priority Filter Pills
    this.filterPills.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (!pill) return;
      
      const filter = pill.getAttribute('data-filter');
      this.setFilter(filter);
    });

    // Clear Filter
    this.btnClearFilter.addEventListener('click', () => {
      this.setFilter('all');
    });

    // Clear Done Tasks
    this.btnClearDone.addEventListener('click', () => {
      this.tasks = this.tasks.filter(t => t.status !== 'done');
      this.saveTasks();
      this.showToast('Cleared completed tasks', 'info');
    });

    // Live Demo Bug Injections
    if (this.btnInjectBug) {
      this.btnInjectBug.addEventListener('click', () => {
        this.injectBug('priority_filter');
      });
    }

    if (this.btnResetDemo) {
      this.btnResetDemo.addEventListener('click', () => {
        this.resetDemoState();
      });
    }
  }

  setFilter(filter) {
    this.currentFilter = filter;
    
    // Update active pill styling
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.classList.toggle('active', pill.getAttribute('data-filter') === filter);
    });

    // Update banner indicator
    if (filter !== 'all') {
      this.filterIndicator.style.display = 'flex';
      this.currentFilterName.textContent = filter;
    } else {
      this.filterIndicator.style.display = 'none';
    }

    this.render();
  }

  openCreateModal(initialStatus = 'todo') {
    this.modalTitle.textContent = 'Create New Task';
    this.taskForm.reset();
    this.inputId.value = '';
    this.inputStatus.value = initialStatus;
    this.modal.style.display = 'flex';
    setTimeout(() => this.inputTitle.focus(), 50);
  }

  closeModal() {
    this.modal.style.display = 'none';
    this.taskForm.reset();
  }

  handleFormSubmit() {
    const title = this.inputTitle.value.trim();
    if (!title) return;

    const desc = this.inputDesc.value.trim();
    const priority = this.inputPriority.value;
    const status = this.inputStatus.value;
    const id = this.inputId.value;

    if (id) {
      // Edit existing
      const task = this.tasks.find(t => t.id === id);
      if (task) {
        task.title = title;
        task.desc = desc;
        task.priority = priority;
        task.status = status;
        this.showToast(`Updated: ${title}`, 'success');
      }
    } else {
      // Create new
      const newTask = {
        id: 'task-' + Date.now(),
        title,
        desc,
        priority,
        status,
        createdAt: Date.now()
      };
      this.tasks.unshift(newTask);
      this.showToast(`Created task: ${title}`, 'success');
    }

    this.saveTasks();
    this.closeModal();
  }

  moveTask(id, nextStatus) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      task.status = nextStatus;
      this.saveTasks();
      this.showToast(`Moved to ${nextStatus}`, 'info');
    }
  }

  deleteTask(id) {
    const task = this.tasks.find(t => t.id === id);
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveTasks();
    if (task) {
      this.showToast(`Deleted "${task.title}"`, 'info');
    }
  }

  /**
   * Filter predicate logic
   */
  matchesFilter(task) {
    // 1. Search Query check
    if (this.searchQuery) {
      const matchTitle = task.title.toLowerCase().includes(this.searchQuery);
      const matchDesc = task.desc && task.desc.toLowerCase().includes(this.searchQuery);
      if (!matchTitle && !matchDesc) return false;
    }

    // 2. Standard Filter Logic
    if (this.currentFilter === 'all') return true;
    return task.priority.toLowerCase() === this.currentFilter.toLowerCase();
  }

  render() {
    const todoTasks = [];
    const progressTasks = [];
    const doneTasks = [];

    let totalCount = 0;
    let completedCount = 0;

    this.tasks.forEach(task => {
      totalCount++;
      if (task.status === 'done') completedCount++;

      if (this.matchesFilter(task)) {
        if (task.status === 'todo') todoTasks.push(task);
        else if (task.status === 'in-progress') progressTasks.push(task);
        else if (task.status === 'done') doneTasks.push(task);
      }
    });

    this.statTotal.textContent = totalCount;
    this.statCompleted.textContent = completedCount;

    this.countTodo.textContent = todoTasks.length;
    this.countProgress.textContent = progressTasks.length;
    this.countDone.textContent = doneTasks.length;

    this.renderColumn(this.listTodo, todoTasks, 'todo');
    this.renderColumn(this.listProgress, progressTasks, 'in-progress');
    this.renderColumn(this.listDone, doneTasks, 'done');
  }

  renderColumn(container, tasks, colStatus) {
    container.innerHTML = '';
    if (tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 24px 8px; color: var(--text-muted); font-size: 0.8rem;">
          No tasks in ${colStatus}
        </div>
      `;
      return;
    }

    tasks.forEach(task => {
      const card = document.createElement('div');
      card.className = 'task-card';
      card.id = `card-${task.id}`;
      card.setAttribute('data-id', task.id);
      card.setAttribute('data-priority', task.priority);

      const priorityTagClass = `tag-${task.priority.toLowerCase()}`;

      // Navigation action buttons
      let moveButtonsHtml = '';
      if (colStatus === 'todo') {
        moveButtonsHtml = `<button class="btn-card-action" data-action="progress" title="Move to In Progress">▶</button>`;
      } else if (colStatus === 'in-progress') {
        moveButtonsHtml = `
          <button class="btn-card-action" data-action="todo" title="Move to To Do">◀</button>
          <button class="btn-card-action" data-action="done" title="Move to Done">✓</button>
        `;
      } else if (colStatus === 'done') {
        moveButtonsHtml = `<button class="btn-card-action" data-action="progress" title="Move back to In Progress">◀</button>`;
      }

      card.innerHTML = `
        <div class="task-card-header">
          <span class="task-card-title">${this.escapeHtml(task.title)}</span>
          <div class="card-actions">
            ${moveButtonsHtml}
            <button class="btn-card-action btn-delete" data-action="delete" title="Delete Task">&times;</button>
          </div>
        </div>
        ${task.desc ? `<p class="task-card-desc">${this.escapeHtml(task.desc)}</p>` : ''}
        <div class="task-card-footer">
          <span class="priority-tag ${priorityTagClass}">
            ${task.priority === 'Urgent' ? '🔥 ' : task.priority === 'High' ? '⚡ ' : ''}${task.priority}
          </span>
          <span class="task-date" style="font-size: 0.7rem; color: var(--text-muted); font-family: var(--font-mono);">
            ${new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>
      `;

      // Card action events
      card.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.btn-card-action');
        if (!actionBtn) return;
        const action = actionBtn.getAttribute('data-action');
        
        if (action === 'delete') {
          this.deleteTask(task.id);
        } else if (action === 'progress') {
          this.moveTask(task.id, 'in-progress');
        } else if (action === 'done') {
          this.moveTask(task.id, 'done');
        } else if (action === 'todo') {
          this.moveTask(task.id, 'todo');
        }
      });

      container.appendChild(card);
    });
  }

  escapeHtml(str) {
    return str.replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#039;');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }

  injectBug(type) {
    if (type === 'priority_filter') {
      this.hasInjectedBug = true;
      this.render();
      this.showToast('🐞 Bug injected: Priority filter logic is broken!', 'error');
    }
  }

  resetDemoState() {
    this.hasInjectedBug = false;
    this.tasks = [...DEFAULT_TASKS];
    this.currentFilter = 'all';
    this.searchQuery = '';
    localStorage.removeItem('taskflow_items');
    this.setFilter('all');
    this.render();
    this.showToast('State reset to clean defaults', 'info');
  }
}

// Expose instance globally for Kane CLI or demo interactions
window.taskflow = new TaskFlowApp();
