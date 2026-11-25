// Build script for the browser extension.
// Usage: node extension/build.cjs [firefox|chrome]
// Copies shared modules from www/js/ to extension/js/ and selects the right manifest.
const fs = require('fs');
const path = require('path');

const target = process.argv[2] || 'firefox';

// Copy modules
const src = path.join(__dirname, '..', 'www', 'js');
const dest = path.join(__dirname, 'js');
fs.mkdirSync(dest, { recursive: true });
const files = fs.readdirSync(src).filter(f => f.endsWith('.js'));
for (const f of files) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
}
console.log(`copied ${files.length} modules`);

// Copy manifest
const manifestSrc = path.join(__dirname, `manifest.${target}.json`);
const manifestDest = path.join(__dirname, 'manifest.json');
if (fs.existsSync(manifestSrc)) {
  fs.copyFileSync(manifestSrc, manifestDest);
  console.log(`manifest: ${target} -> manifest.json`);
}
console.log(`target: ${target}`);
console.log(`to load: open about:debugging -> Load Temporary Add-on -> ${__dirname}`);