// Run from anywhere: node tests/traitors-bots.mjs  (screenshots go to tests/out/)
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
  // make seats 3 and 4 bots
  await p.click('[data-b="2"]'); await p.click('[data-b="3"]');
  await p.screenshot({ path: `${SP}/setup-${W}.png`, clip: await (await p.$('#game')).boundingBox() });
  let humanTurns = 0;
  for (let g = 0; g < 20; g++) {
    await p.click('#t-start');
    for (let i = 0; i < 10; i++) {
      if (await p.$('#t-rev')) break;
      await p.click('#t-me'); humanTurns++;
      const o = await p.$('[data-o]'); if (o) { await o.click(); continue; }
      await p.click('#t-done');
    }
    await p.click('#t-rev');
    if (g === 0) await p.screenshot({ path: `${SP}/reveal-${W}.png`, clip: await (await p.$('#game')).boundingBox() });
    await p.click('#t-setup');
  }
  const tally = await p.textContent('.tally');
  // bots-only traitors
  await p.click('[data-bt="1"]');
  let humanTraitor = 0;
  for (let g = 0; g < 15; g++) {
    await p.click('#t-start');
    for (let i = 0; i < 10; i++) {
      if (await p.$('#t-rev')) break;
      await p.click('#t-me');
      if (await p.$('.role.traitor')) humanTraitor++;
      const o = await p.$('[data-o]'); if (o) { await o.click(); continue; }
      await p.click('#t-done');
    }
    await p.click('#t-rev'); await p.click('#t-setup');
  }
  await p.click('#t-watch');
  await p.click('[data-sp="1"]');
  await p.waitForTimeout(2500);
  await p.click('#w-play');
  await p.screenshot({ path: `${SP}/watch-${W}.png`, clip: await (await p.$('#game')).boundingBox() });
  const st = await p.textContent('#w-stats');
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  await p.click('#w-back');
  console.log(W, { errs, humanTurns, tally, humanTraitor, sw, st: st.slice(0, 260) });
  await p.close();
}
await b.close();
