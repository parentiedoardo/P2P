import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/engine.js';
import { pcMove } from '../public/local.js';

function play(seed) {
  let s = seed;
  const rand = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const fleet = E.randomFleet(rand);
  const shots = [];
  const sunk = () => fleet.filter((sh) => E.shipCells(sh).every((c) => shots.some((t) => t.x === c.x && t.y === c.y)));
  for (let n = 1; n <= 100; n++) {
    const m = pcMove(shots, sunk(), rand);
    assert.ok(m, 'il PC trova sempre una mossa');
    assert.ok(!shots.some((t) => t.x === m.x && t.y === m.y), 'mai due volte la stessa casella');
    const hit = fleet.some((sh) => E.shipCells(sh).some((c) => c.x === m.x && c.y === m.y));
    shots.push({ x: m.x, y: m.y, hit });
    if (sunk().length === fleet.length) return n;
  }
  return 101;
}

test('il PC affonda sempre la flotta, in media con meno di 60 colpi', () => {
  const results = Array.from({ length: 200 }, (_, i) => play(i + 1));
  assert.ok(results.every((n) => n <= 100));
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  assert.ok(avg < 60, `media ${avg}`);
});
