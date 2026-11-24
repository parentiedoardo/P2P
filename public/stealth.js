// Modalità discreta: copre il gioco con un finto foglio di calcolo.
// Si attiva e disattiva con la barra spaziatrice o con il pulsante in alto.

const COLS = 'ABCDEFGHIJKLMN'.split('');
const ROWS = 48;
const FILE = 'Consuntivo_Q4_2026.xlsx';
const VOCI = [
  'Materie prime', 'Semilavorati', 'Imballaggi', 'Energia elettrica', 'Gas naturale', 'Manutenzione impianti',
  'Ricambi', 'Trasporti in entrata', 'Trasporti in uscita', 'Logistica magazzino', 'Consulenze tecniche',
  'Consulenze legali', 'Licenze software', 'Hardware', 'Telefonia', 'Formazione', 'Viaggi e trasferte',
  'Assicurazioni', 'Affitti', 'Pulizie', 'Vigilanza', 'Marketing digitale', 'Fiere ed eventi', 'Campionature',
  'Smaltimento rifiuti', 'Certificazioni ISO', 'Collaudi', 'Laboratorio prove', 'Noleggi attrezzature',
  'Cancelleria', 'Spese bancarie', 'Commissioni', 'Canoni leasing', 'Utenze acqua', 'Mensa aziendale',
  'Sicurezza sul lavoro', 'Ricerca e sviluppo', 'Brevetti', 'Qualità fornitori', 'Audit interni',
];
const CDC = ['PRD', 'LOG', 'AMM', 'ICT', 'QUA', 'COM', 'R&S'];

// Generatore pseudo-casuale con seme fisso: i numeri restano uguali a ogni apertura.
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const fmt = (n) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const pct = (n) => n.toLocaleString('it-IT', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Contenuto delle celle: { 'B4': { v: testo mostrato, f: formula, cls } } */
function buildSheet() {
  const r = rng(20261124);
  const cells = {};
  const set = (ref, v, f, cls = '') => (cells[ref] = { v, f: f ?? v, cls });
  set('A1', 'Consuntivo costi per centro di costo · Q4 2026', null, 'title');
  set('A2', 'Valori in euro · Fonte: contabilità analitica · Ultimo aggiornamento 24/11/2026', null, 'muted');
  const head = ['Codice', 'Voce di costo', 'CdC', 'Budget Q4', 'Ottobre', 'Novembre', 'Dicembre (prev.)', 'Consuntivo Q4', 'Scostamento', 'Scost. %', 'YTD 2026', 'YTD 2025', 'Var. YoY', 'Stato'];
  head.forEach((h, i) => set(COLS[i] + '4', h, null, 'head'));
  const sums = {};
  const add = (c, n) => (sums[c] = (sums[c] || 0) + n);
  const first = 5;
  const last = first + VOCI.length - 1;
  VOCI.forEach((voce, i) => {
    const row = first + i;
    const budget = Math.round((8000 + r() * 140000) / 10) * 10;
    const m = [0, 1, 2].map(() => (budget / 3) * (0.82 + r() * 0.36));
    const cons = m[0] + m[1] + m[2];
    const ytd = cons * (3.6 + r() * 0.5);
    const ytdPrev = ytd * (0.88 + r() * 0.2);
    [['D', budget], ['E', m[0]], ['F', m[1]], ['G', m[2]], ['H', cons], ['I', cons - budget], ['K', ytd], ['L', ytdPrev]].forEach(([c, n]) => add(c, n));
    set(`A${row}`, `C${String(4100 + i * 7).padStart(5, '0')}`);
    set(`B${row}`, voce);
    set(`C${row}`, CDC[Math.floor(r() * CDC.length)], null, 'center');
    set(`D${row}`, fmt(budget), String(budget), 'num');
    set(`E${row}`, fmt(m[0]), m[0].toFixed(2), 'num');
    set(`F${row}`, fmt(m[1]), m[1].toFixed(2), 'num');
    set(`G${row}`, fmt(m[2]), `=MEDIA(E${row}:F${row})*${(m[2] / ((m[0] + m[1]) / 2)).toFixed(4).replace('.', ',')}`, 'num');
    set(`H${row}`, fmt(cons), `=SOMMA(E${row}:G${row})`, 'num');
    const diff = cons - budget;
    set(`I${row}`, fmt(diff), `=H${row}-D${row}`, 'num' + (diff > 0 ? ' neg' : ''));
    set(`J${row}`, pct(diff / budget), `=SE(D${row}=0;0;I${row}/D${row})`, 'num' + (diff > 0 ? ' neg' : ''));
    set(`K${row}`, fmt(ytd), `=SOMMA.SE(Mov!C:C;A${row};Mov!F:F)`, 'num');
    set(`L${row}`, fmt(ytdPrev), `=CERCA.VERT(A${row};'2025'!A:L;12;FALSO)`, 'num');
    set(`M${row}`, pct(ytd / ytdPrev - 1), `=K${row}/L${row}-1`, 'num');
    const ok = Math.abs(diff / budget) < 0.05;
    set(`N${row}`, ok ? 'In linea' : diff > 0 ? 'Sforamento' : 'Risparmio', `=SE(ASS(J${row})<5%;"In linea";SE(I${row}>0;"Sforamento";"Risparmio"))`, 'center ' + (ok ? '' : diff > 0 ? 'bad' : 'good'));
  });
  const tot = last + 2;
  set(`B${tot}`, 'Totale', null, 'total');
  for (const c of 'DEFGHIKL') set(`${c}${tot}`, fmt(sums[c]), `=SOMMA(${c}${first}:${c}${last})`, 'num total');
  return { cells, rows: Math.max(ROWS, tot + 3) };
}

let built = false;
let active = false;
let myTurn = false;
let savedTitle = document.title;
let savedIcon = null;
let selected = 'B5';
let sheet;

const ICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' rx='2' fill='%23217346'/><path d='M4 4h3l1 2 1-2h3l-2.5 4L12 12H9l-1-2-1 2H4l2.5-4z' fill='white'/></svg>";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function build() {
  sheet = buildSheet();
  const root = document.getElementById('stealth');
  root.innerHTML = `
    <div class="xl-title"><span class="xl-logo">X</span><span class="xl-qa">💾 ↶ ↷</span><span class="xl-file">${FILE}</span><span class="xl-saved">· Salvato</span><span class="xl-search">🔍 Cerca</span></div>
    <div class="xl-menu">${['File', 'Home', 'Inserisci', 'Layout di pagina', 'Formule', 'Dati', 'Revisione', 'Visualizza', 'Guida'].map((m, i) => `<span${i === 1 ? ' class="on"' : ''}>${m}</span>`).join('')}</div>
    <div class="xl-ribbon">
      <div class="grp"><b>📋</b><small>Incolla</small></div>
      <div class="grp wide"><span class="fake-input">Calibri</span><span class="fake-input s">11</span><span class="b">G</span><span class="b"><i>C</i></span><span class="b"><u>S</u></span><small>Carattere</small></div>
      <div class="grp"><span class="b">≡</span><span class="b">⇥</span><span class="b">⤶</span><small>Allineamento</small></div>
      <div class="grp"><span class="fake-input">Contabilità</span><span class="b">€</span><span class="b">%</span><span class="b">000</span><small>Numeri</small></div>
      <div class="grp"><span class="b">▦</span><span class="b">▤</span><small>Stili</small></div>
      <div class="grp"><span class="b">Σ</span><span class="b">⇅</span><span class="b">🔎</span><small>Modifica</small></div>
    </div>
    <div class="xl-formula"><span class="xl-name" id="xl-name"></span><span class="xl-fx">ƒx</span><span class="xl-f" id="xl-f"></span></div>
    <div class="xl-grid-wrap"><table class="xl-grid" id="xl-grid"></table></div>
    <div class="xl-tabs"><span>◀ ▶</span><span class="on">Consuntivo Q4</span><span>Budget 2027</span><span>Mov</span><span>2025</span><span>Note</span><span>+</span></div>
    <div class="xl-status"><span id="xl-ready">Pronto</span><span id="xl-sum"></span><span>▦ ▤ ▥ &nbsp; − ——●—— + 100%</span></div>`;
  const table = root.querySelector('#xl-grid');
  const hr = el('tr');
  hr.appendChild(el('th', 'corner'));
  for (const c of COLS) hr.appendChild(el('th', null, c));
  table.appendChild(hr);
  for (let row = 1; row <= sheet.rows; row++) {
    const tr = el('tr');
    tr.appendChild(el('th', 'rowh', String(row)));
    for (const c of COLS) {
      const ref = c + row;
      const data = sheet.cells[ref];
      const td = el('td', data?.cls || '', data?.v ?? '');
      td.dataset.ref = ref;
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  // Su telefono non c'è la barra spaziatrice: si esce toccando il logo verde in alto a sinistra.
  root.querySelector('.xl-logo').addEventListener('click', () => toggleStealth(false));
  table.addEventListener('click', (e) => {
    const td = e.target.closest('td');
    if (td) select(td.dataset.ref);
  });
  built = true;
  select(selected);
}

function select(ref) {
  const root = document.getElementById('stealth');
  root.querySelector('td.sel')?.classList.remove('sel');
  root.querySelector(`td[data-ref="${ref}"]`)?.classList.add('sel');
  selected = ref;
  document.getElementById('xl-name').textContent = ref;
  document.getElementById('xl-f').textContent = sheet.cells[ref]?.f ?? '';
  const v = sheet.cells[ref]?.v;
  const n = v && /^-?[\d.]+,\d+$/.test(v) ? v : null;
  document.getElementById('xl-sum').textContent = n ? `Somma: ${n}    Conteggio: 1` : '';
}

/** Segnale discreto: quando tocca a te, la barra di stato non dice "Pronto" ma "Ricalcolo". */
function paintTurn() {
  const ready = document.getElementById('xl-ready');
  if (ready) ready.textContent = myTurn ? 'Ricalcolo' : 'Pronto';
}

export function isStealth() {
  return active;
}

export function setStealthTurn(turn) {
  myTurn = !!turn;
  if (built) paintTurn();
}

export function toggleStealth(force) {
  const next = force ?? !active;
  if (next === active) return;
  active = next;
  if (active && !built) build();
  const root = document.getElementById('stealth');
  root.hidden = !active;
  document.body.classList.toggle('stealth-on', active);
  const icon = document.querySelector('link[rel="icon"]');
  if (active) {
    savedTitle = document.title;
    savedIcon = icon?.href;
    document.title = FILE;
    if (icon) icon.href = ICON;
    paintTurn();
  } else {
    document.title = savedTitle;
    if (icon && savedIcon) icon.href = savedIcon;
  }
  document.dispatchEvent(new CustomEvent('bn:stealth', { detail: active }));
}

/** Titolo della scheda: in modalità discreta resta quello del foglio. */
export function setTitle(title) {
  if (active) savedTitle = title;
  else document.title = title;
}

function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

// Barra spaziatrice: attiva/disattiva. Blocchiamo anche il keyup, altrimenti
// lo spazio "premerebbe" il pulsante (o la casella) che ha il focus.
document.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.key !== ' ') return;
  if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
  e.preventDefault();
  if (!e.repeat) toggleStealth();
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && active) toggleStealth(false);
});
document.addEventListener('keyup', (e) => {
  if ((e.code === 'Space' || e.key === ' ') && !isTyping(e.target)) e.preventDefault();
}, true);
