// P1P: partita contro il PC, tutta nel browser.
import * as E from './engine.js';

const KEY = 'bn:solo';
const PC_DELAY = 700;

/**
 * Sceglie il colpo del PC. Sfrutta la regola "le navi non si toccano":
 * - le caselle intorno alle navi affondate e in diagonale ai colpi a segno sono sicuramente acqua;
 * - se ci sono colpi a segno non ancora affondati, prosegue lungo la linea o prova le caselle vicine;
 * - altrimenti cerca a scacchiera, dove una nave da 2 o più non può sfuggire.
 */
export function pcMove(shots, sunkShips, rand = Math.random) {
  const key = (x, y) => x + ',' + y;
  const shot = new Set(shots.map((s) => key(s.x, s.y)));
  const sunkCells = new Set(sunkShips.flatMap((s) => E.shipCells(s).map((c) => key(c.x, c.y))));
  const blocked = new Set();
  const inside = (x, y) => x >= 0 && y >= 0 && x < E.SIZE && y < E.SIZE;
  for (const s of sunkShips) for (const c of E.shipCells(s)) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) blocked.add(key(c.x + dx, c.y + dy));
  const open = shots.filter((s) => s.hit && !sunkCells.has(key(s.x, s.y)));
  for (const h of open) for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) blocked.add(key(h.x + dx, h.y + dy));
  const free = (x, y) => inside(x, y) && !shot.has(key(x, y)) && !blocked.has(key(x, y));
  const pick = (cells) => cells[Math.floor(rand() * cells.length)];

  if (open.length) {
    let candidates = [];
    if (open.length >= 2) {
      const horizontal = open.every((h) => h.y === open[0].y);
      const vertical = open.every((h) => h.x === open[0].x);
      if (horizontal || vertical) {
        const vals = open.map((h) => (horizontal ? h.x : h.y));
        const lo = Math.min(...vals) - 1;
        const hi = Math.max(...vals) + 1;
        candidates = horizontal ? [[lo, open[0].y], [hi, open[0].y]] : [[open[0].x, lo], [open[0].x, hi]];
      }
    }
    if (!candidates.some(([x, y]) => free(x, y))) {
      candidates = open.flatMap((h) => [[h.x + 1, h.y], [h.x - 1, h.y], [h.x, h.y + 1], [h.x, h.y - 1]]);
    }
    const ok = candidates.filter(([x, y]) => free(x, y));
    if (ok.length) { const [x, y] = pick(ok); return { x, y }; }
  }

  const all = [];
  for (let y = 0; y < E.SIZE; y++) for (let x = 0; x < E.SIZE; x++) if (free(x, y)) all.push([x, y]);
  const parity = all.filter(([x, y]) => (x + y) % 2 === 0);
  const pool = parity.length ? parity : all.length ? all : [];
  if (pool.length) { const [x, y] = pick(pool); return { x, y }; }
  // Non dovrebbe succedere: ripiega su una qualsiasi casella non ancora colpita.
  for (let y = 0; y < E.SIZE; y++) for (let x = 0; x < E.SIZE; x++) if (!shot.has(key(x, y))) return { x, y };
  return null;
}

export class LocalGame {
  constructor({ name, onState, onError }) {
    this.onState = onState;
    this.onError = onError;
    this.timer = null;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
    this.game = saved?.id === 'solo' ? saved : this.fresh(name);
  }

  fresh(name) {
    const g = E.createGame('solo');
    E.addPlayer(g, { token: 'you', name });
    E.addPlayer(g, { token: 'pc', name: 'PC' });
    E.placeShips(g, 1, E.randomFleet());
    return g;
  }

  restart(name) {
    clearTimeout(this.timer);
    this.game = this.fresh(name || this.game.players[0].name);
    this.emit();
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.game)); } catch {}
  }

  emit() {
    this.save();
    const view = E.viewFor(this.game, 0);
    view.opponentOnline = true;
    view.solo = true;
    this.onState(view);
    if (this.game.phase === 'playing' && this.game.turn === 1) this.schedulePc();
  }

  schedulePc() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const g = this.game;
      if (g.phase !== 'playing' || g.turn !== 1) return;
      const pc = g.players[1];
      const me = g.players[0];
      const sunk = me.ships.filter((s) => E.shipCells(s).every((c) => pc.shots.some((t) => t.x === c.x && t.y === c.y)));
      const move = pcMove(pc.shots, sunk);
      if (move) E.fire(g, 1, move.x, move.y);
      this.emit();
    }, PC_DELAY);
  }

  send(msg) {
    try {
      if (msg.type === 'place') E.placeShips(this.game, 0, msg.ships);
      else if (msg.type === 'fire') E.fire(this.game, 0, msg.x, msg.y);
      else return;
      this.emit();
    } catch (e) {
      if (!(e instanceof E.GameError)) throw e;
      this.onError(e.code, e.message);
    }
  }
}
