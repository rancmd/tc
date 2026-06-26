// ─────────────────────────────────────────────
//  TASK CRUSHER — app.js
// ─────────────────────────────────────────────

// ── STATE ──
let tasks         = [];
let currentIndex  = 0;
let selectedTags  = [];
let currentFilter = 'active';
let currentSort   = 'manual'; // 'manual' | 'priority' | 'time'
let openListDd    = null;
let dragSrcIdx    = null; // drag source index in full tasks array

const PROMPTS = [
  "What's your first task to crush today?",
  "What's been sitting on your list too long?",
  "Name one thing you'd feel great finishing.",
  "What's the task you keep avoiding?",
  "Drop your next task here — make it happen.",
  "What needs to happen before today ends?",
  "One task. Right now. Go.",
  "What would make today a win?",
  "What's the first domino to knock over?",
  "Name the thing. Then crush it.",
];

const CRUSH_WORDS = ['CRUSHED! 💥','BOOM! 🔥','NAILED IT! ⚡','DONE! ✊','YES! 🎉','DESTROYED! 💪'];

const TAG_COLORS = {
  '5 min':  '#5c47f5',
  '15 min': '#0ea5e9',
  '30 min': '#f59e0b',
  'Urgent': '#e53935',
  'Easy':   '#16a34a',
  'Fun':    '#9333ea',
};

const PRIO_ORDER = { 'Urgent': 0, 'Easy': 1, 'Fun': 2 };
const TIME_ORDER = { '5 min': 0, '15 min': 1, '30 min': 2 };

const COLORS = ['#5c47f5','#0ea5e9','#f59e0b','#e53935','#16a34a','#9333ea','#ec4899','#06b6d4'];

// ── STORAGE ──
function save() {
  localStorage.setItem('tc_tasks', JSON.stringify(tasks));
  localStorage.setItem('tc_index', String(currentIndex));
}
function load() {
  try {
    tasks = JSON.parse(localStorage.getItem('tc_tasks') || '[]');
    currentIndex = parseInt(localStorage.getItem('tc_index') || '0', 10);
    tasks.forEach(t => {
      if (!t.tags) t.tags = [];
      t.tags = t.tags.map(tag => tag
        .replace('⚡ ','').replace('🕐 ','').replace('⏰ ','').replace('🗓 ','')
        .replace('🔥 ','').replace('✌️ ','').replace('🎉 ','')
        .replace('1 hr','30 min')
      );
      t.tomorrow = false;
    });
  } catch(e) { tasks = []; currentIndex = 0; }
  if (currentIndex >= activeTasks().length) currentIndex = 0;
}

// ── HELPERS ──
function activeTasks()  { return tasks.filter(t => !t.done); }
function currentTask()  { const a = activeTasks(); return a[currentIndex] || a[0] || null; }
function esc(str)       { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function rand(arr)      { return arr[Math.floor(Math.random() * arr.length)]; }
function randColor()    { return rand(COLORS); }

// ── RENDER ──
function render() {
  const active = activeTasks();
  const done   = tasks.filter(t => t.done);
  const task   = currentTask();

  // task count
  const countEl = document.getElementById('task-count');
  if (active.length > 0 || done.length > 0) {
    let txt = '';
    if (active.length > 0) txt += active.length + ' task' + (active.length !== 1 ? 's' : '');
    if (done.length  > 0) txt += (txt ? '  ·  ' : '') + '✅ ' + done.length;
    countEl.textContent = txt;
    countEl.className   = done.length > 0 ? 'has-done' : '';
  } else {
    countEl.textContent = '';
    countEl.className   = '';
  }

  const taskCard  = document.getElementById('task-card');
  const emptyCard = document.getElementById('empty-card');
  const emptyDone = document.getElementById('empty-done-msg');
  const badge     = document.getElementById('task-badge');
  const queueHint = document.getElementById('queue-hint');
  const qaEl      = document.getElementById('quick-actions');
  const stEl      = document.getElementById('subtask-list');

  if (task) {
    taskCard.style.display  = 'block';
    emptyCard.style.display = 'none';
    emptyDone.style.display = 'none';

    document.getElementById('task-text').textContent = task.text;

    // badge
    if (task.tags && task.tags.length > 0) {
      badge.textContent = task.tags.join('  ·  ');
      badge.style.color = TAG_COLORS[task.tags[0]] || 'var(--accent)';
    } else {
      badge.textContent = '';
    }

    // queue hint with nav arrows
    const rem = active.length - 1;
    if (rem > 0) {
      queueHint.style.display = 'flex';
      document.getElementById('queue-label').textContent =
        (currentIndex + 1) + ' of ' + active.length;
      document.getElementById('nav-prev').disabled = currentIndex === 0;
      document.getElementById('nav-next').disabled = currentIndex >= active.length - 1;
    } else {
      queueHint.style.display = 'none';
    }

    renderQuickActions(task);
    renderSubtasks(task);

  } else {
    taskCard.style.display = 'none';
    badge.textContent      = '';
    qaEl.innerHTML         = '';
    stEl.innerHTML         = '';
    queueHint.style.display = 'none';

    if (done.length > 0) {
      emptyCard.style.display = 'none';
      emptyDone.style.display = 'block';
    } else {
      emptyCard.style.display = 'block';
      emptyDone.style.display = 'none';
      document.getElementById('empty-prompt').textContent = rand(PROMPTS);
    }
  }
}

// ── TASK NAVIGATION (prev/next) ──
function navTask(dir) {
  const active = activeTasks();
  currentIndex = Math.max(0, Math.min(active.length - 1, currentIndex + dir));
  save(); render();
}

// ── QUICK ACTIONS (3 dropdowns) ──
function renderQuickActions(task) {
  const el = document.getElementById('quick-actions');

  const timeOpts = ['5 min','15 min','30 min'];
  const prioOpts = ['Urgent','Easy','Fun'];
  const timeTag  = (task.tags || []).find(t => timeOpts.includes(t));
  const prioTag  = (task.tags || []).find(t => prioOpts.includes(t));

  el.innerHTML = `
    <!-- TIME dropdown -->
    <div class="qa-dropdown" id="dd-time">
      <button class="qa-pill ${timeTag ? 'active' : ''}" onclick="toggleDropdown('dd-time')">
        ${timeTag || 'Time'} ▾
      </button>
      <div class="qa-dropdown-menu" id="dd-time-menu">
        <button class="qa-menu-item ${timeTag==='5 min'?'selected':''}"  onclick="setTime('5 min')">5 min</button>
        <button class="qa-menu-item ${timeTag==='15 min'?'selected':''}" onclick="setTime('15 min')">15 min</button>
        <button class="qa-menu-item ${timeTag==='30 min'?'selected':''}" onclick="setTime('30 min')">30 min</button>
        ${timeTag ? '<div class="qa-menu-sep"></div><button class="qa-menu-item" onclick="clearTime()">Clear</button>' : ''}
      </div>
    </div>

    <!-- PRIORITY dropdown -->
    <div class="qa-dropdown" id="dd-prio">
      <button class="qa-pill ${prioTag ? 'active' : ''}" onclick="toggleDropdown('dd-prio')">
        ${prioTag || 'Priority'} ▾
      </button>
      <div class="qa-dropdown-menu" id="dd-prio-menu">
        <button class="qa-menu-item ${prioTag==='Urgent'?'selected':''}" onclick="setPrio('Urgent')">Urgent</button>
        <button class="qa-menu-item ${prioTag==='Easy'?'selected':''}"   onclick="setPrio('Easy')">Easy</button>
        <button class="qa-menu-item ${prioTag==='Fun'?'selected':''}"    onclick="setPrio('Fun')">Fun</button>
        ${prioTag ? '<div class="qa-menu-sep"></div><button class="qa-menu-item" onclick="clearPrio()">Clear</button>' : ''}
      </div>
    </div>

    <!-- MORE dropdown (split + delete) -->
    <div class="qa-dropdown" id="dd-more">
      <button class="qa-pill skip" onclick="toggleDropdown('dd-more')">More ▾</button>
      <div class="qa-dropdown-menu" id="dd-more-menu">
        <button class="qa-menu-item" onclick="openSplitModal()">Split task</button>
        <div class="qa-menu-sep"></div>
        <button class="qa-menu-item danger" onclick="deleteCurrentTask()">Delete</button>
      </div>
    </div>
  `;
}

// dropdown toggle
function toggleDropdown(id) {
  const menus = ['dd-time-menu','dd-prio-menu','dd-more-menu'];
  const menuId = id + '-menu';
  const isOpen = document.getElementById(menuId)?.classList.contains('open');
  menus.forEach(m => document.getElementById(m)?.classList.remove('open'));
  if (!isOpen) document.getElementById(menuId)?.classList.add('open');
  setTimeout(() => {
    document.addEventListener('click', closeDropdownsOutside, { once: true });
  }, 0);
}

function closeDropdownsOutside(e) {
  if (!e.target.closest('.qa-dropdown') && !e.target.closest('.list-dd')) closeAllDropdowns();
}
function closeAllDropdowns() {
  ['dd-time-menu','dd-prio-menu','dd-more-menu'].forEach(m => {
    document.getElementById(m)?.classList.remove('open');
  });
  closeAllListDropdowns();
}

// ── LIST ROW DROPDOWNS ──
function toggleListDd(id, event) {
  event && event.stopPropagation();
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.classList.contains('open');
  closeAllListDropdowns();
  if (!isOpen) {
    el.classList.add('open');
    openListDd = id;
    setTimeout(() => {
      document.addEventListener('click', closeListDdOutside, { once: true });
    }, 0);
  }
}
function closeListDdOutside(e) {
  if (!e.target.closest('.list-dd')) closeAllListDropdowns();
}
function closeAllListDropdowns() {
  document.querySelectorAll('.list-dd-menu.open').forEach(m => m.classList.remove('open'));
  openListDd = null;
}

// tag helpers
function setTime(tag) {
  const task = currentTask(); if (!task) return;
  task.tags = (task.tags || []).filter(t => !['5 min','15 min','30 min'].includes(t));
  task.tags.push(tag);
  save(); closeAllDropdowns(); render();
}
function clearTime() {
  const task = currentTask(); if (!task) return;
  task.tags = (task.tags || []).filter(t => !['5 min','15 min','30 min'].includes(t));
  save(); closeAllDropdowns(); render();
}
function setPrio(tag) {
  const task = currentTask(); if (!task) return;
  task.tags = (task.tags || []).filter(t => !['Urgent','Easy','Fun'].includes(t));
  task.tags.push(tag);
  save(); closeAllDropdowns(); render();
}
function clearPrio() {
  const task = currentTask(); if (!task) return;
  task.tags = (task.tags || []).filter(t => !['Urgent','Easy','Fun'].includes(t));
  save(); closeAllDropdowns(); render();
}

// ── SUBTASKS ──
function renderSubtasks(task) {
  const el = document.getElementById('subtask-list');
  if (!task.subtasks || task.subtasks.length === 0) { el.innerHTML = ''; return; }

  el.innerHTML = task.subtasks.map((st, i) => `
    <div class="subtask-card ${st.done ? 'done' : ''}" onclick="crushSubtask(${i})">
      <div class="subtask-dot" style="background:${task.color || 'var(--accent)'}"></div>
      <span class="subtask-text-label">${esc(st.text)}</span>
      <div class="subtask-crush-hint">✊ Crush it!</div>
      <button class="subtask-del" onclick="event.stopPropagation();deleteSubtask(${i})" title="Delete step">✕</button>
    </div>
  `).join('');
}

// ── CRUSH ──
function handleCardClick() { crushTask(); }

function crushTask() {
  const task = currentTask(); if (!task) return;
  // Release touch hover on mobile by blurring
  document.activeElement && document.activeElement.blur();
  document.getElementById('task-card').classList.remove('touch-active');

  task.done = true;
  if (currentIndex >= activeTasks().length) currentIndex = Math.max(0, activeTasks().length - 1);
  save();
  playConfetti();
  showCrushFlash();
  setTimeout(() => render(), 850);
}

function crushSubtask(idx) {
  const task = currentTask(); if (!task || !task.subtasks[idx]) return;
  task.subtasks[idx].done = true;
  save();
  playConfetti(true);
  renderSubtasks(task);
  if (task.subtasks.every(s => s.done)) {
    setTimeout(() => { if (confirm('All steps done! Crush the main task?')) crushTask(); }, 500);
  }
}

// ── DELETE ──
function deleteCurrentTask() {
  const task = currentTask(); if (!task) return;
  closeAllDropdowns();
  if (!confirm('Delete this task?')) return;
  tasks = tasks.filter(t => t !== task);
  if (currentIndex >= activeTasks().length) currentIndex = Math.max(0, activeTasks().length - 1);
  save(); render();
}

function deleteSubtask(idx) {
  const task = currentTask(); if (!task) return;
  task.subtasks.splice(idx, 1);
  save(); renderSubtasks(task);
}

// ── SPLIT ──
function openSplitModal() {
  const task = currentTask(); if (!task) return;
  closeAllDropdowns();
  document.getElementById('split-parent-label').innerHTML =
    `Breaking down: <strong>${esc(task.text)}</strong>`;
  const wrap = document.getElementById('split-inputs-wrap');
  wrap.innerHTML = '';
  addSplitInput(); addSplitInput();
  document.getElementById('split-modal').classList.remove('hidden');
  setTimeout(() => wrap.querySelector('.split-input')?.focus(), 100);
}
function closeSplitModal() {
  document.getElementById('split-modal').classList.add('hidden');
}
function addSplitInput() {
  const wrap = document.getElementById('split-inputs-wrap');
  const inp  = document.createElement('input');
  inp.type        = 'text';
  inp.className   = 'split-input';
  inp.placeholder = 'A smaller step…';
  inp.maxLength   = 140;
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { addSplitInput(); setTimeout(() => wrap.lastChild.focus(), 50); }
  });
  wrap.appendChild(inp);
}

function confirmSplit() {
  const steps = Array.from(document.querySelectorAll('.split-input'))
    .map(i => i.value.trim()).filter(Boolean);
  if (steps.length === 0) return;

  const task = currentTask(); if (!task) return;
  // Ensure split tasks get a unique color different from standalone tasks
  // If task has no parentId (standalone), assign it a color for the group
  if (!task.parentId) task.color = task.color || randColor();
  const color = task.color;

  const newTasks = steps.map(text => ({
    id: Date.now() + Math.random(),
    text,
    tags: [],
    done: false,
    subtasks: [],
    color,
    parentId: task.id,
    created: Date.now(),
  }));

  const taskIdx = tasks.indexOf(task);
  tasks.splice(taskIdx + 1, 0, ...newTasks);

  save();
  closeSplitModal();
  render();
}

// ── ADD TASK ──
function openAddModal() {
  selectedTags = [];
  document.getElementById('add-input').value = '';
  document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('add-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('add-input').focus(), 100);
}
function closeAddModal() {
  document.getElementById('add-modal').classList.add('hidden');
}

// position: 'top' = add as next task, 'bottom' = add to end
function submitTask(position = 'bottom') {
  const text = document.getElementById('add-input').value.trim();
  if (!text) { document.getElementById('add-input').focus(); return; }

  const newTask = {
    id: Date.now(),
    text,
    tags: [...selectedTags],
    done: false,
    subtasks: [],
    color: null, // standalone tasks have no color dot
    created: Date.now(),
  };

  if (position === 'top') {
    // Insert at start of active tasks (before first non-done task)
    const firstActiveIdx = tasks.findIndex(t => !t.done);
    if (firstActiveIdx === -1) tasks.push(newTask);
    else tasks.splice(firstActiveIdx, 0, newTask);
    currentIndex = 0;
  } else {
    tasks.push(newTask);
    if (activeTasks().length === 1) currentIndex = 0;
  }

  save();
  closeAddModal();
  render();
}

function toggleTag(btn) {
  const tag = btn.dataset.tag;
  if (selectedTags.includes(tag)) {
    selectedTags = selectedTags.filter(t => t !== tag);
    btn.classList.remove('selected');
  } else {
    selectedTags.push(tag);
    btn.classList.add('selected');
  }
}

// ── TASK LIST ──
function openList() {
  currentSort = 'manual';
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.toggle('active', b.dataset.sort === 'manual'));
  renderList();
  document.getElementById('list-overlay').classList.remove('hidden');
}
function closeList() {
  document.getElementById('list-overlay').classList.add('hidden');
  closeAllListDropdowns();
}
function setFilter(btn, filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}
function setSort(btn, sort) {
  currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}

function getSortedActiveTasks() {
  const active = tasks.filter(t => !t.done);
  if (currentSort === 'manual') return active;
  if (currentSort === 'priority') {
    return [...active].sort((a, b) => {
      const pa = (a.tags || []).find(t => t in PRIO_ORDER);
      const pb = (b.tags || []).find(t => t in PRIO_ORDER);
      const va = pa !== undefined ? PRIO_ORDER[pa] : 99;
      const vb = pb !== undefined ? PRIO_ORDER[pb] : 99;
      return va - vb;
    });
  }
  if (currentSort === 'time') {
    return [...active].sort((a, b) => {
      const ta = (a.tags || []).find(t => t in TIME_ORDER);
      const tb = (b.tags || []).find(t => t in TIME_ORDER);
      const va = ta !== undefined ? TIME_ORDER[ta] : 99;
      const vb = tb !== undefined ? TIME_ORDER[tb] : 99;
      return va - vb;
    });
  }
  return active;
}

function renderList() {
  const isDoneFilter = currentFilter === 'done';
  const isAllFilter  = currentFilter === 'all';

  // Show/hide sort bar — only relevant for active
  const sortBar = document.getElementById('list-sort');
  sortBar.style.display = isDoneFilter ? 'none' : 'flex';

  // Show/hide clear done button
  const clearDoneBtn = document.getElementById('clear-done-btn');
  const doneTasks = tasks.filter(t => t.done);
  clearDoneBtn.style.display = (isDoneFilter || isAllFilter) && doneTasks.length > 0 ? 'block' : 'none';

  let items;
  if (isDoneFilter) items = doneTasks;
  else if (isAllFilter) items = [...getSortedActiveTasks(), ...doneTasks];
  else items = getSortedActiveTasks();

  const el = document.getElementById('list-items');
  if (items.length === 0) {
    el.innerHTML = `<div class="list-empty">Nothing here yet.</div>`;
    return;
  }

  const timeOpts = ['5 min','15 min','30 min'];
  const prioOpts = ['Urgent','Easy','Fun'];

  // Build a set of task IDs that have split children (to decide dot visibility)
  const splitParentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId));

  el.innerHTML = items.map((task) => {
    const realIdx = tasks.indexOf(task);
    const cls     = task.done ? 'done' : '';

    // Color dot: show only if task has a parentId (is a split child) OR is a split parent
    const hasDot = task.parentId || splitParentIds.has(task.id);
    const dotColor = task.color || 'var(--accent)';

    const timeTag = (task.tags || []).find(t => timeOpts.includes(t));
    const prioTag = (task.tags || []).find(t => prioOpts.includes(t));
    const ddId    = `list-dd-${realIdx}`;

    // Is this task currently active on main screen?
    const activeTsk = currentTask();
    const isCurrent = !task.done && activeTsk && task.id === activeTsk.id;

    if (task.done) {
      return `
        <div class="list-item ${cls}" draggable="false">
          <div class="list-item-dot ${hasDot ? '' : 'invisible'}" style="background:${dotColor}"></div>
          <div class="list-item-body">
            <div class="list-item-text">${esc(task.text)}</div>
          </div>
          <div class="list-item-actions">
            <button class="list-icon-btn del" onclick="listDelete(${realIdx},event)">Delete</button>
          </div>
        </div>`;
    }

    return `
      <div class="list-item ${cls} ${isCurrent ? 'is-current' : ''}"
           draggable="${currentSort === 'manual' ? 'true' : 'false'}"
           data-idx="${realIdx}"
           onclick="listSelectTask(${realIdx})"
           ondragstart="onDragStart(event,${realIdx})"
           ondragover="onDragOver(event)"
           ondrop="onDrop(event,${realIdx})"
           ondragend="onDragEnd(event)">
        <div class="drag-handle ${currentSort === 'manual' ? '' : 'hidden'}" onclick="event.stopPropagation()">⠿</div>
        <div class="list-item-dot ${hasDot ? '' : 'invisible'}" style="background:${dotColor}"></div>
        <div class="list-item-body">
          <div class="list-item-text">${esc(task.text)}</div>
          <div class="list-item-row2">
            <!-- Time pill dropdown -->
            <div class="list-dd" onclick="event.stopPropagation()">
              <button class="list-tag-btn ${timeTag ? 'active-tag' : ''}"
                onclick="toggleListDd('${ddId}-time', event)">
                ${timeTag || 'Time'} ▾
              </button>
              <div class="list-dd-menu" id="${ddId}-time">
                ${timeOpts.map(opt => `
                  <button class="qa-menu-item ${timeTag===opt?'selected':''}"
                    onclick="listSetTag(${realIdx},'time','${opt}',event)">${opt}</button>
                `).join('')}
                ${timeTag ? `<div class="qa-menu-sep"></div>
                  <button class="qa-menu-item" onclick="listClearTag(${realIdx},'time',event)">Clear</button>` : ''}
              </div>
            </div>
            <!-- Priority pill dropdown -->
            <div class="list-dd" onclick="event.stopPropagation()">
              <button class="list-tag-btn ${prioTag ? 'active-tag' : ''}"
                onclick="toggleListDd('${ddId}-prio', event)">
                ${prioTag || 'Priority'} ▾
              </button>
              <div class="list-dd-menu" id="${ddId}-prio">
                ${prioOpts.map(opt => `
                  <button class="qa-menu-item ${prioTag===opt?'selected':''}"
                    onclick="listSetTag(${realIdx},'prio','${opt}',event)">${opt}</button>
                `).join('')}
                ${prioTag ? `<div class="qa-menu-sep"></div>
                  <button class="qa-menu-item" onclick="listClearTag(${realIdx},'prio',event)">Clear</button>` : ''}
              </div>
            </div>
          </div>
        </div>
        <!-- Actions dropdown -->
        <div class="list-item-actions" onclick="event.stopPropagation()">
          <div class="list-dd">
            <button class="list-icon-btn" onclick="toggleListDd('${ddId}-act', event)">⋯</button>
            <div class="list-dd-menu" id="${ddId}-act">
              <button class="qa-menu-item crush" onclick="listCrush(${realIdx},event)">✊ Crush</button>
              <div class="qa-menu-sep"></div>
              <button class="qa-menu-item danger" onclick="listDelete(${realIdx},event)">Delete</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── SELECT TASK FROM LIST ──
function listSelectTask(realIdx) {
  const task = tasks[realIdx];
  if (!task || task.done) return;
  const active = activeTasks();
  const newIdx = active.indexOf(task);
  if (newIdx === -1) return;
  currentIndex = newIdx;
  save();
  closeList();
  render();
}

function listCrush(idx, event) {
  event && event.stopPropagation();
  tasks[idx].done = true;
  if (currentIndex >= activeTasks().length) currentIndex = Math.max(0, activeTasks().length - 1);
  save(); closeAllListDropdowns(); renderList(); render();
}
function listDelete(idx, event) {
  event && event.stopPropagation();
  tasks.splice(idx, 1);
  if (currentIndex >= activeTasks().length) currentIndex = Math.max(0, activeTasks().length - 1);
  save(); closeAllListDropdowns(); renderList(); render();
}

function clearAllDone() {
  if (!confirm('Clear all completed tasks?')) return;
  tasks = tasks.filter(t => !t.done);
  if (currentIndex >= activeTasks().length) currentIndex = 0;
  save(); renderList(); render();
}

const TIME_OPTS = ['5 min','15 min','30 min'];
const PRIO_OPTS = ['Urgent','Easy','Fun'];

function listSetTag(idx, type, value, event) {
  event && event.stopPropagation();
  const task = tasks[idx]; if (!task) return;
  const opts = type === 'time' ? TIME_OPTS : PRIO_OPTS;
  task.tags = (task.tags || []).filter(t => !opts.includes(t));
  task.tags.push(value);
  save(); closeAllListDropdowns(); renderList(); render();
}
function listClearTag(idx, type, event) {
  event && event.stopPropagation();
  const task = tasks[idx]; if (!task) return;
  const opts = type === 'time' ? TIME_OPTS : PRIO_OPTS;
  task.tags = (task.tags || []).filter(t => !opts.includes(t));
  save(); closeAllListDropdowns(); renderList(); render();
}

// ── DRAG & DROP ──
function onDragStart(event, idx) {
  dragSrcIdx = idx;
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('dragging');
}
function onDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  // highlight drop target
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drag-over'));
  event.currentTarget.closest('.list-item')?.classList.add('drag-over');
}
function onDrop(event, targetIdx) {
  event.preventDefault();
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drag-over'));
  if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;

  // Only reorder among active tasks (done tasks are not draggable)
  const src  = tasks[dragSrcIdx];
  const tgt  = tasks[targetIdx];
  if (!src || !tgt || src.done || tgt.done) return;

  // Remove src from array, insert before/after target
  tasks.splice(dragSrcIdx, 1);
  const newTargetIdx = tasks.indexOf(tgt);
  tasks.splice(newTargetIdx, 0, src);

  // Update currentIndex to follow the currently-displayed task
  const active = activeTasks();
  const currentTask_ = activeTasks()[currentIndex] || activeTasks()[0];
  currentIndex = currentTask_ ? active.indexOf(currentTask_) : 0;
  if (currentIndex < 0) currentIndex = 0;

  dragSrcIdx = null;
  save(); renderList(); render();
}
function onDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drag-over'));
  dragSrcIdx = null;
}

// ── CONFETTI ──
function playConfetti(mini = false) {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const count  = mini ? 50 : 150;
  const colors = ['#5c47f5','#f59e0b','#e53935','#0ea5e9','#16a34a','#9333ea'];
  const pieces = Array.from({ length: count }, () => ({
    x:  canvas.width / 2 + (Math.random() - 0.5) * (mini ? 100 : canvas.width * 0.7),
    y:  mini ? canvas.height * 0.45 : -10,
    w:  Math.random() * 11 + 4,
    h:  Math.random() * 6 + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx: (Math.random() - 0.5) * (mini ? 7 : 14),
    vy: Math.random() * (mini ? 5 : 9) + (mini ? 1 : 2),
    rot: Math.random() * 360,
    rotV: (Math.random() - 0.5) * 9,
    opacity: 1,
  }));

  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.2;
      p.rot += p.rotV; p.opacity -= mini ? 0.02 : 0.013;
      if (p.opacity > 0 && p.y < canvas.height + 20) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
        ctx.restore();
      }
    });
    if (alive) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  })();
}

function showCrushFlash() {
  const flash = document.getElementById('crush-flash');
  const text  = document.getElementById('crush-flash-text');
  text.textContent = rand(CRUSH_WORDS);
  flash.style.transition = 'opacity 0.12s';
  flash.style.opacity    = '1';
  text.style.transform   = 'scale(1)';
  text.style.opacity     = '1';
  setTimeout(() => {
    flash.style.transition = 'opacity 0.4s';
    flash.style.opacity    = '0';
    text.style.opacity     = '0';
    text.style.transform   = 'scale(0.7)';
  }, 550);
}

// ── MOBILE: fix stuck hover after touch-tap ──
(function() {
  const card = document.getElementById('task-card');
  card.addEventListener('touchstart', () => card.classList.add('touch-active'), { passive: true });
  card.addEventListener('touchend', () => {
    setTimeout(() => card.classList.remove('touch-active'), 900);
  });
})();

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeAddModal(); closeList(); closeSplitModal(); closeAllDropdowns();
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    if (!document.getElementById('add-modal').classList.contains('hidden') &&
        document.activeElement !== document.getElementById('add-input')) {
      submitTask('bottom');
    }
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    if (document.getElementById('add-modal').classList.contains('hidden') &&
        document.getElementById('list-overlay').classList.contains('hidden')) {
      navTask(1);
    }
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    if (document.getElementById('add-modal').classList.contains('hidden') &&
        document.getElementById('list-overlay').classList.contains('hidden')) {
      navTask(-1);
    }
  }
});

// close overlays on backdrop click
['list-overlay','add-modal','split-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
});

// close dropdowns when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.qa-dropdown')) closeAllDropdowns();
});

// ── PWA ──
(function() {
  const m = {
    name:'Task Crusher', short_name:'Crusher', start_url:'.', display:'standalone',
    background_color:'#f5f5f0', theme_color:'#f5f5f0',
    icons:[{ src:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23f5f5f0'/><text y='.9em' font-size='76' x='12'>✊</text></svg>", sizes:'192x192', type:'image/svg+xml' }]
  };
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = URL.createObjectURL(new Blob([JSON.stringify(m)],{type:'application/json'}));
  document.head.appendChild(link);
})();

// ── INIT ──
load();
render();
