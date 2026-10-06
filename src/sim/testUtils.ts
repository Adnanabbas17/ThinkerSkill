// Shared helpers for sim tests (no Three.js, no DOM).
import type { Box, Room } from '../content/testRoom';
import type { TickInput, Vec2 } from './types';

export const idle = (aim: Vec2 = { x: 0, y: -100 }): TickInput => ({ move: { x: 0, y: 0 }, aim, dash: false });

export const input = (move: Vec2, opts: Partial<TickInput> = {}): TickInput => ({
  move,
  aim: { x: 0, y: -100 },
  dash: false,
  ...opts,
});

/** Distance from a point to the nearest point of a box (0 when inside). */
export function distToBox(p: Vec2, b: Box): number {
  const dx = Math.max(Math.abs(p.x - b.x) - b.hw, 0);
  const dy = Math.max(Math.abs(p.y - b.y) - b.hh, 0);
  return Math.hypot(dx, dy);
}

export const emptyRoom = (overrides: Partial<Room> = {}): Room => ({
  minX: -15,
  maxX: 15,
  minY: -10,
  maxY: 10,
  obstacles: [],
  playerStart: { x: 0, y: 0 },
  playerRadius: 0.5,
  ...overrides,
});
