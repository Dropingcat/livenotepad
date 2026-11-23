import { readFile, writeFile } from 'node:fs/promises';

const path = 'www/index.html';
let src = await readFile(path, 'utf8');
src = src.replace(/\r\n/g, '\n');

const imports = `<script type="module">
import { TUNING, BRANCHES, BRANCH_KEYS } from './js/constants.js';
import { Tokenizer } from './js/stemmer.js';
import { SeedsClassifier } from './js/classifier.js';
import { DueParser } from './js/due-parser.js';
import { DueState, DueStateCalculator, isOverdue } from './js/due-state.js';
import { filterLiveSheet } from './js/live-sheet.js';
`;

const start = src.indexOf('<script>');
const end = src.indexOf('const DB = (() => {');
if (start < 0 || end < 0) throw new Error('script/DB markers not found');
src = src.slice(0, start) + imports + '\n' + src.slice(end);

function cut(fromMarker, toMarker) {
  const a = src.indexOf(fromMarker);
  const b = src.indexOf(toMarker);
  if (a < 0 || b < 0 || b <= a) {
    throw new Error(`cut markers not found: ${fromMarker} -> ${toMarker}`);
  }
  src = src.slice(0, a) + src.slice(b);
}

// Удаляем чистую логику, которая теперь живёт в www/js/*.
cut('const RuStemmer = {', 'const WordLearningService = {');
cut('const DueParser = (() => {', 'const Corrections = (() => {');

const oldLive = `function todayStart() { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }
function liveSheet() { const ts = todayStart(); return state.notes.filter(n => !n.deletedAt && (n.completedAt === null || n.completedAt >= ts)); }`;
const newLive = `function liveSheet() { return filterLiveSheet(state.notes, Date.now()); }`;
if (!src.includes(oldLive)) throw new Error('liveSheet block not found');
src = src.replace(oldLive, newLive);

const replacements = [
  [
    'const overdue = open.filter(n => DueStateCalculator.of(n, now) === DueState.OVERDUE);\n  const rest = open.filter(n => DueStateCalculator.of(n, now) !== DueState.OVERDUE);',
    'const overdue = open.filter(n => isOverdue(DueStateCalculator.of(n, now)));\n  const rest = open.filter(n => !isOverdue(DueStateCalculator.of(n, now)));'
  ],
  [
    "if (dueLabel && !closed) dueHtml = `<div class=\"note-due ${dueState === DueState.OVERDUE ? 'overdue' : ''}\">до ${dueLabel}</div>`;",
    "if (dueLabel && !closed) dueHtml = `<div class=\"note-due ${isOverdue(dueState) ? 'overdue' : ''}\">до ${dueLabel}</div>`;"
  ],
  [
    'const overdue = open.filter(n => n.dueAt && n.dueAt < now);',
    'const overdue = open.filter(n => isOverdue(DueStateCalculator.of(n, now)));'
  ],
  [
    "const stateColor = state === 'OVERDUE' ? 'var(--overdue)' : state === 'DUE_TODAY' ? 'var(--due)' : 'var(--muted)';",
    "const stateColor = isOverdue(state) ? 'var(--overdue)' : state === 'DUE_TODAY' ? 'var(--due)' : 'var(--muted)';"
  ],
  [
    'dueConfidence: due ? 0.9 : 0,',
    'dueConfidence: due ? due.confidence : 0,'
  ]
];

for (const [from, to] of replacements) {
  if (!src.includes(from)) throw new Error(`replacement not found: ${from.slice(0, 60)}`);
  src = src.replace(from, to);
}

await writeFile(path, src, 'utf8');
console.log(`refactored: ${src.length} bytes`);
