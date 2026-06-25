// ─────────────────────────────────────────────
//  TASK CRUSHER — app.js
// ─────────────────────────────────────────────

// ── STATE ──────────────────────────────────────
let tasks = [];
let currentIndex = 0;   // index within active tasks
let selectedTags = [];
let currentFilter = 'active';

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

const CRUSH_WORDS = ['CRUSHED! 💥', 'BOOM! 🔥', 'NAILED IT! ⚡', 'DONE! ✊', 'YES! 🎉', 'DESTROYED! 💪'];

const TAG_COLORS = {
  '⚡ 5 min':  '#BFFF00',
  '🕐 15 min': '#00cfff',
  '⏰ 30 min': '#ff9f00',
  '🔥 Urgent': '#ff4545',
  '✌️ Easy':  '#7fff8a',
  '🎉 Fun':   '#d084ff',
};

const PARENT_COLORS = [
  '#BFFF00','#00cfff','#ff9f00','#ff4545','#7fff8a','#d084ff','#ff6eb4','#4dc8ff'
];

// ── STORAGE ─────────────────────────────────────
function save() {
  localStorage.setItem('tc_tasks', JSON.stringify(tasks));
  localStorage.setItem('tc_index', String(currentIndex));
}

function load() {
  try {
    tasks = JSON.parse(localStorage.getItem('tc_tasks') || '[]');
    currentIndex = parseInt(localStorage.getItem('tc_index') || '0', 10);
  } catch (e) {
    tasks = [];
    currentIndex = 0;
  }
  const active = activeTasks();
  if (currentIndex >= active.length) currentIndex = 0;
}

// ── HELPERS ─────────────────────────────────────
function activeTasks() {
  return tasks.filter(t => !t.done && !t.tomorrow);
}

function currentTask() {
  const active = activeTasks();
  return active[currentIndex] || active[0] || null;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomColor() {
  return randomFrom(PARENT_COLORS);
}

// ── RENDER ──────────────────────────────────────
function render() {
  const active = activeTasks();
  const done   = tasks.filter(t => t.done);
  const task   = currentTask();

  // task count
  const countEl = document.getElementById('task-count');
  if (active.length > 0) {
    countEl.textContent = active.length + (done.length > 0 ? ` · ✅ ${done.length}` : '');
    countEl.className = done.length > 0 ? 'has-done' : '';
  } else if (done.length > 0) {
    countEl.textContent = `✅ ${done.length} done`;
    countEl.className = 'has-done';
  } else {
    countEl.textContent = '';
    countEl.className = '';
  }

  // states
  const taskCard   = document.getElementById('task-card');
  const emptyCard  = document.getElementById('empty-card');
  const queueHint  = document.getElementById('queue-hint');
  const emptyDone  = document.getElementById('empty-done-msg');
  const badge      = document.getElementById('task-badge');
  const quickActs  = document.getElementById('quick-actions');
  const subtaskList = document.getElementById('subtask-list');

  if (task) {
    // show task card
    taskCard.style.display = 'block';
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

    // queue
    const remaining = active.length - 1;
    if (remaining > 0) {
      queueHint.style.display = 'flex';
      document.getElementById('queue-label').textContent =
        `${remaining} more task${remaining !== 1 ? 's' : ''} in queue`;
    } else {
      queueHint.style.display = 'none';
    }

    // quick actions
    renderQuickActions(task);

    // subtasks — each subtask is shown as its own card
    renderSubtasks(task);

  } else {
    taskCard.style.display = 'none';
    badge.textContent = '';
    quickActs.innerHTML = '';
    subtaskList.innerHTML = '';
    queueHint.style.display = 'none';

    if (done.length > 0) {
      emptyCard.style.display = 'none';
      emptyDone.style.display = 'block';
    } else {
      emptyCard.style.display = 'block';
      emptyDone.style.display = 'none';
      document.getElementById('empty-prompt').textContent = randomFrom(PROMPTS);
    }
  }
}

function renderQuickActions(task) {
  const el = document.getElementById('quick-actions');
  el.innerHTML = `
    <button class="qa-btn push-btn" onclick="pushTask('next')">→ Skip</button>
    <button class="qa-btn split-btn" onclick="openSplitModal()">✂️ Split</button>
    <button class="qa-btn more-btn" onclick="openActionModal()">⋯ More</button>
  `;
}

function renderSubtasks(task) {
  const el = document.getElementById('subtask-list');
  if (!task.subtasks || task.subtasks.length === 0) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = task.subtasks.map((st, i) => `
    <div class="subtask-card ${st.done ? 'done' : ''}" onclick="crushSubtask(${i})" id="st-card-${i}">
      <div class="subtask-dot" style="background:${task.color || 'var(--accent)'}"></div>
      <span class="subtask-text-label">${escHtml(st.text)}</span>
      <div class="subtask-crush-hint">✊ Crush it!</div>
      <div class="subtask-actions" onclick="event.stopPropagation()">
        <button class="subtask-action-btn del" onclick="deleteSubtask(${i})">✕</button>
      </div>
    </div>
  `).join('');
}

// ── TASK CARD CLICK ─────────────────────────────
function handleCardClick() {
  crushTask();
}

// ── CRUSH MAIN TASK ─────────────────────────────
function crushTask() {
  const task = currentTask();
  if (!task) return;
  task.done = true;

  // fix index
  const newActive = activeTasks();
  if (currentIndex >= newActive.length) currentIndex = 0;

  save();
  playConfetti();
  showCrushFlash();
  setTimeout(() => render(), 850);
}

// ── CRUSH SUBTASK ───────────────────────────────
function crushSubtask(idx) {
  const task = currentTask();
  if (!task || !task.subtasks[idx]) return;
  task.subtasks[idx].done = true;
  save();
  playConfetti(true);
  renderSubtasks(task);

  // if all done, prompt to crush parent
  if (task.subtasks.every(s => s.done)) {
    setTimeout(() => {
      if (confirm('All steps done! Crush the main task?')) crushTask();
    }, 500);
  }
}

// ── PUSH ────────────────────────────────────────
function pushTask(where) {
  const task = currentTask();
  if (!task) return;
  closeActionModal();

  const idx = tasks.indexOf(task);
  tasks.splice(idx, 1);

  if (where === 'tomorrow') {
    task.tomorrow = true;
    tasks.push(task);
  } else if (where === 'end') {
    tasks.push(task);
  } else if (where === 'next') {
    // insert just after first active task
    const firstActive = tasks.findIndex(t => !t.done && !t.tomorrow);
    tasks.splice(firstActive + 1, 0, task);
  }

  const newActive = activeTasks();
  if (currentIndex >= newActive.length) currentIndex = 0;
  save();
  render();
}

// ── DELETE TASK ─────────────────────────────────
function deleteCurrentTask() {
  const task = currentTask();
  if (!task) return;
  if (!confirm('Delete this task?')) return;
  tasks = tasks.filter(t => t !== task);
  const newActive = activeTasks();
  if (currentIndex >= newActive.length) currentIndex = 0;
  save();
  render();
}

function deleteSubtask(idx) {
  const task = currentTask();
  if (!task) return;
  task.subtasks.splice(idx, 1);
  save();
  renderSubtasks(task);
}

// ── ACTION MODAL SHORTCUTS ──────────────────────
function actionSetTime(tag) {
  const task = currentTask();
  if (!task) return;
  task.tags = task.tags ? task.tags.filter(t => !t.includes('min')) : [];
  task.tags.push(tag);
  save();
  closeActionModal();
  render();
}

function actionSetPriority(tag) {
  const task = currentTask();
  if (!task) return;
  task.tags = task.tags || [];
  if (!task.tags.includes(tag)) task.tags.push(tag);
  save();
  closeActionModal();
  render();
}

function actionPush(where) {
  pushTask(where);
}

// ── ADD TASK ────────────────────────────────────
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
  if (!text) {
    document.getElementById('add-input').focus();
    return;
  }

  const task = {
    id: Date.now(),
    text,
    tags: [...selectedTags],
    done: false,
    tomorrow: false,
    subtasks: [],
    color: randomColor(),
    created: Date.now(),
  };

  tasks.push(task);
  save();
  closeAddModal();

  // if this is the first active task, reset index
  if (activeTasks().length === 1) currentIndex = 0;
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

// ── SPLIT MODAL ─────────────────────────────────
function openSplitModal() {
  const task = currentTask();
  if (!task) return;

  document.getElementById('split-parent-label').innerHTML =
    `Breaking down: <strong>${escHtml(task.text)}</strong>`;

  const wrap = document.getElementById('split-inputs-wrap');
  wrap.innerHTML = '';
  addSplitInput();
  addSplitInput();

  document.getElementById('split-modal').classList.remove('hidden');
  setTimeout(() => wrap.querySelector('.split-input').focus(), 100);
}

function closeSplitModal() {
  document.getElementById('split-modal').classList.add('hidden');
}

function addSplitInput() {
  const wrap = document.getElementById('split-inputs-wrap');
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'split-input';
  inp.placeholder = 'A smaller step…';
  inp.maxLength = 140;
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      addSplitInput();
      setTimeout(() => wrap.lastChild.focus(), 50);
    }
  });
  wrap.appendChild(inp);
}

function confirmSplit() {
  const inputs = document.querySelectorAll('.split-input');
  const steps = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
  if (steps.length === 0) return;

  const task = currentTask();
  if (!task) return;

  task.subtasks = steps.map(text => ({ text, done: false }));
  if (!task.color) task.color = randomColor();
  save();
  closeSplitModal();
  render();
}

// ── ACTION MODAL ────────────────────────────────
function openActionModal() {
  document.getElementById('action-modal').classList.remove('hidden');
}

function closeActionModal() {
  document.getElementById('action-modal').classList.add('hidden');
}

// ── TASK LIST OVERLAY ────────────────────────────
function openList() {
  renderList();
  document.getElementById('list-overlay').classList.remove('hidden');
}

function closeList() {
  document.getElementById('list-overlay').classList.add('hidden');
}

function setFilter(btn, filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderList();
}

function renderList() {
  let items;
  if (currentFilter === 'active') {
    items = tasks.filter(t => !t.done);
  } else if (currentFilter === 'done') {
    items = tasks.filter(t => t.done);
  } else {
    items = [...tasks];
  }

  const el = document.getElementById('list-items');
  if (items.length === 0) {
    el.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-dim);font-size:15px;">Nothing here yet.</div>`;
    return;
  }

  el.innerHTML = items.map((task, i) => {
    const cls = task.done ? 'done' : task.tomorrow ? 'tomorrow' : '';
    const tagStr = task.tags && task.tags.length > 0
      ? `<span class="list-item-tags">${escHtml(task.tags.join(' · '))}</span>` : '';
    const subtaskStr = task.subtasks && task.subtasks.length > 0
      ? `<span class="list-item-tags">${task.subtasks.filter(s=>s.done).length}/${task.subtasks.length} steps</span>` : '';
    const taskIdx = tasks.indexOf(task);

    const actions = task.done
      ? `<button class="list-action del-action" onclick="listDeleteTask(${taskIdx})">🗑</button>`
      : `<button class="list-action crush-action" onclick="listCrushTask(${taskIdx})">✊</button>
         <button class="list-action del-action" onclick="listDeleteTask(${taskIdx})">🗑</button>`;

    return `
      <div class="list-item ${cls}">
        <div class="list-item-dot" style="${!task.done && task.color ? `background:${task.color}` : ''}"></div>
        <div style="flex:1;min-width:0;">
          <div class="list-item-text">${escHtml(task.text)}</div>
          <div style="display:flex;gap:8px;margin-top:4px;">${tagStr}${subtaskStr}</div>
        </div>
        <div class="list-item-actions">${actions}</div>
      </div>
    `;
  }).join('');
}

function listCrushTask(taskIdx) {
  const task = tasks[taskIdx];
  if (!task) return;
  task.done = true;
  const newActive = activeTasks();
  if (currentIndex >= newActive.length) currentIndex = 0;
  save();
  renderList();
  render();
}

function listDeleteTask(taskIdx) {
  tasks.splice(taskIdx, 1);
  const newActive = activeTasks();
  if (currentIndex >= newActive.length) currentIndex = 0;
  save();
  renderList();
  render();
}

// ── CONFETTI ────────────────────────────────────
function playConfetti(mini = false) {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const count  = mini ? 50 : 150;
  const colors = ['#BFFF00','#ffffff','#ff4545','#00cfff','#ff9f00','#d084ff'];
  const pieces = Array.from({ length: count }, () => ({
    x:    canvas.width / 2 + (Math.random() - 0.5) * (mini ? 100 : canvas.width * 0.7),
    y:    mini ? canvas.height * 0.45 : -10,
    w:    Math.random() * 11 + 4,
    h:    Math.random() * 6  + 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    vx:   (Math.random() - 0.5) * (mini ? 7 : 14),
    vy:   Math.random() * (mini ? 5 : 9) + (mini ? 1 : 2),
    rot:  Math.random() * 360,
    rotV: (Math.random() - 0.5) * 9,
    opacity: 1,
  }));

  let rafId;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += 0.2;
      p.rot += p.rotV;
      p.opacity -= mini ? 0.02 : 0.013;
      if (p.opacity > 0 && p.y < canvas.height + 20) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    });
    if (alive) rafId = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  if (rafId) cancelAnimationFrame(rafId);
  draw();
}

function showCrushFlash() {
  const flash = document.getElementById('crush-flash');
  const text  = document.getElementById('crush-flash-text');
  text.textContent = randomFrom(CRUSH_WORDS);

  flash.style.transition = 'opacity 0.12s';
  flash.style.opacity = '1';
  text.style.transform = 'scale(1)';
  text.style.opacity   = '1';

  setTimeout(() => {
    flash.style.transition = 'opacity 0.4s';
    flash.style.opacity    = '0';
    text.style.opacity     = '0';
    text.style.transform   = 'scale(0.7)';
  }, 550);
}

// ── KEYBOARD SHORTCUTS ───────────────────────────
document.addEventListener('keydown', e => {
  // Escape closes any open modal
  if (e.key === 'Escape') {
    closeAddModal();
    closeList();
    closeSplitModal();
    closeActionModal();
  }
  // Enter in add modal submits
  if (e.key === 'Enter' && !e.shiftKey) {
    const addModal = document.getElementById('add-modal');
    if (!addModal.classList.contains('hidden') &&
        document.activeElement !== document.getElementById('add-input')) {
      submitTask();
    }
  }
});

// Close overlays when clicking backdrop
['list-overlay','add-modal','split-modal','action-modal'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === this) {
      this.classList.add('hidden');
    }
  });
});

// ── PWA MANIFEST ─────────────────────────────────
(function injectManifest() {
  const manifest = {
    name: 'Task Crusher',
    short_name: 'Crusher',
    start_url: '.',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [{
      src: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%230a0a0a'/><text y='.9em' font-size='76' x='12'>⚡</text></svg>",
      sizes: '192x192',
      type: 'image/svg+xml',
    }],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const link = document.createElement('link');
  link.rel  = 'manifest';
  link.href = URL.createObjectURL(blob);
  document.head.appendChild(link);
})();

// ── INIT ────────────────────────────────────────
load();
render();
