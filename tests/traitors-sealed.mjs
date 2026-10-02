// Run from anywhere: node tests/traitors-sealed.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP = OUT;
const b = await chromium.launch();
for (const W of [1200, 390]) {
  const p = await b.newPage({ viewport: { width: W, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(ROOT_URL + 'traitors/index.html');
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.click('#t-less');                 // 3 players, all human
  await p.click('[data-s="1"]');
  await p.screenshot({ path: `${SP}/s-setup-${W}.png`, clip: await (await p.$('#game')).boundingBox() });
  const shots = {};
  const results = { win: 0, g: 0 };
  for (let g = 0; g < 40; g++) {
    await p.click('#t-start');
    for (let i = 0; i < 10; i++) {
      if (await p.$('#t-rev')) break;
      await p.click('#t-me');
      const o = await p.$('[data-o]'); if (o) { await o.click(); continue; }
      // traitor: click random toggles
      const qs = await p.$$('[data-q]');
      if (qs.length) {
        for (const q of qs) { const k = Math.floor(Math.random() * 4); for (let j = 0; j < k; j++) await (await p.$(`[data-q="${await q.getAttribute('data-q')}"]`)).click(); }
        const kind = (await p.$('.sub') && (await p.textContent('.sub')).includes('commander')) ? 'tcmd' : 'tlt';
        if (!shots[kind]) { shots[kind] = 1; await p.screenshot({ path: `${SP}/s-${kind}-${W}.png`, clip: await (await p.$('#game')).boundingBox() }); }
      }
      await p.click('#t-done');
    }
    await p.click('#t-rev');
    results.g++; if ((await p.textContent('.verdict')).includes('loyal')) results.win++;
    if (!shots.rev && (await p.$$('.lie')).length) { shots.rev = 1; await p.screenshot({ path: `${SP}/s-reveal-${W}.png`, clip: await (await p.$('#game')).boundingBox() }); }
    await p.click('#t-setup');
  }
  // 5 players, 2 traitors sealed, bots in 3 seats
  await p.click('#t-more'); await p.click('#t-more');
  for (const i of [2,3,4]) await p.click(`[data-b="${i}"]`);
  await p.click('[data-t="2"]');
  const r2 = { win: 0, g: 0 };
  for (let g = 0; g < 15; g++) {
    await p.click('#t-start');
    for (let i = 0; i < 10; i++) {
      if (await p.$('#t-rev')) break;
      await p.click('#t-me');
      const o = await p.$('[data-o]'); if (o) { await o.click(); continue; }
      await p.click('#t-done');
    }
    await p.click('#t-rev');
    r2.g++; if ((await p.textContent('.verdict')).includes('loyal')) r2.win++;
    await p.click('#t-setup');
  }
  const tally = await p.textContent('.tally');
  await p.click('#t-watch');
  await p.click('[data-ws="1"]'); await p.click('[data-sp="1"]');
  await p.waitForTimeout(3000);
  await p.click('#w-play');
  await p.screenshot({ path: `${SP}/s-watch-${W}.png`, clip: await (await p.$('#game')).boundingBox() });
  const st = await p.textContent('#w-stats');
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(W, { errs, results, r2, tally, sw, st: st.slice(0, 200) });
  await p.close();
}
await b.close();
