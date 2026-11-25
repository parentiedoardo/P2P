// Cornice "foglio di calcolo" della pagina, menu File (resta aperto finché non lo si chiude) e modalità chiara/scura.

const $ = (id) => document.getElementById(id);
const COLS = Array.from({ length: 30 }, (_, i) => (i < 26 ? '' : 'A') + String.fromCharCode(65 + (i % 26)));

function store(k, v) { try { localStorage.setItem(k, v); } catch {} }

/** Intestazioni di righe e colonne della tabella di sfondo; altezza della cornice per allineare la griglia. */
function buildSheet() {
  $('sheet-cols').innerHTML = COLS.map((c) => `<span>${c}</span>`).join('');
  $('sheet-rows').innerHTML = Array.from({ length: 80 }, (_, i) => `<span>${i + 1}</span>`).join('');
  const measure = () => document.documentElement.style.setProperty('--shell-h', $('shell').offsetHeight + 'px');
  measure();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe($('shell'));
}

// ---------- Chiaro / scuro ----------
export function mode() {
  return document.documentElement.dataset.mode === 'dark' ? 'dark' : 'light';
}

export function setMode(m) {
  document.documentElement.dataset.mode = m === 'dark' ? 'dark' : 'light';
  store('bn:mode', mode());
  syncMode();
}

function syncMode() {
  const dark = mode() === 'dark';
  const btn = $('btn-mode');
  btn.textContent = dark ? '☀' : '☾';
  btn.setAttribute('aria-pressed', String(dark));
  for (const r of document.querySelectorAll('input[name="fp-mode"]')) r.checked = r.value === mode();
  for (const b of document.querySelectorAll('[data-mode-toggle]')) b.textContent = dark ? '☀' : '☾';
}

// ---------- Menu File ----------
let anchor = null;

export function isFileOpen() {
  return !$('file-panel').hidden;
}

export function openFile(from) {
  const panel = $('file-panel');
  anchor = from || document.querySelector('.shell [data-file-menu]');
  panel.hidden = false;
  const r = anchor?.getBoundingClientRect();
  if (r && r.height) {
    panel.style.top = Math.round(r.bottom + 2) + 'px';
    if (innerWidth > 640) panel.style.left = Math.max(8, Math.round(r.left)) + 'px';
  }
  markOpen(true);
}

export function closeFile() {
  $('file-panel').hidden = true;
  markOpen(false);
}

function markOpen(open) {
  for (const b of document.querySelectorAll('[data-file-menu]')) {
    b.setAttribute('aria-expanded', String(open));
    b.classList.toggle('open', open);
  }
}

export function toggleFile(from) {
  if (isFileOpen()) closeFile();
  else openFile(from);
}

export function init() {
  buildSheet();
  syncMode();
  $('btn-mode').addEventListener('click', (e) => { e.currentTarget.blur(); setMode(mode() === 'dark' ? 'light' : 'dark'); });
  for (const r of document.querySelectorAll('input[name="fp-mode"]')) r.addEventListener('change', () => setMode(r.value));
  // Il pulsante "File" si trova sia nella cornice sia nel foglio della modalità discreta (creato dopo): delega.
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-file-menu]');
    if (btn) { e.preventDefault(); toggleFile(btn); return; }
    const m = e.target.closest('[data-mode-toggle]');
    if (m) setMode(mode() === 'dark' ? 'light' : 'dark');
  });
  $('fp-close').addEventListener('click', closeFile);
  // Esc chiude il menu (prima di qualunque altra cosa, anche in modalità discreta)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isFileOpen()) { e.preventDefault(); e.stopImmediatePropagation(); closeFile(); }
  }, true);
}
