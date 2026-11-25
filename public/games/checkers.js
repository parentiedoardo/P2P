// Regole della Dama italiana su scacchiera 8x8.
// Caselle 0..63 (indice = traversa*8 + colonna, traversa 0 = lato del bianco). Si gioca sulle caselle scure,
// quelle con (colonna + traversa) dispari: come nella dama italiana, la casella d'angolo in basso a destra (h1) è scura. Pezzi: 'w' pedina bianca, 'W' dama bianca, 'b' / 'B' per il nero.
// Regole: muove per primo il bianco; le pedine muovono e catturano solo in avanti e non possono catturare le dame;
// la presa è obbligatoria e, se ci sono più possibilità, valgono le priorità della dama italiana:
// 1) più pezzi catturati, 2) cattura con la dama, 3) più dame catturate, 4) dama catturata per prima.

const fileOf = (i) => i % 8;
const rankOf = (i) => Math.floor(i / 8);
const on = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
export const playable = (i) => (fileOf(i) + rankOf(i)) % 2 === 1;
const colorOf = (p) => (p ? p.toLowerCase() : null);
const isKing = (p) => p === 'W' || p === 'B';
const opp = (c) => (c === 'w' ? 'b' : 'w');
export const FILES = 'abcdefgh';
export const sqName = (i) => FILES[i % 8] + (Math.floor(i / 8) + 1);

export function initial() {
  const board = Array(64).fill(null);
  for (let i = 0; i < 64; i++) {
    if (!playable(i)) continue;
    if (rankOf(i) <= 2) board[i] = 'w';
    if (rankOf(i) >= 5) board[i] = 'b';
  }
  return { board, turn: 'w', quiet: 0 };
}

function stepDirs(p) {
  if (isKing(p)) return [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  return colorOf(p) === 'w' ? [[1, 1], [-1, 1]] : [[1, -1], [-1, -1]];
}

/** Tutte le sequenze di presa a partire da `from` (ricorsivo). */
function captures(board, from, piece) {
  const c = colorOf(piece);
  const king = isKing(piece);
  const lastRank = c === 'w' ? 7 : 0;
  const out = [];
  const walk = (sq, path, taken, takenKings) => {
    let extended = false;
    for (const [df, dr] of stepDirs(piece)) {
      const mf = fileOf(sq) + df;
      const mr = rankOf(sq) + dr;
      const lf = mf + df;
      const lr = mr + dr;
      if (!on(lf, lr)) continue;
      const mid = mr * 8 + mf;
      const land = lr * 8 + lf;
      const victim = board[mid];
      if (!victim || colorOf(victim) === c || taken.includes(mid)) continue;
      if (!king && isKing(victim)) continue; // la pedina non mangia la dama
      if (board[land] && land !== from) continue;
      extended = true;
      const nextPath = [...path, land];
      const nextTaken = [...taken, mid];
      const nextKings = [...takenKings, isKing(victim)];
      // Una pedina che arriva in fondo diventa dama e la mossa finisce.
      if (!king && rankOf(land) === lastRank) out.push({ path: nextPath, captures: nextTaken, kings: nextKings });
      else walk(land, nextPath, nextTaken, nextKings);
    }
    if (!extended && taken.length) out.push({ path, captures: taken, kings: takenKings });
  };
  walk(from, [from], [], []);
  return out;
}

/** Confronta due prese secondo le priorità italiane: >0 se `a` ha la precedenza. */
function priority(a, b, board) {
  if (a.captures.length !== b.captures.length) return a.captures.length - b.captures.length;
  const ka = isKing(board[a.path[0]]) ? 1 : 0;
  const kb = isKing(board[b.path[0]]) ? 1 : 0;
  if (ka !== kb) return ka - kb;
  const na = a.kings.filter(Boolean).length;
  const nb = b.kings.filter(Boolean).length;
  if (na !== nb) return na - nb;
  const fa = a.kings.indexOf(true);
  const fb = b.kings.indexOf(true);
  if (fa !== fb) return (fa === -1 ? 99 : -fa) - (fb === -1 ? 99 : -fb);
  return 0;
}

export function legalMoves(state) {
  const { board, turn: c } = state;
  let caps = [];
  const simple = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || colorOf(p) !== c) continue;
    caps.push(...captures(board, i, p));
    for (const [df, dr] of stepDirs(p)) {
      const f = fileOf(i) + df;
      const r = rankOf(i) + dr;
      if (on(f, r) && !board[r * 8 + f]) simple.push({ path: [i, r * 8 + f], captures: [], kings: [] });
    }
  }
  if (caps.length) {
    let best = caps[0];
    for (const m of caps) if (priority(m, best, board) > 0) best = m;
    caps = caps.filter((m) => priority(m, best, board) === 0);
    return caps.map(({ path, captures: cp }) => ({ path, captures: cp }));
  }
  return simple.map(({ path, captures: cp }) => ({ path, captures: cp }));
}

export function applyMove(state, move) {
  const board = state.board.slice();
  const from = move.path[0];
  const to = move.path[move.path.length - 1];
  let p = board[from];
  board[from] = null;
  for (const sq of move.captures) board[sq] = null;
  const promote = !isKing(p) && rankOf(to) === (p === 'w' ? 7 : 0);
  if (promote) p = p.toUpperCase();
  board[to] = p;
  return { board, turn: opp(state.turn), quiet: move.captures.length || promote ? 0 : state.quiet + 1 };
}

/** Esito: null se si continua; chi resta senza mosse perde. Dopo 80 mosse senza prese né promozioni è patta. */
export function outcome(state, moves = legalMoves(state)) {
  if (moves.length === 0) return { result: 'nomoves', winner: opp(state.turn) };
  if (state.quiet >= 80) return { result: 'draw', winner: null };
  return null;
}

export function findMove(state, { path }) {
  if (!Array.isArray(path) || path.length < 2) return null;
  const moves = legalMoves(state);
  const exact = moves.find((m) => m.path.length === path.length && m.path.every((s, i) => s === path[i]));
  if (exact) return exact;
  // Il client può indicare solo partenza e arrivo: va bene se la presa è unica.
  const same = moves.filter((m) => m.path[0] === path[0] && m.path[m.path.length - 1] === path[path.length - 1]);
  return same.length >= 1 && path.length === 2 ? same[0] : null;
}

export function notation(move) {
  return move.path.map(sqName).join(move.captures.length ? 'x' : '-');
}

// ---------- Avversario PC ----------
function evaluate(state) {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const p = state.board[i];
    if (!p) continue;
    let v = isKing(p) ? 170 : 100 + (p === 'w' ? rankOf(i) : 7 - rankOf(i)) * 4;
    const f = fileOf(i);
    if (f === 0 || f === 7) v -= 3;
    s += colorOf(p) === 'w' ? v : -v;
  }
  return state.turn === 'w' ? s : -s;
}

function search(state, depth, alpha, beta, deadline) {
  const moves = legalMoves(state);
  const end = outcome(state, moves);
  if (end) return end.winner ? -100000 - depth : 0;
  if (depth === 0 || Date.now() > deadline) return evaluate(state);
  let best = -Infinity;
  for (const m of moves) {
    const v = -search(applyMove(state, m), depth - 1, -beta, -alpha, deadline);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

export function bestMove(state, { ms = 600, maxDepth = 6, rand = Math.random } = {}) {
  const moves = legalMoves(state);
  if (!moves.length) return null;
  const deadline = Date.now() + ms;
  let best = moves[0];
  for (let depth = 1; depth <= maxDepth; depth++) {
    let bestScore = -Infinity;
    let bestHere = null;
    for (const m of moves) {
      const v = -search(applyMove(state, m), depth - 1, -Infinity, Infinity, deadline) + rand() * 4;
      if (v > bestScore) { bestScore = v; bestHere = m; }
    }
    if (Date.now() > deadline && depth > 1) break;
    best = bestHere;
  }
  return best;
}
