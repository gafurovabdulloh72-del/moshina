# SAFAR — orol bo'ylab katta sayohat

Brauzerda ochiladigan 3D sarguzasht o'yini: katta orol, 22 xil transport, 90 ta chellenj, mashinadan tushib piyoda yashash (50 ta imkoniyat), uy qurish, drift va haqiqiydek pachoqlanish. O'yin **bitta HTML fayl** — o'rnatish ham, internet ham kerak emas.

![Grafika](docs/img/grafika.jpg)

| | |
|---|---|
| Versiya | 2.0 (2026-11-13) |
| Til | o'zbekcha (lotin) |
| Texnologiya | Three.js r170 + esbuild. Barcha modellar, teksturalar, ovoz va musiqa kod ichida yaratiladi — tashqi fayl yuklanmaydi |
| Natija | `dist/SAFAR.html` (~1 MB) |
| Holat | v2 topshirilgan; ekransiz brauzerda sinalgan, haqiqiy kompyuterda egasi sinaydi ([cheklovlar](#10-tekshirilmagan-narsalar-va-malum-cheklovlar)) |

## Mundarija

1. [Tez boshlash](#1-tez-boshlash)
2. [O'yinda nima bor](#2-oyinda-nima-bor)
3. [Boshqaruv](#3-boshqaruv)
4. [Texnik tuzilish](#4-texnik-tuzilish)
5. [Sinov](#5-sinov)
6. [Vercel'ga joylash](#6-vercelga-joylash)
7. [Loyiha qoidalari](#7-loyiha-qoidalari)
8. [Tarix](#8-tarix)
9. [Tuzatilgan muhim xatolar](#9-tuzatilgan-muhim-xatolar)
10. [Tekshirilmagan narsalar va ma'lum cheklovlar](#10-tekshirilmagan-narsalar-va-malum-cheklovlar)
11. [Keyingi g'oyalar](#11-keyingi-goyalar)
12. [Uchinchi tomon kutubxonalari](#12-uchinchi-tomon-kutubxonalari)
13. [Onlayn rejim](#13-onlayn-rejim)

---

## 1. Tez boshlash

Node.js 20 yoki undan yangisi kerak.

```bash
npm install        # bir marta
npm run build      # dist/SAFAR.html, dist/vercel/ va dist/SAFAR-vercel.zip
npm test           # fizika sinovlari (3–4 soniya)
```

- **O'ynash:** `dist/SAFAR.html` ni ikki marta bosing — brauzerda ochiladi.
- **Tez yig'ish (siqilmagan kod):** `npm run build:dev`.
- **Internetga joylash:** [6-bo'lim](#6-vercelga-joylash).

`dist/` va `shots/` git'ga kirmaydi (`.gitignore`) — ular har safar qayta yaratiladi.

---

## 2. O'yinda nima bor

### 2.1. Dunyo

6,4 × 6,4 km xarita, 25,4 km² quruqlik, eng baland cho'qqi 518 m. 10 xil hudud (yashil vodiy, oltin o'rmon, tayga, cho'l, qizil dara, qorli tog', sohil, sakura vodiysi, savanna, vulqon etagi), 34,7 km yo'l (21 tugun, 25 bo'lak), daryo, ko'llar, kecha-kunduz almashinuvi (bir sutka — 20 daqiqa). Orolda 32 nafar aholi, 21 ta qo'y, yo'llarda 8 ta boshqa mashina, 528 ta tanga va 32 ta sandiq bor.

| № | Manzil | Hudud | Nima bor |
|---|---|---|---|
| 1 | Bog'iston qishlog'i | Yashil vodiy | e'lonlar taxtasi, **ustaxona**, 5 chellenj |
| 2 | Mayoq burni | Yashil vodiy (sohil) | taxta, 4 chellenj |
| 3 | Baliqchilar bandargohi | Yashil vodiy (sohil) | taxta, **ustaxona**, 4 chellenj |
| 4 | Oltin o'rmon | Oltin o'rmon | taxta, **ustaxona**, 4 chellenj |
| 5 | Ko'zgu ko'l | Tayga | taxta, dam olish joyi, 5 chellenj |
| 6 | Qorli lager | Oqtog' qorlari | taxta, dam olish joyi, 5 chellenj |
| 7 | Cho'qqi rasadxonasi | Oqtog' qorlari | taxta, 4 chellenj |
| 8 | Karvonsaroy | Qizilqum cho'li | taxta, **ustaxona**, 4 chellenj |
| 9 | Qizil dara | Qizil dara | taxta, 4 chellenj |
| 10 | Eski aerodrom | Savanna | taxta, **ustaxona**, uchish yo'lagi, 6 chellenj |
| 11 | Ko'hna qal'a | Yashil vodiy | taxta, 4 chellenj |
| 12 | Tosh karyeri | Yashil vodiy | taxta, tryuk maydoni, 5 chellenj |
| 13 | Shamol tegirmonlari | Yashil vodiy | taxta, 1 chellenj |
| 14 | Olovtog' krateri | Olovtog' etagi | taxta, 1 chellenj |
| 15 | Muzko'l | Oqtog' qorlari | taxta, muz maydoni, 1 chellenj |
| 16 | Mening uyim | Yashil vodiy | o'yinchining uyi (yangi o'yin shu yerdan boshlanadi) |

Yo'llarda 482 ta olib tashlasa bo'ladigan tosh, 17 ta tramplin va 16 ta tezlik radari bor. Toshlar transportga haqiqiy to'siqdek ta'sir qiladi: jip yengil sakraydi, superkar va karting tagi bilan uriladi, monster-trak sezmaydi ham.

### 2.2. Transportlar (22 ta)

Yangi o'yinda **Sayohat jipi** va **Velosiped** bor; qolganlari ustaxonadagi salonda yig'ilgan pulga olinadi. Har bir transportning o'z fizikasi bor (massa, quvvat, yuritma, g'ildirak o'lchami). Nomlar va dizaynlar o'zimizniki — haqiqiy brendlar ishlatilmagan.

![Transportlar](docs/img/transportlar.jpg)

| Transport | Turi | Narxi (so'm) | Tezlik (km/soat) | Yuritma | Izoh |
|---|---|---:|---:|---|---|
| **Velosiped** | ikki g'ildirakli | 0 (boshlang'ich) | 36 | orqa | benzinsiz, hech qachon buzilmaydi |
| Skuter | ikki g'ildirakli | 500 | 70 | orqa | yengil va tejamkor |
| Karting | ochiq | 1 800 | 98 | orqa | juda past, faqat tekis yo'l uchun |
| Mototsikl | ikki g'ildirakli | 2 200 | 175 | orqa | qattiq urilsa haydovchi yiqiladi |
| Kvadrotsikl | ochiq | 2 600 | 94 | to'liq | yo'lsizlik, qum, qor |
| Xetchbek | yengil | 3 000 | 152 | old | arzon shahar mashinasi |
| Traktor | traktor | 4 000 | 47 | to'liq | sekin, har qanday loydan chiqadi |
| Sedan | yengil | 4 800 | 188 | orqa | uzoq yo'l uchun |
| Pikap | yengil | 5 500 | 158 | to'liq | baquvvat |
| **Sayohat jipi** | jip | 0 (boshlang'ich) | 121 | to'liq | yo'l ham, yo'lsizlik ham |
| Furgon | furgon | 6 000 | 140 | orqa | baland — burilishda ehtiyot |
| Bagi | ochiq | 7 500 | 152 | orqa | qum barxanlari uchun |
| Ralli mashinasi | yengil | 9 500 | 208 | to'liq | shag'al yo'llar uchun |
| Yuk mashinasi | yuk | 10 000 | 114 | orqa | og'ir, to'siqlarni payqamaydi |
| Avtobus | avtobus | 11 000 | 106 | orqa | o'n metrlik |
| Sport kupe | yengil | 13 000 | 248 | orqa | asfaltda tengsiz |
| O't o'chirish mashinasi | yuk | 14 000 | 127 | to'liq | sirenali (H) |
| Muskul-kar | yengil | 15 000 | 252 | orqa | drift uchun eng zo'ri |
| Limuzin | yengil | 16 000 | 192 | orqa | yetti metrlik |
| Monster-trak | yo'ltanlamas | 18 000 | 136 | to'liq | bir metrlik g'ildiraklar |
| Superkar | yengil | 28 000 | 325 | to'liq | toshlardan qo'rqadi |
| Poyga bolidi | ochiq | 35 000 | 345 | orqa | eng tez |

### 2.3. Chellenjlar (90 ta, 270 yulduz)

Har bir chellenj natijaga qarab 1–3 yulduz beradi.

| Turi | Soni | Nima qilinadi |
|---|---:|---|
| Yetkazib berish | 11 | yukni vaqtida manzilga eltish |
| Yig'ish | 11 | tarqalgan narsalarni terib chiqish (qochgan qo'ylar, chig'anoqlar…) |
| Taksi | 6 | yo'lovchini manziliga eltish |
| Mo'rt yuk | 7 | urilmasdan yetkazish |
| Ko'p manzilli | 1 | "Tezkor pochta" |
| Poyga | 15 | raqiblar bilan; eng kattasi — **KATTA SAFAR** (5 000 so'm va oltin bo'yoq) |
| Drift zonasi | 3 | Muz drifti, Asfalt drifti, Karyer drifti |
| Buzish zonasi | 3 | Buzg'unchi, Pichan bayrami, Konuslar ovi |
| Radar | 16 | belgilangan joydan iloji boricha tez o'tish |
| Tramplin | 17 | iloji boricha uzoq sakrash |

**Cheksiz ishlar.** Har bir e'lonlar taxtasida ♾ kartasi bor: tasodifiy manzilga yetkazish, taksi yoki mo'rt yuk — tugamaydi (Muzko'l, Cho'qqi va Olovtog' manzil sifatida chiqmaydi). Yo'l chetida qo'l ko'targan yo'lovchilar ham doim paydo bo'lib turadi. Pauza menyusida "Yangi o'yin" bor.

**Daraja** tajriba (XP) bilan o'sadi: Yangi haydovchi → Yo'lovchi → Sayyoh → Tajribali sayyoh → Yo'l ustasi → Ralli ustasi → Orol afsonasi.

### 2.4. Piyoda hayot — 50 ta imkoniyat

**F** bilan transportdan tushiladi. Qahramonning kuchi va to'qligi bor: yugursa charchaydi, ovqat yesa tiklanadi.

**Harakat**

1. Transportdan tushish va chiqish (F)
2. Yugurish va charchoq (Shift)
3. Sakrash (Probel)
4. Suzish
5. Transportni hushtak bilan chaqirish (V)
6. Fonar — kechasi (L)
7. Durbin (Z)
8. Raqs (1)
9. Dutor chalish — odamlar pul tashlaydi (2)
10. Salomlashish (3)

**Tabiat**

11. O't yulish — pichan va ba'zan urug' chiqadi (Q)
12. Gul ekish (G)
13. Daraxtni silkitish — meva tushadi (E)
14. Meva yeyish (Y)
15. Butadan rezavor terish
16. Qo'ziqorin terish
17. Chig'anoq terish (sohilda)
18. Kapalak tutish
19. Yovvoyi gul terish (guldasta uchun)
20. O'tin yig'ish
21. Ko'chat ekish — vaqt o'tib mevali daraxt bo'ladi
22. Baliq ovi (qarmoq bilan, mini-o'yin)
23. Xazina qazish (belkurak bilan, yaltiroq joydan)
24. Ruda qazish (cho'kich bilan)
25. Yo'ldagi toshni olib tashlash — savob

**Qurish**

26. Gulxan yoqish (3 ta o'tin)
27. Gulxanda ovqat pishirish
28. Chodir tikish va tunash
29. Qorbobo yasash (qorda)
30. Qum qal'asi (qumda)
31. Bayroq tikish — cho'qqida mukofot bor

**Odamlar va yaxshilik**

32. Aholi bilan gaplashish
33. Och odamni ovqatlantirish
34. Guldasta sovg'a qilish
35. Yo'qolgan buyumni topib berish
36. Yo'lovchini manziliga eltish (cheksiz)
37. Axlat yig'ishtirish
38. Qo'ylarni pichan bilan boqish
39. Kuchukni erkalash

**Uy**

40. Uyni 5 darajagacha yaxshilash
41. Uxlash (vaqtni o'tkazish, kuchni tiklash)
42. Poliz — 6 ta jo'yak, sug'orish, hosil
43. Tovuq katagi — tuxum
44. Pochta qutisi — sovg'a
45. Hovli bezaklari
46. Garaj — uyda transport almashtirish

**Umumiy**

47. Yorilgan balonni almashtirish
48. Dalada ta'mirlash (ta'mir to'plami bilan)
49. Bozor — sotish va sotib olish
50. Kundalik topshiriqlar va kolleksiya albomi (25 tur)

Yaxshi ishlar uchun pul va **savob** (❤) beriladi. Qolgan harakatlar **B** — harakatlar menyusida.

### 2.5. Uy

![Menyu, ustaxona, uy](docs/img/menyu-ustaxona-uy.jpg)

| Daraja | Narxi (so'm) | Daromad (so'm/daq) | Nima qo'shiladi |
|---|---:|---:|---|
| 1. Chodir | 0 | 0 | chodir va gulxan, uxlash |
| 2. Yog'och kulba | 2 000 | 6 | o'tinxona, kuchuk uyasi — Olapar keladi |
| 3. Hovli uy | 6 000 | 16 | to'siq, poliz, tovuq katagi, pochta qutisi |
| 4. Ikki qavatli uy | 15 000 | 40 | balkon, tosh devor, mashina ayvoni, chiroqlar |
| 5. Villa | 35 000 | 90 | hovuz, mehmonxona qanoti |

Bezaklar (kulbadan boshlab): Gulzor 500, Bayroq ustuni 400, Arg'imchoq 600, Yo'lak chiroqlari 800, Favvora 1 500.

### 2.6. Bozor va buyumlar

- **Tovarlar:** Urug' ×5 — 40, Ko'chat — 120, Non — 30, Ta'mir to'plami — 220.
- **Asboblar:** Qarmoq 250, Belkurak 300, Cho'kich 350, Chodir 400, Dutor 300.
- **Bosh kiyimlar:** Somon shlyapa 200, Kepka 250, Do'ppi 400, Oltin toj 5 000.
- **Sotiladigan narsalar (dona narxi):** Pichan 5, Rezavor 6, O'tin 8, Yovvoyi gul 12, Meva 15, Qo'ziqorin 22, Tuxum 25, Chig'anoq 28, Baliq 45, Sabzavot 48, Ruda 60, Katta baliq 130, Yoqut 500.

### 2.7. Shikast, ustaxona, tyuning

![Pachoqlanish](docs/img/pachoqlanish.jpg)

- Qattiq narsaga urilganda korpus **o'sha joyidan ezilib pachoqlanadi**, qismlar (bamper, kapot, eshik, oyna…) uzilib tushadi, balon yorilishi mumkin.
- Old tomondan urilish dvigatelga zarar beradi: quvvat kamayadi, dvigatel holati 46 % dan pastga tushsa motor vaqti-vaqti bilan o'chib qoladi, 0 % da transport yurmaydi — **T** bilan evakuator chaqiriladi.
- Shikast har bir transportda alohida saqlanadi. Velosiped buzilmaydi, lekin ikki g'ildirakli transportda qattiq urilsa haydovchi yiqiladi.
- **Ustaxona** (5 ta manzilda): ta'mir, bo'yoq (8 rang + sovrinli oltin), tyuning va transport saloni.
- **Tyuning** (barcha transportga ta'sir qiladi): Dvigatel (4 bosqich), Nitro (3), Shinalar (3), Osma (3), Zirh (3), Tormoz (2).

### 2.8. Mukofotlar

- **Sakrash:** 10 m dan uzun sakrash uchun 220 so'mgacha.
- **Drift:** qo'l tormozi (Probel) bilan sirpanish ochko yig'adi, 320 so'mgacha.
- **Yaxshi ishlar:** pul va savob.
- Yo'llarda tangalar va sandiqlar, har bir yangi manzil uchun mukofot.

### 2.9. Grafika va ovoz

- HDR post-ishlov: bloom, tone mapping, rang korreksiyasi, vinyetka, MSAA ×4 (eng yuqori sifatda).
- Suv sheyderi: chuqurlikka qarab rang, qirg'oq ko'pigi, osmon aksi, quyosh jilosi.
- Yer teksturasi shovqini, suzuvchi bulut soyalari, shamolda tebranadigan o't va daraxtlar, tungi faralar va chiroqlar, tunda yaltiroq qo'ng'izlar.
- 3 ta sifat pog'onasi (Sozlamalar): Past (tez), O'rta, Yuqori (eng chiroyli). O'yin kompyuter kuchiga qarab aniqlikni o'zi moslaydi ([4.8](#48-moslashuvchan-grafika)).
- Ovoz va musiqa to'liq WebAudio'da sintez qilinadi — tayyor (birovning) yozuvi yo'q.

### 2.10. "Kasb Egalari" reklamasi

Tramplinlarning orqa devorida va yo'l bo'yidagi 17 ta bilbordda **Kasb Egalari** platformasining reklamasi turadi (katak qog'oz uslubida, `@kasb.egalari`). Uch xil matn:

1. "Ijodkor kerakmi? … Xaritadan toping"
2. "KASB EGALARI — Ijodkorlar platformasi"
3. "Ijodkormisiz? … Cheklanmagan buyurtma"

Matnlar `src/ads.js` da. Logotip va sayt manzili hali qo'yilmagan.

---

## 3. Boshqaruv

![Haydash paytidagi panel](docs/img/haydash-paneli.jpg)

| Transportda | |
|---|---|
| W / S | gaz / tormoz va orqaga |
| A / D | burilish |
| Probel | qo'l tormozi — drift |
| Shift | nitro |
| F | transportdan tushish |
| R | yo'lga qaytarish |
| H / L | signal / faralar |
| T | evakuator (motor o'chganda) |
| E | e'lonlar taxtasi / ustaxona / yo'lovchi olish |

| Piyoda | |
|---|---|
| W A S D | yurish |
| Shift | yugurish |
| Probel | sakrash |
| F | transportga chiqish |
| V | transportni chaqirish |
| E | harakat (silkitish, gaplashish, terish…) |
| Q / G / Y | o't yulish / gul ekish / yeyish |
| B | harakatlar menyusi |
| 1 / 2 / 3 | raqs / dutor / salom |
| L / Z | fonar / durbin |

| Umumiy | |
|---|---|
| M | xarita va GPS |
| I | sumka, topshiriqlar, albom |
| Tab | sayohat pasporti |
| C | kamera (sichqoncha bilan aylantirish) |
| X | chellenjni bekor qilish |
| N | musiqa |
| O / U | onlayn oynasi / chat (xonada) |
| P | surat rejimi — interfeysni yashiradi (ekranda eslatma turadi, 20 soniyada o'zi qaytadi) |
| Esc | pauza |

**Ekrandagi tugmalar.** Pastki markazda hozir mumkin bo'lgan amallar tugma bo'lib turadi (klavisha nomi + amal: `[Q] O't yulish`, `[Shift] Nitro`…), uning ustida — yaqindagi narsaga mos katta tugma (`[E] Hosilni yig'ish`, `[E] Gulni olib tashlash`). Yuqori o'ngda umumiy tugmalar: xarita, sumka, pasport, kamera, surat rejimi, menyu. Tugmani bosish klavishani bosish bilan aynan bir xil: ikkalasi ham `controls.js` dagi bitta jadvaldan olinadi.

O'zi ekkan gul yonida **E** — gulni olib tashlash (urug' qaytadi, ekishda berilgan 10 so'm qaytariladi); hali o'sayotgan ko'chat yonida — qazib olish (ko'chat sumkaga qaytadi).

Geympad: RT/LT — gaz/tormoz, chap stik — rul, A — qo'l tormozi, X — nitro. Sensorli ekranda birinchi teginishda chapda virtual joystik (yurish, transportda rul va gaz/tormoz), o'ngda pedallar paydo bo'ladi; amallar — o'sha ekran tugmalari, mini-xarita chap tepaga ko'chadi.

---

## 4. Texnik tuzilish

### 4.1. Papkalar

```
src/          o'yin kodi (ES modullar) + index.html + style.css
tools/        yig'ish va sinov skriptlari
assets/og.jpg havola ulashilganda ko'rinadigan rasm, 1200×630 (yig'ishda dist/vercel/ ga ko'chiriladi)
docs/img/     shu hujjatdagi rasmlar
vercel.json   Vercel sozlamalari (Git orqali joylash uchun)
dist/         yig'ish natijasi (git'da yo'q)
shots/        sinov skrinshotlari (git'da yo'q)
```

### 4.2. Fayl xaritasi (`src/`)

| Fayl | Vazifasi |
|---|---|
| `main.js` | kirish nuqtasi: dunyoni yig'ish tartibi, kadr sikli, klaviatura amallari, moslashuvchan grafika (`adapt`), sinov ilgaklari |
| `game.js` | o'yin holati va qoidalari: saqlash, pul/XP/daraja, chellenjlarni boshlash-tugatish, transport sotib olish va almashtirish, tyuning, sakrash/drift mukofotlari, evakuator, GPS |
| `acts.js` | 90 chellenj ta'rifi (`JOBS`, `RACES`, `ZONES`, `RADARS`), marshrut vaqtini baholash |
| `terrain.js` | orol: balandlik, hududlar, suv, yo'l tarmog'i va marshrut topish, manzillar (`PLACES`), yo'ldagi toshlar ("bump") |
| `worldgfx.js` | ko'rinadigan yer (LOD), yo'l lentalari, ko'priklar, suv |
| `places.js` | 15 manzil binolari, to'qnashuv jismlari, chiroqlar, tramplinlar |
| `home.js` | o'yinchining uyi: 5 daraja, bezaklar, poliz, katak, pochta qutisi |
| `props.js` | daraxtlar, toshlar, butalar (InstancedMesh + LOD), yaqin atrofdagi o't |
| `blocks.js` | qurilish bloklari: uy, devor, chodir, gulxan, o'rindiq, quduq, do'kon… |
| `geo.js` | low-poly geometriya quruvchisi (`GB`), materiallar (`MAT`), shamol (`WIND`) |
| `sky.js` | osmon, quyosh/oy, yulduzlar, bulutlar, yoritish va tuman |
| `gfx.js` | post-ishlov (bloom, rang, MSAA), suv sheyderi, osmon aksi (PMREM), sifat pog'onalari |
| `physics.js` | transport fizikasi (`Car`, `DEF_SPEC`), avtopilot (`Autopilot`) |
| `vehicles.js` | 22 transport: `VEHICLES` (narx, ta'rif, fizik `spec`) va protsedura modellari (`buildVehicle`) |
| `carmodel.js` | Sayohat jipining modeli, bo'yoqlar (`PAINTS`) |
| `damage.js` | shikast: zonalar, dvigatel, balonlar, korpus deformatsiyasi, qismlarning uzilishi |
| `player.js` | piyoda qahramon: yurish, yugurish, sakrash, suzish, to'qnashuv |
| `rig.js` | odam modeli va protsedura animatsiyalari, bosh kiyimlar, asboblar |
| `living.js` | "hayot" tizimlari: terimchilik, ekish, baliq ovi, aholi, yo'lovchilar, hayvonlar, uy xo'jaligi, qurish, topshiriqlar, albom, bozor |
| `life.js` | yo'ldagi boshqa mashinalar, qushlar, havo sharlari |
| `ads.js` | "Kasb Egalari" reklama taxtalari (CanvasTexture) |
| `net.js`, `coop.js`, `onlineui.js` | onlayn rejim: kirish, bulutli saqlov, reyting; birga o'ynash xonasi; onlayn oynalar ([13](#13-onlayn-rejim)) |
| `camera.js` | kuzatuvchi kamera: transport, piyoda, durbin |
| `fx.js` | zarrachalar (chang, tutun, uchqun), parchalar, shina izlari |
| `audio.js` | sintez qilingan ovoz, dvigatel, generativ musiqa |
| `controls.js` | boshqaruv jadvali (`ACTIONS`): har bir klavisha nima qiladi, qachon ishlaydi va ekranda qanday tugma bo'lib chiqadi — klaviatura va ekran tugmalari uchun yagona manba |
| `input.js` | klaviatura, geympad, sensorli ekran | (+ virtual joystik qiymatlari `touch.jx/jy`)
| `ui.js` | HUD, mini-xarita, menyu va barcha oynalar (o'zbekcha) |
| `colliders.js` | statik to'qnashuv jismlari (doira, kesma, quti) |
| `util.js` | matematika, shovqin, tasodifiy sonlar, rang |
| `style.css`, `index.html` | interfeys uslubi va sahifa qolipi (`/*__CSS__*/`, `/*__JS__*/` o'rniga kod qo'yiladi) |

### 4.3. Ishga tushish tartibi va kadr sikli

`main.js` dunyoni shu tartibda yig'adi: `initWorld` → materiallar → osmon → yer → yo'llar → manzillar (uy bilan) → tabiat → transport, effektlar, kamera, kiritish, ovoz, shikast → `initGame` → piyoda qahramon → jonli dunyo → reklama → `initLiving` → `initGfx`.

Har kadrda: kiritish → fizika **1/120 s qat'iy qadam** bilan → o'yin mantig'i (`updateGame`, `live.update`) → kamera → render (`gfx.render`) → `adapt` (aniqlikni moslash).

### 4.4. Fizika va transport

`Car` — qattiq jism + raycast g'ildiraklar (prujina, amortizator), shina ishqalanishi, to'qnashuvlar. Har bir transport `spec` bilan sozlanadi:

`mass, len, wid, hgt, clr, com` (o'lchamlar va massa markazi) · `wx, wzF, wzR, rF, rR` (g'ildiraklar joyi va radiusi) · `free, travel, sag` (osma) · `power, top, a0, brake` (quvvat, eng yuqori tezlik, boshlang'ich tezlanish, tormoz) · `steer, drive ('awd'|'rwd'|'fwd'), grip, down`.

- Rul me'yorlashtirilgan: tezlik oshgani sari burilish burchagi kamayadi, qo'yib yuborilganda tez markazga qaytadi.
- Qo'l tormozi orqa g'ildiraklar tutishini kamaytiradi — drift.
- Ikki g'ildirakli transport tik turishi uchun yordamchi moment bor.

Model interfeysi (`buildVehicle(id)` qaytaradi): `{ id, v, spec, root, tilt, body, trimMesh, deform[], parts{nom: {mesh, zone, thr, on, home}}, paintMat, headMat, tailMat, wheels[{pivot, mesh, src, x, z, front, r}], rider, bike, … }`. G'ildiraklar `syncWheels(model, car, flatTires)` bilan yangilanadi.

### 4.5. Shikast

`damage.js`: zarba tezligi chegaradan (5,2 m/s; qo'nishda 7,5 m/s) oshsa zona sog'lig'i kamayadi, mesh uchlari mahalliy ezilish (`deform`) va yo'nalishli g'ijimlanish (`crush`) bilan siljiydi, qismlar chegaraga yetganda uziladi. `apply()` shikastni fizikaga o'tkazadi (quvvat, tutish, qarshilik, rul titrashi).

### 4.6. "Hayot" tizimlari

`living.js` (`game.live`): 16 m katakli tarmoq bo'yicha hududga mos narsalarni paydo qiladi (qo'ziqorin, chig'anoq, gul, o'tin, axlat, kapalak, rezavor, xazina, ruda), aholining rollari, 3 ta yo'lovchi, qo'ylar, kuchuk, tovuqlar, poliz, tuxum, pochta, baliq ovi, topshiriqlar, albom, savob. Yaqindagi narsaga mos harakatni `findCtx()` topadi — **E** shuni bajaradi.

### 4.7. Grafika

`gfx.js`: EffectComposer (HalfFloat, eng yuqori sifatda MSAA ×4) → UnrealBloom → rang korreksiyasi va vinyetka → OutputPass. Sifat pog'onasi: 0 — bloom va rangsiz, 1 — MSAA'siz, 2 — to'liq. Kompozitor bir marta quriladi; pog'ona almashganda faqat MSAA soni va o'tishlar yoqiladi/o'chiriladi. Sahna har doim nishonga chiziladi — ekranga to'g'ridan-to'g'ri chizish materiallarning sheyderini o'zgartirib, hammasini qayta kompilyatsiya qildirardi (o'yin 1–3 soniya qotib, ekran qora bo'lib qolardi). Yuklashda barcha sheyderlar (yashirin narsalarnikini ham) oldindan kompilyatsiya qilinadi; kanvas o'lchami o'zgarsa darhol qayta chiziladi; WebGL konteksti yo'qolsa qaytganda teksturalar qayta pishiriladi. Chiroqlar soni o'zgarmas saqlanadi (o'zgarsa sheyderlar qayta kompilyatsiya bo'lib, o'yin qotadi).

### 4.8. Moslashuvchan grafika

`main.js` → `adapt()` har 2,5 soniyada o'rtacha kadr vaqtini o'lchaydi:

1. Sekin (24 ms dan ko'p) — piksel zichligini kamaytiradi; ravon (20,5 ms dan kam) — asta-sekin qaytaradi. Bu 60 Gs ekranda ham ishlaydi.
2. Boshqa oynaga o'tib qaytgandagi uzilish sekinlik hisoblanmaydi.
3. Kamaytirish **foyda bermasa** (masalan, brauzer quvvat tejash rejimida kadrni 30 ga cheklagan) — hammasi joyiga qaytariladi, tasvir bekorga xiralashmaydi.
4. Aniqlik eng pastga tushib ham sekin bo'lsa — sifat pog'onasi sinov tariqasida bir pog'ona tushiriladi; 10 soniyada tezlashmasa qaytariladi, tezlashsa o'yinchiga xabar chiqadi.
5. Avtomatik tushirilgan sifat keyin 45 soniya bemalol ravon ishlasa — qayta ko'tarib ko'riladi.

### 4.9. Saqlash

`localStorage`, kalit `safar_save_v2`. Yuklashda saqlangan holat standart holat (`defState()` — `game.js`) ustiga qo'shiladi, shuning uchun **yangi maydon qo'shilganda eski saqlovlar buzilmaydi** — faqat `defState()` ga standart qiymat yozish kerak. v1 saqlovlari ham ochiladi.

Asosiy maydonlar: `money, xp, stars, best, up` (tyuning), `veh {own, cur, dmg, paint}`, `inv` (buyumlar), `tools, hats, hat, karma, sat, energy`, `home {lvl, decor, beds, wat, eggT, mailT, incT}`, `flowers, trees, flags, tasks, cnt, seen, peaks`, `stats`, `set {vol, music, gfx, damage}`, `hour, pos, foot`.

Saqlov brauzerning o'zida turadi. Saytda Telegram orqali kirilsa, xuddi shu JSON bulutga ham yoziladi va boshqa qurilmada olinadi ([13](#13-onlayn-rejim)); `safar_save_v2` formati o'zgarmagan.

### 4.10. Sinov ilgaklari

O'yin `window.G` orqali ochiq. Sahifa yuklanishidan oldin `window.__TEST = true` qo'yilsa: menyu o'tkazib yuboriladi, kadr sikli to'xtaydi, kun vaqti muzlatiladi va o'yin qo'lda yuritiladi. Yuklanib bo'lgach `window.__ready === true`.

| Ilgak | Nima qiladi |
|---|---|
| `G.sim(soniya)` | o'yinni rendersiz oldinga yuritadi |
| `G.advance(soniya)` | yuritadi va bitta kadr chizadi |
| `G.teleport(x, z, yaw, soat)` | transport yoki qahramonni ko'chiradi |
| `G.drive([tugunlar], tezlik)`, `G.autoTo(x, z)`, `G.autoPts(nuqtalar)` | avtopilot |
| `G.runUntil(shart, maxSoniya)` | shart bajarilguncha yuritadi |
| `G.view(x, y, z, tx, ty, tz, soat)` | kamerani qo'yadi (skrinshot uchun) |
| `G._adapt(kadrVaqti, n)` | moslashuvchan grafikaga sun'iy kadr vaqtini beradi |

### 4.11. Qanday qo'shiladi

- **Yangi transport:** `vehicles.js` → `VEHICLES` ga yozuv (`id, name, price, hex, cls, desc, eng, spec`) va model uslubi; keyin `npm test` — barqarorlikni tekshiradi.
- **Yangi chellenj:** `acts.js` → `JOBS` / `RACES` / `ZONES`.
- **Yangi buyum yoki asbob:** `living.js` → `ITEMS`, `SHOP`, `TOOLS`; tabiatda paydo bo'lishi — `KIND` va `SPAWN`.
- **Yangi saqlanadigan maydon:** `game.js` → `defState()`.
- **Reklama matni:** `ads.js` → `adCanvas(variant)`.
- **Interfeys matni:** `ui.js` (hammasi o'zbekcha).

---

## 5. Sinov

| Buyruq | Nimani tekshiradi | Vaqt |
|---|---|---|
| `npm test` | 22 transport fizikasi (tinch holat, tezlanish, eng yuqori tezlik, tormoz, burilish, 4 daqiqalik tasodifiy haydash) va rulning qaytishi. Natija jadval bo'lib chiqadi: `top 121/121`, `bad0 flips0` | ~4 s |
| `npm run test:roads` | avtopilot barcha yo'llarni ikki tomonga va katta halqani haydab chiqadi (`OK` / `FAIL`) | ~7 s |
| `npm run test:smoke` | o'yin yuklanadi, 90 chellenj joyida, skrinshot | ~20 s |
| `npm run test:real` | haqiqiy klaviatura bilan: menyu → haydash → tushish → oynalar → qayta chiqish | ~1 daq |
| `npm run test:hud` | tezlik/holat paneli 10 xil oyna o'lchamida ko'rinadi, oynalardan keyin joyida, surat rejimi o'zi qaytadi | ~1,5 daq |
| `npm run test:adapt` | moslashuvchan grafikaning 15 ssenariysi (60/120 Gs, oyna almashtirish, kuchsiz videokarta, 30 kadrga cheklov…) | ~40 s |
| `npm run test:save` | v1 saqlovi ochiladi; yangi holat saqlanib, qayta yuklanadi | ~40 s |
| `npm run test:browser` | beshta brauzer sinovi ketma-ket (smoke, real, hud, adapt, save) | ~4–5 daq |

Brauzer sinovlari `tools/shot.mjs` orqali ekransiz Chrome'da ishlaydi (kompyuterda Google Chrome o'rnatilgan bo'lishi kerak). Xato bo'lsa yoki `TEST … FAIL` satri chiqsa — chiqish kodi 1.

```bash
node tools/shot.mjs tools/s_run.js            # STEPS='[["nom","JS ifoda"],…]' — ixtiyoriy qadamlar va skrinshot
NO_TEST=1 node tools/shot.mjs tools/s_og.js --w 1200 --h 630   # og.jpg uchun menyu rasmi, 1200×630 (shots/og.jpg → assets/og.jpg ga qo'lda ko'chiriladi)
node tools/sheet.mjs out.jpg 2 900 a.jpg b.jpg c.jpg d.jpg   # skrinshotlarni bitta varaqqa yig'ish
node tools/map.mjs                            # xarita rasmi (shots/map.jpg) va yo'l statistikasi
node tools/probe.mjs -380,1920                # nuqtadagi balandlik va hudud
```

Muhit o'zgaruvchilari: `NO_TEST=1` (oddiy rejim), `CHROME_PATH` (Chrome joyi), `SAFAR_GPU=1` (haqiqiy videokarta; busiz dasturiy SwiftShader — sekin, lekin natija hamma joyda bir xil).

**v2 da tekshirilganlar:** yuklanish; v1 saqlovining ochilishi; 22 transportning barqarorligi; 14 ta oddiy poyga avtopilot bilan (yo'llarda toshlar turganda); cheksiz ishlar; urilish → pachoqlanish → motor o'chishi → evakuator → ta'mir; drift va sakrash mukofotlari; 50 ta piyoda imkoniyatning har biri (skript bilan); barcha oynalar va ✕ tugmasi; toshlarning har xil transportga ta'siri.

---

## 6. Vercel'ga joylash

**A. Git orqali (manzil o'zgarmaydi).** Repo Vercel'ga ulansa, har bir `push` dan keyin Vercel o'zi yig'adi va joylaydi. Kerakli sozlamalar ildizdagi `vercel.json` da: `installCommand`, `buildCommand: node tools/build.mjs`, `outputDirectory: dist/vercel`.

**B. Tashlab joylash (terminalsiz).** `npm run build` dan keyin `dist/SAFAR-vercel.zip` ni brauzerda [vercel.com/drop](https://vercel.com/drop) sahifasiga tashlang, loyiha nomini yozing, Deploy ni bosing. Vercel hisobi kerak. Eslatma: har bir tashlash alohida loyiha (alohida manzil) ochadi — doimiy manzil uchun A usuli.

Sayt: `index.html` (butun o'yin), `og.jpg`, `vercel.json` va A usulida `api/` funksiyalari (onlayn rejim, [13](#13-onlayn-rejim)). B usulida (zip) `api/` yo'q — u yerda onlayn "mavjud emas" bo'ladi.

**Ulashish rasmi.** Havola Telegram, WhatsApp, Facebook yoki X'da ulashilganda `og.jpg` chiqishi uchun sahifadagi `og:image` to'liq manzil (`https://…/og.jpg`) bo'lishi kerak — nisbiy `/og.jpg` bilan rasm chiqmasligi mumkin. A usulida buni yig'ish skripti o'zi qiladi: Vercel yig'ish paytida loyiha domenini `VERCEL_PROJECT_PRODUCTION_URL` o'zgaruvchisida beradi, `tools/build.mjs` esa sayt nusxasida (`dist/vercel/index.html`) `og:image` ni to'liq manzilga aylantiradi va domen Vercel'ning o'ziniki (`*.vercel.app`) bo'lsa `og:url` ham qo'shadi. `dist/SAFAR.html` bundan o'zgarmaydi. Kompyuterda yig'ilganda (B usuli) manzil noma'lum, shuning uchun `og:image` nisbiy qoladi.

- **O'z domeni ulansa:** `package.json` ga `"homepage": "https://domen"` yozing — u Vercel bergan manzildan ustun turadi, `og:url` ham shu manzil bilan chiqadi va kompyuterda yig'ilgan zip'ga ham tushadi. Sababi: Vercel eng qisqa domenni beradi, u esa boshqa domenga yo'naltirilgan bo'lishi mumkin (masalan, `domen.uz` → `www.domen.uz`) — `homepage` ga asosiy domenni yozing.
- **Eski ko'rinish:** Telegram havola ko'rinishini eslab qoladi. Rasm yoki matn o'zgargach, Telegram'da havolani @WebpageBot ga yuboring — ko'rinish yangilanadi.

---

## 7. Loyiha qoidalari

Egasining talablari — har qanday o'zgarishda saqlanadi:

1. **O'yin bitta HTML fayl.** Tashqi rasm, ovoz, shrift yoki skript yuklanmaydi; internet shart emas. *Istisno — faqat onlayn rejim* ([13](#13-onlayn-rejim)): saytda o'yinchi o'zi Onlayn oynasini ochganda Telegram kirish skripti, `api/` va PeerJS ulanadi; ularsiz o'yin to'liq ishlaydi.
2. **Foydalanuvchi terminal ishlatmaydi.** O'ynash — faylni ikki marta bosish; joylash — brauzerda.
3. **Barcha matn o'zbekcha (lotin).**
4. **Haqiqiy brendlar yo'q.** Transport nomlari va dizaynlari o'zimizniki.
5. **Musiqa va ovoz kodda sintez qilinadi** — YouTube'da Content ID da'vosi chiqmasligi uchun tayyor yozuv ishlatilmaydi.
6. **Sifat pasaymasin.** Standart grafika — eng yuqori pog'ona.
7. **Eski saqlovlar buzilmasin** ([4.9](#49-saqlash)).
8. **"Kasb Egalari" reklamasi:** faqat tasdiqlangan matnlar va `@kasb.egalari`; to'lov yoki kafolat haqida va'da yozilmaydi.
9. **Ish tartibi:** uzoq ishlarda har qadam soat bilan aytib boriladi va tugash vaqti ko'rsatiladi; jarayonda rasmlar ko'rsatiladi, tayyor fayl oxirida beriladi.

---

## 8. Tarix

### v2.0 — 2026-11-13, 17:56

| So'rov | Nima qilindi |
|---|---|
| Oynalardagi ✕ tugmasi ishlamayapti | oyna qobig'i qayta yozildi, tugma endi har doim bosiladi |
| Yo'lda toshlar, mashina haqiqiydek ta'sirlansin | toshlar yer balandligiga qo'shiladi ("bump"); 482 tasi olib tashlanadi |
| Vercel'ga joylash | statik paket, `vercel.json`, ulashish rasmi (`og.jpg`) |
| Bosh menyu boshqacha bo'lsin | kinematik menyu |
| Velosiped va yana 20 ga yaqin transport, pulga | 22 transport, salon |
| GTA'dagidek piyoda odam; uy va uni yaxshilash | piyoda qahramon, 5 darajali uy |
| "Shunga o'xshagan 50 ta imkoniyatni o'zing qo'sh" | 50 ta imkoniyat ([2.4](#24-piyoda-hayot--50-ta-imkoniyat)) |
| Yaxshilik va sakrash uchun tanga | savob, sakrash va drift mukofotlari |
| Mashina drift qilsin | qo'l tormozi bilan sirpanish |
| Urilganda haqiqiydek pachoqlansin, yurmay qolsin; ustaxona | mesh deformatsiyasi, motor o'chishi, evakuator, 5 ta ustaxona |
| O'yin cheksiz bo'lsin yoki qayta boshlansin | cheksiz ishlar, yo'lovchilar, "Yangi o'yin" |
| Rul juda sekin qaytadi | rul me'yorlashtirildi, tez qaytadi (0,12–0,15 s) |
| Grafikani o'ta kuchli qil | HDR post-ishlov, suv sheyderi, shamol, osmon aksi |
| Chetdagi to'rtburchaklarga "Kasb Egalari" reklamasi | tramplin devorlari + 17 bilbord |
| Tezlik/holat paneli haydash paytida ko'rinmayapti | sabab aniq topilmadi; ehtimol **P** (surat rejimi). Endi panelni yo'qotib bo'lmaydi: eslatma, 20 soniyada o'zi qaytadi |

Topshirishdan oldin qo'shimcha: moslashuvchan grafika qayta yozildi ([4.8](#48-moslashuvchan-grafika)), tor (telefon) ekranda xarita va panel ustma-ust tushmaydigan qilindi.

Repo tayyorlashda: yig'ish skripti ulashish rasmini va Vercel zip'ini o'zi yaratadigan bo'ldi, sinov vositalari boshqa kompyuterda ham ishlaydigan qilindi (`playwright-core`, `sharp`), sahifaga Three.js litsenziyasi haqida izoh qo'shildi.

### v1.0 — 2026-11-13, 13:15

Videodagidek low-poly sayohat o'yini: katta orol, 15 manzil, bitta jip, chellenjlar, tezlik va shikast, silliq relyef. Bitta `SAFAR.html`.

---

## 9. Tuzatilgan muhim xatolar

Qayta takrorlanmasligi uchun:

| Xato | Sababi va yechimi |
|---|---|
| Ikki g'ildirakli transport yiqilardi | tik tutuvchi moment ishorasi teskari edi |
| Mashinalar qop-qora ko'rinardi | osmon aksi (environment map) hech qachon yaratilmasdi — boshlang'ich qiymat xato edi |
| Qahramon fonari yonganda o'yin qotardi | chiroqlar soni o'zgarib, sheyderlar qayta kompilyatsiya bo'lardi; fonar endi sahnada doim turadi |
| Yo'lovchilar hech paydo bo'lmasdi | paydo bo'lish nuqtasi yo'lga juda yaqin edi va bo'sh joy tekshiruvidan o'tmasdi |
| Yassi qirg'oqda baliq ovi taklifi chiqmasdi | suvni qidirish masofasi qisqa edi |
| G'ildirak o'yiqlari ulkan qora silindr edi | o'q balandligi osma tepasidan olingan edi; endi g'ildirak markazidan |
| Vaqt sakraganda ekilgan daraxtga to'qnashuv jismi qo'yilmasdi | shart har bir daraxt uchun alohida tekshiriladigan qilindi |
| Muzko'lga cheksiz taksi vaqtida yetib bo'lmasdi | Muzko'l, Cho'qqi, Olovtog' cheksiz ishlar manzilidan chiqarildi |
| Boshqa oynaga o'tib qaytganda tasvir xiralashib borardi | uzilish "sekinlik" deb hisoblanardi va 60 Gs ekranda aniqlik qaytmasdi ([4.8](#48-moslashuvchan-grafika)) |
| Yer sheyderi kompilyatsiya bo'lmasdi | qo'shilgan kod `#define` bilan bir satrga tushib qolgan edi |

---

## 10. Tekshirilmagan narsalar va ma'lum cheklovlar

Sinovlar ekransiz brauzerda (dasturiy render) o'tgan. Quyidagilar **haqiqiy qurilmada tekshirilmagan**:

- haqiqiy videokartadagi tezlik (FPS) va moslashuvchan grafikaning amaldagi ishlashi (faqat simulyatsiya qilingan);
- ovoz va musiqa — quloq bilan;
- rul va driftning "his"i;
- haqiqiy telefondagi sensorli boshqaruv (sodda: tugmalar bor, kamerani barmoq bilan aylantirish yo'q);
- Vercel'ga joylashning o'zi (A ham, B ham);
- havola ulashilganda rasm va matnning Telegram, WhatsApp, Facebook'da chiqishi (sayt joylangach tekshiriladi).

Ma'lum cheklovlar:

- "Panel ko'rinmayapti" shikoyatining aniq sababi topilmagan ([8](#8-tarix)).
- `npm test` natijani jadval qilib chiqaradi, lekin o'zi "o'tdi/o'tmadi" demaydi — raqamlarni ko'z bilan qarash kerak.
- "Kasb Egalari" reklamasida logotip va sayt manzili yo'q.
- Litsenziya tanlanmagan (`package.json` da `UNLICENSED`).

---

## 11. Keyingi g'oyalar

- Mac uchun `.pkg` o'rnatuvchi (1–3 bosishda o'rnatiladigan).
- Reklamaga logotip va sayt manzili.
- Telefon uchun to'liq boshqaruv (kamera, kattaroq tugmalar).
- `npm test` ga aniq "o'tdi/o'tmadi" shartlari.

---

## 12. Uchinchi tomon kutubxonalari

| Kutubxona | Litsenziya | Qayerda |
|---|---|---|
| [Three.js](https://threejs.org) r170 | MIT | o'yin ichida (faylga qo'shib yig'iladi) |
| [esbuild](https://esbuild.github.io) | MIT | faqat yig'ishda |
| [playwright-core](https://playwright.dev) | Apache-2.0 | faqat sinovda |
| [sharp](https://sharp.pixelplumbing.com) | Apache-2.0 | faqat skrinshot varaqlari va xarita uchun |
| [PeerJS](https://peerjs.com) 1.5 | MIT | o'yin ichida — onlayn xona (WebRTC) |
| [peer](https://github.com/peers/peerjs-server) | MIT | faqat sinovda — mahalliy PeerJS brokeri |

---

## 13. Onlayn rejim

Saytda (`https://cargame-self.vercel.app`) o'yin onlayn imkoniyatlarga ega: **Telegram orqali kirish**, **bulutli saqlov**, **reyting** va **do'stlar bilan birga o'ynash** (2–4 kishi). Yuklab olingan `SAFAR.html` avvalgidek internetsiz to'liq ishlaydi — u yerda Onlayn oynasi "faqat sayt orqali ishlaydi" deb tushuntiradi. Internet uzilsa yoki server sozlanmagan bo'lsa ham o'yin buzilmaydi, faqat onlayn qismlar "mavjud emas" bo'ladi.

![Onlayn](docs/img/onlayn.jpg)

### 13.1. O'yinchi uchun

| Imkoniyat | Qanday ishlaydi |
|---|---|
| Kirish | Bosh menyu yoki pauza → **🌐 Onlayn** (yoki **O**) → "Log in with Telegram" tugmasi. Telefon raqami yoki parol so'ralmaydi — Telegram o'zi tasdiqlaydi |
| Eski o'yinni ulash | Kirgan zahoti shu qurilmadagi o'yin hisobga biriktiriladi — **noldan boshlanmaydi**. Hisobda boshqa saqlov bo'lsa, ikkalasining puli, yulduzi, darajasi va o'ynalgan vaqti ko'rsatilib, qaysi biri davom etishi so'raladi |
| Bulutli saqlov | O'yin har saqlanganda (ko'pi bilan 45 soniyada bir marta) va sahifa yopilganda bulutga yoziladi. Boshqa kompyuter yoki telefonda kirsangiz — o'sha o'yin ochiladi. Brauzerdagi saqlov ham qoladi |
| Reyting | Onlayn → **🏆 Reyting**: yulduzlar, daraja va har bir poyga, drift/buzish zonasi, radar, tramplin bo'yicha eng yaxshi 20 sayyoh. Rekordlar o'zi yuboriladi |
| Xona | **＋ Xona ochish** → 6 belgili kod (masalan `K7MP2Q`) chiqadi. Do'stingiz kodni kiritadi yoki **havolani** (`…?xona=K7MP2Q`) ochadi. Ko'pi bilan 4 kishi. Kirmagan o'yinchi ham mehmon sifatida qo'shila oladi |
| Birga sayohat | Har kim o'z transportida (o'z bo'yog'i bilan) yoki piyoda ko'rinadi, boshida ism yorlig'i. Mini-xarita va katta xaritada do'stlar rangli nuqta. "Yoniga borish" — do'stingiz oldiga ko'chish. Kun vaqti xona egasiniki bilan bir xil |
| Birga poyga | Xona egasi (👑) poygani tanlaydi → hamma start chizig'ida yonma-yon turadi, umumiy sanoq, panelda "O'rin: 2/3". Oxirida natija jadvali |
| Chat | **K** — yozish, Enter — yuborish; tez emojilar (👋 😂 👍 🔥 😎 🏁 ❤️ 😮) do'stingiz boshi ustida ham chiqadi |
| Uzilish | Kimdir chiqsa — xabar chiqadi. Xona egasi chiqsa, egalik keyingi o'yinchiga o'tadi va xona kodi ishlayveradi |

### 13.2. Qanday tuzilgan

```
brauzer (o'yin)  ──HTTPS──▶  Vercel funksiyalari api/*.js  ──REST──▶  Upstash Redis (saqlov, reyting)
      │                         ▲
      │                         └── Telegram imzosi bot tokeni bilan serverda tekshiriladi
      └──WebRTC (to'g'ridan-to'g'ri)──▶ do'stlar brauzeri      (tanishtirish: PeerJS brokeri, STUN)
```

| Fayl | Vazifasi |
|---|---|
| `api/_lib.js` | umumiy: JSON javob, so'rov tanasi, sessiya tokeni (HS256 JWT, `node:crypto`), Telegram imzosi, Upstash REST, tezlik cheklovi |
| `api/config.js` | `GET` — bot nomi, nima yoqilgani, PeerJS brokeri va STUN/TURN ro'yxati (sirsiz) |
| `api/auth.js` | `POST` — Telegram ma'lumotini tekshiradi (HMAC-SHA256, kalit = SHA256(bot token), 24 soatdan eski emas) → 30 kunlik sessiya; `GET` — sessiya amal qiladimi |
| `api/save.js` | `GET/PUT` — har Telegram foydalanuvchisiga bitta saqlov (`safar_save_v2` formati, `v: 2`, 200 KB gacha). Saqlanganda yulduz/daraja reytingi server tomonda saqlovdan hisoblanadi |
| `api/top.js` | `GET ?id=` — eng yaxshi 20 ta; `POST` — rekordlar. Chellenj turi va aqlga sig'adigan chegaralar serverda (`acts.js` → `actKinds()`), har o'yinchining eng yaxshisi saqlanadi |
| `src/net.js` | o'yin tomoni: config, kirish (Telegram skripti faqat Onlayn oynasi ochilganda yuklanadi), bulut bilan solishtirish va avtomatik yuklash, rekordlarni yuborish |
| `src/coop.js` | xona: PeerJS ulanishlari (har kim har kim bilan), holat paketlari (15 marta/s), boshqa o'yinchilarni silliq chizish (120 ms orqada oraliqlash + qisqa ekstrapolyatsiya), chat, birga poyga, egalik o'tishi, yumshoq to'qnashuv |
| `src/onlineui.js` | oynalar: Onlayn, saqlov tanlovi, Reyting, poyga natijasi; HUD'dagi `🌐 KOD 2/4` belgisi |
| `tools/dev-server.mjs` | mahalliy "Vercel": `dist/vercel` + `api/` + soxta Redis + mahalliy PeerJS brokeri (`npm run dev`) |

Muhim qarorlar:

- **Kim nimani hisoblaydi.** Har o'yinchi o'z transporti fizikasini o'zi hisoblaydi (bitta o'yinchi fizikasi o'zgarmagan — `npm test` jadvali aynan bir xil). Xona egasi umumiy narsalarga hakam: kun vaqti, poyga starti va natija jadvali, kim qaysi joyda.
- **Boshqa o'yinchi modeli** — o'yindagi haqiqiy transport modellari (`buildVehicle(id, {lite: true})`) va odam modeli (`makeRig` + `poseRig`). Ularning chirog'i olib tashlanadi — sahnadagi chiroqlar soni o'zgarmaydi (aks holda sheyderlar qayta kompilyatsiya bo'lib o'yin qotadi).
- **Xona kodi** = xona egasining PeerJS id'si (`safarxona-<kod>`). Ega chiqsa, keyingi o'yinchi shu id'ni qayta egallaydi.
- **Xavfsizlik.** Shaxsni server faqat imzolangan sessiyadan biladi; bot tokeni va sessiya siri brauzerga chiqmaydi. Saqlov hajmi 200 KB bilan, so'rovlar IP/foydalanuvchi bo'yicha cheklangan. Reytingda imkonsiz natijalar (masalan, 3 soniyalik poyga) rad etiladi — lekin to'liq firibgarlikdan himoya emas (o'yin brauzerda hisoblanadi).

### 13.3. Egasi uchun: bir martalik sozlash

Terminal kerak emas — hammasi brauzerda.

**1. Telegram bot (kirish uchun)**

1. Telegram'da **@BotFather** ni oching → `/newbot` → bot nomi (masalan, `SAFAR o'yini`) → bot manzili (`..._bot` bilan tugaydi, masalan `safar_oyin_bot`). BotFather **token** beradi (`1234567890:AA...`) — uni hech kimga ko'rsatmang.
2. Shu yerda `/setdomain` → botingizni tanlang → `cargame-self.vercel.app` deb yozing. (Busiz kirish tugmasi "Bot domain invalid" deydi.)

**2. Bulut bazasi (saqlov va reyting uchun)**

1. vercel.com → loyiha (cargame-self) → **Storage** → **Create Database** → **Upstash for Redis** (bepul reja) → yarating va loyihaga ulang (**Connect Project**). Vercel `KV_REST_API_URL` va `KV_REST_API_TOKEN` ni o'zi qo'shadi.

**3. Muhit o'zgaruvchilari**

Vercel → loyiha → **Settings** → **Environment Variables** → har birini qo'shing (Production, Preview, Development belgilansin):

| Nomi | Qiymati |
|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather bergan token |
| `TELEGRAM_BOT_USERNAME` | bot manzili, `@` siz (masalan `safar_oyin_bot`) |
| `SESSION_SECRET` | istalgan uzun tasodifiy matn (32+ belgi). Berilmasa token asosida hosil qilinadi, lekin alohida qo'ygan ma'qul |

Ixtiyoriy: `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` — TURN server (qattiq tarmoqlarda ulanish uchun, 13.4 ga qarang); `PEER_HOST`, `PEER_PORT`, `PEER_PATH`, `PEER_SECURE`, `PEER_KEY` — o'z PeerJS brokeringiz (bo'lmasa bepul ommaviy `0.peerjs.com`).

**4. Qayta joylash.** Vercel → **Deployments** → oxirgisi → **⋯ → Redeploy** (o'zgaruvchilar faqat yangi joylashda kuchga kiradi). Tekshirish: `https://cargame-self.vercel.app/api/config` sahifasida `"login":true,"save":true` bo'lishi kerak.

Biror qadam qilinmasa nima bo'ladi: bot yo'q — kirish tugmasi o'rniga "hali sozlanmagan" yozuvi, lekin xona/birga o'ynash mehmon sifatida ishlaydi; baza yo'q — kirish ishlaydi, bulut va reyting "ulanmagan".

### 13.4. Cheklovlar

- **NAT/TURN.** Ulanish to'g'ridan-to'g'ri (WebRTC). Uy va mobil internetda odatda ishlaydi; ba'zi korporativ/maktab tarmoqlari yoki ikki tomonda ham "qattiq NAT" bo'lsa, TURN serversiz ulanmaydi. TURN (masalan, Cloudflare Calls TURN yoki metered.ca) `TURN_*` o'zgaruvchilari bilan qo'shiladi.
- **Ommaviy PeerJS brokeri** (`0.peerjs.com`) bepul va kafolatsiz: u ishlamay qolsa xona ochilmaydi (o'yinning o'zi ishlayveradi). Kerak bo'lsa o'z brokeringiz (`npm` paketi `peer`) istalgan serverda ishga tushirilib, `PEER_*` bilan ulanadi.
- Har o'yinchi o'z dunyosini hisoblaydi: do'stlarning transporti ko'rinadi va itaradi, lekin yo'ldagi boshqa mashinalar, tangalar, sandiqlar, tosh va qutilar har kimda alohida. Shikast/pachoqlanish do'stlarga ko'rinmaydi.
- Reyting "aqlga sig'adigan chegara" bilan tekshiriladi, lekin brauzer o'yini bo'lgani uchun mohir firibgarni to'liq to'xtatmaydi.
- Kirishdan keyin bulutdagi saqlov olinganda sahifa bir marta qayta yuklanadi.
- Haqiqiy Telegram bilan kirish va Vercel'dagi funksiyalar bu muhitda sinalmagan (Telegram va vercel.app ochilmaydi) — imzo algoritmi sinov tokeni bilan, funksiyalar mahalliy serverda sinalgan.

### 13.5. Sinov

| Buyruq | Nimani tekshiradi | Vaqt |
|---|---|---|
| `npm run test:api` | `api/` funksiyalari: Telegram imzosi (to'g'ri/buzilgan/eski), sessiya tokeni (`alg:none` hujumi ham), saqlov (200 KB, format), reyting (chegaralar, tartib, eng yaxshisi saqlanishi), tezlik cheklovi, sozlanmagan muhit | ~1 s |
| `npm run test:online` | ekransiz Chrome'da 4 o'yinchi: kirish, bulutga yuklash, boshqa qurilmada olish, tanlov oynasi, reyting, xona/kod, bir-birini ko'rish (skrinshot), chat (HTML bajarilmaydi), birga poyga va natija, egalik o'tishi, yuklab olingan faylda "mavjud emas". Avval `npm run build` | ~5–8 daq |
| `npm run dev` | mahalliy sayt `http://127.0.0.1:8787` (sinov boti, xotiradagi baza, mahalliy broker) | — |
