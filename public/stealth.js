// Modalità discreta: copre tutto con un finto foglio di calcolo.
// Spazio o il pulsante la attivano; Spazio (fuori dalle celle in modifica), Esc o il logo verde la chiudono.
// Nel foglio "Note", scorrendo a destra, ci sono il campo in miniatura e i comandi.
import { lang } from '/i18n.js';
import * as BoardUI from '/boardui.js';

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
    cmdRandom: 'Casuale', cmdRotate: 'Ruota', cmdClear: 'Svuota', cmdReady: 'Pronto', cmdRematch: 'Rivincita', cmdNew: 'Nuova', cmdRestart: 'Ricomincia', cmdSure: 'Sei sicuro?',
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
    cmdRandom: 'Random', cmdRotate: 'Rotate', cmdClear: 'Clear', cmdReady: 'Ready', cmdRematch: 'Rematch', cmdNew: 'New', cmdRestart: 'Restart', cmdSure: 'Are you sure?',
  },
};
const ITEMS = {
  it: ['Materie prime', 'Semilavorati', 'Imballaggi', 'Energia elettrica', 'Gas naturale', 'Manutenzione impianti', 'Ricambi', 'Trasporti in entrata', 'Trasporti in uscita', 'Logistica magazzino', 'Consulenze tecniche', 'Consulenze legali', 'Licenze software', 'Hardware', 'Telefonia', 'Formazione', 'Viaggi e trasferte', 'Assicurazioni', 'Affitti', 'Pulizie', 'Vigilanza', 'Marketing digitale', 'Fiere ed eventi', 'Campionature', 'Smaltimento rifiuti', 'Certificazioni ISO', 'Collaudi', 'Laboratorio prove', 'Noleggi attrezzature', 'Cancelleria', 'Spese bancarie', 'Commissioni', 'Canoni leasing', 'Utenze acqua', 'Mensa aziendale', 'Sicurezza sul lavoro', 'Ricerca e sviluppo', 'Brevetti', 'Qualità fornitori', 'Audit interni'],
  en: ['Raw materials', 'Semi-finished goods', 'Packaging', 'Electricity', 'Natural gas', 'Plant maintenance', 'Spare parts', 'Inbound freight', 'Outbound freight', 'Warehouse logistics', 'Technical consulting', 'Legal fees', 'Software licenses', 'Hardware', 'Telephony', 'Training', 'Travel', 'Insurance', 'Rent', 'Cleaning', 'Security', 'Digital marketing', 'Trade fairs', 'Samples', 'Waste disposal', 'ISO certification', 'Testing', 'Test lab', 'Equipment rental', 'Stationery', 'Bank fees', 'Commissions', 'Lease payments', 'Water', 'Canteen', 'Health and safety', 'R&D', 'Patents', 'Supplier quality', 'Internal audit'],
};
const CDC = ['PRD', 'LOG', 'AMM', 'ICT', 'QUA', 'COM', 'R&S'];
const ALL_SHEETS = ['report', 'budget', 'mov', 'y2025', 'note'];
const PHONE_SHEETS = ['report', 'note'];
const isPhone = () => window.matchMedia('(max-width: 640px)').matches;
const sheetList = () => (isPhone() ? PHONE_SHEETS : ALL_SHEETS);

const NCOLS = 40;
const COLS = Array.from({ length: NCOLS }, (_, i) => (i < 26 ? '' : 'A') + String.fromCharCode(65 + (i % 26)));
const ROWS = 50;
// Disposizione del campo nel foglio Note.
// PC: comandi e riepilogo da N5, griglia avversaria da R5, propria da AD5 (si vedono scorrendo a destra).
// Telefono: tutto a partire dalla colonna B, griglie una sotto l'altra, senza scorrere a destra.
const LAYOUT = {
  pc: {
    opp: { col: 17, title: 3, head: 4, top: 5 },
    me: { col: 29, title: 3, head: 4, top: 5 },
    cmds: { col: 13, row: 5, vertical: true },
    status: 'N11', hint: 'N12', flash: 'N13',
    area: { c0: 13, r0: 3, c1: 39, r1: 16 },
    sq: { col: 17, title: 3, head: 4, top: 5, hint: 'N12', flash: 'N13' },
    textWidth: 280,
    gameColsFrom: 15, // da P in poi colonne strette
  },
  phone: {
    status: 'B1',
    opp: { col: 1, title: 2, head: 3, top: 4 },
    cmds: { col: 1, row: 14, vertical: false },
    me: { col: 1, title: 16, head: 17, top: 18 },
    hint: 'B28', flash: 'B29',
    area: { c0: 0, r0: 1, c1: 11, r1: 29 },
    sq: { col: 1, title: 2, head: 3, top: 4, hint: 'B16', flash: 'B17' },
    textWidth: 320,
    gameColsFrom: 0,
  },
};
const layout = () => (isPhone() ? LAYOUT.phone : LAYOUT.pc);

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
  const items = (ITEMS[lang] || ITEMS.it).slice(0, isPhone() ? 10 : undefined);
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
  if (isPhone()) return cells; // sul telefono il foglio Note mostra subito il campo
  set('A1', s.noteTitle, 'title');
  s.notes.forEach((n, i) => set(`A${3 + i}`, n, 'muted-strong'));
  return cells;
}

function buildSheets() {
  const s = S();
  const all = {
    report: () => reportSheet(20261124, s.reportTitle),
    budget: () => reportSheet(20270101, s.budgetTitle),
    mov: () => movSheet(20261101),
    y2025: () => reportSheet(20251231, s.y2025Title),
    note: () => noteSheet(),
  };
  return Object.fromEntries(sheetList().map((k) => [k, all[k]()]));
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
let clockText = '';

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

/** Tempo rimasto del turno, aggiunto al testo di stato nel foglio Note. */
export function setClock(text) {
  if (text === clockText) return;
  clockText = text;
  if (!active || current !== 'note' || !hooks) return;
  const span = td(layout().status)?.querySelector('.g-text');
  if (span) span.textContent = span.title = statusLine();
}

const statusLine = () => (hooks.status() || '') + (clockText ? ' · ' + clockText : '');

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
    <div class="xl-title"><img class="xl-logo" src="/favicon.svg" alt="" title="P2P"><span class="xl-qa">💾 ↶ ↷</span><span class="xl-file">${s.file}</span><span class="xl-saved">· ${s.saved}</span><span class="xl-search">🔍 ${s.search}</span><span class="xl-tool" data-mode-toggle role="button">${document.documentElement.dataset.mode === 'dark' ? '☀' : '☾'}</span></div>
    <div class="xl-menu">${s.menu.map((m, i) => (i === 0 ? `<span data-file-menu>${m}</span>` : `<span${i === 1 ? ' class="on"' : ''}>${m}</span>`)).join('')}</div>
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
    <div class="xl-tabs" id="xl-tabs"><span class="nav">◀ ▶</span>${sheetList().map((k) => `<span data-sheet="${k}">${s.tabs[k]}</span>`).join('')}<span>+</span></div>
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
  if (!sheetList().includes(current)) current = 'report';
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
  const narrow = isPhone();
  const W = { 'c-std': 92, 'c-wide': narrow ? 150 : 190, 'c-game': narrow ? 28 : 24 };
  const rowh = narrow ? 30 : 40;
  let total = rowh;
  const parts = [`<colgroup><col style="width:${rowh}px">`];
  const L = layout();
  for (let c = 0; c < NCOLS; c++) {
    let cls = 'c-std';
    if (key !== 'note' && c === 1) cls = 'c-wide';
    if (key === 'mov' && (c === 2 || c === 3)) cls = 'c-wide';
    if (key === 'note' && (narrow ? c <= 10 : c >= L.gameColsFrom)) cls = 'c-game';
    // PC, foglio Note: colonne N e O più larghe per comandi e riepilogo
    const w = key === 'note' && !narrow && (c === 13 || c === 14) ? 130 : W[cls];
    total += w;
    parts.push(`<col style="width:${w}px">`);
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
  const a = layout().area;
  return c >= a.c0 && c <= a.c1 && r >= a.r0 && r <= a.r1;
}

// "Ricomincia" chiede conferma: il primo tocco cambia la scritta, il secondo (entro 4 s) conferma.
let confirmUntil = 0;

function paintGame() {
  if (!hooks || !built || current !== 'note') return;
  const state = hooks.getState();
  const s = S();
  const L = layout();
  // Pulisce l'area di gioco
  for (let r = L.area.r0; r <= L.area.r1; r++) {
    for (let c = L.area.c0; c <= L.area.c1; c++) {
      const cell = td(refOf(c, r));
      if (!cell) continue;
      const sel = cell.classList.contains('sel');
      cell.textContent = '';
      cell.className = sel ? 'sel' : '';
      delete cell.dataset.cmd;
      delete cell.dataset.gx;
      delete cell.dataset.sq;
    }
  }
  const put = (c, r, text, cls = '', extra = {}) => {
    const cell = td(refOf(c, r));
    if (!cell) return null;
    cell.textContent = text;
    if (cls) cell.classList.add(...cls.split(' ').filter(Boolean));
    Object.assign(cell.dataset, extra);
    return cell;
  };
  const putText = (ref, text, cls = '') => {
    const { c, r } = parseRef(ref);
    const cell = put(c, r, '', 'g-status ' + cls);
    if (!cell) return;
    const span = document.createElement('span');
    span.className = 'g-text';
    span.style.width = L.textWidth + 'px';
    span.textContent = text;
    span.title = text;
    cell.appendChild(span);
  };
  const LET = 'ABCDEFGHIJ';
  const drawBoard = (b, title, cellMarks, side, clickable) => {
    put(b.col, b.title, title, 'g-title');
    for (let x = 0; x < 10; x++) put(b.col + x, b.head, LET[x], 'g-head');
    for (let y = 0; y < 10; y++) {
      put(b.col - 1, b.top + y, String(y + 1), 'g-head');
      for (let x = 0; x < 10; x++) put(b.col + x, b.top + y, '', 'g-sea' + (clickable ? ' g-click' : ''), { gx: `${side}:${x}:${y}` });
    }
    for (const [x, y, cls] of cellMarks) {
      const cell = td(refOf(b.col + x, b.top + y));
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
  putText(L.status, statusLine(), state?.myTurn ? 'g-turn' : '');
  if (!state) return;
  const squares = BoardUI.isBoardKind(state.kind);
  const placing = hooks.isPlacing();
  if (squares) {
    drawSquares(state, put, L.sq);
  } else {
    const { mine, theirs } = hooks.marks();
    drawBoard(L.opp, state.opponent ? state.opponent.name : '—', theirs, 'opp', hooks.canFire());
    drawBoard(L.me, s.you, mine, 'me', placing);
  }

  // Comandi
  const cmds = [];
  if (placing) {
    cmds.push(['random', s.cmdRandom], ['rotate', s.cmdRotate + (hooks.dir() === 'h' ? ' ↔' : ' ↕')], ['clear', s.cmdClear], ['ready', s.cmdReady, 'g-primary']);
  } else if (state.phase === 'finished') {
    cmds.push(['rematch', state.solo ? s.cmdRematch : s.cmdNew, 'g-primary']);
  }
  const confirming = Date.now() < confirmUntil;
  cmds.push(['restart', confirming ? s.cmdSure : s.cmdRestart, confirming ? 'g-danger' : '']);
  if (L.cmds.vertical) {
    cmds.forEach(([cmd, label, cls = ''], i) => put(L.cmds.col, L.cmds.row + i, label, 'g-cmd ' + cls, { cmd }));
  } else {
    // Telefono: tutti i comandi in una riga, come piccoli pulsanti dentro una cella
    const cell = put(L.cmds.col, L.cmds.row, '', 'g-cmdbar');
    const bar = document.createElement('span');
    bar.className = 'g-bar';
    for (const [cmd, label, cls = ''] of cmds) {
      const b = document.createElement('span');
      b.className = 'g-btn ' + cls;
      b.dataset.cmd = cmd;
      b.textContent = label;
      bar.appendChild(b);
    }
    cell.appendChild(bar);
  }
  if (placing) putText(L.hint, document.getElementById('placement-hint')?.textContent || '');
  if (squares) putText(L.sq.hint, document.getElementById('sq-last')?.textContent || '');
  if (lastFlash) putText(squares ? L.sq.flash : L.flash, lastFlash, 'muted');
}

/** Scacchiera 8x8 nel foglio: lettere dei pezzi (scacchi) o o/x (dama), dal lato del giocatore. */
function drawSquares(state, put, b) {
  const picker = hooks.picker;
  const flip = BoardUI.flipped(state);
  const targets = new Set(picker.targets(state));
  const movable = picker.movable(state);
  const last = state.lastMove ? new Set([state.lastMove.from, state.lastMove.to]) : new Set();
  const check = state.kind === 'scacchi' && state.check ? state.board.indexOf(state.turn + 'K') : -1;
  const clickable = !!state.myTurn;
  put(b.col, b.title, state.opponent ? state.opponent.name : '—', 'g-title');
  for (let col = 0; col < 8; col++) put(b.col + col, b.head, BoardUI.FILES[flip ? 7 - col : col].toUpperCase(), 'g-head');
  for (let row = 0; row < 8; row++) {
    const r = flip ? row : 7 - row;
    put(b.col - 1, b.top + row, String(r + 1), 'g-head');
    for (let col = 0; col < 8; col++) {
      const f = flip ? 7 - col : col;
      const i = r * 8 + f;
      const p = state.board[i];
      const color = !p ? null : state.kind === 'scacchi' ? p[0] : p.toLowerCase();
      const cls = ['g-sq'];
      if (BoardUI.isDark(state.kind, i)) cls.push('g-dark');
      if (color) cls.push(color === state.color ? 'g-own' : 'g-opp');
      if (last.has(i)) cls.push('g-last');
      if (targets.has(i)) cls.push('g-target');
      if (picker.sel === i) cls.push('g-selsq');
      if (i === check) cls.push('g-check');
      if (clickable && (movable.has(i) || targets.has(i))) cls.push('g-click');
      put(b.col + col, b.top + row, BoardUI.cellText(state.kind, p), cls.join(' '), { sq: String(i) });
    }
  }
}

function runCmd(cmd) {
  if (cmd === 'restart') {
    if (Date.now() < confirmUntil) {
      confirmUntil = 0;
      hooks.actions.restart?.();
    } else {
      confirmUntil = Date.now() + 4000;
      setTimeout(paintGame, 4100);
    }
    paintGame();
    return;
  }
  hooks.actions[cmd]?.();
}

function onGridClick(e) {
  const cell = e.target.closest('td');
  if (!cell) return;
  if (editing && editing.input === e.target) return;
  const ref = cell.dataset.ref;
  select(ref, false);
  if (!hooks || current !== 'note') return;
  const cmd = e.target.closest('[data-cmd]')?.dataset.cmd;
  if (cmd) {
    runCmd(cmd);
    return;
  }
  if (cell.dataset.sq) {
    hooks.onSquare(Number(cell.dataset.sq));
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

// Se si passa da telefono a PC (o si ruota lo schermo oltre la soglia) il foglio si ricostruisce.
window.matchMedia('(max-width: 640px)').addEventListener?.('change', () => {
  if (!built) return;
  if (!sheetList().includes(current)) current = 'report';
  rebuild();
});

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
