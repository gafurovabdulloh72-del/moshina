// Yig'ish: three.js + o'yin kodi + CSS -> bitta HTML.
// Natija:
//   dist/SAFAR.html        — o'yinning o'zi (bitta fayl, internet kerak emas)
//   dist/vercel/           — statik sayt (index.html, vercel.json, og.jpg, OQING.txt)
//   dist/SAFAR-vercel.zip  — o'sha papka zip holida (vercel.com/drop sahifasiga tashlash uchun)
// Ishlatish: node tools/build.mjs [--dev]   (--dev: siqilmagan kod, faqat dist/SAFAR.html)
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dev = process.argv.includes('--dev');

const res = await build({
  entryPoints: [path.join(root, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: !dev,
  target: ['es2020'],
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
});
let js = res.outputFiles[0].text;
// </script> ketma-ketligi HTML ichida buzilmasin
js = js.replace(/<\/script/gi, '<\\/script');

const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
let html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
html = html.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => js);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist/SAFAR.html');
fs.writeFileSync(out, html);
console.log('built', out, (html.length / 1024).toFixed(0) + ' KB');

// --- Vercel paketi (statik sayt) ---
if (!dev) {
  const vdir = path.join(root, 'dist/vercel');
  fs.mkdirSync(vdir, { recursive: true });
  // Ulashish rasmi: WhatsApp va Facebook hujjatlari og:image da to'liq manzilni (https://…) talab qiladi; Telegram va X ham nisbiy "/og.jpg" ni tushunmasligi mumkin.
  // Sayt manzili ma'lum bo'lsa (siteOrigin) sayt nusxasida og:image to'liq yoziladi, manzil aniq asosiy bo'lsa og:url ham qo'shiladi. Noma'lum bo'lsa sahifa dist/SAFAR.html bilan bir xil qoladi.
  const OG = '<meta property="og:image" content="/og.jpg">', web = siteOrigin();
  if (!html.includes(OG)) throw new Error(`src/index.html da ${OG} satri topilmadi (tools/build.mjs aynan shu satrni almashtiradi)`);
  fs.writeFileSync(path.join(vdir, 'index.html'), web ? html.replace(OG, () => (web.main ? `<meta property="og:url" content="${web.origin}/">\n` : '') + `<meta property="og:image" content="${web.origin}/og.jpg">`) : html);
  if (web) console.log('og', web.origin + '/og.jpg');
  // Sayt sozlamalari bitta joyda — ildizdagi vercel.json. Paket ichiga yig'ish buyruqlarisiz nusxasi tushadi.
  const { buildCommand, installCommand, outputDirectory, framework, ...site } = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  fs.writeFileSync(path.join(vdir, 'vercel.json'), JSON.stringify(site, null, 2));
  fs.copyFileSync(path.join(root, 'assets/og.jpg'), path.join(vdir, 'og.jpg'));
  fs.rmSync(path.join(vdir, "O'QING.txt"), { force: true });
  fs.writeFileSync(path.join(vdir, 'OQING.txt'), [
    'SAFAR — Vercel uchun tayyor paket',
    '',
    'Joylash (terminal kerak emas):',
    '1. Brauzerda vercel.com/drop sahifasini oching va Vercel hisobingizga kiring (hisob kerak bo\'ladi).',
    '2. SAFAR-vercel.zip faylini (yoki shu papkaning o\'zini) sahifaga sudrab tashlang.',
    '3. Jamoani tanlang, loyiha nomini yozing va Deploy tugmasini bosing — tayyor havola chiqadi.',
    '',
    'O\'yinni yangilash: yangi SAFAR-vercel.zip ni yana shu sahifaga tashlang (har safar yangi loyiha ochiladi).',
    '',
    'Ichida: index.html (butun o\'yin bitta faylda), vercel.json (sozlamalar), og.jpg (ulashilganda ko\'rinadigan rasm).',
    'Yig\'ish (build) bosqichi yo\'q — fayllar o\'z holicha xizmat qiladi.',
  ].join('\n'));
  console.log('vercel', vdir);

  const zipPath = path.join(root, 'dist/SAFAR-vercel.zip');
  fs.writeFileSync(zipPath, zipFiles(['index.html', 'vercel.json', 'og.jpg', 'OQING.txt'].map((name) => ({ name, data: fs.readFileSync(path.join(vdir, name)) }))));
  console.log('zip', zipPath, (fs.statSync(zipPath).size / 1024).toFixed(0) + ' KB');
}

// Sayt manzili: { origin: "https://domen", main } yoki null (noma'lum). Avval package.json dagi "homepage" (o'z domeni ulanganda shu yerga yoziladi),
// bo'lmasa Vercel yig'ish paytida o'zi beradigan VERCEL_PROJECT_PRODUCTION_URL (loyihaning eng qisqa domeni, "https://" siz keladi).
// main — manzil aniq asosiy: "homepage" yoki Vercel'ning o'z *.vercel.app domeni. og:url faqat shunda yoziladi, chunki Vercel bergan o'z domeni boshqasiga yo'naltirilgan bo'lishi mumkin.
function siteOrigin() {
  const pin = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).homepage, raw = String(pin || process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim();
  const m = /^(https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)\/?$/i.exec(raw);
  if (raw && !m) console.warn(`DIQQAT: sayt manzili tushunarsiz ("${raw}") — og:image nisbiy qoldi`);
  return m ? { origin: (m[1] || 'https://').toLowerCase() + m[2].toLowerCase(), main: !!pin || /\.vercel\.app$/i.test(m[2]) } : null;
}

// Kichik ZIP yozuvchi (tashqi dastur kerak emas): har fayl deflate bilan siqiladi.
function crc32(buf) {
  if (zlib.crc32) return zlib.crc32(buf) >>> 0;
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) { let c = (crc ^ buf[i]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; }
  return ~crc >>> 0;
}
function zipFiles(files) {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = [];
  let off = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), comp = zlib.deflateRawSync(f.data, { level: 9 }), crc = crc32(f.data);
    const h = Buffer.alloc(30); // mahalliy sarlavha
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(f.data.length, 22); h.writeUInt16LE(name.length, 26);
    parts.push(h, name, comp);
    const c = Buffer.alloc(46); // markaziy katalog yozuvi
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE((3 << 8) | 20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(f.data.length, 24); c.writeUInt16LE(name.length, 28);
    c.writeUInt32LE((0o100644 << 16) >>> 0, 38); c.writeUInt32LE(off, 42);
    central.push(c, name);
    off += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
