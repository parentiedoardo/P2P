// Genera le chiavi VAPID per le notifiche push.
// Uso: node scripts/vapid-keys.mjs
import { b64urlEncode } from '../src/webpush.js';

const { publicKey, privateKey } = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = b64urlEncode(await crypto.subtle.exportKey('raw', publicKey));
const { d } = await crypto.subtle.exportKey('jwk', privateKey);
console.log(`VAPID_PUBLIC_KEY=${pub}`);
console.log(`VAPID_PRIVATE_KEY=${d}`);
