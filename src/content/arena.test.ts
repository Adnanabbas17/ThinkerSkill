import { describe, expect, it } from 'vitest';
import { ENEMY_RADIUS } from '../sim/enemies';
import { SHOT_RADIUS } from '../sim/projectiles';
import { defaultTuning } from '../tuning/tuning';
import { arena, chooseRoom, solidParts, type CoreId } from './arena';
import { testRoom, type Box } from './testRoom';

type P = { x: number; y: number };

/** Distance from a point to the nearest point of a box (0 when inside). */
const distToBox = (p: P, b: Box) => Math.hypot(Math.max(0, Math.abs(p.x - b.x) - b.hw), Math.max(0, Math.abs(p.y - b.y) - b.hh));
/** Gap between two boxes (0 when they touch or overlap). */
const boxGap = (a: Box, b: Box) =>
  Math.hypot(Math.max(0, Math.abs(a.x - b.x) - a.hw - b.hw), Math.max(0, Math.abs(a.y - b.y) - a.hh - b.hh));
/** Gap between a box and the nearest outer wall. */
const wallGap = (b: Box) =>
  Math.min(b.x - b.hw - arena.minX, arena.maxX - b.x - b.hw, b.y - b.hh - arena.minY, arena.maxY - b.y - b.hh);

const r = arena.playerRadius;
const solids = arena.obstacles;
const rooms = arena.sourceRooms.map((s) => s.box);
const isRoom = (b: Box) => rooms.includes(b);

/** Can a hero (radius r) stand here: inside the bounds and clear of every solid. */
const standable = (p: P) =>
  p.x >= arena.minX + r && p.x <= arena.maxX - r && p.y >= arena.minY + r && p.y <= arena.maxY - r && solids.every((b) => distToBox(p, b) >= r);

/** Flood fill from the player start on a 0.1 m grid; returns a lookup for "reachable from the start". */
function reachableFromStart(): (p: P) => boolean {
  const step = 0.1;
  const cols = Math.round((arena.maxX - arena.minX) / step) + 1;
  const rows = Math.round((arena.maxY - arena.minY) / step) + 1;
  const at = (i: number, j: number) => ({ x: arena.minX + i * step, y: arena.minY + j * step });
  const seen = new Uint8Array(cols * rows);
  const si = Math.round((arena.playerStart.x - arena.minX) / step);
  const sj = Math.round((arena.playerStart.y - arena.minY) / step);
  const stack = [si, sj];
  seen[sj * cols + si] = 1;
  while (stack.length) {
    const j = stack.pop()!;
    const i = stack.pop()!;
    for (const [a, c] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (a < 0 || c < 0 || a >= cols || c >= rows || seen[c * cols + a] || !standable(at(a, c))) continue;
      seen[c * cols + a] = 1;
      stack.push(a, c);
    }
  }
  return (p) => seen[Math.round((p.y - arena.minY) / step) * cols + Math.round((p.x - arena.minX) / step)] === 1;
}

// Camera, as the renderer places it: centred on the hero, `camBack` towards +y, `camHeight` up,
// looking at the hero, vertical FOV `camFov`, screen up = away from the camera. 16:9 at 1080p.
const ASPECT = 16 / 9;
function onScreen(hero: P, p: P, h = 0): boolean {
  const { camHeight: H, camBack: back, camFov } = defaultTuning;
  const tan = Math.tan((camFov * Math.PI) / 360);
  // World axes: x, up, z = sim y. Forward f points from the camera to the hero.
  const fl = Math.hypot(H, back);
  const f = [0, -H / fl, -back / fl];
  // right = f x (0, 0, -1); up = right x f.
  const right = [f[1] * -1 - f[2] * 0, f[2] * 0 - f[0] * -1, 0];
  const rl = Math.hypot(right[0], right[1], right[2]);
  const rt = right.map((v) => v / rl);
  const up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
  const d = [p.x - hero.x, h - H, p.y - (hero.y + back)];
  const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  if (z <= 0) return false;
  const sx = (d[0] * rt[0] + d[1] * rt[1] + d[2] * rt[2]) / (z * tan * ASPECT);
  const sy = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / (z * tan);
  return Math.abs(sx) <= 1 && Math.abs(sy) <= 1;
}
/** Cores with any part of their footprint on screen. */
function coresOnScreen(hero: P): CoreId[] {
  return arena.cores
    .filter(({ box: b }) => {
      for (let i = 0; i <= 8; i++)
        for (let j = 0; j <= 8; j++)
          if (onScreen(hero, { x: b.x - b.hw + (2 * b.hw * i) / 8, y: b.y - b.hh + (2 * b.hh * j) / 8 })) return true;
      return false;
    })
    .map((c) => c.id);
}
/** Points on a 0.5 m grid. */
function grid(minX: number, maxX: number, minY: number, maxY: number): P[] {
  const out: P[] = [];
  for (let x = Math.ceil(minX * 2) / 2; x <= maxX + 1e-9; x += 0.5)
    for (let y = Math.ceil(minY * 2) / 2; y <= maxY + 1e-9; y += 0.5) out.push({ x, y });
  return out;
}

describe('arena layout', () => {
  it('matches the approved size: 40 x 32 m', () => {
    expect(arena.maxX - arena.minX).toBe(40);
    expect(arena.maxY - arena.minY).toBe(32);
  });

  it('lets the hero reach every vent, terminal, breaker spot, floor label and all 4 sides of each core', () => {
    const reach = reachableFromStart();
    const points: [string, P][] = [
      ...arena.spawnPoints.map((p, i): [string, P] => [`vent ${i + 1}`, p]),
      ...arena.terminals.map((p, i): [string, P] => [`terminal ${i + 1}`, p]),
      ...arena.breakers.map((p, i): [string, P] => [`breaker ${i + 1}`, { x: p.x, y: p.y - r - 0.1 }]),
      ...arena.floorLabels.map((l): [string, P] => [`label ${l.text}`, l]),
    ];
    for (const { id, box: b } of arena.cores) {
      const ox = b.hw + r + 0.1;
      const oy = b.hh + r + 0.1;
      points.push([`core ${id} west`, { x: b.x - ox, y: b.y }], [`core ${id} east`, { x: b.x + ox, y: b.y }]);
      points.push([`core ${id} north`, { x: b.x, y: b.y - oy }], [`core ${id} south`, { x: b.x, y: b.y + oy }]);
    }
    for (const [name, p] of points) expect(reach(p), name).toBe(true);
  });

  it('keeps solids 2.5 m apart and 2.5 m from the outer wall (rooms sit on their edge)', () => {
    for (let i = 0; i < solids.length; i++) {
      for (let j = i + 1; j < solids.length; j++) expect(boxGap(solids[i], solids[j]), `solids ${i}, ${j}`).toBeGreaterThanOrEqual(2.5);
      if (!isRoom(solids[i])) expect(wallGap(solids[i]), `solid ${i}`).toBeGreaterThanOrEqual(2.5);
    }
    for (const b of rooms) expect(wallGap(b)).toBe(0);
  });

  it('keeps the start 3 m and every vent 2 m clear of solids and outer walls', () => {
    for (const b of solids) expect(distToBox(arena.playerStart, b)).toBeGreaterThanOrEqual(3);
    for (const v of arena.spawnPoints) {
      for (const b of solids) expect(distToBox(v, b), `vent ${v.x},${v.y}`).toBeGreaterThanOrEqual(2 - 1e-9);
      const wall = Math.min(v.x - arena.minX, arena.maxX - v.x, v.y - arena.minY, arena.maxY - v.y);
      expect(wall, `vent ${v.x},${v.y}`).toBeGreaterThanOrEqual(2 - 1e-9);
    }
  });

  it('camera: at most 1 core on screen from open floor, only B and C inside room S, never all 3', () => {
    let open = 0;
    for (const p of grid(arena.minX, arena.maxX, arena.minY, arena.maxY)) {
      if (!standable(p)) continue;
      open++;
      expect(coresOnScreen(p).length, `open floor ${p.x},${p.y}`).toBeLessThanOrEqual(1);
    }
    expect(open).toBeGreaterThan(3000);

    const inset = arena.roomWallThickness + r;
    let bothInS = 0;
    for (const room of arena.sourceRooms) {
      const b = room.box;
      for (const p of grid(b.x - b.hw + inset, b.x + b.hw - inset, b.y - b.hh + inset, b.y + b.hh - inset)) {
        const seen = coresOnScreen(p);
        if (room.id !== 'S') expect(seen.length, `room ${room.id} ${p.x},${p.y}`).toBeLessThanOrEqual(1);
        else {
          expect(seen.length).toBeLessThanOrEqual(2);
          if (seen.length === 2) {
            expect(seen).toEqual(['B', 'C']);
            bothInS++;
          }
        }
      }
    }
    expect(bothInS).toBeGreaterThan(0); // the corrected claim is real, not vacuous
  });

  it('at the default pulseRange, no open-floor spot lets Pulse reach enemies at 2 cores (real reach, ignoring cover)', () => {
    // Hero centre to enemy centre: muzzle offset + range + enemy and shot radii. Cover is ignored,
    // so moving a cover block can never open a pair. Checked on a 0.1 m grid.
    const reach = r + defaultTuning.pulseRange + ENEMY_RADIUS + SHOT_RADIUS;
    let checked = 0;
    for (let x = arena.minX; x <= arena.maxX + 1e-9; x += 0.1) {
      for (let y = arena.minY; y <= arena.maxY + 1e-9; y += 0.1) {
        const p = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
        if (!standable(p)) continue;
        checked++;
        // An enemy touching the near side of a core stands ENEMY_RADIUS outside its box.
        const covered = arena.cores.filter(({ box }) => distToBox(p, box) - ENEMY_RADIUS <= reach);
        if (covered.length >= 2) expect.fail(`cores ${covered.map((c) => c.id).join('+')} both in reach from ${p.x}, ${p.y}`);
      }
    }
    expect(checked).toBeGreaterThan(80000);
  });
});

describe('arena drawing', () => {
  it('every solid is drawn: one part per obstacle, same boxes, same order', () => {
    const parts = solidParts(arena);
    expect(parts.map((p) => p.box)).toEqual(arena.obstacles);
    parts.forEach((p, i) => expect(p.box).toBe(arena.obstacles[i]));
    const count = (k: string) => parts.filter((p) => p.kind === k).length;
    expect([count('room'), count('cover'), count('console'), count('core')]).toEqual([4, 8, 1, 3]);
  });

  it('non-solid things (vents, terminals, labels) sit on open floor, so nothing undrawn collides', () => {
    for (const p of [...arena.spawnPoints, ...arena.terminals, ...arena.floorLabels]) {
      for (const b of solids) expect(distToBox(p, b), `${p.x},${p.y}`).toBeGreaterThan(0);
    }
  });

  it('the test room draws all of its obstacles too', () => {
    expect(solidParts(testRoom).map((p) => p.box)).toEqual(testRoom.obstacles);
  });
});

describe('room choice', () => {
  it('loads the arena by default and the M1 test room with ?room=test', () => {
    expect(chooseRoom('')).toBe(arena);
    expect(chooseRoom('?room=other')).toBe(arena);
    expect(chooseRoom('?room=test')).toBe(testRoom);
    expect(chooseRoom('?webgl=1&room=test')).toBe(testRoom);
  });
});
