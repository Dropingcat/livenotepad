// Sidebar app – compact version of the main PWA.
import { TUNING, BRANCHES, BRANCH_KEYS } from './js/constants.js';
import { Tokenizer } from './js/stemmer.js';
import { SeedsClassifier } from './js/classifier.js';
import { DueParser } from './js/due-parser.js';
import { DueState, DueStateCalculator, isOverdue } from './js/due-state.js';
import { filterLiveSheet, filterDeletedToday } from './js/live-sheet.js';
import { nextMidnight, startOfDay } from './js/time.js';
import { isDuplicateAdd } from './js/dedup.js';
import { GESTURE, resolveTouchAction, resolveMouseAction, placeMenu } from './js/gestures.js';

const DB = (() => {
  let db = null;
  return {
    async init() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open('livenotepad', 1);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('notes')) {
            const ns = d.createObjectStore('notes', { keyPath: 'id' });
            ns.createIndex('completedAt', 'completedAt');
            ns.createIndex('deletedAt', 'deletedAt');
          }
        };
        req.onsuccess = e => { db = e.target.result; resolve(db); };
        req.onerror = e => reject(e.target.error);
      });
    },
    isReady() { return db !== null; },
    getAllNotes() { if (!db) throw new Error('DB not initialized'); return promTx(db.transaction('notes', 'readonly'), db.transaction('notes', 'readonly').objectStore('notes').getAll()); },
    putNote(note) { if (!db) throw new Error('DB not initialized'); const tx = db.transaction('notes', 'readwrite'); const r = tx.objectStore('notes').put(note); return promTx(tx, r); }
  };
})();

function promTx(tx, req) {
  return new Promise((resolve, reject) => {
    const done = () => { try { resolve(req.result); } catch (e) { reject(e); } };
    tx.oncomplete = done;
    tx.onsuccess = done;
    tx.onerror = () => reject(tx.error || req.error || new Error('tx error'));
    tx.onabort = () => reject(tx.error || new Error('tx aborted'));
  });
}

let state = { notes: [], pendingDelete: null, lastAdd: null, adding: false, trashExpanded: false, girlTimer: null };

async function loadNotes() { state.notes = await DB.getAllNotes(); }

function liveSheet() { return filterLiveSheet(state.notes, Date.now()); }

function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

async function addNote(text) {
  const trimmed = text.trim();
  if (!trimmed || state.adding) return;
  const now = Date.now();
  if (isDuplicateAdd(state.lastAdd, trimmed, now, 2000)) return;
  state.adding = true;
  try {
    const due = DueParser.parse(trimmed, now);
    const note = {
      id: generateId(),
      text: trimmed, createdAt: now, completedAt: null, reopenedAt: null,
      dueAt: due ? due.dueAt : null,
      dueSource: due ? due.source : 'NONE',
      dueConfidence: due ? due.confidence : 0,
      branch: '', branchSource: 'NONE', branchConfidence: 0,
      matchedToken: '', correctionCount: 0, deletedAt: null, schemaVersion: 4
    };
    await DB.putNote(note);
    state.lastAdd = { text: trimmed, ts: now };
    await loadNotes();
    await render();
  } finally { state.adding = false; }
}

async function toggleNote(id) {
  const n = state.notes.find(x => x.id === id);
  if (!n) return;
  const now = Date.now();
  if (n.completedAt === null) {
    n.completedAt = now;
    n.reopenedAt = null;
  } else {
    n.reopenedAt = now;
    n.completedAt = null;
  }
  await DB.putNote(n);
  await render();
}

async function deleteNote(id) {
  const n = state.notes.find(x => x.id === id);
  if (!n) return;
  n.deletedAt = Date.now();
  await DB.putNote(n);
  await render();
}

async function restoreNote(id) {
  const n = state.notes.find(x => x.id === id);
  if (!n) return;
  n.deletedAt = null;
  await DB.putNote(n);
  hideGirl();
  state.pendingDelete = null;
  await render();
}

// ── Open branch menu ────────────────────────────────────────────────────────
function openBranchMenu(noteId, x, y) {
  const note = state.notes.find(n => n.id === noteId);
  if (!note) return;
  const menu = document.getElementById('branchMenu');
  menu.innerHTML = `<div class="branch-menu-item danger" data-action="delete">🗑 Удалить</div>`;
  menu.classList.add('visible');
  const rect = menu.getBoundingClientRect();
  const pos = placeMenu({ x, y, vw: window.innerWidth, vh: window.innerHeight, menuW: rect.width, menuH: rect.height });
  menu.style.left = pos.left + 'px'; menu.style.top = pos.top + 'px';
  menu.querySelectorAll('.branch-menu-item').forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      menu.classList.remove('visible');
      if (item.dataset.action === 'delete') {
        state.pendingDelete = note.id;
        showGirl();
        deleteNote(note.id);
      }
    };
  });
}

// ── Girl undo ───────────────────────────────────────────────────────────────
function showGirl() { /* simplified: immediate toast undo */ toast('Удалено · отменить → нажмите «Вернуть»'); state.girlTimer = setTimeout(hideGirl, 3700); }
function hideGirl() { state.pendingDelete = null; clearTimeout(state.girlTimer); }

// ── Render ──────────────────────────────────────────────────────────────────
async function render() {
  const list = document.getElementById('list');
  const now = Date.now();
  const sheet = liveSheet();
  if (sheet.length === 0) {
    list.innerHTML = `<div class="empty">Жду задачи.</div>`;
    const deleted = filterDeletedToday(state.notes, now);
    if (deleted.length > 0) {
      list.innerHTML += `<div class="trash-block" id="trashBlock"><div class="trash-head" id="trashHead"><span>Корзина · ${deleted.length}</span></div><div class="trash-body" id="trashBody" hidden>${deleted.map(renderDeleted).join('')}</div></div>`;
    }
    attachHandlers();
    return;
  }
  const open = sheet.filter(n => n.completedAt === null);
  const closed = sheet.filter(n => n.completedAt !== null);
  const overdue = open.filter(n => isOverdue(DueStateCalculator.of(n, now)));
  const rest = open.filter(n => !isOverdue(DueStateCalculator.of(n, now)));
  let html = '';
  if (overdue.length > 0) html += `<div class="overdue-head">Просрочено · ${overdue.length}</div>`;
  rest.forEach(n => html += renderNote(n, now));
  if (closed.length > 0) {
    html += `<div class="section-head">Сделано · ${closed.length}</div>`;
    closed.forEach(n => html += renderNote(n, now));
  }
  const deleted = filterDeletedToday(state.notes, now);
  if (deleted.length > 0) {
    html += `<div class="trash-block ${state.trashExpanded ? 'expanded' : ''}" id="trashBlock">
      <div class="trash-head" id="trashHead"><span>Корзина · ${deleted.length}</span><span>›</span></div>
      <div class="trash-body" id="trashBody"${state.trashExpanded ? '' : ' hidden'}>${deleted.map(renderDeleted).join('')}</div>
    </div>`;
  }
  list.innerHTML = html;
  attachHandlers();
}

function renderNote(n, now) {
  const closed = n.completedAt !== null;
  const dueLabel = n.dueAt ? formatDue(n.dueAt) : null;
  const dueHtml = dueLabel && !closed ? `<div class="note-due ${isOverdue(DueStateCalculator.of(n, now)) ? 'overdue' : ''}">до ${dueLabel}</div>` : '';
  return `<div class="note ${closed?'closed':''}" data-id="${esc(n.id)}"><div class="note-text">${esc(n.text)}</div>${dueHtml}</div>`;
}

function renderDeleted(n) {
  return `<div class="note deleted" data-deleted-id="${esc(n.id)}"><div class="note-text">${esc(n.text)} <button class="note-restore" data-restore="${esc(n.id)}">вернуть</button></div></div>`;
}

function esc(s) { return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function formatDue(dueAt) {
  const now = new Date(); now.setHours(0,0,0,0);
  const d = new Date(dueAt);
  const dDay = new Date(d); dDay.setHours(0,0,0,0);
  const diff = Math.round((dDay - now) / 86400000);
  const hh = String(d.getHours()).padStart(2,'0');
  const mm = String(d.getMinutes()).padStart(2,'0');
  const months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
  let label = diff === 0 ? 'сегодня' : diff === 1 ? 'завтра' : diff === -1 ? 'вчера' : `${d.getDate()} ${months[d.getMonth()]}`;
  const time = `${hh}:${mm}`;
  return time === '23:59' ? label : `${label} ${time}`;
}

// ── Handlers ────────────────────────────────────────────────────────────────
function attachHandlers() {
  document.querySelectorAll('.note:not(.deleted)').forEach(el => {
    const id = el.dataset.id;
    let lastTouchTs = 0;
    // Tap for both touch and mouse: toggle
    el.addEventListener('click', e => {
      if (e.button !== 0 && e.button !== undefined) return;
      toggleNote(id);
    });
    // Long press / context menu (reuse placeMenu)
    el.addEventListener('contextmenu', e => { e.preventDefault(); openBranchMenu(id, e.clientX, e.clientY); });
    // Touch long-press
    let longTimer = null, longPressed = false;
    el.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      lastTouchTs = Date.now();
      longTimer = setTimeout(() => { longPressed = true; openBranchMenu(id, e.touches[0].clientX, e.touches[0].clientY); }, 300);
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (e.touches.length !== 1) return;
      const dx = e.touches[0].clientX;
      if (dx > 10) clearTimeout(longTimer);
    }, { passive: true });
    el.addEventListener('touchend', () => { clearTimeout(longTimer); longPressed = false; });
  });
  document.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); restoreNote(btn.dataset.restore); });
  });
  const trashHead = document.getElementById('trashHead');
  if (trashHead) trashHead.addEventListener('click', () => {
    state.trashExpanded = !state.trashExpanded;
    const b = document.getElementById('trashBody');
    if (b) b.hidden = !state.trashExpanded;
    document.getElementById('trashBlock')?.classList.toggle('expanded', state.trashExpanded);
  });
  document.getElementById('branchMenu').addEventListener('click', e => {
    const menu = document.getElementById('branchMenu');
    if (!menu.contains(e.target)) menu.classList.remove('visible');
  });
}

// ── Toast ───────────────────────────────────────────────────────────────────
function toast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
  // Also log to overlay
  const body = document.getElementById('logBody');
  if (body) body.textContent += `[${new Date().toLocaleTimeString('ru-RU')}] ${msg}\n`;
}

// ── Init ────────────────────────────────────────────────────────────────────
document.getElementById('addBtn').addEventListener('click', () => {
  const text = document.getElementById('draft').value.trim();
  if (text) { addNote(text); document.getElementById('draft').value = ''; }
});
document.getElementById('draft').addEventListener('keydown', async e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = document.getElementById('draft').value.trim();
    if (text) { await addNote(text); document.getElementById('draft').value = ''; }
  }
});
document.getElementById('logClose').addEventListener('click', () => document.getElementById('logOverlay').classList.remove('visible'));
// Long-press for Monitor: settings button → tap 7 times shows log overlay
let diagCnt = 0;
document.getElementById('addBtn').addEventListener('contextmenu', e => {
  e.preventDefault();
  diagCnt++;
  if (diagCnt >= 5) {
    diagCnt = 0;
    document.getElementById('logOverlay').classList.toggle('visible');
    const body = document.getElementById('logBody');
    body.textContent = `Заметок: ${state.notes.length}\nОткрыто: ${state.notes.filter(n => !n.deletedAt && n.completedAt == null).length}\nСделано: ${state.notes.filter(n => n.completedAt != null).length}\nБД: ${DB.isReady() ? '✓' : '✗'}\n`;
  }
});

(async () => {
  await DB.init();
  await loadNotes();
  await render();
  toast('Загружено');
})();