import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const wwwDir = join(root, 'www');
const iconsDir = join(wwwDir, 'icons');
const jsDir = join(wwwDir, 'js');

const manifest = JSON.parse(readFileSync(join(wwwDir, 'manifest.webmanifest'), 'utf8'));
const swSource = readFileSync(join(wwwDir, 'sw.js'), 'utf8');
const indexSource = readFileSync(join(wwwDir, 'index.html'), 'utf8');

const SW_ICONS = ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png'];

function pngSize(file) {
  const bytes = readFileSync(file);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  assert.deepEqual([...bytes.subarray(0, 8)], signature, `${file}: не PNG (битая сигнатура)`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function swAssets() {
  const block = swSource.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(block, 'sw.js: блок ASSETS не найден');
  return [...block[1].matchAll(/'([^']*)'/g)].map(m => m[1]);
}

test('manifest: обязательные поля и значения', () => {
  assert.equal(manifest.name, 'Живой блокнот');
  assert.equal(manifest.short_name, 'Блокнот');
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'portrait');
  assert.equal(manifest.lang, 'ru');
  assert.match(manifest.background_color, /^#[0-9a-f]{6}$/i);
  assert.match(manifest.theme_color, /^#[0-9a-f]{6}$/i);
});

test('manifest: иконки 192 any, 512 any, 512 maskable', () => {
  const icons = manifest.icons;
  assert.ok(Array.isArray(icons), 'manifest.icons должен быть массивом');
  const pick = (sizes, purpose) => icons.find(i => i.sizes === sizes && i.purpose === purpose);
  const small = pick('192x192', 'any');
  const large = pick('512x512', 'any');
  const maskable = pick('512x512', 'maskable');
  assert.ok(small, 'нет иконки 192x192 purpose=any');
  assert.ok(large, 'нет иконки 512x512 purpose=any');
  assert.ok(maskable, 'нет иконки 512x512 purpose=maskable');
  for (const icon of icons) {
    assert.equal(icon.type, 'image/png');
    assert.ok(icon.src.startsWith('./icons/'), `иконка должна быть относительной: ${icon.src}`);
  }
});

test('иконки: файлы существуют, PNG-размеры совпадают с заявленными', () => {
  for (const icon of manifest.icons) {
    const file = join(wwwDir, icon.src);
    const [w, h] = icon.sizes.split('x').map(Number);
    const actual = pngSize(file);
    assert.equal(actual.width, w, `${icon.src}: ширина ${actual.width} != ${w}`);
    assert.equal(actual.height, h, `${icon.src}: высота ${actual.height} != ${h}`);
  }
  const apple = pngSize(join(iconsDir, 'apple-touch-icon.png'));
  assert.equal(apple.width, 180);
  assert.equal(apple.height, 180);
});

test('sw.js: versioned cache, install/activate/fetch, skipWaiting и clients.claim', () => {
  assert.match(swSource, /const CACHE_PREFIX = 'livenotepad-';/, 'нет CACHE_PREFIX');
  assert.match(swSource, /const CACHE = CACHE_PREFIX \+ 'v1';/, 'нет CACHE от префикса');
  assert.match(swSource, /addEventListener\('install'/, 'нет обработчика install');
  assert.match(swSource, /addEventListener\('activate'/, 'нет обработчика activate');
  assert.match(swSource, /addEventListener\('fetch'/, 'нет обработчика fetch');
  assert.match(swSource, /cache\.addAll\(ASSETS\)/, 'install не кэширует ASSETS');
  assert.match(swSource, /self\.skipWaiting\(\)/, 'нет skipWaiting');
  assert.match(swSource, /self\.clients\.claim\(\)/, 'нет clients.claim');
  assert.match(swSource, /caches\.delete\(/, 'activate не удаляет старые кэши');
  assert.match(swSource, /key\.startsWith\(CACHE_PREFIX\)/, 'activate не ограничен префиксом');
  assert.doesNotMatch(swSource, /keys\.filter\(key => key !== CACHE\)/, 'activate удаляет чужие кэши origin');
});

test('sw.js: ASSETS покрывает app shell и все js-модули, без абсолютных путей', () => {
  const assets = swAssets();
  assert.ok(assets.includes('./'), 'ASSETS без "./"');
  assert.ok(assets.includes('./index.html'), 'ASSETS без ./index.html');
  assert.ok(assets.includes('./manifest.webmanifest'), 'ASSETS без manifest');

  const jsFiles = readdirSync(jsDir).filter(name => name.endsWith('.js'));
  assert.ok(jsFiles.length > 0, 'www/js пуст');
  for (const name of jsFiles) {
    assert.ok(assets.includes(`./js/${name}`), `ASSETS без ./js/${name}`);
  }

  for (const name of SW_ICONS) {
    assert.ok(assets.includes(`./icons/${name}`), `ASSETS без ./icons/${name}`);
  }

  for (const asset of assets) {
    assert.ok(!asset.startsWith('/'), `абсолютный путь в ASSETS: ${asset}`);
    assert.ok(!/^(https?:)?\/\//i.test(asset), `внешний URL в ASSETS: ${asset}`);
  }
});

test('sw.js: network-first и офлайн-fallback на index.html', () => {
  assert.match(swSource, /request\.method !== 'GET'/, 'нет фильтра GET');
  assert.match(swSource, /request\.mode === 'navigate'/, 'нет определения навигации');
  assert.match(swSource, /caches\.match\('\.\/index\.html'\)/, 'нет fallback на ./index.html');
  assert.match(swSource, /caches\.match\(request\)/, 'нет fallback по request');
  assert.match(swSource, /response\.clone\(\)/, 'успешный ответ не клонируется в кэш');
  assert.match(swSource, /url\.origin !== self\.location\.origin/, 'нет проверки same-origin');
});

test('index.html: manifest/иконки в head и регистрация SW после Audit', () => {
  const head = indexSource.match(/<head>([\s\S]*?)<\/head>/);
  assert.ok(head, 'нет <head>');
  assert.match(head[1], /<link rel="manifest" href="\.\/manifest\.webmanifest">/);
  assert.match(head[1], /<link rel="apple-touch-icon" href="\.\/icons\/apple-touch-icon\.png">/);
  assert.match(head[1], /<link rel="icon"[^>]*href="\.\/icons\/icon-192\.png">/);

  assert.match(indexSource, /serviceWorker\.register\('\.\/sw\.js'/, 'нет регистрации ./sw.js');
  assert.match(indexSource, /updateViaCache: 'none'/, 'нет updateViaCache: none');
  const auditAt = indexSource.indexOf('const Audit');
  const registerAt = indexSource.indexOf("serviceWorker.register('./sw.js'");
  assert.ok(auditAt > -1 && registerAt > auditAt, 'регистрация SW должна идти после определения Audit');
});
