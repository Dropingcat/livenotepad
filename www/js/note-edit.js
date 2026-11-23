import { DueParser } from './due-parser.js';

// Правка текста меняет только текст и срок.
// Ветка, её источник и уверенность остаются прежними — правит человек, не классификатор.
export function applyTextEdit(note, text, now = Date.now()) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed || trimmed === note.text) return null;
  const due = DueParser.parse(trimmed, now);
  return {
    ...note,
    text: trimmed,
    dueAt: due ? due.dueAt : null,
    dueSource: due ? due.source : 'NONE',
    dueConfidence: due ? due.confidence : 0,
    editedAt: now
  };
}
