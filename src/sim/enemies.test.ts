import { describe, expect, it } from 'vitest';
import { cloneDefaults } from '../tuning/tuning';
import { testRoom, type CoreDef } from '../content/testRoom';
import { ENEMY_RADIUS, faceEndClosed, spawnEnemy, touchingBox } from './enemies';
import { SIM_DT } from './fixedStep';
import { createSim, stepSim } from './sim';
import { distToBox, emptyRoom, idle } from './testUtils';
import type { SimState } from './types';

const t = cloneDefaults();
const room = emptyRoom();
const run = (s: SimState, ticks: number, tuning = t, r = room) => {
  for (let i = 0; i < ticks; i++) stepSim(s, idle(), tuning, r);
};

describe('enemies', () => {
  it('wait out the spawn warning, then chase the player at enemySpeed', () => {
    const s = createSim(room, 1);
    spawnEnemy(s, { x: 10, y: 0 }, t);
    run(s, Math.floor(t.enemySpawnTime / SIM_DT) - 1);
    expect(s.enemies[0].pos.x).toBe(10);
    run(s, 60);
    expect(s.enemies[0].pos.x).toBeLessThan(10);
    expect(s.enemies[0].vel.x).toBeCloseTo(-t.enemySpeed);
  });

  it('do not overlap each other', () => {
    const s = createSim(room, 1);
    for (let i = 0; i < 6; i++) spawnEnemy(s, { x: 10, y: 0 }, t);
    run(s, 120);
    for (const a of s.enemies)
      for (const b of s.enemies)
        if (a !== b) expect(Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y)).toBeGreaterThan(ENEMY_RADIUS * 2 - 0.05);
  });

  it('get around a box they hit head-on instead of sticking to it', () => {
    const box = { x: 5, y: 0, hw: 1, hh: 1.5 };
    const r = emptyRoom({ obstacles: [box] });
    const s = createSim(r, 1);
    spawnEnemy(s, { x: 9, y: 0 }, { ...t, enemySpawnTime: 0 });
    const tuning = { ...t, contactDamage: 0 };
    let reached = false;
    for (let i = 0; i < 600 && !reached; i++) {
      stepSim(s, idle(), tuning, r);
      reached = s.enemies[0].pos.x < box.x - box.hw;
    }
    expect(reached).toBe(true);
  });

  it('pinned either side of a face centre slide apart, never towards each other', () => {
    // Box face at x = 6 spans y -1.5..1.5; the player is straight behind it at the origin.
    const box = { x: 5, y: 0, hw: 1, hh: 1.5 };
    const r = emptyRoom({ obstacles: [box] });
    const s = createSim(r, 1);
    const tuning = { ...t, enemySpawnTime: 0, contactDamage: 0 };
    spawnEnemy(s, { x: 6 + ENEMY_RADIUS, y: 0.5 }, tuning);
    spawnEnemy(s, { x: 6 + ENEMY_RADIUS, y: -0.5 }, tuning);
    const [upper, lower] = s.enemies;
    // First tick: both chase the player, hit the face and get pinned.
    stepSim(s, idle(), tuning, r);
    expect(upper.detourTime).toBeGreaterThan(0);
    expect(lower.detourTime).toBeGreaterThan(0);
    expect(upper.detourDir.y).toBe(1); // towards the face's nearer end (+y)
    expect(lower.detourDir.y).toBe(-1); // towards the other end (-y)
    let gap = upper.pos.y - lower.pos.y;
    for (let i = 0; i < 30; i++) {
      stepSim(s, idle(), tuning, r);
      const now = upper.pos.y - lower.pos.y;
      expect(now, `tick ${i}`).toBeGreaterThanOrEqual(gap - 1e-9);
      gap = now;
    }
    expect(upper.pos.y).toBeGreaterThan(1);
    expect(lower.pos.y).toBeLessThan(-1);
  });

  it('a single enemy pinned at a face centre gets around the box within 3 s', () => {
    const box = { x: 5, y: 0, hw: 1, hh: 1.5 };
    const r = emptyRoom({ obstacles: [box] });
    const s = createSim(r, 1);
    const tuning = { ...t, enemySpawnTime: 0, contactDamage: 0 };
    spawnEnemy(s, { x: 6 + ENEMY_RADIUS, y: 0 }, tuning);
    let around = false;
    for (let i = 0; i < 180 && !around; i++) {
      stepSim(s, idle(), tuning, r);
      around = s.enemies[0].pos.x < box.x - box.hw;
    }
    expect(around).toBe(true);
  });

  it('slide away from a face end that meets an outer wall, even when it is the nearer end', () => {
    // A box against the bottom wall: its left face (x = -2) runs from y = 6 down into the wall.
    // The enemy is pinned below the face centre, so the nearer end is the dead-end corner.
    const box = { x: 0, y: 8, hw: 2, hh: 2 };
    const r = emptyRoom({ obstacles: [box] });
    const s = createSim(r, 1);
    const tuning = { ...t, enemySpawnTime: 0, contactDamage: 0 };
    s.player.pos = { x: 6, y: 8.5 };
    spawnEnemy(s, { x: -2 - ENEMY_RADIUS, y: 8.5 }, tuning);
    stepSim(s, idle(), tuning, r);
    const e = s.enemies[0];
    expect(e.detourTime).toBeGreaterThan(0);
    expect(e.detourDir.y).toBe(-1); // up, towards the open end, not down into the corner
  });

  it('get around a box that meets an outer wall, within 6 s', () => {
    const box = { x: 0, y: 8, hw: 2, hh: 2 };
    const r = emptyRoom({ obstacles: [box] });
    const s = createSim(r, 1);
    const tuning = { ...t, enemySpawnTime: 0, contactDamage: 0 };
    spawnEnemy(s, { x: -6, y: 9 }, tuning);
    let passed = false;
    for (let i = 0; i < 360 && !passed; i++) {
      s.player.pos = { x: 6, y: 9 };
      stepSim(s, idle(), tuning, r);
      passed = s.enemies[0].pos.x > box.x + box.hw;
    }
    expect(passed).toBe(true);
  });

  it('test room: no box face has a closed end, so detours there are unchanged by the rule', () => {
    const normals = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    for (const b of testRoom.obstacles)
      for (const n of normals)
        for (const sign of [1, -1]) expect(faceEndClosed(b, n, sign, testRoom), `${b.x},${b.y}`).toBe(false);
  });

  it('stay out of walls and obstacles', () => {
    const box = { x: 4, y: 0, hw: 1, hh: 1 };
    const r = emptyRoom({ obstacles: [box] });
    const s = createSim(r, 1);
    for (let i = 0; i < 8; i++) spawnEnemy(s, { x: 8, y: 0 }, t);
    for (let i = 0; i < 300; i++) {
      stepSim(s, idle(), { ...t, contactDamage: 0 }, r);
      for (const e of s.enemies) expect(distToBox(e.pos, box)).toBeGreaterThanOrEqual(ENEMY_RADIUS - 1e-6);
    }
  });
});

describe('contact damage', () => {
  const touching = () => {
    const s = createSim(room, 1);
    spawnEnemy(s, { x: 0.9, y: 0 }, { ...t, enemySpawnTime: 0 });
    return s;
  };

  it('hurts and knocks back the player, then gives hurtInvuln seconds of safety', () => {
    const s = touching();
    stepSim(s, idle(), t, room);
    expect(s.events).toContainEqual({ type: 'playerHurt' });
    expect(s.player.damage).toBe(t.contactDamage);
    expect(s.player.invulnTime).toBeCloseTo(t.hurtInvuln);
    expect(s.player.vel.x).toBeLessThan(0); // pushed away from the enemy
    const ticks = Math.floor(t.hurtInvuln / SIM_DT) - 2;
    for (let i = 0; i < ticks; i++) {
      s.enemies[0].pos = { x: s.player.pos.x + 0.5, y: s.player.pos.y };
      stepSim(s, idle(), t, room);
      expect(s.player.damage).toBe(t.contactDamage);
    }
  });

  it('does nothing during the spawn warning', () => {
    const s = createSim(room, 1);
    spawnEnemy(s, { x: 0.9, y: 0 }, t);
    stepSim(s, idle(), t, room);
    expect(s.player.damage).toBe(0);
  });

  it('invulnerability blocks it', () => {
    const s = touching();
    s.player.invulnTime = 0.2;
    stepSim(s, idle(), t, room);
    expect(s.player.damage).toBe(0);
  });

  it('destroys the player at playerHp damage, and the sim then holds still', () => {
    const s = touching();
    const tuning = { ...t, playerHp: 2, hurtInvuln: 0 };
    const events: string[] = [];
    for (let i = 0; i < 120 && s.status === 'playing'; i++) {
      s.enemies[0].pos = { x: s.player.pos.x + 0.5, y: s.player.pos.y };
      stepSim(s, idle(), tuning, room);
      events.push(...s.events.map((e) => e.type));
    }
    expect(s.status).toBe('lost');
    expect(events.filter((e) => e === 'playerHurt')).toHaveLength(2);
    expect(events).toContain('playerDestroyed');
    const positions = () => JSON.stringify([s.player.pos, s.enemies.map((e) => e.pos)]);
    const frozen = positions();
    stepSim(s, { ...idle(), move: { x: 1, y: 0 }, fire: true }, tuning, room);
    expect(positions()).toBe(frozen);
    expect(s.shots).toEqual([]);
  });
});

describe('core targeting', () => {
  const coreA: CoreDef = { id: 'A', box: { x: -10, y: -6, hw: 0.8, hh: 0.8 }, targetWeight: 1 };
  const coreB: CoreDef = { id: 'B', box: { x: 10, y: -6, hw: 0.8, hh: 0.8 }, targetWeight: 1 };
  const coreRoom = emptyRoom({ cores: [coreA, coreB], obstacles: [coreA.box, coreB.box] });
  const tuning = { ...t, enemySpawnTime: 0 };
  const steps = (s: SimState, n: number) => {
    const types: string[] = [];
    for (let i = 0; i < n; i++) {
      stepSim(s, idle(), tuning, coreRoom);
      types.push(...s.events.map((e) => e.type));
    }
    return types;
  };

  it('a core attacker walks to its core, then stays against it instead of chasing the hero', () => {
    const s = createSim(coreRoom, 1);
    spawnEnemy(s, { x: -10, y: 6 }, tuning, 'A');
    steps(s, 5 * 60);
    const e = s.enemies[0];
    expect(touchingBox(e.pos, coreA.box)).toBe(true);
    const here = { ...e.pos };
    steps(s, 2 * 60);
    expect(touchingBox(e.pos, coreA.box)).toBe(true);
    expect(Math.hypot(e.pos.x - here.x, e.pos.y - here.y)).toBeLessThan(0.05);
    expect(s.cores[0].integrity).toBeLessThan(100);
  });

  it('ignores the hero, but still hurts the hero on contact on its way', () => {
    const s = createSim(coreRoom, 1);
    s.player.pos = { x: -10, y: 0 }; // standing on the enemy's path to core A
    spawnEnemy(s, { x: -10, y: 6 }, tuning, 'A');
    const types = steps(s, 3 * 60);
    expect(types).toContain('playerHurt');
    expect(s.enemies[0].targetCoreId).toBe('A');
    s.player.pos = { x: 5, y: 5 }; // step aside: it carries on to its core, not after the hero
    steps(s, 5 * 60);
    expect(touchingBox(s.enemies[0].pos, coreA.box)).toBe(true);
  });

  it('when its core is lost, switches to the nearest core still online', () => {
    const three: CoreDef = { id: 'C', box: { x: 10, y: 6, hw: 0.8, hh: 0.8 }, targetWeight: 1 };
    const room = emptyRoom({ cores: [coreA, coreB, three], obstacles: [coreA.box, coreB.box, three.box] });
    const s = createSim(room, 1);
    spawnEnemy(s, { x: 6, y: 4 }, tuning, 'A'); // nearer to C than to B
    s.cores[0].lost = true;
    stepSim(s, idle(), tuning, room);
    expect(s.enemies[0].targetCoreId).toBe('C');
    s.cores[2].lost = true;
    stepSim(s, idle(), tuning, room);
    expect(s.enemies[0].targetCoreId).toBe('B');
  });

  it('a hero chaser (no target core) still chases the hero in a room with cores', () => {
    const s = createSim(coreRoom, 1);
    spawnEnemy(s, { x: 0, y: 8 }, tuning);
    steps(s, 30);
    expect(s.enemies[0].vel.y).toBeLessThan(0); // towards the hero at the origin
    expect(s.enemies[0].targetCoreId).toBe(null);
  });
});
