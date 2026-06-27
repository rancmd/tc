// ─────────────────────────────────────────────
//  TASK CRUSHER — app.js
// ─────────────────────────────────────────────

// ── STATE ──
let tasks         = [];
let currentIndex  = 0;
let currentFilter = 'active';
let currentSort   = 'manual';
let openListDd    = null;
let dragSrcIdx    = null;

// Add-screen tag state
let addTimeTag = null;
let addPrioTag = null;

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
function activeTasks() { return tasks.filter(t => !t.done); }
function currentTask() { const a = activeTasks(); return a[currentIndex] || a[0] || null; }
function esc(str)      { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function rand(arr)     { return arr[Math.floor(Math.random() * arr.length)]; }
function randColor()   { return rand(COLORS); }

// Pick a color that isn't already used by another split group
function uniqueColor() {
  const usedColors = new Set(tasks.filter(t => t.color).map(t => t.color));
  const available  = COLORS.filter(c => !usedColors.has(c));
  return available.length > 0 ? available[0] : rand(COLORS);
}

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
  const queueHint = document.getElementById('queue-hint');
  const qaEl      = document.getElementById('quick-actions');
  const stEl      = document.getElementById('subtask-list');

  if (task) {
    taskCard.style.display  = 'block';
    emptyCard.style.display = 'none';
    emptyDone.style.display = 'none';

    document.getElementById('task-text').textContent = task.text;

    // queue hint with nav arrows
    if (active.length > 1) {
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
    taskCard.style.display  = 'none';
    qaEl.innerHTML          = '';
    stEl.innerHTML          = '';
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

// ── TASK NAVIGATION ──
function navTask(dir) {
  const active = activeTasks();
  currentIndex = Math.max(0, Math.min(active.length - 1, currentIndex + dir));
  save(); render();
}

// ── SWIPE TO NAVIGATE (mobile) ──
(function() {
  let touchStartY = 0;
  let touchStartX = 0;
  const stage = document.getElementById('app');

  stage.addEventListener('touchstart', e => {
    // Only track swipes that start on the stage/card area, not on buttons or overlays
    if (e.target.closest('#quick-actions') || e.target.closest('#subtask-list') ||
        e.target.closest('#queue-hint') || e.target.closest('#fab')) return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  stage.addEventListener('touchend', e => {
    if (e.target.closest('#quick-actions') || e.target.closest('#subtask-list') ||
        e.target.closest('#queue-hint') || e.target.closest('#fab')) return;
    const dy = touchStartY - e.changedTouches[0].clientY;
    const dx = Math.abs(touchStartX - e.changedTouches[0].clientX);
    // Only trigger if mostly vertical and more than 60px
    if (Math.abs(dy) > 60 && Math.abs(dy) > dx * 1.5) {
      if (dy > 0) navTask(1);   // swipe up → next task
      else        navTask(-1);  // swipe down → prev task
    }
  }, { passive: true });
})();

// ── QUICK ACTIONS (Time · Priority · Split) ──
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

    <!-- SPLIT pill (direct, no dropdown) -->
    <button class="qa-pill skip" onclick="openSplitModal()">Split ✂</button>
  `;
}

// dropdown toggle
function toggleDropdown(id) {
  const menus  = ['dd-time-menu','dd-prio-menu'];
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
  ['dd-time-menu','dd-prio-menu'].forEach(m => document.getElementById(m)?.classList.remove('open'));
  // also close add-screen dropdowns
  ['add-dd-time-menu','add-dd-prio-menu'].forEach(m => document.getElementById(m)?.classList.remove('open'));
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

// ── TAG HELPERS (main screen) ──
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
  const card = document.getElementById('task-card');
  card.classList.remove('touch-active');
  card.style.pointerEvents = 'none'; // prevent double-tap

  task.done = true;
  if (currentIndex >= activeTasks().length) currentIndex = Math.max(0, activeTasks().length - 1);
  save();
  playConfetti();
  showCrushFlash();
  setTimeout(() => {
    card.style.pointerEvents = '';
    render();
  }, 900);
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

  // Every split gets a unique color — different from all existing groups
  const color = uniqueColor();

  // The parent task itself gets this color and becomes part of the group
  task.color    = color;
  task.parentId = task.parentId || null; // keep existing parentId if it has one

  const newTasks = steps.map(text => ({
    id:       Date.now() + Math.random(),
    text,
    tags:     [],
    done:     false,
    subtasks: [],
    color,
    parentId: task.id,
    created:  Date.now(),
  }));

  const taskIdx = tasks.indexOf(task);
  tasks.splice(taskIdx + 1, 0, ...newTasks);

  // After split, navigate to the first child (the first step)
  // so it's immediately the focus
  const newActive = activeTasks();
  const firstChild = newTasks[0];
  const firstChildIdx = newActive.indexOf(firstChild);
  if (firstChildIdx !== -1) currentIndex = firstChildIdx;

  save();
  closeSplitModal();
  render();
}

// ── ADD TASK SCREEN ──
function openAddScreen() {
  addTimeTag = null;
  addPrioTag = null;
  document.getElementById('add-input').value = '';
  // Reset pill labels
  document.getElementById('add-time-pill').textContent = 'Time ▾';
  document.getElementById('add-prio-pill').textContent = 'Priority ▾';
  document.getElementById('add-time-pill').classList.remove('active');
  document.getElementById('add-prio-pill').classList.remove('active');
  // Reset menu selections
  document.querySelectorAll('#add-dd-time-menu .qa-menu-item, #add-dd-prio-menu .qa-menu-item')
    .forEach(b => b.classList.remove('selected'));
  document.getElementById('add-screen').classList.remove('hidden');
  setTimeout(() => document.getElementById('add-input').focus(), 100);
}
function closeAddScreen() {
  document.getElementById('add-screen').classList.add('hidden');
  closeAllDropdowns();
}

function submitTask() {
  const text = document.getElementById('add-input').value.trim();
  if (!text) { document.getElementById('add-input').focus(); return; }

  const tags = [];
  if (addTimeTag) tags.push(addTimeTag);
  if (addPrioTag) tags.push(addPrioTag);

  tasks.push({
    id:       Date.now(),
    text,
    tags,
    done:     false,
    subtasks: [],
    color:    null,
    created:  Date.now(),
  });
  if (activeTasks().length === 1) currentIndex = 0;

  save();
  closeAddScreen();
  render();
}

// Add-screen dropdown toggles
function toggleAddDropdown(id) {
  const menus  = ['add-dd-time-menu','add-dd-prio-menu'];
  const menuId = id + '-menu';
  const isOpen = document.getElementById(menuId)?.classList.contains('open');
  menus.forEach(m => document.getElementById(m)?.classList.remove('open'));
  if (!isOpen) document.getElementById(menuId)?.classList.add('open');
  setTimeout(() => {
    document.addEventListener('click', closeAddDropdownsOutside, { once: true });
  }, 0);
}
function closeAddDropdownsOutside(e) {
  if (!e.target.closest('#add-tag-actions')) {
    ['add-dd-time-menu','add-dd-prio-menu'].forEach(m =>
      document.getElementById(m)?.classList.remove('open')
    );
  }
}

function addSetTime(tag) {
  addTimeTag = tag;
  const pill = document.getElementById('add-time-pill');
  pill.textContent = tag + ' ▾';
  pill.classList.add('active');
  document.querySelectorAll('#add-dd-time-menu .qa-menu-item').forEach(b => {
    b.classList.toggle('selected', b.textContent === tag);
  });
  document.getElementById('add-dd-time-menu').classList.remove('open');
}
function addSetPrio(tag) {
  addPrioTag = tag;
  const pill = document.getElementById('add-prio-pill');
  pill.textContent = tag + ' ▾';
  pill.classList.add('active');
  document.querySelectorAll('#add-dd-prio-menu .qa-menu-item').forEach(b => {
    b.classList.toggle('selected', b.textContent === tag);
  });
  document.getElementById('add-dd-prio-menu').classList.remove('open');
}

// ── TASK LIST ──
function openList() {
  currentSort = 'manual';
  document.querySelectorAll('.sort-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sort === 'manual')
  );
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
  if (currentSort === 'priority') {
    return [...active].sort((a, b) => {
      const pa = (a.tags || []).find(t => t in PRIO_ORDER);
      const pb = (b.tags || []).find(t => t in PRIO_ORDER);
      return (pa !== undefined ? PRIO_ORDER[pa] : 99) - (pb !== undefined ? PRIO_ORDER[pb] : 99);
    });
  }
  if (currentSort === 'time') {
    return [...active].sort((a, b) => {
      const ta = (a.tags || []).find(t => t in TIME_ORDER);
      const tb = (b.tags || []).find(t => t in TIME_ORDER);
      return (ta !== undefined ? TIME_ORDER[ta] : 99) - (tb !== undefined ? TIME_ORDER[tb] : 99);
    });
  }
  return active; // manual
}

function renderList() {
  const isDoneFilter = currentFilter === 'done';
  const isAllFilter  = currentFilter === 'all';

  document.getElementById('list-sort').style.display = isDoneFilter ? 'none' : 'flex';

  const doneTasks = tasks.filter(t => t.done);
  const clearBtn  = document.getElementById('clear-done-btn');
  clearBtn.style.display = (isDoneFilter || isAllFilter) && doneTasks.length > 0 ? 'block' : 'none';

  let items;
  if (isDoneFilter)     items = doneTasks;
  else if (isAllFilter) items = [...getSortedActiveTasks(), ...doneTasks];
  else                  items = getSortedActiveTasks();

  const el = document.getElementById('list-items');
  if (items.length === 0) {
    el.innerHTML = `<div class="list-empty">Nothing here yet.</div>`;
    return;
  }

  const timeOpts = ['5 min','15 min','30 min'];
  const prioOpts = ['Urgent','Easy','Fun'];
  const splitParentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId));

  el.innerHTML = items.map(task => {
    const realIdx  = tasks.indexOf(task);
    const hasDot   = task.parentId || splitParentIds.has(task.id);
    const dotColor = task.color || 'var(--accent)';
    const timeTag  = (task.tags || []).find(t => timeOpts.includes(t));
    const prioTag  = (task.tags || []).find(t => prioOpts.includes(t));
    const ddId     = `list-dd-${realIdx}`;
    const isCurrent = !task.done && currentTask() && task.id === currentTask().id;

    if (task.done) {
      return `
        <div class="list-item done">
          <div class="list-item-dot ${hasDot ? '' : 'invisible'}" style="background:${dotColor}"></div>
          <div class="list-item-body">
            <div class="list-item-text">${esc(task.text)}</div>
          </div>
          <div class="list-item-actions">
            <button class="list-action-btn del" onclick="listDelete(${realIdx},event)" title="Delete">✕</button>
          </div>
        </div>`;
    }

    return `
      <div class="list-item ${isCurrent ? 'is-current' : ''}"
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
            <!-- Time dropdown -->
            <div class="list-dd" onclick="event.stopPropagation()">
              <button class="list-tag-btn ${timeTag ? 'active-tag' : ''}"
                onclick="toggleListDd('${ddId}-time',event)">
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
            <!-- Priority dropdown -->
            <div class="list-dd" onclick="event.stopPropagation()">
              <button class="list-tag-btn ${prioTag ? 'active-tag' : ''}"
                onclick="toggleListDd('${ddId}-prio',event)">
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
        <div class="list-item-actions" onclick="event.stopPropagation()">
          <button class="list-action-btn crush" onclick="listCrush(${realIdx},event)" title="Crush">✓</button>
          <button class="list-action-btn del"   onclick="listDelete(${realIdx},event)" title="Delete">✕</button>
        </div>
      </div>`;
  }).join('');
}

function listSelectTask(realIdx) {
  const task = tasks[realIdx];
  if (!task || task.done) return;
  const newIdx = activeTasks().indexOf(task);
  if (newIdx === -1) return;
  currentIndex = newIdx;
  save(); closeList(); render();
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

// ── DRAG & DROP (desktop) ──
function onDragStart(event, idx) {
  dragSrcIdx = idx;
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('dragging');
}
function onDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drag-over'));
  event.currentTarget.closest('.list-item')?.classList.add('drag-over');
}
function onDrop(event, targetIdx) {
  event.preventDefault();
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drag-over'));
  if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
  const src = tasks[dragSrcIdx];
  const tgt = tasks[targetIdx];
  if (!src || !tgt || src.done || tgt.done) return;
  tasks.splice(dragSrcIdx, 1);
  const newTgtIdx = tasks.indexOf(tgt);
  tasks.splice(newTgtIdx, 0, src);
  const curTask = activeTasks()[currentIndex] || activeTasks()[0];
  currentIndex = curTask ? activeTasks().indexOf(curTask) : 0;
  if (currentIndex < 0) currentIndex = 0;
  dragSrcIdx = null;
  save(); renderList(); render();
}
function onDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drag-over'));
  dragSrcIdx = null;
}

// ── TOUCH DRAG & DROP (mobile) ──
(function() {
  let touchDragIdx  = null;
  let ghostEl       = null;
  let lastOverEl    = null;

  function getListItemFromPoint(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      const item = el.closest?.('.list-item');
      if (item && !item.classList.contains('dragging')) return item;
    }
    return null;
  }

  document.addEventListener('touchstart', e => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    e.preventDefault();
    const row = handle.closest('.list-item');
    if (!row) return;
    touchDragIdx = parseInt(row.dataset.idx, 10);
    row.classList.add('dragging');

    // Create ghost
    ghostEl = row.cloneNode(true);
    ghostEl.style.cssText = `
      position:fixed; left:${row.getBoundingClientRect().left}px;
      top:${row.getBoundingClientRect().top}px;
      width:${row.offsetWidth}px; opacity:0.85; pointer-events:none;
      z-index:9999; background:var(--surface);
      border-radius:var(--radius-sm); box-shadow:0 8px 32px rgba(0,0,0,0.18);
      transform:scale(1.02);
    `;
    document.body.appendChild(ghostEl);
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    if (touchDragIdx === null || !ghostEl) return;
    e.preventDefault();
    const touch = e.touches[0];
    ghostEl.style.top  = (touch.clientY - 24) + 'px';
    ghostEl.style.left = (touch.clientX - ghostEl.offsetWidth / 2) + 'px';

    // Highlight drop target
    const over = getListItemFromPoint(touch.clientX, touch.clientY);
    if (lastOverEl && lastOverEl !== over) lastOverEl.classList.remove('drag-over');
    if (over) { over.classList.add('drag-over'); lastOverEl = over; }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    if (touchDragIdx === null) return;
    const touch = e.changedTouches[0];

    // Clean up ghost
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    if (lastOverEl) { lastOverEl.classList.remove('drag-over'); lastOverEl = null; }
    document.querySelectorAll('.list-item.dragging').forEach(el => el.classList.remove('dragging'));

    // Find drop target
    const over = getListItemFromPoint(touch.clientX, touch.clientY);
    const targetIdx = over ? parseInt(over.dataset.idx, 10) : null;

    if (targetIdx !== null && touchDragIdx !== targetIdx) {
      const src = tasks[touchDragIdx];
      const tgt = tasks[targetIdx];
      if (src && tgt && !src.done && !tgt.done) {
        tasks.splice(touchDragIdx, 1);
        const newTgtIdx = tasks.indexOf(tgt);
        tasks.splice(newTgtIdx, 0, src);
        const curTask = activeTasks()[currentIndex] || activeTasks()[0];
        currentIndex = curTask ? activeTasks().indexOf(curTask) : 0;
        if (currentIndex < 0) currentIndex = 0;
        save(); renderList(); render();
      }
    }
    touchDragIdx = null;
  }, { passive: true });
})();

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
  text.textContent       = rand(CRUSH_WORDS);
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
  card.addEventListener('touchend',   () => setTimeout(() => card.classList.remove('touch-active'), 900));
  card.addEventListener('touchcancel',() => card.classList.remove('touch-active'));
})();

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeAddScreen(); closeList(); closeSplitModal(); closeAllDropdowns();
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    const addScreen = document.getElementById('add-screen');
    if (!addScreen.classList.contains('hidden') &&
        document.activeElement !== document.getElementById('add-input')) {
      submitTask();
    }
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    if (document.getElementById('add-screen').classList.contains('hidden') &&
        document.getElementById('list-overlay').classList.contains('hidden')) navTask(1);
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    if (document.getElementById('add-screen').classList.contains('hidden') &&
        document.getElementById('list-overlay').classList.contains('hidden')) navTask(-1);
  }
});

// close overlays on backdrop click
document.getElementById('list-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.add('hidden');
});
document.getElementById('split-modal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.add('hidden');
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
  link.rel  = 'manifest';
  link.href = URL.createObjectURL(new Blob([JSON.stringify(m)],{type:'application/json'}));
  document.head.appendChild(link);
})();

// ── INIT ──
load();
render();
