import { describe, expect, it } from 'vitest';
import { testRoom, type Room } from './testRoom';

/** Distance from a point to the nearest point of a box (0 when inside). */
const distToBox = (x: number, y: number, b: Room['obstacles'][number]) =>
  Math.hypot(Math.max(0, Math.abs(x - b.x) - b.hw), Math.max(0, Math.abs(y - b.y) - b.hh));

/**
 * Can a circle of radius `r` get from `from` to `to`? Flood fill on a fine grid of centre
 * positions that keep the whole circle inside the room and clear of every obstacle.
 */
function reachable(room: Room, from: { x: number; y: number }, to: { x: number; y: number }, r: number): boolean {
  const step = 0.1;
  const cols = Math.round((room.maxX - room.minX) / step);
  const rows = Math.round((room.maxY - room.minY) / step);
  const toCell = (p: { x: number; y: number }) => [Math.round((p.x - room.minX) / step), Math.round((p.y - room.minY) / step)];
  const free = (i: number, j: number) => {
    const x = room.minX + i * step;
    const y = room.minY + j * step;
    if (x < room.minX + r || x > room.maxX - r || y < room.minY + r || y > room.maxY - r) return false;
    return room.obstacles.every((b) => distToBox(x, y, b) >= r);
  };
  const [si, sj] = toCell(from);
  const [ti, tj] = toCell(to);
  const seen = new Uint8Array((cols + 1) * (rows + 1));
  const stack = [si, sj];
  seen[sj * (cols + 1) + si] = 1;
  while (stack.length) {
    const j = stack.pop()!;
    const i = stack.pop()!;
    if (i === ti && j === tj) return true;
    for (const [a, c] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
      if (a < 0 || c < 0 || a > cols || c > rows || seen[c * (cols + 1) + a] || !free(a, c)) continue;
      seen[c * (cols + 1) + a] = 1;
      stack.push(a, c);
    }
  }
  return false;
}

describe('test room layout', () => {
  it('lets the hero reach the player start from every spawn point', () => {
    for (const s of testRoom.spawnPoints) {
      expect(reachable(testRoom, s, testRoom.playerStart, testRoom.playerRadius), `spawn ${s.x},${s.y}`).toBe(true);
    }
  });

  it('reachability check can fail (a wall across the room blocks it)', () => {
    const walled: Room = { ...testRoom, obstacles: [{ x: 0, y: -6, hw: 15, hh: 0.5 }] };
    expect(reachable(walled, { x: 0, y: -8.5 }, walled.playerStart, walled.playerRadius)).toBe(false);
  });

  it('keeps spawn points 2 m and the player start 3 m clear of obstacles', () => {
    for (const s of testRoom.spawnPoints) {
      for (const b of testRoom.obstacles) expect(distToBox(s.x, s.y, b), `spawn ${s.x},${s.y}`).toBeGreaterThanOrEqual(2);
    }
    for (const b of testRoom.obstacles) expect(distToBox(testRoom.playerStart.x, testRoom.playerStart.y, b)).toBeGreaterThanOrEqual(3);
  });
});
