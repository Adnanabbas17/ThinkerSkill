import { describe, expect, it } from 'vitest';
import { arena, type CoreDef } from '../content/arena';
import { cloneDefaults } from '../tuning/tuning';
import { spawnEnemy, stepEnemies, touchingBox } from './enemies';
import { SIM_DT } from './fixedStep';
import { createSim } from './sim';

// Real steering (stepEnemies) in the real arena. The hero is parked inside sealed room N, where
// no enemy can reach it, so contact never interferes.
const t = { ...cloneDefaults(), enemySpawnTime: 0 };
const PARKED = { x: 0, y: -14 };
const SINGLE_LIMIT = 15; // s
const SINGLE_EXTRA = 4; // s over the straight-line walk
const GROUP_LIMIT = 20; // s

/** Seconds until each enemy first touches the core (Infinity if it never does within `limit`). */
function arrivalTimes(starts: { x: number; y: number }[], core: CoreDef, limit: number): number[] {
  const s = createSim(arena, 1);
  for (const p of starts) spawnEnemy(s, p, t, core.id);
  const times = starts.map(() => Infinity);
  for (let tick = 1; tick <= limit / SIM_DT; tick++) {
    s.player.pos = { ...PARKED };
    stepEnemies(s, t, arena);
    s.enemies.forEach((e, i) => {
      if (times[i] === Infinity && touchingBox(e.pos, core.box)) times[i] = tick * SIM_DT;
    });
    if (times.every((x) => x < Infinity)) break;
  }
  return times;
}

const straight = (p: { x: number; y: number }, core: CoreDef) => {
  const dx = Math.max(Math.abs(p.x - core.box.x) - core.box.hw, 0);
  const dy = Math.max(Math.abs(p.y - core.box.y) - core.box.hh, 0);
  return Math.hypot(dx, dy) / t.enemySpeed;
};

describe('arena navigation (real steering)', () => {
  for (const core of arena.cores) {
    for (const v of arena.spawnPoints) {
      const name = `vent (${v.x}, ${v.y}) to core ${core.id}`;

      it(`${name}: one enemy arrives in time, also from spawn jitter of 0.3 m`, () => {
        for (const [jx, jy] of [[0, 0], [0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]]) {
          const start = { x: v.x + jx, y: v.y + jy };
          const [time] = arrivalTimes([start], core, SINGLE_LIMIT);
          expect(time, `from ${start.x}, ${start.y}`).toBeLessThanOrEqual(SINGLE_LIMIT);
          expect(time - straight(start, core), `from ${start.x}, ${start.y}`).toBeLessThanOrEqual(SINGLE_EXTRA);
        }
      });

      it(`${name}: a group of 6 all arrive within ${GROUP_LIMIT} s`, () => {
        const starts = Array.from({ length: 6 }, (_, k) => ({ x: v.x + (k % 3) * 0.3 - 0.3, y: v.y + Math.floor(k / 3) * 0.3 }));
        const times = arrivalTimes(starts, core, GROUP_LIMIT);
        expect(Math.max(...times)).toBeLessThanOrEqual(GROUP_LIMIT);
      });
    }
  }
});
