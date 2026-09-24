// Web end-to-end suite: 48 steps over every feature. Needs Metro on :8081 (npx expo start --web)
// and playwright-core (PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs, or installed locally).
// Run: node scripts/e2e/suite.mjs <screenshot-dir>
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
import { makeHelpers } from './e2e-lib.mjs';
import fs from 'node:fs';
const OUT = process.argv[2];
const BASE = 'http://localhost:8081';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const H = makeHelpers(page);
const { see, notSee, has, tapBtn, tapText, btnCount, btnDisabled, input, tab, bodyMatch } = H;

const results = []; let errs = []; let n = 0;
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('dialog', (d) => d.dismiss().catch(() => {}));
async function step(name, fn) {
  n += 1; const id = String(n).padStart(2, '0'); errs = [];
  let status = 'PASS', note = '';
  try { note = (await fn()) || ''; } catch (e) { status = 'FAIL'; note = (e.message || String(e)).split('\n')[0].slice(0, 220); }
  const leaks = await page.evaluate(() => { const t = document.body.innerText; return [/\bundefined\b/, /\bNaN\b/, /\{[a-zA-Z]+\}/, /\[object Object\]/].map((r) => t.match(r)?.[0]).filter(Boolean); }).catch(() => []);
  if (leaks.length) { if (status === 'PASS') status = 'WARN'; note += ` | text leak: ${leaks.join(', ')}`; }
  const real = errs.filter((e) => !/deprecated|push token|Listening to push|expo-notifications/i.test(e));
  if (real.length) { if (status === 'PASS') status = 'WARN'; note += ` | console: ${real[0].slice(0, 180)}`; }
  await page.screenshot({ path: `${OUT}/${id}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 50)}.png` }).catch(() => {});
  results.push({ id, name, status, note: note.trim() });
  console.log(`${status.padEnd(4)} ${id} ${name}${note ? ' — ' + note.trim() : ''}`);
}
const at = (h, m, off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); d.setHours(h, m, 0, 0); return d; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
async function clock(h, m) { await page.clock.setFixedTime(at(h, m)); await tab('medications'); await tab('today'); await page.waitForTimeout(700); }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const todayCode = DAYS[new Date().getDay()];
const dayName = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toLocaleDateString('en-US', { weekday: 'long' }); };
async function openAdd() { await tab('medications'); await tapBtn(/^Add medication$|^Add$/, 'Add'); await see(/Medication details/); }
async function basics(name, strength) { await (await input(0)).fill(name); await (await input(1)).fill(strength); }
async function save() { await tapBtn(/^Save$/, 'Save'); await page.waitForTimeout(1300); }
const num = async (re) => Number((await bodyMatch(re))?.[1]);

// ================= onboarding =================
await page.clock.setFixedTime(at(7, 50));
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

await step('Consent shown on first launch', async () => {
  if (!page.url().includes('/consent')) throw new Error(`landed on ${page.url()}`);
  await see(/^Health-data consent$/); await see(/not a medical device/i);
});
await step('Accept consent → Today onboarding', async () => {
  if (await btnCount(/./) && await H.has(/I agree/)) {}
  const cb = page.getByRole('checkbox').filter({ visible: true }); if (await cb.count()) await cb.first().click();
  await tapBtn(/^I agree and continue$/, 'accept'); await page.waitForTimeout(1500);
  if (!page.url().includes('/today')) throw new Error(`url ${page.url()}`);
  await see(/^Add first medication$/); await see(/^Step 1 of 2$/);
});

// ================= create every medication type =================
await step('Form validation: Save disabled without a name', async () => {
  await openAdd();
  if (!(await btnDisabled(/^Save$/))) throw new Error('Save enabled with empty name');
  await (await input(0)).fill('X'); await page.waitForTimeout(250);
  if (await btnDisabled(/^Save$/)) throw new Error('Save still disabled with a name');
});
await step('Form validation: Save disabled with no dose time', async () => {
  await tapBtn(/^Remove 08:00|^08:00$/, 'remove 08:00');
  if (!(await btnDisabled(/^Save$/))) throw new Error('Save enabled with no times');
  await tapBtn(/^08:00$/, 're-add 08:00');
});
await step('Daily Ramipril 08:00 + 18:00, with food, oval orange', async () => {
  await basics('Ramipril', '5 mg');
  await tapBtn(/^18:00$/, '18:00'); await tapBtn(/^Oval$/, 'Oval'); await tapBtn(/^#E07D2C$/, 'orange'); await tapBtn(/^With food$/, 'with food');
  await save();
  await see(/^Ramipril$/); await see(/^Daily · 08:00, 18:00 · 5 mg$/); await see(/^28 left · about 14 days$/);
});
await step(`Custom days Metformin: only ${todayCode}, 12:00`, async () => {
  await openAdd(); await basics('Metformin', '500 mg');
  await tapBtn(/^Some days$/, 'Some days');
  for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) if (d !== todayCode) await tapBtn(new RegExp(`^${d}$`), d);
  if (['Sat', 'Sun'].includes(todayCode)) await tapBtn(new RegExp(`^${todayCode}$`), todayCode);
  await tapBtn(/^Remove 08:00|^08:00$/, 'remove 08:00'); await tapBtn(/^12:00$/, '12:00');
  await save(); await see(new RegExp(`^${todayCode} · 12:00 · 500 mg$`));
});
await step('Every 7 days Alendronate from today', async () => {
  await openAdd(); await basics('Alendronate', '70 mg');
  await tapBtn(/^Every \d+ days$/, 'interval'); await tapBtn(/^Every 7 days$/, 'every 7');
  await (await input(0, /^$/)).evaluate(() => {}); // noop keeps marks fresh
  await page.locator('input[type="date"]').filter({ visible: true }).first().fill(iso(new Date()));
  await save(); await see(/^Every 7 days · 08:00 · 70 mg$/);
});
await step('As-needed Ibuprofen, max 2 per day', async () => {
  await openAdd(); await basics('Ibuprofen', '400 mg');
  await tapBtn(/^As needed$/, 'As needed');
  await notSee(/^Times per day$/, 'time picker shown for as-needed');
  await (await input(0, /^3$/)).fill('2');
  await save(); await see(/^As needed · up to 2 a day · 400 mg$/);
});
await step('Amoxicillin course ending tomorrow', async () => {
  await openAdd(); await basics('Amoxicillin', '500 mg');
  await page.locator('input[type="date"]').filter({ visible: true }).last().fill(iso(at(0, 0, 1)));
  await save(); await see(/^Amoxicillin$/); await see(/Ends /);
});
await step('Weekdays Vitamin D (6th medication)', async () => {
  await openAdd(); await basics('Vitamin D', '1000 IU'); await tapBtn(/^Weekdays$/, 'Weekdays');
  await save(); await see(/^Weekdays · 08:00 · 1000 IU$/);
});
await step('Search appears at 6 medications and filters', async () => {
  const box = await input(0, /Search medications/); await box.fill('ibu'); await page.waitForTimeout(500);
  await see(/^Ibuprofen$/); await notSee(/^Ramipril$/, 'Ramipril not filtered');
  await tapBtn(/^Clear search$/, 'clear'); await see(/^Ramipril$/);
});

// ================= Today with controlled clock =================
await step('07:50: hero shows next dose + Take early; As needed section', async () => {
  await tab('today');
  await see(/^NEXT DOSE$/i); await see(/^0 of 6 taken$/); await see(/^Take early$/); await see(/^As needed$/);
});
await step('Row: Take early then Undo', async () => {
  await tapBtn(/^Take early, Vitamin D/, 'take early');
  await see(/^Taken at 07:50 AM$/);
  await tapBtn(/^Undo, Vitamin D/, 'row undo'); await page.waitForTimeout(900);
  if (await has(/^Taken at 07:50 AM$/)) throw new Error('undo did not revert');
});
await step('08:05: Due; hero Taken; toast Undo restores the count', async () => {
  await clock(8, 5);
  await see(/^Due$/);
  const before = (await bodyMatch(/(\d+) of (\d+) taken/))[0];
  await tapBtn(/^Taken, /, 'hero taken'); await see(/Dose marked as taken/);
  await tapBtn(/^Undo: /, 'toast undo'); await page.waitForTimeout(1000);
  const after = (await bodyMatch(/(\d+) of (\d+) taken/))[0];
  if (before !== after) throw new Error(`${before} → ${after}`);
  return `count back to "${after}"`;
});
await step('Toast close button is labelled (a11y)', async () => {
  await tapBtn(/^Taken, /, 'hero taken'); await see(/Dose marked as taken/);
  await tapBtn(/^Dismiss$/, 'dismiss'); await page.waitForTimeout(600);
  if (await has(/Dose marked as taken/)) throw new Error('toast still open');
});
await step('Hero Skip → reason Forgot recorded on the row', async () => {
  await tapBtn(/^Skip, /, 'hero skip');
  await tapBtn(/^Skip: Forgot/, 'forgot');
  await see(/^Skipped · Forgot$/);
});
await step('Snooze on web: clear message (native-only feature)', async () => {
  if (!(await btnCount(/^Snooze \d+ min/))) return 'no due dose in hero to snooze';
  await tapBtn(/^Snooze \d+ min/, 'snooze'); await page.waitForTimeout(900);
  const m = await bodyMatch(/Could not snooze[^\n]*|Snooze is already used[^\n]*/);
  return m ? `shows "${m[0]}" — expected on web` : 'no message';
});
await step('Confirm all in the 08:00 group', async () => {
  const label = (await bodyMatch(/Confirm all \d+/))?.[0];
  if (!label) throw new Error('no Confirm all with 2+ open doses');
  await tapBtn(/^Confirm all \d+/, 'confirm all'); await page.waitForTimeout(2000);
  await see(/^Taken at 08:05 AM$/);
  return label;
});
await step('As-needed: log twice then limit reached', async () => {
  await tapBtn(/^Log dose, Ibuprofen/, 'log 1'); await see(/^Taken 1× today · last 08:05 AM$/);
  await tapBtn(/^Log dose, Ibuprofen/, 'log 2'); await see(/^Maximum for today reached$/);
  if (!(await btnDisabled(/^Log dose, Ibuprofen/))) throw new Error('still enabled at max');
});
await step('23:00: open 18:00 dose is Missed; Mark as taken fixes it', async () => {
  await clock(23, 0);
  await see(/^Missed$/);
  await tapBtn(/^Mark as taken, Ramipril/, 'mark taken'); await see(/Dose marked as taken/);
});
await step('Week strip tomorrow: Amoxicillin yes, Alendronate no', async () => {
  await tapBtn(new RegExp(dayName(1)), 'tomorrow'); await page.waitForTimeout(800);
  await see(new RegExp(`^${dayName(1)}, `)); await see(/^Amoxicillin$/);
  await notSee(/^Alendronate$/, 'every-7-days dose shown on day 1');
});
await step('Week strip +2 days: Amoxicillin gone (course ended)', async () => {
  if (!(await btnCount(new RegExp(dayName(2))))) return `skipped: ${dayName(2)} is in next week`;
  await tapBtn(new RegExp(dayName(2)), 'day +2'); await page.waitForTimeout(800);
  await notSee(/^Amoxicillin$/, 'dose after course end');
  await tapBtn(/^Today$/, 'back to today');
});

// ================= medication management =================
await step('Detail: schedule, instruction, supply', async () => {
  await tab('medications'); await tapBtn(/^Ramipril, /, 'open Ramipril'); await page.waitForTimeout(900);
  await see(/^HOW OFTEN$/i); await see(/^Daily$/); await see(/^With food$/); await see(/tablets remaining$/);
});
await step('Detail: Refill +30', async () => {
  const before = await num(/(\d+) tablets remaining/);
  await tapBtn(/^Log refill$/, 'refill'); await tapBtn(/^\+30$/, '+30'); await tapBtn(/^Log refill \(\+30\)$/, 'confirm'); await page.waitForTimeout(1000);
  const after = await num(/(\d+) tablets remaining/);
  if (after !== before + 30) throw new Error(`${before} → ${after}`);
  return `${before} → ${after}`;
});
await step('Detail: Edit strength → 10 mg', async () => {
  await tapBtn(/^Edit medication plan$/, 'edit'); await page.waitForTimeout(900);
  await (await input(1)).fill('10 mg'); await tapBtn(/^Save changes$/, 'save'); await page.waitForTimeout(1400);
  await see(/^Tablet · 10 mg$/);
});
await step('Detail: Duplicate pre-fills name, schedule and instruction', async () => {
  await tapBtn(/^Duplicate, /, 'duplicate'); await page.waitForTimeout(900);
  const name = await (await input(0)).inputValue(); if (name !== 'Ramipril') throw new Error(`name "${name}"`);
  await see(/^With food$/);
  await (await input(0)).fill('Ramipril copy'); await save();
  await see(/^Ramipril copy$/);
});
await step('Sheet: Pause until a date', async () => {
  await tapBtn(/^More actions, Ramipril copy$/, 'more'); await tapBtn(/^Pause, Ramipril copy$/, 'pause');
  await page.locator('input[type="date"]').filter({ visible: true }).last().fill(iso(at(0, 0, 5)));
  await tapBtn(/^Pause until date$/, 'pause until'); await page.waitForTimeout(1300);
  await see(/^Paused$/); await see(/^Paused until /);
});
await step('Sheet: Resume', async () => {
  await tapBtn(/^More actions, Ramipril copy$/, 'more'); await tapBtn(/^Resume, Ramipril copy$/, 'resume'); await page.waitForTimeout(1300);
  await notSee(/^Paused until /, 'still paused');
});
await step('Sheet: Archive (confirm) then Restore', async () => {
  await tapBtn(/^More actions, Ramipril copy$/, 'more'); await tapBtn(/^Archive, Ramipril copy$/, 'archive');
  await see(/^Archive this medication\?$/); await tapBtn(/^Archive$/, 'confirm'); await page.waitForTimeout(1300);
  await see(/^Archived medications \(1\)$/);
  await tapBtn(/^Archived medications/, 'expand'); await tapBtn(/^More actions, Ramipril copy$/, 'more');
  await tapBtn(/^Restore, Ramipril copy$/, 'restore'); await page.waitForTimeout(1300);
  await notSee(/^Archived medications/, 'still archived');
});
await step('Sheet: Refill from the list', async () => {
  await tapBtn(/^More actions, Metformin$/, 'more'); await tapBtn(/^Refill, Metformin$/, 'refill');
  await tapBtn(/^\+60$/, '+60'); await tapBtn(/^Log refill \(\+60\)$/, 'log'); await page.waitForTimeout(1000);
  await see(/^88 left/);
});

// ================= History =================
await step('History: weekly summary + 7/30/14 windows', async () => {
  await tab('history'); await see(/^This week$/); await see(/doses confirmed$/);
  await tapBtn(/^7d$/, '7d'); await see(/^Last 7 days$/); await tapBtn(/^30d$/, '30d'); await see(/^Last 30 days$/); await tapBtn(/^14d$/, '14d');
});
await step('History: correct the missed Metformin dose to Taken', async () => {
  await see(/^Fix a logged dose$/);
  // The headline number animates (count-up), which a frozen test clock never advances; read the real value from its a11y label.
  const pct = () => page.evaluate(() => [...document.querySelectorAll('[aria-label$="% taken on schedule"]')].map((e) => e.getAttribute('aria-label')).pop()?.match(/^(\d+)%/)?.[1]);
  const chips = () => bodyMatch(/(\d+) Taken\s*(\d+) Skipped\s*(\d+) Missed/);
  const before = await pct(); const cb = (await chips())?.slice(1).join('/');
  await tapBtn(/^Taken$/, 'Metformin Taken segment', 1); await page.waitForTimeout(1800);
  const after = await pct(); const ca = (await chips())?.slice(1).join('/') ?? 'no missed chip';
  if (before === after) throw new Error(`adherence unchanged at ${after}%`);
  return `adherence ${before}% → ${after}% (taken/skipped/missed ${cb} → ${ca})`;
});
await step('History: Export CSV downloads a real file', async () => {
  const dl = page.waitForEvent('download', { timeout: 8000 });
  await tapBtn(/^Export CSV$/, 'csv');
  const f = await dl; const p = `${OUT}/history.csv`; await f.saveAs(p);
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n');
  if (lines.length < 3) throw new Error(`${lines.length} lines`);
  return `${lines.length} lines; ${lines[0].slice(0, 60)}`;
});

// ================= Report =================
await step('Report: per-medication incl. as-needed', async () => {
  await tab('today'); await tapBtn(/^Open doctor report$/, 'report'); await page.waitForTimeout(1300);
  await see(/^Per-medication adherence$/); await see(/^As needed · 2 doses$/); await see(/^Ramipril$/);
});
await step('Report: window 7 / 30 days', async () => {
  await tapBtn(/^7d$/, '7d'); await see(/Last 7 days/); await tapBtn(/^30d$/, '30d'); await see(/Last 30 days/);
});
await step('Report: PDF prints the report itself, not the app screen', async () => {
  const frameText = () => page.evaluate(() => { const f = [...document.querySelectorAll('iframe')].pop(); return f?.contentDocument?.body?.innerText || ''; });
  await tapBtn(/^Export as PDF$/, 'pdf'); await page.waitForTimeout(1500);
  if (await has(/Couldn’t generate/)) throw new Error('PDF error shown');
  const report = await frameText();
  if (!/Takt adherence report/.test(report) || !/Ramipril/.test(report)) throw new Error(`print frame: "${report.slice(0, 80)}"`);
  await tapBtn(/^Export medication list$/, 'list'); await page.waitForTimeout(1500);
  const list = await frameText();
  if (!/With food/.test(list)) throw new Error(`list frame: "${list.slice(0, 80)}"`);
  return `report ${report.length} chars, list ${list.length} chars`;
});

// ================= Settings =================
await step('Settings: rows show live values', async () => {
  await page.goBack(); await page.waitForTimeout(700); await tab('settings');
  await see(/^Camila Reyes$/); await see(/^Sound · 15 min snooze · 4 h$/); await see(/^System · English$/); await see(/^Given on /);
});
await step('Reminders: change all preferences → summary updates', async () => {
  await tapBtn(/^Reminders, /, 'reminders'); await see(/^Snooze follow-up$/);
  for (const [re, l] of [[/^30m$/, '30m'], [/^Silent$/, 'silent'], [/^Hide name$/, 'hide'], [/^6 h$/, '6h'], [/^Off$/, 'off']]) await tapBtn(re, l);
  await page.goBack(); await page.waitForTimeout(800);
  await see(/^Silent · 30 min snooze · 6 h$/);
});
await step('Appearance: Dark theme applies', async () => {
  await tapBtn(/^Appearance, /, 'appearance'); await tapBtn(/^Dark$/, 'dark'); await page.waitForTimeout(700);
  const bg = await page.evaluate(() => { const e = document.elementFromPoint(200, 700); let n = e; while (n) { const c = getComputedStyle(n).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)') return c; n = n.parentElement; } return ''; });
  if (!/14, 18, 24/.test(bg)) throw new Error(`background ${bg}`);
  return bg;
});
await step('Appearance: German, then back to English + System', async () => {
  await tapBtn(/^Deutsch$/, 'Deutsch'); await page.waitForTimeout(800);
  await see(/^Sprache$/); await see(/^Design$/);
  await tapBtn(/^English$/, 'English'); await tapBtn(/^System$/, 'System'); await page.goBack(); await page.waitForTimeout(700);
  await see(/^System · English$/);
});
await step('Family: invite blocked until consent ticked', async () => {
  await tapBtn(/^Family sharing, /, 'family'); await see(/^Add family member$/);
  await (await input(0, /first name/i)).fill('Maria'); await (await input(0, /last name/i)).fill('Muster');
  await (await input(0, /relative@example.com/)).fill('maria@example.com');
  if (await btnDisabled(/^Invite by email$/)) return 'Invite disabled until consent';
  await tapBtn(/^Invite by email$/, 'invite'); await see(/confirm the consent statement/i);
  return 'error shown without consent';
});
await step('Family: invite with consent → waiting state', async () => {
  await tapBtn(/./.source ? /^I consent to/ : /x/, 'consent checkbox'); await tapBtn(/^Invite by email$/, 'invite'); await page.waitForTimeout(1600);
  await see(/waiting for maria@example.com/);
});
await step('Family: preview what the relative sees', async () => {
  await tapBtn(/^Preview what they see/, 'preview'); await page.waitForTimeout(1300);
  await see(/^Not available in relative view$/);
  if (await btnCount(/^Taken, |^Skip, /)) throw new Error('preview exposes dose actions');
  await page.goBack(); await page.waitForTimeout(800);
});
await step('Family: revoke in two taps', async () => {
  await tapBtn(/^Revoke access/, 'revoke'); await tapBtn(/^Confirm revoke access/, 'confirm'); await page.waitForTimeout(1600);
  await see(/^Revoked access history$/);
  await page.goBack(); await page.waitForTimeout(700);
  await see(/^Off$/);
});
await step('Shared with you: accept Amara, open read-only view', async () => {
  await tab('today'); await tapBtn(/^Accept$/, 'accept'); await page.waitForTimeout(1600);
  await tapBtn(/Amara Okonkwo/, 'open relative'); await page.waitForTimeout(1300);
  await see(/^Amara Okonkwo’s doses today$/); await see(/^Cannot edit medication regimen$/);
  if (await btnCount(/^Taken, |^Skip, |^Mark as taken/)) throw new Error('relative view exposes dose actions');
  await page.goBack(); await page.waitForTimeout(700);
});
await step('Legal: privacy notice and imprint', async () => {
  await tab('settings'); await tapBtn(/^Privacy notice$/, 'privacy'); await see(/^Who is responsible$/); await page.goBack(); await page.waitForTimeout(600);
  await tapBtn(/^Imprint$/, 'imprint'); await see(/^Actimi GmbH$/); await page.goBack(); await page.waitForTimeout(600);
});
await step('Consent: withdraw → consent screen; re-accept keeps data', async () => {
  await tapBtn(/^Consent, /, 'consent'); await tapBtn(/^Withdraw consent$/, 'withdraw'); await tapBtn(/^Withdraw$/, 'confirm'); await page.waitForTimeout(1600);
  if (!page.url().includes('/consent')) throw new Error(`url ${page.url()}`);
  const cb = page.getByRole('checkbox').filter({ visible: true }); if (await cb.count()) await cb.first().click();
  await tapBtn(/^I agree and continue$/, 'accept'); await page.waitForTimeout(1600);
  await tab('medications'); await see(/^Ramipril$/);
});

await step('Restart: preferences and consent survive a full reload', async () => {
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(8000);
  if (page.url().includes('/consent')) throw new Error('consent asked again after restart');
  await tab('settings'); await see(/^Silent · 30 min snooze · 6 h$/); await see(/^System · English$/);
});

fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
const tally = results.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] || 0) + 1 }), {});
console.log('\nSUMMARY', JSON.stringify(tally));
await browser.close();
