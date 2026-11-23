import { SIZE, FLEET, SHIP_NAMES, fits, randomFleet, shipCells, validateFleet } from '/engine.js';

const $ = (id) => document.getElementById(id);
const LETTERS = 'ABCDEFGHIJ';

// --- Archivio locale (può non essere disponibile: tutto in try/catch) ---
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const params = new URLSearchParams(location.search);
let gameId = params.get('g');
let token = gameId ? store.get('bn:' + gameId) : null;

let state = null;        // ultima vista ricevuta dal server
let ws = null;
let retry = 0;
let draft = [];          // navi posizionate ma non ancora confermate
let dir = 'h';
let hover = null;        // {x,y} cella sotto il mouse in fase di posizionamento
let pending = false;     // attendiamo la risposta a un colpo

// ---------- Schermate ----------
function show(screen) {
  for (const s of ['home', 'join', 'game']) $('screen-' + s).hidden = s !== screen;
}

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3500);
}

const savedName = store.get('bn:name') || '';
$('name-create').value = savedName;
$('name-join').value = savedName;

async function post(url, name) {
  store.set('bn:name', name);
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || 'Errore di rete, riprova.');
  return data;
}

$('form-create').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await post('/api/games', $('name-create').value);
    gameId = data.gameId;
    token = data.token;
    store.set('bn:' + gameId, token);
    history.replaceState(null, '', '/?g=' + gameId);
    startGame();
  } catch (err) { toast(err.message); }
});

$('form-join').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await post(`/api/games/${gameId}/join`, $('name-join').value);
    token = data.token;
    store.set('bn:' + gameId, token);
    startGame();
  } catch (err) { toast(err.message); }
});

// ---------- Connessione ----------
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/api/games/${gameId}/ws?token=${encodeURIComponent(token)}`);
  ws.onopen = () => { retry = 0; };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === 'state') onState(msg.state);
    else if (msg.type === 'error') { pending = false; toast(msg.message); render(); }
  };
  ws.onclose = (ev) => {
    if (ev.code === 4403) {
      store.del('bn:' + gameId);
      token = null;
      if (ev.reason === 'Partita inesistente') { toast('Questa partita non esiste più.'); history.replaceState(null, '', '/'); gameId = null; show('home'); }
      else show('join');
      return;
    }
    setStatus('Connessione persa, mi riconnetto…');
    setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
  };
}

function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else toast('Non connesso, riprova tra un attimo.');
}

function startGame() {
  show('game');
  setStatus('Connessione…');
  connect();
}

// ---------- Stato ----------
function onState(next) {
  const prev = state;
  state = next;
  pending = false;
  if (prev && !prev.myTurn && next.myTurn) {
    const s = next.lastShot;
    if (s && !s.byMe) toast(`${next.opponent.name} ha sparato in ${LETTERS[s.x]}${s.y + 1}: ${describe(s)}`);
  }
  const key = (v) => (v?.lastShot ? `${v.lastShot.by}:${v.lastShot.x}:${v.lastShot.y}` : '');
  if (next.lastShot?.byMe && key(next) !== key(prev)) {
    toast(`${LETTERS[next.lastShot.x]}${next.lastShot.y + 1}: ${describe(next.lastShot)}`);
  }
  document.title = next.myTurn ? '🔴 Tocca a te! · Battaglia navale' : 'Battaglia navale';
  render();
}

function describe(s) {
  if (s.result === 'miss') return 'acqua.';
  if (s.result === 'hit') return 'colpito!';
  return `colpito e affondato (${SHIP_NAMES[s.len].toLowerCase()})!`;
}

function setStatus(text, turn = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('turn', turn);
}

// ---------- Rendering ----------
function buildBoard(el, onCell) {
  el.innerHTML = '';
  el.appendChild(Object.assign(document.createElement('div'), { className: 'label' }));
  for (let x = 0; x < SIZE; x++) el.appendChild(Object.assign(document.createElement('div'), { className: 'label', textContent: LETTERS[x] }));
  for (let y = 0; y < SIZE; y++) {
    el.appendChild(Object.assign(document.createElement('div'), { className: 'label', textContent: y + 1 }));
    for (let x = 0; x < SIZE; x++) {
      const c = document.createElement('button');
      c.type = 'button';
      c.className = 'cell';
      c.dataset.x = x;
      c.dataset.y = y;
      c.setAttribute('aria-label', LETTERS[x] + (y + 1));
      c.addEventListener('click', () => onCell(x, y));
      c.addEventListener('mouseenter', () => { if (el.id === 'board-me') { hover = { x, y }; render(); } });
      el.appendChild(c);
    }
  }
  if (el.id === 'board-me') el.addEventListener('mouseleave', () => { hover = null; render(); });
}

const cellOf = (el, x, y) => el.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);

function paint(el, marks) {
  for (const c of el.querySelectorAll('.cell')) c.className = 'cell';
  for (const [x, y, cls] of marks) cellOf(el, x, y)?.classList.add(...cls.split(' '));
}

function nextLen() {
  const remaining = [...FLEET];
  for (const s of draft) remaining.splice(remaining.indexOf(s.len), 1);
  return remaining[0];
}

function placing() {
  return state && (state.phase === 'waiting' || state.phase === 'placing') && !state.me.ready;
}

function render() {
  if (!state) return;
  const me = state.me;
  const opp = state.opponent;
  $('my-name').textContent = '(' + me.name + ')';
  $('opp-name').textContent = opp ? opp.name : 'avversario';
  $('opp-online').classList.toggle('on', !!state.opponentOnline);
  $('opp-online').title = state.opponentOnline ? 'Connesso' : 'Non connesso';

  // Link di invito
  $('share').hidden = state.phase !== 'waiting';
  $('share-link').value = location.origin + '/?g=' + state.id;

  // Posizionamento
  const isPlacing = placing();
  $('placement').hidden = !isPlacing;
  if (isPlacing) {
    const len = nextLen();
    $('placement-hint').textContent = len
      ? `Posiziona: ${SHIP_NAMES[len]} (${len} caselle), ${dir === 'h' ? 'orizzontale' : 'verticale'}. Clicca una nave già messa per toglierla.`
      : 'Flotta completa! Premi "Pronto" per confermarla.';
    $('btn-ready').disabled = validateFleet(draft) !== null;
  }

  // Griglia del giocatore
  const myMarks = [];
  const ships = me.ready ? me.ships : draft;
  for (const s of ships) for (const c of shipCells(s)) myMarks.push([c.x, c.y, 'ship']);
  if (isPlacing && hover && nextLen()) {
    const ship = { x: hover.x, y: hover.y, len: nextLen(), dir };
    const ok = fits(draft, ship);
    for (const c of shipCells(ship)) if (c.x < SIZE && c.y < SIZE) myMarks.push([c.x, c.y, ok ? 'preview' : 'preview bad']);
  }
  for (const s of me.incoming) myMarks.push([s.x, s.y, s.hit ? 'hit shot' : 'miss shot']);
  if (state.lastShot && !state.lastShot.byMe) myMarks.push([state.lastShot.x, state.lastShot.y, 'last']);
  paint($('board-me'), myMarks);

  // Griglia avversaria
  const oppMarks = [];
  if (opp) {
    if (opp.ships) for (const s of opp.ships) for (const c of shipCells(s)) oppMarks.push([c.x, c.y, 'ship']);
    for (const s of opp.shots) oppMarks.push([s.x, s.y, s.hit ? 'hit shot' : 'miss shot']);
    for (const s of opp.sunk) for (const c of shipCells(s)) oppMarks.push([c.x, c.y, 'sunk']);
    if (state.lastShot?.byMe) oppMarks.push([state.lastShot.x, state.lastShot.y, 'last']);
  }
  paint($('board-opp'), oppMarks);
  const canFire = state.myTurn && !pending;
  $('board-opp').classList.toggle('clickable', canFire);
  document.querySelector('.boards').classList.toggle('playing', state.phase === 'playing');
  $('board-opp').classList.toggle('dim', state.phase === 'playing' && !state.myTurn);

  // Stato
  const oppName = opp ? opp.name : "l'avversario";
  if (state.phase === 'waiting') setStatus(isPlacing ? 'In attesa che il collega entri. Intanto posiziona le navi.' : 'Flotta pronta. In attesa che il collega entri…');
  else if (state.phase === 'placing') setStatus(me.ready ? `Flotta pronta. Aspettiamo ${oppName}…` : `Posiziona la tua flotta${opp.ready ? ` (${oppName} ha già schierato la sua)` : ''}.`);
  else if (state.phase === 'playing') setStatus(state.myTurn ? 'Tocca a te! Spara sulla flotta avversaria.' : `Turno di ${oppName}…`, state.myTurn);
  else setStatus(state.winner === 'me' ? 'Hai vinto! 🎉' : `Ha vinto ${oppName}.`);

  $('finished').hidden = state.phase !== 'finished';
  $('finished-text').textContent = state.winner === 'me' ? 'Hai vinto! Tutta la flotta avversaria è affondata.' : `Hai perso: ${oppName} ha affondato la tua flotta.`;
}

// ---------- Interazioni ----------
function onMyCell(x, y) {
  if (!placing()) return;
  const existing = draft.findIndex((s) => shipCells(s).some((c) => c.x === x && c.y === y));
  if (existing !== -1) { draft.splice(existing, 1); render(); return; }
  const len = nextLen();
  if (!len) return;
  const ship = { x, y, len, dir };
  if (!fits(draft, ship)) { toast('Non ci sta: le navi non possono uscire dalla griglia né toccarsi.'); return; }
  draft.push(ship);
  render();
}

function onOppCell(x, y) {
  if (!state?.myTurn || pending) return;
  if (state.opponent.shots.some((s) => s.x === x && s.y === y)) return;
  pending = true;
  send({ type: 'fire', x, y });
  render();
}

$('btn-rotate').addEventListener('click', () => { dir = dir === 'h' ? 'v' : 'h'; render(); });
$('btn-random').addEventListener('click', () => { draft = randomFleet(); render(); });
$('btn-clear').addEventListener('click', () => { draft = []; render(); });
$('btn-ready').addEventListener('click', () => {
  send({ type: 'place', ships: draft });
});
$('btn-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('share-link').value); toast('Link copiato!'); }
  catch { $('share-link').select(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'r' || e.key === 'R') && placing() && document.activeElement?.tagName !== 'INPUT') { dir = dir === 'h' ? 'v' : 'h'; render(); }
});

// ---------- Avvio ----------
buildBoard($('board-me'), onMyCell);
buildBoard($('board-opp'), onOppCell);
if (!gameId) show('home');
else if (!token) show('join');
else startGame();
