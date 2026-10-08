import type { LoggedEvent, SimEvent } from './types';

/** Repeated damage to one core from one cause and threat type is merged into one entry per second. */
export const LOG_MERGE_TICKS = 60;

/** The open `coreDamaged` entry (started less than LOG_MERGE_TICKS ago) that `e` continues, if any. */
function openDamageEntry(log: LoggedEvent[], tick: number, e: Extract<SimEvent, { type: 'coreDamaged' }>) {
  for (let i = log.length - 1; i >= 0 && tick - log[i].tick < LOG_MERGE_TICKS; i--) {
    const prev = log[i].event;
    if (prev.type === 'coreDamaged' && prev.coreId === e.coreId && prev.cause === e.cause && prev.threatType === e.threatType) return prev;
  }
  return null;
}

/**
 * Append one tick's events to the run log, in order. `coreDamaged` fires every tick a core is under
 * attack, so it is merged per core, cause and threat type over LOG_MERGE_TICKS: the entry keeps the
 * tick it started on, its cause and threat type, and the summed amount. Everything else is logged
 * as it happens.
 */
export function appendToLog(log: LoggedEvent[], tick: number, events: readonly SimEvent[]): void {
  for (const e of events) {
    if (e.type === 'coreDamaged') {
      const open = openDamageEntry(log, tick, e);
      if (open) {
        open.amount += e.amount;
        continue;
      }
    }
    log.push({ tick, event: { ...e } });
  }
}
