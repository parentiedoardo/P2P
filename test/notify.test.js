import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { encryptPayload, vapidAuthorization, b64urlEncode, b64urlDecode } from '../src/webpush.js';
import { encodePng } from '../src/png.js';
import { boardImage, reminderContent, IMAGE_SIZE } from '../src/notify.js';
import * as E from '../public/engine.js';

const subtle = crypto.subtle;

async function hkdf(salt, ikm, info, len) {
  const key = await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

test('Web Push: il browser riesce a decifrare il messaggio (RFC 8291)', async () => {
  // Chiavi del "browser"
  const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPublic = new Uint8Array(await subtle.exportKey('raw', ua.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub = { endpoint: 'https://push.example/x', keys: { p256dh: b64urlEncode(uaPublic), auth: b64urlEncode(auth) } };

  const body = await encryptPayload(sub, '{"title":"Tocca a te!"}');

  // Decifratura lato browser
  const salt = body.slice(0, 16);
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16);
  assert.equal(rs, 4096);
  const idlen = body[20];
  const asPublic = body.slice(21, 21 + idlen);
  const cipher = body.slice(21 + idlen);
  const asKey = await subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const te = new TextEncoder();
  const info = new Uint8Array([...te.encode('WebPush: info\0'), ...uaPublic, ...asPublic]);
  const ikm = await hkdf(auth, shared, info, 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, cipher));
  assert.equal(plain[plain.length - 1], 2, 'delimitatore di ultimo record');
  assert.equal(new TextDecoder().decode(plain.slice(0, -1)), '{"title":"Tocca a te!"}');
});

test('VAPID: il JWT è firmato correttamente', async () => {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicKey = b64urlEncode(await subtle.exportKey('raw', kp.publicKey));
  const { d } = await subtle.exportKey('jwk', kp.privateKey);
  const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', { publicKey, privateKey: d, subject: 'mailto:test@example.com' });
  const m = header.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/);
  assert.ok(m);
  assert.equal(m[4], publicKey);
  const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(m[2])));
  assert.equal(claims.aud, 'https://fcm.googleapis.com');
  assert.ok(claims.exp > Date.now() / 1000);
  const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, b64urlDecode(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`));
  assert.ok(ok);
});

test('PNG valido con i pixel giusti', async () => {
  const rgba = new Uint8Array(2 * 2 * 4).fill(255);
  rgba.set([255, 0, 0, 255], 0);
  const png = await encodePng(2, 2, rgba);
  assert.deepEqual([...png.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const len = new DataView(png.buffer).getUint32(33);
  const raw = inflateSync(png.slice(41, 41 + len));
  assert.deepEqual([...raw.slice(0, 5)], [0, 255, 0, 0, 255]);
});

test("immagine del campo e testo del promemoria", async () => {
  const g = E.createGame('abcdefghjk');
  E.addPlayer(g, { token: 'a', name: 'Anna' });
  E.addPlayer(g, { token: 'b', name: 'Bruno <b>' });
  E.placeShips(g, 0, E.randomFleet());
  E.placeShips(g, 1, E.randomFleet());
  E.fire(g, 0, 3, 3);
  const png = await boardImage(E.viewFor(g, 1));
  const v = new DataView(png.buffer);
  assert.equal(v.getUint32(16), IMAGE_SIZE.width);
  assert.equal(v.getUint32(20), IMAGE_SIZE.height);

  const c = reminderContent({ playerName: 'Bruno <b>', opponentName: 'Anna', lastShot: g.lastShot, link: 'https://x/?g=1&t=2', imageUrl: 'https://x/i.png' });
  assert.match(c.subject, /Tocca a te · Anna · P2P/);
  assert.match(reminderContent({ playerName: 'B', opponentName: 'Anna', lastShot: null, link: 'x', imageUrl: 'y', lang: 'en' }).subject, /Your turn/);
  assert.ok(c.html.includes('Bruno &lt;b&gt;'), 'nome con HTML escapato');
  assert.ok(c.html.includes('https://x/?g=1&amp;t=2'));
  assert.match(c.text, /D4/);
});
