// Run from anywhere: node tests/tearproof-writeup.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP = OUT;
const b = await chromium.launch();
for (const [W, scheme] of [[1200, 'light'], [390, 'dark'], [390, 'light']]) {
  const p = await b.newPage({ viewport: { width: W, height: 900 }, colorScheme: scheme });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(ROOT_URL + 'tearproof/index.html');
  await (await p.$('table.cmp')).screenshot({ path: `${SP}/cmp-${W}-${scheme}.png` });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  const status = await p.textContent('.status');
  // backup mode: 4 of 6, recover with 3 → possibilities should be < secret-mode count
  await p.fill('#s-text', 'The quick brown fox jumps over the lazy dog, twice over.');
  await p.click('#s-n [data-v="6"]'); await p.click('#s-k [data-v="4"]'); await p.click('#s-mode [data-v="backup"]');
  const codes = await p.$$eval('#s-tags .code', es => es.map(e => e.textContent));
  await p.fill('#r-in', codes.slice(0, 3).join('\n'));
  const poss = await p.innerHTML('#r-poss');
  console.log(W, scheme, { errs, sw, status, backup3of4: poss });
  await p.close();
}
const p = await b.newPage(); await p.goto(ROOT_URL + 'index.html');
console.log(await p.$$eval('.lab-card', cs => cs.map(c => c.querySelector('.st').textContent).join(' ')));
await b.close();
