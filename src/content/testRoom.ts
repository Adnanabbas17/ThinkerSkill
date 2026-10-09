// Milestone 1 test room. Sim plane units are metres: x to the right, y towards the camera.

export interface Box {
  /** Centre. */
  x: number;
  y: number;
  /** Half extents. */
  hw: number;
  hh: number;
}

export type CoreId = 'A' | 'B' | 'C';

export interface CoreDef {
  id: CoreId;
  /** Solid pillar; also listed in the room's obstacles. */
  box: Box;
  /** Relative chance that a core-bound enemy picks this core at spawn. */
  targetWeight: number;
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
  /** Reactor cores to defend. None in the test room, so it can never be lost by cores. */
  cores: CoreDef[];
  /** Pairs of cores that leak damage into each other (see spreadThreshold). None in the test room. */
  coreLinks: [CoreId, CoreId][];
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
    // Cover between the top spawn and the centre: two walls with a 2.5 m lane, so enemies
    // pinned head-on at a single long wall cannot jam there.
    { x: -2.25, y: -5.5, hw: 1, hh: 0.5 },
    { x: 2.25, y: -5.5, hw: 1, hh: 0.5 },
    // Small blocks: in front of the side spawns and near the bottom corners.
    { x: -10, y: 2, hw: 1, hh: 1 },
    { x: 10, y: 2, hw: 1, hh: 1 },
    { x: -10, y: 6.5, hw: 1, hh: 0.75 },
    { x: 10, y: 6.5, hw: 1, hh: 0.75 },
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
  cores: [],
  coreLinks: [],
};
