// Build script for the Firefox sidebar extension.
// Copies shared modules from www/js/ to extension/js/.
// Run: node extension/build.cjs
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'www', 'js');
const dest = path.join(__dirname, 'js');

fs.mkdirSync(dest, { recursive: true });
const files = fs.readdirSync(src).filter(f => f.endsWith('.js'));
for (const f of files) {
  fs.copyFileSync(path.join(src, f), path.join(dest, f));
}
console.log(`copied ${files.length} modules: ${files.join(', ')}`);