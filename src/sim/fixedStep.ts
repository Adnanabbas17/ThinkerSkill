/** Sim tick length: fixed 60 Hz. */
export const SIM_DT = 1 / 60;
/** Longest frame gap fed into the sim (e.g. after a stall). */
export const MAX_FRAME_DT = 0.25;
/** Most sim ticks run in one frame; time beyond this is dropped. */
export const MAX_STEPS_PER_FRAME = 5;

export interface ClockResult {
  steps: number;
  /** Leftover time carried to the next frame. */
  acc: number;
  /** Interpolation factor between the previous and current sim state, 0..1. */
  alpha: number;
}

export function advanceClock(acc: number, frameDt: number): ClockResult {
  acc += Math.min(Math.max(frameDt, 0), MAX_FRAME_DT);
  let steps = 0;
  while (acc >= SIM_DT && steps < MAX_STEPS_PER_FRAME) {
    acc -= SIM_DT;
    steps++;
  }
  // Catch-up cap reached: drop whole ticks we could not run, keep the fraction.
  if (acc >= SIM_DT) acc %= SIM_DT;
  return { steps, acc, alpha: acc / SIM_DT };
}
