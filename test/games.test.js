import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../public/games/chess.js';
import * as D from '../public/games/checkers.js';

// ---------- Scacchi ----------
function fromFEN(fen) {
  const [pos, turn, castle, ep] = fen.split(' ');
  const board = Array(64).fill(null);
  pos.split('/').forEach((row, i) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        board[(7 - i) * 8 + f] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase();
        f++;
      }
    }
  });
  const castling = { wK: castle.includes('K'), wQ: castle.includes('Q'), bK: castle.includes('k'), bQ: castle.includes('q') };
  const epSq = ep && ep !== '-' ? 'abcdefgh'.indexOf(ep[0]) + (Number(ep[1]) - 1) * 8 : null;
  return { board, turn, castling, ep: epSq, halfmove: 0, fullmove: 1 };
}

function perft(state, depth) {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of C.legalMoves(state)) n += perft(C.applyMove(state, m), depth - 1);
  return n;
}

test('scacchi: numero di posizioni dalla partenza (perft)', () => {
  const s = C.initial();
  assert.equal(perft(s, 1), 20);
  assert.equal(perft(s, 2), 400);
  assert.equal(perft(s, 3), 8902);
});

test('scacchi: posizione "Kiwipete" (arrocchi, en passant, promozioni)', () => {
  const s = fromFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -');
  assert.equal(perft(s, 1), 48);
  assert.equal(perft(s, 2), 2039);
});

test('scacchi: posizione 3 (en passant con inchiodatura)', () => {
  const s = fromFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -');
  assert.equal(perft(s, 1), 14);
  assert.equal(perft(s, 2), 191);
  assert.equal(perft(s, 3), 2812);
});

test('scacchi: matto del barbiere, stallo, promozione', () => {
  let s = C.initial();
  for (const [a, b] of [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6'], ['h5', 'f7']]) {
    const sq = (n) => 'abcdefgh'.indexOf(n[0]) + (Number(n[1]) - 1) * 8;
    const m = C.findMove(s, { from: sq(a), to: sq(b) });
    assert.ok(m, a + b);
    s = C.applyMove(s, m);
  }
  assert.deepEqual(C.outcome(s), { result: 'checkmate', winner: 'w' });
  const stale = fromFEN('7k/5Q2/6K1/8/8/8/8/8 b - -');
  assert.deepEqual(C.outcome(stale), { result: 'stalemate', winner: null });
  const promo = fromFEN('8/P6k/8/8/8/8/8/K7 w - -');
  const m = C.findMove(promo, { from: 48, to: 56 });
  assert.equal(m.promo, 'Q');
  assert.equal(C.applyMove(promo, m).board[56], 'wQ');
});

test('scacchi: il PC cattura un pezzo lasciato in presa e dà matto in una', () => {
  const free = fromFEN('4k3/8/8/3q4/8/8/8/3QK3 w - -');
  const m = C.bestMove(free, { ms: 500 });
  assert.equal(m.to, 35); // Dxd5
  const mate = fromFEN('6k1/5ppp/8/8/8/8/8/R5K1 w - -');
  assert.equal(C.bestMove(mate, { ms: 500 }).to, 56); // Ta8#
});

// ---------- Dama italiana ----------
function dama(rows, turn = 'w') {
  // rows: dalla traversa 8 alla 1, caratteri: . vuoto, w b W B
  const board = Array(64).fill(null);
  rows.forEach((row, i) => [...row].forEach((ch, f) => { if (ch !== '.') board[(7 - i) * 8 + f] = ch; }));
  return { board, turn, quiet: 0 };
}

test('dama: partenza con 12 pedine a testa e 7 mosse per il bianco', () => {
  const s = D.initial();
  assert.equal(s.board.filter((p) => p === 'w').length, 12);
  assert.equal(s.board.filter((p) => p === 'b').length, 12);
  assert.equal(D.legalMoves(s).length, 7);
});

test('dama: presa obbligatoria e presa multipla', () => {
  const s = dama([
    '........',
    '........',
    '........',
    '...b....',
    '........',
    '.b......',
    'w.......',
    '........',
  ]);
  const moves = D.legalMoves(s);
  assert.equal(moves.length, 1, 'solo la presa è consentita');
  assert.deepEqual(moves[0].captures.length, 2, 'presa doppia');
});

test('dama: la pedina non mangia la dama, la dama sì', () => {
  const s = dama([
    '........',
    '........',
    '........',
    '........',
    '........',
    '.B......',
    'w.......',
    '........',
  ]);
  assert.ok(D.legalMoves(s).every((m) => m.captures.length === 0));
  const k = dama([
    '........',
    '........',
    '........',
    '........',
    '........',
    '.B......',
    'W.......',
    '........',
  ]);
  assert.equal(D.legalMoves(k)[0].captures.length, 1);
});

test('dama: priorità, a parità di pezzi si cattura con la dama', () => {
  const s = dama([
    '........',
    '........',
    '........',
    '........',
    '.....b..',
    '.b..W...',
    'w.......',
    '........',
  ]);
  const moves = D.legalMoves(s);
  assert.ok(moves.length >= 1);
  assert.ok(moves.every((m) => s.board[m.path[0]] === 'W'));
});

test('dama: promozione e fine partita quando non si può muovere', () => {
  const s = dama([
    '........',
    'w.......',
    '........',
    '........',
    '........',
    '........',
    '........',
    '......b.',
  ]);
  const m = D.legalMoves(s).find((x) => x.path[0] === 48);
  const next = D.applyMove(s, m);
  assert.equal(next.board[m.path[1]], 'W');
  const stuck = dama([
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    '........',
    'w.......',
  ], 'b');
  assert.deepEqual(D.outcome(stuck), { result: 'nomoves', winner: 'w' });
});

test('dama: il PC prende quando può', () => {
  const s = dama([
    '........',
    '........',
    '........',
    '........',
    '........',
    '.b......',
    'w.......',
    '........',
  ]);
  assert.equal(D.bestMove(s, { ms: 200 }).captures.length, 1);
});
