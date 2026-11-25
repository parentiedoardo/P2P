// Regole degli scacchi. Caselle 0..63: indice = traversa*8 + colonna, traversa 0 = "1" (lato del bianco).
// Pezzi: 'wK','wQ','wR','wB','wN','wP' e gli stessi con 'b' per il nero.

export const FILES = 'abcdefgh';
export const sqName = (i) => FILES[i % 8] + (Math.floor(i / 8) + 1);
const fileOf = (i) => i % 8;
const rankOf = (i) => Math.floor(i / 8);
const on = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
const opp = (c) => (c === 'w' ? 'b' : 'w');

export function initial() {
  const board = Array(64).fill(null);
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    board[f] = 'w' + back[f];
    board[8 + f] = 'wP';
    board[48 + f] = 'bP';
    board[56 + f] = 'b' + back[f];
  }
  return { board, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: null, halfmove: 0, fullmove: 1 };
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/** La casella `sq` è attaccata da un pezzo del colore `by`? */
export function attacked(board, sq, by) {
  const f = fileOf(sq);
  const r = rankOf(sq);
  // pedoni
  const dir = by === 'w' ? -1 : 1; // il pedone attaccante sta "dietro"
  for (const df of [-1, 1]) {
    const pf = f + df;
    const pr = r + dir;
    if (on(pf, pr) && board[pr * 8 + pf] === by + 'P') return true;
  }
  for (const [df, dr] of KNIGHT) if (on(f + df, r + dr) && board[(r + dr) * 8 + f + df] === by + 'N') return true;
  for (const [df, dr] of KING) if (on(f + df, r + dr) && board[(r + dr) * 8 + f + df] === by + 'K') return true;
  const slide = (dirs, types) => {
    for (const [df, dr] of dirs) {
      let nf = f + df;
      let nr = r + dr;
      while (on(nf, nr)) {
        const p = board[nr * 8 + nf];
        if (p) {
          if (p[0] === by && types.includes(p[1])) return true;
          break;
        }
        nf += df;
        nr += dr;
      }
    }
    return false;
  };
  return slide(ROOK, 'RQ') || slide(BISHOP, 'BQ');
}

export function kingSquare(board, color) {
  return board.indexOf(color + 'K');
}

export function inCheck(state, color = state.turn) {
  return attacked(state.board, kingSquare(state.board, color), opp(color));
}

/** Mosse pseudo-legali (senza controllare se il re resta sotto scacco). */
function pseudoMoves(state) {
  const { board, turn: c } = state;
  const moves = [];
  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p || p[0] !== c) continue;
    const t = p[1];
    const f = fileOf(from);
    const r = rankOf(from);
    const add = (to, extra = {}) => moves.push({ from, to, ...extra });
    if (t === 'P') {
      const dir = c === 'w' ? 1 : -1;
      const start = c === 'w' ? 1 : 6;
      const last = c === 'w' ? 7 : 0;
      const one = from + dir * 8;
      const pushPromo = (to, extra = {}) => {
        if (rankOf(to) === last) for (const promo of ['Q', 'R', 'B', 'N']) add(to, { ...extra, promo });
        else add(to, extra);
      };
      if (on(f, r + dir) && !board[one]) {
        pushPromo(one);
        const two = from + dir * 16;
        if (r === start && !board[two]) add(two, { double: true });
      }
      for (const df of [-1, 1]) {
        if (!on(f + df, r + dir)) continue;
        const to = (r + dir) * 8 + f + df;
        if (board[to] && board[to][0] !== c) pushPromo(to);
        else if (state.ep === to) add(to, { enPassant: true });
      }
    } else if (t === 'N' || t === 'K') {
      for (const [df, dr] of t === 'N' ? KNIGHT : KING) {
        if (!on(f + df, r + dr)) continue;
        const to = (r + dr) * 8 + f + df;
        if (!board[to] || board[to][0] !== c) add(to);
      }
      if (t === 'K') {
        const home = c === 'w' ? 4 : 60;
        const o = opp(c);
        if (from === home && !attacked(board, home, o)) {
          if (state.castling[c + 'K'] && !board[home + 1] && !board[home + 2] && board[home + 3] === c + 'R' &&
              !attacked(board, home + 1, o) && !attacked(board, home + 2, o)) add(home + 2, { castle: 'K' });
          if (state.castling[c + 'Q'] && !board[home - 1] && !board[home - 2] && !board[home - 3] && board[home - 4] === c + 'R' &&
              !attacked(board, home - 1, o) && !attacked(board, home - 2, o)) add(home - 2, { castle: 'Q' });
        }
      }
    } else {
      const dirs = t === 'R' ? ROOK : t === 'B' ? BISHOP : [...ROOK, ...BISHOP];
      for (const [df, dr] of dirs) {
        let nf = f + df;
        let nr = r + dr;
        while (on(nf, nr)) {
          const to = nr * 8 + nf;
          if (board[to]) {
            if (board[to][0] !== c) add(to);
            break;
          }
          add(to);
          nf += df;
          nr += dr;
        }
      }
    }
  }
  return moves;
}

export function applyMove(state, move) {
  const board = state.board.slice();
  const p = board[move.from];
  const c = p[0];
  const captured = move.enPassant ? board[move.to + (c === 'w' ? -8 : 8)] : board[move.to];
  board[move.to] = move.promo ? c + move.promo : p;
  board[move.from] = null;
  if (move.enPassant) board[move.to + (c === 'w' ? -8 : 8)] = null;
  if (move.castle === 'K') { board[move.to - 1] = board[move.to + 1]; board[move.to + 1] = null; }
  if (move.castle === 'Q') { board[move.to + 1] = board[move.to - 2]; board[move.to - 2] = null; }
  const castling = { ...state.castling };
  if (p[1] === 'K') { castling[c + 'K'] = false; castling[c + 'Q'] = false; }
  for (const [sq, key] of [[0, 'wQ'], [7, 'wK'], [56, 'bQ'], [63, 'bK']]) if (move.from === sq || move.to === sq) castling[key] = false;
  return {
    board,
    turn: opp(c),
    castling,
    ep: move.double ? (move.from + move.to) / 2 : null,
    halfmove: p[1] === 'P' || captured ? 0 : state.halfmove + 1,
    fullmove: state.fullmove + (c === 'b' ? 1 : 0),
  };
}

export function legalMoves(state) {
  return pseudoMoves(state).filter((m) => {
    const next = applyMove(state, m);
    return !attacked(next.board, kingSquare(next.board, state.turn), next.turn);
  });
}

function insufficient(board) {
  const rest = board.filter((p) => p && p[1] !== 'K');
  if (rest.length === 0) return true;
  if (rest.length === 1 && (rest[0][1] === 'B' || rest[0][1] === 'N')) return true;
  return false;
}

/** Esito: null se la partita continua, altrimenti { result: 'checkmate'|'stalemate'|'fifty'|'material', winner: 'w'|'b'|null }. */
export function outcome(state, moves = legalMoves(state)) {
  if (moves.length === 0) {
    return inCheck(state) ? { result: 'checkmate', winner: opp(state.turn) } : { result: 'stalemate', winner: null };
  }
  if (state.halfmove >= 100) return { result: 'fifty', winner: null };
  if (insufficient(state.board)) return { result: 'material', winner: null };
  return null;
}

/** Trova tra le mosse legali quella indicata dal client (promozione a donna se non specificata). */
export function findMove(state, { from, to, promo }) {
  const all = legalMoves(state).filter((m) => m.from === from && m.to === to);
  if (!all.length) return null;
  return all.find((m) => (m.promo || null) === (promo || (all[0].promo ? 'Q' : null))) || null;
}

/** Notazione breve per lo storico, es. "e2-e4", "O-O", "e7-e8=Q". */
export function notation(move) {
  if (move.castle === 'K') return 'O-O';
  if (move.castle === 'Q') return 'O-O-O';
  return `${sqName(move.from)}-${sqName(move.to)}${move.promo ? '=' + move.promo : ''}`;
}

// ---------- Avversario PC ----------
const VALUE = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
// Bonus di posizione semplici (dal punto di vista del bianco, traversa 0 = prima)
const CENTER = Array.from({ length: 64 }, (_, i) => {
  const f = fileOf(i);
  const r = rankOf(i);
  return 14 - (Math.abs(3.5 - f) + Math.abs(3.5 - r)) * 4;
});

function evaluate(state) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (!p) continue;
    let v = VALUE[p[1]];
    if (p[1] === 'N' || p[1] === 'B') v += CENTER[i];
    if (p[1] === 'P') v += (p[0] === 'w' ? rankOf(i) : 7 - rankOf(i)) * 6 + CENTER[i] / 3;
    if (p[1] === 'Q') v += CENTER[i] / 3;
    score += p[0] === 'w' ? v : -v;
  }
  return state.turn === 'w' ? score : -score;
}

function ordered(state, moves) {
  return moves
    .map((m) => ({ m, k: (state.board[m.to] ? VALUE[state.board[m.to][1]] * 10 - VALUE[state.board[m.from][1]] : 0) + (m.promo === 'Q' ? 800 : 0) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.m);
}

function search(state, depth, alpha, beta, deadline) {
  const moves = legalMoves(state);
  const end = outcome(state, moves);
  if (end) return end.winner ? -100000 - depth : 0;
  if (depth === 0 || Date.now() > deadline) return evaluate(state);
  let best = -Infinity;
  for (const m of ordered(state, moves)) {
    const v = -search(applyMove(state, m), depth - 1, -beta, -alpha, deadline);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** Sceglie la mossa del PC con ricerca alfa-beta a profondità crescente, entro `ms` millisecondi. */
export function bestMove(state, { ms = 700, maxDepth = 3, rand = Math.random } = {}) {
  const moves = ordered(state, legalMoves(state).filter((m) => !m.promo || m.promo === 'Q'));
  if (!moves.length) return null;
  const deadline = Date.now() + ms;
  let best = moves[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let bestScore = -Infinity;
    let bestHere = null;
    for (const m of moves) {
      const v = -search(applyMove(state, m), depth - 1, -Infinity, Infinity, deadline) + rand() * 6;
      if (v > bestScore) { bestScore = v; bestHere = m; }
      if (Date.now() > deadline) break;
    }
    if (Date.now() > deadline && depth > 1) break;
    best = bestHere;
  }
  return best;
}
