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

describe('damage spread', () => {
  const linked = (cores: CoreDef[], links: [CoreId, CoreId][]) => ({ ...roomWith(cores), coreLinks: links });
  const allPairs: [CoreId, CoreId][] = [['A', 'B'], ['B', 'C'], ['A', 'C']];
  const room = linked(threeCores, allPairs);
  const spreadOnly = { ...t, spreadThreshold: 50, spreadPerSec: 2 };
  const integrities = (s: SimState) => s.cores.map((c) => c.integrity);
  const spreadEvents = (events: SimEvent[]) =>
    events.filter(
      (e): e is Extract<SimEvent, { type: 'coreDamaged'; cause: 'spread' }> => e.type === 'coreDamaged' && e.cause === 'spread',
    );

  it('does not start at or above the threshold, only strictly below it', () => {
    for (const a of [100, 50]) {
      const s = createSim(room, 1);
      s.cores[0].integrity = a;
      expect(spreadEvents(run(s, 120, spreadOnly, room))).toEqual([]);
      expect(integrities(s)).toEqual([a, 100, 100]);
    }
    const s = createSim(room, 1);
    s.cores[0].integrity = 49.9;
    expect(spreadEvents(run(s, 1, spreadOnly, room)).length).toBeGreaterThan(0);
  });

  it('a weak core leaks spreadPerSec per second into its online links, split equally', () => {
    const s = createSim(room, 1);
    s.cores[0].integrity = 40;
    const events = run(s, 60, spreadOnly, room);
    expect(s.cores[1].integrity).toBeCloseTo(100 - 1, 6); // 2 per second split over B and C
    expect(s.cores[2].integrity).toBeCloseTo(100 - 1, 6);
    expect(s.cores[0].integrity).toBe(40); // the leaking core loses nothing extra
    const ev = spreadEvents(events);
    expect(ev.every((e) => e.fromCoreId === 'A' && (e.coreId === 'B' || e.coreId === 'C'))).toBe(true);
    expect(ev.reduce((sum, e) => sum + e.amount, 0)).toBeCloseTo(2, 6);
  });

  it('only leaks into linked cores', () => {
    const chain = linked(threeCores, [['A', 'B']]);
    const s = createSim(chain, 1);
    s.cores[0].integrity = 40;
    run(s, 60, spreadOnly, chain);
    expect(s.cores[1].integrity).toBeCloseTo(98, 6); // all of A's 2 per second goes to B
    expect(s.cores[2].integrity).toBe(100);
  });

  it('a lost core leaks nothing and receives nothing', () => {
    const s = createSim(room, 1);
    s.cores[0].integrity = 0;
    s.cores[0].lost = true;
    s.cores[1].integrity = 30;
    run(s, 60, spreadOnly, room);
    expect(s.cores[0]).toMatchObject({ integrity: 0, lost: true });
    expect(s.cores[2].integrity).toBeCloseTo(98, 6); // B's whole leak goes to C, none to the lost A
    expect(s.cores[1].integrity).toBe(30);
  });

  it('two leaking cores add up on a shared target', () => {
    const s = createSim(room, 1);
    s.cores[0].integrity = 40;
    s.cores[1].integrity = 40;
    run(s, 60, spreadOnly, room);
    expect(s.cores[2].integrity).toBeCloseTo(100 - 1 - 1, 6); // 1 from A, 1 from B
  });

  it('stops when the weak core is back above the threshold (integrity set directly: there is no repair)', () => {
    const s = createSim(room, 1);
    s.cores[0].integrity = 40;
    run(s, 30, spreadOnly, room);
    const after = integrities(s);
    s.cores[0].integrity = 60;
    expect(spreadEvents(run(s, 60, spreadOnly, room))).toEqual([]);
    expect(integrities(s).slice(1)).toEqual(after.slice(1));
  });

  it('can take a linked core to 0: it is lost, with an event, and the run is lost once all are', () => {
    const s = createSim(room, 1);
    s.cores[0].integrity = 40;
    s.cores[1].integrity = 0.01;
    s.cores[2].integrity = 0.01;
    const events = run(s, 5, spreadOnly, room);
    expect(s.cores[1]).toMatchObject({ integrity: 0, lost: true });
    expect(s.cores[2]).toMatchObject({ integrity: 0, lost: true });
    expect(events.filter((e) => e.type === 'coreLost').map((e) => (e as { coreId: string }).coreId).sort()).toEqual(['B', 'C']);
    expect(s.status).toBe('playing'); // A is still online at 40
    s.cores[0].integrity = 0.001;
    s.cores[0].lost = false;
    run(s, 2, spreadOnly, room);
    expect(s.status).toBe('playing');
    s.cores[0].integrity = 0;
    s.cores[0].lost = true;
    run(s, 1, spreadOnly, room);
    expect(s.status).toBe('lost');
    expect(s.lostReason).toBe('coresLost');
  });

  it('spread damage is logged with cause "spread", merged per second per source core', () => {
    const s = createSim(room, 1);
    s.cores[0].integrity = 40;
    run(s, 120, spreadOnly, room);
    const entries = s.log.filter((l) => l.event.type === 'coreDamaged');
    expect(entries.length).toBe(4); // B and C, two seconds each
    for (const l of entries) expect(l.event).toMatchObject({ cause: 'spread', fromCoreId: 'A' });
    expect(entries.reduce((sum, l) => sum + (l.event as { amount: number }).amount, 0)).toBeCloseTo(4, 6);
  });

  it('threat damage and spread add up; spreadPerSec 0 turns spread off; rooms without links never spread', () => {
    const s = createSim(room, 1);
    s.cores[0].integrity = 40;
    run(s, 60, { ...spreadOnly, spreadPerSec: 0 }, room);
    expect(integrities(s)).toEqual([40, 100, 100]);
    const none = createSim(roomWith(threeCores), 1);
    none.cores[0].integrity = 40;
    run(none, 60, spreadOnly, roomWith(threeCores));
    expect(integrities(none)).toEqual([40, 100, 100]);
    const both = createSim(room, 1);
    both.cores[0].integrity = 100;
    spawnEnemy(both, touching(threeCores[0]), { ...spreadOnly, coreDamagePerSec: 20 });
    run(both, 4 * 60, { ...spreadOnly, coreDamagePerSec: 20 }, room); // A: 100 -> 20, leaks once below 50
    expect(both.cores[0].integrity).toBeLessThan(50);
    expect(both.cores[1].integrity).toBeLessThan(100);
  });

  it('is deterministic', () => {
    const play = () => {
      const s = createSim(room, 9);
      s.cores[0].integrity = 45;
      run(s, 300, spreadOnly, room);
      return JSON.stringify(s);
    };
    expect(play()).toBe(play());
  });
});
