import { describe, expect, it } from 'vitest';
import type { Wave } from '../content/testWaves';
import { cloneDefaults } from '../tuning/tuning';
import { SIM_DT } from './fixedStep';
import { createSim, stepSim } from './sim';
import { emptyRoom, idle } from './testUtils';
import type { SimState } from './types';
import { pickTarget, SPAWN_MIN_DIST } from './waves';
import type { CoreDef } from '../content/testRoom';

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

  describe('target choice', () => {
    const cores: CoreDef[] = (['A', 'B', 'C'] as const).map((id, i) => ({
      id,
      box: { x: -10 + i * 10, y: -6, hw: 0.8, hh: 0.8 },
      targetWeight: 1,
    }));
    const coreRoom = emptyRoom({ cores, obstacles: cores.map((c) => c.box) });
    const picks = (seed: number, n: number, tuning = t) => {
      const s = createSim(coreRoom, seed);
      return Array.from({ length: n }, () => pickTarget(s, tuning, coreRoom));
    };

    it('is seeded: same seed, same targets', () => {
      expect(picks(7, 50)).toEqual(picks(7, 50));
      expect(picks(7, 50)).not.toEqual(picks(8, 50));
    });

    it('sends about chasePlayerShare to the hero and splits the rest evenly over the cores', () => {
      const all = picks(1, 4000);
      const share = (v: string | null) => all.filter((x) => x === v).length / all.length;
      expect(share(null)).toBeCloseTo(t.chasePlayerShare, 1);
      for (const id of ['A', 'B', 'C']) expect(share(id)).toBeCloseTo((1 - t.chasePlayerShare) / 3, 1);
      expect(picks(1, 200, { ...t, chasePlayerShare: 0 })).not.toContain(null);
      expect(new Set(picks(1, 200, { ...t, chasePlayerShare: 1 }))).toEqual(new Set([null]));
    });

    it('never picks a lost core', () => {
      const s = createSim(coreRoom, 3);
      s.cores[1].lost = true;
      for (let i = 0; i < 300; i++) expect(pickTarget(s, t, coreRoom)).not.toBe('B');
    });

    it('a room without cores always chases the hero and uses no random numbers', () => {
      const s = createSim(room, 5);
      const before = s.rngState;
      for (let i = 0; i < 20; i++) expect(pickTarget(s, t, room)).toBe(null);
      expect(s.rngState).toBe(before);
    });

    it('wave spawns carry their target in the spawn event', () => {
      const s = createSim(coreRoom, 2, waves);
      let spawn = null;
      for (let i = 0; i < 120 && !spawn; i++) {
        stepSim(s, idle(), t, coreRoom);
        spawn = s.events.find((e) => e.type === 'enemySpawn') ?? null;
      }
      expect(spawn).not.toBe(null);
      expect(spawn).toHaveProperty('targetCoreId', s.enemies[0].targetCoreId);
    });
  });
});
