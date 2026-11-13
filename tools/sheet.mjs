// Bir nechta skrinshotni bitta varaqqa yig'adi: node tools/sheet.mjs out.jpg <ustunlar> <kenglik> a.jpg b.jpg ...
import { createRequire } from 'node:module';
let sharp;
try { sharp = (await import('sharp')).default; }
catch { sharp = createRequire('/opt/npm-tools/node_modules/')('sharp'); } // bulut muhitidagi umumiy o'rnatma
const [out, colsS, wS, ...files] = process.argv.slice(2);
const cols = +colsS, w = +wS, h = Math.round(w * 9 / 16), rows = Math.ceil(files.length / cols);
const comps = [];
for (let i = 0; i < files.length; i++) comps.push({ input: await sharp(files[i]).resize(w, h).toBuffer(), left: (i % cols) * w, top: Math.floor(i / cols) * h });
await sharp({ create: { width: cols * w, height: rows * h, channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 84 }).toFile(out);
console.log('sheet', out);
