// Run from anywhere: node tests/traitors-writeup.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP = OUT;
const b = await chromium.launch();
for (const [W, scheme] of [[1200, 'light'], [390, 'dark'], [390, 'light']]) {
  const p = await b.newPage({ viewport: { width: W, height: 900 }, colorScheme: scheme });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(ROOT_URL + 'traitors/index.html');
  const el = await p.$('.proof');
  await el.screenshot({ path: `${SP}/proof-${W}-${scheme}.png` });
  const tr = await p.$('.try'); await tr.screenshot({ path: `${SP}/try-${W}-${scheme}.png` });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(W, scheme, { errs, sw });
  await p.close();
}
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
await p.goto(ROOT_URL + 'index.html');
console.log(await p.textContent('a[href="traitors/"]'));
await b.close();
