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

describe('dash', () => {
  it('moves dashSpeed * dashDuration in the move direction and emits an event', () => {
    const s = createSim(room, 1);
    stepSim(s, input({ x: 1, y: 0 }, { dash: true }), t, room);
    expect(s.events).toEqual([{ type: 'dash' }]);
    run(Math.ceil(t.dashDuration / SIM_DT) - 1, input({ x: 0, y: 0 }), s);
    expect(s.player.pos.x).toBeCloseTo(t.dashSpeed * t.dashDuration, 0);
    expect(s.player.pos.y).toBe(0);
  });

  it('dashes towards the aim when no move key is held', () => {
    const s = createSim(room, 1);
    stepSim(s, idle({ x: 0, y: 10 }), t, room);
    stepSim(s, idle({ x: 0, y: 10 }), t, room);
    stepSim(s, { ...idle({ x: 0, y: 10 }), dash: true }, t, room);
    expect(s.player.dashDir).toEqual({ x: 0, y: 1 });
    expect(s.player.vel.y).toBeCloseTo(t.dashSpeed);
  });

  it('with a cooldown set, cannot dash again until it ends', () => {
    const tc = { ...t, dashCooldown: 0.8 };
    const s = createSim(room, 1);
    const dash = input({ x: 1, y: 0 }, { dash: true });
    stepSim(s, dash, tc, room);
    const cooldownTicks = Math.round(tc.dashCooldown / SIM_DT);
    for (let i = 1; i < cooldownTicks; i++) {
      stepSim(s, dash, tc, room);
      expect(s.events).toEqual([]);
    }
    stepSim(s, dash, tc, room);
    expect(s.events).toEqual([{ type: 'dash' }]);
  });

  it('with no cooldown (default), holding dash chains dashes back to back', () => {
    expect(t.dashCooldown).toBe(0);
    const s = createSim(room, 1);
    const dash = input({ x: 1, y: 0 }, { dash: true });
    let dashes = 0;
    for (let i = 0; i < 30; i++) { // 10 m: stays clear of the wall at x = 15
      stepSim(s, dash, t, room);
      dashes += s.events.filter((e) => e.type === 'dash').length;
      expect(s.player.vel.x, `tick ${i}`).toBeCloseTo(t.dashSpeed); // never drops to walking speed
    }
    expect(dashes).toBeGreaterThanOrEqual(3);
  });

  it('gives no invulnerability with dashInvuln = 0 (default)', () => {
    const s = createSim(room, 1);
    stepSim(s, input({ x: 1, y: 0 }, { dash: true }), t, room);
    expect(s.player.invulnTime).toBe(0);
  });

  it('gives dashInvuln seconds of invulnerability when set', () => {
    const s = createSim(room, 1);
    stepSim(s, input({ x: 1, y: 0 }, { dash: true }), { ...t, dashInvuln: 0.2 }, room);
    expect(s.player.invulnTime).toBeCloseTo(0.2);
  });
});
