# Right Answers from Wrong Parts

Six live instruments that get the right answer out of noisy, broken, drifting, or
lying parts, and show how each one fails:

| # | Exhibit | What it shows |
|---|---|---|
| 01 | The Vote | Triple modular redundancy, von Neumann's threshold, and common-mode failure (Ariane 5) |
| 02 | Scratch the Code | A real, scannable QR code (version 3-H) you can deface, with the Reed–Solomon decoder repairing it live |
| 03 | Where Am I | GPS pseudoranging: solving for position *and* clock, dilution of precision, and why altitude is worse |
| 04 | Two Wrong Answers | A GPS + accelerometer Kalman filter that also learns the accelerometer's bias |
| 05 | Light Through a Finger | Pulse oximetry's ratio of ratios, motion artifact, perfusion, and camera heart rate with your own finger |
| 06 | Drop It on Purpose | TCP CUBIC through a bloated router buffer, compared with CoDel and fq_codel |

**[jkastl.github.io/repo2](https://jkastl.github.io/repo2/)**

## The Lab

Four new concepts, each on its own page and built a piece at a time. Every page carries its own
design and build plan, and [`CLAUDE.md`](CLAUDE.md) explains how to advance one.

| # | Page | Idea | Status |
|---|---|---|---|
| 07 | [`liar/`](liar/) | Twenty questions against an adversary allowed to lie (Ulam's liar game, Berlekamp's volume bound) | blueprint |
| 08 | [`traitors/`](traitors/) | Pass-the-phone party game running the Byzantine Generals protocol | blueprint |
| 09 | [`fingerprint/`](fingerprint/) | Your phone's sensor calibration errors as an ID (SensorID, 2019), on-device only | blueprint |
| 10 | [`tearproof/`](tearproof/) | Split a secret across printable tags; any k of n rebuild it (Reed–Solomon / Shamir) | blueprint |

No build step, no dependencies, no network calls. The main page is one self-contained
[`index.html`](index.html). Lab pages share [`lab.css`](lab.css). Everything is served by GitHub Pages from `main`. The QR encoder/decoder
(GF(256), Berlekamp–Massey, Forney), Gauss–Newton GPS solver, Kalman filter, and TCP/CoDel
simulation are all written from scratch in the page. The QR output matches the Python
`qrcode` library bit for bit.

The camera demo uses `getUserMedia`, so it needs HTTPS (GitHub Pages is fine). Video frames
are averaged on the device and never sent anywhere.

A sibling of [A Field Guide to Emergence](https://jkastl.github.io/emergence/).

## License

[MIT](LICENSE)
