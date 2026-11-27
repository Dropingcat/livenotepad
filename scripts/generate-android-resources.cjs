/**
 * generate-android-resources.cjs
 * Копирует PWA-иконки www/icons/ в android/app/src/main/res/
 * в соответствующие mipmap-папки по плотности.
 *
 * icon-48 (необязательно)  → mipmap-mdpi
 * icon-96 (необязательно)  → mipmap-hdpi
 * icon-192                 → mipmap-xhdpi
 * icon-512                 → mipmap-xxxhdpi
 */
const fs = require('fs');
const path = require('path');

const ICONS_SRC = path.resolve(__dirname, '..', 'www', 'icons');
const RES_DIR = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

// Android разрешает только [a-z0-9_.] в именах ресурсов, дефисы запрещены
function androidName(filename) {
  return filename.replace(/-/g, '_');
}

const iconMap = [
  { src: 'icon-48.png',  dest: 'mipmap-mdpi'    },
  { src: 'icon-96.png',  dest: 'mipmap-hdpi'    },
  { src: 'icon-192.png', dest: 'mipmap-xhdpi'   },
  { src: 'icon-512.png', dest: 'mipmap-xxxhdpi' },
];

let copied = 0;
let skipped = 0;

for (const { src, dest } of iconMap) {
  const srcPath = path.join(ICONS_SRC, src);
  const destDir = path.join(RES_DIR, dest);

  fs.mkdirSync(destDir, { recursive: true });

  if (fs.existsSync(srcPath)) {
    const destName = androidName(src);
    const destPath = path.join(destDir, destName);
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ ${src} → ${dest}/${destName}`);
    copied++;
  } else {
    console.log(`  - ${src} → ${dest}/ (not found, skipping)`);
    skipped++;
  }
}

console.log(`\nDone: ${copied} copied, ${skipped} skipped.`);