// Run from anywhere: node tests/liar-reverse.mjs  (screenshots go to tests/out/)
// The Liar's Game reverse mode (build step 3): the page asks, you answer and may lie up to k times.
import { mkdirSync as __mk } from 'fs';
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
const b = await chromium.launch();
const errs = [];
const p = await b.newPage({ viewport: { width: 1200, height: 1000 } });
p.on('pageerror', e => errs.push(e.message));
await p.goto(ROOT_URL + 'liar/index.html');

// Play inside the page by reading the highlighted cells, like a person would.
// lieAt: question numbers (1-based) on which to lie, if the game gets that far.
const play = (k, secret, lieAt) => p.evaluate(({ k, secret, lieAt }) => {
  document.querySelector(`#r-k button[data-v="${k}"]`).click();
  const cells = [...document.querySelectorAll('#r-board .c')];
  const told = [];
  for (let t = 1; t <= 60 && !document.getElementById('r-yes').disabled; t++) {
    const inSet = cells[secret - 1].classList.contains('in');
    const lie = lieAt.includes(t);
    if (lie) told.push(t);
    document.getElementById(lie !== inSet ? 'r-yes' : 'r-no').click();
  }
  const q = document.getElementById('r-q').textContent, sub = document.getElementById('r-set').textContent;
  const m = q.match(/Your number is (\d+)/);
  return { found: m ? +m[1] : null, caught: q.startsWith('Caught'), asked: document.querySelectorAll('#r-hist .it').length,
    budget: +document.getElementById('r-n').textContent.match(/at most (\d+)/)[1], told, sub,
    marked: [...document.querySelectorAll('#r-hist .it')].filter(i => i.querySelector('.lie')).map(i => +i.querySelector('.n').textContent.slice(1)).sort((a, b) => a - b) };
}, { k, secret, lieAt });

const rnd = n => 1 + Math.floor(Math.random() * n);
for (const k of [0, 1, 2]) {
  let ok = 0, bad = [], maxAsked = 0, budget = 0;
  for (let secret = 1; secret <= 64; secret++) {
    // up to k lies at random questions (sometimes fewer, sometimes none)
    const lieAt = [...new Set(Array.from({ length: Math.floor(Math.random() * (k + 1)) }, () => rnd(10)))];
    const r = await play(k, secret, lieAt);
    budget = r.budget; maxAsked = Math.max(maxAsked, r.asked);
    const marksRight = JSON.stringify(r.marked) === JSON.stringify(r.told);
    if (r.found === secret && r.asked <= r.budget && marksRight) ok++; else bad.push({ secret, lieAt, ...r });
  }
  console.log(`k=${k}: ${ok}/64 found with lies marked correctly; worst ${maxAsked} questions, promised ${budget}`);
  if (bad.length) { console.log('FAIL', JSON.stringify(bad.slice(0, 3))); process.exitCode = 1; }
}
// every answer pattern, not just random ones: k=1, secret 37, a lie on each possible question
{
  let ok = 0;
  for (let t = 1; t <= 10; t++) { const r = await play(1, 37, [t]); if (r.found === 37 && r.marked.join() === r.told.join()) ok++; }
  console.log('k=1, secret 37, lie on question 1..10 (if the game lasts that long):', ok, '/ 10 found, lie pointed out');
}
// too many lies: every question splits the live numbers, so no answer can empty the board and the page
// never notices; it names a wrong number (expect caught 0, wrong 60)
for (const [k, extra] of [[0, 1], [1, 2], [1, 3], [2, 3]]) {
  let caught = 0, fooled = 0, right = 0, games = 0;
  while (games < 60) {
    const secret = rnd(64), lieAt = [...new Set(Array.from({ length: extra }, () => rnd(6)))];
    if (lieAt.length < extra) continue;
    const r = await play(k, secret, lieAt); games++;
    if (r.caught) caught++; else if (r.found === secret) right++; else fooled++;
  }
  console.log(`k=${k} but ${extra} lies in the first 6 answers, 60 games: caught ${caught}, wrong number ${fooled}, still right ${right}`);
}
// undo
await p.click('#r-k button[data-v="1"]');
const q1 = await p.$eval('#r-set', e => e.textContent);
await p.click('#r-yes'); await p.click('#r-undo');
console.log('undo returns to the first question:', q1 === await p.$eval('#r-set', e => e.textContent));
await p.click('#r-k button[data-v="2"]');
for (let t = 0; t < 5; t++) await p.click(t % 2 ? '#r-yes' : '#r-no');
await p.locator('#rev').screenshot({ path: OUT + 'liar-reverse-1200.png' });
for (const scheme of ['dark', 'light']) {
  const q = await b.newPage({ viewport: { width: 390, height: 900 }, colorScheme: scheme });
  q.on('pageerror', e => errs.push('390: ' + e.message));
  await q.goto(ROOT_URL + 'liar/index.html');
  await q.click('#r-k button[data-v="2"]');
  for (let t = 0; t < 6; t++) await q.click(t % 3 ? '#r-yes' : '#r-no');
  console.log(`390 ${scheme}: sw`, await q.evaluate(() => document.documentElement.scrollWidth));
  await q.locator('#rev').screenshot({ path: OUT + `liar-reverse-390-${scheme}.png` });
  await q.close();
}
console.log('1200: sw', await p.evaluate(() => document.documentElement.scrollWidth));
console.log('errs:', errs);
await b.close();
