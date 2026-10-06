import { describe, expect, it } from 'vitest';
import type { Wave } from '../content/testWaves';
import { cloneDefaults } from '../tuning/tuning';
import { SIM_DT } from './fixedStep';
import { createSim, stepSim } from './sim';
import { emptyRoom, idle } from './testUtils';
import type { SimState } from './types';
import { SPAWN_MIN_DIST } from './waves';

const t = cloneDefaults();
const room = emptyRoom();
const waves: Wave[] = [
  { count: 2, delay: 1, interval: 0.5 },
  { count: 3, delay: 1, interval: 0.5 },
];
const killAll = (s: SimState) => {
  for (const e of s.enemies) e.dead = true;
  s.enemies = [];
};

describe('waves', () => {
  it('start the first wave on the first tick and spawn after its delay', () => {
    const s = createSim(room, 1, waves);
    stepSim(s, idle(), t, room);
    expect(s.events).toContainEqual({ type: 'waveStart', wave: 0 });
    for (let i = 0; i < Math.round(1 / SIM_DT) - 1; i++) stepSim(s, idle(), t, room);
    expect(s.enemies).toHaveLength(0);
    stepSim(s, idle(), t, room);
    expect(s.enemies).toHaveLength(1);
    for (let i = 0; i < Math.round(0.5 / SIM_DT); i++) stepSim(s, idle(), t, room);
    expect(s.enemies).toHaveLength(2);
  });

  it('spawn at least SPAWN_MIN_DIST from the player', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createSim(room, seed, waves);
      s.player.pos = { x: 11, y: -7 }; // next to one spawn point
      while (s.enemies.length === 0) stepSim(s, idle(), { ...t, playerHp: 99 }, room);
      const e = s.enemies[0].pos;
      expect(Math.hypot(e.x - s.player.pos.x, e.y - s.player.pos.y)).toBeGreaterThan(SPAWN_MIN_DIST - 0.5);
    }
  });

  it('do not advance until every enemy of the wave is dead', () => {
    const s = createSim(room, 1, waves);
    const tuning = { ...t, playerHp: 99 };
    for (let i = 0; i < 600; i++) stepSim(s, idle(), tuning, room);
    expect(s.wave.index).toBe(0);
    killAll(s);
    stepSim(s, idle(), tuning, room);
    expect(s.wave.index).toBe(1);
    expect(s.events).toContainEqual({ type: 'waveStart', wave: 1 });
  });

  it('clear the room after the last wave', () => {
    const s = createSim(room, 1, waves);
    const tuning = { ...t, playerHp: 99, enemySpawnTime: 2 };
    const events: string[] = [];
    for (let i = 0; i < 60 * 30 && s.status === 'playing'; i++) {
      stepSim(s, idle(), tuning, room);
      events.push(...s.events.map((e) => e.type));
      if (s.wave.toSpawn === 0) killAll(s);
    }
    expect(s.status).toBe('won');
    expect(events.filter((e) => e === 'enemySpawn')).toHaveLength(5);
    expect(events).toContain('roomCleared');
  });

  it('spawn in the same places for the same seed, and differ across seeds', () => {
    const spawns = (seed: number) => {
      const s = createSim(room, seed, waves);
      for (let i = 0; i < 120; i++) stepSim(s, idle(), t, room);
      return JSON.stringify(s.enemies.map((e) => e.pos));
    };
    expect(spawns(3)).toBe(spawns(3));
    const all = new Set([1, 2, 3, 4, 5, 6].map(spawns));
    expect(all.size).toBeGreaterThan(1);
  });

  it('with no waves the room is a sandbox: never won or lost', () => {
    const s = createSim(room, 1);
    for (let i = 0; i < 600; i++) stepSim(s, idle(), t, room);
    expect(s.status).toBe('playing');
    expect(s.enemies).toEqual([]);
  });
});
