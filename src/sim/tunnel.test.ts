import { describe, expect, it } from 'vitest';
import { testRoom } from '../content/testRoom';
import { maxTuning } from '../tuning/tuning';
import { createSim, stepSim } from './sim';
import { distToBox, emptyRoom } from './testUtils';

// Every tuning value at its slider maximum: fastest walking and the largest run multiplier.
const t = maxTuning();
const room = testRoom;
const r = room.playerRadius;
const EPS = 1e-6;

function assertOutsideSolids(pos: { x: number; y: number }, where: string) {
  expect(pos.x, where).toBeGreaterThanOrEqual(room.minX + r - EPS);
  expect(pos.x, where).toBeLessThanOrEqual(room.maxX - r + EPS);
  expect(pos.y, where).toBeGreaterThanOrEqual(room.minY + r - EPS);
  expect(pos.y, where).toBeLessThanOrEqual(room.maxY - r + EPS);
  for (const b of room.obstacles) expect(distToBox(pos, b), where).toBeGreaterThanOrEqual(r - EPS);
}

describe('no tunnelling at slider maximums', () => {
  it('player never passes through walls or obstacles while moving and running in 64 directions', () => {
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const move = { x: Math.cos(a), y: Math.sin(a) };
      const s = createSim(room, i);
      for (let tick = 0; tick < 240; tick++) {
        // Run all the time; also curve the path to scrape along obstacles.
        const curve = { x: Math.cos(a + tick * 0.02), y: Math.sin(a + tick * 0.02) };
        stepSim(s, { move: tick < 120 ? move : curve, aim: { x: 0, y: 0 }, run: true, fire: false }, t, room);
        assertOutsideSolids(s.player.pos, `dir ${i} tick ${tick}`);
      }
    }
  });

  it('player running straight at each obstacle stops at its face', () => {
    for (const b of room.obstacles) {
      for (const side of [-1, 1]) {
        const s = createSim(room, 1);
        s.player.pos = { x: b.x + side * (b.hw + 3), y: b.y };
        s.player.prevPos = { ...s.player.pos };
        for (let tick = 0; tick < 60; tick++) {
          stepSim(s, { move: { x: -side, y: 0 }, aim: b, run: true, fire: false }, t, room);
          assertOutsideSolids(s.player.pos, `box ${b.x},${b.y} side ${side}`);
        }
        expect(Math.sign(s.player.pos.x - b.x)).toBe(side);
      }
    }
  });

  it('player cannot cross a thin 0.5 m wall at max speed, or at a much higher run speed (safety margin)', () => {
    const wall = { x: 0, y: 0, hw: 0.25, hh: 8 };
    const thin = emptyRoom({ obstacles: [wall], playerStart: { x: -4, y: 0 } });
    // 200 m/s = 3.3 m per tick: only sub-stepping stops this from tunnelling.
    for (const tuning of [t, { ...t, moveSpeed: 200 / t.runSpeedMultiplier, moveAccel: 100000 }]) {
      const s = createSim(thin, 1);
      for (let tick = 0; tick < 90; tick++) {
        stepSim(s, { move: { x: 1, y: 0 }, aim: { x: 10, y: 0 }, run: true, fire: false }, tuning, thin);
        expect(s.player.pos.x).toBeLessThan(0);
        expect(distToBox(s.player.pos, wall)).toBeGreaterThanOrEqual(r - EPS);
      }
    }
  });
});
