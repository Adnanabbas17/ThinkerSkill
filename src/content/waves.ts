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
}

export const endlessRules: EndlessRules = {
  firstSpawn: 1.5,
  startInterval: 3,
  endInterval: 1,
  rampSeconds: 300,
  maxAlive: 20,
};
