import { describe, expect, it } from 'vitest';
import { cloneDefaults, maxTuning } from '../tuning/tuning';
import { spawnEnemy } from './enemies';
import { SIM_DT } from './fixedStep';
import { createSim, stepSim } from './sim';
import { emptyRoom, idle } from './testUtils';
import type { TickInput } from './types';

const t = { ...cloneDefaults(), enemySpawnTime: 0 };
const room = emptyRoom();
const shoot = (aim = { x: 10, y: 0 }): TickInput => ({ ...idle(aim), fire: true });

describe('firing', () => {
  it('fires at fireRate while held, from the drone towards the aim', () => {
    const s = createSim(room, 1);
    let shots = 0;
    for (let i = 0; i < 60; i++) {
      stepSim(s, shoot(), t, room);
      shots += s.events.filter((e) => e.type === 'fire').length;
    }
    expect(shots).toBe(t.fireRate);
    expect(s.shots[0].dir.x).toBeCloseTo(1);
  });

  it('fires nothing when not held', () => {
    const s = createSim(room, 1);
    for (let i = 0; i < 30; i++) stepSim(s, idle(), t, room);
    expect(s.shots).toEqual([]);
  });

  it('shots travel at shotSpeed', () => {
    const s = createSim(room, 1);
    stepSim(s, shoot(), t, room);
    const x0 = s.shots[0].pos.x;
    stepSim(s, idle({ x: 10, y: 0 }), t, room);
    expect(s.shots[0].pos.x - x0).toBeCloseTo(t.shotSpeed * SIM_DT);
  });

  it('a shot stops at a wall and reports where', () => {
    const s = createSim(room, 1);
    stepSim(s, shoot(), t, room);
    let blocked = null;
    for (let i = 0; i < 120 && s.shots.length; i++) {
      stepSim(s, idle(), t, room);
      blocked ??= s.events.find((e) => e.type === 'shotBlocked') ?? null;
    }
    expect(s.shots).toEqual([]);
    expect(blocked).not.toBeNull();
  });

  it('a shot never passes a thin 0.2 m wall, even at max shot speed', () => {
    const wall = { x: 3, y: 0, hw: 0.1, hh: 5 };
    const thin = emptyRoom({ obstacles: [wall] });
    for (const tuning of [maxTuning(), { ...maxTuning(), shotSpeed: 200 }]) {
      const s = createSim(thin, 1);
      for (let i = 0; i < 120; i++) {
        stepSim(s, shoot({ x: 10, y: (i % 7) - 3 }), tuning, thin);
        for (const sh of s.shots) expect(sh.pos.x).toBeLessThan(wall.x);
      }
    }
  });
});

describe('hitting enemies', () => {
  it('damages, flashes and knocks back the enemy, and the shot is used up', () => {
    const s = createSim(room, 1);
    spawnEnemy(s, { x: 4, y: 0 }, t);
    stepSim(s, shoot(), t, room);
    let hit = false;
    for (let i = 0; i < 20 && !hit; i++) {
      stepSim(s, idle(), t, room);
      hit = s.events.some((e) => e.type === 'enemyHit');
    }
    expect(hit).toBe(true);
    const e = s.enemies[0];
    expect(e.damage).toBe(t.shotDamage);
    // The hit tick itself counts towards the flash.
    expect(e.flash).toBeCloseTo(t.hitFlash - SIM_DT);
    expect(e.vel.x).toBeGreaterThan(0); // pushed away from the shooter
    expect(s.shots).toEqual([]);
  });

  it('kills the enemy after enemyHp damage', () => {
    const s = createSim(room, 1);
    spawnEnemy(s, { x: 4, y: 0 }, { ...t, enemySpeed: 0.5 });
    let killed = 0;
    for (let i = 0; i < 240 && s.enemies.length; i++) {
      stepSim(s, shoot({ x: s.enemies[0].pos.x, y: s.enemies[0].pos.y }), t, room);
      killed += s.events.filter((e) => e.type === 'enemyKilled').length;
    }
    expect(s.enemies).toEqual([]);
    expect(killed).toBe(1);
  });
});
