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

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LETTERS = 'ABCDEFGHIJ';

export function describeShot(s) {
  if (!s) return '';
  const where = `${LETTERS[s.x]}${s.y + 1}`;
  if (s.result === 'miss') return `${where}: acqua`;
  if (s.result === 'hit') return `${where}: colpito`;
  return `${where}: colpito e affondato`;
}

/** Contenuto del promemoria "tocca a te". */
export function reminderContent({ playerName, opponentName, lastShot, link, imageUrl }) {
  const subject = `Tocca a te contro ${opponentName} · Battaglia navale`;
  const shot = lastShot ? `Ultimo colpo di ${opponentName}: ${describeShot(lastShot)}.` : '';
  const text = `Ciao ${playerName}, è il tuo turno nella partita contro ${opponentName}. ${shot}\n\nTorna alla partita: ${link}`;
  const html = `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Segoe UI,Arial,sans-serif;color:#13233a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #d5dde8;border-radius:12px">
<tr><td style="padding:20px 24px 8px;font-size:20px;font-weight:700">⚓ Tocca a te, ${esc(playerName)}!</td></tr>
<tr><td style="padding:0 24px 12px;font-size:15px;line-height:1.5">${esc(opponentName)} aspetta la tua mossa. ${esc(shot)}</td></tr>
<tr><td style="padding:0 24px"><img src="${esc(imageUrl)}" width="552" alt="Situazione della partita" style="display:block;width:100%;height:auto;border:0"></td></tr>
<tr><td style="padding:4px 24px 0;font-size:12px;color:#5b6b80"><table role="presentation" width="100%"><tr><td width="50%">La tua flotta</td><td>Flotta di ${esc(opponentName)}</td></tr></table></td></tr>
<tr><td align="center" style="padding:20px 24px 24px"><a href="${esc(link)}" style="background:#1f6feb;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;display:inline-block">Torna alla partita</a></td></tr>
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
    body: JSON.stringify({ from: env.EMAIL_FROM || 'Battaglia navale <onboarding@resend.dev>', to: [to], subject, html, text }),
  });
  if (!res.ok) {
    console.log('email fallita', res.status, await res.text().catch(() => ''));
    return 'error';
  }
  return 'ok';
}
