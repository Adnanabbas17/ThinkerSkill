import type { CoreId, Room } from '../content/testRoom';
import type { Tuning } from '../tuning/tuning';
import { touchingBox } from './enemies';
import { SIM_DT } from './fixedStep';
import type { CoreState, SimState, ThreatType } from './types';

export const CORE_MAX_INTEGRITY = 100;
/** `quiet` of a core that has not been damaged yet (a plain number keeps the state JSON-safe). */
export const NEVER_DAMAGED = 999;

export function createCores(room: Room): CoreState[] {
  return room.cores.map((c) => ({ id: c.id, integrity: CORE_MAX_INTEGRITY, lost: false, alarmArmed: true, quiet: NEVER_DAMAGED }));
}

/**
 * An alarm fires when a core goes from not damaged to damaged (threat or spread). After it fires
 * the core stays quiet until alarmRearmSeconds pass without any damage; damage in between keeps
 * resetting that wait, so a long attack raises one alarm, not a stream.
 */
function stepAlarm(s: SimState, t: Tuning, core: CoreState, damaged: boolean): void {
  if (damaged) {
    if (core.alarmArmed) {
      core.alarmArmed = false;
      s.events.push({ type: 'alarm', coreId: core.id, isFalse: false });
    }
    core.quiet = 0;
    return;
  }
  core.quiet = Math.min(NEVER_DAMAGED, core.quiet + SIM_DT);
  if (core.quiet + 1e-9 >= t.alarmRearmSeconds) core.alarmArmed = true;
}

function markIfLost(s: SimState, core: CoreState): void {
  if (core.lost || core.integrity > 1e-9) return;
  core.integrity = 0;
  core.lost = true;
  s.events.push({ type: 'coreLost', coreId: core.id });
}

/**
 * A core below spreadThreshold (and not lost) leaks spreadPerSec per second into its linked cores
 * that are still online, split equally. The leaking core loses nothing extra; a lost core leaks
 * nothing. Which cores leak is decided once per tick, after threat damage, so order never matters.
 */
function spreadDamage(s: SimState, t: Tuning, room: Room): void {
  if (room.coreLinks.length === 0 || t.spreadPerSec <= 0) return;
  const index = (id: CoreId) => room.cores.findIndex((c) => c.id === id);
  const leaking = s.cores.filter((c) => !c.lost && c.integrity < t.spreadThreshold);
  const onlineAtStart = new Set(s.cores.filter((c) => !c.lost).map((c) => c.id));
  for (const from of leaking) {
    const targets = room.coreLinks
      .flatMap(([a, b]) => (a === from.id ? [b] : b === from.id ? [a] : []))
      .filter((id) => onlineAtStart.has(id) && index(id) >= 0);
    if (targets.length === 0) continue;
    const share = (t.spreadPerSec * SIM_DT) / targets.length;
    for (const id of targets) {
      const target = s.cores[index(id)];
      const amount = Math.min(target.integrity, share);
      if (amount <= 0) continue;
      target.integrity -= amount;
      s.events.push({ type: 'coreDamaged', coreId: id, amount, cause: 'spread', fromCoreId: from.id });
      markIfLost(s, target);
    }
  }
}

/**
 * Every active enemy touching a core removes coreDamagePerSec integrity per second. A core at 0
 * is lost and takes no more damage. The run is lost when every core is lost (a room without
 * cores can never be lost this way).
 */
export function stepCores(s: SimState, t: Tuning, room: Room): void {
  if (s.status !== 'playing' || room.cores.length === 0) return;
  const before = s.cores.map((c) => ({ integrity: c.integrity, lost: c.lost }));
  room.cores.forEach((def, i) => {
    const core = s.cores[i];
    if (core.lost) return;
    const touching = new Map<ThreatType, number>();
    for (const e of s.enemies) {
      if (!e.dead && e.spawnTime <= 0 && touchingBox(e.pos, def.box)) touching.set(e.type, (touching.get(e.type) ?? 0) + 1);
    }
    let want = 0;
    for (const n of touching.values()) want += n * t.coreDamagePerSec * SIM_DT;
    const amount = Math.min(core.integrity, want);
    if (amount <= 0) return;
    core.integrity -= amount;
    // One event per threat type, sharing the (possibly capped) damage in proportion.
    for (const [threatType, n] of touching) {
      const share = (n * t.coreDamagePerSec * SIM_DT * amount) / want;
      s.events.push({ type: 'coreDamaged', coreId: core.id, amount: share, cause: 'threat', threatType });
    }
    markIfLost(s, core);
  });
  spreadDamage(s, t, room);
  s.cores.forEach((core, i) => {
    if (!before[i].lost) stepAlarm(s, t, core, core.integrity < before[i].integrity - 1e-12);
  });
  if (s.cores.every((c) => c.lost)) {
    s.status = 'lost';
    s.lostReason = 'coresLost';
    s.events.push({ type: 'allCoresLost' });
  }
}
