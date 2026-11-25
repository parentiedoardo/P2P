import { SIZE, FLEET, fits, randomFleet, shipCells, validateFleet } from '/engine.js';
import { t, lang, setLang, applyStatic, shipName, errorText } from '/i18n.js';
import * as Stealth from '/stealth.js';
import * as Shell from '/shell.js';
import * as Tour from '/tour.js';
import { LocalGame, LocalMatch } from '/local.js';
import * as BoardUI from '/boardui.js';
import { warnBeforeMs, cleanKind, cleanTurnSeconds } from '/games/match.js';

const $ = (id) => document.getElementById(id);
const LETTERS = 'ABCDEFGHIJ';
const cellName = (x, y) => `${LETTERS[x]}${y + 1}`;

// --- Archivio locale (può non essere disponibile: tutto in try/catch) ---
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

const params = new URLSearchParams(location.search);
const solo = params.get('solo') === '1';
let gameId = params.get('g');
// Il link nei promemoria contiene il token (?t=): lo salviamo e lo togliamo dall'indirizzo.
if (gameId && params.get('t')) {
  store.set('bn:' + gameId, params.get('t'));
  history.replaceState(null, '', '/?g=' + gameId);
}
let token = gameId ? store.get('bn:' + gameId) || params.get('t') : null;
let vapidKey = null;
let pushEndpoint = null; // sottoscrizione push di questo browser

let state = null;        // ultima vista ricevuta
let ws = null;
let local = null;        // partita P1P contro il PC
let retry = 0;
let draft = [];          // navi posizionate ma non ancora confermate
let dir = 'h';
let hover = null;        // {x,y} cella sotto il mouse in fase di posizionamento
let pending = false;     // attendiamo la risposta a un colpo o a una mossa
const picker = new BoardUI.Picker(); // scacchi e dama: pezzo selezionato
let clockOffset = 0;     // differenza tra l'orologio del server e quello del browser
let warnedFor = null;    // inizio del turno per cui abbiamo già avvisato che il tempo scade
const isBoard = (v) => BoardUI.isBoardKind(v?.kind);

// ---------- Schermate ----------
function show(screen) {
  for (const s of ['home', 'join', 'game']) $('screen-' + s).hidden = s !== screen;
  if (screen === 'home') setTimeout(() => startTour(), 400);
}

// ---------- "Come funziona" ----------
const step = (key, targets) => ({ title: t(key + 'T'), text: t(key), targets });
const homeSteps = () => [
  step('tourWelcome', []),
  step('tourName', ['#name-create', '#email-create']),
  step('tourGame', ['#form-create .seg']),
  step('tourTime', ['#turn-time']),
  step('tourStart', ['#form-create button[type=submit]', '#btn-solo']),
  step('tourStealth', ['#btn-stealth']),
  step('tourMode', ['#btn-mode']),
  step('tourFile', ['.shell [data-file-menu]']),
];
const gameSteps = () => [
  step('tourStatus', ['#status', '#clock']),
  step('tourShare', ['#share']),
  step('tourPlace', ['#placement']),
  step('tourBoard', ['.boards', '#sq-area']),
  step('tourNotify', ['#notify']),
  step('tourRestart', ['#btn-restart']),
  step('tourStealth', ['#btn-stealth']),
  step('tourFile', ['.shell [data-file-menu]']),
];

/** Mostra il tour della schermata corrente (la prima volta, o sempre con force). */
function startTour(force = false) {
  if (!force && (Stealth.isActive() || document.documentElement.classList.contains('stealth-boot') || Shell.isFileOpen())) return;
  if (!$('screen-home').hidden) Tour.start('home', homeSteps(), { force });
  else if (!$('screen-game').hidden && state) Tour.start('game', gameSteps(), { force });
}

function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 3500);
  Stealth.flash(text);
}

const savedName = store.get('bn:name') || '';
const savedEmail = store.get('bn:email') || '';
$('name-create').value = savedName;
$('name-join').value = savedName;
$('email-create').value = savedEmail;
$('email-join').value = savedEmail;
// "Apri sempre in modalità discreta": nel modulo e nel menu File, sincronizzati
for (const id of ['start-stealth', 'fp-start-stealth']) {
  $(id).checked = store.get('bn:startStealth') === '1';
  $(id).addEventListener('change', (e) => {
    store.set('bn:startStealth', e.target.checked ? '1' : '0');
    for (const other of ['start-stealth', 'fp-start-stealth']) $(other).checked = e.target.checked;
  });
}

// Scelta del gioco e del tempo per turno (ricordate per la prossima volta)
const kindInputs = [...document.querySelectorAll('input[name="kind"]')];
const selectedKind = () => kindInputs.find((i) => i.checked)?.value || 'navale';
{
  const k = cleanKind(store.get('bn:kind'));
  for (const i of kindInputs) i.checked = i.value === k;
}
// Le stesse scelte compaiono nel menu File: le teniamo allineate.
const fpKindInputs = [...document.querySelectorAll('input[name="fp-kind"]')];
const syncKind = (k) => { for (const i of [...kindInputs, ...fpKindInputs]) i.checked = i.value === k; };
syncKind(selectedKind());
for (const i of [...kindInputs, ...fpKindInputs]) i.addEventListener('change', () => { store.set('bn:kind', i.value); syncKind(i.value); });
for (const id of ['turn-time', 'fp-time']) {
  $(id).value = String(cleanTurnSeconds(store.get('bn:turnSeconds')));
  $(id).addEventListener('change', (e) => {
    store.set('bn:turnSeconds', e.target.value);
    $('turn-time').value = $('fp-time').value = e.target.value;
  });
}

async function post(url, name, email, extra = {}) {
  store.set('bn:name', name);
  store.set('bn:email', email);
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, email, lang, ...extra }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(errorText(data.code, data.error));
  return data;
}

$('form-create').addEventListener('submit', (e) => {
  e.preventDefault();
  createSession($('name-create').value, $('email-create').value);
});

async function createSession(name, email) {
  try {
    const data = await post('/api/games', name, email, {
      kind: selectedKind(),
      turnSeconds: Number($('turn-time').value),
    });
    gameId = data.gameId;
    token = data.token;
    store.set('bn:' + gameId, token);
    history.replaceState(null, '', '/?g=' + gameId);
    startGame();
  } catch (err) { toast(err.message); }
}

function startP1P() {
  const name = $('name-create').value.trim();
  if (name) store.set('bn:name', name);
  navigate(`/?solo=1&kind=${selectedKind()}&ts=${$('turn-time').value}&new=1`);
}
$('btn-solo').addEventListener('click', startP1P);

/** Cambia pagina restando in modalità discreta se era attiva. */
function navigate(url) {
  if (Stealth.isActive()) { try { sessionStorage.setItem('bn:stealthNow', '1'); } catch {} }
  location.href = url;
}

// Menu File: nuova sessione con le scelte fatte lì
$('fp-p2p').addEventListener('click', () => {
  const name = (store.get('bn:name') || $('name-create').value || '').trim();
  if (!name) {
    // Serve un nome: torniamo al modulo iniziale
    Shell.closeFile();
    if (Stealth.isActive()) Stealth.toggle(false);
    if ($('screen-home').hidden) { navigate('/'); return; }
    $('name-create').focus();
    return;
  }
  Shell.closeFile();
  if (local || gameId) leaveSession();
  local = null;
  createSession(name, store.get('bn:email') || '');
});
$('fp-p1p').addEventListener('click', () => { Shell.closeFile(); leaveSession(); startP1P(); });

$('form-join').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const data = await post(`/api/games/${gameId}/join`, $('name-join').value, $('email-join').value);
    token = data.token;
    store.set('bn:' + gameId, token);
    startGame();
  } catch (err) { toast(err.message); }
});

// ---------- Connessione ----------
function connect() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/api/games/${gameId}/ws?token=${encodeURIComponent(token)}`);
  ws.onopen = () => {
    retry = 0;
    send({ type: 'settings', lang }, true);
    dispatchEvent(new Event('bn:connected'));
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.serverNow) clockOffset = msg.serverNow - Date.now();
    if (msg.type === 'state') onState(msg.state);
    else if (msg.type === 'error') onError(msg.code, msg.message);
    else if (msg.type === 'info') onInfo(msg);
  };
  ws.onclose = (ev) => {
    if (ev.code === 4403) {
      store.del('bn:' + gameId);
      token = null;
      if (ev.reason === 'Partita inesistente') { toast(t('gameGone')); history.replaceState(null, '', '/'); gameId = null; show('home'); }
      else show('join');
      return;
    }
    setStatus(t('reconnecting'));
    setTimeout(connect, Math.min(1000 * 2 ** retry++, 15000));
  };
}

function onInfo(msg) {
  if (msg.code === 'restarted') {
    draft = [];
    picker.reset();
    toast(t('restarted', { name: msg.name }));
  } else if (msg.code === 'left') {
    toast(t('left', { name: msg.name }));
  } else if (msg.code === 'timeout') {
    const name = state?.opponent?.name || t('opponent');
    const text = msg.byMe
      ? (isBoard(state) ? t('timeoutLostMe') : t('timeoutSkipMe', { name }))
      : (isBoard(state) ? t('timeoutWinOpp', { name }) : t('timeoutSkipOpp', { name }));
    toast(text);
  }
}

function onError(code, message) {
  pending = false;
  toast(errorText(code, message));
  render();
}

function send(msg, quiet = false) {
  if (local) local.send(msg);
  else if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else if (!quiet) toast(t('notConnected'));
}

function startGame() {
  show('game');
  setStatus(t('connecting'));
  connect();
}

function startSolo() {
  show('game');
  const name = store.get('bn:name') || (lang === 'it' ? 'Tu' : 'You');
  const kind = cleanKind(params.get('kind'));
  const turnSeconds = cleanTurnSeconds(params.get('ts'));
  const fresh = params.get('new') === '1';
  // Senza "new" un ricaricamento della pagina riprende la partita salvata.
  if (fresh) history.replaceState(null, '', `/?solo=1&kind=${kind}&ts=${turnSeconds}`);
  const opts = { name, onState, onError, onInfo, turnSeconds, fresh };
  local = BoardUI.isBoardKind(kind) ? new LocalMatch({ kind, ...opts }) : new LocalGame(opts);
  local.emit();
}

// ---------- Stato ----------
function describe(s) {
  if (s.result === 'miss') return t('miss');
  if (s.result === 'hit') return t('hit');
  return t('sunk', { ship: shipName(s.len).toLowerCase() });
}

function onState(next) {
  const prev = state;
  state = next;
  pending = false;
  if (next.phase !== 'waiting' && next.phase !== 'placing') draft = [];
  if (isBoard(next)) {
    if (!next.myTurn || prev?.kind !== next.kind) picker.reset();
    const m = next.lastMove;
    if (prev && !prev.myTurn && next.myTurn && m && !m.byMe && !next.solo) toast(t('movedToast', { name: next.opponent.name, move: m.text }));
  } else {
    if (prev && !prev.myTurn && next.myTurn) {
      const s = next.lastShot;
      if (s && !s.byMe) toast(t('shotAt', { name: next.opponent.name, cell: cellName(s.x, s.y), result: describe(s) }));
    }
    const key = (v) => (v?.lastShot ? `${v.lastShot.by}:${v.lastShot.x}:${v.lastShot.y}` : '');
    if (next.lastShot?.byMe && key(next) !== key(prev)) {
      toast(t('yourShot', { cell: cellName(next.lastShot.x, next.lastShot.y), result: describe(next.lastShot) }));
    }
  }
  updateTitle();
  Stealth.setTurn(next.myTurn);
  if (prev && !prev.myTurn && next.myTurn && document.visibilityState !== 'visible') localNotify(turnText(next));
  markSeen();
  render();
  if (!prev) setTimeout(() => startTour(), 500);
}

/** Dice al server che il giocatore sta guardando la partita nel suo turno (niente promemoria). */
function markSeen() {
  if (!local && state?.myTurn && document.visibilityState === 'visible') send({ type: 'seen' }, true);
}
document.addEventListener('visibilitychange', markSeen);

function updateTitle() {
  if (!state) return;
  const warned = state.myTurn && warnedFor === state.turnStartedAt;
  Stealth.setTitle(warned ? '(!) P2P' : state.myTurn ? '(1) P2P' : 'P2P');
}

/** Testo della notifica "tocca a te". */
function turnText(s) {
  if (isBoard(s)) return s.lastMove ? t('movedToast', { name: s.opponent.name, move: s.lastMove.text }) : t('started');
  return s.lastShot ? t('shotAt', { name: s.opponent.name, cell: cellName(s.lastShot.x, s.lastShot.y), result: describe(s.lastShot) }) : t('started');
}

/** Notifica dalla pagina aperta in background (se il push non è attivo su questo browser). */
function localNotify(body) {
  if (local || Stealth.isActive() || pushEndpoint || !('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification('P2P', { body, tag: 'turn-' + state.id, icon: '/icon.png' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch {}
}

// ---------- Tempo per turno ----------
function remainingMs() {
  if (!state || !state.turnSeconds || state.phase !== 'playing' || !state.turnStartedAt) return null;
  return state.turnStartedAt + state.turnSeconds * 1000 - (Date.now() + (local ? 0 : clockOffset));
}

const fmtClock = (ms) => {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

function tick() {
  const el = $('clock');
  const ms = remainingMs();
  el.hidden = ms === null;
  if (ms === null) { Stealth.setClock(''); return; }
  const low = ms <= warnBeforeMs(state.turnSeconds);
  el.textContent = '⏱ ' + fmtClock(ms);
  el.classList.toggle('mine', !!state.myTurn);
  el.classList.toggle('low', low && !!state.myTurn);
  Stealth.setClock(fmtClock(ms));
  if (low && state.myTurn && ms > 0 && warnedFor !== state.turnStartedAt) {
    warnedFor = state.turnStartedAt;
    const text = t('timeWarn', { s: Math.ceil(ms / 1000) });
    toast(text);
    updateTitle();
    if (document.visibilityState !== 'visible') localNotify(text);
  }
}
setInterval(tick, 250);

function setStatus(text, turn = false) {
  const el = $('status');
  el.textContent = text;
  el.classList.toggle('turn', turn);
  Stealth.refresh();
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
      c.setAttribute('aria-label', cellName(x, y));
      c.addEventListener('click', () => onCell(x, y));
      if (el.id === 'board-me') c.addEventListener('mouseenter', () => { hover = { x, y }; render(); });
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
  return !!state && !isBoard(state) && (state.phase === 'waiting' || state.phase === 'placing') && !state.me.ready;
}

/** Segni da disegnare sulle due griglie: usati sia dalla pagina sia dal foglio "Note". */
function marks({ withHover = true } = {}) {
  const me = state.me;
  const opp = state.opponent;
  const mine = [];
  const ships = me.ready ? me.ships : draft;
  for (const s of ships) for (const c of shipCells(s)) mine.push([c.x, c.y, 'ship']);
  if (withHover && placing() && hover && nextLen()) {
    const ship = { x: hover.x, y: hover.y, len: nextLen(), dir };
    const ok = fits(draft, ship);
    for (const c of shipCells(ship)) if (c.x < SIZE && c.y < SIZE) mine.push([c.x, c.y, ok ? 'preview' : 'preview bad']);
  }
  for (const s of me.incoming) mine.push([s.x, s.y, s.hit ? 'hit shot' : 'miss shot']);
  if (state.lastShot && !state.lastShot.byMe) mine.push([state.lastShot.x, state.lastShot.y, 'last']);

  const theirs = [];
  if (opp) {
    if (opp.ships) for (const s of opp.ships) for (const c of shipCells(s)) theirs.push([c.x, c.y, 'ship']);
    for (const s of opp.shots) theirs.push([s.x, s.y, s.hit ? 'hit shot' : 'miss shot']);
    for (const s of opp.sunk) for (const c of shipCells(s)) theirs.push([c.x, c.y, 'sunk']);
    if (state.lastShot?.byMe) theirs.push([state.lastShot.x, state.lastShot.y, 'last']);
  }
  return { mine, theirs };
}

function resultText() {
  const name = state.opponent ? state.opponent.name : t('opponent');
  const reason = t('res_' + state.result);
  if (state.winner === 'me') return t('wonBy', { reason });
  if (state.winner === 'opponent') return t('lostBy', { name, reason });
  return t('drawBy', { reason });
}

function statusText() {
  const me = state.me;
  const opp = state.opponent;
  const name = opp ? opp.name : t('opponent');
  if (isBoard(state)) {
    if (state.phase === 'waiting') return t('waitingOpponent');
    if (state.phase === 'playing') return state.myTurn ? (state.check ? t('yourMoveCheck') : t('yourMove')) : t('theirMove', { name });
    return resultText();
  }
  if (state.phase === 'waiting') return placing() ? t('waitingPlacing') : t('waitingReady');
  if (state.phase === 'placing') return me.ready ? t('placingReady', { name }) : opp.ready && !state.solo ? t('placingYouOppReady', { name }) : t('placingYou');
  if (state.phase === 'playing') return state.myTurn ? t('yourTurn') : t('theirTurn', { name });
  return state.winner === 'me' ? t('youWon') : t('theyWon', { name });
}

function renderSquares() {
  const el = $('board-sq');
  const flip = BoardUI.flipped(state);
  if (el.dataset.flip !== (flip ? '1' : '0') || el.dataset.kind !== state.kind) {
    BoardUI.build(el, flip, onSquare);
    el.dataset.kind = state.kind;
  }
  BoardUI.paint(el, state, picker);
  el.classList.toggle('clickable', !!state.myTurn && !pending);
  const opp = state.opponent;
  const mine = t(state.color === 'w' ? 'white' : 'black');
  const theirs = t(state.color === 'w' ? 'black' : 'white');
  $('sq-opp').textContent = `${opp ? opp.name : t('opponent')} (${theirs})`;
  $('sq-me').textContent = `${state.me.name} (${mine})`;
  $('sq-opp-online').classList.toggle('on', !!state.opponentOnline);
  $('sq-opp-online').title = state.opponentOnline ? t('online') : t('offline');
  $('sq-opp-online').hidden = !!state.solo;
  const m = state.lastMove;
  $('sq-last').textContent = !m ? t('noMovesYet') : m.byMe ? t('lastMoveMine', { move: m.text }) : t('lastMoveTheirs', { name: opp?.name, move: m.text });
  const limit = state.turnSeconds ? (state.turnSeconds < 60 ? state.turnSeconds + ' s' : state.turnSeconds / 60 + ' min') : t('noLimit');
  $('sq-info').textContent = `${t('moveNo', { n: state.moveCount })} · ${t('perTurn', { t: limit })}`;
}

function render() {
  if (!state) return;
  const board = isBoard(state);
  document.querySelector('.boards').hidden = board;
  $('sq-area').hidden = !board;
  if (board) {
    $('placement').hidden = true;
    $('share').hidden = state.phase !== 'waiting';
    $('share-link').value = location.origin + '/?g=' + state.id;
    $('notify').hidden = !!state.solo;
    renderSquares();
    setStatus(statusText(), state.myTurn);
    if (!state.solo) renderNotify();
    $('finished').hidden = state.phase !== 'finished';
    $('btn-rematch').hidden = !state.solo;
    $('finished-text').textContent = resultText();
    tick();
    return;
  }
  const me = state.me;
  const opp = state.opponent;
  $('my-name').textContent = '(' + me.name + ')';
  $('opp-title').textContent = t('fleetOf', { name: opp ? opp.name : t('opponent') });
  $('opp-online').classList.toggle('on', !!state.opponentOnline);
  $('opp-online').title = state.opponentOnline ? t('online') : t('offline');
  $('opp-online').hidden = !!state.solo;
  $('notify').hidden = !!state.solo;

  $('share').hidden = state.phase !== 'waiting';
  $('share-link').value = location.origin + '/?g=' + state.id;

  const isPlacing = placing();
  $('placement').hidden = !isPlacing;
  if (isPlacing) {
    const len = nextLen();
    $('placement-hint').textContent = len
      ? t('placeHint', { ship: shipName(len), len, dir: dir === 'h' ? t('horizontal') : t('vertical') })
      : t('fleetComplete');
    $('btn-ready').disabled = validateFleet(draft) !== null;
  }

  const { mine, theirs } = marks();
  paint($('board-me'), mine);
  paint($('board-opp'), theirs);
  $('board-opp').classList.toggle('clickable', state.myTurn && !pending);
  document.querySelector('.boards').classList.toggle('playing', state.phase === 'playing');
  document.querySelector('.boards').classList.toggle('setup', state.phase === 'waiting' || state.phase === 'placing');
  $('board-opp').classList.toggle('dim', state.phase === 'playing' && !state.myTurn);

  setStatus(statusText(), state.myTurn);
  if (!state.solo) renderNotify();

  $('finished').hidden = state.phase !== 'finished';
  $('btn-rematch').hidden = !state.solo;
  $('finished-text').textContent = state.winner === 'me' ? t('youWonLong') : t('youLostLong', { name: opp?.name });
  tick();
}

function onSquare(i) {
  if (!isBoard(state) || pending) return;
  const r = picker.click(state, i);
  if (r.send) {
    pending = true;
    send(r.send);
  } else if (r.hint) toast(t(r.hint));
  render();
}

// ---------- Interazioni ----------
function onMyCell(x, y) {
  if (!placing()) return;
  const existing = draft.findIndex((s) => shipCells(s).some((c) => c.x === x && c.y === y));
  if (existing !== -1) { draft.splice(existing, 1); render(); return; }
  const len = nextLen();
  if (!len) return;
  const ship = { x, y, len, dir };
  if (!fits(draft, ship)) { toast(t('noFit')); return; }
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

/** Lascia la sessione in corso: in P2P avvisa l'avversario. */
function leaveSession() {
  if (!local && ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify({ type: 'leave' })); } catch {}
  }
  if (ws) { ws.onclose = null; try { ws.close(); } catch {} ws = null; }
  draft = [];
  picker.reset();
}

const actions = {
  rotate() { dir = dir === 'h' ? 'v' : 'h'; render(); },
  random() { draft = randomFleet(); render(); },
  clear() { draft = []; render(); },
  ready() { if (validateFleet(draft) === null) send({ type: 'place', ships: draft }); },
  rematch() { picker.reset(); if (local) { draft = []; local.restart(); } else navigate('/'); },
  // "Ricomincia": si torna alla scelta iniziale del gioco
  restart() {
    leaveSession();
    navigate('/');
  },
};

$('btn-rotate').addEventListener('click', actions.rotate);
$('btn-random').addEventListener('click', actions.random);
$('btn-clear').addEventListener('click', actions.clear);
$('btn-ready').addEventListener('click', actions.ready);
$('btn-rematch').addEventListener('click', actions.rematch);

// "Ricomincia" con doppia conferma: il primo clic chiede "Sei sicuro?", il secondo (entro 4 s) conferma.
{
  const btn = $('btn-restart');
  let timer = null;
  const reset = () => { clearTimeout(timer); timer = null; btn.textContent = t('restart'); btn.classList.remove('confirm'); };
  btn.addEventListener('click', () => {
    btn.blur();
    if (timer) { reset(); actions.restart(); return; }
    btn.textContent = t('sure');
    btn.classList.add('confirm');
    timer = setTimeout(reset, 4000);
  });
}
$('btn-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('share-link').value); toast(t('linkCopied')); }
  catch { $('share-link').select(); }
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'r' || e.key === 'R') && placing() && !Stealth.isActive() && document.activeElement?.tagName !== 'INPUT') actions.rotate();
});

// ---------- Notifiche ----------
const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function renderNotify() {
  const st = state.settings || { email: '', pushEndpoints: [] };
  const pushOn = !!pushEndpoint && st.pushEndpoints.includes(pushEndpoint);
  const localOn = 'Notification' in window && Notification.permission === 'granted';
  const btn = $('btn-push');
  if (!('Notification' in window)) { btn.hidden = true; $('push-status').textContent = t('notifUnsupported'); }
  else if (Notification.permission === 'denied') { btn.hidden = true; $('push-status').textContent = t('notifBlocked'); }
  else if (pushOn || (localOn && !vapidKey)) { btn.hidden = true; $('push-status').textContent = pushOn ? t('notifOnPush') : t('notifOnLocal'); }
  else { btn.hidden = false; $('push-status').textContent = ''; }
  if (document.activeElement !== $('email-settings')) $('email-settings').value = st.email;
  const parts = [];
  if (pushOn || localOn) parts.push('browser');
  if (st.email) parts.push('email');
  $('notify-summary').textContent = '· ' + (parts.length ? parts.join(' + ') : t('notifOff'));
}

function keyBytes(b64) {
  const s = atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function initPush() {
  try { vapidKey = (await (await fetch('/api/config')).json()).vapidPublicKey; } catch {}
  if (!pushSupported || !vapidKey) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      pushEndpoint = sub.endpoint;
      // Ricollega questo browser alla sessione corrente (permesso già concesso in passato).
      const sendSub = () => send({ type: 'push-subscribe', subscription: sub.toJSON() }, true);
      if (ws?.readyState === WebSocket.OPEN) sendSub(); else addEventListener('bn:connected', sendSub, { once: true });
    }
  } catch {}
  if (state) render();
}

$('btn-push').addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { render(); return; }
  if (pushSupported && vapidKey) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
      pushEndpoint = sub.endpoint;
      send({ type: 'push-subscribe', subscription: sub.toJSON() });
    } catch {
      toast(t('pushFailed'));
    }
  }
  render();
});

$('form-email').addEventListener('submit', (e) => {
  e.preventDefault();
  const email = $('email-settings').value.trim();
  store.set('bn:email', email);
  send({ type: 'settings', email });
  $('email-settings').blur();
  toast(email ? t('emailSaved') : t('emailOff'));
});

// ---------- Tema, lingua, miniatura, modalità discreta ----------
const themeSelect = $('theme');
themeSelect.value = document.documentElement.dataset.theme || 'excel';
themeSelect.addEventListener('change', () => {
  document.documentElement.dataset.theme = themeSelect.value;
  store.set('bn:theme', themeSelect.value);
  themeSelect.blur();
});

const langSelect = $('lang');
langSelect.value = lang;
langSelect.addEventListener('change', () => {
  setLang(langSelect.value);
  langSelect.blur();
  if (!local) send({ type: 'settings', lang }, true);
  Stealth.rebuild();
  render();
});

function setMini(on) {
  document.documentElement.classList.toggle('mini', on);
  $('btn-mini').checked = on;
  store.set('bn:mini', on ? '1' : '0');
}
setMini(document.documentElement.classList.contains('mini'));
$('btn-mini').addEventListener('change', (e) => setMini(e.target.checked));

$('btn-stealth').addEventListener('click', (e) => { e.currentTarget.blur(); Stealth.toggle(true); });
$('fp-tour').addEventListener('click', () => {
  Shell.closeFile();
  if (Stealth.isActive()) Stealth.toggle(false);
  setTimeout(() => startTour(true), 50);
});
$('fp-stealth').addEventListener('click', (e) => { e.currentTarget.blur(); Stealth.toggle(); });
Shell.init();

Stealth.bind({
  getState: () => state,
  isPlacing: placing,
  marks: () => marks({ withHover: false }),
  status: () => $('status').textContent,
  canFire: () => !!state?.myTurn && !pending,
  onMyCell,
  onOppCell,
  onSquare,
  picker,
  actions,
  dir: () => dir,
});

// ---------- Avvio ----------
setLang(lang);
buildBoard($('board-me'), onMyCell);
buildBoard($('board-opp'), onOppCell);
if (solo) startSolo();
else if (!gameId) show('home');
else if (!token) show('join');
else startGame();
if (!solo) initPush();
if (document.documentElement.classList.contains('stealth-boot')) Stealth.toggle(true);
