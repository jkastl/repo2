// Run from anywhere: node tests/tearproof-tags.mjs  (screenshots go to tests/out/)
import { mkdirSync as __mk } from 'fs';
const ROOT_URL = new URL('../', import.meta.url).href;
const OUT = new URL('./out/', import.meta.url).pathname; __mk(OUT, { recursive: true });
import fs from 'fs';
import { webcrypto } from 'crypto';
globalThis.crypto ??= webcrypto;
const src = fs.readFileSync(new URL('../tearproof/index.html', import.meta.url), 'utf8');
const tp = src.split('/* ================================================================\n   Math core')[1].split('</script>')[0];
const qr = src.split('QR encoder, versions 1–10')[1].split('</script>')[0];
const { TP, QRG, TAG } = new Function('/*' + tp + '/*' + qr + '; return { TP, QRG, TAG };')();
const enc = new TextEncoder(), dec = new TextDecoder();
let n = 0, maxV = 0, typoCaught = 0, typoTotal = 0;
for (const mode of ['secret', 'backup']) for (const text of ['hunter2', 'Wi-Fi: Tolerance5G / pw: s3cr3t-päss 🔑', 'x'.repeat(120)]) {
  const bytes = enc.encode(text);
  for (let N = 2; N <= 8; N++) for (let k = 2; k <= N; k++) {
    const set = [...crypto.getRandomValues(new Uint8Array(3))];
    const codes = TP.split(bytes, N, k, mode).map(s => TAG.pack({ mode, k, n: N, x: s.x, set, len: bytes.length, data: s.data }));
    for (const c of codes) maxV = Math.max(maxV, QRG.encode(c).version);
    // recover from the last k, typed sloppily: lowercase, dashes, O for 0, l for 1
    const typed = codes.slice(-k).map(c => TAG.pretty(c).toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l'));
    const tags = typed.map(t => { const u = TAG.unpack(t); if (!u.ok) throw u.why; return u.tag; });
    const got = dec.decode(TP.combine(tags.map(t => ({ x: t.x, data: t.data })), k, mode, tags[0].len));
    if (got !== text) throw `round trip ${mode} ${N} ${k}`;
    n++;
    // single-character typos: change one char to a different valid one
    for (let t = 0; t < 20; t++) {
      const c = codes[0], i = Math.floor(Math.random() * c.length);
      const alt = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'.replace(c[i], '');
      const bad = c.slice(0, i) + alt[Math.floor(Math.random() * alt.length)] + c.slice(i + 1);
      typoTotal++; if (!TAG.unpack(bad).ok) typoCaught++;
    }
  }
}
console.log(`${n} split → pack → sloppy-typed → unpack → combine round trips ok; largest QR needed: version ${maxV}`);
console.log(`single-character typos caught by the checksum: ${typoCaught} of ${typoTotal}`);
const big = TAG.pack({ mode: 'secret', k: 3, n: 5, x: 1, set: [1, 2, 3], len: 120, data: new Uint8Array(120) });
console.log('120-byte secret tag:', big.length, 'chars, QR version', QRG.encode(big).version);
