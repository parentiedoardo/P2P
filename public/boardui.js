// Scacchiera 8x8 per Scacchi e Dama: disegno nella pagina e gestione dei clic (usata anche dal foglio Note).
import * as Chess from '/games/chess.js';
import * as Dama from '/games/checkers.js';

export const RULES = { scacchi: Chess, dama: Dama };
export const isBoardKind = (k) => k === 'scacchi' || k === 'dama';

/** Stato per il motore delle regole ricavato dalla vista ricevuta. */
export function rulesState(v) {
  return v.kind === 'scacchi'
    ? { board: v.board, turn: v.turn, castling: v.castling, ep: v.ep, halfmove: v.halfmove, fullmove: v.fullmove }
    : { board: v.board, turn: v.turn, quiet: v.quiet };
}

const colorOfPiece = (kind, p) => (!p ? null : kind === 'scacchi' ? p[0] : p.toLowerCase());
const fromOf = (kind, m) => (kind === 'scacchi' ? m.from : m.path[0]);
const toOf = (kind, m) => (kind === 'scacchi' ? m.to : m.path[m.path.length - 1]);
export const flipped = (v) => v.color === 'b';
/** Casella scura: negli scacchi a1 è scura, nella dama italiana è scura h1 (si gioca sulle scure). */
export const isDark = (kind, i) => ((i % 8) + Math.floor(i / 8)) % 2 === (kind === 'dama' ? 1 : 0);

/** Selezione del pezzo e scelta della casella d'arrivo. */
export class Picker {
  constructor() {
    this.sel = null;
    this.cacheKey = null;
    this.cache = [];
  }

  reset() { this.sel = null; }

  moves(v) {
    if (!v || v.phase !== 'playing' || !v.myTurn) return [];
    const key = v.kind + v.moveCount + v.turn;
    if (key !== this.cacheKey) {
      this.cacheKey = key;
      this.cache = RULES[v.kind].legalMoves(rulesState(v));
    }
    return this.cache;
  }

  targets(v) {
    if (this.sel === null) return [];
    return this.moves(v).filter((m) => fromOf(v.kind, m) === this.sel).map((m) => toOf(v.kind, m));
  }

  movable(v) {
    return new Set(this.moves(v).map((m) => fromOf(v.kind, m)));
  }

  /** Clic sulla casella `i`: restituisce { send } con la mossa da inviare, { hint } con un suggerimento, oppure {}. */
  click(v, i) {
    const moves = this.moves(v);
    if (!moves.length) { this.sel = null; return {}; }
    if (this.sel !== null && this.sel !== i) {
      const m = moves.find((x) => fromOf(v.kind, x) === this.sel && toOf(v.kind, x) === i);
      if (m) {
        this.sel = null;
        return { send: v.kind === 'scacchi' ? { type: 'move', from: m.from, to: m.to, promo: m.promo ? 'Q' : undefined } : { type: 'move', path: m.path } };
      }
    }
    if (moves.some((x) => fromOf(v.kind, x) === i)) {
      this.sel = this.sel === i ? null : i;
      return {};
    }
    const mine = colorOfPiece(v.kind, v.board[i]) === v.color;
    this.sel = null;
    if (mine && v.kind === 'dama' && moves[0].captures.length) return { hint: 'mustCapture' };
    return {};
  }
}

// ---------- Disegno nella pagina ----------
const GLYPH = { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' };
const VS15 = '︎'; // forza la versione "testo" del simbolo (niente emoji su iOS)
export const FILES = 'abcdefgh';

/** Crea la griglia: 8x8 caselle più le coordinate, orientata dal lato del giocatore. */
export function build(el, flip, onSquare) {
  el.innerHTML = '';
  el.dataset.flip = flip ? '1' : '0';
  for (let row = 0; row < 8; row++) {
    const r = flip ? row : 7 - row;
    el.appendChild(Object.assign(document.createElement('div'), { className: 'label', textContent: r + 1 }));
    for (let col = 0; col < 8; col++) {
      const f = flip ? 7 - col : col;
      const i = r * 8 + f;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sq';
      b.dataset.i = i;
      b.setAttribute('aria-label', FILES[f] + (r + 1));
      b.addEventListener('click', () => onSquare(i));
      el.appendChild(b);
    }
  }
  el.appendChild(document.createElement('div'));
  for (let col = 0; col < 8; col++) {
    el.appendChild(Object.assign(document.createElement('div'), { className: 'label', textContent: FILES[flip ? 7 - col : col] }));
  }
}

export function paint(el, v, picker) {
  const targets = new Set(picker.targets(v));
  const movable = picker.movable(v);
  const last = v.lastMove ? new Set([v.lastMove.from, v.lastMove.to]) : new Set();
  const kingInCheck = v.kind === 'scacchi' && v.check ? v.board.indexOf(v.turn + 'K') : -1;
  for (const b of el.querySelectorAll('.sq')) {
    const i = Number(b.dataset.i);
    const dark = isDark(v.kind, i);
    const p = v.board[i];
    const cls = ['sq', dark ? 'dark' : 'light'];
    if (last.has(i)) cls.push('last');
    if (picker.sel === i) cls.push('sel');
    if (targets.has(i)) cls.push('target', p ? 'occupied' : '');
    if (movable.has(i)) cls.push('movable');
    if (i === kingInCheck) cls.push('incheck');
    b.className = cls.filter(Boolean).join(' ');
    const key = p || '';
    if (b.dataset.p === key) continue;
    b.dataset.p = key;
    b.innerHTML = '';
    if (!p) continue;
    const span = document.createElement('span');
    if (v.kind === 'scacchi') {
      span.className = 'pc ' + p[0];
      span.textContent = GLYPH[p[1]] + VS15;
    } else {
      span.className = 'disc ' + p.toLowerCase() + (p === 'W' || p === 'B' ? ' king' : '');
    }
    b.appendChild(span);
  }
}

/** Lettera del pezzo per il foglio di calcolo: maiuscola il bianco, minuscola il nero (scacchi); o/x per la dama. */
export function cellText(kind, p) {
  if (!p) return '';
  if (kind === 'scacchi') return p[0] === 'w' ? p[1] : p[1].toLowerCase();
  return { w: 'o', W: 'O', b: 'x', B: 'X' }[p];
}

export const squareName = (i) => FILES[i % 8] + (Math.floor(i / 8) + 1);
