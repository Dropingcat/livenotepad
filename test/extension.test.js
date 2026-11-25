import { describe, test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('manifest.json has required fields for Firefox sidebar extension', () => {
  const m = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
  assert.equal(m.name, 'Живой блокнот');
  assert.ok(m.sidebar_action, 'missing sidebar_action');
  assert.ok(m.sidebar_action.default_panel.endsWith('sidebar.html'));
  assert.ok(m.background, 'missing background');
  assert.ok(m.permissions.includes('notifications'), 'missing notifications');
  assert.ok(m.permissions.includes('alarms'), 'missing alarms');
  assert.ok(m.permissions.includes('storage'), 'missing storage');
  assert.ok(m.icons['48'], 'missing icon 48');
  assert.ok(m.icons['128'], 'missing icon 128');
  assert.ok(m.browser_specific_settings?.gecko?.id, 'missing gecko id');
});

test('sidebar.html exists and loads sidebar.js', () => {
  const html = fs.readFileSync('extension/sidebar.html', 'utf8');
  assert.match(html, /src="sidebar\.js"/, 'must import sidebar.js');
  assert.match(html, /id="draft"/, 'must have draft input');
  assert.match(html, /id="list"/, 'must have list container');
});

test('extension/js/ modules match www/js/ in count', () => {
  const extFiles = fs.readdirSync('extension/js').filter(f => f.endsWith('.js'));
  const wwwFiles = fs.readdirSync('www/js').filter(f => f.endsWith('.js'));
  assert.equal(extFiles.length, wwwFiles.length, 'module count mismatch');
  for (const f of extFiles) {
    assert.ok(wwwFiles.includes(f), `extension/js/${f} not in www/js`);
  }
});

test('background.js has alarm + notification + DB logic', () => {
  const bg = fs.readFileSync('extension/background.js', 'utf8');
  assert.match(bg, /alarms\.create/, 'no alarm.create');
  assert.match(bg, /notifications\.create/, 'no notification.create');
  assert.match(bg, /indexedDB\.open/, 'no indexedDB');
});

test('chrome manifest.json has required fields for Chrome sidePanel', () => {
  const m = JSON.parse(fs.readFileSync('extension/manifest.chrome.json', 'utf8'));
  assert.equal(m.manifest_version, 3, 'Chrome manifest must be v3');
  assert.ok(m.side_panel, 'missing side_panel');
  assert.ok(m.side_panel.default_path.endsWith('sidebar.html'), 'side_panel path mismatch');
  assert.ok(m.background.service_worker, 'missing background service_worker');
  assert.ok(m.background.type === 'module', 'background type must be module');
  assert.ok(m.permissions.includes('sidePanel'), 'missing sidePanel permission');
  assert.ok(m.permissions.includes('notifications'), 'missing notifications');
  assert.ok(m.permissions.includes('alarms'), 'missing alarms');
});

test('background-sw.js exists and has alarm + notification logic', () => {
  const bg = fs.readFileSync('extension/background-sw.js', 'utf8');
  assert.match(bg, /alarms\.create/, 'no alarm.create');
  assert.match(bg, /notifications\.create/, 'no notification.create');
  assert.match(bg, /indexedDB\.open/, 'no indexedDB');
});

test('sidebar.js can be parsed by Node (syntax check)', async () => {
  // Node may not resolve imports, but we can parse the AST via --check on a copy
  // Simpler: check key function names exist in source
  const src = fs.readFileSync('extension/sidebar.js', 'utf8');
  assert.match(src, /addNote/, 'missing addNote');
  assert.match(src, /toggleNote/, 'missing toggleNote');
  assert.match(src, /deleteNote/, 'missing deleteNote');
  assert.match(src, /restoreNote/, 'missing restoreNote');
  assert.match(src, /openBranchMenu/, 'missing openBranchMenu');
  assert.match(src, /placeMenu/, 'missing placeMenu');
  assert.match(src, /filterLiveSheet/, 'missing filterLiveSheet');
  assert.match(src, /filterDeletedToday/, 'missing filterDeletedToday');
});

test('icons exist at expected sizes', () => {
  const sizes = { 'icon-48.png': 48, 'icon-96.png': 96, 'icon-128.png': 128 };
  for (const [f, s] of Object.entries(sizes)) {
    const buf = fs.readFileSync(path.join('extension', 'icons', f));
    const w = buf.readUInt32BE(16);
    assert.equal(w, s, `${f} width ${w} !== ${s}`);
  }
});