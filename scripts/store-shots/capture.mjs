// Store-shot capture: drives the Expo web build (demo/mock mode) through a realistic week of use,
// then screenshots each screen at 440x956 @3x (= 1320x2868) in English and German.
// Needs Metro on :8081 (npx expo start --web) and playwright-core:
//   PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs node scripts/store-shots/capture.mjs
// Output: store-assets/app-captures/{en,de}/<screen>.png  (then run compose.mjs)
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
import { makeHelpers } from '../e2e/e2e-lib.mjs';
import { captureAll } from './screens.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'store-assets/app-captures');
const DBG = process.env.DBG; // optional debug screenshot dir
const BASE = 'http://localhost:8081';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light' });
await ctx.addInitScript(() => { try { localStorage.setItem('takt:tour-seen:v1', '1'); } catch {} });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
page.on('pageerror', (e) => console.log('pageerror:', e.message.slice(0, 160)));
page.on('dialog', (d) => d.dismiss().catch(() => {}));
const H = makeHelpers(page);
const { see, tapBtn, input, btnCount } = H;
// Tab switch that first backs out of any stacked screen (stack screens hide the tab bar).
async function tab(route) {
  for (let i = 0; i < 4 && !(await page.locator(`a[href="/${route}"]`).filter({ visible: true }).count()); i++) { await page.goBack(); await page.waitForTimeout(700); }
  await H.tab(route);
}

// "Today" in the shots is a fixed Thursday mid-month (so the History calendar is full); two weeks of
// history are built before it. Override with SHOT_DATE=YYYY-MM-DD.
const DAY0 = process.env.SHOT_DATE || '2026-10-15';
const DAYS_BACK = 14;
const at = (h, m, off = 0) => { const d = new Date(`${DAY0}T00:00:00`); d.setDate(d.getDate() + off); d.setHours(h, m, 0, 0); return d; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
let dbgN = 0;
const dbg = async (name) => { if (DBG) await page.screenshot({ path: `${DBG}/${String(++dbgN).padStart(2, '0')}-${name}.png` }); };
async function clock(h, m, off) { await page.clock.setFixedTime(at(h, m, off)); await tab('medications'); await tab('today'); await page.waitForTimeout(800); }

// ---------- onboarding ----------
await page.clock.setFixedTime(at(7, 30, -DAYS_BACK));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);
{
  const cb = page.getByRole('checkbox').filter({ visible: true }); if (await cb.count()) await cb.first().click();
  await tapBtn(/^I agree and continue$/, 'accept'); await page.waitForTimeout(1800);
  if (await btnCount(/^Skip$/)) { await tapBtn(/^Skip$/); await page.waitForTimeout(1000); }
}

// ---------- medications ----------
async function addMed({ name, strength, times = ['08:00'], shape, color, food, asNeeded, supply }) {
  await tab('medications'); await tapBtn(/^Add medication$|^Add$/, 'Add'); await see(/Medication details/);
  await (await input(0)).fill(name); await (await input(1)).fill(strength);
  // "Capsule" is both a form chip and a shape chip: set both (form first, shape second).
  if (shape === 'Capsule') { await tapBtn(/^Capsule$/); await tapBtn(/^Capsule$/, 'shape', (await btnCount(/^Capsule$/)) - 1); }
  else if (shape) await tapBtn(new RegExp(`^${shape}$`));
  if (color) await tapBtn(new RegExp(`^${color}$`));
  if (asNeeded) { await tapBtn(/^As needed$/); await (await input(0, /^3$/)).fill('3'); }
  else {
    if (!times.includes('08:00')) await tapBtn(/^Remove 08:00|^08:00$/);
    for (const t of times) if (t !== '08:00') await tapBtn(new RegExp(`^${t}$`));
  }
  if (food) await tapBtn(/^With food$/);
  if (supply != null) { const s = page.locator('input[aria-label="Supply count"]').filter({ visible: true }).first(); await s.scrollIntoViewIfNeeded(); await s.fill(String(supply)); }
  await tapBtn(/^Save$/); await page.waitForTimeout(1400);
}
await addMed({ name: 'Ramipril', strength: '5 mg', times: ['08:00', '18:00'], shape: 'Oval', color: '#E07D2C', food: true, supply: 35 });
await addMed({ name: 'Vitamin D3', strength: '1000 IU', times: ['08:00'], shape: 'Capsule', color: '#E9C46A', supply: 90 });
await addMed({ name: 'Metformin', strength: '500 mg', times: ['12:00'], shape: 'Round', color: '#F1ECE2', food: true, supply: 56 });
await addMed({ name: 'Atorvastatin', strength: '20 mg', times: ['22:00'], shape: 'Round', color: '#E8A0BF', supply: 30 });
await addMed({ name: 'Ibuprofen', strength: '400 mg', asNeeded: true, shape: 'Capsule', color: '#4A78C2', supply: 20 });
await dbg('meds');

// ---------- a week of use ----------
async function confirmDue() {
  for (let i = 0; i < 4; i++) {
    if (await btnCount(/^Confirm all \d+/)) { await tapBtn(/^Confirm all \d+/); await page.waitForTimeout(1500); continue; }
    if (await btnCount(/^Taken, /)) { await tapBtn(/^Taken, /); await page.waitForTimeout(1300); continue; }
    break;
  }
  if (await btnCount(/^Dismiss$/)) await tapBtn(/^Dismiss$/);
}
const MOOD_CYCLE = ['Good', 'Very good', 'Good', 'Okay', 'Good', 'Very good', 'Good'];
const MOODS = Object.fromEntries(Array.from({ length: DAYS_BACK + 1 }, (_, i) => [String(-i), MOOD_CYCLE[i % 7]]));
const SKIP = new Set(['-11@12', '-8@22', '-2@12']); // a few slips, so it reads like real life
async function mood(off) {
  const m = MOODS[String(off)];
  if (!(await btnCount(new RegExp(`^Mood: ${m}$`)))) return;
  await tapBtn(new RegExp(`^Mood: ${m}$`)); await page.waitForTimeout(700);
  if ((off === -3 || off === -10) && (await btnCount(/^Tired$/))) await tapBtn(/^Tired$/);
  if (await btnCount(/^Done$/)) await tapBtn(/^Done$/);
}
for (let off = -DAYS_BACK; off <= 0; off++) {
  for (const [h, m] of [[8, 4], [12, 3], [18, 6], [22, 2]]) {
    if (off === 0 && h > 8) break;
    await clock(h, m, off);
        if (h === 8) await mood(off);
    if (!SKIP.has(`${off}@${h}`)) await confirmDue();
    if (off === -3 && h === 12 && (await btnCount(/^Log dose, Ibuprofen/))) await tapBtn(/^Log dose, Ibuprofen/);
  }
  await dbg(`day${off}`);
}
await clock(12, 4, 0); // shoot time: morning done, midday dose due
await dbg('today');

// ---------- care team ----------
await tab('settings'); await tapBtn(/^Care team, /, 'care'); await page.waitForTimeout(800);
await tapBtn(/^Add contact$/); await page.waitForTimeout(600);
await (await input(0, /Dr\. Weber/)).fill('Dr. Anna Weber');
await tapBtn(/^Doctor$/);
await (await input(0, /\+49/)).fill('+49 30 2345 6780');
await (await input(0, /Opening hours/)).fill('Praxis am Park');
await tapBtn(/^Save$/); await page.waitForTimeout(1000);
await tapBtn(/^Add contact$/); await page.waitForTimeout(600);
await (await input(0, /Dr\. Weber/)).fill('Apotheke am Markt');
await tapBtn(/^Pharmacy$/);
await (await input(0, /\+49/)).fill('+49 30 8765 4321');
await tapBtn(/^Save$/); await page.waitForTimeout(1000);
await tapBtn(/^Add appointment$/); await page.waitForTimeout(600);
await (await input(0, /Blood pressure/)).fill('Check-up');
await tapBtn(/^Dr\. Anna Weber$/);
await page.locator('input[type="date"]').filter({ visible: true }).first().fill(iso(at(0, 0, 6)));
// ponytail: no appointment time; with one the Today tile truncates ("10:3…").
await (await input(0, /Practice address/)).fill('Praxis am Park, Lindenstr. 12');
await tapBtn(/^Save$/); await page.waitForTimeout(1000);
await dbg('care');
await tab('today');

// ---------- screens ----------
const ctxArgs = { page, H, tab, OUT };
// Dev hook: KEEP=<dir> keeps the seeded browser alive and runs <dir>/cmd.mjs (default export (ctx) => …) whenever it appears.
if (process.env.KEEP) {
  const K = process.env.KEEP; console.log('KEEP mode ready');
  for (let n = 0; ; n++) {
    const f = path.join(K, 'cmd.mjs');
    if (fs.existsSync(f)) {
      const tmp = path.join(K, `cmd-${n}.mjs`); fs.renameSync(f, tmp);
      try { const r = await (await import(tmp)).default(ctxArgs); fs.writeFileSync(path.join(K, 'out.txt'), String(r ?? 'ok')); }
      catch (e) { fs.writeFileSync(path.join(K, 'out.txt'), 'ERR ' + e.stack); }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}
const LANGS = (process.env.LANGS || 'en,de').split(',');
// ponytail: warm-up pass. The Today week strip memoises "today" when it mounts (on day -14 here), so the first pass
// shows a stale "Today" chip; after one full pass it has remounted. Costs ~2 min; drop it once the app recomputes "today".
await captureAll({ ...ctxArgs, OUT: path.join(OUT, '.warmup') }, LANGS[0]);
fs.rmSync(path.join(OUT, '.warmup'), { recursive: true, force: true });
for (const lang of LANGS) await captureAll(ctxArgs, lang);
await browser.close();
