import { describe, expect, it } from 'vitest';
import { cloneDefaults } from '../tuning/tuning';
import { ENEMY_RADIUS, spawnEnemy } from './enemies';
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

  it('dash invulnerability blocks it', () => {
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
