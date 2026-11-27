import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const wwwDir = join(root, 'www');
const indexSource = readFileSync(join(wwwDir, 'index.html'), 'utf8');
const swSource = readFileSync(join(wwwDir, 'sw.js'), 'utf8');

test('index.html: sheet-bar elements exist', () => {
  assert.match(indexSource, /id="sheetBar"/, 'missing #sheetBar');
  assert.match(indexSource, /id="sheetDots"/, 'missing #sheetDots');
  assert.match(indexSource, /id="sheetPrev"/, 'missing #sheetPrev');
  assert.match(indexSource, /id="sheetNext"/, 'missing #sheetNext');
  assert.match(indexSource, /id="sheetTitle"/, 'missing #sheetTitle');
});

test('index.html: nav with correct aria-label', () => {
  assert.match(indexSource, /aria-label="Листы"/, 'missing aria-label on sheet bar');
});

test('index.html: imports sheets.js', () => {
  assert.match(indexSource, /import.*sheets\.js/, 'missing import of sheets.js');
});

test('index.html: footer has v0.4, no test count', () => {
  assert.match(indexSource, /v0\.4/, 'footer/app version not v0.4');
  assert.match(indexSource, /id="footer">Живой блокнот · v0\.4</, 'footer content mismatch');
  // test count removed from footer
  assert.ok(!indexSource.includes('362 теста'), 'footer still contains test count');
});

test('sw.js: cache version v4, includes sheets.js', () => {
  assert.match(swSource, /'v4'/, 'SW cache not v4');
  assert.match(swSource, /sheets\.js/, 'SW ASSETS missing sheets.js');
});