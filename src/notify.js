// Promemoria: immagine del campo, email e (in seguito) altri canali.
import { SIZE, shipCells } from '../public/engine.js';
import { Canvas } from './png.js';

const C = {
  bg: [255, 255, 255],
  sea: [220, 235, 250],
  ship: [91, 107, 128],
  miss: [138, 164, 194],
  hit: [229, 83, 75],
  sunk: [139, 30, 26],
  white: [255, 255, 255],
  last: [19, 35, 58],
};

const CELL = 26;
const GAP = 2;
const PAD = 12;
const BOARD = SIZE * (CELL + GAP) - GAP;
const SPACE = 28;

function drawBoard(cv, ox, oy, { ships = [], shots = [], sunk = [], last }) {
  const at = (x, y) => [ox + x * (CELL + GAP), oy + y * (CELL + GAP)];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) { const [px, py] = at(x, y); cv.rect(px, py, CELL, CELL, C.sea); }
  for (const s of ships) for (const c of shipCells(s)) { const [px, py] = at(c.x, c.y); cv.rect(px, py, CELL, CELL, C.ship); }
  for (const s of shots) {
    const [px, py] = at(s.x, s.y);
    if (s.hit) { cv.rect(px, py, CELL, CELL, C.hit); cv.cross(px + 7, py + 7, CELL - 14, 3, C.white); }
    else cv.circle(px + CELL / 2, py + CELL / 2, 4, C.miss);
  }
  for (const s of sunk) for (const c of shipCells(s)) { const [px, py] = at(c.x, c.y); cv.rect(px, py, CELL, CELL, C.sunk); cv.cross(px + 7, py + 7, CELL - 14, 3, C.white); }
  if (last) { const [px, py] = at(last.x, last.y); cv.outline(px, py, CELL, CELL, 2, C.last); }
}

export const IMAGE_SIZE = { width: PAD * 2 + BOARD * 2 + SPACE, height: PAD * 2 + BOARD };

/** PNG con la vista di un giocatore: a sinistra la sua flotta, a destra quella avversaria. */
export function boardImage(view) {
  const cv = new Canvas(IMAGE_SIZE.width, IMAGE_SIZE.height, C.bg);
  const last = view.lastShot;
  drawBoard(cv, PAD, PAD, { ships: view.me.ships, shots: view.me.incoming, last: last && !last.byMe ? last : null });
  if (view.opponent) {
    drawBoard(cv, PAD + BOARD + SPACE, PAD, {
      ships: view.opponent.ships || [],
      shots: view.opponent.shots,
      sunk: view.opponent.sunk,
      last: last && last.byMe ? last : null,
    });
  }
  return cv.png();
}

// ---------- Scacchiera 8x8 (scacchi e dama) ----------
// Sagome dei pezzi degli scacchi in 10x10 pixel.
const GLYPH = {
  P: ['..........', '....##....', '...####...', '...####...', '....##....', '...####...', '....##....', '...####...', '..######..', '..######..'],
  R: ['..........', '..#.##.#..', '..######..', '...####...', '...####...', '...####...', '...####...', '..######..', '.########.', '.########.'],
  N: ['..........', '....##....', '...####...', '..######..', '.###.###..', '.....###..', '....####..', '...#####..', '..######..', '..######..'],
  B: ['....##....', '...#..#...', '...##.#...', '...####...', '....##....', '...####...', '....##....', '...####...', '..######..', '..######..'],
  Q: ['.#..##..#.', '.#..##..#.', '.##.##.##.', '.########.', '..######..', '...####...', '...####...', '..######..', '.########.', '.########.'],
  K: ['....##....', '...####...', '....##....', '.##.##.##.', '##########', '##########', '.########.', '..######..', '..######..', '.########.'],
};
const SQ = 40;
const D = { light: [240, 236, 226], dark: [118, 140, 105], w: [250, 250, 250], wEdge: [70, 70, 70], b: [40, 40, 40], bEdge: [10, 10, 10], last: [230, 190, 60], king: [214, 170, 40] };
export const SQUARES_IMAGE_SIZE = { width: PAD * 2 + SQ * 8, height: PAD * 2 + SQ * 8 };

function drawGlyph(cv, x, y, type, white) {
  const g = GLYPH[type];
  const s = 3;
  const ox = x + (SQ - 10 * s) / 2;
  const oy = y + (SQ - 10 * s) / 2;
  const edge = white ? D.wEdge : [235, 235, 235];
  const fill = white ? D.w : D.b;
  for (const pass of [0, 1]) {
    g.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch !== '#') return;
      if (pass === 0) cv.rect(ox + i * s - 1, oy + j * s - 1, s + 2, s + 2, edge);
      else cv.rect(ox + i * s, oy + j * s, s, s, fill);
    }));
  }
}

/** PNG della scacchiera (o damiera) vista dal lato del giocatore. */
export function squaresImage(view) {
  const cv = new Canvas(SQUARES_IMAGE_SIZE.width, SQUARES_IMAGE_SIZE.height, C.bg);
  const flip = view.color === 'b';
  const pos = (i) => {
    const f = i % 8, r = Math.floor(i / 8);
    const col = flip ? 7 - f : f, row = flip ? r : 7 - r;
    return [PAD + col * SQ, PAD + row * SQ];
  };
  const marked = new Set(view.lastMove ? [view.lastMove.from, view.lastMove.to] : []);
  for (let i = 0; i < 64; i++) {
    const [x, y] = pos(i);
    const dark = ((i % 8) + Math.floor(i / 8)) % 2 === (view.kind === 'dama' ? 1 : 0);
    cv.rect(x, y, SQ, SQ, marked.has(i) ? D.last : dark ? D.dark : D.light);
    if (view.check && view.board[i] === view.turn + 'K') cv.outline(x, y, SQ, SQ, 3, [200, 40, 40]);
    const p = view.board[i];
    if (!p) continue;
    if (view.kind === 'scacchi') { drawGlyph(cv, x, y, p[1], p[0] === 'w'); continue; }
    const white = p.toLowerCase() === 'w';
    cv.circle(x + SQ / 2, y + SQ / 2, SQ / 2 - 4, white ? D.wEdge : D.bEdge);
    cv.circle(x + SQ / 2, y + SQ / 2, SQ / 2 - 6, white ? D.w : D.b);
    if (p === 'W' || p === 'B') cv.circle(x + SQ / 2, y + SQ / 2, 6, D.king);
  }
  return cv.png();
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LETTERS = 'ABCDEFGHIJ';

const TEXT = {
  it: {
    miss: 'acqua', hit: 'colpito', sunk: 'colpito e affondato',
    subject: (o) => `Tocca a te · ${o} · P2P`,
    last: (o, d) => `Ultimo colpo di ${o}: ${d}.`,
    text: (p, o, shot, link) => `Ciao ${p}, è il tuo turno nella sessione con ${o}. ${shot}\n\nTorna alla sessione: ${link}`,
    heading: (p) => `Tocca a te, ${p}`,
    waiting: (o) => `${o} aspetta la tua mossa.`,
    alt: 'Situazione della sessione', yours: 'La tua flotta', theirs: (o) => `Flotta di ${o}`, button: 'Torna alla sessione',
    pushTurn: 'Tocca a te', pushShot: (o, d) => `${o} ha sparato in ${d}.`, pushStart: (o) => `La sessione con ${o} è iniziata.`,
    pushWait: 'Ti stanno aspettando', pushWaitBody: (o) => `${o} aspetta la tua mossa da 5 minuti.`,
    pushEnd: 'Sessione finita', pushEndBody: (o) => `Ha vinto ${o}.`, pushDrawBody: 'Finita in parità.',
    lastMove: (o, m) => `Ultima mossa di ${o}: ${m}.`, pushMove: (o, m) => `${o} ha mosso: ${m}.`,
    subjectUrgent: (o) => `Tempo quasi scaduto · ${o} · P2P`,
    pushWarn: 'Tempo quasi scaduto', pushWarnBody: (s) => `Hai ancora ${s} secondi per il tuo turno.`,
    pushTimeout: 'Tempo scaduto', pushTimeoutLost: 'Hai perso il turno per tempo: sessione finita.',
    pushTimeoutSkip: 'Il tuo turno è passato all\'avversario.', pushTimeoutOpp: (o) => `${o} ha finito il tempo: tocca a te.`,
    pushTimeoutWin: (o) => `${o} ha finito il tempo: hai vinto.`,
  },
  en: {
    miss: 'miss', hit: 'hit', sunk: 'hit and sunk',
    subject: (o) => `Your turn · ${o} · P2P`,
    last: (o, d) => `${o}'s last shot: ${d}.`,
    text: (p, o, shot, link) => `Hi ${p}, it's your turn in the session with ${o}. ${shot}\n\nBack to the session: ${link}`,
    heading: (p) => `Your turn, ${p}`,
    waiting: (o) => `${o} is waiting for your move.`,
    alt: 'Current board', yours: 'Your fleet', theirs: (o) => `${o}'s fleet`, button: 'Back to the session',
    pushTurn: 'Your turn', pushShot: (o, d) => `${o} fired at ${d}.`, pushStart: (o) => `The session with ${o} has started.`,
    pushWait: 'Someone is waiting', pushWaitBody: (o) => `${o} has been waiting for your move for 5 minutes.`,
    pushEnd: 'Session over', pushEndBody: (o) => `${o} won.`, pushDrawBody: 'It ended in a draw.',
    lastMove: (o, m) => `${o}'s last move: ${m}.`, pushMove: (o, m) => `${o} played ${m}.`,
    subjectUrgent: (o) => `Time almost up · ${o} · P2P`,
    pushWarn: 'Time almost up', pushWarnBody: (s) => `You have ${s} seconds left for your turn.`,
    pushTimeout: 'Time is up', pushTimeoutLost: 'You ran out of time: session over.',
    pushTimeoutSkip: 'Your turn passed to your opponent.', pushTimeoutOpp: (o) => `${o} ran out of time: your turn.`,
    pushTimeoutWin: (o) => `${o} ran out of time: you won.`,
  },
};

export const texts = (lang) => TEXT[lang] || TEXT.it;

export function describeShot(s, lang = 'it') {
  if (!s) return '';
  const T = texts(lang);
  const where = `${LETTERS[s.x]}${s.y + 1}`;
  return `${where}: ${T[s.result] || T.miss}`;
}

/** Contenuto del promemoria "tocca a te". */
export function reminderContent({ playerName, opponentName, lastShot, lastMove, link, imageUrl, captions = true, urgent = false, lang = 'it' }) {
  const T = texts(lang);
  const subject = urgent ? T.subjectUrgent(opponentName) : T.subject(opponentName);
  const shot = lastShot ? T.last(opponentName, describeShot(lastShot, lang)) : lastMove ? T.lastMove(opponentName, lastMove) : '';
  const text = T.text(playerName, opponentName, shot, link);
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Segoe UI,Arial,sans-serif;color:#24292f">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #d0d7de;border-radius:8px">
<tr><td style="padding:20px 24px 8px;font-size:20px;font-weight:700">${esc(T.heading(playerName))}</td></tr>
<tr><td style="padding:0 24px 12px;font-size:15px;line-height:1.5">${esc(T.waiting(opponentName))} ${esc(shot)}</td></tr>
${imageUrl ? `<tr><td style="padding:0 24px"><img src="${esc(imageUrl)}" width="${captions ? 552 : 360}" alt="${esc(T.alt)}" style="display:block;${captions ? 'width:100%;' : 'max-width:100%;margin:0 auto;'}height:auto;border:0"></td></tr>` : ''}
${imageUrl && captions ? `<tr><td style="padding:4px 24px 0;font-size:12px;color:#6a737d"><table role="presentation" width="100%"><tr><td width="50%">${esc(T.yours)}</td><td>${esc(T.theirs(opponentName))}</td></tr></table></td></tr>` : ''}
<tr><td align="center" style="padding:20px 24px 24px"><a href="${esc(link)}" style="background:#1d6f42;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:6px;display:inline-block">${esc(T.button)}</a></td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

/** Invia un'email con Resend. Senza chiave API (sviluppo locale) la scrive solo nel log. */
export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    console.log(`[email simulata] a=${to} oggetto="${subject}"\n${text}`);
    return 'simulated';
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM || 'P2P <onboarding@resend.dev>', to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.log('email fallita', res.status, await res.text().catch(() => ''));
    return 'error';
  }
  return 'ok';
}
