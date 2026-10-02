// Run from anywhere: node tests/liar-writeup.mjs  (screenshots go to tests/out/)
// The Liar's Game write-up (build step 5): the numbers quoted in the prose, statuses, layout.
import { mkdirSync as __mk } from 'fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
const b = await chromium.launch();
const errs = [];
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
p.on('pageerror', e => errs.push(e.message));
await p.goto(ROOT_URL + 'liar/index.html');
// every number the prose quotes, recomputed
const facts = await p.evaluate(() => {
  const s = (n, k) => [n, ...new Array(k).fill(0)];
  return {
    million: [0, 1, 2, 3].map(k => LG.budget(s(1e6, k))),
    b64: [0, 1, 2, 3].map(k => LG.budget(s(64, k))),
    kid1: LG.budget(s(20, 1)),
    v24: LG.volume(s(1e6, 1), 24), v25: LG.volume(s(1e6, 1), 25),
    three: [LG.volume([3, 0], 4), LG.volume([2, 1], 3), LG.exactNeed([3, 0])],
    hamming16: [LG.need(s(16, 1)), LG.volume(s(16, 1), 7)],
    shortened: 2 ** 20 >= 1e6 && 2 ** 5 >= 25 + 1,   // 5 check bits cover 25 positions + "no error"
  };
});
console.log(JSON.stringify(facts));
console.log('expect million [20,25,29,33], b64 [6,10,13,16], kid1 8, v24 25e6, v25 26e6, three [15,9,5], hamming16 [7,128], shortened true');
const ok = facts.million.join() === '20,25,29,33' && facts.b64.join() === '6,10,13,16' && facts.kid1 === 8 &&
  facts.v24 === 25e6 && facts.v25 === 26e6 && facts.three.join() === '15,9,5' && facts.hamming16.join() === '7,128' && facts.shortened;
if (!ok) { console.log('FAIL facts'); process.exitCode = 1; }
console.log('pill:', await p.$eval('.status', e => e.className + ' ' + e.textContent), '| plan done:', await p.$$eval('ol.plan > li', l => l.filter(x => x.classList.contains('done')).length + '/' + l.length));
const f = await b.newPage(); await f.goto(ROOT_URL + 'index.html');
console.log('front page:', await f.$eval('a[href="liar/"] .st', e => e.textContent));
for (const scheme of ['light', 'dark']) {
  const q = await b.newPage({ viewport: { width: 390, height: 900 }, colorScheme: scheme });
  q.on('pageerror', e => errs.push('390: ' + e.message));
  await q.goto(ROOT_URL + 'liar/index.html');
  console.log(`390 ${scheme}: sw`, await q.evaluate(() => document.documentElement.scrollWidth));
  await q.screenshot({ path: OUT + `liar-full-390-${scheme}.png`, fullPage: true });
  await q.close();
}
console.log('errs:', errs);
await b.close();
