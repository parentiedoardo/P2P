// Motore di gioco della Battaglia navale.
// Usato sia dal server (fonte di verità) sia dal browser (anteprima del posizionamento).

export const SIZE = 10;
/** Lunghezze delle navi della flotta: portaerei, corazzata, 2 incrociatori, cacciatorpediniere. */
export const FLEET = [5, 4, 3, 3, 2];
export const SHIP_NAMES = { 5: 'Portaerei', 4: 'Corazzata', 3: 'Incrociatore', 2: 'Cacciatorpediniere' };

export class GameError extends Error {}

/** @typedef {{x:number, y:number, len:number, dir:'h'|'v'}} Ship */

/** Celle occupate da una nave. */
export function shipCells(ship) {
  const cells = [];
  for (let i = 0; i < ship.len; i++) {
    cells.push(ship.dir === 'h' ? { x: ship.x + i, y: ship.y } : { x: ship.x, y: ship.y + i });
  }
  return cells;
}

const inBounds = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < SIZE && y < SIZE;

/**
 * Dice se `ship` si può aggiungere a `ships`: deve stare nella griglia
 * e non può sovrapporsi né toccare (anche in diagonale) un'altra nave.
 */
export function fits(ships, ship) {
  if (!ship || (ship.dir !== 'h' && ship.dir !== 'v') || !Number.isInteger(ship.len) || ship.len < 1) return false;
  const cells = shipCells(ship);
  if (!cells.every((c) => inBounds(c.x, c.y))) return false;
  for (const other of ships) {
    for (const o of shipCells(other)) {
      for (const c of cells) {
        if (Math.abs(o.x - c.x) <= 1 && Math.abs(o.y - c.y) <= 1) return false;
      }
    }
  }
  return true;
}

/** Restituisce un messaggio d'errore se la flotta non è valida, altrimenti null. */
export function validateFleet(ships) {
  if (!Array.isArray(ships) || ships.length !== FLEET.length) return 'La flotta deve avere ' + FLEET.length + ' navi.';
  const lens = ships.map((s) => s && s.len).sort((a, b) => b - a);
  const expected = [...FLEET].sort((a, b) => b - a);
  if (lens.some((l, i) => l !== expected[i])) return 'Le navi non corrispondono alla flotta prevista.';
  const placed = [];
  for (const s of ships) {
    if (!fits(placed, s)) return 'Le navi devono stare nella griglia e non possono toccarsi.';
    placed.push(s);
  }
  return null;
}

/** Flotta casuale valida. */
export function randomFleet(rand = Math.random) {
  for (;;) {
    const ships = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let attempt = 0; attempt < 200 && !placed; attempt++) {
        const dir = rand() < 0.5 ? 'h' : 'v';
        const max = SIZE - len;
        const ship = {
          x: Math.floor(rand() * (dir === 'h' ? max + 1 : SIZE)),
          y: Math.floor(rand() * (dir === 'v' ? max + 1 : SIZE)),
          len,
          dir,
        };
        if (fits(ships, ship)) {
          ships.push(ship);
          placed = true;
        }
      }
      if (!placed) { ok = false; break; }
    }
    if (ok) return ships;
  }
}

export function createGame(id, now = Date.now()) {
  return { id, createdAt: now, phase: 'waiting', players: [], turn: 0, winner: null, turnStartedAt: null, lastShot: null };
}

export function cleanName(name) {
  const n = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return n || 'Giocatore';
}

/** Aggiunge un giocatore e restituisce il suo indice (0 o 1). */
export function addPlayer(game, { token, name }) {
  if (game.players.length >= 2) throw new GameError('La partita è già al completo.');
  game.players.push({ token, name: cleanName(name), ships: null, shots: [] });
  if (game.players.length === 2) game.phase = 'placing';
  return game.players.length - 1;
}

export function placeShips(game, idx, ships, now = Date.now()) {
  if (game.phase !== 'waiting' && game.phase !== 'placing') throw new GameError('Non è il momento di posizionare le navi.');
  const player = game.players[idx];
  if (!player) throw new GameError('Giocatore sconosciuto.');
  if (player.ships) throw new GameError('Hai già confermato la tua flotta.');
  const clean = Array.isArray(ships) ? ships.map((s) => ({ x: s?.x, y: s?.y, len: s?.len, dir: s?.dir })) : ships;
  const err = validateFleet(clean);
  if (err) throw new GameError(err);
  player.ships = clean;
  if (game.players.length === 2 && game.players.every((p) => p.ships)) {
    game.phase = 'playing';
    game.turn = 0;
    game.turnStartedAt = now;
  }
}

function shipAt(ships, x, y) {
  return ships.find((s) => shipCells(s).some((c) => c.x === x && c.y === y));
}

function isSunk(ship, shots) {
  return shipCells(ship).every((c) => shots.some((s) => s.x === c.x && s.y === c.y));
}

/**
 * Il giocatore `idx` spara in (x, y). Il turno passa sempre all'avversario.
 * Restituisce { result: 'miss'|'hit'|'sunk', len?, gameOver }.
 */
export function fire(game, idx, x, y, now = Date.now()) {
  if (game.phase !== 'playing') throw new GameError('La partita non è in corso.');
  if (game.turn !== idx) throw new GameError('Non è il tuo turno.');
  if (!inBounds(x, y)) throw new GameError('Casella non valida.');
  const me = game.players[idx];
  const opp = game.players[1 - idx];
  if (me.shots.some((s) => s.x === x && s.y === y)) throw new GameError('Hai già sparato in questa casella.');

  const target = shipAt(opp.ships, x, y);
  const shot = { x, y, hit: !!target };
  me.shots.push(shot);

  let result = 'miss';
  if (target) result = isSunk(target, me.shots) ? 'sunk' : 'hit';
  const gameOver = opp.ships.every((s) => isSunk(s, me.shots));

  game.lastShot = { by: idx, x, y, result, len: target ? target.len : undefined };
  if (gameOver) {
    game.phase = 'finished';
    game.winner = idx;
    game.turnStartedAt = null;
  } else {
    game.turn = 1 - idx;
    game.turnStartedAt = now;
  }
  return { result, len: target?.len, gameOver };
}

/** Vista della partita per il giocatore `idx`: nasconde le navi avversarie non affondate. */
export function viewFor(game, idx) {
  const me = game.players[idx];
  const opp = game.players[1 - idx];
  const sunkOf = (owner, shooter) => (owner?.ships && shooter ? owner.ships.filter((s) => isSunk(s, shooter.shots)) : []);
  return {
    id: game.id,
    phase: game.phase,
    you: idx,
    myTurn: game.phase === 'playing' && game.turn === idx,
    turnStartedAt: game.turnStartedAt,
    winner: game.winner === null ? null : game.winner === idx ? 'me' : 'opponent',
    lastShot: game.lastShot ? { ...game.lastShot, byMe: game.lastShot.by === idx } : null,
    me: {
      name: me.name,
      ready: !!me.ships,
      ships: me.ships || [],
      incoming: opp ? opp.shots : [],
      lost: sunkOf(me, opp).length,
    },
    opponent: opp
      ? {
          name: opp.name,
          ready: !!opp.ships,
          shots: me.shots,
          sunk: sunkOf(opp, me),
          // A fine partita si rivela la flotta avversaria.
          ships: game.phase === 'finished' ? opp.ships : undefined,
        }
      : null,
  };
}
