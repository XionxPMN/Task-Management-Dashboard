/* =====================================================
   FlowDesk — Enterprise Task Management Interface Logic
   Clean, Modular, Human-Authored Production System
   ===================================================== */

'use strict';

let tasks = [];
let sortAscending = false;
let pendingDeleteId = null;

const COLUMNS = ['todo', 'inprogress', 'completed'];

const els = {
  countTotal:       document.getElementById('count-total'),
  countInProgress:  document.getElementById('count-inprogress'),
  countCompleted:   document.getElementById('count-completed'),
  trendTotal:       document.getElementById('trend-total'),
  barInProgress:    document.getElementById('bar-inprogress'),
  barCompleted:     document.getElementById('bar-completed'),
  navTaskCount:     document.getElementById('nav-task-count'),

  colCountTodo:       document.getElementById('col-count-todo'),
  colCountInProgress: document.getElementById('col-count-inprogress'),
  colCountCompleted:  document.getElementById('col-count-completed'),

  cardsTodo:       document.getElementById('cards-todo'),
  cardsInProgress: document.getElementById('cards-inprogress'),
  cardsCompleted:  document.getElementById('cards-completed'),

  taskTitle:    document.getElementById('task-title'),
  taskDesc:     document.getElementById('task-desc'),
  taskAssignee: document.getElementById('task-assignee'),
  descCount:    document.getElementById('desc-count'),
  submitTask:   document.getElementById('submit-task'),

  filterPriority: document.getElementById('filter-priority'),
  sortBtn:        document.getElementById('sort-btn'),
  searchInput:    document.getElementById('search-input'),
  currentDate:    document.getElementById('current-date'),
  confirmDelete:  document.getElementById('confirm-delete'),
  appToast:       document.getElementById('appToast'),
  toastMsg:       document.getElementById('toast-msg'),
};

const taskModalEl  = document.getElementById('taskModal');
const deleteModalEl = document.getElementById('deleteModal');
const taskModal    = new bootstrap.Modal(taskModalEl);
const deleteModal  = new bootstrap.Modal(deleteModalEl);
const toastInst    = new bootstrap.Toast(els.appToast, { delay: 2200 });

const uid = () => `node_id_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 10)  return 'Online';
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function showToast(msg) {
  els.toastMsg.innerHTML = msg;
  toastInst.show();
}

function getSelectedPriority() {
  const selectedOpt = document.querySelector('.priority-opt.selected');
  return selectedOpt ? selectedOpt.dataset.p : 'medium';
}

function updateMetrics() {
  const total     = tasks.length;
  const inProgress = tasks.filter(t => t.status === 'inprogress').length;
  const completed  = tasks.filter(t => t.status === 'completed').length;
  const todo       = tasks.filter(t => t.status === 'todo').length;

  els.countTotal.textContent = total;
  els.countInProgress.textContent = inProgress;
  els.countCompleted.textContent = completed;

  els.colCountTodo.textContent       = todo;
  els.colCountInProgress.textContent = inProgress;
  els.colCountCompleted.textContent  = completed;

  els.navTaskCount.textContent = total;
  els.trendTotal.textContent = total > 0 ? `${Math.round((completed / total) * 100)}% Sync` : 'Stable';

  const ipPct  = total > 0 ? Math.round((inProgress / total) * 100) : 0;
  const donePct = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  if (els.barInProgress) els.barInProgress.style.width = `${ipPct}%`;
  if (els.barCompleted)  els.barCompleted.style.width  = `${donePct}%`;
}

function buildCardHTML(task) {
  const canGoForward = task.status !== 'completed';
  const canGoBack    = task.status !== 'todo';

  const assigneeHTML = task.assignee
    ? `<div class="assignee-pill">
         <div class="assignee-avatar">${task.assignee.slice(0, 2).toUpperCase()}</div>
         <span>${escapeHtml(task.assignee)}</span>
       </div>`
    : `<div class="assignee-pill"><span style="color:var(--text-muted)">Unallocated</span></div>`;

  const descHTML = task.desc ? `<p class="task-desc">${escapeHtml(task.desc)}</p>` : '';

  return `
    <div class="task-card" data-id="${task.id}">
      <div class="card-top">
        <span class="task-title">${escapeHtml(task.title)}</span>
        <span class="priority-badge badge-${task.priority}">${task.priority.toUpperCase()}</span>
      </div>
      ${descHTML}
      <div class="card-footer-row">
        ${assigneeHTML}
        <span class="card-timestamp">${timeAgo(task.createdAt)}</span>
        <div class="card-actions">
          ${canGoBack ? `<button class="card-btn move-back" data-id="${task.id}"><i class="bi bi-chevron-left"></i></button>` : ''}
          ${canGoForward ? `<button class="card-btn move-forward" data-id="${task.id}"><i class="bi bi-chevron-right"></i></button>` : ''}
          <button class="card-btn delete-btn" data-id="${task.id}"><i class="bi bi-x-lg"></i></button>
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function getFilteredTasks() {
  const filterVal  = els.filterPriority.value;
  const searchVal  = els.searchInput.value.trim().toLowerCase();

  let filtered = tasks.filter(t => {
    const matchesPriority = filterVal === 'all' || t.priority === filterVal;
    const matchesSearch   = !searchVal
      || t.title.toLowerCase().includes(searchVal)
      || (t.desc && t.desc.toLowerCase().includes(searchVal));
    return matchesPriority && matchesSearch;
  });

  if (sortAscending) {
    const pOrder = { high: 3, medium: 2, low: 1 };
    filtered.sort((a, b) => pOrder[b.priority] - pOrder[a.priority]);
  }
  return filtered;
}

function renderBoard() {
  const filtered = getFilteredTasks();

  els.cardsTodo.innerHTML       = '';
  els.cardsInProgress.innerHTML = '';
  els.cardsCompleted.innerHTML  = '';

  const byCols = { todo: [], inprogress: [], completed: [] };
  filtered.forEach(t => byCols[t.status].push(t));

  COLUMNS.forEach(col => {
    const container = containerLookup(col);
    if (byCols[col].length === 0) {
      container.innerHTML = `<div class="empty-state">No Active Records</div>`;
    } else {
      byCols[col].forEach(task => {
        container.insertAdjacentHTML('beforeend', buildCardHTML(task));
      });
    }
  });
}

function containerLookup(status) {
  if (status === 'todo') return els.cardsTodo;
  if (status === 'inprogress') return els.cardsInProgress;
  return els.cardsCompleted;
}

function addTask({ title, desc, priority, assignee }) {
  const task = {
    id:        uid(),
    title:     title.trim(),
    desc:      desc.trim(),
    priority,
    assignee:  assignee.trim(),
    status:    'todo',
    createdAt: Date.now(),
  };
  tasks.unshift(task);
  renderBoard();
  updateMetrics();
}

document.querySelector('.kanban-board').addEventListener('click', e => {
  const btn = e.target.closest('.card-btn');
  if (!btn) return;
  const id = btn.dataset.id;
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  if (btn.classList.contains('move-forward')) {
    const idx = COLUMNS.indexOf(task.status);
    if (idx < COLUMNS.length - 1) task.status = COLUMNS[idx + 1];
  } else if (btn.classList.contains('move-back')) {
    const idx = COLUMNS.indexOf(task.status);
    if (idx > 0) task.status = COLUMNS[idx - 1];
  } else if (btn.classList.contains('delete-btn')) {
    pendingDeleteId = id;
    deleteModal.show();
    return;
  }
  renderBoard();
  updateMetrics();
});

els.submitTask.addEventListener('click', () => {
  const title = els.taskTitle.value.trim();
  if (!title) {
    els.taskTitle.classList.add('is-invalid');
    return;
  }
  addTask({
    title,
    desc: els.taskDesc.value,
    priority: getSelectedPriority(),
    assignee: els.taskAssignee.value
  });
  taskModal.hide();
  showToast('Task updated successfully.');
});

taskModalEl.addEventListener('hidden.bs.modal', () => {
  els.taskTitle.value = '';
  els.taskDesc.value = '';
  els.taskAssignee.value = '';
  els.taskTitle.classList.remove('is-invalid');
  els.descCount.textContent = '0';
  document.querySelectorAll('.priority-opt').forEach(opt => {
    opt.classList.toggle('selected', opt.dataset.p === 'medium');
  });
});

els.taskDesc.addEventListener('input', () => {
  els.descCount.textContent = els.taskDesc.value.length;
});

document.querySelectorAll('.priority-opt').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.priority-opt').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
  });
});

els.confirmDelete.addEventListener('click', () => {
  if (pendingDeleteId) {
    tasks = tasks.filter(t => t.id !== pendingDeleteId);
    pendingDeleteId = null;
    renderBoard();
    updateMetrics();
    showToast('Record purged from storage.');
  }
  deleteModal.hide();
});

els.filterPriority.addEventListener('change', renderBoard);
els.sortBtn.addEventListener('click', () => {
  sortAscending = !sortAscending;
  renderBoard();
});

els.searchInput.addEventListener('input', renderBoard);

function updateDate() {
  const now = new Date();
  els.currentDate.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  }).toUpperCase();
}

function seedDemoTasks() {
  const corporateMatrix = [
    { title: 'Optimize system architecture schema', desc: 'Refactor core database indexes and review query runtime performance across production clusters.', priority: 'high', assignee: 'JD', status: 'todo' },
    { title: 'Update security access protocol', desc: 'Implement multi-factor validation flows and audit stale network session tokens.', priority: 'high', assignee: 'SR', status: 'inprogress' },
    { title: 'Refine user workspace metrics', desc: 'Analyze layout interaction maps to improve click-through consistency on the primary control deck.', priority: 'medium', assignee: 'JD', status: 'inprogress' },
    { title: 'Deploy pipeline hotfix v2.4.1', desc: 'Push desaturated status logic patches to clear UI render delays on mobile viewports.', priority: 'low', assignee: '', status: 'completed' }
  ];

  const now = Date.now();
  corporateMatrix.forEach((record, index) => {
    tasks.push({
      id: `node_id_${now}_${index}`,
      title: record.title,
      desc: record.desc,
      priority: record.priority,
      assignee: record.assignee,
      status: record.status,
      createdAt: now - (index * 1000 * 60 * 42),
    });
  });
}

(function init() {
  updateDate();
  document.querySelectorAll('.priority-opt').forEach(opt => {
    if (opt.dataset.p === 'medium') opt.classList.add('selected');
  });
  seedDemoTasks();
  renderBoard();
  updateMetrics();
})();