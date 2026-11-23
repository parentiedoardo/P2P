// Disegna public/icon.png (icona delle notifiche).
import { writeFileSync } from 'node:fs';
import { Canvas } from '../src/png.js';
const S = 192, cv = new Canvas(S, S, [31, 111, 235]);
const cell = 36, gap = 6, o = (S - (4 * cell + 3 * gap)) / 2;
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
  const px = o + x * (cell + gap), py = o + y * (cell + gap);
  const ship = y === 1 && x < 3;
  cv.rect(px, py, cell, cell, ship ? [19, 35, 58] : [220, 235, 250]);
  if (y === 1 && x === 1) { cv.rect(px, py, cell, cell, [229, 83, 75]); cv.cross(px + 9, py + 9, cell - 18, 5, [255, 255, 255]); }
  if (y === 3 && x === 2) cv.circle(px + cell / 2, py + cell / 2, 6, [91, 107, 128]);
}
writeFileSync(new URL('../public/icon.png', import.meta.url), await cv.png());
