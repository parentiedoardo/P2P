// Eventi a tempo di un turno: promemoria (dopo 5 minuti), avviso di tempo in scadenza, tempo scaduto.
import { warnBeforeMs } from '../public/games/match.js';

/**
 * Eventi ancora da gestire per il turno in corso, in ordine di tempo.
 * `g.remindedFor` / `g.warnedFor` contengono l'inizio del turno per cui l'evento è già stato gestito.
 */
export function pendingEvents(g, reminderMs) {
  if (!g || g.phase !== 'playing' || !g.turnStartedAt) return [];
  const t0 = g.turnStartedAt;
  const out = [];
  const deadline = g.turnSeconds ? t0 + g.turnSeconds * 1000 : null;
  const warnAt = deadline ? deadline - warnBeforeMs(g.turnSeconds) : null;
  // Con il tempo attivo, il promemoria ha senso solo se arriva prima dell'avviso di scadenza
  // (altrimenti l'email parte insieme all'avviso).
  if (g.remindedFor !== t0 && (!deadline || t0 + reminderMs < warnAt)) out.push({ type: 'reminder', at: t0 + reminderMs });
  if (deadline) {
    if (g.warnedFor !== t0) out.push({ type: 'warn', at: Math.max(t0, warnAt) });
    out.push({ type: 'timeout', at: deadline });
  }
  return out.sort((a, b) => a.at - b.at);
}

export const nextAlarm = (g, reminderMs) => pendingEvents(g, reminderMs)[0]?.at ?? null;
