import type { Room } from '../content/testRoom';
import type { Tuning } from '../tuning/tuning';
import { touchingBox } from './enemies';
import { SIM_DT } from './fixedStep';
import type { CoreState, SimState } from './types';

export const CORE_MAX_INTEGRITY = 100;

export function createCores(room: Room): CoreState[] {
  return room.cores.map((c) => ({ id: c.id, integrity: CORE_MAX_INTEGRITY, lost: false }));
}

/**
 * Every active enemy touching a core removes coreDamagePerSec integrity per second. A core at 0
 * is lost and takes no more damage. The run is lost when every core is lost (a room without
 * cores can never be lost this way).
 */
export function stepCores(s: SimState, t: Tuning, room: Room): void {
  if (s.status !== 'playing' || room.cores.length === 0) return;
  room.cores.forEach((def, i) => {
    const core = s.cores[i];
    if (core.lost) return;
    let touching = 0;
    for (const e of s.enemies) if (!e.dead && e.spawnTime <= 0 && touchingBox(e.pos, def.box)) touching++;
    if (touching === 0) return;
    const amount = Math.min(core.integrity, touching * t.coreDamagePerSec * SIM_DT);
    if (amount <= 0) return;
    core.integrity -= amount;
    s.events.push({ type: 'coreDamaged', coreId: core.id, amount, cause: 'threat' });
    if (core.integrity <= 1e-9) {
      core.integrity = 0;
      core.lost = true;
      s.events.push({ type: 'coreLost', coreId: core.id });
    }
  });
  if (s.cores.every((c) => c.lost)) {
    s.status = 'lost';
    s.lostReason = 'coresLost';
    s.events.push({ type: 'allCoresLost' });
  }
}
