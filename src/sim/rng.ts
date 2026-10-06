/**
 * Seeded pseudo-random generator (mulberry32).
 * Same seed always gives the same sequence, so sim runs are reproducible.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
}

/** One mulberry32 step: the next state and a float in [0, 1). */
export function mulberry32(state: number): { state: number; value: number } {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { state, value: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    const r = mulberry32(state);
    state = r.state;
    return r.value;
  };

  const int = (min: number, max: number): number =>
    min + Math.floor(next() * (max - min + 1));

  return { next, int };
}
