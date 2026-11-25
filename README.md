# P2P

Giochi 1 contro 1 nel browser, in tempo reale tra due PC: Flotta, Scacchi e Dama italiana.
Gira su Cloudflare Workers + Durable Objects (piano gratuito).

## Come si gioca
1. Apri il sito, scrivi il tuo nome e premi **Nuova partita**.
2. Copia il link e mandalo al collega.
3. Ognuno posiziona 5 navi (5, 4, 3, 3, 2 caselle) che non possono toccarsi, nemmeno in diagonale.
   Clic per piazzare, **R** o "Ruota" per cambiare verso, "Casuale" per fare in fretta.
4. Si spara a turno, un colpo per turno. Vince chi affonda per primo tutta la flotta avversaria.

### Scacchi e Dama
- Si sceglie il gioco nella schermata iniziale. Chi crea la sessione ha il bianco e muove per primo.
- Clic sul pezzo, poi sulla casella d'arrivo (le mosse possibili sono evidenziate). Promozione automatica a donna.
- Scacchi: regole complete (arrocco, en passant, scacco matto, stallo, 50 mosse, materiale insufficiente).
- Dama italiana: presa obbligatoria con le priorità italiane, la pedina non mangia la dama, patta dopo 40 mosse a testa senza prese.

### Tempo per turno
- Facoltativo: 30 s, 1, 2, 5 o 10 minuti. Il conto alla rovescia è accanto allo stato.
- Quando mancano il 20% del tempo (almeno 10 secondi) arriva un avviso: messaggio nella pagina, "(!)" nel titolo
  della scheda e notifica del browser (anche a scheda chiusa). Se il giocatore non aveva ancora aperto il turno, parte anche l'email.
- Tempo scaduto: a Scacchi e Dama perde chi doveva muovere; alla Flotta il turno passa all'avversario.

### Modalità
- **P2P**: sfida un collega mandandogli il link della sessione.
- **P1P**: gioca da solo contro il PC (tutto nel browser, la partita resta salvata se ricarichi). Anche a Scacchi e Dama, con il tempo per turno.

### Aspetto e discrezione
- La pagina ha sempre la cornice di un foglio di calcolo: la tabella vuota fa da sfondo e il modulo o la partita stanno sopra.
- Menu **File** (in alto a sinistra, anche in modalità discreta): resta aperto finché non lo chiudi (✕, File o Esc) e contiene
  nuova sessione (gioco, tempo, P2P/P1P), tema, chiaro/scuro, lingua, miniatura, modalità discreta.
- **Come funziona**: tour guidato in sovrimpressione (pagina oscurata, in risalto la parte spiegata) alla prima apertura della pagina iniziale e della partita; Indietro, Avanti, Chiudi, Non ricordarmelo più. Si rivede da File → Come funziona.
- Pulsante ☾/☀ per la modalità **chiara/scura** (vale anche per il finto foglio di calcolo).
- **Ricomincia** (con doppia conferma) riporta alla scelta iniziale del gioco; in P2P l'avversario riceve un avviso.
- Temi: Ufficio, Foglio di calcolo (predefinito), Disegno tecnico, Quaderno a quadretti, Sonar. Il browser lo ricorda.
- **Miniatura**: campo piccolo, con le due griglie affiancate.
- Lingua: italiano o inglese (anche email e notifiche).
- **Barra spaziatrice** (o il pulsante "Modalità discreta"): copre tutto con un finto foglio di calcolo.
  Si può scrivere liberamente nelle celle (doppio clic, F2 o inizia a digitare; Invio conferma).
  Nel foglio **Note**, scorrendo a destra, ci sono il campo in miniatura e i comandi: si gioca da lì.
  A Scacchi i pezzi sono lettere (maiuscole il bianco, minuscole il nero), a Dama "o" e "x" (maiuscole le dame).
  Si torna al gioco con Spazio, Esc o toccando l'icona verde in alto a sinistra.
  Segnale discreto: quando tocca a te, in basso a sinistra c'è scritto "Ricalcolo" invece di "Pronto".
- Opzione "Apri sempre in modalità discreta" nella schermata iniziale.

Se chiudi la scheda, riaprendo lo stesso link riprendi la partita da dove era rimasta.

## Notifiche e promemoria
- **Notifica del browser** appena tocca a te (pannello "🔔 Notifiche e promemoria" → "Attiva notifiche del browser").
  Funziona anche a scheda chiusa grazie al Web Push. Su iPhone serve aggiungere il sito alla schermata Home.
- **Email di promemoria** se dopo 5 minuti non hai ancora aperto la partita: contiene l'immagine aggiornata
  del campo e il pulsante "Torna alla partita" (il link ti fa rientrare anche da un altro PC). Una sola email per turno.

## Struttura
- `public/engine.js` – regole della Flotta (condivise da server e browser)
- `public/games/chess.js`, `checkers.js` – regole e avversario PC di Scacchi e Dama; `match.js` – turni, tempo, esito
- `public/boardui.js` – scacchiera 8x8 (pagina e foglio Note)
- `src/schedule.js` – eventi a tempo del turno (promemoria, avviso, scadenza)
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
