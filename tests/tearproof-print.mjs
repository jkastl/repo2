// Run from anywhere: node tests/tearproof-print.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP = OUT;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 816, height: 1056 } });   // US Letter at 96 dpi
await p.goto(ROOT_URL + 'tearproof/index.html');
await p.emulateMedia({ media: 'print' });
await p.screenshot({ path: `${SP}/print.png`, fullPage: true });
console.log(await p.evaluate(() => [...document.body.children].filter(e => getComputedStyle(e).display !== 'none').map(e => e.id || e.tagName)));
await b.close();
