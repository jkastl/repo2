// Run from anywhere: node tests/liar-board.mjs  (screenshots go to tests/out/)
// The Liar's Game board (build step 2): 1–64, one lie, presets, hint, meter, history.
import { mkdirSync as __mk } from 'fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
const b = await chromium.launch();
const errs = [];
async function page(w, scheme = 'dark') {
  const p = await b.newPage({ viewport: { width: w, height: 1000 }, colorScheme: scheme });
  p.on('pageerror', e => errs.push(`${w}: ${e.message}`));
  await p.goto(ROOT_URL + 'liar/index.html');
  return p;
}
const txt = (p, id) => p.$eval('#' + id, e => e.textContent);
async function play(p, chooser, max = 40) {
  await p.click('#g-new');
  for (let t = 0; t < max; t++) {
    if (await p.$eval('#g-ask', e => e.textContent === 'found it')) break;
    await chooser(p, t);
    await p.click('#g-ask');
  }
  // consistency: the winner must be the only live cell, and the history must show at most one lie
  return p.evaluate(() => {
    const live = [...document.querySelectorAll('#g-board button')].filter(b => !b.classList.contains('dead')).map(b => +b.dataset.n);
    const lies = document.querySelectorAll('#g-hist .lie').length;
    return { asked: document.querySelectorAll('#g-hist .it').length, live, lies, status: document.getElementById('g-status').textContent, q: document.getElementById('g-q').textContent };
  });
}

const p = await page(1200);
// 1. the hint every time: optimal against the adversary, so always exactly 10
const hintRuns = [];
for (let g = 0; g < 5; g++) hintRuns.push(await play(p, async p => p.click('#g-hint')));
console.log('hint only, 5 games:', hintRuns.map(r => `${r.asked}q → ${r.live.join()} (${r.lies} lie)`).join(' | '));
console.log('  status:', hintRuns[0].status);
if (hintRuns.some(r => r.asked !== 10 || r.live.length !== 1 || r.lies > 1)) { console.log('FAIL hint games'); process.exitCode = 1; }

// 2. honest binary search: the six binary digits split every class exactly in half,
//    so they cost nothing; finishing with hints still takes exactly 10
const bitRuns = await play(p, async (p, t) => t < 6 ? p.click(`#g-bit button[data-v="${1 << t}"]`) : p.click('#g-hint'));
console.log('six binary digits, then hints:', `${bitRuns.asked} questions → ${bitRuns.live.join()}, ${bitRuns.lies} lie`);
if (bitRuns.asked !== 10) { console.log('FAIL binary digits'); process.exitCode = 1; }
// a lopsided first question ("≥ 60") puts the volume over the line for good
const wasteRun = await play(p, async (p, t) => { if (t) return p.click('#g-hint'); await p.fill('#g-gen', '60'); await p.click('#g-ge'); });
console.log('"≥ 60" first, then hints:', `${wasteRun.asked} questions (${wasteRun.q}) → ${wasteRun.live.join()}`);
console.log('  status:', wasteRun.status);
if (wasteRun.asked <= 10) { console.log('FAIL wasteful game finished in budget'); process.exitCode = 1; }
await p.click('#g-new'); await p.fill('#g-gen', '60'); await p.click('#g-ge'); await p.click('#g-ask');
console.log('after "≥ 60": vol', await txt(p, 'g-vol'), '|', await txt(p, 'g-status'));
await p.locator('#game').screenshot({ path: OUT + 'liar-board-stuck-1200.png' });

// 3. tapping cells, ≥ preset, flip, clear, history wording
await p.click('#g-new');
for (const n of [3, 4, 5, 9]) await p.click(`#g-board button[data-n="${n}"]`);
console.log('tap 3,4,5,9 →', await txt(p, 'g-ask'));
await p.click('#g-ask');
await p.fill('#g-gen', '40'); await p.click('#g-ge'); await p.click('#g-inv');
console.log('≥ 40 flipped →', await txt(p, 'g-ask'));
await p.click('#g-ask');
await p.click('#g-even'); await p.click('#g-ask');
await p.click('#g-clr');
console.log('ask disabled when empty:', await p.$eval('#g-ask', e => e.disabled));
console.log('history:', await p.$$eval('#g-hist .it', its => its.map(i => i.textContent).join(' / ')));
await p.click('#g-hint');
await p.locator('#game').screenshot({ path: OUT + 'liar-board-1200.png' });

// 4. phone width, both themes; mid-game with a question pending
for (const scheme of ['dark', 'light']) {
  const q = await page(390, scheme);
  for (let t = 0; t < 4; t++) { await q.click('#g-hint'); await q.click('#g-ask'); }
  await q.click('#g-hint');
  const sw = await q.evaluate(() => document.documentElement.scrollWidth);
  console.log(`390 ${scheme}: sw`, sw);
  await q.locator('#game').screenshot({ path: OUT + `liar-board-390-${scheme}.png` });
  await q.screenshot({ path: OUT + `liar-page-390-${scheme}.png`, fullPage: true });
  await q.close();
}
console.log('1200: sw', await p.evaluate(() => document.documentElement.scrollWidth));
console.log('errs:', errs);
await b.close();
