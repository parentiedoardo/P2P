import { DurableObject } from 'cloudflare:workers';
import * as E from '../public/engine.js';
import * as M from '../public/games/match.js';
import { sendPush, b64urlEncode } from './webpush.js';
import { boardImage, squaresImage, reminderContent, sendEmail, describeShot, texts } from './notify.js';
import { pendingEvents, nextAlarm } from './schedule.js';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomId(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/**
 * Chiavi VAPID: dalle variabili d'ambiente se presenti, altrimenti generate una volta
 * e conservate in un Durable Object dedicato (così non serve configurarle a mano).
 */
async function getVapid(env) {
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY };
  }
  return env.GAME.get(env.GAME.idFromName('__config__')).vapidKeys();
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export function cleanEmail(email) {
  const e = String(email ?? '').trim().slice(0, 254);
  return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e) ? e : null;
}

const cleanLang = (l) => (l === 'en' ? 'en' : 'it');

// Battaglia ("navale") e giochi su scacchiera ("scacchi", "dama") condividono la stanza.
const isBoard = (g) => g.kind === 'scacchi' || g.kind === 'dama';
const turnOf = (g) => (isBoard(g) ? M.currentIdx(g) : g.turn);
const viewOf = (g, idx) => (isBoard(g) ? M.viewFor(g, idx) : E.viewFor(g, idx));

async function readProfile(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  return {
    name: E.cleanName(body?.name),
    email: cleanEmail(body?.email),
    lang: cleanLang(body?.lang),
    kind: M.cleanKind(body?.kind),
    turnSeconds: M.cleanTurnSeconds(body?.turnSeconds),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    if (url.pathname === '/api/config') {
      return json({ vapidPublicKey: (await getVapid(env)).publicKey });
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

/** Una stanza per partita: conserva lo stato, inoltra gli aggiornamenti, gestisce tempo e promemoria. */
export class GameRoom extends DurableObject {
  get reminderMs() {
    return Number(this.env.REMINDER_MINUTES ?? 5) * 60_000;
  }

  /** Usato solo dall'oggetto '__config__'. */
  async vapidKeys() {
    let keys = await this.ctx.storage.get('vapid');
    if (!keys) {
      const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      keys = {
        publicKey: b64urlEncode(await crypto.subtle.exportKey('raw', kp.publicKey)),
        privateKey: (await crypto.subtle.exportKey('jwk', kp.privateKey)).d,
      };
      await this.ctx.storage.put('vapid', keys);
    }
    return keys;
  }

  async load() {
    if (!this.game) {
      this.game = (await this.ctx.storage.get('game')) || null;
      if (this.game && !this.game.kind) this.game.kind = 'navale';
    }
    return this.game;
  }

  async save() {
    await this.ctx.storage.put('game', this.game);
  }

  newPlayer(profile) {
    const token = randomId(24);
    const idx = isBoard(this.game) ? M.addPlayer(this.game, { token, name: profile.name }) : E.addPlayer(this.game, { token, name: profile.name });
    Object.assign(this.game.players[idx], { lang: profile.lang, email: profile.email, imageKey: randomId(24), push: [], seenAt: 0 });
    return token;
  }

  async create(gameId, profile, origin) {
    if (await this.load()) return { error: 'Partita già esistente' };
    const opts = { turnSeconds: profile.turnSeconds };
    this.game = profile.kind === 'navale' ? E.createGame(gameId, Date.now(), opts) : M.createMatch(gameId, profile.kind, opts);
    this.game.origin = origin;
    this.game.remindedFor = null;
    this.game.warnedFor = null;
    const token = this.newPlayer(profile);
    await this.save();
    return { token, kind: this.game.kind };
  }

  async join(profile) {
    if (!(await this.load())) return { error: 'Questa partita non esiste.', code: 'not_found' };
    try {
      const token = this.newPlayer(profile);
      await this.save();
      this.broadcast();
      await this.onTurnChanged();
      return { token, kind: this.game.kind };
    } catch (e) {
      if (e instanceof E.GameError) return { error: e.message, code: e.code };
      throw e;
    }
  }

  async image(key) {
    await this.load();
    const idx = this.game ? this.game.players.findIndex((p) => key && p.imageKey === key) : -1;
    if (idx === -1) return null;
    return isBoard(this.game) ? squaresImage(M.viewFor(this.game, idx)) : boardImage(E.viewFor(this.game, idx));
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
    const g = this.game;
    const idx = Number(this.ctx.getTags(ws)[0]);
    const player = g.players[idx];
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    try {
      switch (msg.type) {
        case 'place': {
          if (isBoard(g)) return;
          E.placeShips(g, idx, msg.ships);
          break;
        }
        case 'fire': {
          if (isBoard(g)) return;
          E.fire(g, idx, msg.x, msg.y);
          break;
        }
        case 'move': {
          if (!isBoard(g)) return;
          M.move(g, idx, { from: msg.from, to: msg.to, promo: msg.promo, path: msg.path });
          break;
        }
        case 'restart': {
          if (isBoard(g)) M.reset(g);
          else E.resetGame(g);
          g.remindedFor = null;
          g.warnedFor = null;
          await this.save();
          this.broadcast();
          await this.onTurnChanged();
          this.sendInfo({ code: 'restarted', name: player.name }, (i) => i !== idx);
          return;
        }
        case 'leave': {
          // Il giocatore è tornato alla scelta del gioco: lo diciamo all'altro.
          this.sendInfo({ code: 'left', name: player.name }, (i) => i !== idx);
          return;
        }
        case 'seen': {
          // Il giocatore ha la scheda aperta e visibile: niente promemoria per questo turno.
          player.seenAt = Date.now();
          await this.save();
          return;
        }
        case 'settings': {
          if ('email' in msg) player.email = cleanEmail(msg.email);
          if ('lang' in msg) player.lang = cleanLang(msg.lang);
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
          ws.send(JSON.stringify({ type: 'pong', serverNow: Date.now() }));
          return;
        default:
          return;
      }
      await this.save();
      this.broadcast();
      await this.onTurnChanged();
    } catch (e) {
      if (!(e instanceof E.GameError)) throw e;
      ws.send(JSON.stringify({ type: 'error', code: e.code, message: e.message }));
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
      const state = viewOf(this.game, idx);
      state.opponentOnline = online[1 - idx];
      state.settings = { email: p.email || '', pushEndpoints: p.push.map((x) => x.endpoint) };
      try { s.send(JSON.stringify({ type: 'state', state, serverNow: Date.now() })); } catch {}
    }
  }

  /** Messaggio informativo ai giocatori connessi (filtrati per indice). */
  sendInfo(info, filter = () => true) {
    for (const s of this.ctx.getWebSockets()) {
      const i = Number(this.ctx.getTags(s)[0]);
      if (!filter(i)) continue;
      try { s.send(JSON.stringify({ type: 'info', ...info, byMe: info.by === undefined ? undefined : info.by === i })); } catch {}
    }
  }

  link(idx) {
    const p = this.game.players[idx];
    return `${this.game.origin}/?g=${this.game.id}&t=${p.token}`;
  }

  /** Sveglia per il prossimo evento a tempo del turno (o nessuna). */
  async schedule() {
    const at = nextAlarm(this.game, this.reminderMs);
    if (at) await this.ctx.storage.setAlarm(at);
    else await this.ctx.storage.deleteAlarm();
  }

  /** Dopo ogni mossa: notifica push immediata e sveglia per promemoria e tempo. */
  async onTurnChanged() {
    const g = this.game;
    await this.schedule();
    if (g.phase === 'playing') {
      const t = turnOf(g);
      const T = texts(g.players[t].lang);
      const opp = g.players[1 - t].name;
      let body = T.pushStart(opp);
      if (isBoard(g) && g.lastMove) body = T.pushMove(opp, g.lastMove.text);
      else if (!isBoard(g) && g.lastShot) body = T.pushShot(opp, describeShot(g.lastShot, g.players[t].lang));
      await this.push(t, { title: T.pushTurn, body });
    } else if (g.phase === 'finished') {
      if (g.winner === null || g.winner === undefined) {
        const other = g.lastMove ? 1 - g.lastMove.by : 1;
        const T = texts(g.players[other].lang);
        await this.push(other, { title: T.pushEnd, body: T.pushDrawBody });
      } else {
        const loser = 1 - g.winner;
        const T = texts(g.players[loser].lang);
        await this.push(loser, { title: T.pushEnd, body: T.pushEndBody(g.players[g.winner].name) });
      }
    }
  }

  async push(idx, { title, body }) {
    const p = this.game.players[idx];
    if (!p.push.length) return;
    const vapid = { ...(await getVapid(this.env)), subject: this.env.VAPID_SUBJECT || this.game.origin };
    const data = { title, body, url: `/?g=${this.game.id}`, tag: 'turn-' + this.game.id };
    const results = await Promise.all(p.push.map((s) => sendPush(s, data, vapid)));
    const alive = p.push.filter((_, i) => results[i] !== 'gone');
    if (alive.length !== p.push.length) {
      p.push = alive;
      await this.save();
    }
  }

  /** Eventi a tempo: promemoria dopo 5 minuti, avviso di tempo in scadenza, tempo scaduto. */
  async alarm() {
    await this.load();
    const g = this.game;
    if (!g) return;
    const now = Date.now();
    for (const ev of pendingEvents(g, this.reminderMs)) {
      if (ev.at > now) break;
      const idx = turnOf(g);
      const p = g.players[idx];
      const t0 = g.turnStartedAt;
      if (ev.type === 'reminder') {
        g.remindedFor = t0;
        await this.save();
        if (p.seenAt < t0) await this.sendReminder(idx);
      } else if (ev.type === 'warn') {
        g.warnedFor = t0;
        const urgentEmail = g.remindedFor !== t0 && p.seenAt < t0;
        if (urgentEmail) g.remindedFor = t0;
        await this.save();
        const seconds = Math.max(1, Math.round((t0 + g.turnSeconds * 1000 - now) / 1000));
        const T = texts(p.lang);
        await this.push(idx, { title: T.pushWarn, body: T.pushWarnBody(seconds) });
        if (urgentEmail) await this.sendReminder(idx, { urgent: true, push: false });
      } else if (ev.type === 'timeout') {
        await this.onTimeout(idx);
        return;
      }
    }
    await this.schedule();
  }

  /** Tempo scaduto: a scacchi e dama perde chi doveva muovere, nella battaglia il turno passa. */
  async onTimeout(idx) {
    const g = this.game;
    if (isBoard(g)) M.timeout(g);
    else E.skipTurn(g);
    await this.save();
    this.broadcast();
    this.sendInfo({ code: 'timeout', by: idx });
    const other = 1 - idx;
    const Ti = texts(g.players[idx].lang);
    const To = texts(g.players[other].lang);
    if (isBoard(g)) {
      await this.push(idx, { title: Ti.pushTimeout, body: Ti.pushTimeoutLost });
      await this.push(other, { title: To.pushEnd, body: To.pushTimeoutWin(g.players[idx].name) });
    } else {
      await this.push(idx, { title: Ti.pushTimeout, body: Ti.pushTimeoutSkip });
      await this.push(other, { title: To.pushTurn, body: To.pushTimeoutOpp(g.players[idx].name) });
    }
    await this.schedule();
  }

  async sendReminder(idx, { urgent = false, push = true } = {}) {
    const g = this.game;
    const p = g.players[idx];
    const opp = g.players[1 - idx];
    // Il parametro v cambia a ogni mossa, così i client email non mostrano un'immagine vecchia.
    const version = isBoard(g) ? g.moveCount : p.shots.length + opp.shots.length;
    const imageUrl = `${g.origin}/api/games/${g.id}/board.png?k=${p.imageKey}&v=${version}`;
    const content = reminderContent({
      playerName: p.name,
      opponentName: opp.name,
      lastShot: !isBoard(g) && g.lastShot && g.lastShot.by !== idx ? g.lastShot : null,
      lastMove: isBoard(g) && g.lastMove && g.lastMove.by !== idx ? g.lastMove.text : null,
      link: this.link(idx),
      imageUrl,
      captions: !isBoard(g),
      urgent,
      lang: p.lang,
    });
    if (p.email) await sendEmail(this.env, { to: p.email, ...content });
    if (push) {
      const T = texts(p.lang);
      await this.push(idx, { title: T.pushWait, body: T.pushWaitBody(opp.name) });
    }
  }
}
