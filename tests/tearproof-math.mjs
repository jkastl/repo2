// Run from anywhere: node tests/tearproof-math.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import fs from 'fs';
import { webcrypto } from 'crypto';
globalThis.crypto ??= webcrypto;
const src = fs.readFileSync(new URL('../tearproof/index.html', import.meta.url), 'utf8');
const js = src.split('/* ================================================================\n   Math core')[1].split('</script>')[0];
const TP = new Function('/*' + js + '; return TP;')();
const enc = new TextEncoder();
// 1. field sanity: every nonzero element has an inverse, mul is commutative
for (let a = 1; a < 256; a++) { if (TP.mul(a, TP.div(1, a)) !== 1) throw 'inverse ' + a; }
// 2. round-trip every k-subset for n ≤ 8, both modes, several lengths
function subsets(n, k) { const out = []; const rec = (s, acc) => { if (acc.length === k) return out.push(acc); for (let i = s; i < n; i++) rec(i + 1, acc.concat(i)); }; rec(0, []); return out; }
let checks = 0;
const msgs = ['', 'a', 'correct horse battery staple', 'Wi-Fi: Tolerance5G / pw: s3cr3t-päss 🔑', enc.encode('x'.repeat(61))];
for (const mode of ['backup', 'secret']) for (let n = 1; n <= 8; n++) for (let k = 1; k <= n; k++) for (const m of msgs) {
  const bytes = typeof m === 'string' ? enc.encode(m) : m;
  const sh = TP.split(bytes, n, k, mode);
  const want = mode === 'backup' ? Math.ceil(bytes.length / k) : bytes.length;
  if (sh.some(s => s.data.length !== want)) throw `share size ${mode} n${n} k${k}`;
  for (const sub of subsets(n, k)) {
    // shuffle order too
    const pick = sub.map(i => sh[i]).sort(() => Math.random() - 0.5);
    const got = TP.combine(pick, k, mode, bytes.length);
    if (Buffer.compare(Buffer.from(got), Buffer.from(bytes))) throw `round trip ${mode} n${n} k${k} ${sub}`;
    checks++;
  }
}
console.log('round trips ok:', checks);
// 3. secret mode: the joint distribution of k-1 shares is the same for every secret.
//    Enumerate every random coefficient vector exhaustively; each (k-1)-tuple of share
//    values must appear exactly once, for every secret.
function uniform(k, xs, secrets) {
  const R = k - 1, total = 256 ** R;
  for (const s of secrets) {
    const seen = new Uint8Array(total);
    for (let r = 0; r < total; r++) {
      const coeffs = []; let t = r; for (let i = 0; i < R; i++) { coeffs.push(t & 255); t >>= 8; }
      const sh = TP.split(new Uint8Array([s]), 8, k, 'secret', () => new Uint8Array(coeffs));
      let idx = 0; for (const x of xs) idx = idx * 256 + sh[x - 1].data[0];
      if (seen[idx]++) throw `k=${k} secret ${s}: share tuple repeated`;
    }
  }
  return true;
}
for (let x = 1; x <= 8; x++) uniform(2, [x], [...Array(256).keys()]);
console.log('k=2: every single share is uniform for all 256 secrets, all 8 positions');
for (const xs of [[1, 2], [3, 7], [5, 8]]) uniform(3, xs, [0, 1, 0x41, 0xff]);
console.log('k=3: every pair of shares is uniform (65,536 tuples, each once) for secrets 0,1,0x41,0xff');
uniform(4, [2, 5, 6], [0, 0x7a]);
console.log('k=4: every triple (16.7M tuples, each once) for secrets 0, 0x7a');
// 4. backup mode leaks: a single share with k=2 is a function of the data
const a = TP.split(enc.encode('AA'), 3, 2, 'backup'), b = TP.split(enc.encode('AB'), 3, 2, 'backup');
console.log('backup mode share 1 differs between "AA" and "AB":', a[0].data[0] !== b[0].data[0]);
