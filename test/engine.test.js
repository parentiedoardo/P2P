import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../public/engine.js';

const fleetA = [
  { x: 0, y: 0, len: 5, dir: 'h' },
  { x: 0, y: 2, len: 4, dir: 'h' },
  { x: 0, y: 4, len: 3, dir: 'h' },
  { x: 0, y: 6, len: 3, dir: 'h' },
  { x: 0, y: 8, len: 2, dir: 'h' },
];

function startedGame() {
  const g = E.createGame('abc', 0);
  E.addPlayer(g, { token: 't0', name: 'Anna' });
  E.addPlayer(g, { token: 't1', name: 'Bruno' });
  E.placeShips(g, 0, fleetA, 1);
  E.placeShips(g, 1, fleetA, 2);
  return g;
}

test('fits: limiti, sovrapposizione e navi che si toccano', () => {
  assert.equal(E.fits([], { x: 6, y: 0, len: 5, dir: 'h' }), false);
  assert.equal(E.fits([], { x: 5, y: 0, len: 5, dir: 'h' }), true);
  const one = [{ x: 0, y: 0, len: 3, dir: 'h' }];
  assert.equal(E.fits(one, { x: 0, y: 1, len: 2, dir: 'h' }), false, 'adiacente');
  assert.equal(E.fits(one, { x: 3, y: 1, len: 2, dir: 'v' }), false, 'diagonale');
  assert.equal(E.fits(one, { x: 4, y: 0, len: 2, dir: 'v' }), true);
});

test('validateFleet accetta la flotta corretta e rifiuta quelle sbagliate', () => {
  assert.equal(E.validateFleet(fleetA), null);
  assert.ok(E.validateFleet(fleetA.slice(1)));
  assert.ok(E.validateFleet([...fleetA.slice(0, 4), { x: 0, y: 8, len: 3, dir: 'h' }]));
  assert.ok(E.validateFleet([...fleetA.slice(0, 4), { x: 0, y: 7, len: 2, dir: 'h' }]));
});

test('randomFleet produce sempre flotte valide', () => {
  for (let i = 0; i < 200; i++) assert.equal(E.validateFleet(E.randomFleet()), null);
});

test('fasi della partita', () => {
  const g = E.createGame('abc');
  assert.equal(g.phase, 'waiting');
  E.addPlayer(g, { token: 't0', name: '  Anna  ' });
  assert.equal(g.players[0].name, 'Anna');
  E.addPlayer(g, { token: 't1', name: '' });
  assert.equal(g.players[1].name, 'Giocatore');
  assert.equal(g.phase, 'placing');
  assert.throws(() => E.addPlayer(g, { token: 't2', name: 'C' }), E.GameError);
  E.placeShips(g, 0, fleetA);
  assert.equal(g.phase, 'placing');
  assert.throws(() => E.placeShips(g, 0, fleetA), /già confermato/);
  E.placeShips(g, 1, fleetA, 42);
  assert.equal(g.phase, 'playing');
  assert.equal(g.turn, 0);
  assert.equal(g.turnStartedAt, 42);
});

test('sparare: acqua, colpito, affondato e alternanza dei turni', () => {
  const g = startedGame();
  assert.throws(() => E.fire(g, 1, 0, 0), /tuo turno/);
  assert.deepEqual(E.fire(g, 0, 9, 9, 10), { result: 'miss', len: undefined, gameOver: false });
  assert.equal(g.turn, 1);
  assert.equal(g.turnStartedAt, 10);
  assert.equal(E.fire(g, 1, 0, 8).result, 'hit');
  assert.throws(() => E.fire(g, 0, 9, 9), /già sparato/);
  assert.throws(() => E.fire(g, 0, 10, 0), /non valida/);
  E.fire(g, 0, 8, 8);
  assert.deepEqual(E.fire(g, 1, 1, 8), { result: 'sunk', len: 2, gameOver: false });
});

test('vittoria quando tutte le navi sono affondate', () => {
  const g = startedGame();
  const targets = fleetA.flatMap(E.shipCells);
  let last;
  for (const [i, c] of targets.entries()) {
    last = E.fire(g, 0, c.x, c.y);
    if (last.gameOver) break;
    E.fire(g, 1, i % 10, i < 10 ? 9 : 7); // il giocatore 1 spara in acqua (righe 7 e 9 vuote)
  }
  assert.equal(last.gameOver, true);
  assert.equal(g.phase, 'finished');
  assert.equal(g.winner, 0);
  assert.throws(() => E.fire(g, 1, 9, 9), /non è in corso/);
});

test('viewFor nasconde le navi avversarie finché non sono affondate', () => {
  const g = startedGame();
  E.fire(g, 0, 0, 8);
  E.fire(g, 1, 9, 9);
  E.fire(g, 0, 1, 8);
  const v0 = E.viewFor(g, 0);
  assert.equal(v0.myTurn, false);
  assert.equal(v0.opponent.name, 'Bruno');
  assert.equal(v0.opponent.ships, undefined);
  assert.equal(v0.opponent.sunk.length, 1);
  assert.equal(v0.opponent.shots.length, 2);
  const v1 = E.viewFor(g, 1);
  assert.equal(v1.myTurn, true);
  assert.equal(v1.me.lost, 1);
  assert.equal(v1.me.incoming.length, 2);
  assert.equal(v1.lastShot.byMe, false);
  assert.ok(!JSON.stringify(v1).includes('t0'), 'non espone il token avversario');
});
