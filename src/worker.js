import { DurableObject } from 'cloudflare:workers';
import * as E from '../public/engine.js';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomId(len) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

async function readName(request) {
  try {
    const body = await request.json();
    return E.cleanName(body?.name);
  } catch {
    return E.cleanName('');
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    // POST /api/games -> nuova partita
    if (url.pathname === '/api/games' && request.method === 'POST') {
      const gameId = randomId(10);
      const stub = env.GAME.get(env.GAME.idFromName(gameId));
      const res = await stub.create(gameId, await readName(request));
      return json({ gameId, ...res });
    }

    const m = url.pathname.match(/^\/api\/games\/([a-z0-9]{10})\/(join|ws)$/);
    if (!m) return json({ error: 'Non trovato' }, 404);
    const [, gameId, action] = m;
    const stub = env.GAME.get(env.GAME.idFromName(gameId));

    if (action === 'join' && request.method === 'POST') {
      const res = await stub.join(await readName(request));
      return json(res, res.error ? 400 : 200);
    }
    if (action === 'ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Serve una WebSocket' }, 426);
      return stub.fetch(request);
    }
    return json({ error: 'Metodo non consentito' }, 405);
  },
};

/** Una stanza per partita: conserva lo stato e inoltra gli aggiornamenti ai due giocatori. */
export class GameRoom extends DurableObject {
  async load() {
    if (!this.game) this.game = (await this.ctx.storage.get('game')) || null;
    return this.game;
  }

  async save() {
    await this.ctx.storage.put('game', this.game);
  }

  async create(gameId, name) {
    if (await this.load()) return { error: 'Partita già esistente' };
    this.game = E.createGame(gameId);
    const token = randomId(24);
    E.addPlayer(this.game, { token, name });
    await this.save();
    return { token };
  }

  async join(name) {
    if (!(await this.load())) return { error: 'Questa partita non esiste.' };
    try {
      const token = randomId(24);
      E.addPlayer(this.game, { token, name });
      await this.save();
      this.broadcast();
      return { token };
    } catch (e) {
      if (e instanceof E.GameError) return { error: e.message };
      throw e;
    }
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
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    try {
      if (msg.type === 'place') {
        E.placeShips(this.game, idx, msg.ships);
      } else if (msg.type === 'fire') {
        E.fire(this.game, idx, msg.x, msg.y);
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      } else {
        return;
      }
      await this.save();
      this.broadcast();
    } catch (e) {
      if (!(e instanceof E.GameError)) throw e;
      ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
  }

  async webSocketClose(ws, code) {
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {}
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
      const state = E.viewFor(this.game, idx);
      state.opponentOnline = online[1 - idx];
      try {
        s.send(JSON.stringify({ type: 'state', state }));
      } catch {}
    }
  }
}
