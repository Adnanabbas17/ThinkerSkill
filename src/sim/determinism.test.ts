import { describe, expect, it } from 'vitest';
import { testRoom } from '../content/testRoom';
import { testWaves } from '../content/testWaves';
import { cloneDefaults } from '../tuning/tuning';
import { createRng } from './rng';
import { createSim, stepSim } from './sim';
import type { TickInput } from './types';

/** A recorded input sequence: random but reproducible keyboard/mouse activity. */
function recordInputs(seed: number, ticks: number): TickInput[] {
  const rng = createRng(seed);
  const inputs: TickInput[] = [];
  let move = { x: 0, y: 0 };
  for (let i = 0; i < ticks; i++) {
    if (rng.next() < 0.05) move = { x: rng.int(-1, 1), y: rng.int(-1, 1) };
    const l = Math.hypot(move.x, move.y) || 1;
    inputs.push({
      move: { x: move.x / l, y: move.y / l },
      aim: { x: rng.next() * 30 - 15, y: rng.next() * 20 - 10 },
      run: rng.next() < 0.3,
      fire: rng.next() < 0.5,
    });
  }
  return inputs;
}

function play(seed: number, inputs: TickInput[]): string {
  const t = cloneDefaults();
  const s = createSim(testRoom, seed, testWaves);
  for (const inp of inputs) stepSim(s, inp, t, testRoom);
  return JSON.stringify(s);
}

describe('determinism', () => {
  it('same seed and same recorded inputs give an identical final state', () => {
    const inputs = recordInputs(99, 3600);
    expect(play(7, inputs)).toBe(play(7, structuredClone(inputs)));
  });

  it('the recorded run includes combat (shots, spawns, hits)', () => {
    const t = cloneDefaults();
    const s = createSim(testRoom, 7, testWaves);
    const seen = new Set<string>();
    for (const inp of recordInputs(99, 3600)) {
      stepSim(s, inp, t, testRoom);
      for (const e of s.events) seen.add(e.type);
    }
    for (const type of ['fire', 'enemySpawn', 'enemyHit']) expect(seen).toContain(type);
  });

  it('different inputs give a different final state (the test can fail)', () => {
    expect(play(7, recordInputs(1, 600))).not.toBe(play(7, recordInputs(2, 600)));
  });
});
