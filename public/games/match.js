// Partite a turni su scacchiera (Scacchi e Dama): giocatori, turni, tempo, esito.
// Usato dal server (fonte di verità) e dal browser per la modalità P1P.
import { GameError, cleanName } from '../engine.js';
import * as Chess from './chess.js';
import * as Dama from './checkers.js';

export const RULES = { scacchi: Chess, dama: Dama };
export const KINDS = ['navale', 'scacchi', 'dama'];
export const TURN_SECONDS = [0, 30, 60, 120, 300, 600];

export const cleanKind = (k) => (KINDS.includes(k) ? k : 'navale');
export const cleanTurnSeconds = (s) => (TURN_SECONDS.includes(Number(s)) ? Number(s) : 0);

/** Quando avvisare che il tempo sta per scadere: al 20% del tempo, ma non meno di 10 secondi prima. */
export const warnBeforeMs = (turnSeconds) => Math.max(10_000, turnSeconds * 1000 * 0.2);

export const colorOfIdx = (idx) => (idx === 0 ? 'w' : 'b');
const idxOfColor = (c) => (c === 'w' ? 0 : 1);

export function createMatch(id, kind, { turnSeconds = 0, now = Date.now() } = {}) {
  return {
    id,
    kind,
    createdAt: now,
    phase: 'waiting',
    players: [],
    state: RULES[kind].initial(),
    turnSeconds: cleanTurnSeconds(turnSeconds),
    turnStartedAt: null,
    winner: null,
    result: null,
    lastMove: null,
    moveCount: 0,
  };
}

export function addPlayer(m, { token, name }, now = Date.now()) {
  if (m.players.length >= 2) throw new GameError('La partita è già al completo.', 'game_full');
  m.players.push({ token, name: cleanName(name) });
  if (m.players.length === 2) {
    m.phase = 'playing';
    m.turnStartedAt = now;
  }
  return m.players.length - 1;
}

export function currentIdx(m) {
  return idxOfColor(m.state.turn);
}

export function move(m, idx, input, now = Date.now()) {
  if (m.phase !== 'playing') throw new GameError('La partita non è in corso.', 'not_playing');
  if (currentIdx(m) !== idx) throw new GameError('Non è il tuo turno.', 'not_your_turn');
  const R = RULES[m.kind];
  const mv = R.findMove(m.state, input || {});
  if (!mv) throw new GameError('Mossa non valida.', 'illegal_move');
  const capture = m.kind === 'scacchi' ? !!(m.state.board[mv.to] || mv.enPassant) : mv.captures.length > 0;
  m.state = R.applyMove(m.state, mv);
  m.moveCount++;
  m.lastMove = {
    by: idx,
    from: m.kind === 'scacchi' ? mv.from : mv.path[0],
    to: m.kind === 'scacchi' ? mv.to : mv.path[mv.path.length - 1],
    path: mv.path,
    captures: mv.captures,
    capture,
    text: R.notation(mv),
  };
  const end = R.outcome(m.state);
  if (end) {
    m.phase = 'finished';
    m.result = end.result;
    m.winner = end.winner ? idxOfColor(end.winner) : null;
    m.turnStartedAt = null;
  } else {
    m.turnStartedAt = now;
  }
  return m.lastMove;
}

/** Tempo scaduto: chi doveva muovere perde. */
export function timeout(m) {
  if (m.phase !== 'playing') return;
  m.phase = 'finished';
  m.result = 'timeout';
  m.winner = 1 - currentIdx(m);
  m.turnStartedAt = null;
}

export function reset(m, now = Date.now()) {
  m.state = RULES[m.kind].initial();
  m.phase = m.players.length === 2 ? 'playing' : 'waiting';
  m.turnStartedAt = m.players.length === 2 ? now : null;
  m.winner = null;
  m.result = null;
  m.lastMove = null;
  m.moveCount = 0;
}

export function viewFor(m, idx) {
  const me = m.players[idx];
  const opp = m.players[1 - idx];
  const st = m.state;
  return {
    kind: m.kind,
    id: m.id,
    phase: m.phase,
    you: idx,
    color: colorOfIdx(idx),
    myTurn: m.phase === 'playing' && currentIdx(m) === idx,
    turnStartedAt: m.turnStartedAt,
    turnSeconds: m.turnSeconds,
    winner: m.phase !== 'finished' ? null : m.winner === null ? 'draw' : m.winner === idx ? 'me' : 'opponent',
    result: m.result,
    board: st.board,
    turn: st.turn,
    castling: st.castling,
    ep: st.ep,
    halfmove: st.halfmove,
    fullmove: st.fullmove,
    quiet: st.quiet,
    check: m.kind === 'scacchi' && m.phase !== 'waiting' ? Chess.inCheck(st) : false,
    lastMove: m.lastMove ? { ...m.lastMove, byMe: m.lastMove.by === idx } : null,
    moveCount: m.moveCount,
    me: { name: me.name },
    opponent: opp ? { name: opp.name } : null,
  };
}
