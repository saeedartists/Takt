// Screen pass for capture.mjs: visits each screen of an already-seeded session and saves
// <out>/<lang>/<screen>.png. Kept separate so it can be re-run against a live session (KEEP mode).
import fs from 'node:fs';
import path from 'node:path';

const L = {
  en: { lang: /^English$/, care: /^Care team, /, week: /^Your week$/, report: /^Open doctor report$/, seeAll: /^See all$/, refills: /^Refills$/, reminders: /^Reminders, /, appearance: /^Appearance, /, dark: /^Dark$/ },
  de: { lang: /^Deutsch$/, care: /^Betreuung, /, week: /^Ihre Woche$/, report: /^Arztbericht öffnen$/, seeAll: /^Alle ansehen$/, refills: /^Nachfüllen$/, reminders: /^Erinnerungen, /, appearance: /^Erscheinungsbild, /, dark: /^Dunkel$/ },
};

export async function captureAll({ page, H, tab, OUT }, lang) {
  const T = L[lang];
  const dir = path.join(OUT, lang); fs.mkdirSync(dir, { recursive: true });
  const back = async () => { await page.goBack(); await page.waitForTimeout(900); };
  const scrollTop = async () => { await page.evaluate(() => document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; })); await page.waitForTimeout(400); };
  const scrollBy = async (px) => { await page.mouse.move(220, 480); await page.mouse.wheel(0, px); await page.waitForTimeout(1000); };
  // The web build drops the filled pill glyph in the active "Meds" tab; redraw it so the tab bar matches the native app.
  const fixPillTab = () => page.evaluate(() => {
    const a = [...document.querySelectorAll('a[href="/medications"]')].filter((e) => e.offsetParent).pop(); const svg = a?.querySelector('svg');
    if (svg && a.getAttribute('aria-selected') === 'true') svg.innerHTML = '<g transform="rotate(-40 12 12)"><rect x="2.5" y="8.25" width="19" height="7.5" rx="3.75" fill="#15171C" stroke="#15171C" stroke-width="2"/><path d="M12 8.25v7.5" stroke="#F5F2ED" stroke-width="1.6" stroke-linecap="round"/></g>';
  });
  const shot = async (name) => { await page.waitForTimeout(1300); await fixPillTab(); await page.screenshot({ path: path.join(dir, `${name}.png`) }); console.log('captured', lang, name); };
  const settingsRow = async (re) => { await tab('settings'); await scrollTop(); await H.tapBtn(re); await page.waitForTimeout(1100); };

  // Language and the system (light) theme via Settings → Appearance; a dark switch first forces a re-render.
  const appearance = /^(Appearance|Erscheinungsbild), /;
  await settingsRow(appearance); await H.tapBtn(/^(Dark|Dunkel)$/); await page.waitForTimeout(800); await back();
  await tab('today'); await page.waitForTimeout(1200);
  await settingsRow(appearance); await H.tapBtn(T.lang); await H.tapBtn(/^System$/); await page.waitForTimeout(800); await back();

  await tab('medications'); await tab('today'); await scrollTop(); await shot('today');
  await scrollBy(560); await shot('today-scrolled');
  await tab('medications'); await scrollTop(); await shot('medications');
  await H.tapBtn(/^Ramipril, /); await page.waitForTimeout(1000); await shot('medication-detail'); await back();
  await H.tapText(T.refills); await page.waitForTimeout(1000); await shot('refills'); await back();
  await tab('history'); await scrollTop(); await shot('history');
  await scrollBy(640); await shot('history-scrolled');
  await H.tapText(T.week); await page.waitForTimeout(1000); await scrollTop(); await shot('week'); await back();
  await tab('today'); await scrollTop(); await H.tapBtn(T.report); await page.waitForTimeout(1500); await shot('report'); await back();
  await tab('today'); await scrollTop(); await scrollBy(560); await H.tapText(T.seeAll); await page.waitForTimeout(1000); await shot('diary'); await back();
  await settingsRow(T.care); await shot('care'); await back();
  await settingsRow(T.reminders); await shot('reminders'); await back();
  // One dark-mode pass for the care team and Today.
  await settingsRow(T.appearance); await H.tapBtn(T.dark); await page.waitForTimeout(800); await back();
  await settingsRow(T.care); await shot('care-dark'); await back();
  await tab('today'); await scrollTop(); await shot('today-dark');
  await settingsRow(T.appearance); await H.tapBtn(/^System$/); await page.waitForTimeout(800); await back();
}
