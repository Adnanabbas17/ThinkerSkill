import type { Room } from '../content/testRoom';
import type { Tuning } from '../tuning/tuning';
import { ENEMY_RADIUS } from './enemies';
import { SIM_DT } from './fixedStep';
import type { CoreState, SimState } from './types';

export const CORE_MAX_INTEGRITY = 100;
/** An enemy this close to a core's box (beyond its own radius) counts as touching it. */
export const CORE_CONTACT_SLOP = 0.05;

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
    const b = def.box;
    let touching = 0;
    for (const e of s.enemies) {
      if (e.dead || e.spawnTime > 0) continue;
      const dx = Math.max(Math.abs(e.pos.x - b.x) - b.hw, 0);
      const dy = Math.max(Math.abs(e.pos.y - b.y) - b.hh, 0);
      if (Math.hypot(dx, dy) <= ENEMY_RADIUS + CORE_CONTACT_SLOP) touching++;
    }
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
