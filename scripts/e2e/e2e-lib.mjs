// On-screen helpers: react-navigation keeps inactive screens mounted underneath the active one,
// so Playwright's "visible" is not enough. An element counts only if it is on top at its centre.
export function makeHelpers(page) {
  async function mark(kind, re, placeholder) {
    return page.evaluate(({ kind, src, flags, ph }) => {
      document.querySelectorAll('[data-e2e]').forEach((e) => e.removeAttribute('data-e2e'));
      const re = src ? new RegExp(src, flags) : null;
      const phRe = ph ? new RegExp(ph.src, ph.flags) : null;
      const ownText = (e) => [...e.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim();
      let cands = [];
      if (kind === 'text') {
        cands = [...document.querySelectorAll('body *')].filter((e) => {
          const own = ownText(e); if (own && re.test(own)) return true;
          return e.childElementCount === 0 && re.test((e.textContent || '').trim());
        });
      } else if (kind === 'button') {
        cands = [...document.querySelectorAll('[role=button],[role=radio],[role=checkbox],button')].filter((e) =>
          re.test((e.getAttribute('aria-label') || e.innerText || '').trim()));
      } else if (kind === 'input') {
        cands = [...document.querySelectorAll('input,textarea')].filter((e) => !phRe || phRe.test(e.getAttribute('placeholder') || ''));
      }
      const onTop = (e) => {
        e.scrollIntoView({ block: 'center', inline: 'nearest' });
        const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
        const x = Math.min(Math.max(r.x + r.width / 2, 1), innerWidth - 1), y = Math.min(Math.max(r.y + r.height / 2, 1), innerHeight - 1);
        const hit = document.elementFromPoint(x, y); return Boolean(hit) && (hit === e || e.contains(hit) || hit.contains(e) && hit.tagName === 'INPUT');
      };
      let i = 0;
      for (const e of cands) if (onTop(e)) { e.setAttribute('data-e2e', `hit-${i}`); i += 1; }
      return i;
    }, { kind, src: re?.source, flags: re?.flags, ph: placeholder ? { src: placeholder.source, flags: placeholder.flags } : null });
  }
  const hit = (i = 0) => page.locator(`[data-e2e="hit-${i}"]`);
  async function poll(kind, re, ms = 6000, ph) { const end = Date.now() + ms; let n = 0; do { n = await mark(kind, re, ph); if (n) return n; await page.waitForTimeout(250); } while (Date.now() < end); return 0; }
  return {
    async see(re, msg) { if (!(await poll('text', re))) throw new Error(msg || `not on screen: ${re}`); },
    async notSee(re, msg) { await page.waitForTimeout(400); if (await mark('text', re)) throw new Error(msg || `unexpectedly on screen: ${re}`); },
    async has(re) { return (await mark('text', re)) > 0; },
    async tapBtn(re, label, index = 0) { if (!(await poll('button', re))) throw new Error(`missing button: ${label ?? re}`); await hit(index).click({ force: true }); await page.waitForTimeout(450); },
    async tapText(re, label) { if (!(await poll('text', re))) throw new Error(`missing text: ${label ?? re}`); await hit(0).click({ force: true }); await page.waitForTimeout(450); },
    async btnCount(re) { return mark('button', re); },
    async btnDisabled(re) { if (!(await poll('button', re, 3000))) throw new Error(`missing button: ${re}`); return (await hit(0).getAttribute('aria-disabled')) === 'true'; },
    async input(i = 0, placeholder) { const n = await poll('input', null, 4000, placeholder); if (n <= i) throw new Error(`input #${i} not on screen (found ${n})`); return hit(i); },
    async tab(route) { await page.locator(`a[href="/${route}"]`).filter({ visible: true }).last().click({ force: true }); await page.waitForTimeout(600); },
    async bodyMatch(re) { return page.evaluate(({ s, f }) => document.body.innerText.match(new RegExp(s, f))?.slice(0), { s: re.source, f: re.flags }); },
  };
}
