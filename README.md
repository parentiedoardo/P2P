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

## Struttura
- `public/engine.js` – regole del gioco (condivise da server e browser)
- `public/index.html`, `app.js`, `style.css` – interfaccia
- `src/worker.js` – API e `GameRoom`, un Durable Object per partita con WebSocket
- `test/engine.test.js` – test delle regole

## Sviluppo
```bash
npm install
npm test        # test del motore
npm run dev     # http://localhost:8787
```

## Pubblicazione
Serve un account Cloudflare gratuito.
```bash
npx wrangler login
npm run deploy
```
Il sito sarà su `https://battaglia-navale.<tuo-sottodominio>.workers.dev`.
