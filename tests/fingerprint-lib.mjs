// Shared helpers for the fingerprint tests (not a test itself; run.sh skips *-lib.mjs).
// Synthetic devicemotion data: each axis reports step·A + offset, where A is a whole number of
// ADC counts = round(true/step + bias + noise). That's the lattice a page should recover.
import { mkdirSync } from 'fs';
export { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
export const ROOT_URL = new URL('../', import.meta.url).href;
export const PAGE = ROOT_URL + 'fingerprint/index.html';
export const OUT = new URL('./out/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
export const G0 = 9.80665;

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function gauss(r) { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

// a synthetic phone: per axis (accel x,y,z in m/s², gyro x,y,z in °/s)
//   step   – grid spacing the page should find
//   offset – added after scaling (only offset mod step is visible on the grid)
//   scale  – true sensitivity error: reported mean = (1+scale)·true + bias
//   bias   – reported offset at zero input
//   sigma  – noise in counts
// opts.f32 rounds each value to float32 (Android's sensor values are floats).
export function makeSynth(seed, o = {}) {
  const r = rng(seed), u = a => (2 * r() - 1) * a;
  const axes = [0, 1, 2, 3, 4, 5].map(i => {
    const acc = i < 3, nom = acc ? G0 / 4096 : 1 / 16.4;
    const step = nom * (1 + u(0.01));
    const scale = o.scale ?? u(0.004), bias = o.bias ?? u(acc ? 0.12 : 0.6);
    const offset = u(step * 40);         // arbitrary, not a whole number of steps
    return { step, offset, scale, bias, sigma: o.sigma ?? (acc ? 1.2 : 1.5) };
  });
  // opts.mix: cross-axis terms (each sensor's 3×3 gain matrix gets off-diagonal entries up to ±mix of its step;
  //   SensorID's iPhone XS gyroscope had up to ~0.9%). opts.drift: a slowly wandering offset, like the bias
  //   correction SensorID saw in Safari's gyroscope data (random-walk step size, as a fraction of a grid step).
  const mix = [0, 1, 2, 3, 4, 5].map(i => [0, 1, 2].map(j => (i % 3 === j) ? 0 : u(o.mix || 0)));
  return { seed, axes, mix, drift: o.drift || 0, walk: [0, 0, 0, 0, 0, 0], f32: !!o.f32, noiseDefense: !!o.noiseDefense };
}
// one sample [ax,ay,az,gx,gy,gz] for a true input; the ADC count is chosen so the reported
// mean is (1+scale)·true + bias, and the value sits exactly on step·A + offset
export function synthSample(ph, truth, r) {
  const A = ph.axes.map((ax, i) => {
    const want = (1 + ax.scale) * truth[i] + ax.bias;
    let a = Math.round((want - ax.offset) / ax.step + ax.sigma * gauss(r));
    if (ph.noiseDefense) a += r() - 0.5;           // iOS 12.2-style: noise before calibration
    return a;
  });
  return ph.axes.map((ax, i) => {
    const b = i < 3 ? 0 : 3;
    let v = ax.step * A[i] + ax.offset;
    for (let j = 0; j < 3; j++) if (b + j !== i) v += ph.mix[i][j] * ax.step * (A[b + j] - Math.round(ax.offset / ax.step));
    if (ph.drift) { ph.walk[i] += ph.drift * ax.step * gauss(r); v += ph.walk[i]; }
    return ph.f32 ? Math.fround(v) : v;
  });
}
export const FACES = [[0, 0, G0], [0, 0, -G0], [G0, 0, 0], [-G0, 0, 0], [0, G0, 0], [0, -G0, 0]];
// still samples on each face (rotation 0), with a moving turn between faces
export function synthScript(ph, seed, perFace = 100, faces = FACES) {
  const r = rng(seed), out = [];
  faces.forEach((f, k) => {
    for (let i = 0; i < perFace; i++) out.push(synthSample(ph, [...f, 0, 0, 0], r));
    if (k < faces.length - 1) for (let i = 0; i < 30; i++)
      out.push(synthSample(ph, [f[0] + 4 * gauss(r), f[1] + 4 * gauss(r), f[2] + 4 * gauss(r), 80 * gauss(r), 50 * gauss(r), 30 * gauss(r)], r));
  });
  return out;
}
// dispatch samples as real DeviceMotionEvent objects (rotationRate alpha/beta/gamma = about z/x/y)
export async function dispatch(page, samples, interval = 1000 / 60, noGyro = false) {
  await page.evaluate(([S, iv, ng]) => {
    for (const s of S) window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
      accelerationIncludingGravity: { x: s[0], y: s[1], z: s[2] },
      rotationRate: ng ? null : { alpha: s[5], beta: s[3], gamma: s[4] }, interval: iv }));
  }, [samples, interval, noGyro]);
}
export function pageErrors(p) { const errs = []; p.on('pageerror', e => errs.push(e.message)); return errs; }
export const sleep = ms => new Promise(r => setTimeout(r, ms));
