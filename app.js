// ─────────────────────────────────────────────
//  TASK CRUSHER — app.js  v8c
// ─────────────────────────────────────────────

// ── STATE ──
let tasks         = [];
let currentIndex  = 0;
let currentFilter = 'active';
let currentSort   = 'manual';
let openListDd    = null;
let dragSrcIdx    = null;

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
      // Assign a color to any task that doesn't have one
      if (!t.color) t.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    });
  } catch(e) { tasks = []; currentIndex = 0; }
  if (currentIndex >= activeTasks().length) currentIndex = 0;
}

// ── HELPERS ──
function activeTasks() { return tasks.filter(t => !t.done); }
function currentTask() { const a = activeTasks(); return a[currentIndex] || null; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uniqueColor() {
  const used = new Set(tasks.filter(t => t.color).map(t => t.color));
  const avail = COLORS.filter(c => !used.has(c));
  return avail.length > 0 ? avail[0] : rand(COLORS);
}

// ── RENDER ──

// Build one full-screen slide-page element for a task
function makeSlidePage(task) {
  const page = document.createElement('div');
  page.className = 'slide-page';
  page.style.background = task.color || '#5c47f5';

  const content = document.createElement('div');
  content.className = 'slide-content';

  // Task text
  const cardDiv = document.createElement('div');
  cardDiv.className = 'task-card';
  const textDiv = document.createElement('div');
  textDiv.className = 'task-text';
  textDiv.textContent = task.text;
  cardDiv.appendChild(textDiv);
  content.appendChild(cardDiv);

  // Quick actions
  const qa = document.createElement('div');
  qa.className = 'qa-actions';
  content.appendChild(qa);

  // Subtasks
  const st = document.createElement('div');
  st.className = 'subtask-list-inner';
  content.appendChild(st);

  page.appendChild(content);

  // Populate actions/subtasks
  renderQuickActionsInto(task, qa);
  renderSubtasksInto(task, st);

  // Click anywhere on the page = crush (but not on action pills)
  page.addEventListener('click', (e) => {
    if (e.target.closest('.qa-actions') || e.target.closest('.subtask-list-inner')) return;
    crushTask();
  });

  return page;
}

function render() {
  const active = activeTasks();
  const done   = tasks.filter(t => t.done);
  const task   = currentTask();

  // Nav counter
  const navCount = document.getElementById('task-nav-count');
  if (active.length > 0) {
    navCount.textContent = (currentIndex + 1) + ' / ' + active.length;
  } else if (done.length > 0) {
    navCount.textContent = '✅ ' + done.length + ' done';
  } else {
    navCount.textContent = '';
  }

  const slot      = document.getElementById('slide-slot');
  const emptyCard = document.getElementById('empty-card');
  const emptyDone = document.getElementById('empty-done-msg');
  const appEl     = document.getElementById('app');

  if (task) {
    emptyCard.style.display = 'none';
    emptyDone.style.display = 'none';
    appEl.style.background  = task.color || '#5c47f5';

    // Replace slot content with a fresh page (no animation)
    slot.style.transform  = '';
    slot.style.transition = '';
    slot.innerHTML = '';
    slot.appendChild(makeSlidePage(task));
  } else {
    slot.innerHTML = '';
    appEl.style.background = done.length > 0 ? '#16a34a' : '#5c47f5';
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


// ══════════════════════════════════════════
//  ELEVATOR NAV — true two-panel slide
//  The #slide-slot holds the OUTGOING page.
//  We create the INCOMING page, position it
//  off-screen below/above, then transition
//  both by moving the slot up/down.
// ══════════════════════════════════════════
let isAnimating = false;

function navTask(dir) {
  if (isAnimating) return;
  const active = activeTasks();
  if (active.length < 2) return;
  const newIdx = (currentIndex + dir + active.length) % active.length;
  animateToTask(newIdx, dir);
}

function animateToTask(newIdx, dir) {
  if (isAnimating) return;
  isAnimating = true;

  const slot    = document.getElementById('slide-slot');
  const oldPage = slot.querySelector('.slide-page');
  const newTask = activeTasks()[newIdx];
  if (!newTask) { isAnimating = false; return; }

  // Build new page and place it immediately below (dir>0) or above (dir<0)
  const newPage = makeSlidePage(newTask);
  const offset  = dir > 0 ? '100%' : '-100%';
  newPage.style.transform = `translateY(${offset})`;
  slot.appendChild(newPage);

  // Update state
  currentIndex = newIdx;
  save();

  // Update nav counter
  const active2 = activeTasks();
  document.getElementById('task-nav-count').textContent =
    (currentIndex + 1) + ' / ' + active2.length;

  // Update app bg to new task color immediately
  document.getElementById('app').style.background = newTask.color || '#5c47f5';

  // Force reflow so initial position is painted before transition starts
  void slot.offsetHeight;

  // Animate: move slot so old goes off, new comes in
  // Both pages share the same slot translateY
  const slotShift = dir > 0 ? '-100%' : '100%';
  slot.style.transition = 'transform 0.42s cubic-bezier(0.4, 0, 0.2, 1)';
  slot.style.transform  = `translateY(${slotShift})`;

  setTimeout(() => {
    // Snap: remove old page, reset slot position, reposition new page
    if (oldPage) oldPage.remove();
    slot.style.transition = 'none';
    slot.style.transform  = '';
    newPage.style.transform = '';
    isAnimating = false;
  }, 430);
}

// ── TOUCH SWIPE — drag slot directly ──
(function() {
  let startY = 0, startX = 0, startTime = 0;
  let dragging = false, deltaY = 0;

  function blocked(t) {
    return t.closest('.qa-actions') || t.closest('.subtask-list-inner')
        || t.closest('#fab')
        || (!document.getElementById('list-overlay').classList.contains('hidden'))
        || (!document.getElementById('add-screen').classList.contains('hidden'))
        || (!document.getElementById('split-modal').classList.contains('hidden'))
        || (!document.getElementById('delete-modal').classList.contains('hidden'));
  }

  document.addEventListener('touchstart', e => {
    if (blocked(e.target)) return;
    startY    = e.touches[0].clientY;
    startX    = e.touches[0].clientX;
    startTime = Date.now();
    dragging  = false;
    deltaY    = 0;
    const slot = document.getElementById('slide-slot');
    slot.style.transition = 'none';
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (blocked(e.target) && !dragging) return;
    const dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (!dragging && Math.abs(dy) > 8 && Math.abs(dy) > dx * 1.2) dragging = true;
    if (!dragging) return;
    if (activeTasks().length < 2 || isAnimating) return;

    deltaY = dy;
    const slot = document.getElementById('slide-slot');
    slot.style.transform = `translateY(${dy}px)`;
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;

    const dy      = deltaY;
    const elapsed = Date.now() - startTime;
    const isFlick = elapsed < 300 && Math.abs(dy) > 40;
    const isSlide = Math.abs(dy) > 90;
    const slot    = document.getElementById('slide-slot');

    if ((isFlick || isSlide) && activeTasks().length > 1 && !isAnimating) {
      // Reset slot first, then animate
      slot.style.transition = 'none';
      slot.style.transform  = '';
      navTask(dy < 0 ? 1 : -1);
    } else {
      // Snap back
      slot.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.2,1)';
      slot.style.transform  = '';
    }
    deltaY = 0;
  }, { passive: true });

  document.addEventListener('touchcancel', () => {
    dragging = false; deltaY = 0;
    const slot = document.getElementById('slide-slot');
    slot.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.2,1)';
    slot.style.transform  = '';
  }, { passive: true });
})();

// ── MOUSE WHEEL — desktop scroll anywhere ──
(function() {
  let wheelCooldown = false;
  document.addEventListener('wheel', e => {
    if (!document.getElementById('list-overlay').classList.contains('hidden')) return;
    if (!document.getElementById('add-screen').classList.contains('hidden')) return;
    if (!document.getElementById('split-modal').classList.contains('hidden')) return;
    if (!document.getElementById('delete-modal').classList.contains('hidden')) return;
    if (e.target.closest('.subtask-list-inner')) return;
    if (wheelCooldown || isAnimating) return;
    if (activeTasks().length < 2) return;
    navTask(e.deltaY > 0 ? 1 : -1);
    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 460);
  }, { passive: true });
})();


// ── QUICK ACTIONS ──
function renderQuickActions(task) {
  const page = document.querySelector('#slide-slot .slide-page');
  if (!page) return;
  const el = page.querySelector('.qa-actions');
  if (el) renderQuickActionsInto(task, el);
}
function renderQuickActionsInto(task, el) {
  if (!el) return;
  const timeOpts = ['5 min','15 min','30 min'];
  const prioOpts = ['Urgent','Easy','Fun'];
  const timeTag  = (task.tags || []).find(t => timeOpts.includes(t));
  const prioTag  = (task.tags || []).find(t => prioOpts.includes(t));

  el.innerHTML = `
    <div class="qa-dropdown" id="dd-time">
      <button class="qa-pill ${timeTag ? 'active' : ''}" onclick="toggleDropdown('dd-time')" title="${timeTag || 'Set time'}">
        🕐${timeTag ? '<span class="pill-label">' + timeTag + '</span>' : ''}
      </button>
      <div class="qa-dropdown-menu" id="dd-time-menu">
        <button class="qa-menu-item ${timeTag==='5 min'?'selected':''}"  onclick="setTime('5 min')">5 min</button>
        <button class="qa-menu-item ${timeTag==='15 min'?'selected':''}" onclick="setTime('15 min')">15 min</button>
        <button class="qa-menu-item ${timeTag==='30 min'?'selected':''}" onclick="setTime('30 min')">30 min</button>
        ${timeTag ? '<div class="qa-menu-sep"></div><button class="qa-menu-item" onclick="clearTime()">Clear</button>' : ''}
      </div>
    </div>
    <div class="qa-dropdown" id="dd-prio">
      <button class="qa-pill ${prioTag ? 'active' : ''}" onclick="toggleDropdown('dd-prio')" title="${prioTag || 'Set priority'}">
        🔥${prioTag ? '<span class="pill-label">' + prioTag + '</span>' : ''}
      </button>
      <div class="qa-dropdown-menu" id="dd-prio-menu">
        <button class="qa-menu-item ${prioTag==='Urgent'?'selected':''}" onclick="setPrio('Urgent')">Urgent</button>
        <button class="qa-menu-item ${prioTag==='Easy'?'selected':''}"   onclick="setPrio('Easy')">Easy</button>
        <button class="qa-menu-item ${prioTag==='Fun'?'selected':''}"    onclick="setPrio('Fun')">Fun</button>
        ${prioTag ? '<div class="qa-menu-sep"></div><button class="qa-menu-item" onclick="clearPrio()">Clear</button>' : ''}
      </div>
    </div>
    <button class="qa-pill" onclick="openSplitModal()" title="Split task">✂️</button>
    <button class="qa-pill danger" onclick="openDeleteModal()" title="Delete task">🗑️</button>
  `;
}

function renderSubtasks(task) {
  const page = document.querySelector('#slide-slot .slide-page');
  if (!page) return;
  const el = page.querySelector('.subtask-list-inner');
  if (el) renderSubtasksInto(task, el);
}
function renderSubtasksInto(task, el) {
  if (!el) return;
  if (!task.subtasks || task.subtasks.length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = task.subtasks.map((st, i) => `
    <div class="subtask-card ${st.done ? 'done' : ''}" onclick="crushSubtask(${i})">
      <div class="subtask-dot" style="background:${task.color || '#5c47f5'}"></div>
      <span class="subtask-text-label">${esc(st.text)}</span>
      <div class="subtask-crush-hint">✊ Crush it!</div>
      <button class="subtask-del" onclick="event.stopPropagation();deleteSubtask(${i})" title="Delete step">✕</button>
    </div>
  `).join('');
}

// ── CRUSH ──
// Click is handled per-slide-page in makeSlidePage
// handleStageClick kept for onclick= in HTML (empty-state area)
function handleStageClick(e) {
  // Only handle if clicking outside slide-slot (e.g., empty state)
  if (e.target.closest('#slide-slot')) return;
  if (e.target.closest('#empty-card') || e.target.closest('#empty-done-msg')) return;
}

// ── CRUSH ──
function handleCardClick() { crushTask(); }

function crushTask() {
  const task = currentTask(); if (!task) return;
  // Disable clicks on current slide page during animation
  const activePage = document.querySelector('#slide-slot .slide-page');
  if (activePage) activePage.style.pointerEvents = 'none';

  task.done = true;
  const remaining = activeTasks();
  currentIndex = remaining.length > 0 ? currentIndex % remaining.length : 0;
  save();
  playConfetti();
  showCrushFlash();
  setTimeout(() => { render(); }, 1400);
}

function openAllDoneModal() {
  // Reuse delete modal for the "all steps done" confirmation
  _deleteTarget = '_crush_main_';
  document.getElementById('delete-body').textContent = 'All steps are done. Crush the main task too?';
  document.getElementById('delete-title').textContent = 'All done! 🎉';
  document.getElementById('delete-icon').textContent = '✊';
  document.getElementById('delete-confirm-btn').textContent = 'Crush it!';
  document.getElementById('delete-modal').classList.remove('hidden');
}

function crushSubtask(idx) {
  const task = currentTask(); if (!task || !task.subtasks[idx]) return;
  task.subtasks[idx].done = true;
  save(); playConfetti(true); renderSubtasks(task);
  if (task.subtasks.every(s => s.done)) {
    setTimeout(() => { openAllDoneModal(); }, 500);
  }
}

// ── DELETE ──
let _deleteTarget = null; // 'task' | { type:'list', idx }

function openDeleteModal(target) {
  _deleteTarget = target || 'task';
  const task = (typeof target === 'object' && target.type === 'list')
    ? tasks[target.idx]
    : currentTask();
  if (!task) return;
  closeAllDropdowns();
  document.getElementById('delete-body').textContent = task.text;
  document.getElementById('delete-modal').classList.remove('hidden');
}
function closeDeleteModal() {
  document.getElementById('delete-modal').classList.add('hidden');
  _deleteTarget = null;
}
function confirmDeleteModal() {
  const target = _deleteTarget;
  closeDeleteModal();
  if (!target) return;
  if (target === '_crush_main_') {
    // Reset modal button text
    document.getElementById('delete-title').textContent = 'Delete task?';
    document.getElementById('delete-icon').textContent = '\u{1F5D1}\uFE0F';
    document.getElementById('delete-confirm-btn').textContent = 'Delete';
    crushTask();
    return;
  }
  if (typeof target === 'object' && target.type === 'list') {
    // Direct delete bypassing modal re-trigger
    tasks.splice(target.idx, 1);
    const remaining = activeTasks();
    currentIndex = remaining.length > 0 ? currentIndex % remaining.length : 0;
    save(); closeAllListDropdowns(); renderList(); render();
  } else {
    const task = currentTask(); if (!task) return;
    tasks = tasks.filter(t => t !== task);
    const remaining = activeTasks();
    currentIndex = remaining.length > 0 ? currentIndex % remaining.length : 0;
    save(); render();
  }
}
function deleteCurrentTask() { openDeleteModal('task'); }
function deleteSubtask(idx) {
  const task = currentTask(); if (!task) return;
  task.subtasks.splice(idx, 1); save(); renderSubtasks(task);
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
function closeSplitModal() { document.getElementById('split-modal').classList.add('hidden'); }
function addSplitInput(autoFocus = false) {
  const wrap = document.getElementById('split-inputs-wrap');
  const inp  = document.createElement('input');
  inp.type = 'text'; inp.className = 'split-input';
  inp.placeholder = 'A smaller step…'; inp.maxLength = 140;
  // Auto-add next step when typing in the last input
  inp.addEventListener('input', () => {
    const inputs = wrap.querySelectorAll('.split-input');
    if (inp === inputs[inputs.length - 1] && inp.value.trim().length > 0) {
      // Only add if there isn't already an empty last input
      addSplitInput(false);
    }
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const inputs = wrap.querySelectorAll('.split-input');
      const idx = Array.from(inputs).indexOf(inp);
      const next = inputs[idx + 1];
      if (next) { next.focus(); }
      else { addSplitInput(true); }
    }
    // Delete empty input on backspace if it's not the first two
    if (e.key === 'Backspace' && inp.value === '') {
      const inputs = wrap.querySelectorAll('.split-input');
      if (inputs.length > 2 && inp === inputs[inputs.length - 1]) {
        e.preventDefault();
        inp.remove();
        const prev = wrap.querySelectorAll('.split-input');
        prev[prev.length - 1]?.focus();
      }
    }
  });
  wrap.appendChild(inp);
  if (autoFocus) setTimeout(() => inp.focus(), 30);
}
function confirmSplit() {
  const steps = Array.from(document.querySelectorAll('.split-input'))
    .map(i => i.value.trim()).filter(Boolean);
  if (steps.length === 0) return;
  const task = currentTask(); if (!task) return;
  const color = uniqueColor();
  task.color = color; task.parentId = task.parentId || null;
  const newTasks = steps.map(text => ({
    id: Date.now() + Math.random(), text, tags: [], done: false,
    subtasks: [], color, parentId: task.id, created: Date.now(),
  }));
  const taskIdx = tasks.indexOf(task);
  tasks.splice(taskIdx + 1, 0, ...newTasks);
  const fi = activeTasks().indexOf(newTasks[0]);
  if (fi !== -1) currentIndex = fi;
  save(); closeSplitModal(); render();
}

// ── ADD TASK SCREEN ──
function openAddScreen() {
  addTimeTag = null; addPrioTag = null;
  document.getElementById('add-input').value = '';
  document.getElementById('add-time-pill').innerHTML = '🕐';
  document.getElementById('add-prio-pill').innerHTML = '🔥';
  document.getElementById('add-time-pill').classList.remove('active');
  document.getElementById('add-prio-pill').classList.remove('active');
  document.querySelectorAll('#add-dd-time-menu .qa-menu-item, #add-dd-prio-menu .qa-menu-item')
    .forEach(b => b.classList.remove('selected'));
  document.getElementById('add-screen').classList.remove('hidden');
  setTimeout(() => document.getElementById('add-input').focus(), 100);
}
function closeAddScreen() {
  document.getElementById('add-screen').classList.add('hidden');
  closeAllDropdowns();
}

// Close add screen when clicking outside the input area
function handleAddStageClick(e) {
  const inner = document.getElementById('add-input-wrap');
  const tags  = document.getElementById('add-tag-actions');
  if (!inner.contains(e.target) && !tags.contains(e.target)) {
    closeAddScreen();
  }
}

function submitTask() {
  const text = document.getElementById('add-input').value.trim();
  if (!text) { document.getElementById('add-input').focus(); return; }
  const tags = [];
  if (addTimeTag) tags.push(addTimeTag);
  if (addPrioTag) tags.push(addPrioTag);
  const newColor = COLORS.filter(c => !tasks.map(t=>t.color).includes(c))[0] || COLORS[Math.floor(Math.random()*COLORS.length)];
  tasks.push({ id: Date.now(), text, tags, done: false, subtasks: [], color: newColor, created: Date.now() });
  if (activeTasks().length === 1) currentIndex = 0;
  save(); closeAddScreen(); render();
}
function toggleAddDropdown(id) {
  const menuId = id + '-menu';
  const isOpen = document.getElementById(menuId)?.classList.contains('open');
  ['add-dd-time-menu','add-dd-prio-menu'].forEach(m => document.getElementById(m)?.classList.remove('open'));
  if (!isOpen) document.getElementById(menuId)?.classList.add('open');
  setTimeout(() => document.addEventListener('click', closeAddDropdownsOutside, { once: true }), 0);
}
function closeAddDropdownsOutside(e) {
  if (!e.target.closest('#add-tag-actions'))
    ['add-dd-time-menu','add-dd-prio-menu'].forEach(m => document.getElementById(m)?.classList.remove('open'));
}
function addSetTime(tag) {
  addTimeTag = tag;
  const pill = document.getElementById('add-time-pill');
  pill.innerHTML = `🕐<span class="pill-label">${tag}</span>`;
  pill.classList.add('active');
  document.querySelectorAll('#add-dd-time-menu .qa-menu-item').forEach(b =>
    b.classList.toggle('selected', b.textContent === tag));
  document.getElementById('add-dd-time-menu').classList.remove('open');
}
function addSetPrio(tag) {
  addPrioTag = tag;
  const pill = document.getElementById('add-prio-pill');
  pill.innerHTML = `🔥<span class="pill-label">${tag}</span>`;
  pill.classList.add('active');
  document.querySelectorAll('#add-dd-prio-menu .qa-menu-item').forEach(b =>
    b.classList.toggle('selected', b.textContent === tag));
  document.getElementById('add-dd-prio-menu').classList.remove('open');
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
  btn.classList.add('active'); renderList();
}
function setSort(btn, sort) {
  currentSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); renderList();
}
function getSortedActiveTasks() {
  const active = tasks.filter(t => !t.done);
  if (currentSort === 'priority') {
    return [...active].sort((a, b) => {
      const pa = (a.tags||[]).find(t => t in PRIO_ORDER);
      const pb = (b.tags||[]).find(t => t in PRIO_ORDER);
      return (pa !== undefined ? PRIO_ORDER[pa] : 99) - (pb !== undefined ? PRIO_ORDER[pb] : 99);
    });
  }
  if (currentSort === 'time') {
    return [...active].sort((a, b) => {
      const ta = (a.tags||[]).find(t => t in TIME_ORDER);
      const tb = (b.tags||[]).find(t => t in TIME_ORDER);
      return (ta !== undefined ? TIME_ORDER[ta] : 99) - (tb !== undefined ? TIME_ORDER[tb] : 99);
    });
  }
  return active;
}

function renderList() {
  const isDone = currentFilter === 'done';
  const isAll  = currentFilter === 'all';
  document.getElementById('list-sort').style.display = isDone ? 'none' : 'flex';
  const doneTasks = tasks.filter(t => t.done);
  const clearBtn  = document.getElementById('clear-done-btn');
  clearBtn.style.display = (isDone || isAll) && doneTasks.length > 0 ? 'block' : 'none';

  let items = isDone ? doneTasks : isAll ? [...getSortedActiveTasks(), ...doneTasks] : getSortedActiveTasks();
  const el  = document.getElementById('list-items');
  if (items.length === 0) { el.innerHTML = `<div class="list-empty">Nothing here yet.</div>`; return; }

  const timeOpts = ['5 min','15 min','30 min'];
  const prioOpts = ['Urgent','Easy','Fun'];
  const splitParentIds = new Set(tasks.filter(t => t.parentId).map(t => t.parentId));

  el.innerHTML = items.map(task => {
    const realIdx   = tasks.indexOf(task);
    const hasDot    = task.parentId || splitParentIds.has(task.id);
    const dotColor  = task.color || 'var(--accent)';
    const timeTag   = (task.tags||[]).find(t => timeOpts.includes(t));
    const prioTag   = (task.tags||[]).find(t => prioOpts.includes(t));
    const ddId      = `list-dd-${realIdx}`;
    const isCurrent = !task.done && currentTask() && task.id === currentTask().id;

    // Done tasks — restore (o) + delete (x)
    if (task.done) return `
      <div class="list-item done" data-idx="${realIdx}">
        <div class="list-item-inner">
          <div class="list-item-dot ${hasDot?'':'invisible'}" style="background:${dotColor}"></div>
          <div class="list-item-body"><div class="list-item-text">${esc(task.text)}</div></div>
          <div class="list-item-actions">
            <button class="list-action-btn restore" onclick="restoreTask(${realIdx},event)" title="Restore">o</button>
            <button class="list-action-btn del" onclick="openDeleteModal({type:'list',idx:${realIdx}})" title="Delete">✕</button>
          </div>
        </div>
      </div>`;

    // Active tasks — click row to navigate, with colored text
    return `
      <div class="list-item ${isCurrent?'is-current':''}"
           draggable="${currentSort==='manual'?'true':'false'}"
           data-idx="${realIdx}"
           onclick="listNavigateToTask(${realIdx})"
           ondragstart="onDragStart(event,${realIdx})"
           ondragover="onDragOver(event,${realIdx})"
           ondrop="onDrop(event,${realIdx})"
           ondragend="onDragEnd(event)">
        <div class="list-item-inner">
          <div class="drag-handle ${currentSort==='manual'?'':'hidden'}" onclick="event.stopPropagation()">⠿</div>
          <div class="list-item-dot ${hasDot?'':'invisible'}" style="background:${dotColor}"></div>
          <div class="list-item-body">
            <div class="list-item-text" style="color:${dotColor}">${esc(task.text)}</div>
            <div class="list-item-row2">
              <div class="list-dd" onclick="event.stopPropagation()">
                <button class="list-tag-btn ${timeTag?'active-tag':''}"
                  onclick="toggleListDd('${ddId}-time',event)" title="${timeTag||'Set time'}">
                  🕐${timeTag?`<span style="font-size:10px;margin-left:2px;">${timeTag}</span>`:''}
                </button>
                <div class="list-dd-menu" id="${ddId}-time">
                  ${timeOpts.map(o=>`<button class="qa-menu-item ${timeTag===o?'selected':''}"
                    onclick="listSetTag(${realIdx},'time','${o}',event)">${o}</button>`).join('')}
                  ${timeTag?`<div class="qa-menu-sep"></div>
                    <button class="qa-menu-item" onclick="listClearTag(${realIdx},'time',event)">Clear</button>`:''}
                </div>
              </div>
              <div class="list-dd" onclick="event.stopPropagation()">
                <button class="list-tag-btn ${prioTag?'active-tag':''}"
                  onclick="toggleListDd('${ddId}-prio',event)" title="${prioTag||'Set priority'}">
                  🔥${prioTag?`<span style="font-size:10px;margin-left:2px;">${prioTag}</span>`:''}
                </button>
                <div class="list-dd-menu" id="${ddId}-prio">
                  ${prioOpts.map(o=>`<button class="qa-menu-item ${prioTag===o?'selected':''}"
                    onclick="listSetTag(${realIdx},'prio','${o}',event)">${o}</button>`).join('')}
                  ${prioTag?`<div class="qa-menu-sep"></div>
                    <button class="qa-menu-item" onclick="listClearTag(${realIdx},'prio',event)">Clear</button>`:''}
                </div>
              </div>
            </div>
          </div>
          <div class="list-item-actions" onclick="event.stopPropagation()">
            <button class="list-action-btn crush" onclick="listCrush(${realIdx},event)" title="Crush">✓</button>
            <button class="list-action-btn del"   onclick="openDeleteModal({type:'list',idx:${realIdx}})" title="Delete">✕</button>
          </div>
        </div>
      </div>`;
  }).join('');

}

// ── RESTORE TASK ──
function restoreTask(idx, event) {
  event && event.stopPropagation();
  const task = tasks[idx]; if (!task) return;
  task.done = false;
  // Put it back at end of active queue
  const active = activeTasks();
  currentIndex = active.indexOf(task);
  if (currentIndex < 0) currentIndex = Math.max(0, active.length - 1);
  save(); renderList(); render();
}

// ── LIST ACTIONS ──
function listCrush(idx, event) {
  event && event.stopPropagation();
  tasks[idx].done = true;
  const remaining = activeTasks();
  currentIndex = remaining.length > 0 ? currentIndex % remaining.length : 0;
  save(); closeAllListDropdowns();
  playConfetti(true); showCrushFlash();
  setTimeout(() => { renderList(); render(); }, 700);
}
function listDelete(idx, event) {
  event && event.stopPropagation();
  // If called directly (from confirmDeleteModal or done row ✕), do the delete
  if (event === null || (event && event._confirmed)) {
    tasks.splice(idx, 1);
    const remaining = activeTasks();
    currentIndex = remaining.length > 0 ? currentIndex % remaining.length : 0;
    save(); closeAllListDropdowns(); renderList(); render();
  } else {
    // Show confirm modal
    event && event.stopPropagation();
    openDeleteModal({ type: 'list', idx });
  }
}
function clearAllDone() {
  // Confirmed via inline check (small destructive action in admin view)
  if (!window.confirm('Clear all completed tasks?')) return;
  tasks = tasks.filter(t => !t.done);
  currentIndex = 0; save(); renderList(); render();
}

const TIME_OPTS = ['5 min','15 min','30 min'];
const PRIO_OPTS = ['Urgent','Easy','Fun'];

function listSetTag(idx, type, value, event) {
  event && event.stopPropagation();
  const task = tasks[idx]; if (!task) return;
  const opts = type === 'time' ? TIME_OPTS : PRIO_OPTS;
  task.tags = (task.tags||[]).filter(t => !opts.includes(t));
  task.tags.push(value); save(); closeAllListDropdowns(); renderList(); render();
}
function listClearTag(idx, type, event) {
  event && event.stopPropagation();
  const task = tasks[idx]; if (!task) return;
  const opts = type === 'time' ? TIME_OPTS : PRIO_OPTS;
  task.tags = (task.tags||[]).filter(t => !opts.includes(t));
  save(); closeAllListDropdowns(); renderList(); render();
}

// ── DRAG & DROP desktop ──
let dragOverPos = null;

function onDragStart(event, idx) {
  dragSrcIdx = idx;
  event.dataTransfer.effectAllowed = 'move';
  event.currentTarget.classList.add('dragging');
}
function onDragOver(event, targetIdx) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drop-above','drop-below'));
  const item = event.currentTarget.closest('.list-item'); if (!item) return;
  const rect = item.getBoundingClientRect();
  const pos  = event.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
  dragOverPos = pos;
  item.classList.add(pos === 'above' ? 'drop-above' : 'drop-below');
}
function onDrop(event, targetIdx) {
  event.preventDefault();
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drop-above','drop-below'));
  if (dragSrcIdx === null || dragSrcIdx === targetIdx) { dragSrcIdx = null; return; }
  const src = tasks[dragSrcIdx], tgt = tasks[targetIdx];
  if (!src || !tgt || src.done || tgt.done) { dragSrcIdx = null; return; }
  tasks.splice(dragSrcIdx, 1);
  let ii = tasks.indexOf(tgt);
  if (dragOverPos === 'below') ii += 1;
  tasks.splice(ii, 0, src);
  const curTask = activeTasks()[currentIndex] || activeTasks()[0];
  currentIndex = curTask ? activeTasks().indexOf(curTask) : 0;
  if (currentIndex < 0) currentIndex = 0;
  dragSrcIdx = null; dragOverPos = null;
  save(); renderList(); render();
}
function onDragEnd(event) {
  event.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.list-item').forEach(el => el.classList.remove('drag-over','drop-above','drop-below'));
  dragSrcIdx = null;
}

// ── TOUCH DRAG & DROP list (mobile) ──
(function() {
  let touchDragIdx = null, ghostEl = null, lastLineEl = null, lastLinePos = null;

  function getItem(x, y) {
    if (ghostEl) ghostEl.style.display = 'none';
    const els = document.elementsFromPoint(x, y);
    if (ghostEl) ghostEl.style.display = '';
    for (const el of els) {
      const item = el.closest?.('.list-item');
      if (item && !item.classList.contains('dragging')) return item;
    }
    return null;
  }
  function clearLines() {
    document.querySelectorAll('.list-item.drop-above,.list-item.drop-below').forEach(el =>
      el.classList.remove('drop-above','drop-below'));
    lastLineEl = null; lastLinePos = null;
  }

  document.addEventListener('touchstart', e => {
    const handle = e.target.closest('.drag-handle'); if (!handle) return;
    e.preventDefault();
    const row = handle.closest('.list-item'); if (!row) return;
    touchDragIdx = parseInt(row.dataset.idx, 10);
    row.classList.add('dragging');
    ghostEl = row.cloneNode(true);
    const rect = row.getBoundingClientRect();
    ghostEl.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;
      width:${rect.width}px;opacity:0.88;pointer-events:none;z-index:9999;
      background:var(--surface);border-radius:var(--radius-sm);
      box-shadow:0 8px 32px rgba(0,0,0,0.22);transform:scale(1.03);transition:none;`;
    document.body.appendChild(ghostEl);
  }, { passive: false });

  document.addEventListener('touchmove', e => {
    if (touchDragIdx === null || !ghostEl) return;
    e.preventDefault();
    const t = e.touches[0];
    ghostEl.style.top  = (t.clientY - 28) + 'px';
    ghostEl.style.left = (t.clientX - ghostEl.offsetWidth / 2) + 'px';
    clearLines();
    const over = getItem(t.clientX, t.clientY);
    if (over) {
      const rect = over.getBoundingClientRect();
      const pos  = t.clientY < rect.top + rect.height / 2 ? 'above' : 'below';
      over.classList.add(pos === 'above' ? 'drop-above' : 'drop-below');
      lastLineEl = over; lastLinePos = pos;
    }
  }, { passive: false });

  document.addEventListener('touchend', e => {
    if (touchDragIdx === null) return;
    if (ghostEl) { ghostEl.remove(); ghostEl = null; }
    const over = lastLineEl, pos = lastLinePos;
    clearLines();
    document.querySelectorAll('.list-item.dragging').forEach(el => el.classList.remove('dragging'));
    const targetIdx = over ? parseInt(over.dataset.idx, 10) : null;
    if (targetIdx !== null && touchDragIdx !== targetIdx) {
      const src = tasks[touchDragIdx], tgt = tasks[targetIdx];
      if (src && tgt && !src.done && !tgt.done) {
        tasks.splice(touchDragIdx, 1);
        let ii = tasks.indexOf(tgt);
        if (pos === 'below') ii += 1;
        tasks.splice(ii, 0, src);
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
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const count  = mini ? 60 : 150;
  const colors = ['#5c47f5','#f59e0b','#e53935','#0ea5e9','#16a34a','#9333ea'];
  const pieces = Array.from({ length: count }, () => ({
    x: canvas.width/2 + (Math.random()-0.5)*(mini?120:canvas.width*0.7),
    y: mini ? canvas.height*0.45 : -10,
    w: Math.random()*11+4, h: Math.random()*6+3,
    color: colors[Math.floor(Math.random()*colors.length)],
    vx: (Math.random()-0.5)*(mini?7:14),
    vy: Math.random()*(mini?5:9)+(mini?1:2),
    rot: Math.random()*360, rotV: (Math.random()-0.5)*9, opacity: 1,
  }));
  (function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.2; p.rot+=p.rotV; p.opacity-=mini?0.016:0.009;
      if (p.opacity>0 && p.y<canvas.height+20) {
        alive=true; ctx.save(); ctx.globalAlpha=Math.max(0,p.opacity);
        ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        ctx.fillStyle=p.color; ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h); ctx.restore();
      }
    });
    if (alive) requestAnimationFrame(draw);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  })();
}

function showCrushFlash() {
  const flash = document.getElementById('crush-flash');
  const text  = document.getElementById('crush-flash-text');
  text.textContent = rand(CRUSH_WORDS);
  flash.style.transition = 'opacity 0.12s'; flash.style.opacity = '1';
  text.style.transform = 'scale(1)'; text.style.opacity = '1';
  // Longer — stays visible 900ms then fades over 500ms
  setTimeout(() => {
    flash.style.transition = 'opacity 0.5s'; flash.style.opacity = '0';
    text.style.opacity = '0'; text.style.transform = 'scale(0.7)';
  }, 900);
}

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeAddScreen(); closeList(); closeSplitModal(); closeDeleteModal(); closeAllDropdowns(); }
  if (e.key === 'Enter') {
    const addScreen = document.getElementById('add-screen');
    if (!addScreen.classList.contains('hidden')) submitTask();
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

document.getElementById('split-modal').addEventListener('click', function(e) {
  if (e.target === this) this.classList.add('hidden');
});
document.getElementById('delete-modal').addEventListener('click', function(e) {
  if (e.target === this) closeDeleteModal();
});
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
