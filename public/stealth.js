// Modalità discreta: copre tutto con un finto foglio di calcolo.
// Spazio o il pulsante la attivano; Spazio (fuori dalle celle in modifica), Esc o il logo verde la chiudono.
// Nel foglio "Note", scorrendo a destra, ci sono il campo in miniatura e i comandi.
import { lang } from '/i18n.js';

const L = {
  it: {
    file: 'Consuntivo_Q4_2026.xlsx',
    saved: 'Salvato',
    search: 'Cerca',
    menu: ['File', 'Home', 'Inserisci', 'Layout di pagina', 'Formule', 'Dati', 'Revisione', 'Visualizza', 'Guida'],
    groups: ['Incolla', 'Carattere', 'Allineamento', 'Numeri', 'Stili', 'Modifica'],
    numberFormat: 'Contabilità',
    tabs: { report: 'Consuntivo Q4', budget: 'Budget 2027', mov: 'Movimenti', y2025: '2025', note: 'Note' },
    ready: 'Pronto', calc: 'Ricalcolo', edit: 'Modifica',
    sum: 'Somma', count: 'Conteggio',
    reportTitle: 'Consuntivo costi per centro di costo · Q4 2026',
    budgetTitle: 'Budget costi 2027 · bozza per revisione',
    y2025Title: 'Consuntivo costi 2025 · definitivo',
    subtitle: 'Valori in euro · Fonte: contabilità analitica · Ultimo aggiornamento 25/11/2026',
    head: ['Codice', 'Voce di costo', 'CdC', 'Budget', 'Ottobre', 'Novembre', 'Dicembre (prev.)', 'Consuntivo', 'Scostamento', 'Scost. %', 'YTD 2026', 'YTD 2025', 'Var. YoY', 'Stato'],
    total: 'Totale',
    inline: 'In linea', over: 'Sforamento', under: 'Risparmio',
    movTitle: 'Movimenti contabili · novembre 2026',
    movHead: ['Data', 'Protocollo', 'Fornitore', 'Descrizione', 'CdC', 'Imponibile', 'IVA', 'Totale', 'Scadenza', 'Stato'],
    movStates: ['Registrato', 'Da approvare', 'Pagato'],
    suppliers: ['Alfa Forniture', 'Beta Logistica', 'Gamma Energia', 'Delta Servizi', 'Epsilon Tech', 'Zeta Consulting', 'Eta Imballaggi', 'Theta Trasporti'],
    noteTitle: 'Note di riunione · revisione costi Q4',
    notes: [
      '- Verificare scostamento trasporti in entrata con LOG entro venerdì',
      '- Allineare previsione dicembre con ufficio acquisti',
      '- Richiedere preventivo aggiornato manutenzione impianti',
      '- Consulenze legali: chiarire fatture fuori budget',
      '- Energia: valutare rinegoziazione contratto 2027',
      '- Inviare report definitivo a direzione entro fine mese',
      '- Prossimo incontro: martedì ore 10:00',
    ],
    you: 'Tu',
    cmdRandom: 'Casuale', cmdRotate: 'Ruota', cmdClear: 'Svuota', cmdReady: 'Pronto', cmdRematch: 'Rivincita', cmdNew: 'Nuova',
    gameHint: 'Riepilogo →',
  },
  en: {
    file: 'Q4_2026_Cost_Report.xlsx',
    saved: 'Saved',
    search: 'Search',
    menu: ['File', 'Home', 'Insert', 'Page Layout', 'Formulas', 'Data', 'Review', 'View', 'Help'],
    groups: ['Paste', 'Font', 'Alignment', 'Number', 'Styles', 'Editing'],
    numberFormat: 'Accounting',
    tabs: { report: 'Q4 Actuals', budget: 'Budget 2027', mov: 'Ledger', y2025: '2025', note: 'Notes' },
    ready: 'Ready', calc: 'Calculate', edit: 'Edit',
    sum: 'Sum', count: 'Count',
    reportTitle: 'Costs by cost center · Q4 2026 actuals',
    budgetTitle: 'Cost budget 2027 · draft for review',
    y2025Title: 'Costs 2025 · final',
    subtitle: 'Amounts in EUR · Source: cost accounting · Last updated 11/25/2026',
    head: ['Code', 'Cost item', 'CC', 'Budget', 'October', 'November', 'December (fcst)', 'Actual', 'Variance', 'Var. %', 'YTD 2026', 'YTD 2025', 'YoY', 'Status'],
    total: 'Total',
    inline: 'On track', over: 'Over', under: 'Under',
    movTitle: 'Ledger entries · November 2026',
    movHead: ['Date', 'Ref.', 'Supplier', 'Description', 'CC', 'Net', 'VAT', 'Total', 'Due', 'Status'],
    movStates: ['Posted', 'To approve', 'Paid'],
    suppliers: ['Alpha Supplies', 'Beta Logistics', 'Gamma Energy', 'Delta Services', 'Epsilon Tech', 'Zeta Consulting', 'Eta Packaging', 'Theta Freight'],
    noteTitle: 'Meeting notes · Q4 cost review',
    notes: [
      '- Check inbound freight variance with LOG by Friday',
      '- Align December forecast with purchasing',
      '- Request updated quote for plant maintenance',
      '- Legal fees: clarify invoices over budget',
      '- Energy: consider renegotiating the 2027 contract',
      '- Send final report to management by month end',
      '- Next meeting: Tuesday 10:00',
    ],
    you: 'You',
    cmdRandom: 'Random', cmdRotate: 'Rotate', cmdClear: 'Clear', cmdReady: 'Ready', cmdRematch: 'Rematch', cmdNew: 'New',
    gameHint: 'Summary →',
  },
};
const ITEMS = {
  it: ['Materie prime', 'Semilavorati', 'Imballaggi', 'Energia elettrica', 'Gas naturale', 'Manutenzione impianti', 'Ricambi', 'Trasporti in entrata', 'Trasporti in uscita', 'Logistica magazzino', 'Consulenze tecniche', 'Consulenze legali', 'Licenze software', 'Hardware', 'Telefonia', 'Formazione', 'Viaggi e trasferte', 'Assicurazioni', 'Affitti', 'Pulizie', 'Vigilanza', 'Marketing digitale', 'Fiere ed eventi', 'Campionature', 'Smaltimento rifiuti', 'Certificazioni ISO', 'Collaudi', 'Laboratorio prove', 'Noleggi attrezzature', 'Cancelleria', 'Spese bancarie', 'Commissioni', 'Canoni leasing', 'Utenze acqua', 'Mensa aziendale', 'Sicurezza sul lavoro', 'Ricerca e sviluppo', 'Brevetti', 'Qualità fornitori', 'Audit interni'],
  en: ['Raw materials', 'Semi-finished goods', 'Packaging', 'Electricity', 'Natural gas', 'Plant maintenance', 'Spare parts', 'Inbound freight', 'Outbound freight', 'Warehouse logistics', 'Technical consulting', 'Legal fees', 'Software licenses', 'Hardware', 'Telephony', 'Training', 'Travel', 'Insurance', 'Rent', 'Cleaning', 'Security', 'Digital marketing', 'Trade fairs', 'Samples', 'Waste disposal', 'ISO certification', 'Testing', 'Test lab', 'Equipment rental', 'Stationery', 'Bank fees', 'Commissions', 'Lease payments', 'Water', 'Canteen', 'Health and safety', 'R&D', 'Patents', 'Supplier quality', 'Internal audit'],
};
const CDC = ['PRD', 'LOG', 'AMM', 'ICT', 'QUA', 'COM', 'R&S'];
const SHEETS = ['report', 'budget', 'mov', 'y2025', 'note'];

const NCOLS = 40;
const COLS = Array.from({ length: NCOLS }, (_, i) => (i < 26 ? '' : 'A') + String.fromCharCode(65 + (i % 26)));
const ROWS = 50;
// Foglio Note: griglia avversaria da R5 (colonna 17), propria da AD5 (colonna 29).
const G = { oppCol: 17, meCol: 29, top: 5, head: 4, title: 3, cmdRow: 16, hintRow: 17, statusRow: 18, flashRow: 19 };

const S = () => L[lang] || L.it;

function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
const locale = () => (lang === 'en' ? 'en-GB' : 'it-IT');
const fmt = (n) => n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const pct = (n) => n.toLocaleString(locale(), { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const sep = () => (lang === 'en' ? ',' : ';');

// ---------- Generazione dei fogli ----------
function reportSheet(seed, title) {
  const s = S();
  const r = rng(seed);
  const cells = {};
  const set = (ref, v, f, cls = '') => (cells[ref] = { v, f: f ?? v, cls });
  set('A1', title, null, 'title');
  set('A2', s.subtitle, null, 'muted');
  s.head.forEach((h, i) => set(COLS[i] + '4', h, null, 'head'));
  const first = 5;
  const items = ITEMS[lang] || ITEMS.it;
  const last = first + items.length - 1;
  const sums = {};
  const add = (c, n) => (sums[c] = (sums[c] || 0) + n);
  const fn = lang === 'en' ? { SUM: 'SUM', AVG: 'AVERAGE', IF: 'IF', ABS: 'ABS', SUMIF: 'SUMIF', VLOOKUP: 'VLOOKUP', F: 'FALSE' } : { SUM: 'SOMMA', AVG: 'MEDIA', IF: 'SE', ABS: 'ASS', SUMIF: 'SOMMA.SE', VLOOKUP: 'CERCA.VERT', F: 'FALSO' };
  const p = sep();
  items.forEach((voce, i) => {
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
    set(`G${row}`, fmt(m[2]), `=${fn.AVG}(E${row}:F${row})*${(m[2] / ((m[0] + m[1]) / 2)).toFixed(4)}`, 'num');
    set(`H${row}`, fmt(cons), `=${fn.SUM}(E${row}:G${row})`, 'num');
    const diff = cons - budget;
    set(`I${row}`, fmt(diff), `=H${row}-D${row}`, 'num' + (diff > 0 ? ' neg' : ''));
    set(`J${row}`, pct(diff / budget), `=${fn.IF}(D${row}=0${p}0${p}I${row}/D${row})`, 'num' + (diff > 0 ? ' neg' : ''));
    set(`K${row}`, fmt(ytd), `=${fn.SUMIF}(Mov!C:C${p}A${row}${p}Mov!F:F)`, 'num');
    set(`L${row}`, fmt(ytdPrev), `=${fn.VLOOKUP}(A${row}${p}'2025'!A:L${p}12${p}${fn.F})`, 'num');
    set(`M${row}`, pct(ytd / ytdPrev - 1), `=K${row}/L${row}-1`, 'num');
    const ok = Math.abs(diff / budget) < 0.05;
    set(`N${row}`, ok ? s.inline : diff > 0 ? s.over : s.under, `=${fn.IF}(${fn.ABS}(J${row})<5%${p}"${s.inline}"${p}${fn.IF}(I${row}>0${p}"${s.over}"${p}"${s.under}"))`, 'center ' + (ok ? '' : diff > 0 ? 'bad' : 'good'));
  });
  const tot = last + 2;
  set(`B${tot}`, s.total, null, 'total');
  for (const c of 'DEFGHIKL') set(`${c}${tot}`, fmt(sums[c]), `=${fn.SUM}(${c}${first}:${c}${last})`, 'num total');
  return cells;
}

function movSheet(seed) {
  const s = S();
  const r = rng(seed);
  const cells = {};
  const set = (ref, v, f, cls = '') => (cells[ref] = { v, f: f ?? v, cls });
  set('A1', s.movTitle, null, 'title');
  s.movHead.forEach((h, i) => set(COLS[i] + '3', h, null, 'head'));
  const items = ITEMS[lang] || ITEMS.it;
  for (let i = 0; i < 44; i++) {
    const row = 4 + i;
    const day = 1 + Math.floor((i / 44) * 24);
    const date = lang === 'en' ? `11/${String(day).padStart(2, '0')}/2026` : `${String(day).padStart(2, '0')}/11/2026`;
    const net = Math.round(200 + r() * 18000) + r();
    set(`A${row}`, date);
    set(`B${row}`, `FT-${26000 + i * 13}`);
    set(`C${row}`, s.suppliers[Math.floor(r() * s.suppliers.length)]);
    set(`D${row}`, items[Math.floor(r() * items.length)]);
    set(`E${row}`, CDC[Math.floor(r() * CDC.length)], null, 'center');
    set(`F${row}`, fmt(net), net.toFixed(2), 'num');
    set(`G${row}`, fmt(net * 0.22), `=F${row}*22%`, 'num');
    set(`H${row}`, fmt(net * 1.22), `=F${row}+G${row}`, 'num');
    const dd = ((day + 29) % 28) + 1;
    set(`I${row}`, lang === 'en' ? `12/${String(dd).padStart(2, '0')}/2026` : `${String(dd).padStart(2, '0')}/12/2026`);
    set(`J${row}`, s.movStates[Math.floor(r() * 3)], null, 'center');
  }
  return cells;
}

function noteSheet() {
  const s = S();
  const cells = {};
  const set = (ref, v, cls = '') => (cells[ref] = { v, f: v, cls });
  set('A1', s.noteTitle, 'title');
  s.notes.forEach((n, i) => set(`A${3 + i}`, n, 'muted-strong'));
  set(`F${3 + s.notes.length + 2}`, '', '');
  set('N4', s.gameHint, 'hint');
  return cells;
}

function buildSheets() {
  const s = S();
  return {
    report: reportSheet(20261124, s.reportTitle),
    budget: reportSheet(20270101, s.budgetTitle),
    mov: movSheet(20261101),
    y2025: reportSheet(20251231, s.y2025Title),
    note: noteSheet(),
  };
}

// ---------- Stato ----------
let hooks = null;
let built = false;
let active = false;
let myTurn = false;
let gameTitle = document.title;
let sheets = null;
let current = 'report';
let selected = { report: 'B5', budget: 'B5', mov: 'C4', y2025: 'B5', note: 'A3' };
let edits = {};
let editing = null; // { ref, input, td }
let lastFlash = '';

try { edits = JSON.parse(localStorage.getItem('bn:sheet-edits') || '{}') || {}; } catch {}
const saveEdits = () => { try { localStorage.setItem('bn:sheet-edits', JSON.stringify(edits)); } catch {} };

const root = () => document.getElementById('stealth');
const q = (sel) => root().querySelector(sel);
const parseRef = (ref) => {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  return { c: COLS.indexOf(m[1]), r: Number(m[2]) };
};
const refOf = (c, r) => COLS[c] + r;

export function bind(h) {
  hooks = h;
}

export function isActive() {
  return active;
}

export function setTurn(turn) {
  myTurn = !!turn;
  paintStatus();
}

/** Titolo della scheda del browser: in modalità discreta resta il nome del file. */
export function setTitle(title) {
  gameTitle = title;
  if (!active) document.title = title;
}

/** Ultimo messaggio del gioco, mostrato in una cella del foglio Note. */
export function flash(text) {
  lastFlash = text;
  if (active && current === 'note') paintGame();
}

export function refresh() {
  if (active && current === 'note') paintGame();
  paintStatus();
}

export function rebuild() {
  if (!built) return;
  if (editing) cancelEdit();
  build();
  if (active) document.title = S().file;
}

function build() {
  const s = S();
  sheets = buildSheets();
  root().innerHTML = `
    <div class="xl-title"><img class="xl-logo" src="/favicon.svg" alt="" title="P2P"><span class="xl-qa">💾 ↶ ↷</span><span class="xl-file">${s.file}</span><span class="xl-saved">· ${s.saved}</span><span class="xl-search">🔍 ${s.search}</span></div>
    <div class="xl-menu">${s.menu.map((m, i) => `<span${i === 1 ? ' class="on"' : ''}>${m}</span>`).join('')}</div>
    <div class="xl-ribbon">
      <div class="grp"><b>📋</b><small>${s.groups[0]}</small></div>
      <div class="grp wide"><span class="fake-input">Calibri</span><span class="fake-input s">11</span><span class="b"><b>${lang === 'en' ? 'B' : 'G'}</b></span><span class="b"><i>${lang === 'en' ? 'I' : 'C'}</i></span><span class="b"><u>${lang === 'en' ? 'U' : 'S'}</u></span><small>${s.groups[1]}</small></div>
      <div class="grp"><span class="b">≡</span><span class="b">⇥</span><span class="b">⤶</span><small>${s.groups[2]}</small></div>
      <div class="grp"><span class="fake-input">${s.numberFormat}</span><span class="b">€</span><span class="b">%</span><span class="b">000</span><small>${s.groups[3]}</small></div>
      <div class="grp"><span class="b">▦</span><span class="b">▤</span><small>${s.groups[4]}</small></div>
      <div class="grp"><span class="b">Σ</span><span class="b">⇅</span><span class="b">🔎</span><small>${s.groups[5]}</small></div>
    </div>
    <div class="xl-formula"><span class="xl-name" id="xl-name"></span><span class="xl-fx">ƒx</span><span class="xl-f" id="xl-f"></span></div>
    <div class="xl-grid-wrap" id="xl-wrap"><table class="xl-grid" id="xl-grid"></table></div>
    <div class="xl-tabs" id="xl-tabs"><span class="nav">◀ ▶</span>${SHEETS.map((k) => `<span data-sheet="${k}">${s.tabs[k]}</span>`).join('')}<span>+</span></div>
    <div class="xl-status"><span id="xl-ready"></span><span id="xl-sum"></span><span class="xl-zoom">▦ ▤ ▥ &nbsp; − ——●—— + 100%</span></div>`;
  q('.xl-logo').addEventListener('click', () => toggle(false));
  q('#xl-tabs').addEventListener('click', (e) => {
    const k = e.target.closest('[data-sheet]')?.dataset.sheet;
    if (k) showSheet(k);
  });
  const grid = q('#xl-grid');
  grid.addEventListener('click', onGridClick);
  grid.addEventListener('dblclick', (e) => {
    const td = e.target.closest('td');
    if (td && !isGameCell(td.dataset.ref)) startEdit(td.dataset.ref, null);
  });
  built = true;
  showSheet(current);
}

function showSheet(key) {
  if (editing) commitEdit();
  current = key;
  for (const tab of root().querySelectorAll('[data-sheet]')) tab.classList.toggle('on', tab.dataset.sheet === key);
  const grid = q('#xl-grid');
  const cells = sheets[key];
  const mine = edits[key] || {};
  // Larghezze esplicite: con table-layout fixed la tabella deve avere la somma esatta.
  const narrow = window.matchMedia('(max-width: 640px)').matches;
  const W = { 'c-std': 92, 'c-wide': narrow ? 150 : 190, 'c-game': 24 };
  let total = 40;
  const parts = ['<colgroup><col style="width:40px">'];
  for (let c = 0; c < NCOLS; c++) {
    let cls = 'c-std';
    if (key !== 'note' && c === 1) cls = 'c-wide';
    if (key === 'mov' && (c === 2 || c === 3)) cls = 'c-wide';
    if (key === 'note' && c >= G.oppCol - 1) cls = 'c-game';
    total += W[cls];
    parts.push(`<col style="width:${W[cls]}px">`);
  }
  parts.push('</colgroup><thead><tr><th class="corner"></th>');
  for (const c of COLS) parts.push(`<th>${c}</th>`);
  parts.push('</tr></thead><tbody>');
  const esc = (v) => String(v).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  for (let r = 1; r <= ROWS; r++) {
    parts.push(`<tr><th class="rowh">${r}</th>`);
    for (let c = 0; c < NCOLS; c++) {
      const ref = refOf(c, r);
      const data = cells[ref];
      const v = ref in mine ? mine[ref] : data?.v ?? '';
      parts.push(`<td data-ref="${ref}" class="${ref in mine ? '' : data?.cls || ''}">${esc(v)}</td>`);
    }
    parts.push('</tr>');
  }
  parts.push('</tbody>');
  grid.innerHTML = parts.join('');
  grid.style.width = total + 'px';
  q('#xl-wrap').scrollTo(0, 0);
  if (key === 'note') paintGame();
  select(selected[key], false);
}

function td(ref) {
  return q(`td[data-ref="${ref}"]`);
}

function valueOf(ref) {
  const mine = edits[current] || {};
  if (ref in mine) return { v: mine[ref], f: mine[ref] };
  return sheets[current][ref] || { v: '', f: '' };
}

function select(ref, scroll = true) {
  q('td.sel')?.classList.remove('sel');
  const cell = td(ref);
  if (!cell) return;
  cell.classList.add('sel');
  selected[current] = ref;
  if (scroll) cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  q('#xl-name').textContent = ref;
  const { v, f } = isGameCell(ref) ? { v: '', f: '' } : valueOf(ref);
  q('#xl-f').textContent = f ?? '';
  const n = typeof v === 'string' && /^-?[\d.,]+$/.test(v) && /\d/.test(v) ? v : null;
  q('#xl-sum').textContent = n ? `${S().sum}: ${n}    ${S().count}: 1` : '';
}

// ---------- Modifica delle celle ----------
function startEdit(ref, initial) {
  if (editing) commitEdit();
  select(ref);
  const cell = td(ref);
  const input = document.createElement('input');
  input.className = 'xl-edit';
  input.value = initial ?? String(valueOf(ref).f ?? '');
  cell.textContent = '';
  cell.appendChild(input);
  editing = { ref, input };
  input.addEventListener('input', () => (q('#xl-f').textContent = input.value));
  input.addEventListener('blur', () => { if (editing?.input === input) commitEdit(); });
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
  q('#xl-f').textContent = input.value;
  paintStatus();
}

function commitEdit() {
  if (!editing) return;
  const { ref, input } = editing;
  editing = null;
  (edits[current] ||= {})[ref] = input.value;
  saveEdits();
  const cell = td(ref);
  cell.className = 'sel';
  cell.textContent = input.value;
  select(ref, false);
  paintStatus();
}

function cancelEdit() {
  if (!editing) return;
  const { ref } = editing;
  editing = null;
  const cell = td(ref);
  cell.textContent = valueOf(ref).v ?? '';
  paintStatus();
}

function move(dc, dr) {
  const { c, r } = parseRef(selected[current]);
  const nc = Math.min(NCOLS - 1, Math.max(0, c + dc));
  const nr = Math.min(ROWS, Math.max(1, r + dr));
  select(refOf(nc, nr));
}

// ---------- Campo da gioco nel foglio Note ----------
function isGameCell(ref) {
  if (current !== 'note') return false;
  const { c, r } = parseRef(ref);
  return c >= G.oppCol - 1 && r >= G.title && r <= G.flashRow;
}

function paintGame() {
  if (!hooks || !built || current !== 'note') return;
  const state = hooks.getState();
  const s = S();
  // Pulisce l'area di gioco
  for (let r = G.title; r <= G.flashRow; r++) {
    for (let c = G.oppCol - 1; c < NCOLS; c++) {
      const cell = td(refOf(c, r));
      if (cell) { cell.textContent = ''; cell.className = cell.classList.contains('sel') ? 'sel' : ''; delete cell.dataset.cmd; delete cell.dataset.gx; }
    }
  }
  const put = (c, r, text, cls = '', extra = {}) => {
    const cell = td(refOf(c, r));
    if (!cell) return;
    cell.textContent = text;
    if (cls) cell.classList.add(...cls.split(' '));
    Object.assign(cell.dataset, extra);
  };
  const LET = 'ABCDEFGHIJ';
  const drawBoard = (col, title, cellMarks, side, clickable) => {
    put(col, G.title, title, 'g-title');
    for (let x = 0; x < 10; x++) put(col + x, G.head, LET[x], 'g-head');
    for (let y = 0; y < 10; y++) {
      put(col - 1, G.top + y, String(y + 1), 'g-head');
      for (let x = 0; x < 10; x++) put(col + x, G.top + y, '', 'g-sea' + (clickable ? ' g-click' : ''), { gx: `${side}:${x}:${y}` });
    }
    for (const [x, y, cls] of cellMarks) {
      const cell = td(refOf(col + x, G.top + y));
      if (!cell) continue;
      for (const k of cls.split(' ')) {
        if (k === 'ship') cell.classList.add('g-ship');
        if (k === 'hit') { cell.classList.add('g-hit'); cell.textContent = 'X'; }
        if (k === 'miss') { cell.classList.add('g-miss'); cell.textContent = '0'; }
        if (k === 'sunk') { cell.classList.add('g-sunk'); cell.textContent = 'X'; }
        if (k === 'last') cell.classList.add('g-last');
      }
    }
  };
  if (!state) {
    put(G.oppCol, G.statusRow, hooks.status() || '', 'g-status');
    return;
  }
  const { mine, theirs } = hooks.marks();
  const placing = hooks.isPlacing();
  drawBoard(G.oppCol, state.opponent ? state.opponent.name : '—', theirs, 'opp', hooks.canFire());
  drawBoard(G.meCol, s.you, mine, 'me', placing);
  if (placing) {
    put(G.oppCol, G.cmdRow, s.cmdRandom, 'g-cmd', { cmd: 'random' });
    put(G.oppCol + 3, G.cmdRow, s.cmdRotate + (hooks.dir() === 'h' ? ' ↔' : ' ↕'), 'g-cmd', { cmd: 'rotate' });
    put(G.oppCol + 6, G.cmdRow, s.cmdClear, 'g-cmd', { cmd: 'clear' });
    put(G.oppCol + 8, G.cmdRow, s.cmdReady, 'g-cmd g-primary', { cmd: 'ready' });
  } else if (state.phase === 'finished') {
    put(G.oppCol, G.cmdRow, state.solo ? s.cmdRematch : s.cmdNew, 'g-cmd g-primary', { cmd: 'rematch' });
  }
  if (placing) put(G.oppCol, G.hintRow, document.getElementById('placement-hint')?.textContent || '', 'g-status');
  put(G.oppCol, G.statusRow, hooks.status() || '', 'g-status' + (state.myTurn ? ' g-turn' : ''));
  if (lastFlash) put(G.oppCol, G.flashRow, lastFlash, 'g-status muted');
}

function onGridClick(e) {
  const cell = e.target.closest('td');
  if (!cell) return;
  if (editing && editing.input === e.target) return;
  const ref = cell.dataset.ref;
  select(ref, false);
  if (!hooks || current !== 'note') return;
  if (cell.dataset.cmd) {
    hooks.actions[cell.dataset.cmd]?.();
    return;
  }
  if (cell.dataset.gx) {
    const [side, x, y] = cell.dataset.gx.split(':');
    if (side === 'opp') hooks.onOppCell(Number(x), Number(y));
    else hooks.onMyCell(Number(x), Number(y));
  }
}

/** Segnale discreto: quando tocca a te, la barra di stato non dice "Pronto" ma "Ricalcolo". */
function paintStatus() {
  const ready = built && document.getElementById('xl-ready');
  if (ready) ready.textContent = editing ? S().edit : myTurn ? S().calc : S().ready;
}

// ---------- Attivazione ----------
export function toggle(force) {
  const next = force ?? !active;
  document.documentElement.classList.remove('stealth-boot');
  if (next === active) return;
  active = next;
  if (active && !built) build();
  if (!active && editing) commitEdit();
  root().hidden = !active;
  document.body.classList.toggle('stealth-on', active);
  if (active) {
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    document.title = S().file;
    refresh();
  } else {
    document.title = gameTitle;
  }
}

function isTyping(target) {
  return target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
}

document.addEventListener('keydown', (e) => {
  const isSpace = e.code === 'Space' || e.key === ' ';
  if (!active) {
    // Spazio attiva la modalità discreta, tranne mentre si scrive in un campo.
    if (isSpace && !isTyping(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      if (!e.repeat) toggle(true);
    }
    return;
  }
  // Modalità attiva
  if (editing) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit(); move(0, 1); }
    else if (e.key === 'Tab') { e.preventDefault(); commitEdit(); move(e.shiftKey ? -1 : 1, 0); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
    return; // il resto (spazio compreso) va nella cella
  }
  if (isTyping(e.target)) return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const keys = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], Enter: [0, 1] };
  if (isSpace || e.key === 'Escape') { e.preventDefault(); if (!e.repeat) toggle(false); }
  else if (keys[e.key]) { e.preventDefault(); move(...keys[e.key]); }
  else if (e.key === 'Tab') { e.preventDefault(); move(e.shiftKey ? -1 : 1, 0); }
  else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    const ref = selected[current];
    if (isGameCell(ref)) return;
    (edits[current] ||= {})[ref] = '';
    saveEdits();
    td(ref).textContent = '';
    select(ref, false);
  } else if (e.key === 'F2') { e.preventDefault(); if (!isGameCell(selected[current])) startEdit(selected[current], null); }
  else if (e.key.length === 1) {
    if (isGameCell(selected[current])) return;
    e.preventDefault();
    startEdit(selected[current], e.key);
  }
}, true);

// Blocchiamo il keyup dello spazio: altrimenti "premerebbe" il pulsante che ha il focus.
document.addEventListener('keyup', (e) => {
  if ((e.code === 'Space' || e.key === ' ') && !isTyping(e.target)) e.preventDefault();
}, true);
