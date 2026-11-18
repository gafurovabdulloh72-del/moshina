# SAFAR — Claude uchun ish qoidalari

Brauzerda ishlaydigan 3D sayohat o'yini (Three.js r170 + esbuild → bitta HTML fayl). To'liq hujjat — `README.md`: o'yinda nima borligi (2-bo'lim), fayl xaritasi va tizimlar (4), sinov (5), joylash (6), tarix (8).

## Buyruqlar

```bash
npm install            # bir marta
npm run build          # dist/SAFAR.html + dist/vercel/ + dist/SAFAR-vercel.zip
npm test               # fizika (22 transport, rul) — ~4 s, natijani o'qib tekshiring: bad0 flips0, top X/Y
npm run test:roads     # avtopilot barcha yo'llarni haydab chiqadi — ~7 s, har satr OK bo'lsin
npm run test:smoke     # o'yin yuklanadimi — ~20 s
npm run test:browser   # barcha brauzer sinovlari — ~5 daq
npm run test:api       # onlayn server funksiyalari (soxta Redis) — ~1 s
npm run test:online    # 4 o'yinchi: kirish, bulut, xona, poyga (avval build) — ~5–8 daq
npm run dev            # mahalliy sayt + api + soxta Redis + PeerJS brokeri (127.0.0.1:8787)
```

Brauzer sinovi `dist/SAFAR.html` ni ochadi — **avval `npm run build`**. Ixtiyoriy tekshiruv va skrinshot:

```bash
STEPS='[["","G.sim(2)"],["rasm_nomi","G.advance(0.3)"]]' node tools/shot.mjs tools/s_run.js   # -> shots/rasm_nomi.jpg
```

`window.G` — o'yin obyekti; ilgaklar README 4.10 da.

## O'zgartirishdan keyin

1. `npm run build` — ogohlantirishsiz o'tsin.
2. `npm test`; transport yoki fizikaga tegilgan bo'lsa jadvalni solishtiring.
3. Tegilgan qismga mos brauzer sinovi (`test:smoke` har doim; interfeys — `test:hud`, `test:real`; saqlash — `test:save`; `adapt` — `test:adapt`).
4. Ko'rinishga ta'sir qilsa — skrinshot oling va egasiga **rasm ko'rsating** (`tools/sheet.mjs` bir nechtasini bitta varaqqa yig'adi).

## Buzilmasligi kerak bo'lgan qoidalar

- **Bitta HTML fayl, tashqi resurs yo'q.** `fetch`, tashqi rasm/ovoz/shrift/CDN qo'shmang. Model va teksturalar kodda (`GB`, CanvasTexture), ovoz WebAudio'da sintez qilinadi.
- **Istisno — faqat onlayn rejim** (egasi qarori; README 13): `api/*.js` (Vercel funksiyalari), `src/net.js`, `src/coop.js`, `src/onlineui.js`. Tarmoq faqat o'yinchi Onlayn oynasini ochganda yoki kirgan bo'lsa ishlaydi; Telegram skripti faqat kirish oynasida yuklanadi. Yuklab olingan `SAFAR.html` (file://) internetsiz to'liq ishlashi SHART — onlayn qism "mavjud emas" deb chiqadi. Onlayn kod bitta o'yinchi fizikasini o'zgartirmaydi (`npm test` jadvali bir xil qolsin). Sir (bot tokeni, sessiya siri, Redis tokeni) faqat serverda — mijoz to'plamiga yozilmaydi. Server shaxsni faqat imzolangan sessiyadan biladi. Boshqa o'yinchi modellarida chiroq bo'lmasin (`m.root.remove(m.spot)`).
- **Egasi terminal ishlatmaydi.** Unga beriladigan narsa — tayyor fayl (`dist/SAFAR.html`, `dist/SAFAR-vercel.zip`) yoki havola.
- **Matnlar o'zbekcha (lotin)**, kod izohlari ham.
- **Haqiqiy brend, tayyor musiqa, birovning rasmi ishlatilmaydi.**
- **Saqlov mosligi.** Yangi holat maydoni faqat `game.js` → `defState()` orqali, standart qiymat bilan. `safar_save_v2` kalitini va mavjud maydon ma'nosini o'zgartirmang.
- **Standart grafika sifati — eng yuqori** (`set.gfx: 2`).
- **"Kasb Egalari" reklamasi** (`src/ads.js`): egasi tasdiqlamagan matn, va'da (to'lov, kafolat), logotip yoki manzil qo'shmang.

## Kod uslubi

- ES modullar, `src/` da tekis tuzilma; har fayl boshida bir satrli o'zbekcha izoh.
- Kod zich yozilgan (uzun satrlar) — mavjud uslubni saqlang, formatlovchi bilan qayta formatlamang.
- Fizika qadami qat'iy 1/120 s; `physics.js`, `terrain.js`, `acts.js`, `colliders.js`, `util.js` three.js'ga bog'liq emas (Node'da to'g'ridan-to'g'ri sinaladi) — shunday qolsin.
- Ko'p nusxali obyektlar — `InstancedMesh`.

## Tuzoqlar

- **Chiroqlar sonini o'yin davomida o'zgartirmang** — sheyderlar qayta kompilyatsiya bo'lib, o'yin qotadi. Chiroqni sahnada doim saqlang, o'chirish uchun yorqinligini 0 qiling.
- Sheyderga `onBeforeCompile` bilan kod qo'shganda qo'shilgan bo'lak oxirida `\n` bo'lsin (`#define` bilan bir satrga tushmasin).
- Yangi transportda g'ildirak balandligi g'ildirak **markazidan** (`r − com`) hisoblanadi.
- Ekransiz Chrome dasturiy render qiladi (sekin): `NO_TEST=1` rejimida o'yin vaqti haqiqiy vaqtdan orqada qoladi — kutishlarni saxiy qo'ying yoki sinov rejimida `G.sim()` ishlating.
- `adapt()` (moslashuvchan grafika) kadr vaqtiga tayanadi; uni o'zgartirsangiz `npm run test:adapt` o'tishi shart.
- `dist/` va `shots/` git'da yo'q.
- **Ulashish rasmi.** `tools/build.mjs` sayt nusxasida `src/index.html` dagi `<meta property="og:image" content="/og.jpg">` satrini aynan shu ko'rinishda topib, to'liq manzilga almashtiradi (Vercel'da domen o'zi keladi; o'z domeni ulansa — `package.json` → `homepage`, README 6-bo'lim). Bu satrni o'zgartirmang. `assets/og.jpg` 1200×630 bo'lib qolsin (`og:image:width/height` shunga yozilgan).

## Git va Vercel

- Repo: `gafurovabdulloh72-del/moshina` (**ochiq** qolsin: Vercel'ning bepul tarifida yopiq repodagi Claude commitlari bloklanadi).
- Vercel Git orqali ulanadi: `vercel.json` → `npm install --omit=dev` → `node tools/build.mjs` → `dist/vercel/`. Sozlamalar faqat `vercel.json` da, Vercel panelidagi maydonlarga tegilmaydi.
- **`main` — jonli sayt.** Boshqa tarmoqlar (`claude/...`) sinov havolasini oladi; u Vercel hisobiga kirishni so'raydi — begonalarga yuborilmaydi. `main` ga faqat egasi rozi bo'lsa qo'shiladi.
- Bulut sessiyasidan vercel.com va *.vercel.app ochilmaydi: joylangan saytni bu yerdan tekshirib bo'lmaydi — egasidan havola va rasm so'rang.
- Sinov havolasida Vercel asboblar paneli `c` tugmasini egallashi mumkin (o'yinda kamera tugmasi) — o'yinni asosiy manzilda baholang.

## Egasi bilan ishlash

- Uzoq ishda boshida reja va tugash vaqtini ayting, har bosqichni soat bilan xabar qiling.
- Jarayonda rasm ko'rsating; tayyor faylni oxirida bering.
- Tushuntirishdan ko'ra tayyor, ishlaydigan natija muhim.
- Nimani tekshira olmaganingizni (haqiqiy videokarta, ovoz, telefon) ochiq ayting.
