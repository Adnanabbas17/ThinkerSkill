import type { Vec2 } from './types';

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });
export const copy = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });
export const len = (v: Vec2): number => Math.hypot(v.x, v.y);
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

/** Unit vector, or null for a (near) zero vector. */
export function normalize(v: Vec2): Vec2 | null {
  const l = len(v);
  return l > 1e-9 ? { x: v.x / l, y: v.y / l } : null;
}
