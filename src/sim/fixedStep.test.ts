import { describe, expect, it } from 'vitest';
import { advanceClock, MAX_STEPS_PER_FRAME, SIM_DT } from './fixedStep';

describe('advanceClock', () => {
  it('runs one tick per 1/60 s and carries the remainder', () => {
    const r = advanceClock(0, SIM_DT * 2.5);
    expect(r.steps).toBe(2);
    expect(r.alpha).toBeCloseTo(0.5);
  });

  it('accumulates short frames until a tick is due', () => {
    let acc = 0;
    let total = 0;
    for (let i = 0; i < 120; i++) {
      const r = advanceClock(acc, 1 / 120);
      acc = r.acc;
      total += r.steps;
    }
    expect(total).toBeGreaterThanOrEqual(59);
    expect(total).toBeLessThanOrEqual(60);
  });

  it('caps catch-up after a long stall and drops the rest', () => {
    const r = advanceClock(0, 3);
    expect(r.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(r.acc).toBeLessThan(SIM_DT);
    expect(r.alpha).toBeGreaterThanOrEqual(0);
    expect(r.alpha).toBeLessThan(1);
  });

  it('ignores negative frame times', () => {
    expect(advanceClock(0, -1).steps).toBe(0);
  });
});
