// Run from anywhere: node tests/tearproof-split.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { execFileSync } from 'child_process';
const SP = OUT;
const b = await chromium.launch();
const scan = png => execFileSync('python3', ['-c', `
import cv2, sys
img = cv2.imread(sys.argv[1]); t, pts, _ = cv2.QRCodeDetector().detectAndDecode(img); print(t)`, png]).toString().trim();
for (const W of [1200, 390]) {
  const p = await b.newPage({ viewport: { width: W, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(ROOT_URL + 'tearproof/index.html');
  const results = [];
  for (const [mode, text, k, n] of [['secret', 'correct horse battery staple', 3, 5], ['secret', 'Wi-Fi: Tolerance5G / pw: s3cr3t-päss 🔑', 2, 4], ['backup', 'The quick brown fox jumps over the lazy dog, twice over.', 4, 6], ['secret', 'x'.repeat(120), 5, 8]]) {
    await p.fill('#s-text', text);
    await p.click(`#s-n [data-v="${n}"]`); await p.click(`#s-mode [data-v="${mode}"]`); await p.click(`#s-k [data-v="${k}"]`);
    const tags = await p.$$('#s-tags .tag svg');
    const scanned = [];
    // scan the LAST k tags with OpenCV, rendered big
    for (const [i, t] of tags.slice(-k).entries()) {
      await t.evaluate(el => { el.style.maxWidth = '360px'; });
      await t.scrollIntoViewIfNeeded();
      const f = `${SP}/scan-${W}-${i}.png`; await t.screenshot({ path: f });
      scanned.push(scan(f));
      await t.evaluate(el => { el.style.maxWidth = ''; });
    }
    const got = await p.evaluate(([codes]) => {
      const tags = codes.map(c => TAG.unpack(c)); if (tags.some(t => !t.ok)) return 'unpack failed: ' + tags.map(t => t.why).join(',');
      const T = tags.map(t => t.tag);
      return new TextDecoder().decode(TP.combine(T.map(t => ({ x: t.x, data: t.data })), T[0].k, T[0].mode, T[0].len));
    }, [scanned]);
    results.push(`${mode} ${k}/${n} ${text.length}ch: ${got === text ? 'OK' : 'FAIL ' + got}`);
  }
  await p.fill('#s-text', 'correct horse battery staple'); await p.click('#s-n [data-v="5"]'); await p.click('#s-k [data-v="3"]'); await p.click('#s-mode [data-v="secret"]');
  await (await p.$('#split')).screenshot({ path: `${SP}/split-${W}.png` });
  if (W === 1200) { await p.emulateMedia({ media: 'print' }); await p.pdf({ path: `${SP}/tags.pdf`, format: 'Letter' }); await p.emulateMedia({ media: 'screen' }); }
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(W, { errs, sw }); console.log(results.join('\n'));
  await p.close();
}
await b.close();
