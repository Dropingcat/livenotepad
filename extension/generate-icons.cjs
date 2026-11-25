// Minimal PNG icon generator — generates solid-color square icons.
// Usage: node extension/generate-icons.cjs
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([l, t, data, crc]);
}
function createPNG(size, r, g, b) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // RGB
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    raw[y * (1 + size * 3)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (1 + size * 3) + 1 + x * 3;
      raw[i] = r; raw[i+1] = g; raw[i+2] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const dir = path.join(__dirname, 'icons');
fs.mkdirSync(dir, { recursive: true });
const sizes = { 'icon-48.png': 48, 'icon-96.png': 96, 'icon-128.png': 128 };
for (const [f, s] of Object.entries(sizes)) {
  fs.writeFileSync(path.join(dir, f), createPNG(s, 90, 90, 85)); // #5a5a55 accent
}
console.log('generated', Object.keys(sizes).join(', '));