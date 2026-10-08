// Endless waves for the arena (Milestone 2 plan, section 2). Times in seconds, counts of enemies.
// Starting values only: slice 8 tunes them with the bots.

export interface EndlessRules {
  /** Seconds from the start of the run to the first spawn. */
  firstSpawn: number;
  /** Seconds between spawns at the start of the run. */
  startInterval: number;
  /** Seconds between spawns once fully escalated. */
  endInterval: number;
  /** Seconds over which the gap shrinks linearly from startInterval to endInterval. */
  rampSeconds: number;
  /** No new spawns while this many enemies are alive. */
  maxAlive: number;
  /** Onboarding ramp: what unlocks when, and the one-line hint shown for it. */
  ramp: RampStep[];
}

export type RampUnlock = 'crawler' | 'overheater' | 'relay' | 'sourceHunt' | 'disguise' | 'falseAlarms';

/**
 * One onboarding step. `at` is seconds into the run; null = the mechanic does not exist yet, so the
 * step never fires (the slice that builds it sets the time). Times are first proposals; slice 8 tunes them.
 */
export interface RampStep {
  unlock: RampUnlock;
  at: number | null;
  hint: string;
}

/** Text for a hint event. */
export function rampHint(unlock: RampUnlock): string {
  return defaultRamp.find((r) => r.unlock === unlock)?.hint ?? '';
}

/** Seconds a hint stays on screen. */
export const HINT_SECONDS = 6;

const defaultRamp: RampStep[] = [
  { unlock: 'crawler', at: 0, hint: 'Crawlers are attacking the cores. Shoot them (click) before a core is lost.' },
  { unlock: 'overheater', at: null, hint: 'Overheaters resist Pulse. Only Coolant (2) works.' }, // slice 3 (about 0:40)
  { unlock: 'relay', at: null, hint: 'Relays resist Pulse and Coolant. Only EMP (3) works.' }, // slice 3 (about 1:20)
  { unlock: 'sourceHunt', at: null, hint: "The waves won't stop until you shut down the source. Read terminals (E) to find it." }, // slices 5, 6 (about 2:00)
  { unlock: 'disguise', at: null, hint: 'Some threats hide their type. Hold E on one to scan it.' }, // slice 4 (about 2:45)
  { unlock: 'falseAlarms', at: null, hint: 'Alarms can be spoofed. Visit or scan a core to check it.' }, // slice 4 (about 3:30)
];

export const endlessRules: EndlessRules = {
  firstSpawn: 1.5,
  startInterval: 3,
  endInterval: 1,
  rampSeconds: 300,
  maxAlive: 20,
  ramp: defaultRamp,
};
