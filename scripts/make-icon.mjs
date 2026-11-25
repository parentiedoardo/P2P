// Disegna public/icon.png (icona delle notifiche): quadrato verde con una X bianca.
import { writeFileSync } from 'node:fs';
import { Canvas } from '../src/png.js';
const S = 192;
const cv = new Canvas(S, S, [29, 111, 66]);
const W = [255, 255, 255];
// X spessa: per ogni riga disegna i due tratti diagonali
const m = 46, t = 30;
for (let y = m; y < S - m; y++) {
  const k = (y - m) / (S - 2 * m - 1);
  const x1 = Math.round(m + k * (S - 2 * m - t));
  const x2 = Math.round(S - m - t - k * (S - 2 * m - t));
  cv.rect(x1, y, t, 1, W);
  cv.rect(x2, y, t, 1, W);
}
writeFileSync(new URL('../public/icon.png', import.meta.url), await cv.png());
