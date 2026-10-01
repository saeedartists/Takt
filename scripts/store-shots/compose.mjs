// Store-shot compositor: places the app captures (store-assets/app-captures/{en,de}) into CSS-drawn
// phone frames on brand backgrounds and renders every store size at true pixel size.
//   PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs node scripts/store-shots/compose.mjs
// Writes store-assets/screenshots/iphone-{6.9,6.5}/{en,de}, store-assets/play/…, store-assets/preview.html.
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SA = path.join(ROOT, 'store-assets');
const CAP = path.join(SA, 'app-captures');
const TMP = path.join(SA, '.compose.html');

const C = { paper: '#F5F2ED', ink: '#15171C', apricot: '#FAD6B4', sage: '#CDE6D0', sky: '#CFE2F3', lilac: '#DDD7F6', butter: '#F7E8A4', rose: '#F6D0CB',
  apricotD: '#B4611C', sageD: '#1F6F4A', skyD: '#245C8A', lilacD: '#4B3F99', butterD: '#7A5B00', orange: '#E8894A' };

// ---------- the set: screens, layout and copy ----------
// crop = per language [capture, x, y, w, h] in capture CSS px (440x956 space) for close-up callouts;
// re-measure if the captured layout changes (German strings wrap differently).
const SHOTS = [
  { id: '01-today', bg: C.apricot, deep: C.apricotD, layout: 'hero', screens: ['today'], brand: true,
    en: ['Your medicines, in rhythm.', 'Today’s doses at a glance, confirmed in one tap.'],
    de: ['Ihre Medikamente im Takt.', 'Die Dosen von heute auf einen Blick\u00A0– mit einem Tipp bestätigt.'] },
  { id: '02-reminders', bg: C.sky, deep: C.skyD, layout: 'zoom', screens: ['medication-detail'], crop: { en: ['reminders', 20, 74, 400, 202], de: ['reminders', 20, 74, 400, 229] },
    en: ['Never miss a dose', 'A clear reminder for every dose, right on your lock screen.'],
    de: ['Keine Dosis verpassen', 'Eine klare Erinnerung zu jeder Dosis\u00A0– direkt auf dem Sperrbildschirm.'] },
  { id: '03-medications', bg: C.paper, deep: C.apricotD, layout: 'duo', screens: ['today-dark', 'medications'],
    en: ['All your pills, one place', 'Shapes and colours you recognise at a glance.'],
    de: ['Alle Medikamente an einem Ort', 'Form und Farbe, wie Sie sie kennen.'] },
  { id: '04-refills', bg: C.butter, deep: C.butterD, layout: 'zoom', screens: ['refills'], crop: { en: ['medications', 20, 189, 400, 114], de: ['medications', 20, 189, 400, 114] },
    en: ['Refill before you run out', 'Takt counts your supply and tells you in time.'],
    de: ['Rechtzeitig nachfüllen', 'Takt zählt Ihren Vorrat und sagt früh genug Bescheid.'] },
  { id: '05-week', bg: C.lilac, deep: C.lilacD, layout: 'duo', screens: ['history-scrolled', 'week'],
    en: ['See how your week went', 'A calm look back, day by day.'],
    de: ['Ihre Woche im Blick', 'Ein ruhiger Rückblick, Tag für Tag.'] },
  { id: '06-report', bg: C.sage, deep: C.sageD, layout: 'tilt', screens: ['report'],
    en: ['Ready for your doctor', 'A clear report to share, print or save as PDF.'],
    de: ['Bereit für den Arztbesuch', 'Ein klarer Bericht zum Teilen, Drucken oder als PDF.'] },
  { id: '07-diary', bg: C.paper, deep: C.lilacD, layout: 'tilt-r', screens: ['diary'], accent: C.lilac,
    en: ['How you feel, noted', 'One tap a day. Your notes stay on your phone.'],
    de: ['Ihr Befinden, notiert', 'Ein Tipp am Tag. Ihre Notizen bleiben auf dem Gerät.'] },
  { id: '08-care', bg: C.ink, deep: C.apricot, layout: 'hero', screens: ['care-dark'], dark: true,
    en: ['Your care team, close by', 'Doctor, pharmacy and your next visit in one place.'],
    de: ['Ihr Behandlungsteam, griffbereit', 'Praxis, Apotheke und nächster Termin an einem Ort.'] },
];

const SIZES = [
  { dir: 'screenshots/iphone-6.9', W: 1320, H: 2868 },
  { dir: 'screenshots/iphone-6.5', W: 1284, H: 2778 },
  { dir: 'play/phone', W: 1080, H: 1920 },
];

// ---------- phone frame ----------
// The web capture has no status bar or home indicator, so the frame adds both around it.
const SB = 54, HB = 24; // CSS px added above / below the 440x956 capture
const SCREEN_AR = (956 + SB + HB) / 440;
const capUrl = (lang, name) => `app-captures/${lang}/${name}.png`;
function phone(lang, name, sw, { dark = false } = {}) {
  const k = sw / 440; const b = Math.round(sw * 0.034); const sh = Math.round(sw * SCREEN_AR);
  const top = dark ? '#0F1115' : C.paper; const bottom = dark ? '#16181D' : '#FFFFFF'; const fg = dark ? '#F5F2ED' : C.ink;
  const bars = `<svg viewBox="0 0 68 14" style="height:${12 * k}px"><g fill="${fg}"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/>
    <path d="M30 4.5a10 10 0 0 1 13 0l-1.6 1.7a7.6 7.6 0 0 0-9.8 0zM33 7.8a5.6 5.6 0 0 1 7 0l-1.6 1.7a3.3 3.3 0 0 0-3.8 0zM36.5 11.2l1.5 1.6-1.5 1.5-1.5-1.5z"/>
    <rect x="49" y="1.5" width="16" height="11" rx="3" fill="none" stroke="${fg}" stroke-width="1.2" opacity=".5"/><rect x="51" y="3.5" width="11" height="7" rx="1.6"/><rect x="66" y="5" width="1.6" height="4" rx=".8" opacity=".5"/></g></svg>`;
  return `<div class="phone" style="width:${sw + 2 * b}px;height:${sh + 2 * b}px;padding:${b}px;border-radius:${sw * 0.16}px">
    <div class="screen" style="border-radius:${sw * 0.16 - b}px;background:${bottom}">
      <div class="status" style="height:${SB * k}px;background:${top};color:${fg};font-size:${16.5 * k}px;padding:0 ${34 * k}px 0 ${44 * k}px">
        <span>12:04</span>${bars}</div>
      <div class="island" style="width:${122 * k}px;height:${35 * k}px;top:${11 * k}px"></div>
      <img src="${capUrl(lang, name)}" style="width:${sw}px;height:${956 * k}px">
      <div class="home" style="width:${140 * k}px;height:${5 * k}px;bottom:${8 * k}px;background:${fg}"></div>
    </div></div>`;
}
function callout(lang, [name, x, y, w, h], cw, u = 1) {
  const k = cw / w;
  return `<div class="callout" style="width:${cw}px;height:${h * k}px;border-radius:${30 * k}px;background-image:url(${capUrl(lang, name)});background-size:${440 * k}px ${956 * k}px;background-position:${-x * k}px ${-y * k}px;box-shadow:0 0 0 ${10 * u}px rgba(255,255,255,.75),0 50px 100px -30px rgba(21,23,28,.35)"></div>`;
}
// The brand capsule, as a soft background motif.
const capsule = (w, a, b, rot, extra = '') => `<div class="capsule" style="width:${w}px;height:${w * 0.42}px;transform:rotate(${rot}deg);${extra}"><i style="background:${a}"></i><i style="background:${b}"></i></div>`;

function shotHtml(s, lang, { W, H }) {
  const u = W / 1320; // type and spacing scale with width
  const play = H / W < 1.9; // 9:16 canvas: less height, so smaller phones
  const [title, sub] = s[lang];
  const ink = s.dark ? C.paper : C.ink;
  const pad = 96 * u; const textTop = (play ? 110 : 170) * u;
  const titleSize = (play ? 104 : 118) * u;
  let stage = '';
  // Copy sits in flow at the top; phones are placed relative to the stage below it, so a
  // two-line headline pushes the phones down instead of colliding with them.
  const shapeA = s.dark ? '#2A2D35' : 'rgba(255,255,255,.45)';
  const motif = s.accent || (s.dark ? '#22252C' : 'rgba(255,255,255,.5)');
  const g = play ? 0.8 : 1; // vertical offsets shrink on the shorter Play canvas
  let back = '';
  if (s.layout === 'hero') {
    const sw = (play ? 680 : 860) * u;
    back = capsule(1500 * u, C.orange, s.dark ? C.apricot : '#FFF4EA', -38, `left:${-380 * u}px;bottom:${(play ? 120 : 260) * u}px;opacity:${s.dark ? 0.16 : 0.32}`);
    stage = `<div class="ph" style="left:50%;top:${90 * g * u}px;transform:translateX(-50%)">${phone(lang, s.screens[0], sw, { dark: s.dark })}</div>`;
  } else if (s.layout === 'tilt' || s.layout === 'tilt-r') {
    const sw = (play ? 680 : 840) * u; const r = s.layout === 'tilt' ? -5 : 5;
    back = capsule(1300 * u, motif, shapeA, r > 0 ? 38 : -38, `${r > 0 ? 'left' : 'right'}:${-420 * u}px;top:${(play ? 640 : 900) * u}px;opacity:.9`);
    stage = `<div class="ph" style="left:50%;top:${110 * g * u}px;transform:translateX(-50%) rotate(${r}deg)">${phone(lang, s.screens[0], sw)}</div>`;
  } else if (s.layout === 'duo') {
    const sw = (play ? 620 : 780) * u; // staggered: back phone high-left, front phone low-right, both bleed off the bottom
    back = capsule(1200 * u, s.bg === C.paper ? C.apricot : 'rgba(255,255,255,.5)', s.bg === C.paper ? '#FCE7D3' : 'rgba(255,255,255,.3)', -38, `left:${-300 * u}px;top:${(play ? 560 : 820) * u}px`);
    stage = `<div class="ph" style="left:${(play ? 40 : 60) * u}px;top:${40 * g * u}px;transform:rotate(-5deg)">${phone(lang, s.screens[0], sw, { dark: s.screens[0].endsWith('-dark') })}</div>`
      + `<div class="ph front" style="right:${(play ? 40 : 60) * u}px;top:${(play ? 220 : 330) * u}px;transform:rotate(3deg)">${phone(lang, s.screens[1], sw)}</div>`;
  } else if (s.layout === 'zoom') {
    const sw = (play ? 720 : 900) * u; const cw = (play ? 900 : 1120) * u; const crop = s.crop[lang]; const ch = cw / crop[3] * crop[4];
    back = capsule(1200 * u, 'rgba(255,255,255,.55)', 'rgba(255,255,255,.3)', -38, `right:${-420 * u}px;top:${(play ? 500 : 640) * u}px`);
    stage = `<div class="ph" style="left:50%;top:${70 * g * u + ch * 0.62}px;transform:translateX(-50%)">${phone(lang, s.screens[0], sw)}</div>`
      + `<div class="co" style="left:50%;top:${70 * g * u}px;transform:translateX(-50%) rotate(-2deg)">${callout(lang, crop, cw, u)}</div>`;
  }
  const brand = s.brand ? `<div class="mark" style="font-size:${78 * u}px;margin-bottom:${36 * u}px"><img src="../assets/icon.png" style="width:${104 * u}px;height:${104 * u}px;border-radius:${28 * u}px"><b>takt<span>.</span></b></div>` : '';
  return `<div class="canvas" style="width:${W}px;height:${H}px;background:${s.bg};color:${ink};display:flex;flex-direction:column">
    ${back}
    <div class="copy" style="padding:${textTop}px ${pad}px 0">
      ${brand}
      <h1 style="font-size:${titleSize}px">${title}</h1>
      <p style="font-size:${(play ? 44 : 50) * u}px;margin-top:${28 * u}px;color:${s.dark ? 'rgba(245,242,237,.72)' : 'rgba(21,23,28,.68)'}">${sub}</p>
    </div>
    <div class="stage">${stage}</div></div>`;
}

function featureHtml(lang) {
  const tag = { en: 'Your medicines, in rhythm.', de: 'Ihre Medikamente im Takt.' }[lang];
  const line = { en: 'Reminders, refills and a report for your doctor.', de: 'Erinnerungen, Vorrat und ein Bericht für die Praxis.' }[lang];
  return `<div class="canvas" style="width:1024px;height:500px;background:${C.apricot};color:${C.ink}">
    ${capsule(600, C.orange, '#FFF4EA', -38, 'right:-40px;top:110px;opacity:.28')}
    <div style="position:absolute;left:96px;top:0;bottom:0;width:430px;display:flex;flex-direction:column;justify-content:center;z-index:5">
      <div class="mark" style="font-size:44px;margin-bottom:24px"><img src="../assets/icon.png" style="width:64px;height:64px;border-radius:17px"><b>takt<span>.</span></b></div>
      <h1 style="font-size:46px">${tag}</h1>
      <p style="font-size:21px;margin-top:14px;color:rgba(21,23,28,.7)">${line}</p>
    </div>
    <div class="co" style="right:96px;top:122px;transform:rotate(4deg)">${callout(lang, { en: ['today', 20, 226, 400, 256], de: ['today', 20, 226, 400, 256] }[lang], 360, 0.5)}</div>
  </div>`;
}

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Figtree:wght@500;600;700&display=block');
*{margin:0;padding:0;box-sizing:border-box} html,body{background:#000}
.canvas{position:relative;overflow:hidden;font-family:Figtree,sans-serif;-webkit-font-smoothing:antialiased}
.copy{position:relative;z-index:5;text-align:center;flex:none}.stage{position:relative;flex:1}
h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.018em;line-height:1.04;text-wrap:balance}
p{font-weight:500;line-height:1.3;text-wrap:balance}
.mark{display:inline-flex;align-items:center;gap:.36em;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;letter-spacing:-.03em}
.mark b{font-weight:inherit}.mark span{color:${C.orange}}
.ph,.co{position:absolute;z-index:2}.front{z-index:3}
.phone{background:#15171C;box-shadow:0 0 0 2px #2B2E36 inset,0 60px 120px -30px rgba(21,23,28,.38),0 24px 48px -16px rgba(21,23,28,.25)}
.screen{position:relative;width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column}
.screen img{display:block;flex:none}
.status{display:flex;align-items:center;justify-content:space-between;font-weight:700;flex:none;letter-spacing:.01em}
.island{position:absolute;left:50%;transform:translateX(-50%);background:#000;border-radius:999px}
.home{position:absolute;left:50%;transform:translateX(-50%);border-radius:999px;opacity:.85}
.callout{background-repeat:no-repeat;box-shadow:0 50px 100px -30px rgba(21,23,28,.35),0 18px 40px -12px rgba(21,23,28,.22)}
.capsule{position:absolute;display:flex;border-radius:999px;overflow:hidden;z-index:1}.capsule i{flex:1}`;

const page0 = (body) => `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body>${body}</body>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const page = await ctx.newPage();
async function render(html, W, H, out) {
  fs.writeFileSync(TMP, page0(html));
  await page.setViewportSize({ width: W, height: H });
  await page.goto('file://' + TMP);
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map((i) => i.decode().catch(() => {}))); });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
  console.log('wrote', path.relative(ROOT, out));
}

const only = process.env.ONLY; // e.g. ONLY=03 to re-render one shot while iterating
for (const size of SIZES) for (const lang of ['en', 'de']) for (const s of SHOTS) {
  if (only && !s.id.startsWith(only)) continue;
  await render(shotHtml(s, lang, size), size.W, size.H, path.join(SA, size.dir, lang, `${s.id}.png`));
}
if (!only) {
  for (const lang of ['en', 'de']) await render(featureHtml(lang), 1024, 500, path.join(SA, `play/feature-graphic-${lang}.png`));
  await render(`<img src="../assets/icon.png" style="display:block;width:512px;height:512px">`, 512, 512, path.join(SA, 'play/icon-512.png'));
  // Contact sheet.
  const files = (d) => fs.existsSync(path.join(SA, d)) ? fs.readdirSync(path.join(SA, d)).filter((f) => f.endsWith('.png')).sort().map((f) => `${d}/${f}`) : [];
  const row = (title, list, h) => `<h2>${title}</h2><div class="row">${list.map((f) => `<a href="${f}"><img src="${f}" style="height:${h}px"><span>${path.basename(f)}</span></a>`).join('')}</div>`;
  const sheet = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Takt store assets</title>
<style>body{margin:0;padding:32px 16px 64px;background:${C.paper};color:${C.ink};font:15px/1.4 -apple-system,system-ui,sans-serif}h1{font-size:28px;margin:0 0 4px}h2{font-size:17px;margin:36px 0 12px}
.row{display:flex;gap:16px;overflow-x:auto;padding-bottom:8px}.row a{flex:none;color:inherit;text-decoration:none;font-size:12px;text-align:center}.row img{display:block;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,.12);margin-bottom:6px}</style>
<h1>Takt store assets</h1><p>App Store (iPhone 6.9" 1320×2868, 6.5" 1284×2778) and Google Play (phone 1080×1920, feature graphic 1024×500, icon 512×512). Regenerate with <code>scripts/store-shots</code>.</p>
${['en', 'de'].map((l) => row(`App Store 6.9" · ${l.toUpperCase()}`, files(`screenshots/iphone-6.9/${l}`), 420) + row(`App Store 6.5" · ${l.toUpperCase()}`, files(`screenshots/iphone-6.5/${l}`), 300) + row(`Google Play phone · ${l.toUpperCase()}`, files(`play/phone/${l}`), 360)).join('')}
${row('Google Play feature graphic & icon', [...files('play').filter((f) => /feature|icon/.test(f))], 250)}`;
  fs.writeFileSync(path.join(SA, 'preview.html'), sheet);
}
fs.rmSync(TMP, { force: true });
await browser.close();
