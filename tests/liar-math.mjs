// Run from anywhere: node tests/liar-math.mjs
// The Liar's Game math core (build step 1): volume, the bound, the adversary, the questioner.
import fs from 'fs';
const src = fs.readFileSync(new URL('../liar/index.html', import.meta.url), 'utf8');
const js = src.split('/* ================================================================\n   Math core')[1].split('</script>')[0];
const LG = new Function('/*' + js + '; return LG;')();
const fail = m => { console.log('FAIL', m); process.exitCode = 1; };
const rnd = n => Math.floor(Math.random() * (n + 1));

// 1. conservation of volume: V_q(a) = V_{q-1}(yes) + V_{q-1}(no), for any question
let cons = 0;
for (let t = 0; t < 20000; t++) {
  const k = rnd(3), a = Array.from({ length: k + 1 }, () => rnd(40)), x = a.map(rnd), q = 1 + rnd(30);
  const { yes, no } = LG.children(a, x);
  if (LG.volume(a, q) !== LG.volume(yes, q - 1) + LG.volume(no, q - 1)) fail(`conservation ${a} ${x} ${q}`);
  if (LG.alive(yes) + LG.alive(no) < LG.alive(a)) fail('children lost a live candidate');
  cons++;
}
console.log('volume conserved by every answer:', cons, 'random questions');

// 2. the bound for a million: honest 20, one lie 25 (Pelc 1987). Literature: 2 lies 29 (Guzicki 1990), 3 lies 33 (Deppe 2000)
const M = 1e6, start = (n, k) => [n, ...new Array(k).fill(0)];
const needM = [0, 1, 2, 3].map(k => LG.need(start(M, k)));
console.log('volume bound for 1..10^6, k = 0..3:', needM.join(', '), '(expect 20, 25, 29, 33)');
if (needM[0] !== 20 || needM[1] !== 25) fail('need(10^6)');
console.log('  k=1: V_24 =', LG.volume(start(M, 1), 24).toLocaleString(), '> 2^24 =', (2 ** 24).toLocaleString(), '| V_25 =', LG.volume(start(M, 1), 25).toLocaleString(), '≤ 2^25 =', (2 ** 25).toLocaleString());

// 3. exact game values for small n vs Pelc's formula (one lie):
//    n even: least q with n(q+1) ≤ 2^q;  n odd: least q with n(q+1) + (q−1) ≤ 2^q
const pelc = n => { let q = 0; while (n * (q + 1) + (n % 2 ? q - 1 : 0) > 2 ** q) q++; return q; };
const exact = a => { let q = 0; while (!LG.wins(a, q)) q++; return q; };
const gaps = [];
for (let n = 2; n <= 40; n++) {
  const e = exact(start(n, 1));
  if (e !== pelc(n)) fail(`n=${n}: exact ${e}, Pelc ${pelc(n)}`);
  if (e !== LG.need(start(n, 1))) gaps.push(`${n}→${e} (bound ${LG.need(start(n, 1))})`);
}
console.log('one lie, n = 2..40: exact search matches Pelc for every n');
console.log('  where the volume bound is short by one (only odd n, and only these):', gaps.join(', '));
const gaps2 = [];
for (let n = 2; n <= 12; n++) { const e = exact(start(n, 2)), b = LG.need(start(n, 2)); if (e !== b) gaps2.push(`${n}→${e} (bound ${b})`); }
console.log('two lies, n = 2..12, bound short:', gaps2.join(', ') || 'never');

// 4. the questioner is a proof: against EVERY answer sequence (both branches at
//    every step, memoized on position), it finishes within the bound.
function strategyWins(a, q, memo) {
  if (LG.alive(a) <= 1) return true;
  if (q === 0) return false;
  const key = a.join(',') + '/' + q;
  if (memo.has(key)) return memo.get(key);
  const { yes, no } = LG.children(a, LG.question(a, q));
  const ok = (!LG.alive(yes) || strategyWins(yes, q - 1, memo)) && (!LG.alive(no) || strategyWins(no, q - 1, memo));
  memo.set(key, ok);
  return ok;
}
for (const k of [0, 1, 2, 3]) {
  const memo = new Map(), q = needM[k], t0 = Date.now();
  const ok = strategyWins(start(M, k), q, memo);
  console.log(`questioner vs every liar, 10^6, ${k} lie(s), ${q} questions:`, ok ? 'always wins' : 'can be beaten', `(${memo.size} positions, ${Date.now() - t0} ms)`);
  if (!ok) fail('strategy at 10^6');
}

// 4b. other board sizes: the questioner's worst case vs the bound (and vs Pelc for one lie)
for (const k of [1, 2, 3]) {
  const ns = [...Array(199).keys()].map(i => i + 2);
  for (let t = 0; t < 150; t++) ns.push(2 + Math.floor(Math.random() * (M - 1)));
  const over = {}; let pelcMiss = 0;
  for (const n of ns) {
    let q = LG.need(start(n, k));
    while (!strategyWins(start(n, k), q, new Map())) q++;
    const d = q - LG.need(start(n, k)); over[d] = (over[d] || 0) + 1;
    if (k === 1 && q !== pelc(n)) { pelcMiss++; fail(`k=1 n=${n}: strategy ${q}, Pelc ${pelc(n)}`); }
  }
  console.log(`  ${k} lie(s), n = 2..200 and 150 random n ≤ 10^6: questions over the bound →`, JSON.stringify(over), k === 1 ? (pelcMiss ? '' : '(= Pelc for every n)') : '');
}

// 5. questioner vs the adversary on small boards: questions used vs exact optimum
let worst = 0, games = 0;
for (const k of [1, 2]) for (let n = 2; n <= (k === 1 ? 64 : 16); n++) {
  let a = start(n, k), used = 0;
  while (LG.alive(a) > 1) { const x = LG.question(a); a = LG.adversary(a, x) ? LG.children(a, x).yes : LG.children(a, x).no; used++; if (!LG.alive(a)) fail('adversary contradicted itself'); }
  const opt = exact(start(n, k)); worst = Math.max(worst, used - opt); games++;
}
console.log(`questioner vs adversary, ${games} small games: worst excess over the exact optimum = ${worst}`);

// 6. the adversary vs a naive honest binary search on 1..64 with one lie
{
  const k = 1, n = 64; let lies = new Array(n).fill(0), used = 0, lo = 0, hi = n - 1;
  while (LG.alive(LG.counts(lies, k)) > 1 && used < 100) {
    const mid = (lo + hi) >> 1, inSet = i => i <= mid;
    const x = (() => { const c = new Array(k + 1).fill(0); lies.forEach((l, i) => { if (l <= k && inSet(i)) c[l]++; }); return c; })();
    const said = LG.adversary(LG.counts(lies, k), x);
    lies = LG.answer(lies, inSet, said, k); used++;
    if (said) hi = mid; else lo = mid + 1;
    if (lo > hi) { lo = 0; hi = n - 1; }   // the naive searcher notices a contradiction and starts over
  }
  console.log(`naive binary search, 1..64, one lie: ${LG.alive(LG.counts(lies, k)) > 1 ? 'still stuck after' : 'finished in'} ${used} questions (optimum ${exact(start(n, k))})`);
}
