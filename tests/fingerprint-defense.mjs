// Step 5: the defense. node tests/fingerprint-defense.mjs
import { chromium, PAGE, OUT, makeSynth, synthScript, dispatch, pageErrors, sleep } from './fingerprint-lib.mjs';
const b = await chromium.launch();
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? 'ok   ' : 'FAIL ') + msg); };
const p = await b.newPage({ viewport: { width: 1200, height: 900 } }); const errs = pageErrors(p);
await p.goto(PAGE);

// the walk: 36 steps whatever the defense, on 20 simulated phones; how big the nudges are
const W = await p.evaluate(() => {
  const out = { counts: { none: [], noise: [], round: [] }, nudge: { noise: 0, round: 0 }, halfStep: 0, swing: 0 };
  for (let seed = 1; seed <= 20; seed++) {
    const ph = FP.makePhone(seed), raw = FP.walk(ph, seed * 3);
    for (const mode of ['none', 'noise', 'round']) {
      const cols = [0, 1, 2, 3, 4, 5].map(i => FP.defend(raw.map(s => s[i]), mode, ph.axes[i].G, 9 + i));
      const S = raw.map((_, k) => cols.map(c => c[k]));
      out.counts[mode].push(FP.countSteps(S).marks.length);
      if (mode !== 'none') for (let k = 0; k < S.length; k++) for (let i = 0; i < 3; i++) out.nudge[mode] = Math.max(out.nudge[mode], Math.abs(S[k][i] - raw[k][i]));
    }
    for (let i = 0; i < 3; i++) out.halfStep = Math.max(out.halfStep, ph.axes[i].G / 2);
    const m = raw.map(s => Math.hypot(s[0], s[1], s[2])); out.swing = Math.max(out.swing, (Math.max(...m) - Math.min(...m)) / 2);
  }
  out.expect = Math.round(FP.WALK_HZ * FP.WALK_S);
  return out;
});
for (const mode of ['none', 'noise', 'round'])
  check(W.counts[mode].every(c => c === W.expect), `walk, ${mode}: ${W.counts[mode].join(',')} (expect ${W.expect} each)`);
check(W.nudge.noise <= W.halfStep + 1e-12 && W.halfStep.toFixed(3) === '0.001', `noise nudges ≤ half a step = ${W.halfStep.toFixed(5)} m/s² (prose: about 0.001)`);
check(W.halfStep / W.swing < 1e-3, `half a step ÷ walking swing (${W.swing.toFixed(2)} m/s²) = ${(W.halfStep / W.swing).toExponential(1)} (prose: under a thousandth)`);
check(W.nudge.round <= 0.05 + 1e-9, `rounding nudges ≤ 0.05 m/s² (${W.nudge.round.toFixed(4)})`);

// the switch, on a simulated capture
await p.evaluate(() => simulate(9001, true)); await sleep(1700);
const hex0 = await p.textContent('#fp-hex');
const state = () => p.evaluate(() => ({ grid: $('#def-grid').textContent, fp: $('#def-fp').textContent, steps: $('#def-steps').textContent,
  hex: $('#fp-hex').textContent, gmsg: $('#grid-msg').textContent, tab: [...document.querySelectorAll('#grid-tab tr')].slice(1).map(r => r.children[1].textContent) }));
let S = await state();
check(S.grid === '6 of 6 axes' && S.fp !== 'none' && S.steps === '36 of 36', `as delivered: ${S.grid}, fingerprint ${S.fp}, steps ${S.steps}`);
await (await p.$('#def')).screenshot({ path: `${OUT}/fp-def-none.png` });
await p.click('#def-mode [data-v="noise"]'); await sleep(100); S = await state();
check(S.grid === '0 of 6 axes' && S.fp === 'none' && S.hex === 'none yet' && S.steps === '36 of 36' && S.tab.every(t => t === 'no grid'),
  `noise: ${S.grid}, fingerprint ${S.fp}, steps ${S.steps}, table ${S.tab.join('/')}`);
await (await p.$('#def')).screenshot({ path: `${OUT}/fp-def-noise.png` });
await p.click('#grid-ax [data-v="2"]');
await (await p.$('#grid')).screenshot({ path: `${OUT}/fp-def-noise-grid.png` });
await p.click('#def-mode [data-v="round"]'); await sleep(100); S = await state();
check(S.grid === '0 of 6 axes (+6 at 0.1)' && S.fp === 'none' && S.steps === '36 of 36' && S.tab.every(t => t === 'browser 0.1'),
  `round: ${S.grid}, fingerprint ${S.fp}, steps ${S.steps}, table ${S.tab.join('/')}`);
await (await p.$('#grid')).screenshot({ path: `${OUT}/fp-def-round-grid.png` });
await p.click('#def-mode [data-v="none"]'); await sleep(100); S = await state();
check(S.hex === hex0, `back to as delivered: same hex again (${S.hex})`);

// a phone that already has the noise defense: no grid "as delivered"
await p.click('#cap-start');
await dispatch(p, synthScript(makeSynth(12, { noiseDefense: true }), 2, 90)); await sleep(1700); S = await state();
check(S.grid === '0 of 6 axes' && S.fp === 'none', `phone with built-in noise, as delivered: ${S.grid}, fingerprint ${S.fp}`);

for (const [Wd, scheme] of [[1200, 'light'], [1200, 'dark'], [390, 'dark'], [390, 'light']]) {
  await p.setViewportSize({ width: Wd, height: 900 }); await p.emulateMedia({ colorScheme: scheme }); await sleep(300);
  await (await p.$('#def')).screenshot({ path: `${OUT}/fp-def-${Wd}-${scheme}.png` });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth);
  check(sw === Wd, `${Wd} ${scheme}: no horizontal scroll (sw ${sw})`);
}
check(errs.length === 0, `no page errors ${errs.join(' ')}`);
await b.close();
console.log(fails.length ? `${fails.length} FAILED` : 'all passed');
process.exit(fails.length ? 1 : 0);
