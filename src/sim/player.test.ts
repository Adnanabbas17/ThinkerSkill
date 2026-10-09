import { describe, expect, it } from 'vitest';
import { cloneDefaults } from '../tuning/tuning';
import { SIM_DT } from './fixedStep';
import { createSim, stepSim } from './sim';
import { emptyRoom, idle, input } from './testUtils';
import { len } from './vec';

const room = emptyRoom();
const t = cloneDefaults();

const run = (ticks: number, inp = idle(), s = createSim(room, 1), tuning = t) => {
  for (let i = 0; i < ticks; i++) stepSim(s, inp, tuning, room);
  return s;
};

describe('movement', () => {
  it('accelerates to move speed and no further', () => {
    const s = run(60, input({ x: 1, y: 0 }));
    expect(s.player.vel.x).toBeCloseTo(t.moveSpeed);
    expect(s.player.vel.y).toBe(0);
  });

  it('reaches top speed after moveSpeed / moveAccel seconds', () => {
    const ticks = Math.ceil(t.moveSpeed / t.moveAccel / SIM_DT);
    expect(run(ticks - 1, input({ x: 1, y: 0 })).player.vel.x).toBeLessThan(t.moveSpeed);
    expect(run(ticks, input({ x: 1, y: 0 })).player.vel.x).toBeCloseTo(t.moveSpeed);
  });

  it('is not faster diagonally', () => {
    const d = Math.SQRT1_2;
    const s = run(60, input({ x: d, y: d }));
    expect(len(s.player.vel)).toBeCloseTo(t.moveSpeed);
  });

  it('decelerates to a stop when keys are released', () => {
    const s = run(60, input({ x: 0, y: -1 }));
    run(Math.ceil(t.moveSpeed / t.moveDecel / SIM_DT), idle(), s);
    expect(s.player.vel).toEqual({ x: 0, y: 0 });
  });

  it('keeps prevPos as the position before the tick (for interpolation)', () => {
    const s = run(10, input({ x: 1, y: 0 }));
    const before = { ...s.player.pos };
    stepSim(s, input({ x: 1, y: 0 }), t, room);
    expect(s.player.prevPos).toEqual(before);
  });

  it('turns the aim towards the aim point', () => {
    const s = run(1, idle({ x: 3, y: 4 }));
    expect(s.player.aimDir.x).toBeCloseTo(0.6);
    expect(s.player.aimDir.y).toBeCloseTo(0.8);
  });
});

describe('run', () => {
  const walk = input({ x: 1, y: 0 });
  const running = input({ x: 1, y: 0 }, { run: true });

  it('holding run accelerates to moveSpeed * runSpeedMultiplier (11.2 m/s by default)', () => {
    expect(t.runSpeedMultiplier).toBe(1.6);
    const s = run(60, running);
    expect(s.player.vel.x).toBeCloseTo(t.moveSpeed * t.runSpeedMultiplier);
    expect(s.player.vel.x).toBeCloseTo(11.2);
  });

  it('releasing run returns to normal speed, and pressing it again speeds up again', () => {
    const s = createSim(room, 1);
    s.player.pos = { x: -14, y: 0 }; // room to run without reaching the wall
    run(60, running, s);
    run(30, walk, s);
    expect(s.player.vel.x).toBeCloseTo(t.moveSpeed);
    run(30, running, s);
    expect(s.player.vel.x).toBeCloseTo(t.moveSpeed * t.runSpeedMultiplier);
  });

  it('run does nothing without a movement key', () => {
    const s = run(60, { ...idle(), run: true });
    expect(s.player.vel).toEqual({ x: 0, y: 0 });
    expect(s.player.pos).toEqual({ x: 0, y: 0 });
  });

  it('a diagonal is still normalised: running diagonally is not faster than running straight', () => {
    const s = run(60, input({ x: 1, y: 1 }, { run: true }));
    expect(len(s.player.vel)).toBeCloseTo(t.moveSpeed * t.runSpeedMultiplier);
  });

  it('runSpeedMultiplier is live: 1 means no boost, 2 doubles the speed', () => {
    expect(run(60, running, createSim(room, 1), { ...t, runSpeedMultiplier: 1 }).player.vel.x).toBeCloseTo(t.moveSpeed);
    expect(run(60, running, createSim(room, 1), { ...t, runSpeedMultiplier: 2 }).player.vel.x).toBeCloseTo(t.moveSpeed * 2);
  });

  it('covers more ground in the same time than walking', () => {
    const from = (inp: typeof walk) => {
      const s = createSim(room, 1);
      s.player.pos = { x: -14, y: 0 };
      return run(45, inp, s).player.pos.x + 14;
    };
    expect(from(running) / from(walk)).toBeGreaterThan(1.4);
  });

  it('does not change aiming or firing, and emits no dash event', () => {
    const s = createSim(room, 1);
    const events: string[] = [];
    for (let i = 0; i < 30; i++) {
      stepSim(s, input({ x: 0, y: 1 }, { run: true, fire: true, aim: { x: 1000, y: 0 } }), t, room);
      events.push(...s.events.map((e) => e.type));
    }
    expect(s.player.aimDir.x).toBeCloseTo(1, 1);
    expect(events.filter((e) => e === 'fire').length).toBeGreaterThan(0);
    expect(events).not.toContain('dash');
    expect(s.shots[0].dir.x).toBeGreaterThan(0.9);
  });

  it('there is no dash left: no dash tuning values or player fields', () => {
    expect(Object.keys(t).filter((k) => k.toLowerCase().includes('dash'))).toEqual([]);
    expect(Object.keys(createSim(room, 1).player).filter((k) => k.toLowerCase().includes('dash'))).toEqual([]);
  });
});
