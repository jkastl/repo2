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
// ask and suggest run after a short pause ("thinking…"); wait for it to clear
const idle = p => p.waitForFunction(() => !/thinking/.test(document.getElementById('g-ask').textContent + document.getElementById('g-hint').textContent));
const click = async (p, sel) => { await p.click(sel); await idle(p); };
async function play(p, chooser, max = 40) {
  await p.click('#g-new');
  for (let t = 0; t < max; t++) {
    if (await p.$eval('#g-ask', e => e.textContent === 'found it')) break;
    await chooser(p, t);
    await click(p, '#g-ask');
  }
  // consistency: the winner must be the only live cell, and the history must show at most one lie
  return p.evaluate(() => {
    const live = [...document.querySelectorAll('#g-board button')].filter(b => !b.classList.contains('dead')).map(b => +b.dataset.i + 1);
    const lies = document.querySelectorAll('#g-hist .lie').length;
    return { asked: document.querySelectorAll('#g-hist .it').length, live, lies, status: document.getElementById('g-status').textContent, q: document.getElementById('g-q').textContent };
  });
}

const p = await page(1200);
// 1. the hint every time: optimal against the adversary, so always exactly 10
const hintRuns = [];
for (let g = 0; g < 5; g++) hintRuns.push(await play(p, async p => click(p, '#g-hint')));
console.log('hint only, 5 games:', hintRuns.map(r => `${r.asked}q → ${r.live.join()} (${r.lies} lie)`).join(' | '));
console.log('  status:', hintRuns[0].status);
if (hintRuns.some(r => r.asked !== 10 || r.live.length !== 1 || r.lies > 1)) { console.log('FAIL hint games'); process.exitCode = 1; }

// 2. honest binary search: the six binary digits split every class exactly in half,
//    so they cost nothing; finishing with hints still takes exactly 10
const bitRuns = await play(p, async (p, t) => t < 6 ? p.click(`#g-bit button[data-v="${1 << t}"]`) : click(p, '#g-hint'));
console.log('six binary digits, then hints:', `${bitRuns.asked} questions → ${bitRuns.live.join()}, ${bitRuns.lies} lie`);
if (bitRuns.asked !== 10) { console.log('FAIL binary digits'); process.exitCode = 1; }
// a lopsided first question ("≥ 60") puts the volume over the line for good
const wasteRun = await play(p, async (p, t) => { if (t) return click(p, '#g-hint'); await p.fill('#g-gen', '60'); await p.click('#g-ge'); });
console.log('"≥ 60" first, then hints:', `${wasteRun.asked} questions (${wasteRun.q}) → ${wasteRun.live.join()}`);
console.log('  status:', wasteRun.status);
if (wasteRun.asked <= 10) { console.log('FAIL wasteful game finished in budget'); process.exitCode = 1; }
await p.click('#g-new'); await p.fill('#g-gen', '60'); await p.click('#g-ge'); await click(p, '#g-ask');
console.log('after "≥ 60": vol', await txt(p, 'g-vol'), '|', await txt(p, 'g-status'));
await p.locator('#game').screenshot({ path: OUT + 'liar-board-stuck-1200.png' });

// 3. tapping cells, ≥ preset, flip, clear, history wording
await p.click('#g-new');
for (const n of [3, 4, 5, 9]) await p.click(`#g-board .c[data-i="${n - 1}"]`);
console.log('tap 3,4,5,9 →', await txt(p, 'g-ask'));
await click(p, '#g-ask');
await p.fill('#g-gen', '40'); await p.click('#g-ge'); await p.click('#g-inv');
console.log('≥ 40 flipped →', await txt(p, 'g-ask'));
await click(p, '#g-ask');
await p.click('#g-even'); await click(p, '#g-ask');
await p.click('#g-clr');
console.log('ask disabled when empty:', await p.$eval('#g-ask', e => e.disabled));
console.log('history:', await p.$$eval('#g-hist .it', its => its.map(i => i.textContent).join(' / ')));
await click(p, '#g-hint');
await p.locator('#game').screenshot({ path: OUT + 'liar-board-1200.png' });

// 4. the other boards and lie counts: the hint always finishes in exactly the promised minimum
for (const [mode, k] of [['kid', 0], ['kid', 1], ['kid', 3], ['64', 2], ['64', 3], ['M', 1], ['M', 3]]) {
  await p.click(`#g-mode button[data-v="${mode}"]`); await p.click(`#g-k button[data-v="${k}"]`);
  const budget = +(await txt(p, 'g-q')).split(' of ')[1], t0 = Date.now();
  const r = await play(p, async p => click(p, '#g-hint'), 60);
  console.log(`${mode} k=${k}: hint finished in ${r.asked} (minimum ${budget}) → ${r.status.split('.')[0]}  [${((Date.now() - t0) / 1000).toFixed(1)} s]`);
  if (r.asked !== budget) { console.log('FAIL hint not optimal'); process.exitCode = 1; }
}
// the million board: presets, a strip, and the class bars
await p.click('#g-mode button[data-v="M"]'); await p.click('#g-k button[data-v="2"]');
await p.selectOption('#g-bitv', String(2 ** 19)); await p.click('#g-bitm');
console.log('million, binary digit 524,288 →', await txt(p, 'g-ask'));
await click(p, '#g-ask');
await p.fill('#g-gen', '600000'); await p.click('#g-ge'); await click(p, '#g-ask');
await p.click('#g-even'); await click(p, '#g-ask');
await click(p, '#g-hint');
console.log('million history:', await p.$$eval('#g-hist .it', its => its.map(i => i.textContent).join(' / ')));
console.log('million status:', await txt(p, 'g-status'));
await p.locator('#game').screenshot({ path: OUT + 'liar-board-million-1200.png' });
// kids' board: picture presets
await p.click('#g-mode button[data-v="kid"]'); await p.click('#g-k button[data-v="1"]');
await p.click('#g-kidp button:nth-child(1)'); await click(p, '#g-ask');
await p.click('#g-kidp button:nth-child(4)'); await click(p, '#g-ask');
for (const n of [10, 12]) await p.click(`#g-board .c[data-i="${n - 1}"]`);
console.log('kids, tap apple + strawberry →', await txt(p, 'g-ask'));
await click(p, '#g-ask');
console.log('kids history:', await p.$$eval('#g-hist .it', its => its.map(i => i.textContent).join(' / ')));
await p.locator('#game').screenshot({ path: OUT + 'liar-board-kid-1200.png' });
// switching boards while "thinking…" drops the pending answer
await p.click('#g-mode button[data-v="kid"]'); await p.click('#g-k button[data-v="3"]');
await p.click('#g-kidp button:nth-child(1)'); await p.click('#g-ask'); await p.click('#g-mode button[data-v="64"]'); await idle(p);
console.log('switch while thinking → questions', await txt(p, 'g-q'), '(expect "0 of 16")');
await p.click('#g-k button[data-v="1"]');

// 5. phone width, both themes; mid-game with a question pending
for (const scheme of ['dark', 'light']) {
  const q = await page(390, scheme);
  for (let t = 0; t < 4; t++) { await click(q, '#g-hint'); await click(q, '#g-ask'); }
  await click(q, '#g-hint');
  const sw = await q.evaluate(() => document.documentElement.scrollWidth);
  console.log(`390 ${scheme}: sw`, sw);
  await q.locator('#game').screenshot({ path: OUT + `liar-board-390-${scheme}.png` });
  for (const mode of ['M', 'kid']) {
    await q.click(`#g-mode button[data-v="${mode}"]`); await q.click('#g-k button[data-v="3"]');
    for (let t = 0; t < 5; t++) { await click(q, '#g-hint'); await click(q, '#g-ask'); }
    await click(q, '#g-hint');
    console.log(`390 ${scheme} ${mode}: sw`, await q.evaluate(() => document.documentElement.scrollWidth));
    await q.locator('#game').screenshot({ path: OUT + `liar-board-390-${scheme}-${mode}.png` });
  }
  await q.screenshot({ path: OUT + `liar-page-390-${scheme}.png`, fullPage: true });
  await q.close();
}
console.log('1200: sw', await p.evaluate(() => document.documentElement.scrollWidth));
console.log('errs:', errs);
await b.close();
