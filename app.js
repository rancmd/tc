// ─────────────────────────────────────────────
//  TASK CRUSHER — app.js  v7
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
function render() {
  const active = activeTasks();
  const done   = tasks.filter(t => t.done);
  const task   = currentTask();

  // Top-right nav counter: "1 / 3" — no done count here
  const navCount = document.getElementById('task-nav-count');
  if (active.length > 0) {
    navCount.textContent = (currentIndex + 1) + ' / ' + active.length;
  } else if (done.length > 0) {
    navCount.textContent = '✅ ' + done.length + ' done';
  } else {
    navCount.textContent = '';
  }

  const taskPage  = document.getElementById('task-page');
  const emptyCard = document.getElementById('empty-card');
  const emptyDone = document.getElementById('empty-done-msg');

  if (task) {
    taskPage.style.display  = 'flex';
    emptyCard.style.display = 'none';
    emptyDone.style.display = 'none';

    document.getElementById('task-text').textContent = task.text;

    // Color dot — show if task belongs to a split group
    const dot = document.getElementById('task-color-dot');
    if (task.color) {
      dot.style.display    = 'block';
      dot.style.background = task.color;
    } else {
      dot.style.display = 'none';
    }

    renderQuickActions(task);
    renderSubtasks(task);

  } else {
    taskPage.style.display = 'none';

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
//  GALLERY NAV — whole page slides as one unit
// ══════════════════════════════════════════
let isAnimating = false;

function navTask(dir) {
  if (isAnimating) return;
  const active = activeTasks();
  if (active.length < 2) return;
  // Loop
  const newIdx = (currentIndex + dir + active.length) % active.length;
  animateToTask(newIdx, dir);
}

function animateToTask(newIdx, dir) {
  if (isAnimating) return;
  const page = document.getElementById('task-page');
  isAnimating = true;

  // 1. Fly current page off screen
  page.classList.remove('dragging');
  page.style.transition = '';
  page.style.transform  = '';
  page.style.opacity    = '';

  const exitClass = dir > 0 ? 'exit-up' : 'exit-down';
  page.classList.add(exitClass);

  setTimeout(() => {
    // 2. Swap content
    currentIndex = newIdx;
    save();

    const task = currentTask();
    if (task) {
      document.getElementById('task-text').textContent = task.text;
      // color dot
      const dot = document.getElementById('task-color-dot');
      if (task.color) { dot.style.display = 'block'; dot.style.background = task.color; }
      else            { dot.style.display = 'none'; }
    }

    // 3. Snap page to entry position (off-screen opposite), no transition
    page.classList.remove(exitClass);
    page.style.transition = 'none';
    page.style.opacity    = '0';
    page.style.transform  = dir > 0 ? 'translateY(110vh)' : 'translateY(-110vh)';

    void page.offsetWidth; // force reflow

    // 4. Animate in
    page.style.transition = '';
    page.style.transform  = '';
    page.style.opacity    = '';
    page.classList.add(dir > 0 ? 'enter-from-bottom' : 'enter-from-top');

    // Update nav counter + actions
    const navCount = document.getElementById('task-nav-count');
    const active2  = activeTasks();
    navCount.textContent = (currentIndex + 1) + ' / ' + active2.length;
    if (task) { renderQuickActions(task); renderSubtasks(task); }

    setTimeout(() => {
      page.classList.remove('enter-from-bottom', 'enter-from-top');
      isAnimating = false;
    }, 340);
  }, 300);
}

// ── TOUCH SWIPE — whole stage is the swipe zone ──
(function() {
  let startY = 0, startX = 0, startTime = 0;
  let dragging = false, deltaY = 0;
  const page  = () => document.getElementById('task-page');
  const stage = document.getElementById('stage');

  function blocked(t) {
    // Don't swipe when touching action pills, subtasks
    return t.closest('#quick-actions') || t.closest('#subtask-list') || t.closest('#fab');
  }

  stage.addEventListener('touchstart', e => {
    if (blocked(e.target)) return;
    startY    = e.touches[0].clientY;
    startX    = e.touches[0].clientX;
    startTime = Date.now();
    dragging  = false;
    deltaY    = 0;
  }, { passive: true });

  stage.addEventListener('touchmove', e => {
    if (blocked(e.target) && !dragging) return;
    const dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (!dragging && Math.abs(dy) > 8 && Math.abs(dy) > dx * 1.2) dragging = true;
    if (!dragging) return;

    deltaY = dy;
    const p = page();
    if (!p || activeTasks().length < 2 || isAnimating) return;

    // Whole page follows finger — dampened
    const pull  = Math.sign(dy) * Math.min(Math.abs(dy) * 0.55, 130);
    const scale = 1 - Math.abs(pull) * 0.0004;
    const alpha = 1 - Math.abs(pull) * 0.004;
    p.classList.add('dragging');
    p.style.transform = `translateY(${pull}px) scale(${scale})`;
    p.style.opacity   = String(Math.max(0.25, alpha));
  }, { passive: true });

  stage.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;

    const p      = page();
    const active = activeTasks();
    const dy     = deltaY;
    const elapsed = Date.now() - startTime;
    const isFlick = elapsed < 280 && Math.abs(dy) > 35;
    const isSlide = Math.abs(dy) > 90;

    if (p) {
      p.classList.remove('dragging');
      p.style.transform = '';
      p.style.opacity   = '';
    }

    if ((isFlick || isSlide) && active.length > 1 && !isAnimating) {
      navTask(dy < 0 ? 1 : -1);
    }
    deltaY = 0;
  }, { passive: true });

  stage.addEventListener('touchcancel', () => {
    dragging = false; deltaY = 0;
    const p = page();
    if (p) { p.classList.remove('dragging'); p.style.transform = ''; p.style.opacity = ''; }
  }, { passive: true });
})();

// ── MOUSE WHEEL — desktop gallery scroll ──
(function() {
  let wheelCooldown = false;

  document.getElementById('stage').addEventListener('wheel', e => {
    if (!document.getElementById('list-overlay').classList.contains('hidden')) return;
    if (!document.getElementById('add-screen').classList.contains('hidden')) return;
    if (!document.getElementById('split-modal').classList.contains('hidden')) return;
    if (e.target.closest('#subtask-list')) return;
    if (wheelCooldown || isAnimating) return;
    if (activeTasks().length < 2) return;

    navTask(e.deltaY > 0 ? 1 : -1);
    wheelCooldown = true;
    setTimeout(() => { wheelCooldown = false; }, 420);
  }, { passive: true });
})();

// ── QUICK ACTIONS ──
function renderQuickActions(task) {
  const el = document.getElementById('quick-actions');
  const timeOpts = ['5 min','15 min','30 min'];
  const prioOpts = ['Urgent','Easy','Fun'];
  const timeTag  = (task.tags || []).find(t => timeOpts.includes(t));
  const prioTag  = (task.tags || []).find(t => prioOpts.includes(t));

  el.innerHTML = `
    <div class="qa-dropdown" id="dd-time">
      <button class="qa-pill ${timeTag ? 'active' : ''}" onclick="toggleDropdown('dd-time')" title="${timeTag || 'Set time'}">
        🕐${timeTag ? `<span class="pill-label">${timeTag}</span>` : ''}
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
        🔥${prioTag ? `<span class="pill-label">${prioTag}</span>` : ''}
      </button>
      <div class="qa-dropdown-menu" id="dd-prio-menu">
        <button class="qa-menu-item ${prioTag==='Urgent'?'selected':''}" onclick="setPrio('Urgent')">Urgent</button>
        <button class="qa-menu-item ${prioTag==='Easy'?'selected':''}"   onclick="setPrio('Easy')">Easy</button>
        <button class="qa-menu-item ${prioTag==='Fun'?'selected':''}"    onclick="setPrio('Fun')">Fun</button>
        ${prioTag ? '<div class="qa-menu-sep"></div><button class="qa-menu-item" onclick="clearPrio()">Clear</button>' : ''}
      </div>
    </div>
    <button class="qa-pill" onclick="openSplitModal()" title="Split task">✂️</button>
    <button class="qa-pill danger" onclick="deleteCurrentTask()" title="Delete task">🗑️</button>
  `;
}

function toggleDropdown(id) {
  const menuId = id + '-menu';
  const isOpen = document.getElementById(menuId)?.classList.contains('open');
  ['dd-time-menu','dd-prio-menu'].forEach(m => document.getElementById(m)?.classList.remove('open'));
  if (!isOpen) document.getElementById(menuId)?.classList.add('open');
  setTimeout(() => document.addEventListener('click', closeDropdownsOutside, { once: true }), 0);
}
function closeDropdownsOutside(e) {
  if (!e.target.closest('.qa-dropdown') && !e.target.closest('.list-dd')) closeAllDropdowns();
}
function closeAllDropdowns() {
  ['dd-time-menu','dd-prio-menu','add-dd-time-menu','add-dd-prio-menu']
    .forEach(m => document.getElementById(m)?.classList.remove('open'));
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
    setTimeout(() => document.addEventListener('click', closeListDdOutside, { once: true }), 0);
  }
}
function closeListDdOutside(e) {
  if (!e.target.closest('.list-dd')) closeAllListDropdowns();
}
function closeAllListDropdowns() {
  document.querySelectorAll('.list-dd-menu.open').forEach(m => m.classList.remove('open'));
  openListDd = null;
}

// ── TAG HELPERS ──
function setTime(tag) {
  const task = currentTask(); if (!task) return;
  task.tags = (task.tags||[]).filter(t => !['5 min','15 min','30 min'].includes(t));
  task.tags.push(tag); save(); closeAllDropdowns(); render();
}
function clearTime() {
  const task = currentTask(); if (!task) return;
  task.tags = (task.tags||[]).filter(t => !['5 min','15 min','30 min'].includes(t));
  save(); closeAllDropdowns(); render();
}
function setPrio(tag) {
  const task = currentTask(); if (!task) return;
  task.tags = (task.tags||[]).filter(t => !['Urgent','Easy','Fun'].includes(t));
  task.tags.push(tag); save(); closeAllDropdowns(); render();
}
function clearPrio() {
  const task = currentTask(); if (!task) return;
  task.tags = (task.tags||[]).filter(t => !['Urgent','Easy','Fun'].includes(t));
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
  const page = document.getElementById('task-page');
  page.style.pointerEvents = 'none';

  task.done = true;
  const remaining = activeTasks();
  currentIndex = remaining.length > 0 ? currentIndex % remaining.length : 0;
  save();
  playConfetti();
  showCrushFlash();
  // Longer animation — render after flash fades (1.4s total)
  setTimeout(() => { page.style.pointerEvents = ''; render(); }, 1400);
}

function crushSubtask(idx) {
  const task = currentTask(); if (!task || !task.subtasks[idx]) return;
  task.subtasks[idx].done = true;
  save(); playConfetti(true); renderSubtasks(task);
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
  const remaining = activeTasks();
  currentIndex = remaining.length > 0 ? currentIndex % remaining.length : 0;
  save(); render();
}
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
function addSplitInput() {
  const wrap = document.getElementById('split-inputs-wrap');
  const inp  = document.createElement('input');
  inp.type = 'text'; inp.className = 'split-input';
  inp.placeholder = 'A smaller step…'; inp.maxLength = 140;
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
  tasks.push({ id: Date.now(), text, tags, done: false, subtasks: [], color: null, created: Date.now() });
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

    // Done tasks — with swipe-to-restore wrapper
    if (task.done) return `
      <div class="list-item done" data-idx="${realIdx}">
        <div class="restore-btn-wrap">
          <button class="restore-btn" onclick="restoreTask(${realIdx},event)">↩ Restore</button>
        </div>
        <div class="list-item-inner">
          <div class="list-item-dot ${hasDot?'':'invisible'}" style="background:${dotColor}"></div>
          <div class="list-item-body"><div class="list-item-text">${esc(task.text)}</div></div>
          <div class="list-item-actions">
            <button class="list-action-btn del" onclick="listDelete(${realIdx},event)" title="Delete">✕</button>
          </div>
        </div>
      </div>`;

    // Active tasks — no onclick select (disabled)
    return `
      <div class="list-item ${isCurrent?'is-current':''}"
           draggable="${currentSort==='manual'?'true':'false'}"
           data-idx="${realIdx}"
           ondragstart="onDragStart(event,${realIdx})"
           ondragover="onDragOver(event,${realIdx})"
           ondrop="onDrop(event,${realIdx})"
           ondragend="onDragEnd(event)">
        <div class="list-item-inner">
          <div class="drag-handle ${currentSort==='manual'?'':'hidden'}" onclick="event.stopPropagation()">⠿</div>
          <div class="list-item-dot ${hasDot?'':'invisible'}" style="background:${dotColor}"></div>
          <div class="list-item-body">
            <div class="list-item-text">${esc(task.text)}</div>
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
            <button class="list-action-btn del"   onclick="listDelete(${realIdx},event)" title="Delete">✕</button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Attach swipe-to-restore listeners to done rows
  attachSwipeRestore();
}

// ── SWIPE TO RESTORE (done rows) ──
function attachSwipeRestore() {
  document.querySelectorAll('.list-item.done').forEach(row => {
    const inner = row.querySelector('.list-item-inner');
    if (!inner) return;
    let startX = 0, startY = 0, swiping = false, currentX = 0;
    const THRESHOLD = 80; // px to trigger restore

    row.addEventListener('touchstart', e => {
      startX   = e.touches[0].clientX;
      startY   = e.touches[0].clientY;
      swiping  = false;
      currentX = 0;
      inner.style.transition = 'none';
    }, { passive: true });

    row.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (!swiping && Math.abs(dx) > 8 && Math.abs(dx) > dy) swiping = true;
      if (!swiping) return;
      // Only allow left swipe (negative dx)
      currentX = Math.min(0, dx);
      inner.style.transform = `translateX(${currentX}px)`;
    }, { passive: true });

    row.addEventListener('touchend', () => {
      if (!swiping) return;
      inner.style.transition = '';
      if (currentX < -THRESHOLD) {
        // Snap fully open to reveal restore button
        inner.style.transform = `translateX(-110px)`;
      } else {
        // Snap back
        inner.style.transform = 'translateX(0)';
      }
      swiping = false;
    }, { passive: true });

    row.addEventListener('touchcancel', () => {
      swiping = false;
      inner.style.transition = '';
      inner.style.transform  = 'translateX(0)';
    }, { passive: true });
  });
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
  tasks.splice(idx, 1);
  const remaining = activeTasks();
  currentIndex = remaining.length > 0 ? currentIndex % remaining.length : 0;
  save(); closeAllListDropdowns(); renderList(); render();
}
function clearAllDone() {
  if (!confirm('Clear all completed tasks?')) return;
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
  if (e.key === 'Escape') { closeAddScreen(); closeList(); closeSplitModal(); closeAllDropdowns(); }
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
