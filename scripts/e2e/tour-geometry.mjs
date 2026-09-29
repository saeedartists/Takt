// Geometry check for the first-run tour: measures the visible page only and
// asserts it fits the viewport at three phone widths in light and dark.
// Needs Metro on :8081 (npx expo start --web --port 8081) and playwright-core.
// Run: PLAYWRIGHT_CORE=/path/to/playwright-core/index.mjs node scripts/e2e/tour-geometry.mjs <out-dir>
const { chromium } = await import(process.env.PLAYWRIGHT_CORE || 'playwright-core');
import fs from 'node:fs';

const OUT = process.argv[2] || '/tmp/takt-tour-geometry';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:8081';

const WIDTHS = [
  { name: 'se', width: 375, height: 667 },
  { name: 'std', width: 393, height: 852 },
  { name: 'max', width: 430, height: 932 },
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const notes = [];

// English copy the pager must show, in order, and the CTA that follows it.
const EXPECT = [
  { title: 'Reminders that ring', body: 'like an alarm', cta: 'Next' },
  { title: 'taken it', body: 'skipped or snoozed', cta: 'Next' },
  { title: 'Ready for your doctor', body: 'as a PDF', cta: 'Get started' },
];

for (const device of WIDTHS) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      colorScheme: theme,
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(8000);
    const errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(7000);
    if (!page.url().includes('/consent')) {
      await page.goto(BASE + '/consent', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(4000);
    }
    const agree = page.getByRole('button', { name: /^I agree and continue$/i });
    if (await agree.count()) {
      const cb = page.getByRole('checkbox').filter({ visible: true });
      if (await cb.count()) await cb.first().click().catch(() => {});
      await agree.first().click();
      await page.waitForTimeout(2000);
    }
    if (!page.url().includes('/tour')) {
      await page.goto(BASE + '/tour', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
    }

    for (let i = 0; i < 3; i += 1) {
      // Advance with the real control (a programmatic scroll is snapped back).
      if (i > 0) {
        const next = page.getByRole('button', { name: /^(Next|Weiter)$/i });
        await next.first().click();
        await page.waitForTimeout(1100);
      }
      await page.waitForTimeout(400);
      const label = `${device.name}-${theme}-p${i + 1}`;
      await page.screenshot({ path: `${OUT}/${label}.png` });

      const m = await page.evaluate(() => {
        const W = window.innerWidth;
        const H = window.innerHeight;
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
        };
        // Pager = the deepest horizontally scrollable div; its children are the pages.
        const scrollers = [...document.querySelectorAll('div')].filter(
          (d) => d.scrollWidth > d.clientWidth + 40 && d.clientWidth >= W - 2 && d.clientHeight > 100,
        );
        let scroller = scrollers[scrollers.length - 1];
        // react-native-web wraps the slides in one full-width content div; step into it.
        for (let g = 0; scroller && g < 3; g += 1) {
          const only = scroller.children.length === 1 ? scroller.children[0] : null;
          if (only && only.getBoundingClientRect().width > W + 1) scroller = only;
          else break;
        }
        const pages = scroller ? [...scroller.children] : [];
        const pageEl = pages.find((p) => box(p).left <= 4 && box(p).right >= W - 4) || pages[0];
        if (!pageEl) return { err: 'no page element', W, H };
        const pb = box(pageEl);
        // Text nodes that hold a title or body on the visible page (kept whole for matching).
        const texts = [...pageEl.querySelectorAll('*')]
          .filter((el) => el.children.length === 0 && (el.innerText || '').trim().length > 0)
          .map((el) => ({ text: (el.innerText || '').trim(), ...box(el) }));
        const svgs = [...pageEl.querySelectorAll('svg')].map((el) => box(el));
        const buttons = [...document.querySelectorAll('button,[role=button]')]
          .map((el) => ({ text: (el.innerText || '').replace(/\s+/g, ' ').trim(), ...box(el) }))
          .filter((b) => b.w > 0);
        // Anything on the visible page that pokes past the right edge or off the bottom.
        const spills = [...pageEl.querySelectorAll('*')]
          .map((el) => ({ text: (el.innerText || '').trim().slice(0, 22), tag: el.tagName.toLowerCase(), ...box(el) }))
          .filter((b) => b.w > 0 && (b.right > W + 1 || b.left < -1 || b.bottom > H + 1 || b.top < -1))
          .slice(0, 4);
        const doc = document.documentElement;
        return {
          W, H, page: pb, texts, svgs, buttons, spills,
          bodyOverflowX: doc.scrollWidth > W + 1,
          bodyOverflowY: doc.scrollHeight > H + 1,
          text: doc.innerText.replace(/\s+/g, ' ').slice(0, 130),
        };
      });

      const probs = [];
      const want = EXPECT[i];
      if (m.err) probs.push(m.err);
      else {
        // 1. the visible page must be the one we advanced to, with the right CTA
        const visText = m.texts.map((t) => t.text).join(' | ');
        if (!visText.includes(want.title)) probs.push(`page ${i + 1} shows "${visText.slice(0, 70)}", expected "${want.title}"`);
        if (!visText.includes(want.body)) probs.push(`page ${i + 1} body missing "${want.body}"`);
        if (!m.buttons.some((b) => b.text.startsWith(want.cta))) probs.push(`page ${i + 1} CTA should start "${want.cta}", got ${JSON.stringify(m.buttons.map((b) => b.text))}`);
        // 2. the illustration must render at a real size
        if (!m.svgs.length || m.svgs.some((s) => s.w < 80 || s.h < 60)) probs.push(`svg too small: ${JSON.stringify(m.svgs)}`);
        // 3. no visible text may run past the right edge or off the bottom
        if (m.texts.some((t) => t.right > m.W + 1 || t.left < -1)) probs.push(`text out of frame: ${JSON.stringify(m.texts.filter((t) => t.right > m.W + 1 || t.left < -1).map((t) => t.text))}`);
        if (m.spills.length) probs.push(`clipped: ${m.spills.map((s) => `${s.tag}"${s.text}"[${s.left},${s.top},${s.right},${s.bottom}]`).join(' ')}`);
        // 4. the page itself must not overflow
        if (m.bodyOverflowX) probs.push('horizontal page overflow');
        if (m.bodyOverflowY) probs.push('vertical page overflow');
        // 5. every control must be at least 44pt tall and on screen
        for (const b of m.buttons) {
          if (b.h < 44) probs.push(`tap target ${b.text} is ${b.h}pt`);
          if (b.bottom > m.H + 1 || b.top < -1) probs.push(`control off screen: ${b.text}[${b.top},${b.bottom}]`);
        }
      }
      const real = errs.filter((e) => !/deprecated|push token|Listening to push|expo-notifications|shadow\*|props\.pointerEvents|useNativeDriver/i.test(e));
      if (real.length) probs.push(`console: ${real[0].slice(0, 140)}`);

      notes.push({
        page: label, ok: probs.length === 0, probs,
        text: `${want.title} … cta ${want.cta}`,
        tile: m.page ? `${m.page.w}x${m.page.h}` : '-',
        svg: m.svgs?.[0] ? `${m.svgs[0].w}x${m.svgs[0].h}` : '-',
      });
    }
    await ctx.close();
  }
}

await browser.close();

let bad = 0;
for (const n of notes) {
  const tag = n.ok ? 'PASS' : 'FAIL';
  if (!n.ok) bad += 1;
  console.log(`${tag} ${n.page} — page ${n.tile}, art ${n.svg} — ${n.text}${n.ok ? '' : '\n     ' + n.probs.join('\n     ')}`);
}
console.log(`\nSUMMARY ${JSON.stringify({ total: notes.length, failing: bad, out: OUT })}`);
process.exit(bad ? 1 : 0);
