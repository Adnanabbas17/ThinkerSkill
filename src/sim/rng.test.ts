import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

const take = (seed: number, n: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('createRng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(12345, 100)).toEqual(take(12345, 100));
  });

  it('gives different sequences for different seeds', () => {
    expect(take(1, 20)).not.toEqual(take(2, 20));
  });

  it('returns floats in [0, 1)', () => {
    for (const v of take(42, 10_000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('returns integers within the inclusive range', () => {
    const rng = createRng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 1_000; i++) {
      const v = rng.int(1, 3);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(3);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
});
