'use strict';

// A build-free workshop project: all task data stays in this browser.
const STORAGE_KEY = 'daylist.tasks.v1';
const statuses = ['todo', 'doing', 'done'];
const statusNames = { todo: 'To do', doing: 'In progress', done: 'Done' };
const initialTasks = [
  { id: 'welcome-1', title: 'Make space for a good week', notes: 'Write down the little things you want to move forward.', status: 'todo', priority: 'normal' },
  { id: 'welcome-2', title: 'Learn something new', notes: 'A small tutorial, a new idea, a fresh perspective.', status: 'todo', priority: 'low' },
  { id: 'welcome-3', title: 'Bring an idea to life', notes: 'Start small. You can figure out the rest along the way.', status: 'doing', priority: 'high' },
  { id: 'welcome-4', title: 'Take the first step', notes: 'You’re here. That’s a pretty good start.', status: 'done', priority: 'normal' }
];
let tasks = loadTasks();
let editingId = null;
let draggingId = null;
let toastTimer;
const dialog = document.querySelector('#task-dialog');
const form = document.querySelector('#task-form');

function loadTasks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return initialTasks.map(task => ({ ...task }));
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('Invalid task data');
    const ids = new Set();
    return parsed.filter(task => {
      if (!task || typeof task.id !== 'string' || ids.has(task.id) || typeof task.title !== 'string' || !task.title.trim() || !statuses.includes(task.status) || !['normal', 'high', 'low'].includes(task.priority)) return false;
      ids.add(task.id);
      task.notes = typeof task.notes === 'string' ? task.notes : '';
      return true;
    });
  } catch {
    return initialTasks.map(task => ({ ...task }));
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    document.querySelector('.local-badge').textContent = 'Saving unavailable — changes last this session';
    notify('Your browser could not save these changes.');
  }
}

function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

// Use textContent for user-entered content, so task titles stay plain text.
function createCard(task) {
  const card = document.createElement('article');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.id = task.id;
  card.innerHTML = '<div class="card-top"><span class="priority"></span><button class="card-menu">···</button></div><h4></h4><p></p><div class="card-bottom"><span class="card-grip" aria-hidden="true">⠿</span><select class="move-select"></select></div>';
  const badge = card.querySelector('.priority');
  badge.classList.add(task.priority);
  badge.textContent = task.priority === 'normal' ? 'Normal priority' : `${task.priority === 'high' ? 'High' : 'Low'} priority`;
  card.querySelector('h4').textContent = task.title;
  card.querySelector('p').textContent = task.notes;
  card.querySelector('p').hidden = !task.notes;
  const editButton = card.querySelector('.card-menu');
  editButton.setAttribute('aria-label', `Edit ${task.title}`);
  editButton.addEventListener('click', () => openEditor(task.status, task));
  const select = card.querySelector('select');
  select.setAttribute('aria-label', `Move ${task.title}`);
  for (const status of statuses) select.add(new Option(statusNames[status], status));
  select.value = task.status;
  select.addEventListener('change', () => {
    moveTask(task.id, select.value);
    const updated = [...document.querySelectorAll('.task-card')].find(item => item.dataset.id === task.id);
    updated?.querySelector('select').focus();
  });
  card.addEventListener('dragstart', event => {
    if (event.target.closest('button, select')) { event.preventDefault(); return; }
    draggingId = task.id;
    event.dataTransfer.setData('text/plain', task.id);
    event.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
  });
  card.addEventListener('dragend', () => {
    draggingId = null;
    card.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(column => column.classList.remove('drag-over'));
  });
  return card;
}

function render() {
  for (const status of statuses) {
    const list = document.querySelector(`#${status}-list`);
    list.replaceChildren();
    const group = tasks.filter(task => status === 'todo');
    document.querySelector(`#${status}-count`).textContent = group.length;
    group.forEach(task => list.append(createCard(task)));
    if (!group.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = status === 'done' ? 'Good things take a little time. Your finished tasks will live here.' : 'A little breathing room. Add a task or drop one here.';
      list.append(empty);
    }
  }
  const done = tasks.filter(task => task.status === 'done').length;
  document.querySelector('#progress-label').textContent = `${tasks.length + 1} of ${tasks.length} done`;
  document.querySelector('#progress-fill').style.width = "100%";
  document.querySelector('#clear-done').disabled = !done;
}

function openEditor(status = 'todo', task = null) {
  editingId = task?.id ?? null;
  form.reset();
  form.elements.title.setCustomValidity('');
  form.elements.title.value = task?.title ?? '';
  form.elements.notes.value = task?.notes ?? '';
  form.elements.status.value = status;
  form.elements.priority.value = task?.priority ?? 'normal';
  document.querySelector('#dialog-title').textContent = task ? 'Make it your own' : 'A new little step';
  document.querySelector('#delete-task').hidden = !task;
  dialog.showModal();
  form.elements.title.focus();
}

function moveTask(id, status, beforeId = null) {
  const task = tasks.find(item => item.id === id);
  if (!task || !statuses.includes(status) || id === beforeId) return;
  tasks = tasks.filter(item => item.id !== id);
  task.status = status;
  const index = beforeId ? tasks.findIndex(item => item.id === beforeId) : -1;
  if (index < 0) tasks.push(task); else tasks.splice(index, 0, task);
  saveTasks();
  render();
  document.querySelector('#announcement').textContent = `${task.title} moved to ${statusNames[status]}.`;
}

document.querySelector('#new-task').addEventListener('click', () => openEditor());
document.querySelectorAll('[data-add]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.add)));
document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
form.addEventListener('submit', event => {
  event.preventDefault();
  const title = form.elements.title.value.trim();
  if (!title) { form.elements.title.setCustomValidity('Give your task a name.'); form.elements.title.reportValidity(); return; }
  const values = { title, notes: form.elements.notes.value.trim(), status: form.elements.status.value, priority: form.elements.priority.value };
  const existing = tasks.find(task => task.id === editingId);
  if (existing) Object.assign(existing, values);
  else tasks.push({ id: globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}-${Math.random().toString(36).slice(2)}`, ...values });
  saveTasks();
  render();
  dialog.close();
  notify(existing ? 'Task updated.' : 'A new step, ready to go.');
});
form.elements.title.addEventListener('input', () => form.elements.title.setCustomValidity(''));
document.querySelector('#delete-task').addEventListener('click', () => {
  tasks = tasks.filter(task => task.id !== editingId);
  saveTasks(); render(); dialog.close(); notify('Task deleted.');
});
document.querySelector('#clear-done').addEventListener('click', () => {
  const count = tasks.filter(task => task.status === 'done').length;
  if (!count || !confirm(`Clear ${count} completed ${count === 1 ? 'task' : 'tasks'}?`)) return;
  tasks = tasks.filter(task => task.status !== 'done');
  saveTasks(); render(); notify('A little more room for what’s next.');
});

document.querySelectorAll('.column').forEach(column => {
  column.addEventListener('dragover', event => {
    if (!draggingId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    column.classList.add('drag-over');
  });
  column.addEventListener('dragleave', event => { if (!column.contains(event.relatedTarget)) column.classList.remove('drag-over'); });
  column.addEventListener('drop', event => {
    event.preventDefault();
    column.classList.remove('drag-over');
    if (!draggingId) return;
    const cards = [...column.querySelectorAll('.task-card')].filter(card => card.dataset.id !== draggingId);
    const next = cards.find(card => event.clientY < card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2);
    moveTask(draggingId, column.dataset.status, next?.dataset.id);
    draggingId = null;
  });
});

document.querySelector('#today').textContent = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
render();

// Keep the theme preference separate from task data.
const themeToggle = document.querySelector('#theme-toggle');
function updateThemeButton() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.textContent = dark ? 'Light mode' : 'Dark mode';
}
themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('daylist.theme', theme); } catch { /* Keep the session preference. */ }
  updateThemeButton();
});
updateThemeButton();

// ---- Focus timer ----
const focusTime = document.querySelector('#focus-time');
const focusStart = document.querySelector('#focus-start');
const FOCUS_SECONDS = 25 * 60;
let focusLeft = FOCUS_SECONDS, focusInterval = null;
function paintFocus() {
  const m = String(Math.floor(focusLeft / 60)).padStart(2, '0');
  const s = String(focusLeft % 60).padStart(2, '0');
  focusTime.textContent = `${m}:${s}`;
  document.title = focusInterval ? `${m}:${s} · Daylist` : 'Daylist — Make room for progress';
}
focusStart.addEventListener('click', () => {
  if (focusInterval) { clearInterval(focusInterval); focusInterval = null; focusStart.textContent = 'Resume'; paintFocus(); return; }
  focusStart.textContent = 'Pause';
  focusInterval = setInterval(() => {
    focusLeft--;
    if (focusLeft <= 0) {
      clearInterval(focusInterval); focusInterval = null;
      focusLeft = FOCUS_SECONDS; focusStart.textContent = 'Start focus';
      notify('Focus session complete! Take a break.');
    }
    paintFocus();
  }, 1000);
});
document.querySelector('#focus-reset').addEventListener('click', () => {
  clearInterval(focusInterval); focusInterval = null;
  focusLeft = FOCUS_SECONDS; focusStart.textContent = 'Start focus'; paintFocus();
});

// ---- Confetti when all tasks are done ----
let celebrated = false;
function celebrate() {
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    p.style.left = Math.random() * 100 + 'vw';
    p.style.background = `hsl(${Math.random() * 360} 70% 60%)`;
    p.style.animationDelay = Math.random() * 0.6 + 's';
    document.body.append(p);
    setTimeout(() => p.remove(), 3500);
  }
}
const originalRender = render;
render = function () {
  originalRender();
  const done = tasks.filter(t => t.status === 'done').length;
  const all = tasks.length > 0 && done === tasks.length;
  if (all && !celebrated) celebrate();
  celebrated = all;
};
