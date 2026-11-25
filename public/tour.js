// "Come funziona": tour guidato in sovrimpressione. Oscura la pagina e lascia in risalto solo la parte spiegata.
import { t } from '/i18n.js';

const OFF_KEY = 'bn:tourOff';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const seen = (k) => { try { return sessionStorage.getItem(k) === '1'; } catch { return false; } };
const markSeen = (k) => { try { sessionStorage.setItem(k, '1'); } catch {} };

let root = null;
let steps = [];
let index = 0;
let onEnd = null;

export const isOpen = () => !!root;
export const isOff = () => get(OFF_KEY) === '1';

/** Elementi visibili di un passo (uno o più selettori: il riquadro li comprende tutti). */
function targets(step) {
  return step.targets
    .map((s) => document.querySelector(s))
    .filter((el) => el && el.offsetParent !== null && el.getClientRects().length);
}

function rectOf(els) {
  const rs = els.map((el) => el.getBoundingClientRect());
  const top = Math.min(...rs.map((r) => r.top));
  const left = Math.min(...rs.map((r) => r.left));
  const bottom = Math.max(...rs.map((r) => r.bottom));
  const right = Math.max(...rs.map((r) => r.right));
  return { top, left, width: right - left, height: bottom - top, bottom, right };
}

function build() {
  root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = `
    <div class="tour-hole"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div class="tour-top"><span class="tour-count"></span><button type="button" class="tour-x" data-act="close" title="${t('tourClose')}">✕</button></div>
      <h3 id="tour-title" class="tour-title"></h3>
      <p class="tour-text"></p>
      <div class="tour-nav">
        <button type="button" data-act="prev">${t('tourPrev')}</button>
        <button type="button" class="primary" data-act="next"></button>
      </div>
      <div class="tour-foot">
        <button type="button" class="tour-link" data-act="close">${t('tourClose')}</button>
        <button type="button" class="tour-link" data-act="never">${t('tourNever')}</button>
      </div>
    </div>`;
  root.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'prev') go(index - 1);
    else if (act === 'next') (index >= steps.length - 1 ? close() : go(index + 1));
    else if (act === 'close') close();
    else if (act === 'never') { set(OFF_KEY, '1'); close(); }
  });
  document.body.appendChild(root);
  addEventListener('resize', place);
  addEventListener('scroll', place, true);
}

function go(i) {
  index = Math.max(0, Math.min(steps.length - 1, i));
  const step = steps[index];
  const card = root.querySelector('.tour-card');
  root.querySelector('.tour-count').textContent = `${index + 1} / ${steps.length}`;
  root.querySelector('.tour-title').textContent = step.title;
  root.querySelector('.tour-text').textContent = step.text;
  root.querySelector('[data-act="prev"]').disabled = index === 0;
  root.querySelector('[data-act="next"]').textContent = index === steps.length - 1 ? t('tourDone') : t('tourNext');
  const els = targets(step);
  if (els[0]) {
    const r = rectOf(els);
    if (r.top < 70 || r.bottom > innerHeight - 20) els[0].scrollIntoView({ block: 'center' });
  }
  place();
  card.querySelector('[data-act="next"]').focus({ preventScroll: true });
}

/** Posiziona il "buco" sopra la parte spiegata e il riquadro sotto (o sopra se non c'è spazio). */
function place() {
  if (!root) return;
  const hole = root.querySelector('.tour-hole');
  const card = root.querySelector('.tour-card');
  const els = targets(steps[index]);
  const pad = 6;
  const vw = document.documentElement.clientWidth;
  const cw = Math.min(340, vw - 24);
  card.style.width = cw + 'px';
  if (!els.length) {
    // Niente da evidenziare: riquadro al centro, tutto oscurato.
    Object.assign(hole.style, { top: '50%', left: '50%', width: '0px', height: '0px' });
    Object.assign(card.style, { top: Math.max(12, (innerHeight - card.offsetHeight) / 2) + 'px', left: (vw - cw) / 2 + 'px' });
    return;
  }
  const r = rectOf(els);
  Object.assign(hole.style, {
    top: r.top - pad + 'px', left: r.left - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px',
  });
  const ch = card.offsetHeight;
  const below = r.bottom + pad + 12;
  const above = r.top - pad - 12 - ch;
  let top;
  if (below + ch <= innerHeight - 8) top = below;
  else if (above >= 8) top = above;
  else top = Math.max(8, innerHeight - ch - 8); // bersaglio molto alto: riquadro in fondo allo schermo
  const left = Math.min(Math.max(12, r.left + r.width / 2 - cw / 2), vw - cw - 12);
  Object.assign(card.style, { top: top + 'px', left: left + 'px' });
}

function onKey(e) {
  if (!root) return;
  const k = e.key;
  if (k === 'Escape') close();
  else if (k === 'ArrowRight') (index >= steps.length - 1 ? close() : go(index + 1));
  else if (k === 'ArrowLeft') go(index - 1);
  else if (k === ' ' || e.code === 'Space') {
    // Niente modalità discreta durante il tour: Spazio preme il pulsante del tour che ha il focus.
    const btn = e.target.closest?.('.tour button');
    if (btn && !e.repeat) btn.click();
  }
  else return;
  e.preventDefault();
  e.stopImmediatePropagation();
}
addEventListener('keydown', onKey, true);

export function close() {
  if (!root) return;
  removeEventListener('resize', place);
  removeEventListener('scroll', place, true);
  root.remove();
  root = null;
  const cb = onEnd;
  onEnd = null;
  cb?.();
}

/**
 * Avvia un tour. `name` serve a non riproporlo più volte nella stessa sessione del browser.
 * Con `force` parte comunque (voce "Come funziona" del menu File).
 */
export function start(name, list, { force = false, end } = {}) {
  if (!force && (isOff() || seen('bn:tour-' + name))) return false;
  const usable = list.filter((s) => !s.targets.length || targets(s).length);
  if (!usable.length) return false;
  markSeen('bn:tour-' + name);
  if (root) close();
  steps = usable;
  onEnd = end;
  build();
  go(0);
  return true;
}
