// Run from anywhere: node tests/tearproof-recover.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP = OUT;
const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const PAGE = ROOT_URL + 'tearproof/index.html';
for (const W of [1200, 390]) {
  const p = await b.newPage({ viewport: { width: W, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(PAGE);
  const st = async () => ({ have: await p.textContent('#r-have'), poss: await p.textContent('#r-poss'), status: await p.textContent('#r-status'),
    secret: await p.$eval('#r-out', e => e.hidden ? null : document.getElementById('r-secret').textContent),
    list: (await p.$$eval('#r-list .it', es => es.map(e => e.textContent.trim().replace(/\s+/g, ' ')))) });
  const R = {};
  await p.click('#r-demo'); R.demo = await st();
  const codes = await p.$$eval('#s-tags .code', es => es.map(e => e.textContent));   // 5 tags, any 3
  const fill = async lines => { await p.fill('#r-in', lines.join('\n')); return st(); };
  R.short = await fill([codes[0], codes[3]]);
  R.sloppy = await fill([codes[1].toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o'), codes[2].replace(/-/g, ''), codes[4].toLowerCase().replace(/1/g, 'l')]);
  const broken = codes[2].slice(0, 10) + (codes[2][10] === 'X' ? 'Y' : 'X') + codes[2].slice(11);
  // another split for a wrong-set tag
  await p.click('#s-again'); const other = await p.$eval('#s-tags .code', e => e.textContent);
  R.mess = await fill([codes[0], codes[0], broken, other, codes[1], 'hello', codes[4]]);
  // forge tag 2: same header, different share bytes, valid checksum
  const forged = await p.evaluate(c => { const t = TAG.unpack(c).tag; t.data[0] ^= 0x5a; t.data[3] ^= 1; return TAG.pretty(TAG.pack(t)); }, codes[1]);
  R.forged5 = await fill([codes[0], forged, codes[2], codes[3], codes[4]]);
  R.forged4 = await fill([codes[0], forged, codes[2], codes[3]]);
  R.forged3 = await fill([codes[0], forged, codes[2]]);
  R.dupconflict = await fill([codes[1], forged, codes[0]]);
  // camera: real fallback first
  await p.click('#r-scan'); R.camFallback = await p.textContent('#r-scanmsg');
  await (await p.$('#rec')).screenshot({ path: `${SP}/rec-${W}.png` });
  console.log(W, 'errors:', errs);
  for (const [k, v] of Object.entries(R)) console.log(' ', k, JSON.stringify(v));
  // camera with a mocked detector that "sees" three tags one after another
  const p2 = await b.newPage({ viewport: { width: W, height: 1000 } });
  const e2 = []; p2.on('pageerror', e => e2.push(e.message));
  await p2.addInitScript(cs => {
    let i = 0;
    window.BarcodeDetector = class { static async getSupportedFormats() { return ['qr_code']; } async detect() { i++; return i % 3 === 0 && i / 3 <= cs.length ? [{ rawValue: cs[i / 3 - 1].replace(/-/g, '') }] : []; } };
  }, [codes[0], codes[2], codes[4]]);
  await p2.goto(PAGE);
  // tags made on page 1 belong to page 1's split; that's fine for recovery
  await p2.click('#r-scan');
  await p2.waitForFunction(() => document.getElementById('r-out').hidden === false, null, { timeout: 8000 }).catch(() => {});
  console.log('  camera mock:', JSON.stringify({ errs: e2, camVisible: !(await p2.$eval('#r-cam', e => e.hidden)), msg: await p2.textContent('#r-cam-msg'), lines: (await p2.inputValue('#r-in')).split('\n').length, secret: await p2.$eval('#r-out', e => e.hidden ? null : document.getElementById('r-secret').textContent) }));
  await p2.click('#r-stop');
  await (await p2.$('#rec')).screenshot({ path: `${SP}/rec-cam-${W}.png` });
  console.log('  sw', await p.evaluate(() => document.documentElement.scrollWidth));
  await p.close(); await p2.close();
}
await b.close();
