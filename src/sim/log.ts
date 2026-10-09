import type { LoggedEvent, SimEvent } from './types';

/** Repeated damage to one core from one cause and threat type is merged into one entry per second. */
export const LOG_MERGE_TICKS = 60;

type CoreDamaged = Extract<SimEvent, { type: 'coreDamaged' }>;

/** What a damage entry is merged by (besides the core): the cause and its enemy type or leaking core. */
const damageSource = (e: CoreDamaged) => (e.cause === 'threat' ? `threat:${e.threatType}` : `spread:${e.fromCoreId}`);

/** The open `coreDamaged` entry (started less than LOG_MERGE_TICKS ago) that `e` continues, if any. */
function openDamageEntry(log: LoggedEvent[], tick: number, e: CoreDamaged) {
  for (let i = log.length - 1; i >= 0 && tick - log[i].tick < LOG_MERGE_TICKS; i--) {
    const prev = log[i].event;
    if (prev.type === 'coreDamaged' && prev.coreId === e.coreId && damageSource(prev) === damageSource(e)) return prev;
  }
  return null;
}

/**
 * Append one tick's events to the run log, in order. `coreDamaged` fires every tick a core is under
 * attack, so it is merged per core, cause and source (enemy type, or the leaking core for spread) over
 * LOG_MERGE_TICKS: the entry keeps the tick it started on, its cause and source, and the summed amount. Everything else is logged
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
