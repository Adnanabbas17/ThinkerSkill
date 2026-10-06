// Milestone 1 test room. Sim plane units are metres: x to the right, y towards the camera.

export interface Box {
  /** Centre. */
  x: number;
  y: number;
  /** Half extents. */
  hw: number;
  hh: number;
}

export interface Room {
  /** Playable interior bounds (walls sit just outside). */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  obstacles: Box[];
  playerStart: { x: number; y: number };
  playerRadius: number;
  /** Where enemies appear. Keep each at least 1 m clear of walls and obstacles. */
  spawnPoints: { x: number; y: number }[];
}

export const testRoom: Room = {
  minX: -15,
  maxX: 15,
  minY: -10,
  maxY: 10,
  obstacles: [
    { x: -8, y: -4, hw: 1.5, hh: 1 },
    { x: 8, y: -4, hw: 1.5, hh: 1 },
    { x: -5, y: 4.5, hw: 1, hh: 1.5 },
    { x: 5, y: 4.5, hw: 1, hh: 1.5 },
  ],
  playerStart: { x: 0, y: 0 },
  playerRadius: 0.5,
  spawnPoints: [
    { x: -13, y: -8 },
    { x: 0, y: -8.5 },
    { x: 13, y: -8 },
    { x: -13.5, y: 0 },
    { x: 13.5, y: 0 },
    { x: -13, y: 8 },
    { x: 0, y: 8.5 },
    { x: 13, y: 8 },
  ],
};
