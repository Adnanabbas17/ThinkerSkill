import { describe, expect, it } from 'vitest';
import type { CoreDef } from '../content/testRoom';
import { cloneDefaults } from '../tuning/tuning';
import { ENEMY_RADIUS, spawnEnemy } from './enemies';
import { appendToLog, LOG_MERGE_TICKS } from './log';
import { createSim, stepSim } from './sim';
import { emptyRoom, idle } from './testUtils';
import type { LoggedEvent, SimEvent } from './types';

const dmg = (coreId: 'A' | 'B', amount: number, threatType: 'crawler' = 'crawler'): SimEvent => ({
  type: 'coreDamaged', coreId, amount, cause: 'threat', threatType,
});

describe('run log (appendToLog)', () => {
  it('keeps events in order with their tick', () => {
    const log: LoggedEvent[] = [];
    appendToLog(log, 3, [{ type: 'fire' }, { type: 'dash' }]);
    appendToLog(log, 4, [{ type: 'waveStart', wave: 0 }]);
    expect(log.map((l) => [l.tick, l.event.type])).toEqual([[3, 'fire'], [3, 'dash'], [4, 'waveStart']]);
  });

  it('merges coreDamaged per core within a second, keeping cause and threat type', () => {
    const log: LoggedEvent[] = [];
    for (let tick = 0; tick < LOG_MERGE_TICKS; tick++) appendToLog(log, tick, [dmg('A', 0.5), dmg('B', 0.25)]);
    expect(log).toHaveLength(2);
    expect(log[0]).toEqual({ tick: 0, event: dmg('A', 0.5 * LOG_MERGE_TICKS) });
    expect(log[1].event).toMatchObject({ coreId: 'B', cause: 'threat', threatType: 'crawler' });
    expect((log[1].event as { amount: number }).amount).toBeCloseTo(0.25 * LOG_MERGE_TICKS);
  });

  it('starts a new entry after a second, and the total is exact', () => {
    const log: LoggedEvent[] = [];
    for (let tick = 0; tick < 150; tick++) appendToLog(log, tick, [dmg('A', 1)]);
    expect(log.map((l) => l.tick)).toEqual([0, 60, 120]);
    const total = log.reduce((sum, l) => sum + (l.event.type === 'coreDamaged' ? l.event.amount : 0), 0);
    expect(total).toBe(150);
  });

  it('does not merge different threat types or causes', () => {
    const log: LoggedEvent[] = [];
    appendToLog(log, 0, [dmg('A', 1)]);
    appendToLog(log, 1, [{ type: 'coreDamaged', coreId: 'A', amount: 1, cause: 'threat', threatType: 'other' as never }]);
    expect(log).toHaveLength(2);
  });

  it('copies events, so later changes to a tick event do not alter the log', () => {
    const log: LoggedEvent[] = [];
    const e = dmg('A', 1);
    appendToLog(log, 0, [e]);
    (e as { amount: number }).amount = 99;
    expect((log[0].event as { amount: number }).amount).toBe(1);
  });
});

describe('run log in the sim', () => {
  const core: CoreDef = { id: 'A', box: { x: -10, y: -6, hw: 0.8, hh: 0.8 }, targetWeight: 1 };
  const room = emptyRoom({ cores: [core], obstacles: [core.box] });
  const t = { ...cloneDefaults(), enemySpeed: 0, enemySpawnTime: 0, contactDamage: 0, coreDamagePerSec: 50 };

  it('records a run across ticks, merges core damage, and survives the end of the run', () => {
    const s = createSim(room, 1);
    spawnEnemy(s, { x: core.box.x - core.box.hw - ENEMY_RADIUS, y: core.box.y }, t);
    for (let i = 0; i < 300; i++) stepSim(s, idle(), t, room);
    expect(s.status).toBe('lost');
    const types = s.log.map((l) => l.event.type);
    expect(types[0]).toBe('coreDamaged'); // the test spawns the enemy outside a tick, so no spawn entry
    expect(types).toContain('coreLost');
    expect(types.at(-1)).toBe('allCoresLost');
    const ticks = s.log.map((l) => l.tick);
    expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
    const damage = s.log.filter((l) => l.event.type === 'coreDamaged');
    expect(damage.length).toBeLessThanOrEqual(3); // 2 s of clawing, merged per second
    const total = damage.reduce((sum, l) => sum + (l.event.type === 'coreDamaged' ? l.event.amount : 0), 0);
    expect(total).toBeCloseTo(100, 6);
    const n = s.log.length;
    for (let i = 0; i < 60; i++) stepSim(s, idle(), t, room); // after the end: nothing lost, nothing added
    expect(s.log).toHaveLength(n);
  });

  it('the damage event and its log entry carry the enemy type', () => {
    const s = createSim(room, 1);
    spawnEnemy(s, { x: core.box.x - core.box.hw - ENEMY_RADIUS, y: core.box.y }, t);
    stepSim(s, idle(), t, room);
    expect(s.events).toContainEqual(expect.objectContaining({ type: 'coreDamaged', threatType: 'crawler', cause: 'threat' }));
    expect(s.log.find((l) => l.event.type === 'coreDamaged')?.event).toMatchObject({ threatType: 'crawler' });
  });
});
