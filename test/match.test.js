import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../public/games/match.js';
import * as E from '../public/engine.js';
import { pendingEvents } from '../src/schedule.js';
import { squaresImage, SQUARES_IMAGE_SIZE, reminderContent } from '../src/notify.js';

const sq = (n) => 'abcdefgh'.indexOf(n[0]) + (Number(n[1]) - 1) * 8;

test('partita a scacchi: turni, mosse illegali, matto', () => {
  const m = M.createMatch('abcdefghjk', 'scacchi', { turnSeconds: 60, now: 0 });
  M.addPlayer(m, { token: 'a', name: 'Anna' }, 0);
  assert.equal(m.phase, 'waiting');
  M.addPlayer(m, { token: 'b', name: 'Bruno' }, 1000);
  assert.equal(m.phase, 'playing');
  assert.equal(m.turnStartedAt, 1000);
  assert.throws(() => M.move(m, 1, { from: sq('e7'), to: sq('e5') }), { code: 'not_your_turn' });
  assert.throws(() => M.move(m, 0, { from: sq('e2'), to: sq('e5') }), { code: 'illegal_move' });
  for (const [i, a, b] of [[0, 'f2', 'f3'], [1, 'e7', 'e5'], [0, 'g2', 'g4']]) M.move(m, i, { from: sq(a), to: sq(b) }, 2000);
  const last = M.move(m, 1, { from: sq('d8'), to: sq('h4') }, 3000);
  assert.equal(last.text, 'd8-h4');
  assert.equal(m.phase, 'finished');
  assert.equal(m.result, 'checkmate');
  assert.equal(m.winner, 1);
  const v = M.viewFor(m, 0);
  assert.equal(v.winner, 'opponent');
  assert.equal(v.check, true);
  assert.equal(v.color, 'w');
  assert.equal(M.viewFor(m, 1).winner, 'me');
});

test('partita a dama: tempo scaduto e ricomincia', () => {
  const m = M.createMatch('abcdefghjk', 'dama', { turnSeconds: 30 });
  M.addPlayer(m, { token: 'a', name: 'Anna' });
  M.addPlayer(m, { token: 'b', name: 'Bruno' });
  M.move(m, 0, { path: [sq('b3'), sq('a4')] });
  assert.equal(M.currentIdx(m), 1);
  M.timeout(m);
  assert.equal(m.phase, 'finished');
  assert.equal(m.result, 'timeout');
  assert.equal(m.winner, 0);
  M.reset(m, 5);
  assert.equal(m.phase, 'playing');
  assert.equal(m.moveCount, 0);
  assert.equal(M.cleanTurnSeconds('45'), 0);
  assert.equal(M.cleanTurnSeconds('60'), 60);
  assert.equal(M.cleanKind('poker'), 'navale');
});

test('battaglia: il tempo scaduto passa il turno', () => {
  const g = E.createGame('abcdefghjk', 0, { turnSeconds: 30 });
  E.addPlayer(g, { token: 'a', name: 'A' });
  E.addPlayer(g, { token: 'b', name: 'B' });
  E.placeShips(g, 0, E.randomFleet());
  E.placeShips(g, 1, E.randomFleet(), 100);
  assert.equal(g.turn, 0);
  E.skipTurn(g, 500);
  assert.equal(g.turn, 1);
  assert.equal(g.turnStartedAt, 500);
  assert.equal(E.viewFor(g, 0).turnSeconds, 30);
});

test('eventi a tempo del turno', () => {
  const R = 5 * 60_000;
  const base = { phase: 'playing', turnStartedAt: 1_000_000 };
  // Senza tempo: solo il promemoria
  assert.deepEqual(pendingEvents({ ...base, turnSeconds: 0 }, R), [{ type: 'reminder', at: 1_000_000 + R }]);
  // 10 minuti: promemoria a 5, avviso 2 minuti prima della fine, poi scadenza
  assert.deepEqual(pendingEvents({ ...base, turnSeconds: 600 }, R).map((e) => [e.type, e.at - 1_000_000]), [
    ['reminder', R], ['warn', 480_000], ['timeout', 600_000],
  ]);
  // 30 secondi: avviso a 20 s (10 s prima), niente promemoria separato
  assert.deepEqual(pendingEvents({ ...base, turnSeconds: 30 }, R).map((e) => [e.type, e.at - 1_000_000]), [['warn', 20_000], ['timeout', 30_000]]);
  // Eventi già gestiti per questo turno
  assert.deepEqual(pendingEvents({ ...base, turnSeconds: 600, remindedFor: 1_000_000, warnedFor: 1_000_000 }, R).map((e) => e.type), ['timeout']);
  assert.deepEqual(pendingEvents({ phase: 'finished', turnStartedAt: null, turnSeconds: 30 }, R), []);
});

test('immagine di scacchiera e damiera, promemoria senza didascalie', async () => {
  for (const kind of ['scacchi', 'dama']) {
    const m = M.createMatch('abcdefghjk', kind);
    M.addPlayer(m, { token: 'a', name: 'A' });
    M.addPlayer(m, { token: 'b', name: 'B' });
    const png = await squaresImage(M.viewFor(m, 1));
    const v = new DataView(png.buffer);
    assert.equal(v.getUint32(16), SQUARES_IMAGE_SIZE.width);
  }
  const c = reminderContent({ playerName: 'B', opponentName: 'A', lastMove: 'e2-e4', link: 'x', imageUrl: 'y', captions: false, urgent: true });
  assert.match(c.subject, /Tempo quasi scaduto/);
  assert.match(c.text, /e2-e4/);
  assert.ok(!c.html.includes('La tua flotta'));
});
