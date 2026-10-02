// Run from anywhere: node tests/traitors-engine.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import fs from 'fs';
const src = fs.readFileSync(new URL('../traitors/index.html', import.meta.url),'utf8');
const js = src.split('<script>')[1].split('/* ================================================================\n   Hot-seat')[0];
const {runOM, runSM, traitorSearch, msgKeys} = new Function(js + '; return {runOM, runSM, traitorSearch, msgKeys};')();
function sweep(sealed, m, n, t) {
  let g = 0, lost = 0, maxTried = 0;
  const combos = [];
  const rec = (start, acc) => { if (acc.length === t) { combos.push(acc); return; } for (let i = start; i < n; i++) rec(i + 1, acc.concat(i)); };
  rec(0, []);
  for (let c = 0; c < n; c++) for (const tr of combos) for (const o of ['A','R']) {
    const T = new Set(tr), lts = [...Array(n).keys()].filter(i => i !== c);
    const free = tr.flatMap(x => msgKeys(x, c, lts));
    const s = traitorSearch(sealed, m, n, c, T, o, {}, free);
    g++; if (s.found) lost++; maxTried = Math.max(maxTried, s.tried);
  }
  console.log(`${sealed ? 'SM' : 'OM'}(${m}) n=${n} t=${t}: traitors can win ${lost} of ${g} setups (max tried ${maxTried})`);
}
sweep(false, 1, 3, 1); sweep(false, 1, 4, 1); sweep(false, 1, 5, 2); sweep(false, 1, 6, 2);
sweep(true, 1, 3, 1); sweep(true, 1, 4, 1); sweep(true, 1, 5, 1);
sweep(true, 1, 4, 2); sweep(true, 2, 4, 2); sweep(true, 1, 5, 2); sweep(true, 2, 5, 2);
