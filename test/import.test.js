import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateImport, planImport, computeMetaFromEvidence } from '../www/js/import.js';

function makeNote(id, overrides = {}) {
  return {
    id,
    text: 'заметка ' + id,
    createdAt: 1_700_000_000_000,
    completedAt: null,
    reopenedAt: null,
    dueAt: null,
    deletedAt: null,
    branch: 'rabota',
    branchSource: 'SEED',
    branchConfidence: 0.8,
    correctionCount: 0,
    schemaVersion: 3,
    ...overrides
  };
}

function ev(stem, branch, evidence, distinctNotes, lastSeenAt = 0) {
  return { stem, branch, evidence, distinctNotes, lastSeenAt };
}

function meta(stem, state, distinctNotes, userCurated = false) {
  return { stem, state, distinctNotes, userCurated };
}

function emptyCurrent() {
  return { notes: [], evidence: [], meta: [], logs: [] };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

// ── Валидация ────────────────────────────────────────────────────────────────

test('validateImport: null отклоняется', () => {
  const result = validateImport(null);
  assert.ok(result.errors.length > 0);
  assert.equal(result.counts.notes, 0);
});

test('validateImport: строка отклоняется', () => {
  const result = validateImport('{"notes":[]}');
  assert.ok(result.errors.length > 0);
});

test('validateImport: массив отклоняется', () => {
  const result = validateImport([]);
  assert.ok(result.errors.length > 0);
});

test('validateImport: пустой объект без известных секций отклоняется', () => {
  const result = validateImport({});
  assert.ok(result.errors.some(e => e.includes('секци')));
});

test('validateImport: секция не массив отклоняется', () => {
  const result = validateImport({ notes: 'x' });
  assert.ok(result.errors.some(e => e.includes('массив')));
});

test('validateImport: заметка без id отклоняется', () => {
  const note = makeNote('a');
  delete note.id;
  const result = validateImport({ notes: [note] });
  assert.ok(result.errors.some(e => e.includes('id')));
});

test('validateImport: дубль id отклоняется', () => {
  const result = validateImport({ notes: [makeNote('a'), makeNote('a', { text: 'другая' })] });
  assert.ok(result.errors.some(e => e.includes('дубль id')));
});

test('validateImport: id не строка отклоняется', () => {
  const result = validateImport({ notes: [makeNote(42)] });
  assert.ok(result.errors.some(e => e.includes('id')));
});

test('validateImport: пустой text отклоняется', () => {
  const result = validateImport({ notes: [makeNote('a', { text: '   ' })] });
  assert.ok(result.errors.some(e => e.includes('text')));
});

test('validateImport: createdAt не число отклоняется', () => {
  const result = validateImport({ notes: [makeNote('a', { createdAt: 'abc' })] });
  assert.ok(result.errors.some(e => e.includes('createdAt')));
});

test('validateImport: отсутствующий createdAt отклоняется', () => {
  const note = makeNote('a');
  delete note.createdAt;
  const result = validateImport({ notes: [note] });
  assert.ok(result.errors.some(e => e.includes('createdAt')));
});

test('validateImport: completedAt строкой отклоняется', () => {
  const result = validateImport({ notes: [makeNote('a', { completedAt: 'x' })] });
  assert.ok(result.errors.some(e => e.includes('completedAt')));
});

test('validateImport: completedAt null допустим', () => {
  const result = validateImport({ notes: [makeNote('a', { completedAt: null })] });
  assert.deepEqual(result.errors, []);
});

test('validateImport: branchConfidence строкой отклоняется (F1)', () => {
  const result = validateImport({ notes: [makeNote('a', { branchConfidence: '0.9' })] });
  assert.ok(result.errors.some(e => e.includes('branchConfidence')));
});

test('validateImport: evidence без branch отклоняется', () => {
  const result = validateImport({ word_evidence: [{ stem: 's', evidence: 1, distinctNotes: 1 }] });
  assert.ok(result.errors.some(e => e.includes('branch')));
});

test('validateImport: evidence branch null отклоняется', () => {
  const result = validateImport({ word_evidence: [{ stem: 's', branch: null, evidence: 1, distinctNotes: 1 }] });
  assert.ok(result.errors.some(e => e.includes('branch')));
});

test('validateImport: branch "" валиден и не даёт warning про branch', () => {
  const result = validateImport({ word_evidence: [ev('s', '', 1, 1)] });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.every(w => !w.includes('branch')));
});

test('validateImport: word_evidence не массив отклоняется', () => {
  const result = validateImport({ word_evidence: {} });
  assert.ok(result.errors.some(e => e.includes('массив')));
});

test('validateImport: word_meta без stem отклоняется', () => {
  const result = validateImport({ word_meta: [{ state: 'CANDIDATE' }] });
  assert.ok(result.errors.some(e => e.includes('stem')));
});

test('validateImport: training_log с плохим id отклоняется', () => {
  const result = validateImport({ training_log: [{ id: -1 }] });
  assert.ok(result.errors.some(e => e.includes('id')));
});

test('validateImport: training_log с плохими ts/type — warning, не error', () => {
  const result = validateImport({ training_log: [{ id: 1, ts: 'x', type: 5 }] });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(w => w.includes('ts')));
  assert.ok(result.warnings.some(w => w.includes('type')));
});

test('validateImport: training_log с корректными ts/type не даёт warning', () => {
  const result = validateImport({ training_log: [{ id: 1, ts: 1, type: 'CREATE' }] });
  assert.deepEqual(result.errors, []);
  assert.ok(!result.warnings.some(w => w.includes('ts')));
  assert.ok(!result.warnings.some(w => w.includes('type')));
});

test('validateImport: word_meta userCurated не boolean — warning', () => {
  const result = validateImport({ word_meta: [{ stem: 's', userCurated: 'false' }] });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(w => w.includes('userCurated')));
});

test('validateImport: word_meta userCurated boolean не даёт warning', () => {
  const result = validateImport({ word_meta: [{ stem: 's', userCurated: false }] });
  assert.deepEqual(result.errors, []);
  assert.ok(!result.warnings.some(w => w.includes('userCurated')));
});

test('validateImport: logs и training_log вместе — training_log выигрывает с явным warning', () => {
  const result = validateImport({
    notes: [],
    logs: [{ ts: 1, type: 'CREATE' }],
    training_log: [{ ts: 2, type: 'COMPLETE' }]
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.content.training_log.length, 1);
  assert.equal(result.content.training_log[0].type, 'COMPLETE');
  assert.ok(result.warnings.some(w => w.includes('logs отброшен: используется training_log')));
});

test('validateImport: полный корректный файл принимается', () => {
  const result = validateImport({
    version: 'alpha-v0.3',
    schemaVersion: 3,
    notes: [makeNote('a')],
    word_evidence: [ev('s', 'rabota', 1, 1)],
    word_meta: [meta('s', 'CANDIDATE', 1)],
    training_log: [{ id: 1, type: 'CREATE', ts: 1 }]
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.counts, { notes: 1, word_evidence: 1, word_meta: 1, training_log: 1 });
});

test('validateImport: частичный файл только с notes даёт warning', () => {
  const result = validateImport({ notes: [makeNote('a')] });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(w => w.includes('частичный')));
});

test('validateImport: schemaVersion 2 даёт warning', () => {
  const result = validateImport({ schemaVersion: 2, notes: [] });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(w => w.includes('schemaVersion')));
});

test('validateImport: version не текущая даёт warning', () => {
  const result = validateImport({ version: 'alpha-v0.2', notes: [] });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(w => w.includes('version')));
});

test('validateImport: tuning даёт warning «не применяется»', () => {
  const result = validateImport({ tuning: { CONFIRMED_MIN_EVIDENCE: 99 }, notes: [] });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(w => w.includes('tuning')));
});

test('validateImport: logs — алиас training_log', () => {
  const result = validateImport({ notes: [], logs: [{ ts: 1, type: 'CREATE' }] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.content.training_log.length, 1);
  assert.equal(result.counts.training_log, 1);
  assert.ok(result.warnings.some(w => w.includes('logs')));
});

test('validateImport: новый формат {data:{...}} принимается', () => {
  const result = validateImport({
    data: {
      notes: [makeNote('a')],
      word_evidence: [],
      word_meta: [],
      training_log: []
    }
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.content.notes.length, 1);
  assert.equal(result.counts.notes, 1);
});

test('validateImport: неизвестный branch и branchSource — warning, не error', () => {
  const result = validateImport({ notes: [makeNote('a', { branch: 'magic', branchSource: 'MAGIC' })] });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(w => w.includes('branch')));
  assert.ok(result.warnings.some(w => w.includes('branchSource')));
});

test('validateImport: дубли (stem,branch) и stem — warning', () => {
  const result = validateImport({
    word_evidence: [ev('s', 'rabota', 1, 1), ev('s', 'rabota', 2, 2)],
    word_meta: [meta('s', 'CANDIDATE', 1), meta('s', 'CONFIRMED', 2)]
  });
  assert.deepEqual(result.errors, []);
  assert.ok(result.warnings.some(w => w.includes('дубли (stem, branch)')));
  assert.ok(result.warnings.some(w => w.includes('дубли stem')));
});

test('validateImport: пустые массивы валидны', () => {
  const result = validateImport({ notes: [] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.counts.notes, 0);
});

// ── Слияние: заметки ────────────────────────────────────────────────────────

test('planImport: upsert заметок по id, чужие заметки остаются', () => {
  const current = {
    notes: [makeNote('a', { text: 'старая' }), makeNote('c', { text: 'остаётся' })],
    evidence: [], meta: [], logs: []
  };
  const incoming = {
    notes: [makeNote('a', { text: 'новая' }), makeNote('b')]
  };
  const plan = planImport(current, incoming);
  assert.equal(plan.stats.notesAdded, 1);
  assert.equal(plan.stats.notesUpdated, 1);
  assert.equal(plan.notes.length, 3);
  assert.equal(plan.notes.find(n => n.id === 'a').text, 'новая');
  assert.equal(plan.notes.find(n => n.id === 'c').text, 'остаётся');
  assert.ok(plan.notes.find(n => n.id === 'b'));
});

test('planImport: повторный импорт заметок идемпотентен', () => {
  const incoming = { notes: [makeNote('a'), makeNote('b')] };
  const first = planImport(emptyCurrent(), incoming);
  const second = planImport(
    { notes: first.notes, evidence: first.evidence, meta: first.meta, logs: first.logs },
    incoming
  );
  assert.equal(second.stats.notesAdded, 0);
  assert.equal(second.stats.notesUpdated, 0);
  assert.deepEqual(second.notes, first.notes);
});

// ── Слияние: evidence ───────────────────────────────────────────────────────

test('planImport: evidence берётся max (текущее больше)', () => {
  const plan = planImport(
    { notes: [], evidence: [ev('s', 'rabota', 5, 3, 100)], meta: [], logs: [] },
    { evidence: [ev('s', 'rabota', 1, 1, 50)] }
  );
  const row = plan.evidence.find(r => r.stem === 's' && r.branch === 'rabota');
  assert.equal(row.evidence, 5);
  assert.equal(row.distinctNotes, 3);
  assert.equal(row.lastSeenAt, 100);
  assert.equal(plan.stats.evidenceUnchanged, 1);
});

test('planImport: evidence берётся max (импорт больше)', () => {
  const plan = planImport(
    { notes: [], evidence: [ev('s', 'rabota', 1, 1, 10)], meta: [], logs: [] },
    { evidence: [ev('s', 'rabota', 4, 2, 200)] }
  );
  const row = plan.evidence.find(r => r.stem === 's' && r.branch === 'rabota');
  assert.equal(row.evidence, 4);
  assert.equal(row.distinctNotes, 2);
  assert.equal(row.lastSeenAt, 200);
  assert.equal(plan.stats.evidenceUpdated, 1);
});

test('planImport: lastSeenAt берётся максимальный', () => {
  const plan = planImport(
    { notes: [], evidence: [ev('s', 'rabota', 5, 3, 999)], meta: [], logs: [] },
    { evidence: [ev('s', 'rabota', 5, 3, 123)] }
  );
  assert.equal(plan.evidence[0].lastSeenAt, 999);
});

test('planImport: строки только в импорте добавляются, только в текущей остаются', () => {
  const plan = planImport(
    { notes: [], evidence: [ev('a', 'rabota', 2, 1)], meta: [], logs: [] },
    { evidence: [ev('b', 'byt', 3, 1)] }
  );
  assert.equal(plan.evidence.length, 2);
  assert.equal(plan.stats.evidenceAdded, 1);
  assert.ok(plan.evidence.find(r => r.stem === 'a'));
  assert.ok(plan.evidence.find(r => r.stem === 'b'));
});

test('planImport: branch "" сливается как обычный ключ', () => {
  const plan = planImport(
    { notes: [], evidence: [ev('s', '', 2, 1)], meta: [], logs: [] },
    { evidence: [ev('s', '', 3, 1), ev('s', 'rabota', 1, 1)] }
  );
  const empty = plan.evidence.find(r => r.stem === 's' && r.branch === '');
  const rabota = plan.evidence.find(r => r.stem === 's' && r.branch === 'rabota');
  assert.equal(empty.evidence, 3);
  assert.equal(rabota.evidence, 1);
  assert.equal(plan.evidence.length, 2);
});

test('planImport: отсутствующие счётчики считаются нулём', () => {
  const plan = planImport(
    { notes: [], evidence: [{ stem: 's', branch: 'rabota' }], meta: [], logs: [] },
    { evidence: [{ stem: 's', branch: 'rabota', evidence: 2 }] }
  );
  const row = plan.evidence[0];
  assert.equal(row.evidence, 2);
  assert.equal(row.distinctNotes, 0);
  assert.equal(row.lastSeenAt, 0);
});

// ── Слияние: meta и состояние ───────────────────────────────────────────────

test('planImport: userCurated по ИЛИ (текущее true)', () => {
  const plan = planImport(
    { notes: [], evidence: [], meta: [meta('s', 'CANDIDATE', 0, true)], logs: [] },
    { evidence: [ev('s', 'rabota', 1, 1)], meta: [meta('s', 'CANDIDATE', 0, false)] }
  );
  assert.equal(plan.meta.find(m => m.stem === 's').userCurated, true);
});

test('planImport: userCurated по ИЛИ (импорт true)', () => {
  const plan = planImport(
    { notes: [], evidence: [], meta: [meta('s', 'CANDIDATE', 0, false)], logs: [] },
    { evidence: [ev('s', 'rabota', 1, 1)], meta: [meta('s', 'CANDIDATE', 0, true)] }
  );
  assert.equal(plan.meta.find(m => m.stem === 's').userCurated, true);
});

test('planImport: импортированный CONFIRMED при слабом evidence не берётся на веру', () => {
  const plan = planImport(emptyCurrent(), {
    evidence: [ev('s', 'rabota', 1, 1)],
    meta: [meta('s', 'CONFIRMED', 9, false)]
  });
  const row = plan.meta.find(m => m.stem === 's');
  assert.notEqual(row.state, 'CONFIRMED');
  assert.equal(row.state, 'CANDIDATE');
  assert.equal(row.distinctNotes, 1);
});

test('planImport: рост конкурирующей ветки понижает state и пишет stateChanges', () => {
  const current = {
    notes: [],
    evidence: [ev('s', 'rabota', 5, 3), ev('s', 'byt', 1, 1)],
    meta: [meta('s', 'CONFIRMED', 3, false)],
    logs: []
  };
  const incoming = { evidence: [ev('s', 'byt', 4, 3)] };
  const plan = planImport(current, incoming);
  const row = plan.meta.find(m => m.stem === 's');
  assert.equal(row.state, 'PROVISIONAL');
  assert.deepEqual(plan.stats.stateChanges, [{ stem: 's', from: 'CONFIRMED', to: 'PROVISIONAL' }]);
});

test('planImport: meta без evidence сохраняется как CANDIDATE', () => {
  const plan = planImport(emptyCurrent(), {
    meta: [{ stem: 'x', state: 'CONFIRMED', distinctNotes: 9, userCurated: true }]
  });
  const row = plan.meta.find(m => m.stem === 'x');
  assert.ok(row);
  assert.equal(row.state, 'CANDIDATE');
  assert.equal(row.distinctNotes, 0);
  assert.equal(row.userCurated, true);
});

test('planImport: userCurated строкой "false" не становится true', () => {
  const plan = planImport(emptyCurrent(), {
    evidence: [ev('s', 'rabota', 1, 1)],
    meta: [{ stem: 's', state: 'CANDIDATE', distinctNotes: 0, userCurated: 'false' }]
  });
  assert.equal(plan.meta.find(m => m.stem === 's').userCurated, false);
});

test('planImport: metaRecomputed считает все строки meta', () => {
  const plan = planImport(
    { notes: [], evidence: [ev('a', 'rabota', 1, 1)], meta: [meta('b', 'CANDIDATE', 0)], logs: [] },
    { evidence: [ev('c', 'byt', 1, 1)] }
  );
  assert.equal(plan.stats.metaRecomputed, 3);
});

// ── Слияние: журнал ─────────────────────────────────────────────────────────

test('planImport: логи дедуплицируются по eventId', () => {
  const current = { notes: [], evidence: [], meta: [], logs: [{ id: 1, eventId: 'e1', type: 'CREATE', ts: 1 }] };
  const plan = planImport(current, { logs: [{ id: 1, eventId: 'e1', type: 'CREATE', ts: 1 }] });
  assert.equal(plan.stats.logsAdded, 0);
  assert.equal(plan.logs.length, 1);
});

test('planImport: без eventId логи дедуплицируются по id', () => {
  const current = { notes: [], evidence: [], meta: [], logs: [{ id: 1, type: 'CREATE', ts: 1 }] };
  const plan = planImport(current, { logs: [{ id: 1, type: 'COMPLETE', ts: 2 }] });
  assert.equal(plan.stats.logsAdded, 0);
  assert.equal(plan.logs.length, 1);
});

test('planImport: конфликт id при новом eventId — id снимается', () => {
  const current = { notes: [], evidence: [], meta: [], logs: [{ id: 1, eventId: 'e1', type: 'CREATE', ts: 1 }] };
  const plan = planImport(current, { logs: [{ id: 1, eventId: 'e2', type: 'COMPLETE', ts: 2 }] });
  assert.equal(plan.stats.logsAdded, 1);
  const added = plan.logs.find(l => l.eventId === 'e2');
  assert.ok(added);
  assert.equal('id' in added, false);
});

test('planImport: исходный id лога сохраняется, если целый >= 0', () => {
  const plan = planImport(emptyCurrent(), { logs: [{ id: 5, eventId: 'e5', type: 'CREATE', ts: 1 }] });
  assert.equal(plan.logs[0].id, 5);
  assert.equal(plan.stats.logsAdded, 1);
});

test('planImport: id 0 допустим и сохраняется', () => {
  const plan = planImport(emptyCurrent(), { logs: [{ id: 0, eventId: 'e0', type: 'CREATE', ts: 1 }] });
  assert.equal(plan.logs[0].id, 0);
});

test('planImport: лог без id добавляется через autoIncrement', () => {
  const plan = planImport(emptyCurrent(), { logs: [{ type: 'IMPORT', ts: 1 }] });
  assert.equal(plan.logs.length, 1);
  assert.equal('id' in plan.logs[0], false);
});

// ── Граничные случаи и чистота ──────────────────────────────────────────────

test('planImport: пустые входы дают пустой план', () => {
  const plan = planImport(emptyCurrent(), {});
  assert.deepEqual(plan.notes, []);
  assert.deepEqual(plan.evidence, []);
  assert.deepEqual(plan.meta, []);
  assert.deepEqual(plan.logs, []);
  assert.equal(plan.stats.notesAdded, 0);
  assert.equal(plan.stats.evidenceAdded, 0);
  assert.equal(plan.stats.logsAdded, 0);
  assert.equal(plan.stats.metaRecomputed, 0);
  assert.deepEqual(plan.stats.stateChanges, []);
});

test('planImport: не мутирует входные объекты', () => {
  const current = { notes: [makeNote('a')], evidence: [ev('s', 'rabota', 1, 1)], meta: [], logs: [] };
  const incoming = { notes: [makeNote('b')], evidence: [ev('s', 'rabota', 2, 2)], meta: [], logs: [] };
  const currentBefore = clone(current);
  const incomingBefore = clone(incoming);
  planImport(current, incoming);
  assert.deepEqual(current, currentBefore);
  assert.deepEqual(incoming, incomingBefore);
});

test('planImport: legacyEvidence считает слитые строки', () => {
  const plan = planImport(emptyCurrent(), {
    evidence: [ev('a', 'rabota', 1, 1), ev('b', 'byt', 2, 1)]
  });
  assert.equal(plan.stats.legacyEvidence, 2);
});

test('planImport: повторный импорт обучения идемпотентен', () => {
  const incoming = { evidence: [ev('s', 'rabota', 4, 2, 50)], meta: [meta('s', 'CONFIRMED', 2)] };
  const first = planImport(emptyCurrent(), incoming);
  const second = planImport(
    { notes: first.notes, evidence: first.evidence, meta: first.meta, logs: first.logs },
    incoming
  );
  assert.equal(second.stats.evidenceAdded, 0);
  assert.equal(second.stats.evidenceUpdated, 0);
  assert.deepEqual(second.evidence, first.evidence);
  assert.deepEqual(second.meta, first.meta);
});

test('planImport: полный повторный импорт (заметки, обучение, логи) идемпотентен', () => {
  const incoming = {
    notes: [makeNote('a')],
    evidence: [ev('s', 'rabota', 2, 2)],
    meta: [meta('s', 'PROVISIONAL', 2)],
    logs: [{ id: 3, eventId: 'e3', type: 'CREATE', ts: 3 }]
  };
  const first = planImport(emptyCurrent(), incoming);
  const second = planImport(
    { notes: first.notes, evidence: first.evidence, meta: first.meta, logs: first.logs },
    incoming
  );
  assert.equal(second.stats.notesAdded, 0);
  assert.equal(second.stats.notesUpdated, 0);
  assert.equal(second.stats.evidenceAdded, 0);
  assert.equal(second.stats.evidenceUpdated, 0);
  assert.equal(second.stats.logsAdded, 0);
  assert.deepEqual(second.notes, first.notes);
  assert.deepEqual(second.evidence, first.evidence);
  assert.deepEqual(second.meta, first.meta);
  assert.deepEqual(second.logs, first.logs);
});

// ── computeMetaFromEvidence ─────────────────────────────────────────────────

test('computeMetaFromEvidence: CONFIRMED по порогам', () => {
  const rows = computeMetaFromEvidence([
    ev('s', 'rabota', 5, 3),
    ev('s', 'byt', 1, 1)
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, 'CONFIRMED');
  assert.equal(rows[0].distinctNotes, 3);
});

test('computeMetaFromEvidence: PROVISIONAL по distinctNotes', () => {
  const rows = computeMetaFromEvidence([ev('s', 'rabota', 2, 2)]);
  assert.equal(rows[0].state, 'PROVISIONAL');
});

test('computeMetaFromEvidence: сирота без evidence — CANDIDATE', () => {
  const rows = computeMetaFromEvidence([], [{ stem: 'x', state: 'CONFIRMED', distinctNotes: 9, userCurated: true }]);
  assert.equal(rows[0].state, 'CANDIDATE');
  assert.equal(rows[0].distinctNotes, 0);
  assert.equal(rows[0].userCurated, true);
});

test('computeMetaFromEvidence: совпадает с порогами WordLearningService.recomputeMeta', () => {
  const rows = computeMetaFromEvidence([ev('s', 'rabota', 5, 3), ev('s', 'byt', 2, 2)]);
  // total 7, best 5, ratio 5/7 ≈ 0.714 >= 0.7, evidence 5 >= 5, distinct 3 >= 3
  assert.equal(rows[0].state, 'CONFIRMED');
});

test('computeMetaFromEvidence: tie-break по branch как getAll()+">" (порядок byt, rabota)', () => {
  const rows = computeMetaFromEvidence([ev('s', 'byt', 5, 1), ev('s', 'rabota', 5, 3)]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].state, 'PROVISIONAL');
  assert.equal(rows[0].distinctNotes, 3);
});

test('computeMetaFromEvidence: tie-break не зависит от порядка входа (rabota, byt)', () => {
  const rows = computeMetaFromEvidence([ev('s', 'rabota', 5, 3), ev('s', 'byt', 5, 1)]);
  assert.equal(rows[0].state, 'PROVISIONAL');
  assert.equal(rows[0].distinctNotes, 3);
});

// ── noteIds ──────────────────────────────────────────────────────────────────

test('validateImport: noteIds массив строк принимается', () => {
  const result = validateImport({
    word_evidence: [{ stem: 's', branch: 'rabota', evidence: 1, distinctNotes: 1, noteIds: ['a', 'b'] }]
  });
  assert.deepEqual(result.errors, []);
});

test('validateImport: noteIds не массив отклоняется', () => {
  const result = validateImport({
    word_evidence: [{ stem: 's', branch: 'rabota', evidence: 1, distinctNotes: 1, noteIds: 'abc' }]
  });
  assert.ok(result.errors.some(e => e.includes('noteIds')));
});

test('planImport: noteIds объединяются с дедупликацией', () => {
  const plan = planImport(
    { notes: [], evidence: [{ stem: 's', branch: 'rabota', evidence: 2, distinctNotes: 2, noteIds: ['a', 'b'], lastSeenAt: 100 }], meta: [], logs: [] },
    { evidence: [{ stem: 's', branch: 'rabota', evidence: 1, distinctNotes: 1, noteIds: ['b', 'c'], lastSeenAt: 50 }] }
  );
  const row = plan.evidence.find(r => r.stem === 's' && r.branch === 'rabota');
  assert.deepEqual(row.noteIds.sort(), ['a', 'b', 'c']);
  assert.equal(row.distinctNotes, 2); // max
  assert.equal(row.evidence, 2); // max
});

test('planImport: noteIds в новой записи создаётся', () => {
  const plan = planImport(
    { notes: [], evidence: [], meta: [], logs: [] },
    { evidence: [{ stem: 's', branch: 'rabota', evidence: 1, distinctNotes: 1, noteIds: ['a'], lastSeenAt: 100 }] }
  );
  const row = plan.evidence[0];
  assert.deepEqual(row.noteIds, ['a']);
});

test('planImport: noteIds в существующей записи без noteIds — устанавливается', () => {
  const plan = planImport(
    { notes: [], evidence: [ev('s', 'rabota', 2, 2, 100)], meta: [], logs: [] },
    { evidence: [{ stem: 's', branch: 'rabota', evidence: 1, distinctNotes: 1, noteIds: ['x'], lastSeenAt: 50 }] }
  );
  const row = plan.evidence.find(r => r.stem === 's' && r.branch === 'rabota');
  assert.deepEqual(row.noteIds, ['x']);
});

test('planImport: noteIds без incoming noteIds — не создаётся', () => {
  const plan = planImport(
    { notes: [], evidence: [], meta: [], logs: [] },
    { evidence: [{ stem: 's', branch: 'rabota', evidence: 1, distinctNotes: 1, lastSeenAt: 100 }] }
  );
  const row = plan.evidence[0];
  assert.equal(row.noteIds, undefined);
});

test('computeMetaFromEvidence: noteIds используется для distinctNotes', () => {
  const rows = computeMetaFromEvidence([
    { stem: 's', branch: 'rabota', evidence: 5, distinctNotes: 3, noteIds: ['a', 'b', 'c', 'd'] }
  ]);
  assert.equal(rows[0].distinctNotes, 4);
});

test('computeMetaFromEvidence: без noteIds distinctNotes берётся из поля', () => {
  const rows = computeMetaFromEvidence([ev('s', 'rabota', 5, 3)]);
  assert.equal(rows[0].distinctNotes, 3);
});
