# Battaglia navale

Gioco web di Battaglia navale 1 contro 1, in tempo reale tra due PC.
Gira su Cloudflare Workers + Durable Objects (piano gratuito).

## Come si gioca
1. Apri il sito, scrivi il tuo nome e premi **Nuova partita**.
2. Copia il link e mandalo al collega.
3. Ognuno posiziona 5 navi (5, 4, 3, 3, 2 caselle) che non possono toccarsi, nemmeno in diagonale.
   Clic per piazzare, **R** o "Ruota" per cambiare verso, "Casuale" per fare in fretta.
4. Si spara a turno, un colpo per turno. Vince chi affonda per primo tutta la flotta avversaria.

Se chiudi la scheda, riaprendo lo stesso link riprendi la partita da dove era rimasta.

## Notifiche e promemoria
- **Notifica del browser** appena tocca a te (pannello "🔔 Notifiche e promemoria" → "Attiva notifiche del browser").
  Funziona anche a scheda chiusa grazie al Web Push. Su iPhone serve aggiungere il sito alla schermata Home.
- **Email di promemoria** se dopo 5 minuti non hai ancora aperto la partita: contiene l'immagine aggiornata
  del campo e il pulsante "Torna alla partita" (il link ti fa rientrare anche da un altro PC). Una sola email per turno.

## Struttura
- `public/engine.js` – regole del gioco (condivise da server e browser)
- `public/index.html`, `app.js`, `style.css` – interfaccia
- `src/worker.js` – API e `GameRoom`, un Durable Object per partita: WebSocket, timer dei promemoria
- `src/webpush.js` – notifiche push (VAPID + cifratura) senza librerie esterne
- `src/png.js`, `src/notify.js` – immagine PNG del campo e testo delle email
- `public/sw.js` – service worker che mostra le notifiche
- `test/` – test delle regole, del push e dell'immagine

## Sviluppo
```bash
npm install
npm test        # test del motore
npm run dev     # http://localhost:8787
```

In locale le email non partono: vengono scritte nel log di `wrangler dev` come `[email simulata]`.
Per provare i promemoria più in fretta, crea `.dev.vars` con `REMINDER_MINUTES=0.1` (6 secondi).

## Configurazione
| Variabile | A cosa serve | Obbligatoria |
|---|---|---|
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Chiavi per le notifiche push. Se mancano, il sito le genera da solo al primo uso e le conserva | No |
| `VAPID_SUBJECT` | Contatto per i servizi push, es. `mailto:tu@dominio.it` (predefinito: l'indirizzo del sito) | No |
| `RESEND_API_KEY` | Invio email con [Resend](https://resend.com) (piano gratuito) | Per le email |
| `EMAIL_FROM` | Mittente, es. `Battaglia navale <noreply@tuodominio.it>` (dominio verificato su Resend) | Per le email |
| `REMINDER_MINUTES` | Minuti prima del promemoria (predefinito 5) | No |

Online si impostano con `npx wrangler secret put NOME`.

## Pubblicazione automatica
Ogni push su `main` esegue i test e pubblica il sito con GitHub Actions (`.github/workflows/deploy.yml`).
Servono due segreti del repository (Settings → Secrets and variables → Actions):
- `CLOUDFLARE_API_TOKEN`: token Cloudflare creato dal modello "Edit Cloudflare Workers"
- `CLOUDFLARE_ACCOUNT_ID`: l'ID account, visibile nella home della dashboard Cloudflare

## Pubblicazione manuale
Serve un account Cloudflare gratuito.
```bash
npx wrangler login
npm run deploy
npx wrangler secret put RESEND_API_KEY     # e le altre variabili sopra, se servono
```
Il sito sarà su `https://p2p.<tuo-sottodominio>.workers.dev`.
