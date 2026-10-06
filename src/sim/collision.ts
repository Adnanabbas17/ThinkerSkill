import type { Box, Room } from '../content/testRoom';
import type { Vec2 } from './types';

/**
 * Longest distance a circle moves before collisions are resolved again.
 * Must stay below (smallest obstacle half extent + smallest radius) so fast
 * movers can never skip past an obstacle's middle.
 */
export const MAX_SUBSTEP = 0.2;

/** Push a circle out of a box. Returns the push normal, or null if not touching. */
export function resolveCircleBox(pos: Vec2, r: number, b: Box): Vec2 | null {
  const cx = Math.min(Math.max(pos.x, b.x - b.hw), b.x + b.hw);
  const cy = Math.min(Math.max(pos.y, b.y - b.hh), b.y + b.hh);
  const dx = pos.x - cx;
  const dy = pos.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;

  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const n = { x: dx / d, y: dy / d };
    pos.x = cx + n.x * r;
    pos.y = cy + n.y * r;
    return n;
  }

  // Centre inside the box: leave through the nearest face.
  const pushes = [
    { d: b.x + b.hw - pos.x, n: { x: 1, y: 0 } },
    { d: pos.x - (b.x - b.hw), n: { x: -1, y: 0 } },
    { d: b.y + b.hh - pos.y, n: { x: 0, y: 1 } },
    { d: pos.y - (b.y - b.hh), n: { x: 0, y: -1 } },
  ];
  pushes.sort((a, c) => a.d - c.d);
  const { d, n } = pushes[0];
  pos.x += n.x * (d + r);
  pos.y += n.y * (d + r);
  return n;
}

/** Keep a circle inside the room walls. Returns the normals of walls touched. */
export function clampToRoom(pos: Vec2, r: number, room: Room, out: Vec2[]): void {
  if (pos.x < room.minX + r) { pos.x = room.minX + r; out.push({ x: 1, y: 0 }); }
  if (pos.x > room.maxX - r) { pos.x = room.maxX - r; out.push({ x: -1, y: 0 }); }
  if (pos.y < room.minY + r) { pos.y = room.minY + r; out.push({ x: 0, y: 1 }); }
  if (pos.y > room.maxY - r) { pos.y = room.maxY - r; out.push({ x: 0, y: -1 }); }
}

/**
 * Move a circle by `delta` in sub-steps of at most MAX_SUBSTEP, resolving
 * walls and obstacles after each one. Returns the normals of everything hit.
 */
export function moveCircle(pos: Vec2, delta: Vec2, r: number, room: Room): Vec2[] {
  const hits: Vec2[] = [];
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / MAX_SUBSTEP));
  const sx = delta.x / steps;
  const sy = delta.y / steps;
  for (let i = 0; i < steps; i++) {
    pos.x += sx;
    pos.y += sy;
    for (const b of room.obstacles) {
      const n = resolveCircleBox(pos, r, b);
      if (n) hits.push(n);
    }
    clampToRoom(pos, r, room, hits);
  }
  return hits;
}

/** Remove the part of `vel` that points into any of the surfaces (slide along them). */
export function slide(vel: Vec2, normals: Vec2[]): void {
  for (const n of normals) {
    const into = vel.x * n.x + vel.y * n.y;
    if (into < 0) {
      vel.x -= n.x * into;
      vel.y -= n.y * into;
    }
  }
}
