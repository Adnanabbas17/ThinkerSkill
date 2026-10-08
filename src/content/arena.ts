// The v1 arena (Milestone 2 plan, "Arena layout", Proposal A). Sim plane units are metres:
// x to the right, y towards the camera. Positions are centres; Box sizes are half extents.

import { testRoom, type Box, type CoreDef, type Room } from './testRoom';

export type { CoreDef, CoreId } from './testRoom';
export type SourceRoomId = 'N' | 'S' | 'W' | 'E';

export interface SourceRoomDef {
  id: SourceRoomId;
  /** Outer footprint. Sealed (door shut) until slice 5, so the whole footprint is solid. */
  box: Box;
  /** The 2 m door gap in the wall facing the arena centre. Data only until slice 5. */
  door: Box;
}

export interface Arena extends Room {
  kind: 'arena';
  sourceRooms: SourceRoomDef[];
  covers: Box[];
  console: Box;
  /** Where the hero stands to flip breakers 1, 2, 3 (north face of the console). Data only. */
  breakers: { x: number; y: number }[];
  /** Clue terminal floor pads. Data only until slice 6. */
  terminals: { x: number; y: number }[];
  /** Flat floor letters, non-blocking. */
  floorLabels: { text: string; x: number; y: number }[];
  /** Thickness of the source room walls (sets the interior a hero could stand in). */
  roomWallThickness: number;
}

/** Every solid thing in an arena, with what it is. Collision uses exactly these boxes. */
export type SolidKind = 'room' | 'cover' | 'console' | 'core';

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, hw: w / 2, hh: h / 2 });

const cores: CoreDef[] = [
  { id: 'A', box: box(-8, -12.5, 1.6, 1.6) },
  { id: 'B', box: box(-16, 12.5, 1.6, 1.6) },
  { id: 'C', box: box(16, 12.5, 1.6, 1.6) },
];

const sourceRooms: SourceRoomDef[] = [
  { id: 'N', box: box(0, -13.75, 7, 4.5), door: box(0, -11.5, 2, 0.5) },
  { id: 'S', box: box(0, 13.75, 7, 4.5), door: box(0, 11.5, 2, 0.5) },
  { id: 'W', box: box(-17.75, 0, 4.5, 7), door: box(-15.5, 0, 0.5, 2) },
  { id: 'E', box: box(17.75, 0, 4.5, 7), door: box(15.5, 0, 0.5, 2) },
];

const covers: Box[] = [
  box(-8, -5, 3, 1),
  box(8, -5, 3, 1),
  box(-8, 5, 3, 1),
  box(8, 5, 3, 1),
  box(-13, -9.5, 2, 1.5),
  box(13, -9.5, 2, 1.5),
  box(-9, 11, 2, 1.5),
  box(9, 11, 2, 1.5),
];

const consoleBox = box(0, 4, 5, 0.6);

/** Solids in a fixed order, tagged with their kind. The arena's obstacles are exactly these boxes. */
function solids(): { kind: SolidKind; box: Box }[] {
  return [
    ...sourceRooms.map((r) => ({ kind: 'room' as const, box: r.box })),
    ...covers.map((b) => ({ kind: 'cover' as const, box: b })),
    { kind: 'console' as const, box: consoleBox },
    ...cores.map((c) => ({ kind: 'core' as const, box: c.box })),
  ];
}

export const arena: Arena = {
  kind: 'arena',
  minX: -20,
  maxX: 20,
  minY: -16,
  maxY: 16,
  obstacles: solids().map((s) => s.box),
  playerStart: { x: 0, y: 0 },
  playerRadius: 0.5,
  // Spawn vents V1-V8.
  spawnPoints: [
    { x: -18, y: -14 },
    { x: 18, y: -14 },
    { x: -18, y: -7 },
    { x: 18, y: -7 },
    { x: -18, y: 7 },
    { x: 18, y: 7 },
    { x: -8, y: 14 },
    { x: 8, y: 14 },
  ],
  cores,
  sourceRooms,
  covers,
  console: consoleBox,
  breakers: [
    { x: -1.5, y: 3.7 },
    { x: 0, y: 3.7 },
    { x: 1.5, y: 3.7 },
  ],
  terminals: [
    { x: -13, y: -13.5 },
    { x: 13, y: -13.5 },
    { x: -11, y: 1.5 },
    { x: 11, y: 1.5 },
    { x: -12, y: 8 },
    { x: 12, y: 8 },
  ],
  // N/S/W/E room labels arrive with the rooms' rules in slice 5.
  floorLabels: [
    { text: 'A', x: -8, y: -10 },
    { text: 'B', x: -13.5, y: 12.5 },
    { text: 'C', x: 13.5, y: 12.5 },
  ],
  roomWallThickness: 0.5,
};

export function isArena(room: Room): room is Arena {
  return (room as Partial<Arena>).kind === 'arena';
}

/**
 * What to draw for each obstacle, one entry per obstacle in the same order. The renderer draws
 * every entry, so everything that collides is visible (tested in arena.test.ts).
 */
export function solidParts(room: Room): { kind: SolidKind; box: Box }[] {
  if (!isArena(room)) return room.obstacles.map((b) => ({ kind: 'cover' as const, box: b }));
  return solids();
}

/** `?room=test` keeps the Milestone 1 test room; anything else loads the arena. */
export function chooseRoom(search: string): Room {
  return new URLSearchParams(search).get('room') === 'test' ? testRoom : arena;
}
