import { describe, expect, it } from 'vitest';
import { clampToRoom, moveCircle, resolveCircleBox, slide } from './collision';
import { emptyRoom, distToBox } from './testUtils';
import type { Vec2 } from './types';

const box = { x: 0, y: 0, hw: 1, hh: 1 };

describe('resolveCircleBox', () => {
  it.each([
    ['left', { x: -1.3, y: 0 }, { x: -1, y: 0 }],
    ['right', { x: 1.3, y: 0.2 }, { x: 1, y: 0 }],
    ['top', { x: 0.4, y: -1.2 }, { x: 0, y: -1 }],
    ['bottom', { x: -0.5, y: 1.4 }, { x: 0, y: 1 }],
  ])('pushes out of the %s face', (_name, start: Vec2, normal: Vec2) => {
    const pos = { ...start };
    const n = resolveCircleBox(pos, 0.5, box);
    expect(n).toEqual(normal);
    expect(distToBox(pos, box)).toBeCloseTo(0.5, 9);
  });

  it('pushes out diagonally at a corner', () => {
    const pos = { x: 1.2, y: 1.2 };
    const n = resolveCircleBox(pos, 0.5, box)!;
    expect(n.x).toBeCloseTo(Math.SQRT1_2);
    expect(n.y).toBeCloseTo(Math.SQRT1_2);
    expect(distToBox(pos, box)).toBeCloseTo(0.5, 9);
  });

  it('pushes a centre inside the box out through the nearest face', () => {
    const pos = { x: 0.8, y: 0.1 };
    expect(resolveCircleBox(pos, 0.5, box)).toEqual({ x: 1, y: 0 });
    expect(pos.x).toBeCloseTo(1.5);
  });

  it('ignores circles that do not touch', () => {
    const pos = { x: 2, y: 0 };
    expect(resolveCircleBox(pos, 0.5, box)).toBeNull();
    expect(pos).toEqual({ x: 2, y: 0 });
  });
});

describe('room walls', () => {
  it('clamps a circle inside every wall', () => {
    const room = emptyRoom();
    const pos = { x: 99, y: -99 };
    const hits: Vec2[] = [];
    clampToRoom(pos, 0.5, room, hits);
    expect(pos).toEqual({ x: 14.5, y: -9.5 });
    expect(hits).toHaveLength(2);
  });
});

describe('moveCircle and slide', () => {
  it('stops at an obstacle and keeps the sideways motion (slides)', () => {
    const room = emptyRoom({ obstacles: [{ x: 3, y: 0, hw: 1, hh: 5 }] });
    const pos = { x: 1, y: 0 };
    const vel = { x: 10, y: 5 };
    const hits = moveCircle(pos, { x: 2, y: 1 }, 0.5, room);
    slide(vel, hits);
    expect(pos.x).toBeCloseTo(1.5);
    expect(pos.y).toBeCloseTo(1);
    expect(vel).toEqual({ x: 0, y: 5 });
  });

  it('cannot cross an obstacle in one huge move (sub-steps)', () => {
    const room = emptyRoom({ obstacles: [{ x: 3, y: 0, hw: 0.5, hh: 5 }] });
    const pos = { x: 0, y: 0 };
    moveCircle(pos, { x: 10, y: 0 }, 0.45, room);
    expect(pos.x).toBeLessThan(3);
  });
});
