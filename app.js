// ─────────────────────────────────────────────
//  TASK CRUSHER — app.js
// ─────────────────────────────────────────────

// ── STATE ──
let tasks        = [];
let currentIndex = 0;
let selectedTags = [];
let currentFilter = 'active';
let openListDd   = null; // track open list-row dropdown id

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
    // migrate old emoji tags
    tasks.forEach(t => {
      if (!t.tags) t.tags = [];
      t.tags = t.tags.map(tag => tag
        .replace('⚡ ','').replace('🕐 ','').replace('⏰ ','').replace('🗓 ','')
        .replace('🔥 ','').replace('✌️ ','').replace('🎉 ','')
        .replace('1 hr','30 min')
      );
      t.tomorrow = false; // remove tomorrow flag
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
      badge.textContent  = task.tags.join('  ·  ');
      badge.style.color  = TAG_COLORS[task.tags[0]] || 'var(--accent)';
    } else {
      badge.textContent = '';
    }

    // queue hint
    const rem = active.length - 1;
    if (rem > 0) {
      queueHint.style.display = 'flex';
      document.getElementById('queue-label').textContent = rem + ' more task' + (rem !== 1 ? 's' : '') + ' in queue';
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

    <!-- PUSH + DELETE dropdown -->
    <div class="qa-dropdown" id="dd-push">
      <button class="qa-pill skip" onclick="toggleDropdown('dd-push')">Push ▾</button>
      <div class="qa-dropdown-menu" id="dd-push-menu">
        <button class="qa-menu-item" onclick="pushTask('next')">Move down one</button>
        <button class="qa-menu-item" onclick="pushTask('end')">Send to end</button>
        <div class="qa-menu-sep"></div>
        <button class="qa-menu-item" onclick="openSplitModal()">Split task</button>
        <div class="qa-menu-sep"></div>
        <button class="qa-menu-item danger" onclick="deleteCurrentTask()">Delete</button>
      </div>
    </div>
  `;
}

// dropdown toggle — close others first
function toggleDropdown(id) {
  const menus = ['dd-time-menu','dd-prio-menu','dd-push-menu'];
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
  ['dd-time-menu','dd-prio-menu','dd-push-menu'].forEach(m => {
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
  task.done = true;
  if (currentIndex >= activeTasks().length) currentIndex = 0;
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

// ── PUSH ──
// "next" = swap current task with the one right after it in active list (move down one)
// "end"  = move to end of active tasks
function pushTask(where) {
  const task = currentTask(); if (!task) return;
  closeAllDropdowns();

  const active = activeTasks();
  const activeIdx = active.indexOf(task);       // position in active array
  const globalIdx = tasks.indexOf(task);         // position in full tasks array

  if (where === 'end') {
    // Remove from current position, place after the last non-done task
    tasks.splice(globalIdx, 1);
    // Find last non-done task position
    let lastActive = -1;
    tasks.forEach((t, i) => { if (!t.done) lastActive = i; });
    tasks.splice(lastActive + 1, 0, task);
  } else {
    // "next" = move down one spot in the active queue
    // Find the next active task right after this one
    const nextActive = active[activeIdx + 1];
    if (!nextActive) {
      // Already last — nothing to do
      save(); render(); return;
    }
    const nextGlobalIdx = tasks.indexOf(nextActive);
    // Swap them in the tasks array
    tasks.splice(globalIdx, 1);
    // After removal, nextActive shifted up one if it was after globalIdx
    const newNextIdx = tasks.indexOf(nextActive);
    tasks.splice(newNextIdx + 1, 0, task);
  }

  // currentIndex stays 0 (the next task in queue becomes current)
  currentIndex = 0;
  if (currentIndex >= activeTasks().length) currentIndex = 0;
  save(); render();
}

// ── DELETE ──
function deleteCurrentTask() {
  const task = currentTask(); if (!task) return;
  closeAllDropdowns();
  if (!confirm('Delete this task?')) return;
  tasks = tasks.filter(t => t !== task);
  if (currentIndex >= activeTasks().length) currentIndex = 0;
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
  const color = task.color || randColor();

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
function submitTask() {
  const text = document.getElementById('add-input').value.trim();
  if (!text) { document.getElementById('add-input').focus(); return; }
  tasks.push({
    id: Date.now(),
    text,
    tags: [...selectedTags],
    done: false,
    subtasks: [],
    color: randColor(),
    created: Date.now(),
  });
  if (activeTasks().length === 1) currentIndex = 0;
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

function renderList() {
  let items;
  if (currentFilter === 'active') items = tasks.filter(t => !t.done);
  else if (currentFilter === 'done') items = tasks.filter(t => t.done);
  else items = [...tasks];

  const el = document.getElementById('list-items');
  if (items.length === 0) {
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-dim);font-size:15px;">Nothing here yet.</div>`;
    return;
  }

  const timeOpts = ['5 min','15 min','30 min'];
  const prioOpts = ['Urgent','Easy','Fun'];

  el.innerHTML = items.map((task, visIdx) => {
    const realIdx = tasks.indexOf(task);
    const cls     = task.done ? 'done' : '';
    const meta    = [
      task.tags && task.tags.length ? task.tags.join(' · ') : '',
      task.subtasks && task.subtasks.length ? `${task.subtasks.filter(s=>s.done).length}/${task.subtasks.length} steps` : ''
    ].filter(Boolean).join('  ·  ');

    const timeTag = (task.tags || []).find(t => timeOpts.includes(t));
    const prioTag = (task.tags || []).find(t => prioOpts.includes(t));
    const ddId    = `list-dd-${realIdx}`;

    if (task.done) {
      return `
        <div class="list-item ${cls}">
          <div class="list-item-dot"></div>
          <div class="list-item-body">
            <div class="list-item-text">${esc(task.text)}</div>
            ${meta ? `<div class="list-item-meta">${esc(meta)}</div>` : ''}
          </div>
          <div class="list-item-actions">
            <button class="list-icon-btn del" onclick="listDelete(${realIdx})">Delete</button>
          </div>
        </div>`;
    }

    // Active task — show time/priority labels + a "⋯" dropdown for crush/delete
    return `
      <div class="list-item ${cls}">
        <div class="list-item-dot" style="${task.color ? `background:${task.color}` : ''}"></div>
        <div class="list-item-body">
          <div class="list-item-text">${esc(task.text)}</div>
          ${meta ? `<div class="list-item-meta">${esc(meta)}</div>` : ''}
        </div>
        <div class="list-item-actions">
          <!-- Time pill dropdown -->
          <div class="list-dd">
            <button class="list-icon-btn ${timeTag ? 'active-tag' : ''}"
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
          <div class="list-dd">
            <button class="list-icon-btn ${prioTag ? 'active-tag' : ''}"
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
          <!-- Actions dropdown -->
          <div class="list-dd">
            <button class="list-icon-btn" onclick="toggleListDd('${ddId}-act', event)">⋯</button>
            <div class="list-dd-menu" id="${ddId}-act">
              <button class="qa-menu-item crush" onclick="listCrush(${realIdx})">✊ Crush</button>
              <div class="qa-menu-sep"></div>
              <button class="qa-menu-item danger" onclick="listDelete(${realIdx})">Delete</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');
}

function listCrush(idx) {
  tasks[idx].done = true;
  if (currentIndex >= activeTasks().length) currentIndex = 0;
  save(); closeAllListDropdowns(); renderList(); render();
}
function listDelete(idx) {
  tasks.splice(idx, 1);
  if (currentIndex >= activeTasks().length) currentIndex = 0;
  save(); closeAllListDropdowns(); renderList(); render();
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

  let rafId;
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
    if (alive) rafId = requestAnimationFrame(draw);
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

// ── KEYBOARD ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeAddModal(); closeList(); closeSplitModal(); closeAllDropdowns();
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    if (!document.getElementById('add-modal').classList.contains('hidden') &&
        document.activeElement !== document.getElementById('add-input')) {
      submitTask();
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
