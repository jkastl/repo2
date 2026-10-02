// Run from anywhere: node tests/tearproof-explainer.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const SP = OUT;
const b = await chromium.launch();
for (const W of [1200, 390]) {
  const p = await b.newPage({ viewport: { width: W, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(ROOT_URL + 'tearproof/index.html');
  const cv = await p.$('#c-cv'); let box = await cv.boundingBox();
  const refresh = async () => { await cv.scrollIntoViewIfNeeded(); box = await cv.boundingBox(); };
  // tag positions from the page's own geometry: find tag dots by scanning the says text as we tear
  const says = () => p.textContent('#c-says');
  const out = { start: await says() };
  await (await p.$('#curve')).screenshot({ path: `${SP}/tp-full-${W}.png` });
  // tear tags by clicking on them: compute positions via evaluate of canvas pixels is hard; use exposed hit test instead
  const L = 40, R = 16, X0 = -0.45, n = 5, X1 = n + 0.5;
  const sx = x => box.x + L + (x - X0) / (X1 - X0) * (box.width - L - R);
  // find the y of tag x by scanning pixels for the green ring along the column
  async function tagY(x) {
    return await p.evaluate(([px]) => {
      const c = document.getElementById('c-cv'), ctx = c.getContext('2d'), dpr = c.width / c.clientWidth;
      const col = Math.round(px * dpr), d = ctx.getImageData(col, 0, 1, c.height).data;
      const ys = []; for (let y = 0; y < c.height * 0.9; y++) { const i = y * 4; if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) ys.push(y); }
      const best = ys.length ? ys[ys.length >> 1] : -1;
      return best / dpr;
    }, [sx(x) - box.x]);
  }
  for (const x of [5, 4, 3]) {
    await refresh(); const y = await tagY(x);
    await p.mouse.click(sx(x), box.y + y);
    out['tear' + x] = await says();
  }
  await (await p.$('#curve')).screenshot({ path: `${SP}/tp-torn-${W}.png` });
  await p.click('#c-reset');
  await refresh(); const y1 = await tagY(1);
  await p.mouse.move(sx(1), box.y + y1); await p.mouse.down(); await p.mouse.move(sx(1), box.y + y1 - 40, { steps: 5 }); await p.mouse.up();
  out.forged = await says();
  await (await p.$('#curve')).screenshot({ path: `${SP}/tp-forged-${W}.png` });
  out.sw = await p.evaluate(() => document.documentElement.scrollWidth);
  console.log(W, errs, out);
  await p.close();
}
await b.close();
