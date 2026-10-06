// Milestone 1 test room waves. Clear all of them to clear the room.

export interface Wave {
  /** Enemies in this wave. */
  count: number;
  /** Seconds from the wave starting to its first spawn. */
  delay: number;
  /** Seconds between spawns. */
  interval: number;
}

export const testWaves: Wave[] = [
  { count: 3, delay: 1.5, interval: 0.8 },
  { count: 5, delay: 2, interval: 0.7 },
  { count: 8, delay: 2, interval: 0.6 },
];
