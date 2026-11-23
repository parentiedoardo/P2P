import { DurableObject } from 'cloudflare:workers';
import * as E from '../public/engine.js';
import { sendPush } from './webpush.js';
import { boardImage, reminderContent, sendEmail, describeShot } from './notify.js';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomId(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export function cleanEmail(email) {
  const e = String(email ?? '').trim().slice(0, 254);
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e) ? e : null;
}

async function readProfile(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  return { name: E.cleanName(body?.name), email: cleanEmail(body?.email) };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (url.pathname === '/api/config') {
      return json({ vapidPublicKey: env.VAPID_PUBLIC_KEY || null });
    }

    // POST /api/games -> nuova partita
    if (url.pathname === '/api/games' && request.method === 'POST') {
      const gameId = randomId(10);
      const stub = env.GAME.get(env.GAME.idFromName(gameId));
      const res = await stub.create(gameId, await readProfile(request), url.origin);
      return json({ gameId, ...res });
    }

    const m = url.pathname.match(/^\/api\/games\/([a-z0-9]{10})\/(join|ws|board\.png)$/);
    if (!m) return json({ error: 'Non trovato' }, 404);
    const [, gameId, action] = m;
    const stub = env.GAME.get(env.GAME.idFromName(gameId));

    if (action === 'join' && request.method === 'POST') {
      const res = await stub.join(await readProfile(request));
      return json(res, res.error ? 400 : 200);
    }
    if (action === 'ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Serve una WebSocket' }, 426);
      return stub.fetch(request);
    }
    if (action === 'board.png') {
      const png = await stub.image(url.searchParams.get('k') || '');
      if (!png) return json({ error: 'Non trovato' }, 404);
      return new Response(png, { headers: { 'content-type': 'image/png', 'cache-control': 'no-store, max-age=0' } });
    }
    return json({ error: 'Metodo non consentito' }, 405);
  },
};

/** Una stanza per partita: conserva lo stato, inoltra gli aggiornamenti e manda i promemoria. */
export class GameRoom extends DurableObject {
  get reminderMs() {
    return Number(this.env.REMINDER_MINUTES ?? 5) * 60_000;
  }

  async load() {
    if (!this.game) this.game = (await this.ctx.storage.get('game')) || null;
    return this.game;
  }

  async save() {
    await this.ctx.storage.put('game', this.game);
  }

  newPlayer(profile) {
    const token = randomId(24);
    const idx = E.addPlayer(this.game, { token, name: profile.name });
    Object.assign(this.game.players[idx], { email: profile.email, imageKey: randomId(24), push: [], seenAt: 0 });
    return token;
  }

  async create(gameId, profile, origin) {
    if (await this.load()) return { error: 'Partita già esistente' };
    this.game = E.createGame(gameId);
    this.game.origin = origin;
    this.game.remindedFor = null;
    const token = this.newPlayer(profile);
    await this.save();
    return { token };
  }

  async join(profile) {
    if (!(await this.load())) return { error: 'Questa partita non esiste.' };
    try {
      const token = this.newPlayer(profile);
      await this.save();
      this.broadcast();
      return { token };
    } catch (e) {
      if (e instanceof E.GameError) return { error: e.message };
      throw e;
    }
  }

  async image(key) {
    await this.load();
    const idx = this.game ? this.game.players.findIndex((p) => key && p.imageKey === key) : -1;
    if (idx === -1) return null;
    return boardImage(E.viewFor(this.game, idx));
  }

  async fetch(request) {
    const token = new URL(request.url).searchParams.get('token') || '';
    await this.load();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const idx = this.game ? this.game.players.findIndex((p) => p.token === token) : -1;
    if (idx === -1) {
      // Accettiamo e chiudiamo subito con un codice riconoscibile dal browser.
      server.accept();
      server.close(4403, this.game ? 'Non fai parte di questa partita' : 'Partita inesistente');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.acceptWebSocket(server, [String(idx)]);
    this.broadcast();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    await this.load();
    const idx = Number(this.ctx.getTags(ws)[0]);
    const player = this.game.players[idx];
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    try {
      switch (msg.type) {
        case 'place': {
          E.placeShips(this.game, idx, msg.ships);
          break;
        }
        case 'fire': {
          E.fire(this.game, idx, msg.x, msg.y);
          break;
        }
        case 'seen': {
          // Il giocatore ha la scheda aperta e visibile: niente promemoria per questo turno.
          player.seenAt = Date.now();
          await this.save();
          return;
        }
        case 'settings': {
          if ('email' in msg) player.email = cleanEmail(msg.email);
          await this.save();
          this.broadcast();
          return;
        }
        case 'push-subscribe': {
          const sub = msg.subscription;
          if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return;
          player.push = [...player.push.filter((s) => s.endpoint !== sub.endpoint), { endpoint: sub.endpoint, keys: sub.keys }].slice(-5);
          await this.save();
          this.broadcast();
          return;
        }
        case 'push-unsubscribe': {
          player.push = player.push.filter((s) => s.endpoint !== msg.endpoint);
          await this.save();
          this.broadcast();
          return;
        }
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        default:
          return;
      }
      await this.save();
      this.broadcast();
      await this.onTurnChanged();
    } catch (e) {
      if (!(e instanceof E.GameError)) throw e;
      ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 || code === 1006 ? 1000 : code); } catch {}
    await this.load();
    this.broadcast(ws);
  }

  /** Invia a ogni giocatore connesso la sua vista della partita. */
  broadcast(closing) {
    if (!this.game) return;
    const sockets = this.ctx.getWebSockets().filter((s) => s !== closing);
    const online = [0, 1].map((i) => sockets.some((s) => this.ctx.getTags(s)[0] === String(i)));
    for (const s of sockets) {
      const idx = Number(this.ctx.getTags(s)[0]);
      const p = this.game.players[idx];
      const state = E.viewFor(this.game, idx);
      state.opponentOnline = online[1 - idx];
      state.settings = { email: p.email || '', pushEndpoints: p.push.map((x) => x.endpoint) };
      try { s.send(JSON.stringify({ type: 'state', state })); } catch {}
    }
  }

  link(idx) {
    const p = this.game.players[idx];
    return `${this.game.origin}/?g=${this.game.id}&t=${p.token}`;
  }

  /** Dopo ogni mossa: notifica push immediata e sveglia per il promemoria. */
  async onTurnChanged() {
    const g = this.game;
    if (g.phase === 'playing') {
      await this.ctx.storage.setAlarm(g.turnStartedAt + this.reminderMs);
      await this.push(g.turn, {
        title: 'Tocca a te! ⚓',
        body: g.lastShot ? `${g.players[1 - g.turn].name} ha sparato in ${describeShot(g.lastShot)}.` : `La partita contro ${g.players[1 - g.turn].name} è iniziata.`,
      });
    } else {
      await this.ctx.storage.deleteAlarm();
      if (g.phase === 'finished') {
        const loser = 1 - g.winner;
        await this.push(loser, { title: 'Partita finita', body: `Ha vinto ${g.players[g.winner].name}.` });
      }
    }
  }

  async push(idx, { title, body }) {
    const p = this.game.players[idx];
    if (!p.push.length || !this.env.VAPID_PUBLIC_KEY || !this.env.VAPID_PRIVATE_KEY) return;
    const vapid = {
      publicKey: this.env.VAPID_PUBLIC_KEY,
      privateKey: this.env.VAPID_PRIVATE_KEY,
      subject: this.env.VAPID_SUBJECT || this.game.origin,
    };
    const data = { title, body, url: `/?g=${this.game.id}`, tag: 'turn-' + this.game.id };
    const results = await Promise.all(p.push.map((s) => sendPush(s, data, vapid)));
    const alive = p.push.filter((_, i) => results[i] !== 'gone');
    if (alive.length !== p.push.length) {
      p.push = alive;
      await this.save();
    }
  }

  /** Scatta 5 minuti dopo l'inizio di un turno. */
  async alarm() {
    await this.load();
    const g = this.game;
    if (!g || g.phase !== 'playing') return;
    const due = g.turnStartedAt + this.reminderMs;
    if (Date.now() < due) {
      await this.ctx.storage.setAlarm(due);
      return;
    }
    const idx = g.turn;
    const p = g.players[idx];
    if (g.remindedFor === g.turnStartedAt) return; // già mandato per questo turno
    if (p.seenAt >= g.turnStartedAt) return; // l'ha già visto
    g.remindedFor = g.turnStartedAt;
    await this.save();
    await this.sendReminder(idx);
  }

  async sendReminder(idx) {
    const g = this.game;
    const p = g.players[idx];
    const opp = g.players[1 - idx];
    // Il parametro v cambia a ogni mossa, così i client email non mostrano un'immagine vecchia.
    const imageUrl = `${g.origin}/api/games/${g.id}/board.png?k=${p.imageKey}&v=${p.shots.length + opp.shots.length}`;
    const content = reminderContent({
      playerName: p.name,
      opponentName: opp.name,
      lastShot: g.lastShot && g.lastShot.by !== idx ? g.lastShot : null,
      link: this.link(idx),
      imageUrl,
    });
    if (p.email) await sendEmail(this.env, { to: p.email, ...content });
    await this.push(idx, { title: 'Ti stanno aspettando! ⚓', body: `${opp.name} aspetta la tua mossa da 5 minuti.` });
  }
}
