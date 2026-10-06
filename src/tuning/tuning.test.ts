import { describe, expect, it } from 'vitest';
import { defaultTuning, maxTuning, sanitizeTuning, tuningSpecs } from './tuning';

describe('tuning', () => {
  it('has a slider spec for every value, with the default inside its range', () => {
    const keys = Object.keys(defaultTuning).sort();
    expect(tuningSpecs.map((s) => s.key).sort()).toEqual(keys);
    for (const s of tuningSpecs) {
      expect(defaultTuning[s.key]).toBeGreaterThanOrEqual(s.min);
      expect(defaultTuning[s.key]).toBeLessThanOrEqual(s.max);
    }
  });

  it('sanitizes saved values: clamps, ignores unknown and non-numeric', () => {
    const t = sanitizeTuning({ moveSpeed: 999, dashSpeed: 'fast', bogus: 1, camFov: 60 });
    expect(t.moveSpeed).toBe(15);
    expect(t.dashSpeed).toBe(defaultTuning.dashSpeed);
    expect(t.camFov).toBe(60);
    expect('bogus' in t).toBe(false);
    expect(sanitizeTuning(null)).toEqual(defaultTuning);
  });

  it('maxTuning puts every value at its slider maximum', () => {
    const t = maxTuning();
    for (const s of tuningSpecs) expect(t[s.key]).toBe(s.max);
  });
});
