import { describe, expect, it } from 'vitest';
import type { CoreDef, CoreId } from '../content/testRoom';
import { cloneDefaults } from '../tuning/tuning';
import { CORE_MAX_INTEGRITY } from './cores';
import { ENEMY_RADIUS, spawnEnemy } from './enemies';
import { createSim, stepSim } from './sim';
import { emptyRoom, idle } from './testUtils';
import type { SimEvent, SimState } from './types';

// Enemies stand still (speed 0) so contact is exact; spawn warning off unless a test wants it.
const t = { ...cloneDefaults(), enemySpeed: 0, enemySpawnTime: 0, contactDamage: 0 };

const core = (id: CoreId, x: number, y: number): CoreDef => ({ id, box: { x, y, hw: 0.8, hh: 0.8 }, targetWeight: 1 });
const threeCores = [core('A', -10, -6), core('B', -10, 6), core('C', 10, 6)];
const roomWith = (cores: CoreDef[]) => emptyRoom({ cores, obstacles: cores.map((c) => c.box) });

/** An enemy standing against the west face of a core. */
const touching = (c: CoreDef, dy = 0) => ({ x: c.box.x - c.box.hw - ENEMY_RADIUS, y: c.box.y + dy });

function run(s: SimState, ticks: number, tuning = t, room = roomWith(threeCores)): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    stepSim(s, idle(), tuning, room);
    all.push(...s.events);
  }
  return all;
}

describe('cores', () => {
  it('start at full integrity, one per room core', () => {
    const s = createSim(roomWith(threeCores), 1);
    expect(s.cores.map((c) => [c.id, c.integrity, c.lost])).toEqual([
      ['A', CORE_MAX_INTEGRITY, false],
      ['B', CORE_MAX_INTEGRITY, false],
      ['C', CORE_MAX_INTEGRITY, false],
    ]);
  });

  it('a touching enemy removes coreDamagePerSec per second and reports it', () => {
    const room = roomWith(threeCores);
    const s = createSim(room, 1);
    spawnEnemy(s, touching(threeCores[0]), t);
    const events = run(s, 60, t, room);
    expect(s.cores[0].integrity).toBeCloseTo(CORE_MAX_INTEGRITY - t.coreDamagePerSec, 6);
    expect(s.cores[1].integrity).toBe(CORE_MAX_INTEGRITY);
    const dmg = events.filter((e) => e.type === 'coreDamaged');
    expect(dmg).toHaveLength(60);
    expect(dmg.every((e) => e.type === 'coreDamaged' && e.coreId === 'A' && e.cause === 'threat')).toBe(true);
    const total = dmg.reduce((sum, e) => sum + (e.type === 'coreDamaged' ? e.amount : 0), 0);
    expect(total).toBeCloseTo(t.coreDamagePerSec, 6);
  });

  it('two touching enemies deal double', () => {
    const room = roomWith(threeCores);
    const s = createSim(room, 1);
    spawnEnemy(s, touching(threeCores[0], -0.6), t);
    spawnEnemy(s, touching(threeCores[0], 0.6), t);
    run(s, 60, t, room);
    expect(s.cores[0].integrity).toBeCloseTo(CORE_MAX_INTEGRITY - 2 * t.coreDamagePerSec, 6);
  });

  it('no damage from an enemy 0.2 m away, or one still in its spawn warning', () => {
    const room = roomWith(threeCores);
    const s = createSim(room, 1);
    const p = touching(threeCores[0]);
    spawnEnemy(s, { x: p.x - 0.2, y: p.y }, t);
    spawnEnemy(s, touching(threeCores[1]), { ...t, enemySpawnTime: 2 });
    run(s, 60, t, room);
    expect(s.cores.map((c) => c.integrity)).toEqual([100, 100, 100]);
  });

  it('a core is lost at 0, reported once, and takes no more damage', () => {
    const room = roomWith(threeCores);
    const s = createSim(room, 1);
    const fast = { ...t, coreDamagePerSec: 50 };
    spawnEnemy(s, touching(threeCores[0]), fast);
    const events = run(s, 180, fast, room);
    expect(s.cores[0]).toMatchObject({ integrity: 0, lost: true });
    expect(events.filter((e) => e.type === 'coreLost')).toEqual([{ type: 'coreLost', coreId: 'A' }]);
    const lostAt = events.findIndex((e) => e.type === 'coreLost');
    expect(events.slice(lostAt).some((e) => e.type === 'coreDamaged')).toBe(false);
    const total = events.reduce((sum, e) => sum + (e.type === 'coreDamaged' ? e.amount : 0), 0);
    expect(total).toBeCloseTo(CORE_MAX_INTEGRITY, 6);
    expect(s.status).toBe('playing');
  });

  it('the run is lost when all 3 cores are lost, and not before', () => {
    const room = roomWith(threeCores);
    const s = createSim(room, 1);
    const fast = { ...t, coreDamagePerSec: 50 };
    spawnEnemy(s, touching(threeCores[0]), fast);
    spawnEnemy(s, touching(threeCores[1]), fast);
    let events = run(s, 180, fast, room);
    expect(s.cores.map((c) => c.lost)).toEqual([true, true, false]);
    expect(s.status).toBe('playing');
    expect(events.some((e) => e.type === 'allCoresLost')).toBe(false);

    spawnEnemy(s, touching(threeCores[2]), fast);
    events = run(s, 180, fast, room);
    expect(s.status).toBe('lost');
    expect(s.lostReason).toBe('coresLost');
    expect(events.filter((e) => e.type === 'allCoresLost')).toHaveLength(1);
  });

  it('a room without cores is never lost by cores', () => {
    const room = emptyRoom();
    const s = createSim(room, 1);
    expect(s.cores).toEqual([]);
    run(s, 120, t, room);
    expect(s.status).toBe('playing');
    expect(s.lostReason).toBe(null);
  });

  it('a destroyed hero is lost with reason "destroyed"', () => {
    const room = roomWith([]);
    const s = createSim(room, 1);
    const deadly = { ...cloneDefaults(), enemySpawnTime: 0, playerHp: 1 };
    spawnEnemy(s, { x: 0.5, y: 0 }, deadly);
    run(s, 10, deadly, room);
    expect(s.status).toBe('lost');
    expect(s.lostReason).toBe('destroyed');
  });
});
